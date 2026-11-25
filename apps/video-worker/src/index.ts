// pg-boss worker of RAdev Studio: one queue per office of the video (ADR 0029,
// docs/ARCHITECTURE.md §14.1). Runs on the operator's notebook, apart from the social worker.
import { createClaudeCodeProvider, createOpenRouterProvider, createRouter } from "@radev/ai";
import {
  OFFICE_JOB,
  VIDEO_JOBS,
  VIDEO_QUEUE_OPTIONS,
  VIDEO_SWEEP_CRON,
  type VideoOfficeJob,
  videoOfficeKey,
  WORKING_STAGES,
  type WorkingStage,
} from "@radev/core";
import {
  createDb,
  getCurrentVideoDocument,
  listStuckVideos,
  readMediaFile,
  type Video,
  writeMediaFile,
} from "@radev/db";
import { createCommonsClient } from "@radev/video";
import { type JobWithMetadata, PgBoss } from "pg-boss";
import { createVideoAi } from "./ai";
import { createAiLock } from "./ai-lock";
import { fetchPage, shrinkImage, sizeOf } from "./io";
import { createLogger } from "./logger";
import type { Office, OfficeContext } from "./office";
import { createImagesOffice } from "./offices/images";
import { research } from "./offices/research";
import { review } from "./offices/review";
import { script } from "./offices/script";
import { createSourcesOffice } from "./offices/sources";
import { runOffice } from "./runner";
import { dbStore } from "./store";

const log = createLogger({ service: "video-worker" });

const SHUTDOWN_TIMEOUT_MS = 30_000;
/** Videos at a working stage untouched this long are queued again by the sweep. */
const STUCK_AFTER_MS = 15 * 60_000;

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} no está definida. Revisá tu .env (ver .env.example).`);
  return value;
}

async function main() {
  const connectionString = requireEnv("DATABASE_URL");
  const boss = new PgBoss({
    connectionString,
    // The same pg-boss schema as the social worker: its own queues (video.*), shared tables.
    schema: "pgboss",
    application_name: "radev-video-worker",
  });
  boss.on("error", (error) => log.error("pg-boss error", { error }));
  boss.on("warning", (warning) => log.warn("pg-boss warning", { ...warning }));
  await boss.start();

  const { db, pool } = createDb(connectionString);
  const router = createRouter({
    "claude-code": createClaudeCodeProvider(),
    openrouter: createOpenRouterProvider(),
  });
  const ai = createVideoAi({ db, router, lock: createAiLock() });
  const commons = createCommonsClient();
  const store = dbStore(db);

  const queue = async (job: VideoOfficeJob, delaySeconds: number) => {
    await boss.send(OFFICE_JOB[job.stage], job, {
      singletonKey: videoOfficeKey(job),
      startAfter: delaySeconds,
    });
  };

  const makeContext = (video: Video): OfficeContext => ({
    video,
    log: log.child({ videoId: video.id, stage: video.stage }),
    ai,
    document: async (kind) => (await getCurrentVideoDocument(db, video.id, kind))?.data ?? null,
    files: {
      write: (path, bytes) => writeMediaFile(`videos/${video.id}/${path}`, bytes),
      read: (path) => readMediaFile(`videos/${video.id}/${path}`),
    },
  });

  // The offices that exist. The voice, the render and the package arrive in T8: until then a video
  // that reaches them waits there (the runner says so in the log).
  const offices: Partial<Record<WorkingStage, Office>> = {
    researching: research,
    checking_sources: createSourcesOffice({ fetchPage }),
    finding_images: createImagesOffice({ commons, shrink: shrinkImage, sizeOf }),
    scripting: script,
    checking_facts: review,
  };

  for (const stage of WORKING_STAGES) {
    const name = OFFICE_JOB[stage];
    const options = VIDEO_QUEUE_OPTIONS[name];
    await boss.createQueue(name, options);
    // One video at a time per office. The AI offices also share the lock (one `claude -p` at all).
    await boss.work(
      name,
      { batchSize: 1, includeMetadata: true },
      async ([job]: JobWithMetadata<VideoOfficeJob>[]) => {
        if (!job) return;
        const jobLog = log.child({ job: name, id: job.id, videoId: job.data.videoId });
        const outcome = await runOffice(
          {
            store,
            queue,
            offices,
            makeContext,
            now: () => new Date(),
            log: jobLog,
            lastTry: job.retryCount >= options.retryLimit,
          },
          job.data,
        );
        jobLog.info("office job finished", { outcome });
      },
    );
  }

  // The sweep: a video at a working stage with no activity for a while lost its job (the send after
  // the commit failed, or the process was killed): queue it again. Doing it twice is harmless.
  await boss.createQueue(VIDEO_JOBS.sweep, VIDEO_QUEUE_OPTIONS[VIDEO_JOBS.sweep]);
  await boss.schedule(VIDEO_JOBS.sweep, VIDEO_SWEEP_CRON);
  await boss.work(VIDEO_JOBS.sweep, { batchSize: 1 }, async () => {
    const stuck = await listStuckVideos(db, new Date(Date.now() - STUCK_AFTER_MS));
    for (const video of stuck) {
      if (video.stage in OFFICE_JOB) {
        await queue({ videoId: video.id, stage: video.stage as WorkingStage, limitAttempt: 0 }, 0);
      }
    }
    if (stuck.length > 0) log.info("sweep queued videos again", { count: stuck.length });
  });

  log.info("video-worker started", { offices: Object.keys(offices) });

  let stopping = false;
  const shutdown = async (signal: string) => {
    if (stopping) return;
    stopping = true;
    log.info("shutting down", { signal });
    const timer = setTimeout(() => {
      log.error("shutdown timed out");
      process.exit(1);
    }, SHUTDOWN_TIMEOUT_MS);
    timer.unref();
    await boss.stop({ graceful: true, timeout: SHUTDOWN_TIMEOUT_MS });
    await pool.end();
    process.exit(0);
  };
  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}

main().catch((error) => {
  log.error("video-worker failed to start", { error });
  process.exit(1);
});
