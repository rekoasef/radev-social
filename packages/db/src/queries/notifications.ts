import { createHash } from "node:crypto";
import { type Notice, type ReviewItem, reviewNotice, shortDateTime } from "@radev/core";
import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import type { Database } from "../client";
import { brands, type Notification, notifications, posts, postVersions } from "../schema";
import type { Executor } from "./brand-assets";

// Messages to the operator (Telegram, phase 4 T6). Stored first, sent by the `notify.send` job: a
// key already stored is never stored nor sent again (rule 8).

/** Stores a notice. Undefined when its key was already stored (nothing to send). */
export async function storeNotification(
  db: Executor,
  notice: Notice & { silent?: boolean },
): Promise<Notification | undefined> {
  const [row] = await db
    .insert(notifications)
    .values({
      key: notice.key,
      kind: notice.kind,
      text: notice.text,
      silent: notice.silent ?? false,
    })
    .onConflictDoNothing({ target: notifications.key })
    .returning();
  return row;
}

export async function getNotification(db: Executor, id: string): Promise<Notification | undefined> {
  const [row] = await db.select().from(notifications).where(eq(notifications.id, id));
  return row;
}

export async function markNotificationSent(db: Executor, id: string): Promise<void> {
  await db
    .update(notifications)
    .set({ sentAt: sql`now()`, error: null })
    .where(eq(notifications.id, id));
}

export async function markNotificationFailed(
  db: Executor,
  id: string,
  error: string,
): Promise<void> {
  await db.update(notifications).set({ error }).where(eq(notifications.id, id));
}

/** The latest notices, for Settings. */
export function listRecentNotifications(db: Executor, limit = 5): Promise<Notification[]> {
  return db.select().from(notifications).orderBy(desc(notifications.createdAt)).limit(limit);
}

/**
 * The posts that got to review and were not told yet, as one notice; their versions are marked
 * told in the same transaction. Undefined when there is nothing new.
 */
export async function takeReviewNotice(
  db: Database,
  input: { appUrl: string; silent: boolean },
): Promise<Notification | undefined> {
  return db.transaction(async (tx) => {
    const rows = await tx
      .select({
        versionId: postVersions.id,
        code: posts.publicCode,
        hook: sql<string | null>`${postVersions.content} ->> 'hook'`,
        scheduledAt: posts.scheduledAt,
        brandName: brands.name,
        timeZone: brands.timezone,
      })
      .from(posts)
      .innerJoin(postVersions, eq(postVersions.id, posts.currentVersionId))
      .innerJoin(brands, eq(brands.id, posts.brandId))
      .where(and(eq(posts.status, "in_review"), isNull(postVersions.reviewNotifiedAt)))
      .orderBy(posts.scheduledAt, posts.publicCode)
      .for("update", { of: postVersions });
    if (rows.length === 0) return undefined;
    const items: ReviewItem[] = rows.map((row) => ({
      code: row.code,
      brandName: row.brandName,
      hook: row.hook ?? "",
      plannedFor: row.scheduledAt ? shortDateTime(row.scheduledAt, row.timeZone) : null,
    }));
    const ids = rows.map((row) => row.versionId).sort();
    const key = `review:${createHash("sha256").update(ids.join(",")).digest("hex").slice(0, 32)}`;
    const stored = await storeNotification(tx, {
      ...reviewNotice(items, input.appUrl, key),
      silent: input.silent,
    });
    await tx
      .update(postVersions)
      .set({ reviewNotifiedAt: sql`now()` })
      .where(inArray(postVersions.id, ids));
    return stored;
  });
}
