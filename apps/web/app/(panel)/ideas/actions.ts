"use server";

import {
  IDEA_ANGLE_MAX,
  IDEA_COUNT_MAX,
  IDEA_COUNT_MIN,
  IDEA_REQUEST_TASKS,
  IDEA_TITLE_MAX,
  IDEA_TITLE_MIN,
  RESEARCH_FOCUS_MAX,
} from "@radev/core";
import {
  createIdea,
  createIdeaRequest,
  failIdeaRequest,
  getBrandById,
  getSeriesByKey,
  listPillars,
  transitionIdea,
} from "@radev/db";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { queueIdeaRequest } from "@/lib/jobs";
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

const requestInput = z.object({
  brandId: z.uuid(),
  task: z.enum(IDEA_REQUEST_TASKS),
  count: z.coerce
    .number()
    .int()
    .min(IDEA_COUNT_MIN, { error: `Pedí de ${IDEA_COUNT_MIN} a ${IDEA_COUNT_MAX} ideas.` })
    .max(IDEA_COUNT_MAX, { error: `Pedí de ${IDEA_COUNT_MIN} a ${IDEA_COUNT_MAX} ideas.` }),
  pillarKey: z.string().trim().max(64).optional().default(""),
  seriesKey: z.string().trim().max(64).optional().default(""),
  focus: z
    .string()
    .trim()
    .max(RESEARCH_FOCUS_MAX, {
      error: `El foco tiene como máximo ${RESEARCH_FOCUS_MAX} caracteres.`,
    })
    .optional()
    .default(""),
});

/**
 * "Proponer ideas" (ideas.generate) or "Investigar temas" (ideas.research): stores the request and
 * queues the worker's job. The web never runs AI (CLAUDE.md, rule 5). Requests for ideas do not
 * count for the brand's caps (phase 3, T10).
 */
export async function requestIdeasAction(_: IdeaFormState, form: FormData): Promise<IdeaFormState> {
  await requireOperator();
  const parsed = requestInput.safeParse(Object.fromEntries(form));
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }
  const { brandId, task, count, pillarKey, seriesKey, focus } = parsed.data;
  const brand = await getBrandById(db, brandId);
  if (!brand || brand.archivedAt) {
    return { status: "error", message: "Esa marca no existe o está archivada." };
  }
  if (pillarKey && !(await listPillars(db, brand.id)).some((p) => p.key === pillarKey)) {
    return { status: "error", message: "Elegí un pilar de la marca." };
  }
  if (task === "ideas.generate" && seriesKey) {
    const series = await getSeriesByKey(db, brand.id, seriesKey);
    if (!series || series.archivedAt)
      return { status: "error", message: "Elegí una serie activa." };
  }

  const result = await createIdeaRequest(db, {
    brandId: brand.id,
    task,
    params: {
      count,
      pillarKey: pillarKey || null,
      seriesKey: task === "ideas.generate" ? seriesKey || null : null,
      focus: task === "ideas.research" ? focus || null : null,
    },
  });
  if (!result.ok) {
    return { status: "error", message: "Ya hay un pedido igual en curso: esperá a que termine." };
  }
  try {
    await queueIdeaRequest(task, result.request.id);
  } catch (error) {
    // Closed, so the next click can ask again.
    await failIdeaRequest(db, result.request.id, "No se pudo encolar el pedido.");
    throw error;
  }
  revalidatePath("/ideas");
  return {
    status: "ok",
    message:
      task === "ideas.research"
        ? "Investigando: puede tardar unos minutos."
        : "Pidiendo ideas: tarda alrededor de un minuto.",
  };
}
