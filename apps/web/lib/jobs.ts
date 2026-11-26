import "server-only";
import {
  artGenerateKey,
  carouselGenerateKey,
  carouselRenderKey,
  type DataSource,
  dataRefreshKey,
  IDEA_REQUEST_TASKS,
  type IdeaRequestTask,
  ideaRequestKey,
  JOBS,
  METRICS_SYNC_KEY,
  type NotifySendJob,
  OFFICE_JOB,
  type PostArt,
  type PostEffect,
  type PostPublishJob,
  postPublishKey,
  QUEUE_OPTIONS,
  slideRewriteKey,
  type TiktokPublishJob,
  tiktokPublishKey,
  VIDEO_JOBS,
  VIDEO_QUEUE_OPTIONS,
  type VideoIdeasJob,
  type VideoOfficeJob,
  type VideoPinJob,
  type VideoPinResult,
  videoOfficeKey,
  WORKING_STAGES,
  type WorkingStage,
} from "@radev/core";
import { versionTakesArt } from "@radev/slides";
import { PgBoss } from "pg-boss";
import { requireEnv } from "./env";

// The web only queues jobs; the worker runs them (CLAUDE.md, rule 5). A pg-boss client without
// maintenance or schema work: the worker owns that.

const globalForBoss = globalThis as unknown as { radevBoss?: Promise<PgBoss> };

function boss(): Promise<PgBoss> {
  globalForBoss.radevBoss ??= (async () => {
    const client = new PgBoss({
      connectionString: requireEnv("DATABASE_URL"),
      schema: "pgboss",
      application_name: "radev-web",
      supervise: false,
      migrate: false,
      createSchema: false,
    });
    client.on("error", (error) => console.error("pg-boss (web):", error));
    await client.start();
    // Idempotent: lets the web queue before the worker has ever started.
    await client.createQueue(JOBS.carouselRender, QUEUE_OPTIONS[JOBS.carouselRender]);
    await client.createQueue(JOBS.artGenerate, QUEUE_OPTIONS[JOBS.artGenerate]);
    await client.createQueue(JOBS.slideRewrite, QUEUE_OPTIONS[JOBS.slideRewrite]);
    await client.createQueue(JOBS.carouselGenerate, QUEUE_OPTIONS[JOBS.carouselGenerate]);
    for (const task of IDEA_REQUEST_TASKS) await client.createQueue(task, QUEUE_OPTIONS[task]);
    await client.createQueue(JOBS.dataRefresh, QUEUE_OPTIONS[JOBS.dataRefresh]);
    await client.createQueue(JOBS.postPublish, QUEUE_OPTIONS[JOBS.postPublish]);
    await client.createQueue(JOBS.tiktokPublish, QUEUE_OPTIONS[JOBS.tiktokPublish]);
    await client.createQueue(JOBS.notifySend, QUEUE_OPTIONS[JOBS.notifySend]);
    await client.createQueue(JOBS.metricsSync, QUEUE_OPTIONS[JOBS.metricsSync]);
    for (const stage of WORKING_STAGES) {
      const name = OFFICE_JOB[stage];
      await client.createQueue(name, VIDEO_QUEUE_OPTIONS[name]);
    }
    await client.createQueue(VIDEO_JOBS.pin, VIDEO_QUEUE_OPTIONS[VIDEO_JOBS.pin]);
    await client.createQueue(VIDEO_JOBS.ideas, VIDEO_QUEUE_OPTIONS[VIDEO_JOBS.ideas]);
    return client;
  })();
  return globalForBoss.radevBoss;
}

/** Queues the render of a version. A duplicate is harmless: the job skips what is not rendering. */
export async function queueRender(versionId: string): Promise<void> {
  await (await boss()).send(
    JOBS.carouselRender,
    { versionId },
    { singletonKey: carouselRenderKey(versionId) },
  );
}

/**
 * The images a new version starts with (ADR 0016): pending when its look takes them, so the
 * worker generates them (or reuses an earlier version's) before the render. Null otherwise.
 */
export function artFor(
  brand: { stylePreset: string; themeTokens: unknown },
  content: { look?: string; art?: unknown },
): PostArt | null {
  return versionTakesArt(brand.stylePreset, content, brand.themeTokens)
    ? { status: "pending", images: {} }
    : null;
}

/**
 * After saving a version: its images first when they are pending (art.generate queues the render
 * when it is done), the render otherwise. `fresh`: new images even for an unchanged prompt.
 */
export async function queueVersion(
  version: { id: string; art: PostArt | null },
  options: { fresh?: boolean } = {},
): Promise<void> {
  if (version.art?.status !== "pending") {
    await queueRender(version.id);
    return;
  }
  await (await boss()).send(
    JOBS.artGenerate,
    { versionId: version.id, fresh: options.fresh ?? false },
    { singletonKey: artGenerateKey(version.id) },
  );
}

/** Queues a slide rewrite asked from the editor (the request row holds what to rewrite). */
export async function queueSlideRewrite(requestId: string): Promise<void> {
  await (await boss()).send(
    JOBS.slideRewrite,
    { requestId },
    { singletonKey: slideRewriteKey(requestId) },
  );
}

