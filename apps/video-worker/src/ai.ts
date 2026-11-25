import type { AIError, Router, TaskImage } from "@radev/ai";
import { type AiTask, resolveAiRoute } from "@radev/core";
import {
  type Database,
  listAiRoutes,
  type NewGenerationRun,
  recordGenerationRun,
  type Video,
} from "@radev/db";
import type { z } from "zod";
import type { AiLock } from "./ai-lock";

// What an office asks of the AI: one call through the task's route (principal, then fallback), one
// `generation_runs` row per attempt (with the video and, if it has one, its brand), and the lock so
// only one `claude -p` runs at a time.

export type AiRequest<T> = {
  task: AiTask;
  prompt: string;
  files: Record<string, string>;
  schema: z.ZodType<T>;
  images?: readonly TaskImage[];
  tools?: readonly string[];
  effort?: "low" | "medium" | "high";
  maxTurns?: number;
  timeoutMs?: number;
};

export type AiAnswer<T> = { ok: true; data: T; runId: string } | { ok: false; error: AIError };

export type VideoAi = {
  run<T>(video: Pick<Video, "id" | "brandId">, request: AiRequest<T>): Promise<AiAnswer<T>>;
};

export function createVideoAi(deps: { db: Database; router: Router; lock: AiLock }): VideoAi {
  return {
    async run<T>(video: Pick<Video, "id" | "brandId">, request: AiRequest<T>) {
      return deps.lock.run(async (): Promise<AiAnswer<T>> => {
        const routes = await listAiRoutes(deps.db);
        // A video without a brand uses the global route: an empty id never matches a brand's.
        const route = resolveAiRoute(routes, request.task, video.brandId ?? "");
        if (!route) {
          return {
            ok: false,
            error: {
              kind: "provider_error",
              message: `No hay una ruta de IA para la tarea ${request.task} (Ajustes → Ruteo de IA).`,
              retryable: false,
            },
          };
        }
        const routed = await deps.router.generate(route, {
          task: request.task,
          brandId: video.brandId ?? `video:${video.id}`,
          prompt: request.prompt,
          files: request.files,
          schema: request.schema,
          images: request.images,
          tools: request.tools,
          effort: request.effort,
          maxTurns: request.maxTurns,
          timeoutMs: request.timeoutMs,
        });
        // Every attempt is recorded (the usage is what the panel reports per office).
        let okRunId: string | null = null;
        for (const attempt of routed.attempts) {
          const { result, target, role } = attempt;
          const usage = result.usage;
          const row: NewGenerationRun = {
            brandId: video.brandId,
            videoId: video.id,
            task: request.task,
            role,
            provider: target.provider,
            model: usage?.model ?? target.model,
            status: result.ok ? "succeeded" : "failed",
            errorKind: result.ok ? null : result.error.kind,
            error: result.ok ? null : result.error.message.slice(0, 2000),
            inputTokens: usage?.inputTokens ?? 0,
            outputTokens: usage?.outputTokens ?? 0,
            costUsd: usage?.costUsd ?? null,
            durationMs: usage?.durationMs ?? null,
            numTurns: usage?.numTurns ?? null,
            sessionId: usage?.sessionId ?? null,
          };
          const id = await recordGenerationRun(deps.db, row);
          if (result.ok && okRunId === null) okRunId = id;
        }
        if (routed.result.ok && okRunId) {
          return { ok: true, data: routed.result.data, runId: okRunId };
        }
        return {
          ok: false,
          error: routed.result.ok
            ? { kind: "provider_error", message: "Respuesta sin registrar.", retryable: true }
            : routed.result.error,
        };
      });
    },
  };
}
