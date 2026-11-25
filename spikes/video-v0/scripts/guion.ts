// V0-8: `claude -p` escribe guiones animados en el formato de V0-6, con el proveedor real de
// @radev/ai (modo liviano: sin herramientas, el catálogo como prompt de sistema, --json-schema) y la
// suscripción del operador (CLAUDE_CODE_OAUTH_TOKEN del .env de la raíz). Cada pedido queda en
// out/v0-8/<nombre>.json con lo que consumió y si pasó las dos validaciones al primer intento, y
// suma una línea a out/v0-8/runs.jsonl. Uso:
//   pnpm guion short <1-5|all>                         guiones de Short sobre los temas de abajo
//   pnpm guion rewrite <archivo> <escena> "<pedido>"   reescribe una escena (índice desde 0)
//   pnpm guion chapters "<tema>"                       plan de capítulos de un video de 4 min
//   pnpm guion summary                                 tabla de todos los pedidos
// --repair: si el guion no pasa, un segundo pedido con los errores (se mide aparte).
// --model <alias>: sonnet por defecto, como la ruta de producción.
// --effort <low|medium|high|xhigh|max>: cuánto piensa el modelo (por defecto, el del CLI). El
// proveedor no lo pasa todavía: la spike usa un envoltorio del mismo binario que lo agrega.
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
import { kitDoc } from "../src/anim/kit-catalog";
import {
  checkGuion,
  checkScene,
  type GuionDraft,
  guionSchema,
  SETTINGS,
  sceneSchema,
} from "../src/anim/schema";
import { TOPICS } from "./topics";

const root = path.resolve(import.meta.dirname, "..");
const envFile = path.resolve(root, "..", "..", ".env");
if (existsSync(envFile)) process.loadEnvFile(envFile);
const out = path.join(root, "out", "v0-8");
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
const repair = flag("repair") !== undefined;
const effort = flag("effort");
const [mode, ...rest] = args;

const catalog = `${readFileSync(path.join(root, "src", "anim", "catalog.md"), "utf8")}\n\n${kitDoc()}\n`;
const example = JSON.stringify(
  { title: "El robo del siglo", scenes: ejemplo.map(({ voice: _, ...s }) => s), facts: [] },
  null,
  1,
);

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

type Run = {
  name: string;
  mode: string;
  attempt: 1 | 2;
  model: string;
  effort: string;
  zodOk: boolean;
  checkErrors: string[] | null;
  valid: boolean;
  usage: Usage | null;
  wallMs: number;
  promptChars: number;
  outputChars: number;
  scenes?: number;
  narrationChars?: number;
  error?: string;
};

async function ask<T>(
  name: string,
  task: Pick<GenerationTask<T>, "prompt" | "files" | "schema">,
  check: (data: T) => string[],
  attempt: 1 | 2 = 1,
): Promise<{ run: Run; data: T | null }> {
  const t0 = performance.now();
  const promptChars =
    task.prompt.length + Object.values(task.files).reduce((sum, f) => sum + f.length, 0);
  console.log(
    `→ ${name} (intento ${attempt}, ${model}, effort ${effort ?? "default"}, ${promptChars} caracteres de contexto)…`,
  );
  const result = await provider.generate({
    task: "carousel.generate", // la spike no suma tareas a core; en V1 sería video.script
    brandId: "spike-video",
    model,
    maxTurns: 3,
    timeoutMs: 5 * 60_000,
    ...task,
  });
  const wallMs = Math.round(performance.now() - t0);
  const base = {
    name,
    mode: mode ?? "",
    attempt,
    model,
    effort: effort ?? "default",
    usage: result.usage,
    wallMs,
    promptChars,
  };
  if (!result.ok) {
    const issues = result.error.kind === "validation" ? result.error.issues : undefined;
    const run: Run = {
      ...base,
      zodOk: false,
      checkErrors: null,
      valid: false,
      outputChars: 0,
      error: `${result.error.kind}: ${result.error.message}${issues ? ` · ${issues.slice(0, 8).join(" | ")}` : ""}`,
    };
    return { run, data: null };
  }
  const errors = check(result.data);
  const run: Run = {
    ...base,
    zodOk: true,
    checkErrors: errors,
    valid: errors.length === 0,
    outputChars: JSON.stringify(result.data).length,
  };
  return { run, data: result.data };
}

