import type { WorkingStage } from "@radev/core";
import type { DeskOutcome } from "@radev/db";

// The operator's answer at the script desk. The voice is only queued after the stage actually
// changed: without an approval there is no voice (and nothing is paid).

export type ScriptDecision = { event: "approveScript" } | { event: "rejectScript"; note: string };

export type DecideDeps = {
  decide(videoId: string, version: number, decision: ScriptDecision): Promise<DeskOutcome>;
  queue(videoId: string, stage: WorkingStage): Promise<void>;
};

export async function decideAndQueue(
  deps: DecideDeps,
  videoId: string,
  version: number,
  decision: ScriptDecision,
): Promise<DeskOutcome> {
  const outcome = await deps.decide(videoId, version, decision);
  if (!outcome.ok) return outcome;
  const stage = decision.event === "approveScript" ? "voicing" : "scripting";
  // A lost send is not a lost video: the worker's sweep queues it again.
  await deps.queue(videoId, stage).catch((cause) => console.error("video: not queued", cause));
  return outcome;
}
