import { ASSET_TYPES, type AssetRole, checkAssetFile, findAssetReferences } from "@radev/core";
import { and, asc, eq } from "drizzle-orm";
import { imageSize } from "image-size";
import type { Database } from "../client";
import { newBrandAssetPath, removeMediaFile, writeMediaFile } from "../media";
import { type Brand, type BrandAsset, brandAssets, brands } from "../schema";

/** The database or an open transaction. */
export type Executor = Database | Parameters<Parameters<Database["transaction"]>[0]>[0];

export type AssetResult<T> = { ok: true; value: T } | { ok: false; error: string };

export function listBrandAssets(db: Executor, brandId: string): Promise<BrandAsset[]> {
  return db
    .select()
    .from(brandAssets)
    .where(eq(brandAssets.brandId, brandId))
    .orderBy(asc(brandAssets.createdAt), asc(brandAssets.id));
}

export async function getBrandAsset(
  db: Executor,
  brandId: string,
  id: string,
): Promise<BrandAsset | undefined> {
  const [asset] = await db
    .select()
    .from(brandAssets)
    .where(and(eq(brandAssets.brandId, brandId), eq(brandAssets.id, id)))
    .limit(1);
  return asset;
}

type Prepared = {
  extension: string;
  mime: string;
  width: number | null;
  height: number | null;
  sizeBytes: number;
};

/** Validates the file (packages/core) and reads its size in pixels. */
function prepare(bytes: Uint8Array): AssetResult<Prepared> {
  const check = checkAssetFile(bytes);
  if (!check.ok) return check;
  const { mime, extension } = ASSET_TYPES[check.type];

  let width: number | null = null;
  let height: number | null = null;
  try {
    const size = imageSize(bytes);
    // EXIF orientations 5 to 8 rotate the photo 90°: the visible size is swapped.
    const rotated = (size.orientation ?? 1) >= 5;
    width = rotated ? size.height : size.width;
    height = rotated ? size.width : size.height;
  } catch {
    // An SVG may declare no size; a raster image without one is broken.
    if (check.type !== "svg") {
      return { ok: false, error: "No se pudo leer la imagen: puede estar dañada." };
    }
  }
  return { ok: true, value: { extension, mime, width, height, sizeBytes: bytes.byteLength } };
}

/** Saves the file in MEDIA_DIR and registers it. The file is removed if the insert fails. */
export async function createBrandAsset(
  db: Executor,
  input: { brand: Pick<Brand, "id" | "slug">; role: AssetRole; bytes: Uint8Array },
): Promise<AssetResult<BrandAsset>> {
  const prepared = prepare(input.bytes);
  if (!prepared.ok) return prepared;
  const { extension, ...file } = prepared.value;

  const path = newBrandAssetPath(input.brand.slug, extension);
  await writeMediaFile(path, input.bytes);
  try {
    const [asset] = await db
      .insert(brandAssets)
      .values({ brandId: input.brand.id, role: input.role, path, ...file })
      .returning();
    if (!asset) throw new Error("No se pudo registrar el archivo.");
    return { ok: true, value: asset };
  } catch (error) {
    await removeMediaFile(path);
    throw error;
  }
}

/**
 * Swaps the file of an asset and keeps its id, so every token that uses it shows the new file.
 * The new file gets a new path (browsers and renders never see a stale copy).
 */
export async function replaceBrandAssetFile(
  db: Executor,
  input: { brand: Pick<Brand, "id" | "slug">; asset: BrandAsset; bytes: Uint8Array },
): Promise<AssetResult<BrandAsset>> {
  const prepared = prepare(input.bytes);
  if (!prepared.ok) return prepared;
  const { extension, ...file } = prepared.value;

  const path = newBrandAssetPath(input.brand.slug, extension);
  await writeMediaFile(path, input.bytes);
  let updated: BrandAsset | undefined;
  try {
    [updated] = await db
      .update(brandAssets)
      .set({ path, ...file })
      .where(and(eq(brandAssets.id, input.asset.id), eq(brandAssets.brandId, input.brand.id)))
      .returning();
  } catch (error) {
    await removeMediaFile(path);
    throw error;
  }
  if (!updated) {
    await removeMediaFile(path);
    return { ok: false, error: "Ese archivo ya no existe." };
  }
  await removeMediaFile(input.asset.path);
  return { ok: true, value: updated };
}

/**
 * Deletes an asset and its file, unless the brand's tokens use it: then it returns the token
 * paths that point to it, so the panel can say where.
 */
export async function deleteBrandAsset(
  db: Executor,
  input: { brand: Pick<Brand, "id" | "themeTokens">; asset: BrandAsset },
): Promise<{ ok: true } | { ok: false; usedBy: string[][] }> {
  const usedBy = findAssetReferences(input.brand.themeTokens, input.asset.id);
  if (usedBy.length > 0) return { ok: false, usedBy };

  await db
    .delete(brandAssets)
    .where(and(eq(brandAssets.id, input.asset.id), eq(brandAssets.brandId, input.brand.id)));
  await removeMediaFile(input.asset.path);
  return { ok: true };
}

/** Points a top-level theme token (e.g. "heroAsset") to an asset. */
export async function setBrandAssetToken(
  db: Executor,
  brand: Pick<Brand, "id" | "themeTokens">,
  token: string,
  assetId: string | null,
): Promise<void> {
  await db
    .update(brands)
    .set({ themeTokens: { ...brand.themeTokens, [token]: assetId } })
    .where(eq(brands.id, brand.id));
}
