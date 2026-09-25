"use server";

import { AI_PROVIDERS, AI_TASKS, DATA_SOURCES, MAX_MODEL_ID_LENGTH } from "@radev/core";
import { saveGlobalAiRoute } from "@radev/db";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { queueDataRefresh } from "@/lib/jobs";
import { requireOperator } from "@/lib/session";

export type RouteFormState =
  | { status: "idle" }
  | { status: "ok"; message: string }
  | { status: "error"; errors: string[] };

const model = z
  .string()
  .trim()
  .max(MAX_MODEL_ID_LENGTH, { error: "El modelo es demasiado largo." });

const routeInput = z.object({
  task: z.enum(AI_TASKS),
  provider: z.enum(AI_PROVIDERS),
  model,
  // "none": no fallback.
  fallbackProvider: z.enum([...AI_PROVIDERS, "none"]),
  fallbackModel: model.optional().default(""),
});

/** Saves the global route of a task. The routing rules live in checkAiRoute (packages/core). */
export async function saveRouteAction(_: RouteFormState, form: FormData): Promise<RouteFormState> {
  await requireOperator();
  const parsed = routeInput.safeParse(Object.fromEntries(form));
  if (!parsed.success) {
    return { status: "error", errors: parsed.error.issues.map((issue) => issue.message) };
  }
  const { task, provider, fallbackProvider, fallbackModel } = parsed.data;
  const result = await saveGlobalAiRoute(db, {
    task,
    primary: { provider, model: parsed.data.model },
    fallback:
      fallbackProvider === "none" ? null : { provider: fallbackProvider, model: fallbackModel },
  });
  if (!result.ok) return { status: "error", errors: result.errors };

  revalidatePath("/settings");
  return { status: "ok", message: "Ruta guardada." };
}

const refreshInput = z.object({ source: z.enum(DATA_SOURCES) });

/** "Actualizar ahora": the worker fetches the source's data of today (data.refresh). */
export async function refreshDataAction(form: FormData): Promise<void> {
  await requireOperator();
  const { source } = refreshInput.parse(Object.fromEntries(form));
  await queueDataRefresh(source);
  revalidatePath("/settings");
}
