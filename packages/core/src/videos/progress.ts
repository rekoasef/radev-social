import { WORKING_STAGES, type WorkingStage } from "./constants";

// What an office is doing right now, for the studio (`videos.progress`). It is only information:
// nothing decides from it, and it is cleared when the video changes stage.

export type VideoProgress = {
  /** The office that wrote it: stale progress of another stage is ignored. */
  stage: WorkingStage;
  /** ISO date: when this run of the office started. */
  startedAt: string;
  /** Internal try of the office (Research, Script) and how many it has. */
  attempt?: number;
  attempts?: number;
  /** 0 to 100 (the render). */
  percent?: number;
  /** Short Spanish text, e.g. "16:9". */
  detail?: string;
  /** Why the previous try did not pass the checks. */
  problems?: string[];
};

export type ProgressPatch = Partial<Omit<VideoProgress, "stage" | "startedAt">>;

/** The stored progress of a video at `stage`, or null when there is none or it is of another. */
export function currentProgress(value: unknown, stage: string): VideoProgress | null {
  if (!value || typeof value !== "object") return null;
  const progress = value as Partial<VideoProgress>;
  if (progress.stage !== stage || typeof progress.startedAt !== "string") return null;
  if (!(WORKING_STAGES as readonly string[]).includes(stage)) return null;
  return progress as VideoProgress;
}
