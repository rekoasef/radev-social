// Jobs the web queues and the worker runs (pg-boss, docs/ARCHITECTURE.md §6). Names and payloads
// live here so both apps agree without depending on each other (CLAUDE.md, rule 1).

export const JOBS = {
  /** Render every slide of a version to PNG, run the render QA and register the files. */
  carouselRender: "carousel.render",
  /** Rewrite one slide of a carousel from the editor, as a proposal the operator accepts. */
  slideRewrite: "slide.rewrite",
  /** Generate the images of a version's cover and close (ADR 0016), then queue its render. */
  artGenerate: "art.generate",
  /** Write a carousel with AI for a post that is `generating` (docs/ARCHITECTURE.md §7). */
  carouselGenerate: "carousel.generate",
  /** Propose ideas for a brand's bank from its pillars and history (free model). */
  ideasGenerate: "ideas.generate",
  /** Look into the brand's niche with web search and bring topics as ideas (Claude). */
  ideasResearch: "ideas.research",
  /** Fetch today's data of a source (Bluelytics) and store it as a snapshot. */
  dataRefresh: "data.refresh",
  /** At a scheduled post's time: publish it through its adapter (manual: wait for the operator). */
  postPublish: "post.publish",
  /**
   * A post of a brand with TikTok connected, already `publishing`: send it to TikTok and follow
   * it until TikTok takes it (inbox draft or published) or fails (phase 5 T6).
   */
  tiktokPublish: "tiktok.publish",
  /**
   * Daily: renews the tokens of every connected account, so one that goes weeks without posting
   * doesn't lose its access, and a revoked one is found before its next post (phase 5 T8).
   */
  tokensRefresh: "tokens.refresh",
  /**
   * Every few hours and from "Actualizar ahora": the connected accounts' totals and every post's
   * counts, linking our posts to the network's (phase 6).
   */
  metricsSync: "metrics.sync",
  /** Every 15 min: inside the generation window, give free slots a post for the AI (phase 4, T4). */
  slotsFill: "slots.fill",
  /** Tell the operator the posts that got to review, in one Telegram message (phase 4, T6). */
  reviewNotify: "review.notify",
  /** Send one stored notification to Telegram (retried apart from the job that raised it). */
  notifySend: "notify.send",
} as const;

export type CarouselRenderJob = { versionId: string };

/** A `slide_rewrites` row holds what to rewrite (the carousel as the editor had it). */
export type SlideRewriteJob = { requestId: string };

export const SLIDE_REWRITE_STATUSES = ["queued", "running", "done", "failed"] as const;
export type SlideRewriteStatus = (typeof SLIDE_REWRITE_STATUSES)[number];

/** `fresh`: new images even if an earlier version has them for the same prompt. */
export type ArtGenerateJob = { versionId: string; fresh?: boolean };

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
};

/** A source's refresh: by the daily cron or by "Actualizar ahora" in the panel. */
export type DataRefreshJob = { source: string };

/** When the daily refresh runs (cron, in DATA_REFRESH_TZ): Bluelytics updates during the day. */
export const DATA_REFRESH_CRON = "0 19 * * *";
export const DATA_REFRESH_TZ = "America/Argentina/Buenos_Aires";

/** When the daily token renewal runs (cron, in DATA_REFRESH_TZ): at night, away from the posts. */
export const TOKENS_REFRESH_CRON = "30 4 * * *";

/** Both idea jobs run an `idea_requests` row that holds their parameters. */
export type IdeaRequestJob = { requestId: string };

/**
 * Queue settings, the same wherever the queue is created (the worker on start, the web before its
 * first send). Retries back off from 10 s.
 */
export const QUEUE_OPTIONS = {
  [JOBS.carouselRender]: { retryLimit: 2, retryDelay: 10, retryBackoff: true },
  // Like a carousel, shorter: one slide. The operator is waiting in the editor.
  [JOBS.slideRewrite]: { retryLimit: 1, retryDelay: 30, expireInSeconds: 10 * 60 },
  // Never retried: the job settles every failure itself (the post renders without images).
  [JOBS.artGenerate]: { retryLimit: 0, expireInSeconds: 5 * 60 },
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
  // TikTok down, its rate limit (6 posts/min per account) or still processing the photos: tried
  // again from 30 s for about 8 min. The publish id is saved first, so a retry follows the same
  // post instead of sending another one.
  [JOBS.tiktokPublish]: {
    retryLimit: 4,
    retryDelay: 30,
    retryBackoff: true,
    expireInSeconds: 10 * 60,
  },
  // TikTok down: tried again twice, 10 min apart; the next day's run is the real retry.
  [JOBS.tokensRefresh]: { retryLimit: 2, retryDelay: 600, expireInSeconds: 10 * 60 },
  // TikTok down or its rate limit: two more tries 5 min apart; the next run (4 h) is the real one.
  [JOBS.metricsSync]: { retryLimit: 2, retryDelay: 300, expireInSeconds: 15 * 60 },
  // Only database work and queueing; the next run (15 min) is the retry.
  [JOBS.slotsFill]: { retryLimit: 0, expireInSeconds: 10 * 60 },
  [JOBS.reviewNotify]: { retryLimit: 2, retryDelay: 60 },
  // Telegram down for a while: keep trying for about an hour.
  [JOBS.notifySend]: { retryLimit: 6, retryDelay: 60, retryBackoff: true },
} as const;

/**
 * Key of a version's render job. The job is idempotent on its own (rule 8): it only runs for the
 * current version of a post that is `rendering`, so a second copy finds nothing to do.
 */
export const carouselRenderKey = (versionId: string) => `render:${versionId}`;

/** Key of a rewrite's job: one per request (the job skips a request that is not queued). */
export const slideRewriteKey = (requestId: string) => `rewrite:${requestId}`;

/** Key of a version's image job: the job only acts on art that is still `pending` (rule 8). */
export const artGenerateKey = (versionId: string) => `art:${versionId}`;

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

export type TiktokPublishJob = { postId: string };

/** Key of a post's TikTok job: one at a time per post (it only acts on a pending publication). */
export const tiktokPublishKey = (postId: string) => `tiktok:${postId}`;

/** All the connected accounts; one sync waiting at a time, the job only upserts (rule 8). */
export const METRICS_SYNC_KEY = "metrics-sync";

export type NotifySendJob = { notificationId: string };

/** One review notice waiting at a time: more posts reaching review join it. */
export const REVIEW_NOTIFY_KEY = "review-notify";
