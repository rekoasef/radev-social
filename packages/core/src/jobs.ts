// Jobs the web queues and the worker runs (pg-boss, docs/ARCHITECTURE.md §6). Names and payloads
// live here so both apps agree without depending on each other (CLAUDE.md, rule 1).

export const JOBS = {
  /** Render every slide of a version to PNG, run the render QA and register the files. */
  carouselRender: "carousel.render",
} as const;

export type CarouselRenderJob = { versionId: string };

/**
 * Queue settings, the same wherever the queue is created (the worker on start, the web before its
 * first send). Retries back off from 10 s.
 */
export const QUEUE_OPTIONS = {
  [JOBS.carouselRender]: { retryLimit: 2, retryDelay: 10, retryBackoff: true },
} as const;

/**
 * Key of a version's render job. The job is idempotent on its own (rule 8): it only runs for the
 * current version of a post that is `rendering`, so a second copy finds nothing to do.
 */
export const carouselRenderKey = (versionId: string) => `render:${versionId}`;
