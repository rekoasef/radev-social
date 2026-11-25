// RAdev Studio from the terminal (T9): takes a topic to the downloadable package with no screens.
// It runs the same worker as `index.ts` inside this process, and stops at the operator's two desks:
// the script (before paying for the voice) and the finished video.
//
//   pnpm --filter @radev/video-worker video "<tema>" [--out <carpeta>]
//   pnpm --filter @radev/video-worker video --resume <id> [--out <carpeta>]
//
// Without a terminal (stdin is not a TTY, or with `--no-prompt`) each desk prints what it shows and exits; the operator's
// answer goes back with `--resume <id> --approve` or `--resume <id> --reject "<nota>" [--to ...]`.
import { copyFile, mkdir } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { createInterface } from "node:readline/promises";
import {
  isWorkingStage,
  packageFiles,
  packageSlug,
  stageLabel,
  type VideoEvent,
  type VideoStage,
  videoDisplayStatus,
  type WorkingStage,
} from "@radev/core";
import {
  createVideo,
  type Database,
  getCurrentVideoDocument,
  getDefaultVoice,
  getVideo,
  listUsageEvents,
  listVideoRuns,
  resolveMediaPath,
  retryVideoById,
  transitionVideo,
  type Video,
} from "@radev/db";
import { imagesDocSchema, renderDocSchema, scriptSchema, sourcesSchema } from "@radev/video";
import type { VideoWorker } from "./start";

const POLL_MS = 3_000;

function fail(message: string): never {
  process.stderr.write(`\n${message}\n`);
  process.exit(1);
}

function parseArgs(argv: string[]) {
  let topic: string | undefined;
  let resume: string | undefined;
  let out = join(homedir(), "radev-videos");
  let approve = false;
  let reject: string | undefined;
  let to: string | undefined;
  let noPrompt = false;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--resume") resume = argv[++i];
    else if (arg === "--out") out = argv[++i] ?? out;
    else if (arg === "--approve") approve = true;
    else if (arg === "--reject") reject = argv[++i];
    else if (arg === "--to") to = argv[++i];
    else if (arg === "--no-prompt") noPrompt = true;
    else if (arg && !arg.startsWith("--")) topic = arg;
  }
  if (!topic && !resume) {
    fail(
      'Uso: pnpm --filter @radev/video-worker video "<tema>" [--out <carpeta>]\n' +
        "     pnpm --filter @radev/video-worker video --resume <id> [--out <carpeta>]",
    );
  }
  return { topic, resume, out, approve, reject, to, noPrompt };
}

const say = (text = "") => process.stdout.write(`${text}\n`);
const time = () => new Date().toLocaleTimeString("es-AR", { hour12: false });

async function ask(question: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    return (await rl.question(question)).trim();
  } finally {
    rl.close();
  }
}

async function confirm(question: string): Promise<boolean> {
  const answer = (await ask(`${question} [s/N] `)).toLowerCase();
  return answer === "s" || answer === "si" || answer === "sí";
}

/** The operator's answer at a desk, from the flags of this run or (with a terminal) by asking. */
type Answer = { approve: boolean; reject?: string; to?: string };
let answer: Answer = { approve: false };
/** `--no-prompt`: never ask on the keyboard (a run started by another program has no operator). */
let noPrompt = false;
const canAsk = () => !noPrompt && Boolean(process.stdin.isTTY);
const hasAnswer = () => answer.approve || answer.reject !== undefined;

/** No terminal and no answer yet: say how to answer and leave (nothing is lost, `--resume` goes on). */
async function stopForOperator(worker: VideoWorker, videoId: string, extra = "") {
  say("\nEsperando tu decisión. Para seguir:");
  say(`  --resume ${videoId} --approve`);
  say(`  --resume ${videoId} --reject "<nota>"${extra}`);
  await worker.stop();
  process.exit(0);
}

// ───────────── the two desks ─────────────

async function doc(
  db: Database,
  videoId: string,
  kind: Parameters<typeof getCurrentVideoDocument>[2],
) {
  return (await getCurrentVideoDocument(db, videoId, kind))?.data ?? null;
}

