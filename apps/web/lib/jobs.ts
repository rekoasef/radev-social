import "server-only";
import {
  carouselGenerateKey,
  carouselRenderKey,
  type DataSource,
  dataRefreshKey,
  IDEA_REQUEST_TASKS,
  type IdeaRequestTask,
  ideaRequestKey,
  JOBS,
  type PostEffect,
  type PostPublishJob,
  postPublishKey,
  QUEUE_OPTIONS,
} from "@radev/core";
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
    await client.createQueue(JOBS.carouselGenerate, QUEUE_OPTIONS[JOBS.carouselGenerate]);
    for (const task of IDEA_REQUEST_TASKS) await client.createQueue(task, QUEUE_OPTIONS[task]);
    await client.createQueue(JOBS.dataRefresh, QUEUE_OPTIONS[JOBS.dataRefresh]);
    await client.createQueue(JOBS.postPublish, QUEUE_OPTIONS[JOBS.postPublish]);
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

/** What a transition asks the queue to undo (state machine effects). */
export async function applyPostEffects(postId: string, effects: readonly PostEffect[]) {
  if (effects.includes("cancel_publish_job")) await cancelPublish(postId);
}
