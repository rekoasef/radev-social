"use server";

import {
  canDeleteSeries,
  SERIES_BRIEF_MAX,
  SERIES_BRIEF_MIN,
  SERIES_NAME_MAX,
  SERIES_REQUIRED_SLIDES_MAX,
  slugify,
} from "@radev/core";
import {
  createSeries,
  deleteSeries,
  getBrandBySlug,
  getSeries,
  listPillars,
  type SeriesFields,
  setSeriesArchived,
  updateSeries,
} from "@radev/db";
import { HOOK_TYPES } from "@radev/slides";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { SERIES_SLIDE_CHOICES } from "@/lib/series";
import { requireOperator } from "@/lib/session";

export type SeriesFormState =
  | { status: "idle" }
  | { status: "ok"; message: string }
  | { status: "error"; message: string };

const slug = z.string().trim().min(1).max(64);

const fieldsInput = z.object({
  slug,
  name: z
    .string()
    .trim()
    .min(3, { error: "Poné un nombre de al menos 3 caracteres." })
    .max(SERIES_NAME_MAX, { error: `El nombre tiene como máximo ${SERIES_NAME_MAX} caracteres.` }),
  pillarKey: z.string().trim().max(64).optional().default(""),
  hookType: z
    .union([z.enum(HOOK_TYPES), z.literal("")])
    .optional()
    .default(""),
  brief: z
    .string()
    .trim()
    .min(SERIES_BRIEF_MIN, {
      error: `Contá la estructura en al menos ${SERIES_BRIEF_MIN} caracteres.`,
    })
    .max(SERIES_BRIEF_MAX, {
      error: `La estructura tiene como máximo ${SERIES_BRIEF_MAX} caracteres.`,
    }),
  requiredSlides: z.array(z.enum(SERIES_SLIDE_CHOICES)).max(SERIES_REQUIRED_SLIDES_MAX, {
    error: `Hasta ${SERIES_REQUIRED_SLIDES_MAX} slides obligatorias.`,
  }),
});

async function activeBrand(brandSlug: string) {
  const brand = await getBrandBySlug(db, brandSlug);
  return brand && brand.archivedAt === null ? brand : undefined;
}

const seriesPath = (brandSlug: string) => `/brands/${brandSlug}/series`;

type ParsedFields =
  | { ok: true; brand: NonNullable<Awaited<ReturnType<typeof activeBrand>>>; fields: SeriesFields }
  | { ok: false; error: string };

/** The form's fields, checked, with the pillar's id. */
async function parseFields(form: FormData): Promise<ParsedFields> {
  const parsed = fieldsInput.safeParse({
    ...Object.fromEntries(form),
    requiredSlides: [...new Set(form.getAll("requiredSlides"))],
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }
  const brand = await activeBrand(parsed.data.slug);
  if (!brand) return { ok: false, error: "Esa marca no existe o está archivada." };
  const { pillarKey, hookType, name, brief, requiredSlides } = parsed.data;
  const pillar = pillarKey
    ? (await listPillars(db, brand.id)).find((p) => p.key === pillarKey)
    : undefined;
  if (pillarKey && !pillar) return { ok: false, error: "Elegí un pilar activo de la marca." };
  const fields: SeriesFields = {
    name,
    brief,
    requiredSlides,
    pillarId: pillar?.id ?? null,
    hookType: hookType || null,
  };
  return { ok: true, brand, fields };
}

/** A new series. Its key comes from the name and never changes (ideas and posts keep it). */
export async function createSeriesAction(
  _: SeriesFormState,
  form: FormData,
): Promise<SeriesFormState> {
  await requireOperator();
  const parsed = await parseFields(form);
  if (!parsed.ok) return { status: "error", message: parsed.error };
  const key = slugify(parsed.fields.name);
  if (!key) return { status: "error", message: "El nombre necesita letras o números." };
  const result = await createSeries(db, { ...parsed.fields, brandId: parsed.brand.id, key });
  if (!result.ok) return { status: "error", message: result.error };
  revalidatePath(seriesPath(parsed.brand.slug));
  return { status: "ok", message: `Serie "${result.series.name}" creada.` };
}

export async function updateSeriesAction(
  _: SeriesFormState,
  form: FormData,
): Promise<SeriesFormState> {
  await requireOperator();
  const id = z.uuid().safeParse(form.get("id"));
  if (!id.success) return { status: "error", message: "Datos inválidos." };
  const parsed = await parseFields(form);
  if (!parsed.ok) return { status: "error", message: parsed.error };
  const series = await getSeries(db, id.data);
  if (!series || series.brandId !== parsed.brand.id) {
    return { status: "error", message: "Esa serie ya no existe." };
  }
  await updateSeries(db, series.id, parsed.fields);
  revalidatePath(seriesPath(parsed.brand.slug));
  return { status: "ok", message: "Cambios guardados." };
}

const rowInput = z.object({ slug, id: z.uuid() });

async function seriesOf(form: FormData) {
  const { slug: brandSlug, id } = rowInput.parse({ slug: form.get("slug"), id: form.get("id") });
  const brand = await activeBrand(brandSlug);
  const series = await getSeries(db, id);
  if (!brand || !series || series.brandId !== brand.id) throw new Error("Esa serie no existe.");
  return { brand, series };
}

/** Out of the AI's reach, keeping its ideas. */
export async function archiveSeriesAction(form: FormData): Promise<void> {
  await requireOperator();
  const { brand, series } = await seriesOf(form);
  await setSeriesArchived(db, series.id, true);
  revalidatePath(seriesPath(brand.slug));
}

export async function restoreSeriesAction(form: FormData): Promise<void> {
  await requireOperator();
  const { brand, series } = await seriesOf(form);
  await setSeriesArchived(db, series.id, false);
  revalidatePath(seriesPath(brand.slug));
}

/** Gone for good: only without ideas. */
export async function deleteSeriesAction(form: FormData): Promise<void> {
  await requireOperator();
  const { brand, series } = await seriesOf(form);
  const rule = canDeleteSeries(series.ideaCount);
  if (!rule.ok) throw new Error(rule.reason);
  await deleteSeries(db, series.id);
  revalidatePath(seriesPath(brand.slug));
}
