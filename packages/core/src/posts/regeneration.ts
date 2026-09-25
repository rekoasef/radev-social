import type { VersionOrigin } from "./constants";

// Regenerating a post with AI (docs/ARCHITECTURE.md §7–8, phase 3 T8): after the operator rejects
// it with feedback, or on its own when an AI version fails the render QA.

/** Automatic regenerations for render QA problems before the post goes to review as it is. */
export const MAX_QA_REGENERATIONS = 2;

export const REJECTION_FEEDBACK_MIN = 10;
export const REJECTION_FEEDBACK_MAX = 1000;

/** Kind of render issue that is not a QA finding: the page or the browser failed. */
export const RENDER_ERROR_KIND = "error";

export type RenderOutcome =
  /** No problems, or out of automatic regenerations: to review, with the problems marked. */
  | "done"
  /** The render broke, or a version from the editor has QA problems (shown in the panel). */
  | "failed"
  /** An AI version with QA problems: the AI writes it again with them as feedback. */
  | "regenerate";

/** What a finished render leads to. Pure, so the rule is tested apart from the worker. */
export function renderOutcome(input: {
  origin: VersionOrigin;
  issueKinds: readonly string[];
  /** QA regenerations the post already had in this round. */
  qaRegenerations: number;
}): RenderOutcome {
  const { origin, issueKinds, qaRegenerations } = input;
  if (issueKinds.length === 0) return "done";
  if (issueKinds.includes(RENDER_ERROR_KIND) || origin !== "ai") return "failed";
  return qaRegenerations < MAX_QA_REGENERATIONS ? "regenerate" : "done";
}
