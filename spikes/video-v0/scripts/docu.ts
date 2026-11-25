// Formato documental (imágenes reales + gráficos). Uso:
//   pnpm docu search <dossier.json> --name <video>        busca imágenes en Wikimedia Commons
//   pnpm docu guion  <dossier.json> --name <video>        la IA mira las imágenes y escribe el guion
//   pnpm docu texts  --name <video>                       deja tts/texts/<video>.json para la voz
//   pnpm docu render --name <video> --voices <carpeta>    renderiza el video
// Todo vive en out/docu/<video>/. --effort <low|medium|high> · --model <alias> (sonnet por defecto).
import { execFileSync } from "node:child_process";
import { chmodSync, cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { createClaudeCodeProvider, resolveClaudeBin, type TaskImage, type Usage } from "@radev/ai";
import { bundle } from "@remotion/bundler";
import { openBrowser, renderMedia, renderStill, selectComposition } from "@remotion/renderer";
import { z } from "zod";
import { type Candidate, checkDocu, docuSchema, type DocuGuion, graphicSchema, viewSchema } from "../src/photo/schema";

const ROOT = path.resolve(import.meta.dirname, "..");
const envFile = path.resolve(ROOT, "..", "..", ".env");
if (existsSync(envFile)) process.loadEnvFile(envFile);
const args = process.argv.slice(2);
const flag = (name: string) => {
  const i = args.indexOf(`--${name}`);
  if (i < 0) return undefined;
  const v = args[i + 1];
  args.splice(i, v && !v.startsWith("--") ? 2 : 1);
  return v ?? "";
};
const name = flag("name") ?? "docu";
const effort = flag("effort") ?? "low";
const model = flag("model") ?? "sonnet";
const voicesArg = flag("voices");
const dry = flag("dry") !== undefined;
const reuse = flag("reuse") !== undefined;
const noReview = flag("no-review") !== undefined;
const flagNoMeta = flag("no-meta") !== undefined;
const fileArg = flag("file");
const pins = (flag("pin") ?? "").split(",").map((t) => t.trim()).filter(Boolean);
const [mode, ...rest] = args;
const dir = path.join(ROOT, "out", "docu", name);
mkdirSync(path.join(dir, "img"), { recursive: true });

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const UA = { "User-Agent": "spike-video/0 (educational project)" };

function provider(level = effort) {
  const bin = path.join(dir, `claude-effort-${level}.sh`);
  writeFileSync(bin, `#!/bin/sh\nexec ${JSON.stringify(resolveClaudeBin())} --effort ${level} "$@"\n`);
  chmodSync(bin, 0o755);
  return createClaudeCodeProvider({ bin });
}

const usages: { step: string; usage: Usage | null }[] = [];
function logUsage(step: string, u: Usage | null) {
  usages.push({ step, usage: u });
  console.log(
    u
      ? `  ${step}: ${u.inputTokens} entrada / ${u.outputTokens} salida · ${(u.durationMs / 1000).toFixed(1)} s · lista USD ${u.costUsd?.toFixed(3) ?? "?"}`
      : `  ${step}: sin uso`,
  );
  const file = path.join(dir, "usage.json");
  const prev = existsSync(file) ? (JSON.parse(readFileSync(file, "utf8")) as unknown[]) : [];
  writeFileSync(file, JSON.stringify([...prev, { step, usage: u }], null, 1));
}

/** El dossier sin extractos ni urls: lo que la IA necesita para escribir. */
function compactDossier(file: string): { text: string; json: string } {
  const d = (JSON.parse(readFileSync(path.resolve(file), "utf8")) as { dossier: unknown }).dossier;
  const json = JSON.stringify(d, (k, v) => (k === "excerpt" || k === "url" ? undefined : v));
  return { text: JSON.stringify(d), json };
}

// ───────────────────────── search ─────────────────────────
const LICENSE_OK = /public domain|^pd\b|cc0|no restrictions|^cc[ -]by(-sa)?[ -]\d/i;
const LICENSE_BAD = /\b(nc|nd)\b|-nc|-nd|fair use|non-?free/i;
const strip = (s: string | undefined) =>
  (s ?? "").replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/\s+/g, " ").trim();

async function commons(params: Record<string, string>) {
  const u = `https://commons.wikimedia.org/w/api.php?${new URLSearchParams({ format: "json", ...params })}`;
  for (let i = 0; i < 4; i++) {
    const r = await fetch(u, { headers: UA });
    if (r.ok) return (await r.json()) as { query?: { pages?: Record<string, unknown> } };
    await sleep(15_000 * (i + 1));
  }
  throw new Error("Commons no responde");
}

async function download(url: string, file: string) {
  for (let i = 0; i < 5; i++) {
    const r = await fetch(url, { headers: UA });
    if (r.ok) return writeFileSync(file, Buffer.from(await r.arrayBuffer()));
    console.log(`  ${r.status} (reintento ${i + 1})`);
    await sleep(20_000 * (i + 1));
  }
  throw new Error(`No se pudo bajar ${url}`);
}

