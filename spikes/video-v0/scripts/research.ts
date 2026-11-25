// V0-11: investigar antes de escribir. Decisión del operador (2026-11-24): "siempre antes de hacer
// una historia la IA tiene que hacer una investigación profunda del tema, no tiene que inventar
// nada". Tres pasos, cada uno medido en out/v0-11/runs.jsonl:
//   pnpm research dossier <1-5>        claude -p con WebSearch/WebFetch arma un dossier de hechos,
//                                      cada uno con un fragmento textual de su fuente
//   pnpm research verify <dossier>     baja cada fuente y comprueba que el fragmento esté ahí
//   pnpm research guion <dossier>      el guion, escrito solo con el dossier
//   pnpm research summary
// --effort <low|medium|high>: como en `pnpm guion` (envoltorio del binario; el proveedor no lo pasa).
// --long (V0-13): video de 1,5–2 min en vez de un Short: dossier con más material y guion de
// 15–22 escenas. Deja todo en out/v0-13.
import {
  appendFileSync,
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import {
  createClaudeCodeProvider,
  type GenerationTask,
  resolveClaudeBin,
  type Usage,
} from "@radev/ai";
import { z } from "zod";
import { guion as ejemplo } from "../src/anim/guion";
import { applyPatch, patchSchema } from "../src/anim/patch";
import { normalizeGuion } from "../src/anim/quality";
import { checkGuion, type GuionDraft, guionLargoSchema, guionSchema } from "../src/anim/schema";
import { TOPICS } from "./topics";

const root = path.resolve(import.meta.dirname, "..");
const envFile = path.resolve(root, "..", "..", ".env");
if (existsSync(envFile)) process.loadEnvFile(envFile);
const args = process.argv.slice(2);
const long = args.includes("--long");
if (long) args.splice(args.indexOf("--long"), 1);
const out = path.join(root, "out", long ? "v0-13" : "v0-11");
mkdirSync(out, { recursive: true });
const flag = (name: string) => {
  const i = args.indexOf(`--${name}`);
  if (i < 0) return undefined;
  const value = args[i + 1];
  args.splice(i, value && !value.startsWith("--") ? 2 : 1);
  return value ?? "";
};
const model = flag("model") ?? "sonnet";
const effort = flag("effort");
// --from <guion.json>: retoma las correcciones desde un guion ya escrito (sin escribirlo de cero).
const from = flag("from");
const [mode, ...rest] = args;

function effortBin(level: string): string {
  const file = path.join(out, `claude-effort-${level}.sh`);
  writeFileSync(
    file,
    `#!/bin/sh\nexec ${JSON.stringify(resolveClaudeBin())} --effort ${level} "$@"\n`,
  );
  chmodSync(file, 0o755);
  return file;
}
const provider = createClaudeCodeProvider(effort ? { bin: effortBin(effort) } : {});

const text = (max: number) => z.string().trim().min(1).max(max);
const factId = z.string().regex(/^F\d{1,2}$/);
const quoteId = z.string().regex(/^C\d{1,2}$/);

const dossierSchema = z
  .object({
    topic: text(200),
    summary: text(800).describe("La historia en 4–6 frases, solo con lo que está en `facts`."),
    facts: z
      .array(
        z
          .object({
            id: factId.describe("F1, F2…"),
            claim: text(300).describe("El hecho, en español, en una frase."),
            excerpt: text(400).describe(
              "Fragmento COPIADO TEXTUAL de la página (en su idioma), que prueba el hecho. Sin resumir ni traducir.",
            ),
            url: z.url(),
            sourceTitle: text(160),
          })
          .strict(),
      )
      .min(8)
      .max(30),
    quotes: z
      .array(
        z
          .object({
            id: quoteId.describe("C1, C2…"),
            text: text(300).describe("La cita exacta, como la reproduce la fuente."),
            who: text(120),
            url: z.url(),
          })
          .strict(),
      )
      .max(10),
    disputed: z
      .array(z.object({ point: text(200), versions: text(500) }).strict())
      .max(10)
      .describe("Datos en los que las fuentes no coinciden (cifras, fechas, detalles)."),
    unconfirmed: z
      .array(text(200))
      .max(15)
      .describe("Cosas que se dicen del tema pero no pudiste confirmar en una fuente confiable."),
  })
  .strict();
type Dossier = z.infer<typeof dossierSchema>;

const checkDossier = (d: Dossier): string[] => {
  const errors: string[] = [];
  const ids = [...d.facts.map((f) => f.id), ...d.quotes.map((q) => q.id)];
  for (const id of new Set(ids)) {
    if (ids.filter((x) => x === id).length > 1) errors.push(`id repetido: ${id}`);
  }
  const domains = new Set(d.facts.map((f) => new URL(f.url).hostname.replace(/^www\./, "")));
  if (domains.size < 3) errors.push(`solo ${domains.size} sitios distintos (mínimo 3)`);
  // V0-13: un intento devolvió un objeto de prueba ("test", example.com) como respuesta final.
  const fake = d.facts.filter(
    (f) =>
      /(^|\.)example\.(com|org|net)$/.test(new URL(f.url).hostname) ||
      /^(test|prueba|lorem)\d*$/i.test(f.claim.trim()) ||
      f.claim.trim() === f.excerpt.trim(),
  );
  if (fake.length > 0) {
    errors.push(`datos de prueba o de relleno en ${fake.map((f) => f.id).join(", ")}`);
  }
  return errors;
};

type Run = {
  name: string;
  step: string;
  model: string;
  effort: string;
  zodOk: boolean;
  checkErrors: string[] | null;
  valid: boolean;
  usage: Usage | null;
  wallMs: number;
  error?: string;
  extra?: Record<string, unknown>;
};

async function ask<T>(
  name: string,
  step: string,
  task: Pick<GenerationTask<T>, "prompt" | "files" | "schema" | "tools" | "maxTurns" | "timeoutMs">,
  check: (data: T) => string[],
): Promise<{ run: Run; data: T | null }> {
  const t0 = performance.now();
  console.log(`→ ${name} (${step}, ${model}, effort ${effort ?? "default"})…`);
  const result = await provider.generate({
    task: "carousel.generate", // la spike no suma tareas a core; en V1 serían video.research y video.script
    brandId: "spike-video",
    model,
    ...task,
  });
  const base = {
    name,
    step,
    model,
    effort: effort ?? "default",
    usage: result.usage,
    wallMs: Math.round(performance.now() - t0),
  };
  if (!result.ok) {
    const issues = result.error.kind === "validation" ? result.error.issues : undefined;
    return {
      run: {
        ...base,
        zodOk: false,
        checkErrors: null,
        valid: false,
        error: `${result.error.kind}: ${result.error.message}${issues ? ` · ${issues.slice(0, 8).join(" | ")}` : ""}`,
      },
      data: null,
    };
  }
  const errors = check(result.data);
  return {
    run: { ...base, zodOk: true, checkErrors: errors, valid: errors.length === 0 },
    data: result.data,
  };
}

function save(run: Run, file: string, body: Record<string, unknown>) {
  writeFileSync(file, JSON.stringify({ run, ...body }, null, 1));
  appendFileSync(path.join(out, "runs.jsonl"), `${JSON.stringify(run)}\n`);
  const u = run.usage;
  console.log(
    `  ${run.valid ? "VÁLIDO" : run.zodOk ? "Zod ok, chequeo NO" : "NO PASA ZOD"} · ` +
      (u
        ? `${u.inputTokens} entrada / ${u.outputTokens} salida · ${u.numTurns ?? "?"} turnos · ` +
          `${(u.durationMs / 1000).toFixed(1)} s · lista USD ${u.costUsd?.toFixed(3) ?? "?"}`
        : `sin uso (${(run.wallMs / 1000).toFixed(1)} s)`) +
      ` → ${path.relative(root, file)}`,
  );
  for (const e of run.checkErrors ?? []) console.log(`    ${e}`);
  if (run.error) console.log(`    ${run.error}`);
}

const RESEARCH_SYSTEM = `# Investigador de historias

Investigás a fondo un tema para un video corto de historias reales (canal en español rioplatense). Tu trabajo NO es escribir el guion: es juntar **hechos comprobados con su fuente**, para que el guionista no tenga que inventar nada.

## Cómo investigar

- Buscá con WebSearch y **abrí las páginas con WebFetch**: un hecho solo vale si lo leíste en una página, no si lo recordás o lo viste en el resumen de un buscador.
- Usá **al menos 3 sitios distintos**. Preferí, en este orden: medios serios y archivos de diarios, organismos oficiales, Wikipedia (sirve, pero contrastala), libros o investigaciones citadas. Evitá blogs anónimos y sitios de "curiosidades".
- Para un hecho argentino, buscá también en español (Clarín, La Nación, Página/12, Infobae, Télam…).
- Buscá lo que hace buena una historia: fechas exactas, lugares, nombres, cifras, frases textuales, el giro sorprendente, qué pasó después.

## Reglas

- **excerpt** = fragmento copiado TEXTUAL de la página que abriste (en su idioma), que prueba el hecho. Sin resumir, sin traducir, sin "…" en el medio. Si no tenés el texto exacto, el hecho no entra.
- **Citas** (frases de personas, notas, carteles): solo si la fuente las reproduce textualmente; copiá el texto como está.
- Si las fuentes no coinciden (por ejemplo, el monto de un robo), no elijas una: ponelo en \`disputed\` con las versiones.
- Lo que se dice pero no pudiste confirmar va en \`unconfirmed\`. Es mejor un dossier corto y seguro que uno largo con dudas.
- Devolvé solo el objeto del schema. **El primer objeto que entregás es el definitivo**: nunca mandes uno de prueba ni con datos de ejemplo ("test", example.com) para ver si el formato pasa.`;

async function dossier(i: number) {
  const topic = TOPICS[i];
  if (!topic) throw new Error(`No hay tema ${i + 1}`);
  const name = `dossier-${i + 1}${effort ? `-${effort}` : ""}${long ? "-long" : ""}`;
  // Si sale inválido (por ejemplo, datos de prueba), se pide de nuevo una vez desde cero.
  for (let attempt = 1; attempt <= 2; attempt++) {
    const { run, data } = await ask(
      attempt === 1 ? name : `${name}-retry`,
      "dossier",
      {
        prompt: "Investigá el tema de `task.json` y devolvé el dossier.",
        files: {
          "CLAUDE.md": RESEARCH_SYSTEM,
          "task.json": JSON.stringify(
            long
              ? {
                  tema: topic,
                  para:
                    "Video de 1,5–2 min (15–22 escenas): hace falta material para contar la historia " +
                    "entera, no solo el hecho: antecedentes y protagonistas, la preparación, el hecho " +
                    "paso a paso, cómo se descubrió o investigó, qué pasó después y el dato final que " +
                    "sorprende. Apuntá a 20–30 hechos y todas las citas textuales que encuentres.",
                }
              : { tema: topic, para: "Short de 35–45 s" },
            null,
            1,
          ),
        },
        schema: dossierSchema,
        tools: ["WebSearch", "WebFetch"],
        maxTurns: 40,
        timeoutMs: 15 * 60_000,
      },
      checkDossier,
    );
    if (data) run.extra = { facts: data.facts.length, quotes: data.quotes.length };
    save(run, path.join(out, `${name}.json`), { topic, dossier: data });
    if (run.valid) return;
  }
}

// --- verify: ¿el fragmento está en la página? ---

const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();

const ENTITIES: Record<string, string> = {
  amp: "&",
  quot: '"',
  apos: "'",
  nbsp: " ",
  lt: "<",
  gt: ">",
};
function pageText(html: string): string {
  return html
    .replace(/<(script|style|noscript)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(Number.parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, n) => ENTITIES[n.toLowerCase()] ?? m);
}

/** Proporción de grupos de 5 palabras del fragmento que aparecen en la página. */
function overlap(excerpt: string, page: string): number {
  const words = norm(excerpt).split(" ");
  if (words.length < 5) return page.includes(words.join(" ")) ? 1 : 0;
  let hits = 0;
  const total = words.length - 4;
  for (let i = 0; i < total; i++) if (page.includes(words.slice(i, i + 5).join(" "))) hits++;
  return hits / total;
}

async function verify(file: string) {
  const saved = JSON.parse(readFileSync(path.resolve(file), "utf8")) as { dossier: Dossier };
  const pages = new Map<string, string | Error>();
  for (const url of new Set(saved.dossier.facts.map((f) => f.url))) {
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; source-check)" },
        signal: AbortSignal.timeout(20_000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      pages.set(url, pageText(await res.text()));
    } catch (error) {
      pages.set(url, error instanceof Error ? error : new Error(String(error)));
    }
  }
  const results = saved.dossier.facts.map((f) => {
    const page = pages.get(f.url);
    if (!page || page instanceof Error)
      return { id: f.id, result: "sin página", detail: `${page}` };
    const score = overlap(f.excerpt, norm(page));
    // Más flexible: los números del hecho (fechas, cifras, cantidades) están en la página.
    const inPage = new Set(numbers(page));
    const missing = numbers(f.claim).filter((n) => !inPage.has(n));
    return {
      id: f.id,
      result: score === 1 ? "textual" : score >= 0.6 ? "casi" : "NO está",
      detail: score.toFixed(2),
      numbers:
        numbers(f.claim).length === 0
          ? "sin números"
          : missing.length === 0
            ? "ok"
            : `faltan ${missing.join(", ")}`,
    };
  });
  const count = (r: string) => results.filter((x) => x.result === r).length;
  console.log(`${path.basename(file)}: ${results.length} hechos, ${pages.size} páginas`);
  for (const r of results) {
    const f = saved.dossier.facts.find((x) => x.id === r.id);
    const nums = ("numbers" in r ? r.numbers : undefined) ?? "-";
    console.log(
      `  ${r.id.padEnd(3)} ${r.result.padEnd(10)} ${r.detail.padEnd(6)} números: ${nums.padEnd(14)} ${f?.url}`,
    );
  }
  console.log(
    `fragmento: textual ${count("textual")} · casi ${count("casi")} · NO está ${count("NO está")} · sin página ${count("sin página")}` +
      ` · números: ok ${results.filter((x) => "numbers" in x && x.numbers === "ok").length} de ${results.filter((x) => "numbers" in x && x.numbers !== "sin números").length}`,
  );
  writeFileSync(
    path.join(out, `${path.basename(file, ".json")}.verify.json`),
    JSON.stringify(results, null, 1),
  );
}

