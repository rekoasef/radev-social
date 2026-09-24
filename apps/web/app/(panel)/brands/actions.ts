"use server";

import { canChangeCodePrefix, canDeleteBrand } from "@radev/core";
import {
  countBrandPosts,
  createBrand,
  deleteBrand,
  getBrandById,
  setBrandArchived,
  updateBrand,
} from "@radev/db";
import { defaultTokens } from "@radev/slides";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { preferredBrandSlug, rememberActiveBrand } from "@/lib/active-brand";
import { type BrandField, createBrandInput, fieldErrors, updateBrandInput } from "@/lib/brand-form";
import { db } from "@/lib/db";
import { requireOperator } from "@/lib/session";

export type BrandFormState =
  | { status: "idle" }
  | { status: "ok"; message: string }
  | { status: "error"; message?: string; fields?: Partial<Record<BrandField, string>> };

/** A new brand starts with its preset's default tokens; the identity editor (T10) customizes them. */
export async function createBrandAction(
  _: BrandFormState,
  form: FormData,
): Promise<BrandFormState> {
  await requireOperator();
  const parsed = createBrandInput.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { status: "error", fields: fieldErrors(parsed.error) };

  const { stylePreset, ...details } = parsed.data;
  const result = await createBrand(db, {
    ...details,
    stylePreset,
    themeTokens: defaultTokens(stylePreset),
  });
  if (!result.ok) return { status: "error", fields: { [result.field]: result.error } };

  await rememberActiveBrand(result.brand.slug);
  revalidatePath("/", "layout");
  redirect(`/brands/${result.brand.slug}`);
}

export async function updateBrandAction(
  _: BrandFormState,
  form: FormData,
): Promise<BrandFormState> {
  await requireOperator();
  const parsed = updateBrandInput.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { status: "error", fields: fieldErrors(parsed.error) };

  const { id, ...details } = parsed.data;
  const brand = await getBrandById(db, id);
  if (!brand) return { status: "error", message: "Esa marca ya no existe." };

  if (details.codePrefix !== brand.codePrefix) {
    const rule = canChangeCodePrefix(await countBrandPosts(db, id));
    if (!rule.ok) return { status: "error", fields: { codePrefix: rule.reason } };
  }

  const result = await updateBrand(db, id, details);
  if (!result.ok) return { status: "error", fields: { [result.field]: result.error } };

  revalidatePath("/", "layout");
  if (result.brand.slug !== brand.slug) {
    // Keep the panel on this brand under its new slug.
    if ((await preferredBrandSlug()) === brand.slug) await rememberActiveBrand(result.brand.slug);
    redirect(`/brands/${result.brand.slug}`);
  }
  return { status: "ok", message: "Cambios guardados." };
}

const archiveInput = z.object({ id: z.uuid(), archived: z.enum(["true", "false"]) });

/** Archive or bring back a brand. Archived brands leave the switcher and stop generating. */
export async function setBrandArchivedAction(form: FormData): Promise<void> {
  await requireOperator();
  const { id, archived } = archiveInput.parse(Object.fromEntries(form));
  await setBrandArchived(db, id, archived === "true");
  revalidatePath("/", "layout");
}

const deleteInput = z.object({ id: z.uuid(), confirmation: z.string() });

export async function deleteBrandAction(
  _: BrandFormState,
  form: FormData,
): Promise<BrandFormState> {
  await requireOperator();
  const parsed = deleteInput.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { status: "error", message: "Datos inválidos." };

  const brand = await getBrandById(db, parsed.data.id);
  if (!brand) return { status: "error", message: "Esa marca ya no existe." };
  if (parsed.data.confirmation.trim() !== brand.name) {
    return { status: "error", message: `Escribí "${brand.name}" para confirmar.` };
  }
  const rule = canDeleteBrand(await countBrandPosts(db, brand.id));
  if (!rule.ok) return { status: "error", message: rule.reason };

  await deleteBrand(db, brand.id);
  revalidatePath("/", "layout");
  redirect("/brands");
}