async function search(dossierFile: string) {
  const { json } = compactDossier(dossierFile);
  const p = provider();
  const poolFile = path.join(dir, "pool.json");
  console.log(reuse ? "→ reutilizando pool.json (sin buscar de nuevo)…" : `→ consultas de búsqueda (${model}, effort ${effort})…`);
  type Hit = Candidate & { score: number; thumb: string };
  const runSearch = async (): Promise<Hit[]> => {
  const r = await p.generate({
    task: "carousel.generate",
    brandId: "spike-video",
    model,
    prompt: "Leé `dossier.json` y devolvé las consultas de búsqueda de imágenes para Wikimedia Commons.",
    files: {
      "CLAUDE.md": `# Buscador de imágenes de archivo

Para un video documental sobre el tema de \`dossier.json\`, proponé de 24 a 30 consultas de búsqueda para Wikimedia Commons, **de 1 a 3 palabras cada una** (Commons exige que estén todas: con 4 o más casi nunca encuentra nada) que encuentren imágenes reales y libres: fotos de época, retratos de los protagonistas, el lugar, el objeto, portadas de diarios y documentos del momento, mapas. **Las primeras 8 consultas son las del hecho central** (el robo, el accidente, el caso en sí, en inglés y en el idioma local: «Mona Lisa theft», «Mona Lisa stolen», «Joconde vol 1911», «Peruggia») y después los protagonistas, lugares, documentos y prensa. Ejemplos buenos: «Vincenzo Peruggia», «Mona Lisa 1911», «Salon Carré», «Joconde volée», «Uffizi 1913». Mezclá idiomas según dónde pasó (inglés, francés, italiano, español…), usá nombres propios y años, y variá: personas, lugares, objetos, documentos y diarios de la época, mapas. **Solo cosas que el dossier menciona**: nada de temas laterales (ciudades de paso, ejércitos, etc.) salvo que sean parte de la historia.`,
      "dossier.json": json,
    },
    schema: z.object({ queries: z.array(z.string().min(3).max(60)).min(10).max(34) }),
    maxTurns: 2,
    timeoutMs: 4 * 60_000,
  });
  logUsage("consultas", r.usage);
  if (!r.ok) throw new Error(`${r.error.kind}: ${r.error.message}`);
  const hits = new Map<string, Hit>();
  type Page = {
    title: string;
    index?: number;
    imageinfo?: { mime: string; width: number; height: number; thumburl: string; descriptionurl: string; extmetadata: Record<string, { value: string }> }[];
  };
  const INFO = { prop: "imageinfo", iiprop: "url|extmetadata|size|mime", iiurlwidth: "1280" /* tamaño estándar de Commons: otros dan 429 */ };
  /** Suma los resultados de una consulta a `hits`; `bonus` premia los que vienen de una categoría del tema. */
  const addPages = (pages: Page[], bonus: number, minWidth = 700) => {
    let found = 0;
    for (const pg of pages) {
      const ii = pg.imageinfo?.[0];
      if (!ii || !/^image\/(jpeg|png|webp)$/.test(ii.mime) || ii.width < minWidth) continue;
      const lic = ii.extmetadata.LicenseShortName?.value ?? "";
      if (!LICENSE_OK.test(lic) || LICENSE_BAD.test(lic)) continue;
      const rank = 30 - (pg.index ?? 15) + bonus;
      const prev = hits.get(pg.title);
      if (prev) prev.score += rank + 6;
      else {
        found++;
        hits.set(pg.title, {
          id: "",
          title: pg.title.replace(/^File:/, "").replace(/\.\w+$/, ""),
          description: strip(ii.extmetadata.ImageDescription?.value).slice(0, 300),
          date: strip(ii.extmetadata.DateTimeOriginal?.value ?? ii.extmetadata.DateTime?.value).slice(0, 40),
          author: strip(ii.extmetadata.Artist?.value).slice(0, 60),
          license: lic,
          page: ii.descriptionurl,
          file: "",
          width: ii.width,
          height: ii.height,
          score: rank + (ii.width >= 1200 ? 4 : 0),
          thumb: ii.thumburl,
        });
      }
    }
    return found;
  };
  const pagesOf = (res: { query?: { pages?: Record<string, unknown> } }) => Object.values(res.query?.pages ?? {}) as Page[];
  for (const [n, q] of r.data.queries.entries()) {
    await sleep(1500);
    const found = addPages(
      pagesOf(await commons({ action: "query", generator: "search", gsrsearch: q, gsrnamespace: "6", gsrlimit: "30", ...INFO })),
      0,
    );
    // Las categorías de Commons sobre el tema (p. ej. «Theft of the Mona Lisa») juntan justo lo que sirve.
    let fromCats = 0;
    if (n < 10) {
      await sleep(1500);
      const cats = pagesOf(await commons({ action: "query", generator: "search", gsrsearch: q, gsrnamespace: "14", gsrlimit: "2" }));
      for (const cat of cats) {
        await sleep(1500);
        fromCats += addPages(
          pagesOf(await commons({ action: "query", generator: "categorymembers", gcmtitle: cat.title, gcmtype: "file", gcmlimit: "40", ...INFO })),
          8,
        );
      }
    }
    console.log(`  «${q}»: ${found} nuevas${fromCats ? ` + ${fromCats} de categorías` : ""}`);
  }
  // Imágenes que el operador pide sí o sí (--pin "Archivo uno.jpg,Archivo dos.jpg").
  for (const t of pins) {
    await sleep(1500);
    const n = addPages(pagesOf(await commons({ action: "query", titles: `File:${t.replace(/^File:/, "")}`, ...INFO })), 100, 500);
    console.log(`  fijada «${t}»: ${n ? "ok" : "ya estaba o no sirve (licencia/tamaño)"}`);
  }
  // Curaduría por texto: la IA elige entre ~240 resultados (solo título y descripción, barato).
  return [...hits.values()].sort((x, y) => y.score - x.score).slice(0, 240);
  };
  const pool: Hit[] = reuse ? JSON.parse(readFileSync(poolFile, "utf8")) : await runSearch();
  if (!reuse) writeFileSync(poolFile, JSON.stringify(pool));
  console.log(`→ curaduría: ${pool.length} resultados → la IA elige los que sirven a la historia…`);
  const cur = await p.generate({
    task: "carousel.generate",
    brandId: "spike-video",
    model,
    prompt: "Elegí las imágenes para el video con `resultados.json` y `dossier.json`. Devolvé los `n` elegidos.",
    files: {
      "CLAUDE.md": `# Curador de imágenes

Del archivo \`resultados.json\` (imágenes libres de Wikimedia Commons: n, título, descripción, fecha) elegí **de 32 a 40** para un video documental sobre el tema de \`dossier.json\`. Criterios:
- Priorizá lo que **muestra la historia**: fotos y documentos de época del hecho, retratos de los protagonistas, el lugar tal como era, portadas de diarios y carteles del momento, objetos clave, mapas.
- Hace falta **variedad**: personas, lugares, documentos, prensa, objetos. Si hay muchas versiones de la misma imagen (restauraciones, recortes, colores), elegí **una sola**.
- **No descartes nunca una imagen que muestra el hecho o a sus protagonistas** (robo, ladrón, detención, policía, el lugar del hecho, el cuadro vacío, la prensa del momento): es mejor tener de más. Los títulos con palabras como robo, stolen, theft, vol, Joconde, el nombre del ladrón o del investigador son oro.
- Descartá lo que no tiene que ver con la historia: otros temas u obras, poemas o portadas de libros, lápidas y mojones, monumentos, fotos actuales sin relación, cartas o trámites sin imagen que mostrar.
- Una imagen actual del lugar sirve solo si no hay una de época.`,
      "dossier.json": json,
      "resultados.json": JSON.stringify(pool.map((h, n) => ({ n, title: h.title, description: h.description.slice(0, 100), date: h.date }))),
    },
    schema: z.object({ keep: z.array(z.number().int().min(0)).min(24).max(46) }),
    maxTurns: 2,
    timeoutMs: 5 * 60_000,
  });
  logUsage("curaduría", cur.usage);
  if (!cur.ok) throw new Error(`${cur.error.kind}: ${cur.error.message}`);
  if (dry) {
    for (const n of cur.data.keep) console.log(`  ${String(n).padStart(3)} ${pool[n]?.title ?? "?"}`);
    return;
  }
  const top = [...new Set(cur.data.keep)].map((n) => pool[n]).filter((h): h is Hit => h !== undefined);
  console.log(`→ bajando ${top.length} imágenes (con pausas para no saturar Commons)…`);
  const out: Candidate[] = [];
  for (const [i, h] of top.entries()) {
    const id = `i${String(i + 1).padStart(2, "0")}`;
    const ext = h.thumb.match(/\.(jpe?g|png|webp)(\?|$)/i)?.[1]?.toLowerCase() ?? "jpg";
    const file = `img/${id}.${ext === "jpeg" ? "jpg" : ext}`;
    await sleep(3000);
    await download(h.thumb, path.join(dir, file));
    const [w, hh] = execFileSync("ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height", "-of", "csv=p=0", path.join(dir, file)])
      .toString().trim().split(",").map(Number);
    // miniatura chica para que la IA las mire sin gastar de más
    execFileSync("ffmpeg", ["-v", "error", "-y", "-i", path.join(dir, file), "-vf", "scale='min(640,iw)':-2", "-q:v", "4", path.join(dir, `img/${id}.small.jpg`)]);
    const { score: _s, thumb: _t, ...c } = h;
    out.push({ ...c, id, file, width: w ?? h.width, height: hh ?? h.height });
  }
  writeFileSync(path.join(dir, "candidates.json"), JSON.stringify(out, null, 1));
  console.log(`✓ ${out.length} candidatas → ${path.join(dir, "candidates.json")}`);
}

