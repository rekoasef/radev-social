import { count, eq, sql } from "drizzle-orm";
import type { Database } from "../client";
import { type ContentPillar, contentPillars, posts } from "../schema";

// Content pillars of a brand (docs/PRD.md RF-05). The mix rules (whole percentages that add up to
// 100, removing only at 0 %) live in packages/core (brands/pillars.ts); the panel checks them.

export type PillarWithPosts = ContentPillar & { postCount: number };

/** Every pillar of a brand, archived ones too, with how many posts each has. Biggest share first. */
export async function listBrandPillars(db: Database, brandId: string): Promise<PillarWithPosts[]> {
  const rows = await db
    .select({ pillar: contentPillars, postCount: count(posts.id) })
    .from(contentPillars)
    .leftJoin(posts, eq(posts.pillarId, contentPillars.id))
    .where(eq(contentPillars.brandId, brandId))
    .groupBy(contentPillars.id)
    .orderBy(sql`${contentPillars.targetShare} desc`, contentPillars.name);
  return rows.map(({ pillar, postCount }) => ({ ...pillar, postCount }));
}

export async function getPillar(db: Database, id: string): Promise<PillarWithPosts | undefined> {
  const [row] = await db
    .select({ pillar: contentPillars, postCount: count(posts.id) })
    .from(contentPillars)
    .leftJoin(posts, eq(posts.pillarId, contentPillars.id))
    .where(eq(contentPillars.id, id))
    .groupBy(contentPillars.id);
  return row && { ...row.pillar, postCount: row.postCount };
}

export type PillarWriteResult = { ok: true; pillar: ContentPillar } | { ok: false; error: string };

/** A new pillar enters the mix at 0 %: the operator then gives it a share from the others. */
export async function createPillar(
  db: Database,
  values: { brandId: string; key: string; name: string; description: string },
): Promise<PillarWriteResult> {
  const [pillar] = await db
    .insert(contentPillars)
    .values({ ...values, targetShare: 0 })
    .onConflictDoNothing({ target: [contentPillars.brandId, contentPillars.key] })
    .returning();
  return pillar
    ? { ok: true, pillar }
    : { ok: false, error: "Ya hay un pilar con ese nombre (quizás archivado)." };
}

export type PillarMixRow = { id: string; name: string; description: string; share: number };

/**
 * Saves the whole mix in one go. It has to cover exactly the brand's active pillars, so the total
 * the panel checked is the total of the brand.
 */
export async function savePillarMix(
  db: Database,
  brandId: string,
  rows: readonly PillarMixRow[],
): Promise<{ ok: true } | { ok: false; error: string }> {
  return db.transaction(async (tx) => {
    const active = await tx
      .select({ id: contentPillars.id })
      .from(contentPillars)
      .where(sql`${contentPillars.brandId} = ${brandId} and ${contentPillars.archivedAt} is null`)
      .for("update");
    const activeIds = new Set(active.map((p) => p.id));
    const sameSet = rows.length === activeIds.size && rows.every((row) => activeIds.has(row.id));
    if (!sameSet) {
      return { ok: false, error: "Los pilares cambiaron mientras editabas: recargá la página." };
    }
    for (const row of rows) {
      await tx
        .update(contentPillars)
        .set({ name: row.name, description: row.description, targetShare: row.share })
        .where(eq(contentPillars.id, row.id));
    }
    return { ok: true };
  });
}

/** How the AI writes a pillar's posts (ADR 0021); name, share and key don't change here. */
export type PillarGuide = Pick<ContentPillar, "goal" | "hookTypes" | "guide" | "closing" | "avoid">;

export async function savePillarGuide(db: Database, id: string, guide: PillarGuide) {
  await db.update(contentPillars).set(guide).where(eq(contentPillars.id, id));
}

/** A pillar leaves the mix at 0 % and comes back at 0 %, so the active ones keep adding up to 100. */
export async function setPillarArchived(db: Database, id: string, archived: boolean) {
  await db
    .update(contentPillars)
    .set(archived ? { archivedAt: new Date() } : { archivedAt: null, targetShare: 0 })
    .where(eq(contentPillars.id, id));
}

/** Only for a pillar without posts (the foreign key refuses otherwise); its ideas lose the pillar. */
export async function deletePillar(db: Database, id: string) {
  await db.delete(contentPillars).where(eq(contentPillars.id, id));
}
