// pg-boss worker: generation, render, publishing and metrics jobs (docs/ARCHITECTURE.md §6).
import { type CarouselRenderJob, JOBS, QUEUE_OPTIONS } from "@radev/core";
import { createDb } from "@radev/db";
import { type JobWithMetadata, PgBoss } from "pg-boss";
import { failRender, renderCarousel } from "./jobs/carousel-render";
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
        await renderCarousel(db, jobLog, renderEnv, job.data);
      } catch (error) {
        jobLog.error("render failed", { error, attempt: job.retryCount + 1 });
        if (job.retryCount >= RENDER_RETRIES) await failRender(db, job.data.versionId, error);
        throw error;
      }
    },
  );
  log.info("worker ready", {
    schema: "pgboss",
    schemaVersion: await boss.schemaVersion(),
    queues: [JOBS.carouselRender],
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