// ───────────────────────── pin: sumar imágenes a un video ya buscado ─────────────────────────
async function pinImages(titles: string[]) {
  const file = path.join(dir, "candidates.json");
  const out = JSON.parse(readFileSync(file, "utf8")) as Candidate[];
  for (const t of titles) {
    const title = `File:${t.replace(/^File:/, "")}`;
    await sleep(1500);
    const res = (await commons({ action: "query", titles: title, prop: "imageinfo", iiprop: "url|extmetadata|size|mime", iiurlwidth: "1280" })) as { query?: { pages?: Record<string, unknown> } };
    const pg = Object.values(res.query?.pages ?? {})[0] as { imageinfo?: { mime: string; width: number; height: number; thumburl: string; descriptionurl: string; extmetadata: Record<string, { value: string }> }[] } | undefined;
    const ii = pg?.imageinfo?.[0];
    const lic = ii?.extmetadata.LicenseShortName?.value ?? "";
    if (!ii || !/^image\/(jpeg|png|webp)$/.test(ii.mime) || !LICENSE_OK.test(lic) || LICENSE_BAD.test(lic)) {
      console.log(`  ✗ ${t}: no existe o la licencia/formato no sirve (${lic || "?"})`);
      continue;
    }
    if (out.some((c) => c.page === ii.descriptionurl)) {
      console.log(`  · ${t}: ya estaba`);
      continue;
    }
    const id = `i${String(out.length + 1).padStart(2, "0")}`;
    const ext = ii.thumburl.match(/\.(jpe?g|png|webp)(\?|$)/i)?.[1]?.toLowerCase() ?? "jpg";
    const rel = `img/${id}.${ext === "jpeg" ? "jpg" : ext}`;
    await sleep(3000);
    await download(ii.thumburl, path.join(dir, rel));
    execFileSync("ffmpeg", ["-v", "error", "-y", "-i", path.join(dir, rel), "-vf", "scale='min(640,iw)':-2", "-q:v", "4", path.join(dir, `img/${id}.small.jpg`)]);
    const em = ii.extmetadata;
    out.push({
      id,
      title: title.replace(/^File:/, "").replace(/\.\w+$/, ""),
      description: strip(em.ImageDescription?.value).slice(0, 300),
      date: strip(em.DateTimeOriginal?.value ?? em.DateTime?.value).slice(0, 40),
      author: strip(em.Artist?.value).slice(0, 60),
      license: lic,
      page: ii.descriptionurl,
      file: rel,
      width: ii.width,
      height: ii.height,
    });
    console.log(`  ✓ ${id} ${t} (${ii.width}x${ii.height}, ${lic})`);
  }
  writeFileSync(file, JSON.stringify(out, null, 1));
}

