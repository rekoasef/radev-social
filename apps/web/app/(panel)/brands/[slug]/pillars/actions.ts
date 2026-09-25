"use server";

import {
  canDeletePillar,
  canRemovePillar,
  checkPillarMix,
  PILLAR_DESCRIPTION_MAX,
  PILLAR_NAME_MAX,
  percentToShare,
  slugify,
} from "@radev/core";
import {
  createPillar,
  deletePillar,
  getBrandBySlug,
  getPillar,
  savePillarMix,
  setPillarArchived,
} from "@radev/db";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireOperator } from "@/lib/session";

export type PillarFormState =
  | { status: "idle" }
  | { status: "ok"; message: string }
  | { status: "error"; message: string };

const slug = z.string().trim().min(1).max(64);
const name = z
  .string()
  .trim()
  .min(2, { error: "Poné un nombre de al menos 2 caracteres." })
  .max(PILLAR_NAME_MAX, { error: `El nombre tiene como máximo ${PILLAR_NAME_MAX} caracteres.` });
const description = z
  .string()
  .trim()
  .max(PILLAR_DESCRIPTION_MAX, {
    error: `La descripción tiene como máximo ${PILLAR_DESCRIPTION_MAX} caracteres.`,
  });

async function activeBrand(brandSlug: string) {
  const brand = await getBrandBySlug(db, brandSlug);
  return brand && brand.archivedAt === null ? brand : undefined;
}

const pillarsPath = (brandSlug: string) => `/brands/${brandSlug}/pillars`;

function firstIssue(error: z.ZodError): PillarFormState {
  return { status: "error", message: error.issues[0]?.message ?? "Datos inválidos." };
}

const createInput = z.object({ slug, name, description });

/** A new pillar, at 0 %: its key comes from the name and never changes (posts keep it). */
export async function createPillarAction(
  _: PillarFormState,
  form: FormData,
): Promise<PillarFormState> {
  await requireOperator();
  const parsed = createInput.safeParse(Object.fromEntries(form));
  if (!parsed.success) return firstIssue(parsed.error);
  const brand = await activeBrand(parsed.data.slug);
  if (!brand) return { status: "error", message: "Esa marca no existe o está archivada." };

  const key = slugify(parsed.data.name);
  if (!key) return { status: "error", message: "El nombre necesita letras o números." };
  const result = await createPillar(db, {
    brandId: brand.id,
    key,
    name: parsed.data.name,
    description: parsed.data.description,
  });
  if (!result.ok) return { status: "error", message: result.error };

  revalidatePath(pillarsPath(brand.slug));
  return {
    status: "ok",
    message: `"${result.pillar.name}" creado con 0 %: dale su parte en la mezcla.`,
  };
}

const percent = z.coerce
  .number({ error: "Cada porcentaje es un número entero de 0 a 100." })
  .int({ error: "Cada porcentaje es un número entero de 0 a 100." })
  .min(0, { error: "Cada porcentaje es un número entero de 0 a 100." })
  .max(100, { error: "Cada porcentaje es un número entero de 0 a 100." });
const mixInput = z.object({
  slug,
  rows: z
    .array(z.object({ id: z.uuid(), name, description, percent }))
    .min(1, { error: "La marca necesita al menos un pilar." }),
});

/** Names, descriptions and percentages of every active pillar at once: they add up to 100 %. */
export async function savePillarMixAction(
  _: PillarFormState,
  form: FormData,
): Promise<PillarFormState> {
  await requireOperator();
  const ids = form.getAll("id");
  const names = form.getAll("name");
  const descriptions = form.getAll("description");
  const percents = form.getAll("percent");
  const parsed = mixInput.safeParse({
    slug: form.get("slug"),
    rows: ids.map((id, i) => ({
      id,
      name: names[i],
      description: descriptions[i],
      percent: percents[i],
    })),
  });
  if (!parsed.success) return firstIssue(parsed.error);
  const brand = await activeBrand(parsed.data.slug);
  if (!brand) return { status: "error", message: "Esa marca no existe o está archivada." };

  const { rows } = parsed.data;
  const mix = checkPillarMix(rows.map((row) => row.percent));
  if (!mix.ok) return { status: "error", message: mix.reason };

  const result = await savePillarMix(
    db,
    brand.id,
    rows.map((row) => ({ ...row, share: percentToShare(row.percent) })),
  );
  if (!result.ok) return { status: "error", message: result.error };

  revalidatePath(pillarsPath(brand.slug));
  return { status: "ok", message: "Pilares guardados." };
}

// The row buttons live inside the mix form, full of `id` fields: they send theirs as `pillar`.
const pillarInput = z.object({ slug, pillar: z.uuid() });

/** The pillar a row button points to, of this brand (which has to be active). */
async function pillarOf(form: FormData) {
  const { slug: brandSlug, pillar: id } = pillarInput.parse({
    slug: form.get("slug"),
    pillar: form.get("pillar"),
  });
  const brand = await activeBrand(brandSlug);
  const pillar = await getPillar(db, id);
  if (!brand || !pillar || pillar.brandId !== brand.id) throw new Error("Ese pilar no existe.");
  return { brand, pillar };
}

/** Out of the mix, keeping its posts. Only at 0 % (the button only shows then). */
export async function archivePillarAction(form: FormData): Promise<void> {
  await requireOperator();
  const { brand, pillar } = await pillarOf(form);
  const rule = canRemovePillar(pillar.targetShare);
  if (!rule.ok) throw new Error(rule.reason);
  await setPillarArchived(db, pillar.id, true);
  revalidatePath(pillarsPath(brand.slug));
}

/** Back into the mix at 0 %. */
export async function restorePillarAction(form: FormData): Promise<void> {
  await requireOperator();
  const { brand, pillar } = await pillarOf(form);
  await setPillarArchived(db, pillar.id, false);
  revalidatePath(pillarsPath(brand.slug));
}

/** Gone for good: only without posts, and (if it is active) at 0 %. */
export async function deletePillarAction(form: FormData): Promise<void> {
  await requireOperator();
  const { brand, pillar } = await pillarOf(form);
  const rules = [
    canDeletePillar(pillar.postCount),
    pillar.archivedAt ? { ok: true as const } : canRemovePillar(pillar.targetShare),
  ];
  for (const rule of rules) if (!rule.ok) throw new Error(rule.reason);
  await deletePillar(db, pillar.id);
  revalidatePath(pillarsPath(brand.slug));
}