function save(run: Run, data: unknown, extra: Record<string, unknown> = {}) {
  const suffix = `${effort ? `-${effort}` : ""}${run.attempt === 2 ? "-repair" : ""}`;
  const file = path.join(out, `${run.name}${suffix}.json`);
  writeFileSync(file, JSON.stringify({ run, ...extra, guion: data }, null, 1));
  appendFileSync(path.join(out, "runs.jsonl"), `${JSON.stringify(run)}\n`);
  const u = run.usage;
  console.log(
    `  ${run.valid ? "VÁLIDO" : run.zodOk ? "Zod ok, sentido NO" : "NO PASA ZOD"} · ` +
      (u
        ? `${u.inputTokens} entrada / ${u.outputTokens} salida · ${u.numTurns ?? "?"} turnos · ` +
          `${(u.durationMs / 1000).toFixed(1)} s (reloj ${(run.wallMs / 1000).toFixed(1)} s) · ` +
          `lista USD ${u.costUsd?.toFixed(3) ?? "?"}`
        : `sin uso (${(run.wallMs / 1000).toFixed(1)} s)`) +
      ` → ${path.relative(root, file)}`,
  );
  for (const e of run.checkErrors ?? []) console.log(`    ${e}`);
  if (run.error) console.log(`    ${run.error}`);
}

const narrationStats = (g: GuionDraft) => ({
  scenes: g.scenes.length,
  narrationChars: g.scenes.reduce((sum, s) => sum + s.narration.length, 0),
});

async function short(i: number) {
  const topic = TOPICS[i];
  if (!topic) throw new Error(`No hay tema ${i + 1}`);
  const name = `short-${i + 1}`;
  const files = {
    "CLAUDE.md": catalog,
    "ejemplo.json": example,
    "task.json": JSON.stringify({ tema: topic, voz: "Alberto", duracion: "35–45 s" }, null, 1),
  };
  const prompt =
    "Escribí el guion del Short sobre el tema de `task.json`, siguiendo las instrucciones y usando " +
    "solo los dibujos del catálogo. Devolvé el objeto que pide el schema.";
  const first = await ask(name, { prompt, files, schema: guionSchema }, checkGuion);
  if (first.data) Object.assign(first.run, narrationStats(first.data));
  save(first.run, first.data, { topic });
  if (!repair || first.run.valid) return;
  // Segundo intento con los errores (de Zod o de sentido) y el guion anterior.
  const problems = first.run.checkErrors?.length
    ? first.run.checkErrors
    : [first.run.error ?? "no pasó el schema"];
  const second = await ask(
    name,
    {
      prompt:
        "Tu guion anterior no pasó la validación. Corregí SOLO lo que dicen los errores y " +
        "devolvé el guion completo otra vez.\n\nErrores:\n" +
        problems.map((p) => `- ${p}`).join("\n"),
      files: {
        ...files,
        ...(first.data && { "guion-anterior.json": JSON.stringify(first.data, null, 1) }),
      },
      schema: guionSchema,
    },
    checkGuion,
    2,
  );
  if (second.data) Object.assign(second.run, narrationStats(second.data));
  save(second.run, second.data, { topic });
}

async function rewrite(file: string, index: number, request: string) {
  const saved = JSON.parse(readFileSync(path.resolve(file), "utf8")) as { guion: GuionDraft };
  const scene = saved.guion.scenes[index];
  if (!scene) throw new Error(`El guion no tiene escena ${index}`);
  const name = `rewrite-${path.basename(file, ".json")}-e${index}-${Date.now().toString(36)}`;
  const { run, data } = await ask(
    name,
    {
      prompt:
        `Reescribí la escena ${index} (índice desde 0) del guion de \`guion.json\` según este ` +
        `pedido del operador: "${request}". Mantené el hilo con las escenas de antes y de después. ` +
        "Devolvé solo esa escena, con el formato del schema.",
      files: {
        "CLAUDE.md": catalog,
        "guion.json": JSON.stringify(saved.guion, null, 1),
      },
      schema: sceneSchema,
    },
    (s) => checkScene(s, `scenes.${index}.`),
  );
  save(run, data, { source: file, index, request, before: scene });
}

