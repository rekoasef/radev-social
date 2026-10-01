// A request for ideas to the AI (phase 3, T10): "Proponer ideas" (ideas.generate) or "Investigar
// temas" (ideas.research). The request row carries its parameters and outcome, so the panel shows
// how it went and a repeated job never adds its ideas twice (CLAUDE.md, rule 8).

import type { AiTask } from "../ai/tasks";

export const IDEA_REQUEST_TASKS = [
  "ideas.generate",
  "ideas.research",
] as const satisfies readonly AiTask[];
export type IdeaRequestTask = (typeof IDEA_REQUEST_TASKS)[number];

export const IDEA_REQUEST_STATUSES = ["queued", "running", "succeeded", "failed"] as const;
export type IdeaRequestStatus = (typeof IDEA_REQUEST_STATUSES)[number];

/** How many ideas a request asks for. */
export const IDEA_COUNT_MIN = 3;
export const IDEA_COUNT_MAX = 8;
export const IDEA_COUNT_DEFAULT = 5;

/** What the operator can add to a research request ("temas de automatización para clínicas"). */
export const RESEARCH_FOCUS_MAX = 300;

/** Sources a research idea keeps at most. */
export const IDEA_SOURCES_MAX = 3;

/** Parameters of a request, stored with it. */
export type IdeaRequestParams = {
  count: number;
  /** Only ideas of this pillar; null lets the AI spread them over the pillars. */
  pillarKey: string | null;
  /** What to look into (ideas.research). */
  focus: string | null;
};

/** A request still waiting or running: the panel does not take another of the same task. */
export function isIdeaRequestOpen(status: IdeaRequestStatus): boolean {
  return status === "queued" || status === "running";
}
