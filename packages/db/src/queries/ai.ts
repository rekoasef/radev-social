import {
  type AiQuotaCheck,
  type AiRoute,
  type AiRouteTarget,
  type AiTask,
  checkAiQuota,
  checkAiRoute,
  zonedPeriodStart,
} from "@radev/core";
import { and, count, eq, gte, isNull } from "drizzle-orm";
import type { Database } from "../client";
import {
  type AiRouteRow,
  aiRoutes,
  type Brand,
  brands,
  generationRuns,
  type NewGenerationRun,
} from "../schema";

// AI routing and usage (docs/ARCHITECTURE.md §7): the routes the panel edits, the record of every
// generation attempt, and the brand caps that count them.

export function toAiRoute(row: AiRouteRow): AiRoute {
  const fallback: AiRouteTarget | null =
    row.fallbackProvider && row.fallbackModel
      ? { provider: row.fallbackProvider, model: row.fallbackModel }
      : null;
  return {
    task: row.task,
    brandId: row.brandId,
    primary: { provider: row.provider, model: row.model },
    fallback,
  };
}

/** Every route, global and per brand. Resolve one with resolveAiRoute (packages/core). */
export async function listAiRoutes(db: Database): Promise<AiRoute[]> {
  const rows = await db.select().from(aiRoutes);
  return rows.map(toAiRoute);
}

export type SaveRouteResult = { ok: true } | { ok: false; errors: string[] };

/** Creates or replaces the global route of a task, after checkAiRoute. */
export async function saveGlobalAiRoute(
  db: Database,
  route: { task: AiTask; primary: AiRouteTarget; fallback: AiRouteTarget | null },
): Promise<SaveRouteResult> {
  const errors = checkAiRoute(route);
  if (errors.length > 0) return { ok: false, errors };
  const values = {
    provider: route.primary.provider,
    model: route.primary.model.trim(),
    fallbackProvider: route.fallback?.provider ?? null,
    fallbackModel: route.fallback?.model.trim() ?? null,
  };
  await db.transaction(async (tx) => {
    const updated = await tx
      .update(aiRoutes)
      .set(values)
      .where(and(eq(aiRoutes.task, route.task), isNull(aiRoutes.brandId)))
      .returning({ id: aiRoutes.id });
    if (updated.length === 0) await tx.insert(aiRoutes).values({ task: route.task, ...values });
  });
  return { ok: true };
}

/** Stores one attempt and returns its id (a version written by it points to it). */
export async function recordGenerationRun(db: Database, run: NewGenerationRun): Promise<string> {
  const [row] = await db.insert(generationRuns).values(run).returning({ id: generationRuns.id });
  if (!row) throw new Error("No se pudo registrar la ejecución.");
  return row.id;
}

/** Successful generations of a brand since an instant (what the caps count). */
export async function countSuccessfulRuns(
  db: Database,
  brandId: string,
  since: Date,
): Promise<number> {
  const [row] = await db
    .select({ value: count() })
    .from(generationRuns)
    .where(
      and(
        eq(generationRuns.brandId, brandId),
        eq(generationRuns.status, "succeeded"),
        gte(generationRuns.createdAt, since),
      ),
    );
  return row?.value ?? 0;
}

export type BrandAiUsage = { today: number; month: number };

/** Successful generations today and this month, in the brand's time zone (rule 11). */
export async function getBrandAiUsage(
  db: Database,
  brand: Pick<Brand, "id" | "timezone">,
  now: Date = new Date(),
): Promise<BrandAiUsage> {
  const [today, month] = await Promise.all([
    countSuccessfulRuns(db, brand.id, zonedPeriodStart(now, brand.timezone, "day")),
    countSuccessfulRuns(db, brand.id, zonedPeriodStart(now, brand.timezone, "month")),
  ]);
  return { today, month };
}

/** Whether the brand can generate now, by its own caps. */
export async function checkBrandAiQuota(
  db: Database,
  brand: Pick<Brand, "id" | "timezone" | "aiDailyLimit" | "aiMonthlyLimit">,
  now: Date = new Date(),
): Promise<AiQuotaCheck> {
  const used = await getBrandAiUsage(db, brand, now);
  return checkAiQuota({ daily: brand.aiDailyLimit, monthly: brand.aiMonthlyLimit }, used);
}

/** A brand's own caps. Null: no cap; 0 pauses generation for the brand. */
export async function setBrandAiLimits(
  db: Database,
  brandId: string,
  limits: { daily: number | null; monthly: number | null },
): Promise<void> {
  await db
    .update(brands)
    .set({ aiDailyLimit: limits.daily, aiMonthlyLimit: limits.monthly })
    .where(eq(brands.id, brandId));
}
