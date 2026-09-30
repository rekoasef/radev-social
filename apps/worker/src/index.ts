// pg-boss worker: generation, render, publishing and metrics jobs (docs/ARCHITECTURE.md §6).
import {
  createClaudeCodeProvider,
  createCloudflareImageProvider,
  createOpenRouterProvider,
  createRouter,
} from "@radev/ai";
import {
  type ArtGenerateJob,
  artGenerateKey,
  type CarouselGenerateJob,
  type CarouselRenderJob,
  carouselGenerateKey,
  carouselRenderKey,
  DATA_REFRESH_CRON,
  DATA_REFRESH_TZ,
  DATA_SOURCES,
  type DataRefreshJob,
  dataRefreshKey,
  IDEA_REQUEST_TASKS,
  type IdeaRequestJob,
  ideaRequestKey,
  JOBS,
  type NotifySendJob,
  type PostPublishJob,
  QUEUE_OPTIONS,
  SLOTS_FILL_CRON,
  type SlideRewriteJob,
  type TiktokPublishJob,
  TOKENS_REFRESH_CRON,
  tiktokPublishKey,
} from "@radev/core";
import {
  createDb,
  failGeneration,
  failIdeaRequest,
  finishSlideRewrite,
  getLatestSnapshot,
} from "@radev/db";
import { type JobWithMetadata, PgBoss } from "pg-boss";
import { generateArt } from "./jobs/art-generate";
import { generateCarousel, RetryableGenerationError } from "./jobs/carousel-generate";
import { failRender, renderCarousel } from "./jobs/carousel-render";
import { refreshData } from "./jobs/data-refresh";
import { RetryableIdeasError, runIdeaRequest } from "./jobs/ideas-request";
import { notifyReview, sendNotification } from "./jobs/notify";
import { publishPost } from "./jobs/post-publish";
import { RetryableRewriteError, rewriteSlide } from "./jobs/slide-rewrite";
import { fillSlots } from "./jobs/slots-fill";
import { failTiktokPublish, publishToTiktok } from "./jobs/tiktok-publish";
import { refreshTokens } from "./jobs/tokens-refresh";
import { createLogger } from "./logger";
import { createEvents, errorMessage } from "./notify/events";
import { createNotifier } from "./notify/notifier";
import { telegramConfig, telegramSender } from "./notify/telegram";
import { closeBrowser } from "./render/browser";
import { backgroundMatches, edgeBrightness } from "./render/image-check";
import { jpegFromPng } from "./render/jpeg";

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
  // Images of the posts (ADR 0016): only with Cloudflare's credentials; without them, posts render
  // with the look's own art and the panel says why.
  const images = createCloudflareImageProvider();
  if (!images) log.warn("cloudflare not configured: posts go without generated images");
  const queueArt = images
    ? async (versionId: string) => {
        await boss.send(
          JOBS.artGenerate,
          { versionId },
          { singletonKey: artGenerateKey(versionId) },
        );
      }
    : undefined;
  const queueGenerate = async (data: CarouselGenerateJob, delayMs: number) => {
    await boss.send(JOBS.carouselGenerate, data, {
      singletonKey: carouselGenerateKey(data.postId, data.attempt),
      startAfter: Math.ceil(delayMs / 1000),
    });
  };

  // Notices to the operator on Telegram (phase 4, T6). Without the bot's settings they are still
  // stored (Settings shows them) but not sent. Links point to the panel's public address.
  const telegram = telegramConfig();
  if (!telegram) log.warn("telegram not configured: notices are stored, not sent");
  await boss.createQueue(JOBS.notifySend, QUEUE_OPTIONS[JOBS.notifySend]);
  await boss.createQueue(JOBS.reviewNotify, QUEUE_OPTIONS[JOBS.reviewNotify]);
  const notifier = createNotifier({
    db,
    boss,
    appUrl: process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
  });
  const events = createEvents({ db, notifier, log });

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
          {
            db,
            log: jobLog,
            router,
            queueRender,
            queueArt,
            queueGenerate,
            lastTry,
            onRateLimit: events.rateLimited,
          },
          job.data,
        );
        jobLog.info("generation finished", { outcome });
        if (outcome === "failed") {
          await events.postFailed({
            what: "generation",
            postId: job.data.postId,
            id: job.id,
            error: "La IA no pudo escribir un carrusel válido: los errores están en el post.",
          });
        }
      } catch (error) {
        jobLog.error("generation failed", {
          error,
          attempt: job.retryCount + 1,
          retryable: error instanceof RetryableGenerationError,
        });
        if (lastTry) {
          await failGeneration(db, job.data.postId);
          await events.postFailed({
            what: "generation",
            postId: job.data.postId,
            id: job.id,
            error: errorMessage(error),
          });
        }
        throw error;
      }
    },
  );

  await boss.createQueue(JOBS.artGenerate, QUEUE_OPTIONS[JOBS.artGenerate]);
  // One at a time, like the render (it uses the same Chromium to check the backgrounds). It
  // settles every failure itself: the render always gets queued.
  await boss.work(
    JOBS.artGenerate,
    { batchSize: 1 },
    async ([job]: { id: string; data: ArtGenerateJob }[]) => {
      if (!job) return;
      await generateArt(
        {
          db,
          log: log.child({ job: JOBS.artGenerate, id: job.id, versionId: job.data.versionId }),
          images,
          edgeBrightness,
          backgroundMatches,
          queueRender,
        },
        job.data,
      );
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
            onReview: notifier.reviewSoon,
            onFailed: (failed) =>
              events.renderFailed({ versionId: failed.versionId, error: failed.error }),
          },
          job.data,
        );
      } catch (error) {
        jobLog.error("render failed", { error, attempt: job.retryCount + 1 });
        if (job.retryCount >= RENDER_RETRIES) {
          await failRender(db, job.data.versionId, error);
          await events.renderFailed({ versionId: job.data.versionId, error: errorMessage(error) });
        }
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
            await events.ideasFailed({ requestId: job.data.requestId, error: errorMessage(error) });
          }
          throw error;
        }
      },
    );
  }

  // Slide rewrites from the editor: one at a time, like the carousels (same subscription). If
  // the last try breaks, the request fails so the editor stops waiting.
  await boss.createQueue(JOBS.slideRewrite, QUEUE_OPTIONS[JOBS.slideRewrite]);
  await boss.work(
    JOBS.slideRewrite,
    { batchSize: 1, includeMetadata: true },
    async ([job]: JobWithMetadata<SlideRewriteJob>[]) => {
      if (!job) return;
      const jobLog = log.child({
        job: JOBS.slideRewrite,
        id: job.id,
        requestId: job.data.requestId,
      });
      const lastTry = job.retryCount >= QUEUE_OPTIONS[JOBS.slideRewrite].retryLimit;
      try {
        const outcome = await rewriteSlide({ db, log: jobLog, router, lastTry }, job.data);
        jobLog.info("slide rewrite finished", { outcome });
      } catch (error) {
        jobLog.error("slide rewrite failed", {
          error,
          attempt: job.retryCount + 1,
          retryable: error instanceof RetryableRewriteError,
        });
        if (lastTry)
          await finishSlideRewrite(db, job.data.requestId, { error: errorMessage(error) });
        throw error;
      }
    },
  );

  // Real data (Bluelytics): once a day by cron, or by hand from the panel. If the worker was off
  // at that time, it catches up once when it starts; with no data at all, it fetches right away.
  await boss.createQueue(JOBS.dataRefresh, QUEUE_OPTIONS[JOBS.dataRefresh]);
  await boss.work(
    JOBS.dataRefresh,
    { batchSize: 1, includeMetadata: true },
    async ([job]: JobWithMetadata<DataRefreshJob>[]) => {
      if (!job) return;
      const jobLog = log.child({ job: JOBS.dataRefresh, id: job.id, source: job.data.source });
      try {
        await refreshData({ db, log: jobLog }, job.data);
      } catch (error) {
        jobLog.error("data refresh failed", { error, attempt: job.retryCount + 1 });
        throw error;
      }
    },
  );
  for (const source of DATA_SOURCES) {
    await boss.schedule(
      JOBS.dataRefresh,
      DATA_REFRESH_CRON,
      { source },
      { tz: DATA_REFRESH_TZ, key: source, missed: "once", singletonKey: dataRefreshKey(source) },
    );
    if (!(await getLatestSnapshot(db, source))) {
      await boss.send(JOBS.dataRefresh, { source }, { singletonKey: dataRefreshKey(source) });
    }
  }

  // TikTok (phase 5 T6): a brand with its account connected publishes through it. Without the app's
  // keys or MEDIA_DOMAIN (TikTok pulls the photos from there) its posts fail with that reason.
  const tiktokClient =
    process.env.TIKTOK_CLIENT_KEY && process.env.TIKTOK_CLIENT_SECRET
      ? {
          clientKey: process.env.TIKTOK_CLIENT_KEY,
          clientSecret: process.env.TIKTOK_CLIENT_SECRET,
        }
      : null;
  const mediaBaseUrl = process.env.MEDIA_DOMAIN ? `https://${process.env.MEDIA_DOMAIN}` : null;
  if (!tiktokClient) log.warn("tiktok not configured: brands with it connected will fail to post");
  const tiktokRetries = QUEUE_OPTIONS[JOBS.tiktokPublish].retryLimit;
  await boss.createQueue(JOBS.tiktokPublish, QUEUE_OPTIONS[JOBS.tiktokPublish]);
  await boss.work(
    JOBS.tiktokPublish,
    { batchSize: 1, includeMetadata: true },
    async ([job]: JobWithMetadata<TiktokPublishJob>[]) => {
      if (!job) return;
      const jobLog = log.child({ job: JOBS.tiktokPublish, id: job.id, postId: job.data.postId });
      const onFailed = ({ postId, error }: { postId: string; error: string }) =>
        events.postFailed({ what: "publish", postId, id: job.id, error });
      try {
        const outcome = await publishToTiktok(
          {
            db,
            log: jobLog,
            client: tiktokClient,
            mediaBaseUrl,
            jpegFromPng,
            notify: notifier.notify,
            onFailed,
            appUrl: notifier.appUrl,
          },
          job.data,
        );
        jobLog.info("tiktok job finished", { outcome });
      } catch (error) {
        const lastTry = job.retryCount >= tiktokRetries;
        jobLog.error("tiktok publish error", { error, attempt: job.retryCount + 1, lastTry });
        // Out of retries: the post leaves `publishing` as failed, and the operator is told.
        if (lastTry) {
          await failTiktokPublish(
            { db, log: jobLog, onFailed },
            job.data.postId,
            errorMessage(error),
          );
        }
        throw error;
      }
    },
  );

  // Scheduled posts: queued by the web for their time (startAfter). A post whose job is gone or
  // stale is not published: the job checks its planned time first.
  await boss.createQueue(JOBS.postPublish, QUEUE_OPTIONS[JOBS.postPublish]);
  await boss.work(
    JOBS.postPublish,
    { batchSize: 1, includeMetadata: true },
    async ([job]: JobWithMetadata<PostPublishJob>[]) => {
      if (!job) return;
      const jobLog = log.child({ job: JOBS.postPublish, id: job.id, postId: job.data.postId });
      try {
        const outcome = await publishPost(
          {
            db,
            log: jobLog,
            notify: notifier.notify,
            appUrl: notifier.appUrl,
            queueTiktok: async (postId) => {
              await boss.send(
                JOBS.tiktokPublish,
                { postId },
                { singletonKey: tiktokPublishKey(postId) },
              );
            },
          },
          job.data,
        );
        jobLog.info("publish job finished", { outcome });
      } catch (error) {
        jobLog.error("publish failed", { error, attempt: job.retryCount + 1 });
        await events.postFailed({
          what: "publish",
          postId: job.data.postId,
          id: job.id,
          error: errorMessage(error),
        });
        throw error;
      }
    },
  );

  // Daily renewal of the connected accounts' tokens (phase 5 T8), at night in Buenos Aires.
  await boss.createQueue(JOBS.tokensRefresh, QUEUE_OPTIONS[JOBS.tokensRefresh]);
  await boss.work(
    JOBS.tokensRefresh,
    { batchSize: 1, includeMetadata: true },
    async ([job]: JobWithMetadata<object>[]) => {
      if (!job) return;
      await refreshTokens({
        db,
        log: log.child({ job: JOBS.tokensRefresh, id: job.id }),
        client: tiktokClient,
        notify: notifier.notify,
        appUrl: notifier.appUrl,
      });
    },
  );
  await boss.schedule(
    JOBS.tokensRefresh,
    TOKENS_REFRESH_CRON,
    {},
    { tz: DATA_REFRESH_TZ, key: "tokens-refresh" },
  );

  // Automatic filling: every 15 min by cron; it only acts inside the generation window (Settings).
  // One run at a time (a single cron job per tick, one worker at a time on it).
  await boss.createQueue(JOBS.slotsFill, QUEUE_OPTIONS[JOBS.slotsFill]);
  await boss.work(
    JOBS.slotsFill,
    { batchSize: 1, includeMetadata: true },
    async ([job]: JobWithMetadata<object>[]) => {
      if (!job) return;
      const jobLog = log.child({ job: JOBS.slotsFill, id: job.id });
      const outcome = await fillSlots({
        db,
        log: jobLog,
        queueGenerate: (postId) => queueGenerate({ postId, attempt: 0 }, 0),
        queueIdeaRequest: async (task, requestId) => {
          await boss.send(task, { requestId }, { singletonKey: ideaRequestKey(requestId) });
        },
        notify: (notice) => notifier.notify(notice),
      });
      if (outcome === "outside-window") jobLog.debug("slots fill: outside the window");
      else jobLog.info("slots fill finished", { brands: outcome.brands });
    },
  );
  await boss.schedule(JOBS.slotsFill, SLOTS_FILL_CRON, {}, { key: "slots-fill" });

  // Sending notices: one at a time, retried apart from the job that raised them.
  await boss.work(
    JOBS.notifySend,
    { batchSize: 1, includeMetadata: true },
    async ([job]: JobWithMetadata<NotifySendJob>[]) => {
      if (!job) return;
      const jobLog = log.child({ job: JOBS.notifySend, id: job.id });
      const outcome = await sendNotification(
        { db, log: jobLog, send: telegram ? telegramSender(telegram) : null },
        job.data,
      );
      jobLog.debug("notify finished", { outcome });
    },
  );
  await boss.work(JOBS.reviewNotify, { batchSize: 1 }, async () => {
    await notifyReview({
      db,
      appUrl: notifier.appUrl,
      queueSend: async (notificationId) => {
        await boss.send(
          JOBS.notifySend,
          { notificationId },
          { singletonKey: `notify:${notificationId}` },
        );
      },
    });
  });

  log.info("worker ready", {
    schema: "pgboss",
    schemaVersion: await boss.schemaVersion(),
    queues: [
      JOBS.carouselGenerate,
      JOBS.artGenerate,
      JOBS.carouselRender,
      JOBS.slideRewrite,
      ...IDEA_REQUEST_TASKS,
      JOBS.dataRefresh,
      JOBS.postPublish,
      JOBS.tiktokPublish,
      JOBS.tokensRefresh,
      JOBS.slotsFill,
      JOBS.notifySend,
      JOBS.reviewNotify,
    ],
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