/** Queues the AI generation of a post that is `generating`. A duplicate finds nothing to do. */
export async function queueGenerate(postId: string): Promise<void> {
  await (await boss()).send(
    JOBS.carouselGenerate,
    { postId, attempt: 0 },
    { singletonKey: carouselGenerateKey(postId, 0) },
  );
}

/** Queues an idea request (ideas.generate or ideas.research). The job skips a closed request. */
export async function queueIdeaRequest(task: IdeaRequestTask, requestId: string): Promise<void> {
  await (await boss()).send(task, { requestId }, { singletonKey: ideaRequestKey(requestId) });
}

/** Queues a refresh of a data source ("Actualizar ahora"). One waiting at a time per source. */
export async function queueDataRefresh(source: DataSource): Promise<void> {
  await (await boss()).send(JOBS.dataRefresh, { source }, { singletonKey: dataRefreshKey(source) });
}

/** Queues a metrics read of every connected account ("Actualizar ahora"). One waiting at a time. */
export async function queueMetricsSync(): Promise<void> {
  await (await boss()).send(JOBS.metricsSync, {}, { singletonKey: METRICS_SYNC_KEY });
}

/**
 * Cancels a post's queued publish job, if there is one (unscheduling, rescheduling, editing). The
 * job checks the post's planned time anyway, so a copy that slips through does nothing.
 */
export async function cancelPublish(postId: string): Promise<void> {
  const client = await boss();
  const queued = await client.findJobs(JOBS.postPublish, {
    key: postPublishKey(postId),
    queued: true,
  });
  if (queued.length > 0) {
    await client.cancel(
      JOBS.postPublish,
      queued.map((job) => job.id),
    );
  }
}

/** Queues a scheduled post's publish job for its time; a job queued before is cancelled first. */
export async function queuePublish(postId: string, at: Date): Promise<void> {
  await cancelPublish(postId);
  const data: PostPublishJob = { postId, scheduledAt: at.toISOString() };
  await (await boss()).send(JOBS.postPublish, data, {
    singletonKey: postPublishKey(postId),
    startAfter: at,
  });
}

/** Sends a post that is `publishing` with a pending TikTok publication (phase 5 T6). */
export async function queueTiktokPublish(postId: string): Promise<void> {
  const data: TiktokPublishJob = { postId };
  await (await boss()).send(JOBS.tiktokPublish, data, { singletonKey: tiktokPublishKey(postId) });
}

/** What a transition asks the queue to undo (state machine effects). */
export async function applyPostEffects(postId: string, effects: readonly PostEffect[]) {
  if (effects.includes("cancel_publish_job")) await cancelPublish(postId);
}

/** Hands a stored notification to the worker, which sends it to Telegram (phase 4, T6). */
export async function queueNotification(notificationId: string): Promise<void> {
  const data: NotifySendJob = { notificationId };
  await (await boss()).send(JOBS.notifySend, data, { singletonKey: `notify:${notificationId}` });
}

/**
 * Runs a failed job again (the jobs view, phase 4, T8): pg-boss puts it back in the queue with
 * the same data. The caller checks first that it makes sense (canRetryJob, packages/core).
 */
export async function retryJob(name: string, id: string): Promise<void> {
  await (await boss()).retry(name, id);
}

/** Sends a video to the office of its stage (the video-worker runs it). */
export async function queueVideoOffice(videoId: string, stage: WorkingStage): Promise<void> {
  const data: VideoOfficeJob = { videoId, stage, limitAttempt: 0 };
  await (await boss()).send(OFFICE_JOB[stage], data, { singletonKey: videoOfficeKey(data) });
}

/** Asks the video-worker to add a Commons image to a video's sheet. Returns the job's id. */
export async function queuePinImage(videoId: string, title: string): Promise<string | null> {
  const data: VideoPinJob = { videoId, title };
  return (await boss()).send(VIDEO_JOBS.pin, data);
}

/** Queues a request for topic ideas: the video-worker answers it. */
export async function queueVideoIdeas(requestId: string): Promise<void> {
  const data: VideoIdeasJob = { requestId };
  await (await boss()).send(VIDEO_JOBS.ideas, data);
}

export type PinStatus = { state: "waiting" } | { state: "done"; result: VideoPinResult };

/** How a pin request went, from pg-boss (the job's output). */
export async function pinStatus(videoId: string, jobId: string): Promise<PinStatus> {
  const [job] = await (await boss()).findJobs<VideoPinJob>(VIDEO_JOBS.pin, { id: jobId });
  const failed = (message: string): PinStatus => ({
    state: "done",
    result: { ok: false, message },
  });
  if (!job || job.data.videoId !== videoId) return failed("No encuentro ese pedido.");
  if (job.state === "completed") {
    return { state: "done", result: job.output as unknown as VideoPinResult };
  }
  if (job.state === "failed" || job.state === "cancelled") {
    return failed("No se pudo bajar la imagen. Probá de nuevo.");
  }
  return { state: "waiting" };
}