/** Prints what the operator needs to approve the script: scenes, images, facts and the checks. */
async function showScript(db: Database, video: Video) {
  const script = scriptSchema.safeParse(await doc(db, video.id, "script"));
  const images = imagesDocSchema.safeParse(await doc(db, video.id, "images"));
  const sources = sourcesSchema.safeParse(await doc(db, video.id, "sources"));
  const review = (await doc(db, video.id, "review")) as {
    applied?: unknown[];
    rejected?: unknown[];
  } | null;
  if (!script.success) fail(`El guion no se puede leer: ${script.error.message}`);

  const byId = new Map((images.success ? images.data.candidates : []).map((c) => [c.id, c]));
  const total = script.data.scenes.reduce((n, s) => n + s.narration.length, 0);
  say(`\n══ GUION: ${script.data.title} ══`);
  say(
    `${script.data.scenes.length} escenas · ${total} caracteres de narración (~${Math.round(total / 14)} s de voz)\n`,
  );
  script.data.scenes.forEach((s, i) => {
    const img = byId.get(s.image);
    say(
      `${String(i + 1).padStart(2)}. [${s.image}] ${img ? `${img.title} · ${img.author} · ${img.license}` : "(imagen desconocida)"}`,
    );
    say(`    ${s.narration}`);
    if (s.caption) say(`    pie: ${s.caption}`);
    if (s.graphics.length) say(`    gráficos: ${s.graphics.map((g) => g.kind).join(", ")}`);
  });
  say(`\nHechos citados: ${script.data.facts.length}`);
  if (sources.success) {
    const x = sources.data.summary;
    say(
      `Fuentes: ${x.textual} textuales · ${x.casi} casi · ${x.noEsta} no están · ${x.sinPagina} sin página`,
    );
  }
  if (review) {
    say(
      `Verificación de hechos: ${review.applied?.length ?? 0} correcciones aplicadas · ${review.rejected?.length ?? 0} rechazadas`,
    );
  }
  say(
    `\nImágenes elegidas: ${new Set(script.data.scenes.map((s) => s.image)).size} de ${byId.size} candidatas`,
  );
}

/** The first desk. Returns the event that was applied, and the stage to queue next (if any). */
async function scriptDesk(db: Database, worker: VideoWorker, video: Video) {
  await showScript(db, video);
  say("\nAprobar el guion gasta ~1.900 créditos de ElevenLabs (la voz) y ~8 min de render.");
  if (!hasAnswer() && !canAsk()) await stopForOperator(worker, video.id);
  const approved = hasAnswer() ? answer.approve : await confirm("¿Aprobás el guion?");
  if (approved) {
    const out = await transitionVideo(db, video.id, "approveScript");
    if (!out.ok) fail(out.reason);
    await worker.queue({ videoId: video.id, stage: "voicing", limitAttempt: 0 }, 0);
    say("Guion aprobado → Locución.");
    return;
  }
  const note = answer.reject ?? (await ask("Rechazo. ¿Qué hay que cambiar? (la IA lo lee) > "));
  const out = await transitionVideo(db, video.id, "rejectScript", { note });
  if (!out.ok) fail(out.reason);
  await worker.queue({ videoId: video.id, stage: "scripting", limitAttempt: 0 }, 0);
  say("Guion rechazado → vuelve a Guion con tu nota (sin repetir investigación ni imágenes).");
}

