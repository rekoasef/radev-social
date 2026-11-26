import type { WorkingStage } from "./constants";

// Jobs of the video-worker (pg-boss, docs/ARCHITECTURE.md §14.1): one queue per office. Names and
// payloads live here so the web and the worker agree without depending on each other (rule 1).

export const VIDEO_JOBS = {
  research: "video.research",
  sources: "video.sources",
  images: "video.images",
  script: "video.script",
  review: "video.review",
  voice: "video.voice",
  render: "video.render",
  package: "video.package",
  /** Adds a Commons image the operator asked for (script desk). Not an office. */
  pin: "video.pin",
  /** Cron: queues again the videos at a working stage that have no job (a lost send). */
  sweep: "video.sweep",
} as const;

export type VideoJobName = (typeof VIDEO_JOBS)[keyof typeof VIDEO_JOBS];

/** The queue of each office. */
export const OFFICE_JOB = {
  researching: VIDEO_JOBS.research,
  checking_sources: VIDEO_JOBS.sources,
  finding_images: VIDEO_JOBS.images,
  scripting: VIDEO_JOBS.script,
  checking_facts: VIDEO_JOBS.review,
  voicing: VIDEO_JOBS.voice,
  rendering: VIDEO_JOBS.render,
  packaging: VIDEO_JOBS.package,
} as const satisfies Record<WorkingStage, VideoJobName>;

/**
 * `stage`: the stage the job was queued for. If the video is no longer there when the job runs, the
 * job does nothing (rule 8). `limitAttempt` counts the reschedules after Claude's limit (0 the
 * first time): it sets the next backoff (rateLimitDelayMs).
 */
export type VideoOfficeJob = { videoId: string; stage: WorkingStage; limitAttempt: number };

/** One job per video, stage and attempt: sending it twice queues it once. */
export const videoOfficeKey = (job: VideoOfficeJob) =>
  `video:${job.videoId}:${job.stage}:${job.limitAttempt}`;

export type VideoPinJob = { videoId: string; title: string };
/** What the job leaves as its output, for the desk that asked. */
export type VideoPinResult =
  | { ok: true; imageId: string; message: string }
  | { ok: false; message: string };

/** Every 10 minutes. */
export const VIDEO_SWEEP_CRON = "*/10 * * * *";

/** Queue settings, the same wherever the queue is created. Times in seconds. */
export const VIDEO_QUEUE_OPTIONS = {
  // Web search with up to 40 turns, 15 min per try, and a second try for a dossier with test data.
  [VIDEO_JOBS.research]: {
    retryLimit: 1,
    retryDelay: 120,
    retryBackoff: true,
    expireInSeconds: 40 * 60,
  },
  // Downloads every page of the dossier, 20 s each at most.
  [VIDEO_JOBS.sources]: {
    retryLimit: 2,
    retryDelay: 60,
    retryBackoff: true,
    expireInSeconds: 15 * 60,
  },
  // Two AI steps, ~40 searches and ~35 downloads, paused between calls: can take 15 minutes.
  [VIDEO_JOBS.images]: {
    retryLimit: 1,
    retryDelay: 120,
    retryBackoff: true,
    expireInSeconds: 45 * 60,
  },
  // Up to 3 internal tries of 10 min.
  [VIDEO_JOBS.script]: {
    retryLimit: 1,
    retryDelay: 60,
    retryBackoff: true,
    expireInSeconds: 35 * 60,
  },
  [VIDEO_JOBS.review]: {
    retryLimit: 1,
    retryDelay: 60,
    retryBackoff: true,
    expireInSeconds: 15 * 60,
  },
  // T8: the voice (one request), the render of both formats (~8 min) and the package.
  [VIDEO_JOBS.voice]: {
    retryLimit: 1,
    retryDelay: 60,
    retryBackoff: true,
    expireInSeconds: 15 * 60,
  },
  [VIDEO_JOBS.render]: {
    retryLimit: 1,
    retryDelay: 60,
    retryBackoff: true,
    expireInSeconds: 40 * 60,
  },
  [VIDEO_JOBS.package]: {
    retryLimit: 1,
    retryDelay: 60,
    retryBackoff: true,
    expireInSeconds: 20 * 60,
  },
  // One search and one download, with Commons' pauses and retries.
  [VIDEO_JOBS.pin]: { retryLimit: 1, retryDelay: 30, expireInSeconds: 10 * 60 },
  [VIDEO_JOBS.sweep]: { retryLimit: 0 },
} as const satisfies Record<
  VideoJobName,
  { retryLimit: number; retryDelay?: number; retryBackoff?: boolean; expireInSeconds?: number }
>;
