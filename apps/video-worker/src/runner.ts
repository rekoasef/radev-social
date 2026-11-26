import {
  OFFICE_JOB,
  type ProgressPatch,
  pauseEnded,
  rateLimitDelayMs,
  type VideoFailure,
  type VideoOfficeJob,
  type VideoProgress,
  WORKING_STAGES,
  type WorkingStage,
} from "@radev/core";
import { rowCondition, type Video, type VideoTransitionOutcome } from "@radev/db";
import type { Logger } from "./logger";
import { type Office, type OfficeContext, OfficeFailure, type OfficeResult } from "./office";

// The runner is the only piece that knows the assembly line (docs/ARCHITECTURE.md §14.1): it
// checks the video is still where the job left it (rule 8), runs the office, saves its documents
// and advances the stage in one transaction, and queues the next office. A usage limit of Claude
// pauses the video and queues the same job for later, without spending the queue's retries.

/** Reschedules after Claude's limit before giving up (15 min … 4 h: about 17 h, like the posts). */
export const MAX_LIMIT_ATTEMPTS = 8;

/** One run of an office, for its history. */
export type OfficeRun = {
  stage: WorkingStage;
  durationMs: number;
  outcome: "done" | "pause" | "rate_limited" | "failed";
};

export type RunnerStore = {
  getVideo(id: string): Promise<Video | null>;
  resume(id: string): Promise<void>;
  pauseForLimit(id: string, resumeAt: Date): Promise<void>;
  /** A pause that only the operator lifts (no credits left). */
  pauseForBudget(id: string): Promise<void>;
  /** Saves the documents and moves the video to the next stage, all or nothing. */
  complete(
    videoId: string,
    result: Extract<OfficeResult, { kind: "done" }>,
  ): Promise<VideoTransitionOutcome>;
  fail(id: string, failure: VideoFailure): Promise<void>;
  progress(id: string, progress: VideoProgress): Promise<void>;
  officeRun(id: string, run: OfficeRun): Promise<void>;
};

export type RunnerDeps = {
  store: RunnerStore;
  /** Queues an office's job to run after `delaySeconds`. */
  queue(job: VideoOfficeJob, delaySeconds: number): Promise<void>;
  /** The offices that exist: a stage without one waits (the later offices arrive in T8). */
  offices: Partial<Record<WorkingStage, Office>>;
  makeContext(video: Video): Omit<OfficeContext, "progress">;
  now(): Date;
  log: Logger;
  /** The last try pg-boss will give this job: a failure is recorded on the video. */
  lastTry: boolean;
};

export type RunOutcome =
  | "skipped" // the job is stale, or the video is paused or failed (rule 8)
  | "no-office" // the stage has no office yet
  | "completed"
  | "paused" // Claude's limit
  | "failed"; // recorded on the video (the operator retries it)

const isWorking = (stage: string): stage is WorkingStage =>
  (WORKING_STAGES as readonly string[]).includes(stage);

export async function runOffice(deps: RunnerDeps, job: VideoOfficeJob): Promise<RunOutcome> {
  const { store, log } = deps;
  const now = deps.now();
  let video = await store.getVideo(job.videoId);
  if (!video) return "skipped";
  // A stale or repeated job: the video already moved on (or was discarded). Nothing to do.
  if (video.stage !== job.stage) {
    log.info("job skipped: the video is at another stage", {
      stage: video.stage,
      wanted: job.stage,
    });
    return "skipped";
  }
  const condition = rowCondition(video);
  // A pause by the limit that already ended is lifted here: the rescheduled job is the one that runs.
  if (condition.pausedAt && pauseEnded(condition, now)) {
    await store.resume(video.id);
    video = (await store.getVideo(job.videoId)) ?? video;
  } else if (condition.pausedAt || condition.failure) {
    log.info("job skipped: the video is paused or failed", {
      paused: condition.pausedAt !== null,
      failed: condition.failure !== null,
    });
    return "skipped";
  }

  const office = deps.offices[job.stage];
  if (!office) {
    log.warn("this stage has no office yet", { stage: job.stage });
    return "no-office";
  }

  // What the studio shows while it works, and the history of the office afterwards. Neither one
  // may break the work: their errors are only logged.
  const videoId = video.id;
  let progress: VideoProgress = { stage: job.stage, startedAt: now.toISOString() };
  const report = async (patch: ProgressPatch = {}) => {
    progress = { ...progress, ...patch };
    await store
      .progress(videoId, progress)
      .catch((error) => log.warn("progress not saved", { error }));
  };
  const record = (outcome: OfficeRun["outcome"]) =>
    store
      .officeRun(videoId, {
        stage: job.stage,
        durationMs: Math.max(0, deps.now().getTime() - now.getTime()),
        outcome,
      })
      .catch((error) => log.warn("office run not recorded", { error }));

  await report();
  let result: OfficeResult;
  try {
    result = await office({ ...deps.makeContext(video), progress: report });
  } catch (error) {
    await record("failed");
    const message = error instanceof Error ? error.message : String(error);
    // The operator has to step in (a missing route, a credential): trying again would not help.
    if (error instanceof OfficeFailure && !error.retryable) {
      await store.fail(video.id, { stage: job.stage, message, retryable: false, at: deps.now() });
      return "failed";
    }
    // Anything else: pg-boss retries it, and on the last try the failure is recorded.
    if (deps.lastTry) {
      await store.fail(video.id, { stage: job.stage, message, retryable: true, at: deps.now() });
    }
    throw error;
  }

  await record(result.kind);

  if (result.kind === "pause") {
    await store.pauseForBudget(video.id);
    log.warn("the video is paused until the operator steps in", {
      reason: result.reason,
      message: result.message,
    });
    return "paused";
  }

  if (result.kind === "rate_limited") {
    if (job.limitAttempt >= MAX_LIMIT_ATTEMPTS) {
      await store.fail(video.id, {
        stage: job.stage,
        message: "Claude sigue en su límite de uso después de varios intentos.",
        retryable: true,
        at: deps.now(),
      });
      return "failed";
    }
    const delayMs = rateLimitDelayMs(job.limitAttempt, result.retryAfterMs);
    await store.pauseForLimit(video.id, new Date(now.getTime() + delayMs));
    await deps.queue({ ...job, limitAttempt: job.limitAttempt + 1 }, Math.ceil(delayMs / 1000));
    log.warn("claude's limit: the video is paused", { delayMinutes: Math.round(delayMs / 60_000) });
    return "paused";
  }

  const outcome = await store.complete(video.id, result);
  if (!outcome.ok) {
    // Discarded or paused while the office worked: the documents were not saved either.
    log.warn("the office finished but the video could not advance", { reason: outcome.reason });
    return "skipped";
  }
  log.info("office done", { from: outcome.from, to: outcome.to });
  if (isWorking(outcome.to)) {
    await deps.queue({ videoId: video.id, stage: outcome.to, limitAttempt: 0 }, 0);
  }
  return "completed";
}

/** The queue name of a stage's job, for the sweep and the first send. */
export const queueOf = (stage: WorkingStage) => OFFICE_JOB[stage];