// --- guion: solo con el dossier ---

/** Reemplaza la línea de duración del catálogo cuando el video es largo (V0-13). */
const LONG_RULES = `- **Esta vez NO es un Short: es un video de 1,5 a 2 minutos.** **15 a 22 escenas**, unos 1.500–1.800 caracteres de narración en total (la voz dice ~15 caracteres por segundo). Cada escena, 60–110 caracteres: una idea por escena, para que siempre esté pasando algo en pantalla.
- **Estructura**, como un buen video de historias: (1) **gancho** en las primeras 2 escenas: el dato más fuerte o una pregunta, antes de explicar nada; (2) **contexto**: quiénes eran y por qué importa; (3) **el hecho paso a paso**, con tensión; (4) **el giro**: cómo se descubrió, qué salió mal o lo que nadie esperaba; (5) **qué pasó después**; (6) **cierre** con una pregunta a la audiencia. Cada 4–5 escenas, una frase que tire hacia adelante ("pero eso no fue lo más raro").
- Variá escenarios, cámara y cajas a lo largo del video: que no se repita el mismo plano dos escenas seguidas.`;

const catalog = readFileSync(path.join(root, "src", "anim", "catalog.md"), "utf8");
const example = JSON.stringify(
  { title: "El robo del siglo", scenes: ejemplo.map(({ voice: _, ...s }) => s), facts: [] },
  null,
  1,
);

