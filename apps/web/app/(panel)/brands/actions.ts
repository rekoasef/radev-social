"use server";

import {
  canChangeCodePrefix,
  canDeleteBrand,
  DATA_SOURCES,
  normalizeWebsite,
  normalizeWhatsappMessage,
  normalizeWhatsappNumber,
} from "@radev/core";
import {
  countBrandPosts,
  createBrand,
  deleteBrand,
  getBrandById,
  setBrandAiLimits,
  setBrandArchived,
  setBrandContact,
  setBrandDataSources,
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

export type AiLimitsFormState =
  | { status: "idle" }
  | { status: "ok"; message: string }
  | { status: "error"; message: string };

/** Empty field: no cap. Otherwise a whole number from 0 (0 pauses generation). */
const aiLimit = z
  .string()
  .trim()
  .transform((value) => (value === "" ? null : Number(value)))
  .pipe(
    z
      .number({ error: "Poné un número entero o dejalo vacío." })
      .int({ error: "Poné un número entero o dejalo vacío." })
      .min(0, { error: "El tope no puede ser negativo." })
      .max(1000, { error: "Máximo 1000." })
      .nullable(),
  );
const aiLimitsInput = z.object({ id: z.uuid(), daily: aiLimit, monthly: aiLimit });

/** A brand's caps of successful AI generations (docs/ARCHITECTURE.md §7, "Topes propios"). */
export async function saveAiLimitsAction(
  _: AiLimitsFormState,
  form: FormData,
): Promise<AiLimitsFormState> {
  await requireOperator();
  const parsed = aiLimitsInput.safeParse(Object.fromEntries(form));
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }
  const { id, daily, monthly } = parsed.data;
  const brand = await getBrandById(db, id);
  if (!brand || brand.archivedAt !== null) {
    return { status: "error", message: "Esa marca no existe o está archivada." };
  }
  if (daily !== null && monthly !== null && daily > monthly) {
    return { status: "error", message: "El tope diario no puede ser mayor que el mensual." };
  }
  await setBrandAiLimits(db, id, { daily, monthly });
  revalidatePath(`/brands/${brand.slug}`);
  return { status: "ok", message: "Topes guardados." };
}

export type ContactFormState =
  | { status: "idle" }
  | { status: "ok"; message: string }
  | { status: "error"; field?: "website" | "number" | "message"; message: string };

const contactInput = z.object({
  id: z.uuid(),
  website: z.string().max(300, { error: "Esa dirección es demasiado larga." }),
  number: z.string().max(40, { error: "Ese número es demasiado largo." }),
  message: z.string().max(1000, { error: "El mensaje es demasiado largo." }),
});

/**
 * Where the calls to action send people (docs/PRD.md RF-07): the website, or the WhatsApp and its
 * prefilled message. The website wins when both are set (ADR 0023).
 */
export async function saveContactAction(
  _: ContactFormState,
  form: FormData,
): Promise<ContactFormState> {
  await requireOperator();
  const parsed = contactInput.safeParse(Object.fromEntries(form));
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }
  const brand = await getBrandById(db, parsed.data.id);
  if (!brand || brand.archivedAt !== null) {
    return { status: "error", message: "Esa marca no existe o está archivada." };
  }
  const website = normalizeWebsite(parsed.data.website);
  if (!website.ok) return { status: "error", field: "website", message: website.reason };
  const number = normalizeWhatsappNumber(parsed.data.number);
  if (!number.ok) return { status: "error", field: "number", message: number.reason };
  const message = normalizeWhatsappMessage(parsed.data.message);
  if (!message.ok) return { status: "error", field: "message", message: message.reason };
  if (message.value && !number.value) {
    return {
      status: "error",
      field: "number",
      message: "Poné el número: el mensaje precargado solo sirve con un WhatsApp.",
    };
  }

  await setBrandContact(db, brand.id, {
    website: website.value,
    whatsappNumber: number.value,
    whatsappMessageTemplate: message.value,
  });
  revalidatePath(`/brands/${brand.slug}`);
  return { status: "ok", message: "Contacto guardado." };
}

export type DataSourcesFormState =
  | { status: "idle" }
  | { status: "ok"; message: string }
  | { status: "error"; message: string };

const dataSourcesInput = z.object({
  id: z.uuid(),
  sources: z.array(z.enum(DATA_SOURCES)).max(DATA_SOURCES.length),
});

/** The data sources whose numbers the brand's content may show (phase 3, T11). */
export async function saveDataSourcesAction(
  _: DataSourcesFormState,
  form: FormData,
): Promise<DataSourcesFormState> {
  await requireOperator();
  const parsed = dataSourcesInput.safeParse({
    id: form.get("id"),
    sources: form.getAll("sources"),
  });
  if (!parsed.success) return { status: "error", message: "Datos inválidos." };
  const brand = await getBrandById(db, parsed.data.id);
  if (!brand || brand.archivedAt !== null) {
    return { status: "error", message: "Esa marca no existe o está archivada." };
  }
  await setBrandDataSources(db, brand.id, parsed.data.sources);
  revalidatePath(`/brands/${brand.slug}`);
  return { status: "ok", message: "Fuentes guardadas." };
}
