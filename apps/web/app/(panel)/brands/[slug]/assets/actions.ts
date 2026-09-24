"use server";

import { ASSET_ROLES, MAX_ASSET_BYTES } from "@radev/core";
import {
  createBrandAsset,
  deleteBrandAsset,
  getBrandAsset,
  getBrandBySlug,
  replaceBrandAssetFile,
} from "@radev/db";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { tokenLabel } from "@/lib/brand-assets";
import { db } from "@/lib/db";
import { requireOperator } from "@/lib/session";

export type AssetFormState =
  | { status: "idle" }
  | { status: "ok"; message: string }
  | { status: "error"; message: string };

const slug = z.string().trim().min(1).max(64);
const file = z
  .instanceof(File, { error: "Elegí un archivo." })
  .refine((f) => f.size > 0, { error: "Elegí un archivo." })
  .refine((f) => f.size <= MAX_ASSET_BYTES, { error: "El archivo pesa más de 5 MB." });

const uploadInput = z.object({ slug, role: z.enum(ASSET_ROLES), file });
const replaceInput = z.object({ slug, assetId: z.uuid(), file });
const deleteInput = z.object({ slug, assetId: z.uuid() });

const failed = (message: string): AssetFormState => ({ status: "error", message });

function firstIssue(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Datos inválidos.";
}

async function activeBrand(brandSlug: string) {
  const brand = await getBrandBySlug(db, brandSlug);
  return brand && brand.archivedAt === null ? brand : undefined;
}

async function readBytes(f: File): Promise<Uint8Array> {
  return new Uint8Array(await f.arrayBuffer());
}

export async function uploadAsset(_: AssetFormState, form: FormData): Promise<AssetFormState> {
  await requireOperator();
  const parsed = uploadInput.safeParse(Object.fromEntries(form));
  if (!parsed.success) return failed(firstIssue(parsed.error));

  const brand = await activeBrand(parsed.data.slug);
  if (!brand) return failed("Esa marca no existe o está archivada.");

  const result = await createBrandAsset(db, {
    brand,
    role: parsed.data.role,
    bytes: await readBytes(parsed.data.file),
  });
  if (!result.ok) return failed(result.error);

  revalidatePath(`/brands/${brand.slug}/assets`);
  return { status: "ok", message: "Archivo subido." };
}

export async function replaceAsset(_: AssetFormState, form: FormData): Promise<AssetFormState> {
  await requireOperator();
  const parsed = replaceInput.safeParse(Object.fromEntries(form));
  if (!parsed.success) return failed(firstIssue(parsed.error));

  const brand = await activeBrand(parsed.data.slug);
  if (!brand) return failed("Esa marca no existe o está archivada.");
  const asset = await getBrandAsset(db, brand.id, parsed.data.assetId);
  if (!asset) return failed("Ese archivo ya no existe.");

  const result = await replaceBrandAssetFile(db, {
    brand,
    asset,
    bytes: await readBytes(parsed.data.file),
  });
  if (!result.ok) return failed(result.error);

  revalidatePath(`/brands/${brand.slug}/assets`);
  return { status: "ok", message: "Archivo reemplazado." };
}

export async function deleteAsset(_: AssetFormState, form: FormData): Promise<AssetFormState> {
  await requireOperator();
  const parsed = deleteInput.safeParse(Object.fromEntries(form));
  if (!parsed.success) return failed(firstIssue(parsed.error));

  const brand = await activeBrand(parsed.data.slug);
  if (!brand) return failed("Esa marca no existe o está archivada.");
  const asset = await getBrandAsset(db, brand.id, parsed.data.assetId);
  if (!asset) return failed("Ese archivo ya no existe.");

  const result = await deleteBrandAsset(db, { brand, asset });
  if (!result.ok) {
    const where = result.usedBy.map((path) => tokenLabel(brand.stylePreset, path)).join(", ");
    return failed(`Está en uso en la identidad visual (${where}). Cambialo ahí antes de borrarlo.`);
  }

  revalidatePath(`/brands/${brand.slug}/assets`);
  return { status: "ok", message: "Archivo borrado." };
}