const numbers = (s: string) =>
  (s.match(/\d+(?:[.,]\d+)*/g) ?? []).map((n) => n.replace(/[.,]/g, ""));

type NumberPair = { raw: string; n: number; unit: string; qualifier: string };

/**
 * Número + la palabra que le sigue (salteando "de"), con el "más de" / "casi" de adelante:
 * "más de 140 cajas", "19 millones", "21 años". El mismo número puede ser firme en un sentido y
 * estar en disputa en otro ("a las 19" y "19 millones"), por eso va con la palabra.
 */
function numberPairs(s: string): NumberPair[] {
  const re =
    /(?:(más de|al menos|casi|cerca de|unos|unas|alrededor de)\s+)?(\d+(?:[.,]\d+)*)\s+(?:de\s+)?(\p{L}+)/giu;
  return [...s.matchAll(re)].map((m) => {
    const raw = (m[2] ?? "").replace(/[.,]/g, "");
    const n = Number((m[2] ?? "").replace(/\./g, "").replace(",", "."));
    return { raw, n, unit: norm(m[3] ?? ""), qualifier: (m[1] ?? "").toLowerCase() };
  });
}

/** Además de checkGuion: cada dato apunta al dossier y ningún número sale de la nada (regla 9). */
function checkAgainstDossier(g: GuionDraft, d: Dossier): string[] {
  const errors = checkGuion(g);
  // Datos en disputa: por cada unidad ("millones", "cajas"), los valores de las versiones.
  const disputed = new Map<string, { point: string; values: number[] }>();
  for (const x of d.disputed) {
    const byUnit = new Map<string, number[]>();
    for (const p of numberPairs(x.versions))
      byUnit.set(p.unit, [...(byUnit.get(p.unit) ?? []), p.n]);
    for (const [unit, values] of byUnit) {
      if (new Set(values).size > 1) disputed.set(unit, { point: x.point, values });
    }
  }
  const ids = new Set([...d.facts.map((f) => f.id), ...d.quotes.map((q) => q.id)]);
  for (const f of g.facts) {
    const refs = f.source.match(/[FC]\d{1,2}/g) ?? [];
    if (refs.length === 0 || refs.some((r) => !ids.has(r))) {
      errors.push(`facts › "${f.source}" no es un id del dossier`);
    }
  }
  const known = new Set(
    numbers(
      [
        d.topic,
        d.summary,
        ...d.facts.flatMap((f) => [f.claim, f.excerpt]),
        ...d.quotes.map((q) => q.text),
        ...d.disputed.map((x) => x.versions),
      ].join(" "),
    ),
  );
  g.scenes.forEach((s, i) => {
    const texts = [
      s.narration,
      s.headline?.text ?? "",
      ...(s.overlays ?? []).map((o) =>
        "text" in o ? `${o.text} ${"sub" in o ? (o.sub ?? "") : ""}` : "",
      ),
    ].join(" ");
    // Un dato en disputa solo va redondeado a lo que comparten todas las versiones: "más de 140
    // cajas" (143 o 146) sí; "143 cajas" o "más de 150 cajas", no. El redondeo puede no estar
    // escrito en el dossier: se acepta igual.
    const rounded = new Set<string>();
    for (const p of numberPairs(texts)) {
      const dis = disputed.get(p.unit);
      if (!dis) continue;
      const min = Math.min(...dis.values);
      const max = Math.max(...dis.values);
      const ok =
        p.qualifier === "más de" || p.qualifier === "al menos"
          ? p.n <= min
          : p.qualifier
            ? p.n >= min * 0.85 && p.n <= max * 1.15
            : false;
      if (ok) {
        rounded.add(p.raw);
      } else if (!p.qualifier && !dis.values.includes(p.n)) {
        // Un número que no es ninguna versión: lo controla el chequeo de abajo.
      } else {
        errors.push(
          `scenes.${i} › "${p.qualifier ? `${p.qualifier} ` : ""}${p.n} ${p.unit}" no va: está en disputa (${dis.point}: ${dis.values.join(" o ")}). Decí "más de ${min >= 100 ? Math.floor(min / 10) * 10 : Math.floor(min)} ${p.unit}" o no lo digas`,
        );
      }
    }
    for (const n of numbers(texts)) {
      if (!known.has(n) && !rounded.has(n)) {
        errors.push(`scenes.${i} › el número ${n} no está en el dossier`);
      }
    }
  });
  return [...new Set(errors)];
}

