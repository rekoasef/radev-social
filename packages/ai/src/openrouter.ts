import { type AIError, providerError, rateLimited } from "./errors";
import { parseJsonText, toJsonSchema } from "./schema";
import type { AIProvider, GenerationResult, GenerationTask, Usage } from "./types";

// openrouter provider: OpenRouter's HTTP API (OpenAI compatible) with free models
// (docs/ARCHITECTURE.md §7, ADR 0009). No tools: the context files travel inside the messages.
// It only ever gets content meant to be public; the API key goes in a header and nowhere else.

export const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
export const DEFAULT_OPENROUTER_TIMEOUT_MS = 2 * 60_000;

/** Free variants end in `:free`. Anything else could charge the account (CLAUDE.md, rule 13). */
export const isFreeModel = (model: string) => model.endsWith(":free");

/**
 * Messages of a run. CLAUDE.md (the brand's instructions) goes as the system message; the other
 * files go in the user message under their names, since the instructions refer to them by name.
 * The JSON Schema is also in the text: not every free model supports structured output.
 */
export function buildOpenRouterMessages(
  task: GenerationTask<unknown>,
): { role: "system" | "user"; content: string }[] {
  const { "CLAUDE.md": instructions, ...rest } = task.files;
  const files = Object.entries(rest).map(
    ([name, content]) => `### Archivo \`${name}\`\n\n\`\`\`\n${content}\n\`\`\``,
  );
  const user = [
    task.prompt,
    files.length > 0
      ? `Los archivos que mencionan las instrucciones están acá:\n\n${files.join("\n\n")}`
      : "",
    `Respondé solo con un objeto JSON que cumpla este JSON Schema, sin texto antes ni después:\n\n${JSON.stringify(toJsonSchema(task.schema))}`,
  ].filter(Boolean);
  return [
    ...(instructions ? [{ role: "system" as const, content: instructions }] : []),
    { role: "user" as const, content: user.join("\n\n") },
  ];
}

export function buildOpenRouterBody(
  task: GenerationTask<unknown>,
  structured: boolean,
): Record<string, unknown> {
  return {
    model: task.model,
    messages: buildOpenRouterMessages(task),
    ...(structured && {
      response_format: {
        type: "json_schema",
        // Not strict: strict mode requires every field and forbids optional ones, and our
        // schemas have both. Zod checks the result anyway (rule 4).
        json_schema: { name: "output", strict: false, schema: toJsonSchema(task.schema) },
      },
      // Only endpoints that honor response_format.
      provider: { require_parameters: true },
    }),
  };
}

type ChatResponse = {
  model?: string;
  id?: string;
  error?: { code?: number; message?: string };
  choices?: {
    finish_reason?: string | null;
    message?: { content?: string | null };
    error?: { code?: number; message?: string };
  }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number; cost?: number };
};

/** Milliseconds until a retry, from `Retry-After` (seconds or a date) or `X-RateLimit-Reset`. */
export function retryAfterMs(headers: Headers, now = Date.now()): number | null {
  const retryAfter = headers.get("retry-after");
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
    const date = Date.parse(retryAfter);
    if (!Number.isNaN(date)) return Math.max(0, date - now);
  }
  const reset = Number(headers.get("x-ratelimit-reset"));
  // Epoch in milliseconds (13 digits) or seconds.
  if (Number.isFinite(reset) && reset > 0) {
    const resetMs = reset > 1e12 ? reset : reset * 1000;
    return resetMs > now ? resetMs - now : null;
  }
  return null;
}

/** Error of an HTTP status (or of an error inside a 200 answer). */
export function classifyOpenRouterError(
  status: number,
  message: string,
  retryAfter: number | null = null,
): AIError {
  const detail = message.trim().slice(0, 300) || "sin detalle";
  if (status === 429) {
    return rateLimited(`OpenRouter llegó al límite de uso: ${detail}`, retryAfter);
  }
  if (status === 401) {
    return providerError(
      `OpenRouter rechazó la API key. Revisá OPENROUTER_API_KEY: ${detail}`,
      false,
    );
  }
  if (status === 402) {
    return providerError(`OpenRouter pide créditos (¿el modelo no es gratuito?): ${detail}`, false);
  }
  if (status === 408 || status >= 500) {
    return providerError(`OpenRouter falló (HTTP ${status}): ${detail}`, true);
  }
  // 400, 403 (moderation), 404: asking the same again won't fix it.
  return providerError(`OpenRouter devolvió HTTP ${status}: ${detail}`, false);
}

