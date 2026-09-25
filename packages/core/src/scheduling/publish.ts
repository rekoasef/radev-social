// Scheduling a post (docs/ARCHITECTURE.md §5, phase 4 T2). A post's `scheduled_at` is its planned
// time; the `scheduled` status means its publish job is queued. Editing a scheduled post drops the
// job but keeps the planned time, and approving it again schedules it back if that time is still
// ahead (the automatic filling of phase 4, T4, plans posts the same way).

import type { RuleCheck } from "../brands/brand-rules";
import type { SlotOccurrence } from "./slots";

/** The earliest a post can be scheduled: a minute ahead, so the job never starts late. */
export const MIN_SCHEDULE_LEAD_MS = 60_000;

/** The farthest ahead a post can be scheduled by hand. */
export const MAX_SCHEDULE_DAYS = 90;

/** Days of slots the panel offers when scheduling by hand. */
export const SCHEDULE_PICK_DAYS = 14;

export function checkScheduleTime(at: Date, now: Date): RuleCheck {
  if (Number.isNaN(at.getTime())) return { ok: false, reason: "Esa fecha no es válida." };
  if (at.getTime() < now.getTime() + MIN_SCHEDULE_LEAD_MS) {
    return { ok: false, reason: "Elegí una hora que todavía no haya pasado." };
  }
  if (at.getTime() > now.getTime() + MAX_SCHEDULE_DAYS * 86_400_000) {
    return { ok: false, reason: `Se puede programar hasta ${MAX_SCHEDULE_DAYS} días adelante.` };
  }
  return { ok: true };
}

/** Slot times with no post planned yet (a brand publishes one post per time). */
export function freeOccurrences(
  occurrences: readonly SlotOccurrence[],
  taken: readonly Date[],
): SlotOccurrence[] {
  const busy = new Set(taken.map((at) => at.getTime()));
  return occurrences.filter((occurrence) => !busy.has(occurrence.at.getTime()));
}

/**
 * What approving does with a post's planned time: schedule it if it is still ahead, or forget it
 * if it already passed (the post stays approved, to be scheduled by hand).
 */
export function plannedTimeOnApprove(
  planned: Date | null,
  now: Date,
): { schedule: false; clear: boolean } | { schedule: true; at: Date } {
  if (!planned) return { schedule: false, clear: false };
  return checkScheduleTime(planned, now).ok
    ? { schedule: true, at: planned }
    : { schedule: false, clear: true };
}

/** Data of a `post.publish` job: the post and the planned time it was queued for. */
export type PostPublishJob = { postId: string; scheduledAt: string };

/**
 * Whether a publish job still stands: the post is scheduled and for the time the job was queued
 * for. A post that was unscheduled, rescheduled, edited or already published is skipped, so a
 * stale job never publishes (CLAUDE.md, rules 3 and 8).
 */
export function isPublishJobCurrent(
  post: { status: string; scheduledAt: Date | null },
  job: PostPublishJob,
): boolean {
  return (
    post.status === "scheduled" &&
    post.scheduledAt !== null &&
    post.scheduledAt.getTime() === new Date(job.scheduledAt).getTime()
  );
}
