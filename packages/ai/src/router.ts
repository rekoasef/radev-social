import type { AiProviderId, AiRoute, AiRouteTarget } from "@radev/core";
import { type AIError, providerError } from "./errors";
import type { AIProvider, GenerationResult, GenerationTask } from "./types";

// Runs a task through its route (docs/ARCHITECTURE.md §7): the principal first, the fallback
// when the principal hits its limit or fails. Not on a validation error: the answer came, it was
// wrong, and a regeneration with the same provider (T8) beats handing it to a weaker model.
// Every attempt is returned, so the job records each one in generation_runs.

export type RouteAttempt<T> = {
  role: "primary" | "fallback";
  target: AiRouteTarget;
  result: GenerationResult<T>;
};

export type RoutedResult<T> = {
  /** The success, or the failure the job should act on (see `finalFailure`). */
  result: GenerationResult<T>;
  attempts: RouteAttempt<T>[];
};

/** Whether a failure of the principal is worth trying on the fallback. */
export const shouldFallback = (error: AIError) => error.kind !== "validation";

/**
 * The failure that decides what the job does next. A limit wins (wait and retry: the other
 * attempt may have failed only because its credential is missing), then a failure worth
 * retrying, then the principal's.
 */
function finalFailure<T>(attempts: RouteAttempt<T>[]): GenerationResult<T> {
  const failed = attempts.map((attempt) => attempt.result).filter((result) => !result.ok);
  const rank = (result: GenerationResult<T>) => {
    if (result.ok) return 3;
    if (result.error.kind === "rate_limited") return 0;
    if (result.error.kind === "provider_error" && result.error.retryable) return 1;
    return 2;
  };
  // Stable sort: on a tie the principal (first) stays first.
  const [chosen] = [...failed].sort((a, b) => rank(a) - rank(b));
  return (
    chosen ?? { ok: false, error: providerError("La ruta no tiene intentos.", false), usage: null }
  );
}

export type Router = {
  generate<T>(route: AiRoute, task: Omit<GenerationTask<T>, "model">): Promise<RoutedResult<T>>;
};

export function createRouter(providers: Partial<Record<AiProviderId, AIProvider>>): Router {
  async function attempt<T>(
    role: RouteAttempt<T>["role"],
    target: AiRouteTarget,
    task: Omit<GenerationTask<T>, "model">,
  ): Promise<RouteAttempt<T>> {
    const provider = providers[target.provider];
    const result: GenerationResult<T> = provider
      ? await provider.generate({ ...task, model: target.model })
      : {
          ok: false,
          error: providerError(`El proveedor ${target.provider} no está configurado.`, false),
          usage: null,
        };
    return { role, target, result };
  }

  return {
    async generate<T>(route: AiRoute, task: Omit<GenerationTask<T>, "model">) {
      const attempts: RouteAttempt<T>[] = [await attempt("primary", route.primary, task)];
      const first = attempts[0]?.result;
      if (first?.ok) return { result: first, attempts };
      if (
        first &&
        !first.ok &&
        route.fallback &&
        shouldFallback(first.error) &&
        !task.signal?.aborted
      ) {
        attempts.push(await attempt("fallback", route.fallback, task));
        const second = attempts[1]?.result;
        if (second?.ok) return { result: second, attempts };
      }
      return { result: finalFailure(attempts), attempts };
    },
  };
}
