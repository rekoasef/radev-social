import type { VideoEvent, WorkingStage } from "@radev/core";
import type { DeskOutcome } from "@radev/db";

// The operator's answer at one of his two desks. An office is only queued after the stage actually
// changed: without an approval there is no voice (and nothing is paid).

/** The office each answer sends the video to; null when it ends at the desk. */
const NEXT_OFFICE = {
  approveScript: "voicing",
  rejectScript: "scripting",
  approveVideo: null,
  rejectVideoToScript: "scripting",
  rejectVideoToVoice: "voicing",
  rejectVideoToRender: "rendering",
} as const satisfies Partial<Record<VideoEvent, WorkingStage | null>>;

export type DeskEvent = keyof typeof NEXT_OFFICE;
export type Decision = { event: DeskEvent; note?: string };

export type DecideDeps = {
  decide(videoId: string, version: number, decision: Decision): Promise<DeskOutcome>;
  queue(videoId: string, stage: WorkingStage): Promise<void>;
};

export async function decideAndQueue(
  deps: DecideDeps,
  videoId: string,
  version: number,
  decision: Decision,
): Promise<DeskOutcome> {
  const outcome = await deps.decide(videoId, version, decision);
  if (!outcome.ok) return outcome;
  const stage = NEXT_OFFICE[decision.event];
  // A lost send is not a lost video: the worker's sweep queues it again.
  if (stage) {
    await deps.queue(videoId, stage).catch((cause) => console.error("video: not queued", cause));
  }
  return outcome;
}
