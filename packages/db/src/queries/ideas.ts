import { IDEA_TRANSITIONS, type IdeaEvent, type IdeaSource, type IdeaStatus } from "@radev/core";
import { and, count, desc, eq } from "drizzle-orm";
import type { Database } from "../client";
import { contentPillars, contentSeries, type Idea, ideas, posts } from "../schema";
import type { Executor } from "./brand-assets";

// The brand's idea bank (docs/PRD.md RF-09). An idea's status only changes through the
// transitions of packages/core (ideas/ideas.ts), each one conditional on the status it starts from.

export async function createIdea(
  db: Database,
  values: {
    brandId: string;
    pillarId: string | null;
    title: string;
    angle: string;
    source: IdeaSource;
  },
): Promise<Idea> {
  const [idea] = await db.insert(ideas).values(values).returning();
  if (!idea) throw new Error("No se pudo guardar la idea.");
  return idea;
}

export type IdeaSummary = Idea & {
  pillarKey: string | null;
  pillarName: string | null;
  seriesName: string | null;
  /** The post generated from it, when it was used. */
  postCode: string | null;
};

/** A brand's ideas with one status, newest first. */
export async function listIdeas(
  db: Database,
  brandId: string,
  status: IdeaStatus,
): Promise<IdeaSummary[]> {
  const rows = await db
    .select({
      idea: ideas,
      pillarKey: contentPillars.key,
      pillarName: contentPillars.name,
      seriesName: contentSeries.name,
      postCode: posts.publicCode,
    })
    .from(ideas)
    .leftJoin(contentPillars, eq(contentPillars.id, ideas.pillarId))
    .leftJoin(
      contentSeries,
      and(eq(contentSeries.brandId, ideas.brandId), eq(contentSeries.key, ideas.seriesKey)),
    )
    .leftJoin(posts, eq(posts.ideaId, ideas.id))
    .where(and(eq(ideas.brandId, brandId), eq(ideas.status, status)))
    .orderBy(desc(ideas.createdAt), desc(posts.createdAt));
  // An idea is used once, but keep the list one row per idea whatever the join brings.
  const seen = new Set<string>();
  return rows.flatMap(({ idea, ...rest }) => {
    if (seen.has(idea.id)) return [];
    seen.add(idea.id);
    return [{ ...idea, ...rest }];
  });
}

export async function countIdeasByStatus(
  db: Database,
  brandId: string,
): Promise<Partial<Record<IdeaStatus, number>>> {
  const rows = await db
    .select({ status: ideas.status, value: count() })
    .from(ideas)
    .where(eq(ideas.brandId, brandId))
    .groupBy(ideas.status);
  return Object.fromEntries(rows.map((row) => [row.status, row.value]));
}

export async function getIdea(
  db: Database,
  id: string,
): Promise<(Idea & { pillarKey: string | null }) | undefined> {
  const [row] = await db
    .select({ idea: ideas, pillarKey: contentPillars.key })
    .from(ideas)
    .leftJoin(contentPillars, eq(contentPillars.id, ideas.pillarId))
    .where(eq(ideas.id, id));
  return row && { ...row.idea, pillarKey: row.pillarKey };
}

/**
 * Applies an event to an idea of the brand. False when the idea is not in the status the event
 * starts from (someone got there first, or it does not apply).
 */
export async function transitionIdea(
  db: Executor,
  input: { id: string; brandId: string; event: IdeaEvent },
): Promise<boolean> {
  const { from, to } = IDEA_TRANSITIONS[input.event];
  const updated = await db
    .update(ideas)
    .set({ status: to })
    .where(and(eq(ideas.id, input.id), eq(ideas.brandId, input.brandId), eq(ideas.status, from)))
    .returning({ id: ideas.id });
  return updated.length > 0;
}
