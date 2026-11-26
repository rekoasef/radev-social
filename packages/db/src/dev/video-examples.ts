// Example videos to look at the studio without running the offices (local development only):
//
//   pnpm --filter @radev/db video:examples            # creates them
//   pnpm --filter @radev/db video:examples --clean    # removes them
//
// The video-worker queues again any video left at a working stage (its sweep), which would spend
// real Claude and voice credits. These are never swept: their `updated_at` is in the future. Do not
// press "Reintentar", "Aprobar guion" or "Devolver" on one with the worker running: those queue
// real jobs (voice credits, Claude).
import { existsSync } from "node:fs";
import { readFile, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { eq, like } from "drizzle-orm";
import { createDb } from "../client";
import { requireDatabaseUrl } from "../env";
import { loadRootEnv } from "../load-root-env";
import { resolveMediaPath, writeMediaFile } from "../media";
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
      const progress = { stage, startedAt: ago(72_000), attempt: 2, attempts: 3 };
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
    const save = (kind: "dossier" | "images" | "script" | "sources" | "review", data: object) =>
      addVideoDocument(db, {
        videoId: id,
        kind,
        data: data as Record<string, unknown>,
        origin: "office",
      });
    await save("dossier", dossier);
    await save("images", { candidates });
    await save("script", script);
    await save("sources", {
      facts,
      summary: { textual: 0, casi: 0, noEsta: 0, sinPagina: 0 },
    });
    await save("review", {
      applied: [{ scene: 4, kind: "no-respaldado", problem: "Corrección de ejemplo." }],
      rejected: [],
    });
  }

  process.stdout.write(`${made.length} videos de ejemplo creados.\n`);
  await pool.end();
}

await main();
