// pg-boss worker: generation, render, publishing and metrics jobs (docs/ARCHITECTURE.md §6).
import { createClaudeCodeProvider, createOpenRouterProvider, createRouter } from "@radev/ai";
import {
  type CarouselGenerateJob,
  type CarouselRenderJob,
  carouselGenerateKey,
  carouselRenderKey,
  IDEA_REQUEST_TASKS,
  type IdeaRequestJob,
  JOBS,
  QUEUE_OPTIONS,
} from "@radev/core";
import { createDb, failGeneration, failIdeaRequest } from "@radev/db";
import { type JobWithMetadata, PgBoss } from "pg-boss";
import { generateCarousel, RetryableGenerationError } from "./jobs/carousel-generate";
import { failRender, renderCarousel } from "./jobs/carousel-render";
import { RetryableIdeasError, runIdeaRequest } from "./jobs/ideas-request";
import { createLogger } from "./logger";
import { closeBrowser } from "./render/browser";

const log = createLogger({ service: "worker" });

/** Time given to running jobs to finish before shutting down anyway. */
const SHUTDOWN_TIMEOUT_MS = 30_000;

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} no está definida. Revisá tu .env (ver .env.example).`);
  return value;
}

const requireDatabaseUrl = () => requireEnv("DATABASE_URL");

/** Retries of a render before the post is marked as failed. */
const RENDER_RETRIES = QUEUE_OPTIONS[JOBS.carouselRender].retryLimit;
/** Retries of a generation after a provider error worth retrying. */
const GENERATE_RETRIES = QUEUE_OPTIONS[JOBS.carouselGenerate].retryLimit;

async function main() {
  const boss = new PgBoss({
    connectionString: requireDatabaseUrl(),
    // Its own schema, so its tables never mix with ours (created on first start).
    schema: "pgboss",
    application_name: "radev-worker",
  });

  boss.on("error", (error) => log.error("pg-boss error", { error }));
  boss.on("warning", (warning) => log.warn("pg-boss warning", { ...warning }));

  await boss.start();
  const { db, pool } = createDb(requireDatabaseUrl());
  const renderEnv = {
    // The web as the worker reaches it: localhost in development, http://web:3000 in Docker.
    webUrl: process.env.WEB_INTERNAL_URL ?? "http://localhost:3000",
    renderToken: requireEnv("RENDER_TOKEN"),
  };

  // AI providers. Both credentials of Claude at once stop the start (rule 10); a missing one
  // only fails the runs that need it, with a message that says so.
  const router = createRouter({
    "claude-code": createClaudeCodeProvider(),
    openrouter: createOpenRouterProvider(),
  });
  const queueRender = async (versionId: string) => {
    await boss.send(
      JOBS.carouselRender,
      { versionId },
      { singletonKey: carouselRenderKey(versionId) },
    );
  };
  const queueGenerate = async (data: CarouselGenerateJob, delayMs: number) => {
    await boss.send(JOBS.carouselGenerate, data, {
      singletonKey: carouselGenerateKey(data.postId, data.attempt),
      startAfter: Math.ceil(delayMs / 1000),
    });
  };

  await boss.createQueue(JOBS.carouselGenerate, QUEUE_OPTIONS[JOBS.carouselGenerate]);
  // One generation at a time: claude -p shares the subscription with the operator.
  await boss.work(
    JOBS.carouselGenerate,
    { batchSize: 1, includeMetadata: true },
    async ([job]: JobWithMetadata<CarouselGenerateJob>[]) => {
      if (!job) return;
      const jobLog = log.child({ job: JOBS.carouselGenerate, id: job.id, postId: job.data.postId });
      const lastTry = job.retryCount >= GENERATE_RETRIES;
      try {
        const outcome = await generateCarousel(
          { db, log: jobLog, router, queueRender, queueGenerate, lastTry },
          job.data,
        );
        jobLog.info("generation finished", { outcome });
      } catch (error) {
        jobLog.error("generation failed", {
          error,
          attempt: job.retryCount + 1,
          retryable: error instanceof RetryableGenerationError,
        });
        if (lastTry) await failGeneration(db, job.data.postId);
        throw error;
      }
    },
  );

  await boss.createQueue(JOBS.carouselRender, QUEUE_OPTIONS[JOBS.carouselRender]);
  // One render at a time: Chromium is the heaviest thing on the server.
  await boss.work(
    JOBS.carouselRender,
    { batchSize: 1, includeMetadata: true },
    async ([job]: JobWithMetadata<CarouselRenderJob>[]) => {
      if (!job) return;
      const jobLog = log.child({
        job: JOBS.carouselRender,
        id: job.id,
        versionId: job.data.versionId,
      });
      try {
        await renderCarousel(
          {
            db,
            log: jobLog,
            env: renderEnv,
            queueGenerate: (postId) => queueGenerate({ postId, attempt: 0 }, 0),
          },
          job.data,
        );
      } catch (error) {
        jobLog.error("render failed", { error, attempt: job.retryCount + 1 });
        if (job.retryCount >= RENDER_RETRIES) await failRender(db, job.data.versionId, error);
        throw error;
      }
    },
  );
  // Idea requests (ideas.generate, ideas.research): one of each at a time. They are asked for by
  // hand; if the last try breaks, the request fails so the panel takes a new one.
  for (const task of IDEA_REQUEST_TASKS) {
    await boss.createQueue(task, QUEUE_OPTIONS[task]);
    await boss.work(
      task,
      { batchSize: 1, includeMetadata: true },
      async ([job]: JobWithMetadata<IdeaRequestJob>[]) => {
        if (!job) return;
        const jobLog = log.child({ job: task, id: job.id, requestId: job.data.requestId });
        const lastTry = job.retryCount >= QUEUE_OPTIONS[task].retryLimit;
        try {
          const outcome = await runIdeaRequest({ db, log: jobLog, router, lastTry }, job.data);
          jobLog.info("idea request finished", { outcome });
        } catch (error) {
          jobLog.error("idea request failed", {
            error,
            attempt: job.retryCount + 1,
            retryable: error instanceof RetryableIdeasError,
          });
          if (lastTry) {
            await failIdeaRequest(
              db,
              job.data.requestId,
              error instanceof Error ? error.message : "Error inesperado.",
            );
          }
          throw error;
        }
      },
    );
  }

  log.info("worker ready", {
    schema: "pgboss",
    schemaVersion: await boss.schemaVersion(),
    queues: [JOBS.carouselGenerate, JOBS.carouselRender, ...IDEA_REQUEST_TASKS],
  });

  let stopping = false;
  const shutdown = async (signal: NodeJS.Signals) => {
    if (stopping) return;
    stopping = true;
    log.info("shutting down", { signal, timeoutMs: SHUTDOWN_TIMEOUT_MS });
    try {
      await boss.stop({ graceful: true, timeout: SHUTDOWN_TIMEOUT_MS });
      await closeBrowser();
      await pool.end();
      log.info("worker stopped");
      process.exit(0);
    } catch (error) {
      log.error("unclean shutdown", { error });
      process.exit(1);
    }
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((error: unknown) => {
  log.error("worker failed to start", { error });
  process.exit(1);
});