/** Copies the package to `<out>/<slug>/short|normal/` (the same folder the spike left). */
async function exportPackage(video: Video, out: string): Promise<string> {
  const slug = packageSlug(video.title ?? video.topic);
  const root = join(out, slug);
  const dir = resolveMediaPath(`videos/${video.id}`);
  if (!dir) fail("No encuentro la carpeta de medios del video (¿MEDIA_DIR?).");
  const source = (format: "9x16" | "16x9", file: "video" | "thumbnail" | "description") => {
    if (file === "video") return join(dir, `render/video-${format}.mp4`);
    if (file === "thumbnail") return join(dir, `package/miniatura-${format}.png`);
    return join(
      dir,
      format === "9x16" ? "package/descripcion-short.txt" : "package/descripcion.txt",
    );
  };
  for (const f of packageFiles(slug)) {
    const target = join(out, f.path);
    await mkdir(join(target, ".."), { recursive: true });
    await copyFile(source(f.format, f.file), target);
  }
  await copyFile(join(dir, "package/creditos.txt"), join(root, "creditos.txt")).catch(() => {});
  return root;
}

/** The second desk. */
async function videoDesk(db: Database, worker: VideoWorker, video: Video, out: string) {
  const folder = await exportPackage(video, out);
  const render = renderDocSchema.safeParse(await doc(db, video.id, "render"));
  say(`\n══ VIDEO LISTO: ${video.title ?? video.topic} ══`);
  if (render.success) {
    for (const f of render.data.formats) {
      say(
        `  ${f.format}: ${f.seconds.toFixed(1)} s · ${(f.bytes / 1e6).toFixed(1)} MB · ${f.width}×${f.height} · render ${(f.renderMs / 1000).toFixed(0)} s`,
      );
    }
  }
  say(`\nPaquete copiado a: ${folder}`);
  say("  short/ y normal/ con video.mp4, miniatura.png y descripcion.txt (+ creditos.txt)");
  say("Miralos y escuchalos antes de contestar.\n");

  if (!hasAnswer() && !canAsk()) {
    await stopForOperator(worker, video.id, " --to script|voice|render");
  }
  const approvedVideo = hasAnswer() ? answer.approve : await confirm("¿Aprobás el video?");
  if (approvedVideo) {
    const out2 = await transitionVideo(db, video.id, "approveVideo");
    if (!out2.ok) fail(out2.reason);
    say("Video aprobado.");
    return;
  }
  const names: Record<string, string> = { script: "1", voice: "2", render: "3" };
  const where =
    (answer.to ? names[answer.to] : undefined) ??
    (await ask(
      "¿Qué hay que rehacer? 1) el guion · 2) la voz · 3) solo el render (imagen, sin pagar la voz) > ",
    ));
  const choice: Record<string, { event: VideoEvent; stage: WorkingStage } | undefined> = {
    "1": { event: "rejectVideoToScript", stage: "scripting" },
    "2": { event: "rejectVideoToVoice", stage: "voicing" },
    "3": { event: "rejectVideoToRender", stage: "rendering" },
  };
  const pick = choice[where];
  if (!pick) fail("No entendí la opción; el video queda esperando tu revisión (corré --resume).");
  const note = answer.reject ?? (await ask("Nota para la oficina > "));
  const result = await transitionVideo(db, video.id, pick.event, { note });
  if (!result.ok) fail(result.reason);
  await worker.queue({ videoId: video.id, stage: pick.stage, limitAttempt: 0 }, 0);
  say(`Rechazado → ${stageLabel(pick.stage)}.`);
}

// ───────────── the report ─────────────

async function report(db: Database, videoId: string, startedAt: number) {
  const runs = await listVideoRuns(db, videoId);
  const usage = await listUsageEvents(db, videoId);
  say("\n══ INFORME ══");
  say(`Tiempo total: ${((Date.now() - startedAt) / 60_000).toFixed(1)} min`);
  let tokensIn = 0;
  let tokensOut = 0;
  for (const r of runs) {
    tokensIn += r.inputTokens;
    tokensOut += r.outputTokens;
    say(
      `  IA ${r.task.padEnd(14)} ${r.status.padEnd(10)} ${r.model} · ${r.inputTokens} in / ${r.outputTokens} out · ${((r.durationMs ?? 0) / 1000).toFixed(0)} s${r.errorKind ? ` · ${r.errorKind}` : ""}`,
    );
  }
  say(`  Claude: ${runs.length} corridas · ${tokensIn} tokens de entrada · ${tokensOut} de salida`);
  for (const u of usage) {
    say(
      `  ${u.kind.padEnd(7)} ${u.office ?? "-"} · ${u.quantity} ${u.unit}${u.durationMs ? ` · ${(u.durationMs / 1000).toFixed(0)} s` : ""}`,
    );
  }
}