// ───────────────────────── guion ─────────────────────────
async function guion(dossierFile: string) {
  const { text, json } = compactDossier(dossierFile);
  cpSync(path.resolve(dossierFile), path.join(dir, "dossier.json"));
  const candidates = JSON.parse(readFileSync(path.join(dir, "candidates.json"), "utf8")) as Candidate[];
  const brief = JSON.stringify(
    candidates.map((c) => ({ id: c.id, title: c.title, description: c.description, date: c.date, author: c.author, license: c.license, size: `${c.width}x${c.height}` })),
  );
  const images: TaskImage[] = candidates.map((c) => ({
    id: c.id,
    note: `${c.title} (${c.date || "s/f"}), ${c.width}x${c.height}`,
    mime: "image/jpeg",
    data: readFileSync(path.join(dir, `img/${c.id}.small.jpg`)),
  }));
  const instructions = readFileSync(path.join(ROOT, "src", "photo", "docu.md"), "utf8");
  const p = provider();
  let errors: string[] = [];
  let previous: DocuGuion | undefined;
  for (let attempt = 1; attempt <= 3; attempt++) {
    console.log(`→ guion (intento ${attempt}, ${model}, effort ${effort})…`);
    const r = await p.generate({
      task: "carousel.generate",
      brandId: "spike-video",
      model,
      prompt:
        attempt === 1
          ? "Escribí el guion del video con `dossier.json`, `candidatas.json` y las imágenes. Devolvé el objeto que pide el schema."
          : `El guion anterior (\`anterior.json\`) tiene estos errores. Devolvé el guion COMPLETO corregido, cambiando lo mínimo:\n${errors.map((e) => `- ${e}`).join("\n")}`,
      files: {
        "CLAUDE.md": instructions,
        "dossier.json": json,
        "candidatas.json": brief,
        ...(previous ? { "anterior.json": JSON.stringify(previous) } : {}),
      },
      // las imágenes solo en el primer intento: las correcciones son de texto
      ...(attempt === 1 ? { images } : {}),
      schema: docuSchema,
      maxTurns: 3,
      timeoutMs: 10 * 60_000,
    });
    logUsage(`guion ${attempt}`, r.usage);
    if (!r.ok) {
      errors = [`${r.error.kind}: ${r.error.message}`];
      console.log(`  ${errors[0]}`);
      continue;
    }
    for (const sc of r.data.scenes) if (sc.highlight) sc.highlight = [...new Set(sc.highlight.flatMap((h) => h.split(/\s+/)).filter((w) => w.length > 2))].slice(0, 4);
    previous = r.data;
    errors = checkDocu(r.data, candidates, text);
    writeFileSync(path.join(dir, `guion-${attempt}.json`), JSON.stringify(r.data, null, 1));
    if (errors.length === 0) {
      writeFileSync(path.join(dir, "guion-sin-revisar.json"), JSON.stringify(r.data, null, 1));
      const final = noReview ? r.data : await review(r.data, candidates, text, json);
      writeFileSync(path.join(dir, "guion.json"), JSON.stringify(final, null, 1));
      const chars = final.scenes.reduce((n, s) => n + s.narration.length, 0);
      console.log(`✓ guion válido: ${final.scenes.length} escenas, ${chars} caracteres → ${path.join(dir, "guion.json")}`);
      return;
    }
    for (const e of errors) console.log(`  ✗ ${e}`);
  }
  console.log("✗ no salió un guion válido en 3 intentos (los intentos quedaron en la carpeta).");
  process.exitCode = 1;
}

// ───────────────────────── review (verificación de hechos) ─────────────────────────
const reviewSchema = z.object({
  fixes: z
    .array(
      z
        .object({
          scene: z.number().int().min(1).describe("Número de escena (1 = la primera)."),
          kind: z.enum(["no-respaldado", "disputa", "no-confirmado", "cita", "numero", "imagen", "estilo"]),
          problem: z.string().min(5).max(300),
          narration: z.string().min(10).max(260).optional().describe("La narración corregida COMPLETA, si había que cambiarla."),
          cita: z.object({ text: z.string().min(1).max(110), by: z.string().min(1).max(36) }).strict().optional(),
          caption: z.string().min(1).max(70).optional().describe("Aclaración de la imagen, si insinúa lo que no es."),
          image: z.string().regex(/^i\d{2,3}$/).optional().describe("Id de una candidata mejor, si la imagen no muestra lo que se dice."),
          from: viewSchema.optional(),
          to: viewSchema.optional(),
          graphics: z.array(graphicSchema).max(2).optional().describe("Los gráficos de la escena corregidos COMPLETOS, si al cambiar la narración alguno quedó con un dato que ya no se dice."),
        })
        .strict(),
    )
    .max(16),
});