const chapterSchema = z
  .object({
    title: z.string().min(1).max(80),
    hook: z.string().min(1).max(300).describe("Qué se dice en los primeros 5 segundos."),
    chapters: z
      .array(
        z
          .object({
            title: z.string().min(1).max(60),
            seconds: z.number().int().min(15).max(120),
            beats: z.array(z.string().min(1).max(200)).min(2).max(8),
            settings: z.array(z.enum(SETTINGS)).max(4),
            missingDrawings: z
              .array(z.string().min(1).max(120))
              .max(6)
              .describe("Dibujos que harían falta y no están en el catálogo."),
          })
          .strict(),
      )
      .min(4)
      .max(10),
    closingQuestion: z.string().min(1).max(200),
    facts: z.array(z.object({ claim: z.string(), source: z.string() }).strict()).max(20),
  })
  .strict();

async function chapters(topic: string) {
  const name = `chapters-${Date.now().toString(36)}`;
  const { run, data } = await ask(
    name,
    {
      prompt:
        "Esta vez no es un Short: armá el **plan de capítulos** de un video horizontal de unos 4 " +
        "minutos (240 s en total, sumando los capítulos) sobre el tema de `task.json`. No escribas " +
        "las escenas todavía: por capítulo, qué se cuenta (beats), cuánto dura, qué escenarios del " +
        "catálogo sirven y qué dibujos harían falta que no existen. Devolvé el objeto del schema.",
      files: {
        "CLAUDE.md": catalog,
        "task.json": JSON.stringify({ tema: topic, voz: "Alberto", duracion: "4 min" }, null, 1),
      },
      schema: chapterSchema,
    },
    (plan) => {
      const total = plan.chapters.reduce((sum, c) => sum + c.seconds, 0);
      return Math.abs(total - 240) > 30 ? [`los capítulos suman ${total} s, no ~240`] : [];
    },
  );
  save(run, data, { topic });
}

function summary() {
  const file = path.join(out, "runs.jsonl");
  if (!existsSync(file)) return console.log("Sin pedidos todavía.");
  const runs = readFileSync(file, "utf8")
    .trim()
    .split("\n")
    .map((l) => JSON.parse(l) as Run);
  console.log(
    "pedido | effort | intento | válido | Zod | errores | entrada | salida | turnos | s | escenas | caracteres",
  );
  for (const r of runs) {
    const u = r.usage;
    console.log(
      [
        r.name,
        r.effort ?? "default",
        r.attempt,
        r.valid ? "sí" : "no",
        r.zodOk ? "sí" : "no",
        r.checkErrors?.length ?? "-",
        u?.inputTokens ?? "-",
        u?.outputTokens ?? "-",
        u?.numTurns ?? "-",
        u ? (u.durationMs / 1000).toFixed(1) : "-",
        r.scenes ?? "-",
        r.narrationChars ?? "-",
      ].join(" | "),
    );
  }
}

if (mode === "short") {
  const which = rest[0] ?? "1";
  const list = which === "all" ? TOPICS.map((_, i) => i) : [Number(which) - 1];
  for (const i of list) await short(i);
} else if (mode === "rewrite") {
  const [file, index, request] = rest;
  if (!file || index === undefined || !request)
    throw new Error("rewrite <archivo> <escena> <pedido>");
  await rewrite(file, Number(index), request);
} else if (mode === "chapters") {
  await chapters(rest[0] ?? TOPICS[1] ?? "");
} else if (mode === "summary") {
  summary();
} else {
  console.log(
    "Uso: pnpm guion short <1-5|all> | rewrite <archivo> <escena> <pedido> | chapters <tema> | summary",
  );
}
