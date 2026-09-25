import { and, count, eq, isNull } from "drizzle-orm";
import type { Database } from "../client";
import { type ContentSeries, contentPillars, contentSeries, ideas } from "../schema";

// Recurring series of a brand (docs/PRD.md RF-12). Checks of the fields (slide types, hook type,
// lengths) happen in the panel's action; here only what the database can tell.

export type SeriesSummary = ContentSeries & {
  pillarKey: string | null;
  pillarName: string | null;
  ideaCount: number;
};

function seriesQuery(db: Database) {
  return db
    .select({
      series: contentSeries,
      pillarKey: contentPillars.key,
      pillarName: contentPillars.name,
      ideaCount: count(ideas.id),
    })
    .from(contentSeries)
    .leftJoin(contentPillars, eq(contentPillars.id, contentSeries.pillarId))
    .leftJoin(
      ideas,
      and(eq(ideas.brandId, contentSeries.brandId), eq(ideas.seriesKey, contentSeries.key)),
    )
    .groupBy(contentSeries.id, contentPillars.id);
}

type SeriesRow = Awaited<ReturnType<ReturnType<typeof seriesQuery>["where"]>>[number];
const toSummary = ({ series, ...rest }: SeriesRow): SeriesSummary => ({ ...series, ...rest });

/** Every series of a brand, archived ones too, by name. */
export async function listBrandSeries(db: Database, brandId: string): Promise<SeriesSummary[]> {
  const rows = await seriesQuery(db)
    .where(eq(contentSeries.brandId, brandId))
    .orderBy(contentSeries.name);
  return rows.map(toSummary);
}

/** The series the AI can use now (not archived). */
export async function listActiveSeries(db: Database, brandId: string): Promise<SeriesSummary[]> {
  const rows = await seriesQuery(db)
    .where(and(eq(contentSeries.brandId, brandId), isNull(contentSeries.archivedAt)))
    .orderBy(contentSeries.name);
  return rows.map(toSummary);
}

export async function getSeries(db: Database, id: string): Promise<SeriesSummary | undefined> {
  const [row] = await seriesQuery(db).where(eq(contentSeries.id, id));
  return row && toSummary(row);
}

export async function getSeriesByKey(
  db: Database,
  brandId: string,
  key: string,
): Promise<SeriesSummary | undefined> {
  const [row] = await seriesQuery(db).where(
    and(eq(contentSeries.brandId, brandId), eq(contentSeries.key, key)),
  );
  return row && toSummary(row);
}

export type SeriesFields = {
  name: string;
  pillarId: string | null;
  hookType: string | null;
  brief: string;
  requiredSlides: string[];
};

export type SeriesWriteResult = { ok: true; series: ContentSeries } | { ok: false; error: string };

/** A new series. Its key comes from the name and never changes (ideas and posts keep it). */
export async function createSeries(
  db: Database,
  values: SeriesFields & { brandId: string; key: string },
): Promise<SeriesWriteResult> {
  const [series] = await db
    .insert(contentSeries)
    .values(values)
    .onConflictDoNothing({ target: [contentSeries.brandId, contentSeries.key] })
    .returning();
  return series
    ? { ok: true, series }
    : { ok: false, error: "Ya hay una serie con ese nombre (quizás archivada)." };
}

export async function updateSeries(db: Database, id: string, fields: SeriesFields) {
  await db.update(contentSeries).set(fields).where(eq(contentSeries.id, id));
}

export async function setSeriesArchived(db: Database, id: string, archived: boolean) {
  await db
    .update(contentSeries)
    .set({ archivedAt: archived ? new Date() : null })
    .where(eq(contentSeries.id, id));
}

/** Only for a series without ideas (canDeleteSeries). */
export async function deleteSeries(db: Database, id: string) {
  await db.delete(contentSeries).where(eq(contentSeries.id, id));
}