// ───────────── main ─────────────

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const { topic, resume, out } = args;
  answer = { approve: args.approve, reject: args.reject, to: args.to };
  noPrompt = args.noPrompt;
  // The worker logs one JSON line per event: here only warnings, the terminal is for the progress.
  process.env.LOG_LEVEL ??= "warn";
  const { startVideoWorker } = await import("./start");
  const worker = await startVideoWorker();
  const db = worker.db;
  const startedAt = Date.now();

  let videoId: string;
  if (resume) {
    const video = await getVideo(db, resume);
    if (!video) fail(`No existe el video ${resume}.`);
    videoId = video.id;
    if (video.failure) await retryVideoById(db, video.id);
    if (isWorkingStage(video.stage)) {
      await worker.queue({ videoId, stage: video.stage as WorkingStage, limitAttempt: 0 }, 0);
    }
    say(`Retomando "${video.title ?? video.topic}" en ${stageLabel(video.stage)}.`);
  } else {
    const voice = await getDefaultVoice(db, "narrative", "es");
    if (!voice) fail("No hay una voz por defecto. Corré `pnpm db:seed`.");
    const video = await createVideo(db, { topic: topic as string, voiceId: voice.id });
    videoId = video.id;
    await worker.queue({ videoId, stage: "researching", limitAttempt: 0 }, 0);
    say(`Video ${video.id} creado · voz ${voice.name}\nTema: ${video.topic}`);
  }

  let shown = "";
  let stopping = false;
  process.on("SIGINT", () => {
    if (stopping) process.exit(1);
    stopping = true;
    say(`\nCortado. Para seguir: pnpm --filter @radev/video-worker video --resume ${videoId}`);
    void worker.stop().finally(() => process.exit(0));
  });

  for (;;) {
    const video = await getVideo(db, videoId);
    if (!video) fail("El video desapareció de la base.");
    const status = videoDisplayStatus(
      video.stage as VideoStage,
      {
        pausedAt: video.pausedAt,
        pauseReason: video.pauseReason,
        resumeAt: video.resumeAt,
        failure: video.failure ? { ...video.failure, at: new Date(video.failure.at) } : null,
      },
      new Date(),
    );
    const line = `${video.stage}|${status.label}|${status.detail ?? ""}`;
    if (line !== shown) {
      shown = line;
      say(
        `[${time()}] ${stageLabel(video.stage as VideoStage)} · ${status.label}${status.detail ? ` — ${status.detail}` : ""}`,
      );
    }

    // A recorded failure means pg-boss ran out of retries: it waits for the operator (--resume).
    if (video.failure) {
      await worker.stop();
      fail(`Falló y no avanza solo. Mirá el mensaje de arriba y corré: --resume ${videoId}`);
    }
    if (video.pauseReason === "budget" || video.pauseReason === "operator") {
      await worker.stop();
      fail(`Pausado (${video.pauseReason}). Resolvelo y corré --resume ${videoId}`);
    }
    // An answer from the flags is for one desk only: it is spent as soon as it is used.
    if (video.stage === "script_review") {
      await scriptDesk(db, worker, video);
      answer = { approve: false };
    } else if (video.stage === "in_review") {
      await videoDesk(db, worker, video, out);
      answer = { approve: false };
    } else if (video.stage === "approved") {
      const folder = await exportPackage(video, out);
      say(`\nListo. Paquete en ${folder}`);
      await report(db, videoId, startedAt);
      break;
    } else if (video.stage === "archived") break;

    await new Promise((r) => setTimeout(r, POLL_MS));
  }
  await worker.stop();
  process.exit(0);
}

main().catch((error) => {
  process.stderr.write(
    `${error instanceof Error ? (error.stack ?? error.message) : String(error)}\n`,
  );
  process.exit(1);
});
