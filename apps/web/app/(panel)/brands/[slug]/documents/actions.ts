"use server";

import { BRAND_DOCUMENT_KINDS, MAX_BRAND_DOCUMENT_CHARS } from "@radev/core";
import { getBrandBySlug, listBrandDocumentVersions, saveBrandDocument } from "@radev/db";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireOperator } from "@/lib/session";

export type DocumentFormState =
  | { status: "idle" }
  | { status: "ok"; message: string }
  | { status: "error"; message: string };

const slug = z.string().trim().min(1).max(64);
const kind = z.enum(BRAND_DOCUMENT_KINDS);

const saveInput = z.object({
  slug,
  kind,
  // Slightly above the limit: CRLF line endings count here and disappear when normalized.
  content: z
    .string()
    .max(MAX_BRAND_DOCUMENT_CHARS * 2, { error: "El documento es demasiado largo." }),
});
const restoreInput = z.object({ slug, kind, version: z.coerce.number().int().min(1) });

async function activeBrand(brandSlug: string) {
  const brand = await getBrandBySlug(db, brandSlug);
  return brand && brand.archivedAt === null ? brand : undefined;
}

const documentsPath = (brandSlug: string) => `/brands/${brandSlug}/documents`;

/** Saves the editor's text as a new version (nothing, if it didn't change). */
export async function saveDocumentAction(
  _: DocumentFormState,
  form: FormData,
): Promise<DocumentFormState> {
  await requireOperator();
  const parsed = saveInput.safeParse(Object.fromEntries(form));
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }
  const brand = await activeBrand(parsed.data.slug);
  if (!brand) return { status: "error", message: "Esa marca no existe o está archivada." };

  const result = await saveBrandDocument(db, {
    brandId: brand.id,
    kind: parsed.data.kind,
    content: parsed.data.content,
  });
  if (!result.ok) return { status: "error", message: result.error };

  revalidatePath(documentsPath(brand.slug));
  return result.unchanged
    ? { status: "ok", message: "Sin cambios: es igual a la versión actual." }
    : { status: "ok", message: `Guardado como versión ${result.document.version}.` };
}

/** Brings back an old version as a new one: the history is never rewritten. */
export async function restoreDocumentAction(form: FormData): Promise<void> {
  await requireOperator();
  const { slug: brandSlug, kind: docKind, version } = restoreInput.parse(Object.fromEntries(form));
  const brand = await activeBrand(brandSlug);
  if (!brand) throw new Error("Esa marca no existe o está archivada.");

  const versions = await listBrandDocumentVersions(db, brand.id, docKind);
  const old = versions.find((v) => v.version === version);
  if (!old) throw new Error("Esa versión ya no existe.");

  const result = await saveBrandDocument(db, {
    brandId: brand.id,
    kind: docKind,
    content: old.content,
  });
  if (!result.ok) throw new Error(result.error);
  revalidatePath(documentsPath(brand.slug));
  redirect(`${documentsPath(brand.slug)}?kind=${docKind}`);
}
