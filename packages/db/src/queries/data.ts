import {
  type BluelyticsSnapshot,
  type BrandData,
  bluelyticsData,
  combineBrandData,
  type DataSeries,
  type DataSource,
  isDataSource,
  versionDatasets,
} from "@radev/core";
import { desc, eq, sql } from "drizzle-orm";
import type { Database } from "../client";
import { brands, type DataSnapshot, dataSnapshots, posts, postVersions } from "../schema";
import type { Executor } from "./brand-assets";

// Real data for the content (phase 3, T11): the snapshots `data.refresh` stores and what each
// brand gets from them (datasets for charts, figures for bigNumber).

/**
 * Stores a source's data of a day. A second refresh the same day replaces it, so running the job
 * twice never duplicates (rule 8).
 */
export async function saveDataSnapshot(
  db: Executor,
  input: { source: DataSource; asOf: string; payload: object },
): Promise<DataSnapshot> {
  const payload = input.payload as Record<string, unknown>;
  const [row] = await db
    .insert(dataSnapshots)
    .values({ source: input.source, asOf: input.asOf, payload })
    .onConflictDoUpdate({
      target: [dataSnapshots.source, dataSnapshots.asOf],
      set: { payload, fetchedAt: sql`now()` },
    })
    .returning();
  if (!row) throw new Error("No se pudo guardar el snapshot.");
  return row;
}

/** The newest snapshot of a source, if there is any. */
export async function getLatestSnapshot(
  db: Executor,
  source: DataSource,
): Promise<DataSnapshot | undefined> {
  const [row] = await db
    .select()
    .from(dataSnapshots)
    .where(eq(dataSnapshots.source, source))
    .orderBy(desc(dataSnapshots.asOf))
    .limit(1);
  return row;
}

/** Datasets and figures of a snapshot, by its source. */
export function snapshotData(snapshot: DataSnapshot): BrandData {
  switch (snapshot.source) {
    case "bluelytics":
      return bluelyticsData(snapshot.payload as unknown as BluelyticsSnapshot);
  }
}

/**
 * What a brand's sources say today (`data.json` for the AI, the charts the editor offers). Null
 * when the brand uses no source or none has been fetched yet.
 */
export async function getBrandData(db: Executor, brandId: string): Promise<BrandData | null> {
  const [brand] = await db
    .select({ dataSources: brands.dataSources })
    .from(brands)
    .where(eq(brands.id, brandId));
  const parts: BrandData[] = [];
  for (const source of (brand?.dataSources ?? []).filter(isDataSource)) {
    const snapshot = await getLatestSnapshot(db, source);
    if (snapshot) parts.push(snapshotData(snapshot));
  }
  return combineBrandData(parts);
}

export async function setBrandDataSources(
  db: Database,
  brandId: string,
  sources: readonly DataSource[],
): Promise<void> {
  await db
    .update(brands)
    .set({ dataSources: [...new Set(sources)] })
    .where(eq(brands.id, brandId));
}

/** The `chart` slides' datasets of a carousel, by the refs they point to. */
export function chartRefs(content: { slides?: unknown }): string[] {
  const slides = Array.isArray(content.slides) ? content.slides : [];
  return slides.flatMap((slide) => {
    const { type, datasetRef } = (slide ?? {}) as { type?: unknown; datasetRef?: unknown };
    return type === "chart" && typeof datasetRef === "string" ? [datasetRef] : [];
  });
}

export type VersionDatasetsResult =
  | { ok: true; datasets: Record<string, DataSeries> | null }
  | { ok: false; missing: string[] };

/**
 * The datasets a new version of a carousel freezes: a chart the post's current version already
 * had keeps its points; a new one takes the brand's data of today. Null when it has no charts.
 */
export async function resolveVersionDatasets(
  db: Executor,
  input: { brandId: string; postId: string | null; content: { slides?: unknown } },
): Promise<VersionDatasetsResult> {
  const refs = chartRefs(input.content);
  if (refs.length === 0) return { ok: true, datasets: null };
  let previous: Record<string, DataSeries> | null = null;
  if (input.postId) {
    const [row] = await db
      .select({ datasets: postVersions.datasets })
      .from(posts)
      .innerJoin(postVersions, eq(postVersions.id, posts.currentVersionId))
      .where(eq(posts.id, input.postId));
    previous = row?.datasets ?? null;
  }
  const current = (await getBrandData(db, input.brandId))?.datasets ?? null;
  const result = versionDatasets({ refs, previous, current });
  if (result.missing.length > 0) return { ok: false, missing: result.missing };
  return { ok: true, datasets: result.datasets };
}
