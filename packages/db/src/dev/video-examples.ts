// Example videos to look at the studio without running the offices (local development only):
//
//   pnpm --filter @radev/db video:examples            # creates them
//   pnpm --filter @radev/db video:examples --clean    # removes them
//
// The video-worker queues again any video left at a working stage (its sweep), which would spend
// real Claude and voice credits. These are never swept: their `updated_at` is in the future. Do not
// press "Reintentar", "Aprobar guion" or "Devolver" on one with the worker running: those queue
// real jobs (voice credits, Claude).
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readFile, rm, stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { eq, like } from "drizzle-orm";
import { createDb } from "../client";
import { requireDatabaseUrl } from "../env";
import { loadRootEnv } from "../load-root-env";
import { resolveMediaPath, writeMediaFile } from "../media";
import { recordGenerationRun } from "../queries/ai";
import {
  addVideoDocument,
  createVideo,
  getDefaultVoice,
  recordUsageEvent,
  recordVideoFailure,
  setVideoProgress,
  setVideoTitle,
} from "../queries/videos";
import { videos } from "../schema";

const PREFIX = "[ejemplo] ";
const NEVER_SWEPT = new Date("2099-01-01T00:00:00Z");

async function main() {
  loadRootEnv();
  const url = requireDatabaseUrl();
  if (!/@(localhost|127\.0\.0\.1)[:/]/.test(url)) {
    throw new Error("Los ejemplos solo se cargan en una base local.");
  }
  const { db, pool } = createDb(url);
  const old = await db
    .delete(videos)
    .where(like(videos.topic, `${PREFIX}%`))
    .returning();
  for (const { id } of old) {
    const folder = resolveMediaPath(`videos/${id}`);
    if (folder) await rm(folder, { recursive: true, force: true });
  }
  if (process.argv.includes("--clean")) {
    process.stdout.write("Ejemplos borrados.\n");
    await pool.end();
    return;
  }

  const voice = await getDefaultVoice(db);
  const now = new Date();
  const ago = (ms: number) => new Date(now.getTime() - ms).toISOString();
  const made = [
    ["Betty y Barney Hill, 1961", "approved", "El mapa que no debía existir"],
    ["Louvre, 1911", "in_review", "El día que robaron la Mona Lisa"],
    ["El ballenero Essex, 1820", "rendering", "El barco que hundió una ballena"],
    ["Tunguska, 1908", "scripting", null],
    ["El robo de la Mona Lisa", "script_review", "El día que robaron la Mona Lisa (guion)"],
    ["Apagón de Nueva York, 1977", "finding_images", null],
  ] as const;

  for (const [topic, stage, title] of made) {
    const { id } = await createVideo(db, { topic: `${PREFIX}${topic}`, voiceId: voice?.id });
    if (title) await setVideoTitle(db, id, title);
    // Straight to the stage: these are not real videos going down the line.
    await db.update(videos).set({ stage }).where(eq(videos.id, id));
    if (stage === "rendering") {
      const progress = { stage, startedAt: ago(400_000), percent: 40, detail: "16:9" };
      await setVideoProgress(db, id, progress);
    }
    if (stage === "scripting") {
      const problems = [
        "scenes.6.narration › el número 26 no está en el dossier (regla 9)",
        "scenes.11 › from y to casi iguales: tiene que haber un zoom o paneo",
      ];
      const progress = { stage, startedAt: ago(72_000), attempt: 2, attempts: 3, problems };
      await setVideoProgress(db, id, progress);
    }
    if (stage === "finding_images") {
      const failure = { stage, message: "Commons respondió 429", retryable: true, at: now };
      await recordVideoFailure(db, id, failure);
    }
    if (stage === "approved") {
      await recordUsageEvent(db, {
        videoId: id,
        kind: "tts",
        office: "voicing",
        quantity: 1917,
        unit: "characters",
        data: { quota: { used: 3834, limit: 38439 } },
      });
      await recordUsageEvent(db, {
        videoId: id,
        kind: "render",
        office: "rendering",
        quantity: 510,
        unit: "seconds",
      });
    }
    if (stage === "script_review") await scriptDocuments(id);
    if (stage === "in_review" || stage === "approved") {
      await scriptDocuments(id);
      await deliveryDocuments(id);
    }
    // Last, because the writes above touch the row: keep it away from the sweep.
    await db.update(videos).set({ updatedAt: NEVER_SWEPT }).where(eq(videos.id, id));
  }

  // The script desk needs real documents: the Mona Lisa fixtures of the tests.
  async function scriptDocuments(id: string) {
    const root = (path: string) => fileURLToPath(new URL(`../../../../${path}`, import.meta.url));
    const fixture = async (name: string) =>
      JSON.parse(await readFile(root(`packages/video/test/fixtures/mona-${name}.json`), "utf8"));
    const script = await fixture("script");
    const dossier = await fixture("dossier");
    const candidates = (await fixture("candidates")) as { id: string; file: string }[];
    // Pictures: the mockup's downloads if they are there (docs/references/studio), else none.
    for (const c of candidates) {
      c.file = `images/${c.id}.jpg`;
      const source = root(`docs/references/studio/maqueta/img/${c.id}.jpg`);
      if (!existsSync(source)) continue;
      const bytes = await readFile(source);
      await writeMediaFile(`videos/${id}/images/${c.id}.jpg`, bytes);
      await writeMediaFile(`videos/${id}/images/${c.id}.small.jpg`, bytes);
    }
    const results = ["textual", "casi", "no-esta"] as const;
    const facts = (dossier.facts as { id: string; url: string }[]).map((f, i) => ({
      id: f.id,
      url: f.url,
      result: results[i % 3],
      overlap: 0,
      missingNumbers: [],
    }));
    await save(id, "dossier", dossier);
    await save(id, "images", { candidates });
    await save(id, "script", script);
    await save(id, "sources", {
      facts,
      summary: {
        textual: facts.filter((f) => f.result === "textual").length,
        casi: facts.filter((f) => f.result === "casi").length,
        noEsta: facts.filter((f) => f.result === "no-esta").length,
        sinPagina: 0,
      },
    });
    await save(id, "review", {
      applied: [{ scene: 4, kind: "no-respaldado", problem: "Corrección de ejemplo." }],
      rejected: [],
    });
  }

  // The video desk: voice, render and package, with filler MP4s (a running counter, so seeking
  // shows) made with ffmpeg.
  async function deliveryDocuments(id: string) {
    const root = (path: string) => fileURLToPath(new URL(`../../../../${path}`, import.meta.url));
    const fixture = async (name: string) =>
      JSON.parse(await readFile(root(`packages/video/test/fixtures/mona-${name}.json`), "utf8"));
    const manifest = (await fixture("voice-manifest")) as {
      scenes: { frames: number; text: string }[];
    };
    const publication = await fixture("publication");
    const totalFrames = manifest.scenes.reduce((n, s) => n + s.frames, 0);
    const folder = resolveMediaPath(`videos/${id}`);
    if (!folder) throw new Error("No encuentro la carpeta de medios.");
    await mkdir(`${folder}/render`, { recursive: true });
    await mkdir(`${folder}/package`, { recursive: true });
    const ffmpeg = (...args: string[]) => execFileSync("ffmpeg", ["-v", "error", "-y", ...args]);

    const formats = [];
    for (const [format, width, height] of [
      ["9x16", 270, 480],
      ["16x9", 480, 270],
    ] as const) {
      const file = `render/video-${format}.mp4`;
      const seconds = String(totalFrames / 30);
      ffmpeg(
        ...["-f", "lavfi", "-i", `testsrc=size=${width}x${height}:rate=10:duration=${seconds}`],
        ...["-f", "lavfi", "-i", `anullsrc=r=48000:cl=mono`, "-shortest"],
        ...["-c:v", "libx264", "-preset", "ultrafast", "-pix_fmt", "yuv420p", "-c:a", "aac"],
        ...["-movflags", "+faststart", `${folder}/${file}`],
      );
      ffmpeg(
        ...["-f", "lavfi", "-i", `color=c=0x2a2f3a:size=${width * 2}x${height * 2}`],
        ...["-frames:v", "1", `${folder}/package/miniatura-${format}.png`],
      );
      formats.push({
        format,
        file,
        seconds: totalFrames / 30,
        bytes: (await stat(`${folder}/${file}`)).size,
        width: format === "9x16" ? 1080 : 1920,
        height: format === "9x16" ? 1920 : 1080,
        renderMs: format === "9x16" ? 258_000 : 252_000,
      });
    }

    const normal = `${publication.title}\n\n${publication.hook}\n\n[descripción de ejemplo]\n`;
    const short = `${publication.title}\n\n${publication.hook}\n\n#Shorts [ejemplo]\n`;
    const text = new Map([
      ["package/descripcion.txt", normal],
      ["package/descripcion-short.txt", short],
      ["package/creditos.txt", "Imágenes (Wikimedia Commons): ejemplo.\n"],
    ]);
    for (const [path, content] of text) {
      await writeMediaFile(`videos/${id}/${path}`, new TextEncoder().encode(content));
    }

    await save(id, "voice", {
      fingerprint: "ejemplo",
      voiceId: "ejemplo",
      model: "eleven_multilingual_v2",
      speed: null,
      characters: 1917,
      fps: 30,
      totalFrames,
      full: "voice/full.mp3",
      scenes: manifest.scenes.map((s, index) => ({
        index,
        frames: s.frames,
        text: s.text,
        audio: "voice/full.mp3",
        words: "voice/words.json",
      })),
    });
    await save(id, "render", { fps: 30, totalFrames, formats });
    await save(id, "package", {
      publication,
      descriptionNormal: normal,
      descriptionShort: short,
      credits: "ejemplo",
      thumbnails: { "9x16": "package/miniatura-9x16.png", "16x9": "package/miniatura-16x9.png" },
    });

    // The report: the tokens measured with a real video (docs/PROGRESS.md, T9).
    for (const [task, inputTokens, outputTokens] of [
      ["video.research", 73_090, 26_539],
      ["video.images", 32_381, 3_593],
      ["video.script", 94_900, 16_504],
      ["video.review", 91_671, 9_068],
      ["video.package", 24_838, 1_226],
    ] as const) {
      await recordGenerationRun(db, {
        videoId: id,
        task,
        role: "primary",
        provider: "claude-code",
        model: "ejemplo",
        status: "succeeded",
        inputTokens,
        outputTokens,
      });
    }
    for (const [office, seconds] of [
      ["researching", 235],
      ["checking_sources", 6],
      ["finding_images", 472],
      ["scripting", 126],
      ["checking_facts", 94],
      ["voicing", 12],
      ["rendering", 510],
      ["packaging", 41],
    ] as const) {
      await recordUsageEvent(db, {
        videoId: id,
        kind: "office",
        office,
        quantity: seconds,
        unit: "seconds",
        durationMs: seconds * 1000,
      });
    }
  }

  function save(
    videoId: string,
    kind: Parameters<typeof addVideoDocument>[1]["kind"],
    data: object,
  ) {
    return addVideoDocument(db, {
      videoId,
      kind,
      data: data as Record<string, unknown>,
      origin: "office",
    });
  }

  process.stdout.write(`${made.length} videos de ejemplo creados.\n`);
  await pool.end();
}

await main();
