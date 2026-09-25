import {
  checkScheduleTime,
  isPublishJobCurrent,
  type Network,
  type PostPublishJob,
} from "@radev/core";
import { and, eq, gte, lt, ne, sql } from "drizzle-orm";
import type { Database } from "../client";
import { posts, publications } from "../schema";
import type { Executor } from "./brand-assets";
import { type TransitionOutcome, transitionPost } from "./posts";

// Scheduling and publishing a post (docs/ARCHITECTURE.md §5 and §9, phase 4 T2). `scheduled_at`
// is the planned time; the `scheduled` status means the publish job is queued. The web queues and
// cancels the jobs with what these return (packages/db never touches pg-boss).

/** Another post of the brand already planned at that time (archived ones free it). */
async function timeTaken(
  db: Executor,
  input: { brandId: string; postId: string; at: Date },
): Promise<boolean> {
  const [row] = await db
    .select({ id: posts.id })
    .from(posts)
    .where(
      and(
        eq(posts.brandId, input.brandId),
        eq(posts.scheduledAt, input.at),
        ne(posts.status, "archived"),
        ne(posts.id, input.postId),
      ),
    )
    .limit(1);
  return row !== undefined;
}

function isTimeConflict(error: unknown): boolean {
  const cause = (error as { cause?: unknown }).cause ?? error;
  const { code, constraint } = cause as { code?: string; constraint?: string };
  return code === "23505" && constraint === "posts_brand_scheduled_at_unique";
}

const TIME_TAKEN = "Ya hay un post de la marca en ese horario.";

export type ScheduleOutcome =
  | { ok: true; at: Date; wasScheduled: boolean }
  | { ok: false; reason: string };

/**
 * Schedules an approved post, or moves a scheduled one (unschedule + schedule, in one
 * transaction). The caller cancels the old job when `wasScheduled` and queues the new one.
 */
export async function schedulePost(
  db: Database,
  input: { postId: string; at: Date; slotId: string | null; now: Date },
): Promise<ScheduleOutcome> {
  const time = checkScheduleTime(input.at, input.now);
  if (!time.ok) return time;
  try {
    return await db.transaction(async (tx) => {
      const [post] = await tx
        .select({ status: posts.status, brandId: posts.brandId })
        .from(posts)
        .where(eq(posts.id, input.postId))
        .for("update");
      if (!post) return { ok: false, reason: "Ese post no existe." };
      if (await timeTaken(tx, { brandId: post.brandId, postId: input.postId, at: input.at })) {
        return { ok: false, reason: TIME_TAKEN };
      }
      const wasScheduled = post.status === "scheduled";
      if (wasScheduled) {
        const back = await transitionPost(tx, input.postId, "unschedule");
        if (!back.ok) return back;
      }
      const moved = await transitionPost(tx, input.postId, "schedule");
      if (!moved.ok) {
        // Only reachable if the unschedule above ran: undo it too.
        if (wasScheduled) throw new Error(moved.reason);
        return moved;
      }
      await tx
        .update(posts)
        .set({ scheduledAt: input.at, slotId: input.slotId })
        .where(eq(posts.id, input.postId));
      return { ok: true, at: input.at, wasScheduled };
    });
  } catch (error) {
    if (isTimeConflict(error)) return { ok: false, reason: TIME_TAKEN };
    throw error;
  }
}

/** Back to approved, without a time. The caller cancels the publish job. */
export async function unschedulePost(db: Database, postId: string): Promise<TransitionOutcome> {
  return db.transaction(async (tx) => {
    const moved = await transitionPost(tx, postId, "unschedule");
    if (!moved.ok) return moved;
    await tx.update(posts).set({ scheduledAt: null, slotId: null }).where(eq(posts.id, postId));
    return moved;
  });
}

export type PublishStart =
  | { started: true; postId: string; publicCode: string; brandId: string }
  | { started: false; reason: "stale" | "missing" };

/**
 * A publish job's first step: if the post is still scheduled for the job's time, it moves to
 * `publishing` and its publication is recorded as pending, in one transaction. Anything else
 * (unscheduled, moved, edited, already started) is a stale job and does nothing (rule 8).
 */
export async function startScheduledPublishing(
  db: Database,
  input: { job: PostPublishJob; network: Network },
): Promise<PublishStart> {
  return db.transaction(async (tx) => {
    const [post] = await tx
      .select({
        status: posts.status,
        scheduledAt: posts.scheduledAt,
        publicCode: posts.publicCode,
        brandId: posts.brandId,
      })
      .from(posts)
      .where(eq(posts.id, input.job.postId))
      .for("update");
    if (!post) return { started: false, reason: "missing" };
    if (!isPublishJobCurrent(post, input.job)) return { started: false, reason: "stale" };
    const moved = await transitionPost(tx, input.job.postId, "startPublishing");
    if (!moved.ok) return { started: false, reason: "stale" };
    await tx
      .insert(publications)
      .values({ postId: input.job.postId, network: input.network, status: "pending", attempts: 1 })
      .onConflictDoUpdate({
        target: [publications.postId, publications.network],
        set: { status: "pending", error: null, attempts: sql`${publications.attempts} + 1` },
      });
    return {
      started: true,
      postId: input.job.postId,
      publicCode: post.publicCode,
      brandId: post.brandId,
    };
  });
}

/** Planned times of a brand's posts in a range (archived ones free theirs). */
export async function listPlannedTimes(
  db: Executor,
  input: { brandId: string; from: Date; to: Date; exceptPostId?: string },
): Promise<Date[]> {
  const rows = await db
    .select({ at: posts.scheduledAt })
    .from(posts)
    .where(
      and(
        eq(posts.brandId, input.brandId),
        gte(posts.scheduledAt, input.from),
        lt(posts.scheduledAt, input.to),
        ne(posts.status, "archived"),
        input.exceptPostId ? ne(posts.id, input.exceptPostId) : undefined,
      ),
    );
  return rows.flatMap((row) => (row.at ? [row.at] : []));
}
