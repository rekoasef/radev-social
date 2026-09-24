import type { RuleCheck } from "../brands/brand-rules";
import type { PostStatus } from "./constants";
import { nextStatus } from "./state-machine";

// Approving is a promise that what gets published is what the operator saw: the version on screen
// must still be the current one and every slide must have its PNG. The state machine decides
// the status part (in_review → approved); this adds what it cannot know.

export type ApprovalInput = {
  status: PostStatus;
  currentVersionId: string | null;
  /** The version the operator was looking at when they pressed "Aprobar". */
  reviewedVersionId: string;
  slideCount: number;
  /** Slide indexes with a rendered PNG, for the reviewed version. */
  renderedSlides: readonly number[];
};

export function canApprove(input: ApprovalInput): RuleCheck {
  const transition = nextStatus(input.status, "approve");
  if (!transition.ok) return transition;
  if (input.reviewedVersionId !== input.currentVersionId)
    return {
      ok: false,
      reason: "El post cambió mientras lo revisabas: mirá la versión nueva antes de aprobar.",
    };
  if (input.slideCount === 0) return { ok: false, reason: "La versión no tiene slides." };
  const rendered = new Set(input.renderedSlides);
  for (let index = 0; index < input.slideCount; index++) {
    if (!rendered.has(index))
      return {
        ok: false,
        reason: `Falta la imagen de la slide ${index + 1}: reintentá el render.`,
      };
  }
  return { ok: true };
}
