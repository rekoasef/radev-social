import type { FillIdea } from "@radev/core";
import { and, asc, count, eq, gte, or, sql } from "drizzle-orm";
import type { Database } from "../client";
import { contentPillars, ideas, posts } from "../schema";

// What `slots.fill` reads (phase 4, T4): the mix so far, the posts in flight and the idea bank.

/**
 * Posts per pillar that count for the mix: created in the lookback, or planned from now on.
 * Archived and failed ones do not (they never went out).
 */
export async function pillarPostCounts(
  db: Database,
  input: { brandId: string; since: Date; now: Date },
): Promise<Record<string, number>> {
  const rows = await db
    .select({ key: contentPillars.key, n: count(posts.id) })
    .from(posts)
    .innerJoin(contentPillars, eq(contentPillars.id, posts.pillarId))
    .where(
      and(
        eq(posts.brandId, input.brandId),
        sql`${posts.status} not in ('archived', 'failed')`,
        or(gte(posts.createdAt, input.since), gte(posts.scheduledAt, input.now)),
      ),
    )
    .groupBy(contentPillars.key);
  return Object.fromEntries(rows.map((row) => [row.key, row.n]));
}

/** Posts the AI is writing for the brand now: they count against its caps before succeeding. */
export async function countGeneratingPosts(db: Database, brandId: string): Promise<number> {
  const [row] = await db
    .select({ n: count() })
    .from(posts)
    .where(and(eq(posts.brandId, brandId), eq(posts.status, "generating")));
  return row?.n ?? 0;
}

export type BankIdea = FillIdea & {
  title: string;
  angle: string;
};

/** The brand's new ideas, oldest first (the filling uses them in order). */
export async function listBankIdeasForFill(db: Database, brandId: string): Promise<BankIdea[]> {
  const rows = await db
    .select({
      id: ideas.id,
      title: ideas.title,
      angle: ideas.angle,
      pillarKey: contentPillars.key,
      pillarArchived: contentPillars.archivedAt,
    })
    .from(ideas)
    .leftJoin(contentPillars, eq(contentPillars.id, ideas.pillarId))
    .where(and(eq(ideas.brandId, brandId), eq(ideas.status, "new")))
    .orderBy(asc(ideas.createdAt));
  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    angle: row.angle,
    // An idea of an archived pillar is treated as one without a pillar.
    pillarKey: row.pillarArchived === null ? row.pillarKey : null,
  }));
}
