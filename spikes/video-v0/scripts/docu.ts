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
import { openBrowser, renderMedia, selectComposition } from "@remotion/renderer";
import { z } from "zod";
import { type Candidate, checkDocu, docuSchema, type DocuGuion } from "../src/photo/schema";

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
const [mode, ...rest] = args;
const dir = path.join(ROOT, "out", "docu", name);
mkdirSync(path.join(dir, "img"), { recursive: true });

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const UA = { "User-Agent": "spike-video/0 (educational project)" };

function provider() {
  const bin = path.join(dir, `claude-effort-${effort}.sh`);
  writeFileSync(bin, `#!/bin/sh\nexec ${JSON.stringify(resolveClaudeBin())} --effort ${effort} "$@"\n`);
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
  console.log(`→ consultas de búsqueda (${model}, effort ${effort})…`);
  const r = await p.generate({
    task: "carousel.generate",
    brandId: "spike-video",
    model,
    prompt: "Leé `dossier.json` y devolvé las consultas de búsqueda de imágenes para Wikimedia Commons.",
    files: {
      "CLAUDE.md": `# Buscador de imágenes de archivo

Para un video documental sobre el tema de \`dossier.json\`, proponé de 24 a 30 consultas de búsqueda para Wikimedia Commons, **de 1 a 3 palabras cada una** (Commons exige que estén todas: con 4 o más casi nunca encuentra nada) que encuentren imágenes reales y libres: fotos de época, retratos de los protagonistas, el lugar, el objeto, portadas de diarios y documentos del momento, mapas. Ejemplos buenos: «Vincenzo Peruggia», «Mona Lisa 1911», «Salon Carré», «Joconde volée», «Uffizi 1913». Mezclá idiomas según dónde pasó (inglés, francés, italiano, español…), usá nombres propios y años, y variá: personas, lugares, objetos, documentos y diarios de la época, mapas. **Solo cosas que el dossier menciona**: nada de temas laterales (ciudades de paso, ejércitos, etc.) salvo que sean parte de la historia.`,
      "dossier.json": json,
    },
    schema: z.object({ queries: z.array(z.string().min(3).max(60)).min(10).max(34) }),
    maxTurns: 2,
    timeoutMs: 4 * 60_000,
  });
  logUsage("consultas", r.usage);
  if (!r.ok) throw new Error(`${r.error.kind}: ${r.error.message}`);
  type Hit = Candidate & { score: number; thumb: string };
  const hits = new Map<string, Hit>();
  for (const q of r.data.queries) {
    await sleep(1500);
    const res = await commons({
      action: "query",
      generator: "search",
      gsrsearch: q,
      gsrnamespace: "6",
      gsrlimit: "12",
      prop: "imageinfo",
      iiprop: "url|extmetadata|size|mime",
      iiurlwidth: "1280" // tamaño estándar de Commons: otros dan 429,
    });
    const pages = Object.values(res.query?.pages ?? {}) as {
      title: string;
      index?: number;
      imageinfo?: { mime: string; width: number; height: number; thumburl: string; descriptionurl: string; extmetadata: Record<string, { value: string }> }[];
    }[];
    let found = 0;
    for (const pg of pages) {
      const ii = pg.imageinfo?.[0];
      if (!ii || !/^image\/(jpeg|png|webp)$/.test(ii.mime) || ii.width < 700) continue;
      const lic = ii.extmetadata.LicenseShortName?.value ?? "";
      if (!LICENSE_OK.test(lic) || LICENSE_BAD.test(lic)) continue;
      const rank = 14 - (pg.index ?? 7);
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
    console.log(`  «${q}»: ${found} nuevas`);
  }
  // Curaduría por texto: la IA elige entre ~150 resultados (solo título y descripción, barato).
  const pool = [...hits.values()].sort((x, y) => y.score - x.score).slice(0, 150);
  console.log(`→ curaduría: ${pool.length} resultados → la IA elige los que sirven a la historia…`);
  const cur = await p.generate({
    task: "carousel.generate",
    brandId: "spike-video",
    model,
    prompt: "Elegí las imágenes para el video con `resultados.json` y `dossier.json`. Devolvé los `n` elegidos.",
    files: {
      "CLAUDE.md": `# Curador de imágenes

Del archivo \`resultados.json\` (imágenes libres de Wikimedia Commons: n, título, descripción, fecha) elegí **de 28 a 34** para un video documental sobre el tema de \`dossier.json\`. Criterios:
- Priorizá lo que **muestra la historia**: fotos y documentos de época del hecho, retratos de los protagonistas, el lugar tal como era, portadas de diarios y carteles del momento, objetos clave, mapas.
- Hace falta **variedad**: personas, lugares, documentos, prensa, objetos. Si hay muchas versiones de la misma imagen (restauraciones, recortes, colores), elegí **una sola**.
- Descartá lo que no tiene que ver con la historia (otros temas, otras obras, fotos actuales sin relación, lápidas, monumentos genéricos).
- Una imagen actual del lugar sirve solo si no hay una de época.`,
      "dossier.json": json,
      "resultados.json": JSON.stringify(pool.map((h, n) => ({ n, title: h.title, description: h.description.slice(0, 140), date: h.date }))),
    },
    schema: z.object({ keep: z.array(z.number().int().min(0)).min(20).max(40) }),
    maxTurns: 2,
    timeoutMs: 5 * 60_000,
  });
  logUsage("curaduría", cur.usage);
  if (!cur.ok) throw new Error(`${cur.error.kind}: ${cur.error.message}`);
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

// ───────────────────────── guion ─────────────────────────
async function guion(dossierFile: string) {
  const { text, json } = compactDossier(dossierFile);
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
    previous = r.data;
    errors = checkDocu(r.data, candidates, text);
    writeFileSync(path.join(dir, `guion-${attempt}.json`), JSON.stringify(r.data, null, 1));
    if (errors.length === 0) {
      writeFileSync(path.join(dir, "guion.json"), JSON.stringify(r.data, null, 1));
      const chars = r.data.scenes.reduce((n, s) => n + s.narration.length, 0);
      console.log(`✓ guion válido: ${r.data.scenes.length} escenas, ${chars} caracteres → ${path.join(dir, "guion.json")}`);
      return;
    }
    for (const e of errors) console.log(`  ✗ ${e}`);
  }
  console.log("✗ no salió un guion válido en 3 intentos (los intentos quedaron en la carpeta).");
  process.exitCode = 1;
}

// ───────────────────────── texts / render ─────────────────────────
const loadGuion = () => JSON.parse(readFileSync(path.join(dir, "guion.json"), "utf8")) as DocuGuion;

function texts() {
  const g = loadGuion();
  const file = path.join(ROOT, "tts", "texts", `${name}.json`);
  writeFileSync(file, JSON.stringify(g.scenes.map((s) => s.narration), null, 1));
  console.log(`✓ ${file}\n  python3 tts/whole.py texts/${name}.json --tag ${name}`);
}

const cut = (t: string, n: number) => (t.length <= n ? t : `${t.slice(0, t.lastIndexOf(" ", n) > 20 ? t.lastIndexOf(" ", n) : n)}…`);
const shortCredit = (c: Candidate, caption?: string) => {
  const author = c.author.replace(/\(.*?\)/g, "").split(/[,;]/)[0]?.trim() ?? "";
  const who = author && !/unknown|desconocid|anonym|direc|^\W*$/i.test(author) ? ` · ${cut(author, 28)}` : "";
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
    `Imágenes (Wikimedia Commons):\n${used.map((c) => `- ${c.title} — ${c.author || "autor desconocido"} — ${c.license} — ${c.page}`).join("\n")}\n`,
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
}

if (mode === "search" && rest[0]) await search(rest[0]);
else if (mode === "guion" && rest[0]) await guion(rest[0]);
else if (mode === "texts") texts();
else if (mode === "render") await render();
else console.log("Uso: docu search|guion <dossier.json> --name <video> · docu texts --name <video> · docu render --name <video> --voices <carpeta>");