const REVIEW_RULES = `# Verificador de hechos

Revisás el guion de un video documental (\`guion.json\`) contra la investigación (\`dossier.json\`: \`facts\` con id, \`quotes\`, \`disputed\`, \`unconfirmed\`). Tu trabajo es que **nada falso, exagerado ni dudoso llegue al aire**. Revisá una por una la narración, **las imágenes**, los gráficos (\`cifra\`, \`fecha\`, \`nombre\`, \`cita\`, \`cronologia\`) y los \`caption\` de cada escena. Buscá:

- **no-respaldado**: una afirmación que ningún \`fact\` sostiene, o un adorno que suena a dato («pasillos vacíos», «con un plan simple», «el cuadro más vigilado de Francia») sin respaldo. Corregila a lo que el dossier sí dice, o quitala.
- **disputa**: algo que el dossier marca en \`disputed\` contado como cierto. Reescribilo para que valga con todas las versiones («más de dos años») o atribuilo («según…»).
- **no-confirmado**: algo de \`unconfirmed\` afirmado como hecho.
- **cita**: una \`cita\` que no es traducción fiel de una de \`quotes\` (parafraseada, resumida, de otra persona, o puesta donde no se habla de eso). Devolvé \`cita\` con el texto fiel.
- **numero**: una cifra, fecha, edad o duración distinta de la del dossier o mal combinada.
- **imagen**: el \`caption\` o la narración insinúa que la imagen muestra algo que no muestra (una reconstrucción, una pintura, una foto actual). Devolvé \`caption\`.
- **estilo**: voseo roto o palabras no rioplatenses («ordenador», «coger»…).

**Coherencia**: si corregís una narración, revisá que los gráficos de esa escena (fecha, cifra, nombre) no sigan mostrando un dato que ya no se dice; si hace falta, devolvé \`graphics\` completos corregidos. Una \`fecha\` en pantalla solo puede tener números que la voz diga en esa escena.\n\nReglas: reportá **solo problemas reales** (si todo está respaldado, devolvé \`fixes\` vacío). Para cada uno devolvé la escena y la corrección mínima: \`narration\` completa corregida (similar en largo; si una palabra de enganche de un gráfico está en la narración, conservala), o \`cita\`, o \`caption\`. No cambies lo que está bien ni el estilo de lo correcto.`;

type Fix = z.infer<typeof reviewSchema>["fixes"][number];

async function review(g: DocuGuion, candidates: Candidate[], dossierText: string, json: string) {
  const view = {
    title: g.title,
    scenes: g.scenes.map((s, i) => ({
      scene: i + 1,
      narration: s.narration,
      image: candidates.find((c) => c.id === s.image)?.title,
      caption: s.caption,
      graphics: s.graphics,
    })),
    facts: g.facts,
  };
  console.log(`→ verificación de hechos (${model}, effort medium)…`);
  const r = await provider("medium").generate({
    task: "carousel.generate",
    brandId: "spike-video",
    model,
    prompt: "Verificá `guion.json` contra `dossier.json` y devolvé las correcciones.",
    files: {
      "CLAUDE.md": REVIEW_RULES,
      "dossier.json": json,
      "guion.json": JSON.stringify(view),
      "candidatas.json": JSON.stringify(candidates.map((c) => ({ id: c.id, title: c.title, description: c.description.slice(0, 90), date: c.date }))),
    },
    images: [...new Set(g.scenes.map((sc) => sc.image))].flatMap((id) => {
      const c = candidates.find((x) => x.id === id);
      return c ? [{ id, note: `${c.title} (${c.width}x${c.height})`, mime: "image/jpeg" as const, data: readFileSync(path.join(dir, `img/${id}.small.jpg`)) }] : [];
    }),
    schema: reviewSchema,
    maxTurns: 5,
    timeoutMs: 8 * 60_000,
  });
  logUsage("verificación", r.usage);
  if (!r.ok) throw new Error(`${r.error.kind}: ${r.error.message}`);
  let cur = structuredClone(g);
  const base = new Set(checkDocu(cur, candidates, dossierText));
  const applied: Fix[] = [];
  const rejected: { fix: Fix; why: string }[] = [];
  for (const fix of r.data.fixes) {
    const next = structuredClone(cur);
    const sc = next.scenes[fix.scene - 1];
    if (!sc) {
      rejected.push({ fix, why: "escena inexistente" });
      continue;
    }
    if (fix.narration) sc.narration = fix.narration;
    if (fix.caption) sc.caption = fix.caption;
    if (fix.graphics) sc.graphics = fix.graphics;
    if (fix.image) {
      // sin encuadres propios: un acercamiento suave al centro
      sc.image = fix.image;
      sc.from = fix.from ?? { cx: 0.5, cy: 0.5, vw: 1 };
      sc.to = fix.to ?? { cx: 0.5, cy: 0.45, vw: 0.6 };
    }
    if (fix.cita) {
      const cita = sc.graphics.find((x) => x.kind === "cita");
      if (cita && cita.kind === "cita") {
        cita.text = fix.cita.text;
        cita.by = fix.cita.by;
      } else {
        rejected.push({ fix, why: "la escena no tiene cita" });
        continue;
      }
    }
    // se acepta solo si no suma errores nuevos (palabras de enganche, números, largo…)
    const fresh = checkDocu(next, candidates, dossierText).filter((e) => !base.has(e));
    if (fresh.length > 0) rejected.push({ fix, why: fresh.join(" | ") });
    else {
      cur = next;
      applied.push(fix);
    }
  }
  for (const f of applied) console.log(`  ✓ escena ${f.scene} [${f.kind}] ${f.problem}`);
  for (const { fix, why } of rejected) console.log(`  ✗ escena ${fix.scene} [${fix.kind}] ${fix.problem} → no se aplicó: ${why}`);
  if (r.data.fixes.length === 0) console.log("  ✓ sin observaciones");
  writeFileSync(path.join(dir, "review.json"), JSON.stringify({ applied, rejected }, null, 1));
  return cur;
}