/**
 * The model can't take response_format (or no endpoint of it can): 404 "No endpoints found that
 * support…" or 400 about the parameter. Then the run is retried once without it.
 */
const unsupportedStructured = (status: number, message: string) =>
  (status === 404 || status === 400) && /response_format|structured|support/i.test(message);

export type OpenRouterOptions = {
  /** Environment to read OPENROUTER_API_KEY from. Default: process.env. */
  env?: NodeJS.ProcessEnv;
  /** For tests. Default: global fetch. */
  fetch?: typeof fetch;
  url?: string;
  /** Allow models without `:free` (they may cost money). Off: the goal is USD 0 (rule 13). */
  allowPaidModels?: boolean;
};

export function createOpenRouterProvider(options: OpenRouterOptions = {}): AIProvider {
  const env = options.env ?? process.env;
  const apiKey = env.OPENROUTER_API_KEY?.trim();
  const doFetch = options.fetch ?? fetch;
  const url = options.url ?? OPENROUTER_URL;

  return {
    id: "openrouter",
    async generate<T>(task: GenerationTask<T>): Promise<GenerationResult<T>> {
      const fail = (error: AIError): GenerationResult<T> => ({ ok: false, error, usage: null });
      if (!apiKey) {
        return fail(
          providerError(
            "Falta la API key de OpenRouter: definí OPENROUTER_API_KEY en el .env.",
            false,
          ),
        );
      }
      if (!options.allowPaidModels && !isFreeModel(task.model)) {
        return fail(
          providerError(
            `El modelo ${task.model} no es gratuito (tiene que terminar en ":free"). Elegí otro en el ruteo.`,
            false,
          ),
        );
      }
      if (task.tools && task.tools.length > 0) {
        return fail(
          providerError(
            `OpenRouter no tiene herramientas (${task.tools.join(", ")}): esta tarea va con claude-code.`,
            false,
          ),
        );
      }

      const timeoutMs = task.timeoutMs ?? DEFAULT_OPENROUTER_TIMEOUT_MS;
      const timeout = AbortSignal.timeout(timeoutMs);
      const signal = task.signal ? AbortSignal.any([task.signal, timeout]) : timeout;
      const startedAt = Date.now();

      const request = async (structured: boolean) => {
        const response = await doFetch(url, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
            "X-Title": "RAdev Social",
          },
          body: JSON.stringify(buildOpenRouterBody(task as GenerationTask<unknown>, structured)),
          signal,
        });
        let body: ChatResponse | null = null;
        try {
          body = (await response.json()) as ChatResponse;
        } catch {
          body = null;
        }
        return { response, body };
      };

      let answer: Awaited<ReturnType<typeof request>>;
      try {
        answer = await request(true);
        const message = answer.body?.error?.message ?? "";
        if (!answer.response.ok && unsupportedStructured(answer.response.status, message)) {
          answer = await request(false);
        }
      } catch (error) {
        if (task.signal?.aborted) return fail(providerError("La generación se canceló.", true));
        if (timeout.aborted) {
          return fail(
            providerError(
              `OpenRouter no respondió en ${Math.round(timeoutMs / 1000)} s y se cortó.`,
              true,
            ),
          );
        }
        const reason = error instanceof Error ? error.message : String(error);
        return fail(providerError(`No se pudo conectar con OpenRouter (${reason}).`, true));
      }

      const { response, body } = answer;
      if (!response.ok) {
        return fail(
          classifyOpenRouterError(
            response.status,
            body?.error?.message ?? response.statusText,
            retryAfterMs(response.headers),
          ),
        );
      }
      const choice = body?.choices?.[0];
      const inlineError = body?.error ?? choice?.error;
      if (inlineError) {
        return fail(
          classifyOpenRouterError(inlineError.code ?? 502, inlineError.message ?? "", null),
        );
      }

      const usage: Usage = {
        provider: "openrouter",
        model: body?.model ?? task.model,
        inputTokens: body?.usage?.prompt_tokens ?? 0,
        outputTokens: body?.usage?.completion_tokens ?? 0,
        costUsd: body?.usage?.cost ?? null,
        durationMs: Date.now() - startedAt,
        numTurns: 1,
        sessionId: body?.id ?? null,
      };
      if (choice?.finish_reason === "length") {
        return {
          ok: false,
          error: providerError("La respuesta de OpenRouter se cortó por largo.", true),
          usage,
        };
      }
      const parsed = parseJsonText(task.schema, choice?.message?.content ?? "");
      return parsed.ok
        ? { ok: true, data: parsed.data, usage }
        : { ok: false, error: parsed.error, usage };
    },
  };
}