async function guionFromDossier(file: string) {
  const saved = JSON.parse(readFileSync(path.resolve(file), "utf8")) as {
    topic: string;
    dossier: Dossier;
  };
  const name = `${path.basename(file, ".json").replace(/^dossier/, "guion")}${effort ? `-g${effort}` : ""}`;
  // El catálogo pide un Short de 6–8 escenas; para el largo se cambia esa línea y se suma la estructura.
  const system = long ? catalog.replace(/^- \*\*6 a 8 escenas\*\*.*$/m, LONG_RULES) : catalog;
  if (long && system === catalog) throw new Error("No encontré la línea de duración en catalog.md");
  const prompt =
    "Escribí el guion del Short sobre el tema de `task.json` **usando SOLO los hechos de " +
    "`dossier.json`**. No agregues ningún dato, nombre, fecha, cifra ni cita que no esté ahí, " +
    "aunque lo sepas: si no está en el dossier, no existe. Las citas van textuales, como en el " +
    "dossier. Nada de `disputed` ni de `unconfirmed` (si hace falta, redondeá a lo que todas " +
    "las versiones comparten). En `facts`, `source` es el id del hecho o la cita del dossier " +
    "(F3, C1; varios separados por coma). Devolvé el objeto que pide el schema.";
  const files = {
    "CLAUDE.md": system,
    "ejemplo.json": example,
    "dossier.json": JSON.stringify(saved.dossier),
    "task.json": JSON.stringify(
      { tema: saved.topic, voz: "Alberto", duracion: long ? "90–120 s" : "35–45 s" },
      null,
      1,
    ),
  };
  // Antes de controlar: lo que el código arregla solo (palabras, encuadres, objetos cortados).
  // Se aplica sobre el mismo objeto, así lo que se guarda ya va arreglado.
  let fixes: string[] = [];
  const check = (g: GuionDraft) => {
    const normalized = normalizeGuion(g);
    Object.assign(g, normalized.guion);
    fixes = normalized.fixes;
    const errors = checkAgainstDossier(g, saved.dossier);
    if (long && g.scenes.length < 15)
      errors.push(`scenes › ${g.scenes.length} escenas (mínimo 15)`);
    const chars = g.scenes.reduce((sum, sc) => sum + sc.narration.length, 0);
    if (long && chars < 1300) errors.push(`narración de ${chars} caracteres (mínimo 1.300, ~90 s)`);
    return errors;
  };
  const settings = {
    schema: long ? guionLargoSchema : guionSchema,
    maxTurns: 3,
    timeoutMs: (long ? 12 : 5) * 60_000,
  };
  let run: Run;
  let data: GuionDraft | null;
  if (from) {
    data = (JSON.parse(readFileSync(path.resolve(from), "utf8")) as { guion: GuionDraft }).guion;
    const errors = check(data);
    run = {
      name: `${name}-from`,
      step: "guion",
      model,
      effort: effort ?? "default",
      zodOk: true,
      checkErrors: errors,
      valid: errors.length === 0,
      usage: null,
      wallMs: 0,
    };
    console.log(`→ desde ${from}: ${errors.length} errores`);
    for (const e of errors) console.log(`    ${e}`);
  } else {
    ({ run, data } = await ask(name, "guion", { prompt, files, ...settings }, check));
  }
  const finish = (r: Run, d: GuionDraft | null, n: string) => {
    if (d) {
      r.extra = {
        scenes: d.scenes.length,
        narrationChars: d.scenes.reduce((sum, sc) => sum + sc.narration.length, 0),
        settings: [...new Set(d.scenes.map((sc) => sc.setting))].length,
        cast: d.cast?.length ?? 0,
        missingPlaces: d.missingPlaces?.map((m) => m.place) ?? [],
        fixes,
      };
      for (const f of fixes) console.log(`    arreglado: ${f}`);
    }
    save(r, path.join(out, `${n}.json`), { source: file, topic: saved.topic, guion: d });
  };
  if (!from) finish(run, data, name);
  // Una corrección por parches: la IA devuelve solo las escenas que cambian (~2–4k tokens de
  // salida en vez de ~19k) y el código las pega en el guion anterior. El resultado pasa por los
  // mismos controles que un guion entero.
  const repair = async (issues: string[], label: string, header: string) => {
    if (!data) return;
    const base = data;
    const merged: { guion: GuionDraft | null } = { guion: null };
    const patchCheck = (patch: z.infer<typeof patchSchema>) => {
      const applied = applyPatch(base, patch);
      if (!applied.ok) return applied.errors;
      merged.guion = applied.guion;
      return check(applied.guion);
    };
    const res = await ask(
      `${name}-${label}`,
      "guion",
      {
        prompt:
          `${prompt}\n\nEl intento anterior (\`anterior.json\`) ${header} Corregilo ` +
          "devolviendo SOLO las escenas que cambian, completas (campo `n` = su posición en `scenes` " +
          "de anterior.json, desde 1). Si cambiás un dato de la narración, devolvé también `facts` " +
          "completo. Antes de devolverlo, revisá TODAS las reglas de variedad juntas (ningún lugar " +
          "en más de 3 escenas, nunca el mismo lugar con el mismo encuadre en dos escenas seguidas): " +
          "al mover una escena no rompas otra.\n" +
          issues.map((e) => `- ${e}`).join("\n"),
        files: { ...files, "anterior.json": JSON.stringify(base) },
        ...settings,
        schema: patchSchema,
      },
      patchCheck,
    );
    run = res.run;
    data = res.data ? (merged.guion ?? base) : null;
    finish(run, data, `${name}-${label}`);
  };
  // Hasta dos correcciones (como en V0-8) con los errores del código.
  for (let attempt = 1; data && !run.valid && attempt <= 2; attempt++) {
    await repair(run.checkErrors ?? [], `repair${attempt}`, "tuvo estos errores.");
  }
  // Dirección: una IA lo revisa contra el dossier. Si deja notas, una corrección con las notas (y
  // otra más si esa corrección rompe algún control del código).
  if (data && run.valid) {
    const r = await review(data, saved.dossier, `${name}-direccion`);
    save(r.run, path.join(out, `${name}-direccion.json`), { review: r.data });
    const notes = r.data?.notes ?? [];
    if (notes.length > 0) {
      await repair(
        notes.map(
          (n) => `escena ${n.scene} [${n.kind}]: "${n.quote}" — ${n.why} Corrección: ${n.fix}`,
        ),
        "direccion-fix",
        "pasó por Dirección, que dejó estas notas.",
      );
      if (data && !run.valid) {
        await repair(run.checkErrors ?? [], "direccion-fix2", "tuvo estos errores.");
      }
    }
  }
}

