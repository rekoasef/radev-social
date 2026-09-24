// Typed errors of a generation (docs/ARCHITECTURE.md §7). Every provider maps its failures to one
// of these, so the router and the jobs decide without knowing the provider:
// - validation: the output doesn't match the schema. Worth retrying once, with the issues as feedback.
// - rate_limited: the provider's usage limit. Try the fallback, or reschedule with backoff.
// - provider_error: anything else. `retryable` says whether trying again later could help.

export type AIError =
  | { kind: "validation"; message: string; issues: string[] }
  | { kind: "rate_limited"; message: string; retryAfterMs: number | null }
  | { kind: "provider_error"; message: string; retryable: boolean };

export const validationError = (issues: string[]): AIError => ({
  kind: "validation",
  message: `La respuesta no cumple el formato pedido (${issues.length} ${issues.length === 1 ? "problema" : "problemas"}).`,
  issues,
});

export const rateLimited = (message: string, retryAfterMs: number | null = null): AIError => ({
  kind: "rate_limited",
  message,
  retryAfterMs,
});

export const providerError = (message: string, retryable: boolean): AIError => ({
  kind: "provider_error",
  message,
  retryable,
});

/** Whether the same provider could succeed if asked again later. */
export function isRetryable(error: AIError): boolean {
  switch (error.kind) {
    case "validation":
    case "rate_limited":
      return true;
    case "provider_error":
      return error.retryable;
  }
}
