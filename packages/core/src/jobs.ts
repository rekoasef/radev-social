// Jobs the web queues and the worker runs (pg-boss, docs/ARCHITECTURE.md §6). Names and payloads
// live here so both apps agree without depending on each other (CLAUDE.md, rule 1).

export const JOBS = {
  /** Render every slide of a version to PNG, run the render QA and register the files. */
  carouselRender: "carousel.render",
  /** Write a carousel with AI for a post that is `generating` (docs/ARCHITECTURE.md §7). */
  carouselGenerate: "carousel.generate",
  /** Propose ideas for a brand's bank from its pillars, series and history (free model). */
  ideasGenerate: "ideas.generate",
  /** Look into the brand's niche with web search and bring topics as ideas (Claude). */
  ideasResearch: "ideas.research",
  /** Fetch today's data of a source (Bluelytics) and store it as a snapshot. */
  dataRefresh: "data.refresh",
  /** At a scheduled post's time: publish it through its adapter (manual: wait for the operator). */
  postPublish: "post.publish",
  /** Every 15 min: inside the generation window, give free slots a post for the AI (phase 4, T4). */
  slotsFill: "slots.fill",
} as const;

export type CarouselRenderJob = { versionId: string };

/**
 * `attempt` counts the reschedules after a provider's limit (0 the first time): it sets the next
 * backoff (rateLimitDelayMs).
 */
export type CarouselGenerateJob = { postId: string; attempt: number };

/** What the operator asked for, stored on the post so a retry or a regeneration can reuse it. */
export type GenerationRequest = {
  idea: string;
  /** Null: the AI picks one of the brand's pillars. */
  pillarKey: string | null;
  /** Suggested hook type (a HOOK_TYPES value of packages/slides); null lets the AI choose. */
  hookType: string | null;
  /** A series of the brand: its structure and required slides apply. Absent in older requests. */
  seriesKey?: string | null;
};

/** A source's refresh: by the daily cron or by "Actualizar ahora" in the panel. */
export type DataRefreshJob = { source: string };

/** When the daily refresh runs (cron, in DATA_REFRESH_TZ): Bluelytics updates during the day. */
export const DATA_REFRESH_CRON = "0 19 * * *";
export const DATA_REFRESH_TZ = "America/Argentina/Buenos_Aires";

/** Both idea jobs run an `idea_requests` row that holds their parameters. */
export type IdeaRequestJob = { requestId: string };

/**
 * Queue settings, the same wherever the queue is created (the worker on start, the web before its
 * first send). Retries back off from 10 s.
 */
export const QUEUE_OPTIONS = {
  [JOBS.carouselRender]: { retryLimit: 2, retryDelay: 10, retryBackoff: true },
  // A run can take a while: claude -p up to 5 min, the fallback up to 2, and one more try when
  // the answer comes malformed. Provider errors worth retrying get 2 more attempts from 1 min.
  [JOBS.carouselGenerate]: {
    retryLimit: 2,
    retryDelay: 60,
    retryBackoff: true,
    expireInSeconds: 20 * 60,
  },
  // Like a carousel: the free model up to 2 min, Claude as fallback up to 5, and one more try
  // when the answer comes malformed. Research with web search runs up to 10 min per try.
  [JOBS.ideasGenerate]: {
    retryLimit: 2,
    retryDelay: 60,
    retryBackoff: true,
    expireInSeconds: 20 * 60,
  },
  [JOBS.ideasResearch]: {
    retryLimit: 1,
    retryDelay: 120,
    retryBackoff: true,
    expireInSeconds: 25 * 60,
  },
  // Two HTTP requests; a failed day is tried again a few minutes later.
  [JOBS.dataRefresh]: { retryLimit: 3, retryDelay: 300, retryBackoff: true },
  // Quick (the manual adapter only marks it); a network hiccup is tried again soon.
  [JOBS.postPublish]: { retryLimit: 3, retryDelay: 60, retryBackoff: true },
  // Only database work and queueing; the next run (15 min) is the retry.
  [JOBS.slotsFill]: { retryLimit: 0, expireInSeconds: 10 * 60 },
} as const;

/**
 * Key of a version's render job. The job is idempotent on its own (rule 8): it only runs for the
 * current version of a post that is `rendering`, so a second copy finds nothing to do.
 */
export const carouselRenderKey = (versionId: string) => `render:${versionId}`;

/**
 * Key of a post's generation job. One attempt at a time: the job itself only runs for a post
 * that is `generating`, so a duplicate finds nothing to do (rule 8).
 */
export const carouselGenerateKey = (postId: string, attempt: number) =>
  `generate:${postId}:${attempt}`;

/** Key of an idea request's job: one per request (the job skips a request that is not queued). */
export const ideaRequestKey = (requestId: string) => `ideas:${requestId}`;

/**
 * Key of a refresh job: at most one waiting per source. The job itself is idempotent too: it
 * replaces the snapshot of the same day (rule 8).
 */
export const dataRefreshKey = (source: string) => `data:${source}`;

/**
 * Key of a post's publish job: one queued per post. Unscheduling finds it by this key to cancel
 * it; the job also checks the post's planned time, so a stale copy never publishes (rule 8).
 */
export const postPublishKey = (postId: string) => `publish:${postId}`;