// --- Dirección: una IA revisa el guion contra el dossier (oficina de Dirección de V1) ---

const noteSchema = z
  .object({
    scene: z.number().int().min(1).describe("Número de escena, desde 1."),
    kind: z.enum(["adorno", "no-esta", "disputa", "mezcla", "idioma", "lugar"]),
    quote: text(220).describe("El fragmento TEXTUAL del guion que está mal."),
    why: text(300),
    fix: text(300).describe("Cómo corregirlo, citando el id del dossier (F3, C1) si corresponde."),
  })
  .strict();
const reviewSchema = z
  .object({
    notes: z.array(noteSchema).max(15),
    verdict: z.enum(["aprobado", "corregir"]),
  })
  .strict();
type Review = z.infer<typeof reviewSchema>;

const REVIEW_SYSTEM = `# Dirección

Sos el director de un canal de videos de historias reales en español rioplatense. Antes de que el guion vaya a la voz y a la animación, lo revisás **contra el dossier de investigación** (\`dossier.json\`), que es la única fuente válida.

Marcá SOLO problemas reales, de estos tipos:

- **adorno**: la narración dice más de lo que dice el dossier ("nunca se supo", "sin dejar rastro", "el mayor de la historia") o exagera.
- **no-esta**: un hecho, nombre, fecha o cifra que no está en el dossier.
- **disputa**: un dato que el dossier tiene en \`disputed\`, dicho como firme.
- **mezcla**: hechos mezclados, en orden equivocado o atribuidos a quien no corresponde.
- **idioma**: palabras o giros que no son rioplatenses (furgoneta, coche, vosotros) o que suenan a traducción.
- **lugar**: el escenario de la escena contradice lo que se cuenta (un aeropuerto cuando la escena pasa en unas sierras; una tienda para un banco).

No marques estilo, ritmo ni gustos si no está mal. Si no hay problemas, \`notes\` vacío y \`verdict: "aprobado"\`. Cada nota cita el fragmento textual y propone cómo corregirlo con lo que está en el dossier.`;