// ───────────────────────── meta (miniatura + descripción para subir) ─────────────────────────
const metaSchema = z
  .object({
    title: z.string().min(10).max(70),
    hook: z.string().min(80).max(420),
    hashtags: z.array(z.string().regex(/^#[\p{L}\p{N}]{3,24}$/u)).min(3).max(5),
    chapters: z
      .array(z.object({ scene: z.number().int().min(1), title: z.string().min(3).max(40) }).strict())
      .min(4)
      .max(8),
    thumbnail: z
      .object({
        image: z.string().regex(/^i\d{2,3}$/),
        cx: z.number().min(0).max(1),
        cy: z.number().min(0).max(1),
        vw: z.number().min(0.25).max(1),
        kicker: z.string().min(2).max(18),
        lines: z.array(z.string().min(2).max(14)).min(2).max(3),
        accent: z.string().min(2).max(14),
      })
      .strict(),
  })
  .strict();
type Meta = z.infer<typeof metaSchema>;

const META_RULES = `# Responsable de publicación

Para un video documental corto de historias reales (voz en off, imágenes de archivo), preparás lo que se necesita para subirlo a YouTube. Recibís \`guion.json\` (escenas, narración y datos), \`dossier.json\` (resumen) y **las imágenes usadas** con su id. Español rioplatense con voseo, tono serio y con intriga.

- **title**: hasta 70 caracteres, concreto y con intriga. Dice de qué se trata (el hecho, el nombre, la fecha) sin spoilear el final ni prometer lo que el video no muestra. Sin MAYÚSCULAS sostenidas, sin clickbait falso.
- **hook**: 2 o 3 oraciones (máximo ~400 caracteres) para el inicio de la descripción: plantean la historia y la pregunta que mantiene la atención. Solo datos del guion.
- **hashtags**: 3 a 5, sin espacios ni tildes problemáticas (#MonaLisa #Historia).
- **chapters**: 4 a 8 capítulos con el número de la escena donde empiezan (el primero es la escena 1; separados por unas 3 o más escenas) y un título corto y claro (no spoilers).
- **thumbnail**: elegí **entre las imágenes usadas** la más fuerte para una miniatura: un rostro o un objeto claro, gran contraste, que se entienda de lejos. \`cx\`, \`cy\` es el centro del encuadre sobre la imagen (0 a 1) y \`vw\` el ancho visible (0,4 a 0,8 suele andar: tiene que llenar el cuadro con lo principal, nada de zonas vacías). El texto: **2 o 3 líneas de hasta 14 caracteres, 6 palabras como máximo en total**, que despierten curiosidad sin mentir (por ejemplo «EL ROBO / DEL SIGLO»); \`accent\` es la palabra más importante, copiada igual que en las líneas; \`kicker\` una etiqueta corta (hasta 18 caracteres, p. ej. «CASO REAL» o el año).`;

const clock = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, "0")}`;

async function meta(g: DocuGuion, candidates: Candidate[], voiceDir: string) {
  const dossier = JSON.parse(readFileSync(path.join(dir, "dossier.json"), "utf8")) as {
    dossier: { topic: string; summary: string; facts: { id: string; claim: string; sourceTitle?: string; url?: string }[] };
  };
  type Manifest = { scenes: { frames: number }[] };
  const manifest = JSON.parse(readFileSync(path.join(voiceDir, "manifest.json"), "utf8")) as Manifest;
  const starts: number[] = [];
  let acc = 0;
  g.scenes.forEach((sc, i) => {
    starts.push(acc);
    acc += ((manifest.scenes[i]?.frames ?? 0) + Math.round((sc.tail ?? 0) * 30)) / 30;
  });
  const usedIds = [...new Set(g.scenes.map((sc) => sc.image))];
  const used = usedIds.map((id) => candidates.find((c) => c.id === id) as Candidate);
  const images: TaskImage[] = used.map((c) => ({
    id: c.id,
    note: `${c.title} (${c.width}x${c.height})`,
    mime: "image/jpeg",
    data: readFileSync(path.join(dir, `img/${c.id}.small.jpg`)),
  }));
  const view = { title: g.title, scenes: g.scenes.map((sc, i) => ({ scene: i + 1, image: sc.image, narration: sc.narration })) };
  const check = (m: Meta): string[] => {
    const errs: string[] = [];
    if (!usedIds.includes(m.thumbnail.image)) errs.push(`thumbnail.image › ${m.thumbnail.image} no se usa en el video`);
    const words = m.thumbnail.lines.join(" ").split(/\s+/).filter(Boolean);
    if (words.length > 6) errs.push(`thumbnail.lines › ${words.length} palabras; máximo 6`);
    const norm = (t: string) => t.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
    const lineWords = new Set(words.map(norm));
    if (!m.thumbnail.accent.split(/\s+/).every((w) => lineWords.has(norm(w)))) errs.push(`thumbnail.accent › "${m.thumbnail.accent}" tiene que estar escrito igual en las líneas`);
    const sc = m.chapters.map((c) => c.scene);
    if (sc[0] !== 1) errs.push("chapters › el primero tiene que ser la escena 1 (0:00)");
    for (const [i, c] of sc.entries()) {
      if (c > g.scenes.length) errs.push(`chapters.${i} › escena ${c} inexistente`);
      const prev = sc[i - 1];
      if (prev !== undefined && (starts[c - 1] ?? 0) - (starts[prev - 1] ?? 0) < 10) errs.push(`chapters.${i} › a menos de 10 s del anterior (YouTube lo exige)`);
    }
    return errs;
  };
  const p = provider();
  let errors: string[] = [];
  let previous: Meta | undefined;
  // --redo-thumbs: vuelve a dibujar miniatura y descripción con la publicación ya elegida (sin IA)
  const saved = path.join(dir, "publicacion.json");
  let result: Meta | undefined = flag("redo-thumbs") !== undefined && existsSync(saved) ? (JSON.parse(readFileSync(saved, "utf8")) as Meta) : undefined;
  for (let attempt = 1; attempt <= 3 && !result; attempt++) {
    console.log(`→ miniatura y descripción (intento ${attempt})…`);
    const r = await p.generate({
      task: "carousel.generate",
      brandId: "spike-video",
      model,
      prompt:
        attempt === 1
          ? "Preparás la publicación con `guion.json`, `dossier.json` y las imágenes. Devolvé el objeto que pide el schema."
          : `Lo anterior (\`anterior.json\`) tiene errores; devolvé todo corregido:\n${errors.map((e) => `- ${e}`).join("\n")}`,
      files: {
        "CLAUDE.md": META_RULES,
        "guion.json": JSON.stringify(view),
        "dossier.json": JSON.stringify({ topic: dossier.dossier.topic, summary: dossier.dossier.summary }),
        ...(previous ? { "anterior.json": JSON.stringify(previous) } : {}),
      },
      ...(attempt === 1 ? { images } : {}),
      schema: metaSchema,
      maxTurns: 4,
      timeoutMs: 6 * 60_000,
    });
    logUsage(`publicación ${attempt}`, r.usage);
    if (!r.ok) {
      errors = [`${r.error.kind}: ${r.error.message}`];
      console.log(`  ${errors[0]}`);
      continue;
    }
    previous = r.data;
    errors = check(r.data);
    for (const e of errors) console.log(`  ✗ ${e}`);
    if (errors.length === 0) result = r.data;
  }
  if (!result) throw new Error("No salió una publicación válida en 3 intentos");
  writeFileSync(path.join(dir, "publicacion.json"), JSON.stringify(result, null, 1));

  // descripción lista para pegar
  const factIds = new Set(g.facts.flatMap((f) => f.source.match(/F\d+/g) ?? []));
  const seen = new Set<string>();
  const sources = dossier.dossier.facts
    .filter((f) => factIds.has(f.id) && f.url && !seen.has(f.url) && seen.add(f.url))
    .map((f) => `- ${f.sourceTitle ?? f.url} — ${f.url}`);
  const chapters = result.chapters.map((c) => `${clock(starts[c.scene - 1] ?? 0)} ${c.title}`);
  const description = [
    result.title,
    "",
    result.hook,
    "",
    "Capítulos",
    ...chapters,
    "",
    "Fuentes",
    ...sources,
    "",
    "Imágenes de archivo (Wikimedia Commons)",
    ...used.map((c) => `- ${c.title} — ${cleanAuthor(c.author) || "autor desconocido"} — ${c.license} — ${c.page}`),
    "",
    "Narración con voz generada por IA. Relato basado en las fuentes citadas.",
    "",
    result.hashtags.join(" "),
    "",
  ].join("\n");
  writeFileSync(path.join(dir, "descripcion.txt"), description);

  // miniaturas 16:9 y 9:16
  const pub = path.join(dir, ".public");
  mkdirSync(pub, { recursive: true });
  const thumbImg = used.find((c) => c.id === result?.thumbnail.image) as Candidate;
  const base = path.basename(thumbImg.file);
  cpSync(path.join(dir, thumbImg.file), path.join(pub, base));
  const serveUrl = await bundle({ entryPoint: path.join(ROOT, "src", "index.ts"), publicDir: pub });
  const browser = await openBrowser("chrome", { chromiumOptions: { flags: { "font-render-hinting": false } } });
  for (const format of ["16x9", "9x16"] as const) {
    const inputProps = {
      format,
      image: base,
      aspect: thumbImg.height / thumbImg.width,
      // en 16:9 una foto vertical se recorta a una franja: se abre el encuadre y el sujeto se corre a la derecha, lejos del texto
      view:
        format === "16x9" && thumbImg.height / thumbImg.width > 1.1
          ? { cx: Math.max(0, result.thumbnail.cx - 0.08), cy: result.thumbnail.cy - 0.03, vw: Math.min(1, result.thumbnail.vw * 1.7) }
          : { cx: result.thumbnail.cx, cy: result.thumbnail.cy, vw: result.thumbnail.vw },
      kicker: result.thumbnail.kicker,
      lines: result.thumbnail.lines,
      accent: result.thumbnail.accent,
    };
    const composition = await selectComposition({ serveUrl, id: "thumb", inputProps, puppeteerInstance: browser });
    const file = path.join(dir, `miniatura-${format}.png`);
    await renderStill({ composition, serveUrl, inputProps, frame: 0, output: file, puppeteerInstance: browser });
    console.log(`  miniatura ${format} → ${file}`);
  }
  await browser.close({ silent: true });
  console.log(`✓ descripción → ${path.join(dir, "descripcion.txt")}`);
}

