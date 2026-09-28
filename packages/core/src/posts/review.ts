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
  return checkRenderedSlides(input.slideCount, input.renderedSlides);
}

/** Every slide of a version has its PNG (to approve it, and to export it). */
export function checkRenderedSlides(
  slideCount: number,
  renderedSlides: readonly number[],
): RuleCheck {
  if (slideCount === 0) return { ok: false, reason: "La versión no tiene slides." };
  const rendered = new Set(renderedSlides);
  for (let index = 0; index < slideCount; index++) {
    if (!rendered.has(index))
      return {
        ok: false,
        reason: `Falta la imagen de la slide ${index + 1}: reintentá el render.`,
      };
  }
  return { ok: true };
}

export type ReviewQueueItem = {
  /** The planned time (T2), or null for a post with no time yet. */
  scheduledAt: Date | null;
  /** Since when it waits (the post's last change). */
  updatedAt: Date;
  number: number;
};

/**
 * The review queue (phase 4, T7), across brands: first the posts whose planned time is closest
 * (a missed one first of all: approving it now forgets its time), then the ones with no time,
 * oldest waiting first. Returns a new array.
 */
export function sortReviewQueue<T extends ReviewQueueItem>(items: readonly T[]): T[] {
  return [...items].sort((a, b) => {
    if (a.scheduledAt && b.scheduledAt)
      return a.scheduledAt.getTime() - b.scheduledAt.getTime() || a.number - b.number;
    if (a.scheduledAt) return -1;
    if (b.scheduledAt) return 1;
    return a.updatedAt.getTime() - b.updatedAt.getTime() || a.number - b.number;
  });
}