/** Lo que Dirección necesita ver: textos y lugar de cada escena (sin la animación, más barato). */
function forReview(g: GuionDraft) {
  return g.scenes.map((sc, i) => ({
    escena: i + 1,
    lugar: sc.setting,
    narracion: sc.narration,
    titular: sc.headline?.text,
    cajas: sc.overlays.map((o) =>
      "text" in o ? o.text : o.items.map((it) => it.text).join(" / "),
    ),
  }));
}

async function review(
  g: GuionDraft,
  d: Dossier,
  name: string,
): Promise<{ run: Run; data: Review | null }> {
  const result = await ask(
    name,
    "direccion",
    {
      prompt: "Revisá el guion de `guion.json` contra `dossier.json` y devolvé tus notas.",
      files: {
        "CLAUDE.md": REVIEW_SYSTEM,
        "dossier.json": JSON.stringify(d, null, 1),
        "guion.json": JSON.stringify(forReview(g), null, 1),
      },
      schema: reviewSchema,
      maxTurns: 2,
      timeoutMs: 6 * 60_000,
    },
    () => [],
  );
  if (result.data) {
    result.run.extra = {
      notes: result.data.notes.length,
      kinds: result.data.notes.map((n) => n.kind),
      verdict: result.data.verdict,
    };
    for (const n of result.data.notes) {
      console.log(`    [${n.kind}] escena ${n.scene}: "${n.quote}" → ${n.fix}`);
    }
  }
  return result;
}

