"use server";

import { IDEA_ANGLE_MAX, IDEA_TITLE_MAX, IDEA_TITLE_MIN } from "@radev/core";
import { createIdea, getBrandById, listPillars, transitionIdea } from "@radev/db";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireOperator } from "@/lib/session";

export type IdeaFormState =
  | { status: "idle" }
  | { status: "ok"; message: string }
  | { status: "error"; message: string };

const createInput = z.object({
  brandId: z.uuid(),
  title: z
    .string()
    .trim()
    .min(IDEA_TITLE_MIN, { error: `Contá la idea en al menos ${IDEA_TITLE_MIN} caracteres.` })
    .max(IDEA_TITLE_MAX, { error: `La idea tiene como máximo ${IDEA_TITLE_MAX} caracteres.` }),
  angle: z
    .string()
    .trim()
    .max(IDEA_ANGLE_MAX, { error: `El ángulo tiene como máximo ${IDEA_ANGLE_MAX} caracteres.` })
    .optional()
    .default(""),
  // Empty: the AI picks the pillar when the idea is generated.
  pillarKey: z.string().trim().max(64).optional().default(""),
});

/** An idea typed by the operator (quick load, from the phone too). */
export async function createIdeaAction(_: IdeaFormState, form: FormData): Promise<IdeaFormState> {
  await requireOperator();
  const parsed = createInput.safeParse(Object.fromEntries(form));
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }
  const { brandId, title, angle, pillarKey } = parsed.data;
  const brand = await getBrandById(db, brandId);
  if (!brand || brand.archivedAt) {
    return { status: "error", message: "Esa marca no existe o está archivada." };
  }
  const pillar = pillarKey
    ? (await listPillars(db, brand.id)).find((p) => p.key === pillarKey)
    : undefined;
  if (pillarKey && !pillar) return { status: "error", message: "Elegí un pilar de la marca." };

  await createIdea(db, {
    brandId: brand.id,
    pillarId: pillar?.id ?? null,
    title,
    angle,
    source: "manual",
  });
  revalidatePath("/ideas");
  return { status: "ok", message: "Idea guardada." };
}

const eventInput = z.object({
  brandId: z.uuid(),
  id: z.uuid(),
  event: z.enum(["discard", "restore"]),
});

/** Discard an idea or bring it back. An idea that already moved on is left as it is. */
export async function ideaEventAction(form: FormData): Promise<void> {
  await requireOperator();
  const { brandId, id, event } = eventInput.parse(Object.fromEntries(form));
  await transitionIdea(db, { id, brandId, event });
  revalidatePath("/ideas");
}
