import {
  BRAND_DOCUMENT_KINDS,
  type BrandDocumentKind,
  MAX_BRAND_DOCUMENT_CHARS,
  normalizeBrandDocument,
} from "@radev/core";
import { and, desc, eq } from "drizzle-orm";
import { type BrandDocument, brandDocuments, brands } from "../schema";
import type { Executor } from "./brand-assets";

/** Current version of each kind (undefined for kinds the brand doesn't have yet). */
export async function listCurrentBrandDocuments(
  db: Executor,
  brandId: string,
): Promise<Record<BrandDocumentKind, BrandDocument | undefined>> {
  const rows = await db
    .select()
    .from(brandDocuments)
    .where(eq(brandDocuments.brandId, brandId))
    .orderBy(desc(brandDocuments.version));
  const current = Object.fromEntries(
    BRAND_DOCUMENT_KINDS.map((kind) => [kind, undefined]),
  ) as Record<BrandDocumentKind, BrandDocument | undefined>;
  for (const row of rows) current[row.kind] ??= row;
  return current;
}

/** Every version of one kind, newest first. */
export function listBrandDocumentVersions(
  db: Executor,
  brandId: string,
  kind: BrandDocumentKind,
): Promise<BrandDocument[]> {
  return db
    .select()
    .from(brandDocuments)
    .where(and(eq(brandDocuments.brandId, brandId), eq(brandDocuments.kind, kind)))
    .orderBy(desc(brandDocuments.version));
}

export type SaveDocumentResult =
  | { ok: true; document: BrandDocument; unchanged: boolean }
  | { ok: false; error: string };

/**
 * Saves a new version of a document. The same text as the current version creates nothing
 * (`unchanged`). The brand row is locked so two saves can't take the same number.
 */
export async function saveBrandDocument(
  db: Executor,
  input: { brandId: string; kind: BrandDocumentKind; content: string },
): Promise<SaveDocumentResult> {
  const content = normalizeBrandDocument(input.content);
  if (content === "") return { ok: false, error: "El documento está vacío." };
  if ([...content].length > MAX_BRAND_DOCUMENT_CHARS) {
    return {
      ok: false,
      error: `El documento tiene más de ${MAX_BRAND_DOCUMENT_CHARS.toLocaleString("es-AR")} caracteres.`,
    };
  }

  return db.transaction(async (tx) => {
    const [brand] = await tx
      .select({ id: brands.id })
      .from(brands)
      .where(eq(brands.id, input.brandId))
      .for("update");
    if (!brand) return { ok: false, error: "Esa marca ya no existe." } as const;

    const [latest] = await tx
      .select()
      .from(brandDocuments)
      .where(and(eq(brandDocuments.brandId, brand.id), eq(brandDocuments.kind, input.kind)))
      .orderBy(desc(brandDocuments.version))
      .limit(1);
    if (latest && latest.content === content) {
      return { ok: true, document: latest, unchanged: true } as const;
    }

    const [created] = await tx
      .insert(brandDocuments)
      .values({
        brandId: brand.id,
        kind: input.kind,
        content,
        version: (latest?.version ?? 0) + 1,
      })
      .returning();
    if (!created) throw new Error("No se pudo guardar el documento.");
    return { ok: true, document: created, unchanged: false } as const;
  });
}