/** Prueba suelta: `pnpm research review <guion.json> <dossier.json>`. */
async function reviewFile(guionFile: string, dossierFile: string) {
  const g = (JSON.parse(readFileSync(path.resolve(guionFile), "utf8")) as { guion: GuionDraft })
    .guion;
  const d = (JSON.parse(readFileSync(path.resolve(dossierFile), "utf8")) as { dossier: Dossier })
    .dossier;
  const name = `review-${path.basename(guionFile, ".json")}`;
  const { run, data } = await review(g, d, name);
  save(run, path.join(out, `${name}.json`), { source: guionFile, review: data });
}

function summary() {
  const file = path.join(out, "runs.jsonl");
  if (!existsSync(file)) return console.log("Sin pedidos todavía.");
  console.log("pedido | paso | effort | válido | errores | entrada | salida | turnos | s | extra");
  for (const line of readFileSync(file, "utf8").trim().split("\n")) {
    const r = JSON.parse(line) as Run;
    const u = r.usage;
    console.log(
      [
        r.name,
        r.step,
        r.effort,
        r.valid ? "sí" : "no",
        r.checkErrors?.length ?? "-",
        u?.inputTokens ?? "-",
        u?.outputTokens ?? "-",
        u?.numTurns ?? "-",
        u ? (u.durationMs / 1000).toFixed(1) : "-",
        r.extra ? JSON.stringify(r.extra) : "",
      ].join(" | "),
    );
  }
}

if (mode === "dossier") await dossier(Number(rest[0] ?? "2") - 1);
else if (mode === "verify" && rest[0]) await verify(rest[0]);
else if (mode === "guion" && rest[0]) await guionFromDossier(rest[0]);
else if (mode === "review" && rest[0] && rest[1]) await reviewFile(rest[0], rest[1]);
else if (mode === "summary") summary();
else console.log("Uso: pnpm research dossier <1-5> | verify <dossier> | guion <dossier> | summary");
