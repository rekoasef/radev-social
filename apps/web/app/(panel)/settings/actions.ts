"use server";

import {
  AI_PROVIDERS,
  AI_TASKS,
  DATA_SOURCES,
  GENERATION_WINDOW_KEY,
  MAX_MODEL_ID_LENGTH,
  normalizeLocalTime,
  parseGenerationWindow,
} from "@radev/core";
import { saveGlobalAiRoute, setSetting, storeNotification } from "@radev/db";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { queueDataRefresh, queueNotification } from "@/lib/jobs";
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

export type WindowFormState =
  | { status: "idle" }
  | { status: "ok"; message: string }
  | { status: "error"; message: string };

const windowInput = z.object({
  enabled: z.literal("on").optional(),
  start: z
    .string()
    .refine((v) => normalizeLocalTime(v) !== null, { error: "Hora de inicio inválida." }),
  end: z.string().refine((v) => normalizeLocalTime(v) !== null, { error: "Hora de fin inválida." }),
  timeZone: z.string().min(1).max(64),
});

/** The generation window: when slots.fill may start posts for the AI (phase 4, T4). */
export async function saveGenerationWindowAction(
  _: WindowFormState,
  form: FormData,
): Promise<WindowFormState> {
  await requireOperator();
  const parsed = windowInput.safeParse(Object.fromEntries(form));
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }
  const window = parseGenerationWindow({ ...parsed.data, enabled: parsed.data.enabled === "on" });
  if (window.timeZone !== parsed.data.timeZone) {
    return { status: "error", message: "Elegí una zona horaria válida." };
  }
  if (window.start === window.end) {
    return { status: "error", message: "El inicio y el fin no pueden ser la misma hora." };
  }
  await setSetting(db, GENERATION_WINDOW_KEY, window);
  revalidatePath("/settings");
  return {
    status: "ok",
    message: window.enabled ? "Generación automática activada." : "Generación automática apagada.",
  };
}

/** "Enviar prueba": a test message through the same path as every notice (phase 4, T6). */
export async function sendTestNotificationAction(): Promise<void> {
  await requireOperator();
  const now = new Date();
  const stored = await storeNotification(db, {
    key: `test:${now.toISOString()}`,
    kind: "test",
    text: "✅ Prueba de RAdev Social: los avisos llegan bien.",
  });
  if (stored) await queueNotification(stored.id);
  revalidatePath("/settings");
}
