// V0-11: investigar antes de escribir. Decisión del operador (2026-11-24): "siempre antes de hacer
// una historia la IA tiene que hacer una investigación profunda del tema, no tiene que inventar
// nada". Tres pasos, cada uno medido en out/v0-11/runs.jsonl:
//   pnpm research dossier <1-5>        claude -p con WebSearch/WebFetch arma un dossier de hechos,
//                                      cada uno con un fragmento textual de su fuente
//   pnpm research verify <dossier>     baja cada fuente y comprueba que el fragmento esté ahí
//   pnpm research guion <dossier>      el guion, escrito solo con el dossier
//   pnpm research summary
// --effort <low|medium|high>: como en `pnpm guion` (envoltorio del binario; el proveedor no lo pasa).
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
import { checkGuion, type GuionDraft, guionSchema } from "../src/anim/schema";
import { TOPICS } from "./topics";

const root = path.resolve(import.meta.dirname, "..");
const envFile = path.resolve(root, "..", "..", ".env");
if (existsSync(envFile)) process.loadEnvFile(envFile);
const out = path.join(root, "out", "v0-11");
mkdirSync(out, { recursive: true });

const args = process.argv.slice(2);
const flag = (name: string) => {
  const i = args.indexOf(`--${name}`);
  if (i < 0) return undefined;
  const value = args[i + 1];
  args.splice(i, value && !value.startsWith("--") ? 2 : 1);
  return value ?? "";
};
const model = flag("model") ?? "sonnet";
const effort = flag("effort");
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
- Devolvé solo el objeto del schema.`;

async function dossier(i: number) {
  const topic = TOPICS[i];
  if (!topic) throw new Error(`No hay tema ${i + 1}`);
  const name = `dossier-${i + 1}${effort ? `-${effort}` : ""}`;
  const { run, data } = await ask(
    name,
    "dossier",
    {
      prompt: "Investigá el tema de `task.json` y devolvé el dossier.",
      files: {
        "CLAUDE.md": RESEARCH_SYSTEM,
        "task.json": JSON.stringify({ tema: topic, para: "Short de 35–45 s" }, null, 1),
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

const catalog = readFileSync(path.join(root, "src", "anim", "catalog.md"), "utf8");
const example = JSON.stringify(
  { title: "El robo del siglo", scenes: ejemplo.map(({ voice: _, ...s }) => s), facts: [] },
  null,
  1,
);

const numbers = (s: string) =>
  (s.match(/\d+(?:[.,]\d+)*/g) ?? []).map((n) => n.replace(/[.,]/g, ""));

/** Además de checkGuion: cada dato apunta al dossier y ningún número sale de la nada (regla 9). */
function checkAgainstDossier(g: GuionDraft, d: Dossier): string[] {
  const errors = checkGuion(g);
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
    ];
    for (const n of numbers(texts.join(" "))) {
      if (!known.has(n)) errors.push(`scenes.${i} › el número ${n} no está en el dossier`);
    }
  });
  return errors;
}

async function guionFromDossier(file: string) {
  const saved = JSON.parse(readFileSync(path.resolve(file), "utf8")) as {
    topic: string;
    dossier: Dossier;
  };
  const name = `${path.basename(file, ".json").replace(/^dossier/, "guion")}${effort ? `-g${effort}` : ""}`;
  const { run, data } = await ask(
    name,
    "guion",
    {
      prompt:
        "Escribí el guion del Short sobre el tema de `task.json` **usando SOLO los hechos de " +
        "`dossier.json`**. No agregues ningún dato, nombre, fecha, cifra ni cita que no esté ahí, " +
        "aunque lo sepas: si no está en el dossier, no existe. Las citas van textuales, como en el " +
        "dossier. Nada de `disputed` ni de `unconfirmed` (si hace falta, redondeá a lo que todas " +
        "las versiones comparten). En `facts`, `source` es el id del hecho o la cita del dossier " +
        "(F3, C1; varios separados por coma). Devolvé el objeto que pide el schema.",
      files: {
        "CLAUDE.md": catalog,
        "ejemplo.json": example,
        "dossier.json": JSON.stringify(saved.dossier, null, 1),
        "task.json": JSON.stringify(
          { tema: saved.topic, voz: "Fran", duracion: "35–45 s" },
          null,
          1,
        ),
      },
      schema: guionSchema,
      maxTurns: 3,
      timeoutMs: 5 * 60_000,
    },
    (g) => checkAgainstDossier(g, saved.dossier),
  );
  if (data) {
    run.extra = {
      scenes: data.scenes.length,
      narrationChars: data.scenes.reduce((sum, s) => sum + s.narration.length, 0),
    };
  }
  save(run, path.join(out, `${name}.json`), { source: file, topic: saved.topic, guion: data });
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
else if (mode === "summary") summary();
else console.log("Uso: pnpm research dossier <1-5> | verify <dossier> | guion <dossier> | summary");
