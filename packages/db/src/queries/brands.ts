import { asc, eq } from "drizzle-orm";
import type { Database } from "../client";
import { removeMediaFile } from "../media";
import { type Brand, brandAssets, brands, type NewBrand } from "../schema";

/** All brands, archived included, in creation order (name breaks ties). */
export function listBrands(db: Database): Promise<Brand[]> {
  return db.select().from(brands).orderBy(asc(brands.createdAt), asc(brands.name));
}

export async function getBrandBySlug(db: Database, slug: string): Promise<Brand | undefined> {
  const [brand] = await db.select().from(brands).where(eq(brands.slug, slug)).limit(1);
  return brand;
}

export async function getBrandById(db: Database, id: string): Promise<Brand | undefined> {
  const [brand] = await db.select().from(brands).where(eq(brands.id, id)).limit(1);
  return brand;
}

/**
 * Posts of a brand. The posts table arrives in phase 2; until then there are none, so every
 * brand can be deleted and its code prefix changed. Replace with a real count then.
 */
export async function countBrandPosts(_db: Database, _brandId: string): Promise<number> {
  return 0;
}

export type BrandWriteResult =
  | { ok: true; brand: Brand }
  | { ok: false; field: "slug" | "codePrefix"; error: string };

const UNIQUE_FIELDS = {
  brands_slug_unique: { field: "slug", error: "Ya hay una marca con ese slug." },
  brands_code_prefix_unique: { field: "codePrefix", error: "Ya hay una marca con ese prefijo." },
} as const;

/** A unique-constraint violation on slug or code prefix, as a message for the form. */
function uniqueViolation(error: unknown): BrandWriteResult | undefined {
  const cause = (error as { cause?: unknown }).cause ?? error;
  const { code, constraint } = cause as { code?: string; constraint?: string };
  if (code !== "23505" || !constraint || !(constraint in UNIQUE_FIELDS)) return undefined;
  return { ok: false, ...UNIQUE_FIELDS[constraint as keyof typeof UNIQUE_FIELDS] };
}

export async function createBrand(db: Database, values: NewBrand): Promise<BrandWriteResult> {
  try {
    const [brand] = await db.insert(brands).values(values).returning();
    if (!brand) throw new Error("No se pudo crear la marca.");
    return { ok: true, brand };
  } catch (error) {
    const unique = uniqueViolation(error);
    if (unique) return unique;
    throw error;
  }
}

export type BrandDetails = Pick<NewBrand, "name" | "slug" | "codePrefix" | "timezone">;

export async function updateBrand(
  db: Database,
  id: string,
  values: BrandDetails,
): Promise<BrandWriteResult> {
  try {
    const [brand] = await db.update(brands).set(values).where(eq(brands.id, id)).returning();
    if (!brand) throw new Error("Esa marca ya no existe.");
    return { ok: true, brand };
  } catch (error) {
    const unique = uniqueViolation(error);
    if (unique) return unique;
    throw error;
  }
}

/** Archiving hides the brand from the panel and generation; nothing is deleted. */
export async function setBrandArchived(db: Database, id: string, archived: boolean) {
  await db
    .update(brands)
    .set({ archivedAt: archived ? new Date() : null })
    .where(eq(brands.id, id));
}

/**
 * Deletes a brand for good, with its assets (rows cascade, files removed here). The caller
 * checks the rules first (canDeleteBrand).
 */
export async function deleteBrand(db: Database, id: string): Promise<void> {
  const files = await db
    .select({ path: brandAssets.path })
    .from(brandAssets)
    .where(eq(brandAssets.brandId, id));
  await db.delete(brands).where(eq(brands.id, id));
  // After the rows are gone: a file left behind is harmless, a row without its file is not.
  for (const { path } of files) await removeMediaFile(path);
}