// ───────────────────────── texts / render ─────────────────────────
const loadGuion = () => JSON.parse(readFileSync(path.join(dir, "guion.json"), "utf8")) as DocuGuion;

function texts() {
  const g = loadGuion();
  const file = path.join(ROOT, "tts", "texts", `${name}.json`);
  writeFileSync(file, JSON.stringify(g.scenes.map((s) => s.narration), null, 1));
  console.log(`✓ ${file}\n  python3 tts/whole.py texts/${name}.json --tag ${name}`);
}

/** Autor legible: sin paréntesis, sin «Unknown author» y sin repeticiones («X X»). */
const cleanAuthor = (a: string) => {
  const t = a.replace(/\(.*?\)/g, "").replace(/\s+/g, " ").trim();
  const half = t.slice(0, Math.floor(t.length / 2)).trim();
  const one = t.length > 6 && t === `${half} ${half}` ? half : t;
  return /unknown|anonym|desconocid|^\W*$/i.test(one) ? "" : one;
};
const cut = (t: string, n: number) => (t.length <= n ? t : `${t.slice(0, t.lastIndexOf(" ", n) > 20 ? t.lastIndexOf(" ", n) : n)}…`);
const shortCredit = (c: Candidate, caption?: string) => {
  const author = cleanAuthor(c.author).split(/[,;]/)[0]?.trim() ?? "";
  const who = author && !c.title.toLowerCase().includes(author.toLowerCase()) && !/unknown|desconocid|anonym|direc|^\W*$/i.test(author) ? ` · ${cut(author, 28)}` : "";
  const lic = /public domain|pd/i.test(c.license) ? "dominio público" : c.license;
  return `${caption ?? cut(c.title, 46)}${who} · ${lic}`;
};

