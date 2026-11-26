// Example videos to look at the studio without running the offices (local development only):
//
//   pnpm --filter @radev/db video:examples            # creates them
//   pnpm --filter @radev/db video:examples --clean    # removes them
//
// The video-worker queues again any video left at a working stage (its sweep), which would spend
// real Claude and voice credits. These are never swept: their `updated_at` is in the future. Do not
// press "Reintentar" on one with the worker running: that does queue a real job.
import { eq, like } from "drizzle-orm";
import { createDb } from "../client";
import { requireDatabaseUrl } from "../env";
import { loadRootEnv } from "../load-root-env";
import {
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
  await db.delete(videos).where(like(videos.topic, `${PREFIX}%`));
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
    // Last, because the writes above touch the row: keep it away from the sweep.
    await db.update(videos).set({ updatedAt: NEVER_SWEPT }).where(eq(videos.id, id));
  }

  process.stdout.write(`${made.length} videos de ejemplo creados.\n`);
  await pool.end();
}

await main();
