import type { AIError } from "@radev/ai";
import type { ProgressPatch, VideoDocumentKind, VideoForm, WorkingStage } from "@radev/core";
import type { OfficeDocumentOut, Video } from "@radev/db";
import type { VideoAi } from "./ai";
import type { Logger } from "./logger";

// What an office is: a function from the video (and what its documents hold) to the documents it
// leaves. It knows nothing about queues, stages or retries: the runner does (runner.ts).

/** What an office gets besides the video. Everything with I/O is here, so tests can fake it. */
export type OfficeContext = {
  video: Video;
  log: Logger;
  ai: VideoAi;
  /** Tells the studio what the office is doing. Only information: it never fails the office. */
  progress(patch: ProgressPatch): Promise<void>;
  /** The current (highest) version of a document of this video, or null. */
  document(kind: VideoDocumentKind): Promise<unknown | null>;
  /** The forms of the latest other videos, so this one is told another way (ADR 0030). */
  recentForms(): Promise<VideoForm[]>;
  /** The voice of the video (its own, or the default narrator); null when there is none. */
  voice(): Promise<{ externalId: string; name: string; speed: number | null } | null>;
  /** Absolute path of the video's media folder (Remotion reads the images and audio from it). */
  mediaDir: string;
  /** The video's media folder (`media/videos/<id>/`): paths are relative to it. */
  files: {
    write(path: string, bytes: Uint8Array): Promise<void>;
    read(path: string): Promise<Uint8Array | undefined>;
  };
};

/** What an office spent, for the report of its desk (`usage_events`; cost is always 0 here). */
export type OfficeUsage = {
  kind: "tts" | "render";
  quantity: number;
  unit: string;
  durationMs?: number;
  data?: Record<string, unknown>;
};

export type OfficeResult =
  | { kind: "done"; documents: OfficeDocumentOut[]; title?: string; usage?: OfficeUsage[] }
  /** Nothing can go on until the operator steps in (out of voice credits): the video is paused. */
  | { kind: "pause"; reason: "budget"; message: string }
  /** The AI's usage limit: the runner pauses the video and tries again later. */
  | { kind: "rate_limited"; retryAfterMs: number | null };

export type Office = (ctx: OfficeContext) => Promise<OfficeResult>;

/**
 * The office could not do its job. `retryable`: trying again can work (a bad answer, a network
 * error); otherwise the operator has to step in (a missing route or credential).
 */
export class OfficeFailure extends Error {
  constructor(
    message: string,
    readonly retryable = true,
  ) {
    super(message);
    this.name = "OfficeFailure";
  }
}

/** The failure of an AI call as an office result: the limit pauses, anything else fails. */
export function failedAi(error: AIError, what: string): OfficeResult {
  if (error.kind === "rate_limited") {
    return { kind: "rate_limited", retryAfterMs: error.retryAfterMs };
  }
  const retryable = error.kind === "validation" ? true : error.retryable;
  throw new OfficeFailure(`${what}: ${error.message}`, retryable);
}

export type OfficeMap = Partial<Record<WorkingStage, Office>>;