async function render() {
  const g = loadGuion();
  const candidates = JSON.parse(readFileSync(path.join(dir, "candidates.json"), "utf8")) as Candidate[];
  const voiceDir = path.resolve(voicesArg ?? path.join(ROOT, "out", "v0-12", name));
  const pub = path.join(dir, ".public");
  mkdirSync(pub, { recursive: true });
  type Manifest = { scenes: { key: string; frames: number }[] };
  const manifest = JSON.parse(readFileSync(path.join(voiceDir, "manifest.json"), "utf8")) as Manifest;
  if (manifest.scenes.length !== g.scenes.length) throw new Error(`El guion tiene ${g.scenes.length} escenas y la voz ${manifest.scenes.length}`);
  const voices = manifest.scenes.map((s) => {
    cpSync(path.join(voiceDir, "audio", `${s.key}.wav`), path.join(pub, `${s.key}.wav`));
    return { audio: `${s.key}.wav`, words: JSON.parse(readFileSync(path.join(voiceDir, "audio", `${s.key}.words.json`), "utf8")), frames: s.frames };
  });
  const shots = g.scenes.map((s, i) => {
    const c = candidates.find((x) => x.id === s.image) as Candidate;
    const base = path.basename(c.file);
    cpSync(path.join(dir, c.file), path.join(pub, base));
    return {
      voice: i,
      image: base,
      aspect: c.height / c.width,
      from: s.from,
      to: s.to,
      credit: shortCredit(c, s.caption),
      highlight: s.highlight,
      graphics: s.graphics,
      tail: s.tail,
    };
  });
  const used = [...new Set(g.scenes.map((s) => s.image))].map((id) => candidates.find((c) => c.id === id) as Candidate);
  writeFileSync(
    path.join(dir, "creditos.txt"),
    `Imágenes (Wikimedia Commons):\n${used.map((c) => `- ${c.title} — ${cleanAuthor(c.author) || "autor desconocido"} — ${c.license} — ${c.page}`).join("\n")}\n`,
  );
  const serveUrl = await bundle({ entryPoint: path.join(ROOT, "src", "index.ts"), publicDir: pub });
  const browser = await openBrowser("chrome", { chromiumOptions: { flags: { "font-render-hinting": false } } });
  const inputProps = { voices, shots };
  const composition = await selectComposition({ serveUrl, id: "photos", inputProps, puppeteerInstance: browser });
  const file = path.join(ROOT, "out", "anim", `${name}.mp4`);
  mkdirSync(path.dirname(file), { recursive: true });
  const t0 = performance.now();
  await renderMedia({ composition, serveUrl, codec: "h264", crf: 23, outputLocation: file, inputProps, concurrency: 2, puppeteerInstance: browser });
  console.log(`video: ${(composition.durationInFrames / composition.fps).toFixed(1)} s en ${((performance.now() - t0) / 1000).toFixed(1)} s → ${file}`);
  await browser.close({ silent: true });
  if (!flagNoMeta) await meta(g, candidates, voiceDir);
}

if (mode === "search" && rest[0]) await search(rest[0]);
else if (mode === "pin" && rest[0]) await pinImages(rest.join(" ").split(",").map((t) => t.trim()).filter(Boolean));
else if (mode === "guion" && rest[0]) await guion(rest[0]);
else if (mode === "review" && rest[0]) {
  // pnpm docu review <dossier.json> --name <video> [--file guion-sin-revisar.json]: deja review.json y guion-revisado.json
  const { text, json } = compactDossier(rest[0]);
  const candidates = JSON.parse(readFileSync(path.join(dir, "candidates.json"), "utf8")) as Candidate[];
  const g = JSON.parse(readFileSync(path.join(dir, fileArg ?? "guion.json"), "utf8")) as DocuGuion;
  writeFileSync(path.join(dir, "guion-revisado.json"), JSON.stringify(await review(g, candidates, text, json), null, 1));
} else if (mode === "meta") {
  const candidates = JSON.parse(readFileSync(path.join(dir, "candidates.json"), "utf8")) as Candidate[];
  await meta(loadGuion(), candidates, path.resolve(voicesArg ?? path.join(ROOT, "out", "v0-12", name)));
} else if (mode === "texts") texts();
else if (mode === "render") await render();
else console.log("Uso: docu search|guion <dossier.json> --name <video> · docu texts --name <video> · docu render --name <video> --voices <carpeta>");
