// AI tasks and providers (docs/ARCHITECTURE.md §7). Here, not in packages/ai, because the database
// (ai_routes, generation_runs) and the web use the same names.

export const AI_TASKS = [
  "carousel.generate",
  "ideas.generate",
  "ideas.research",
  "caption.variants",
  "metrics.extract",
] as const;

export type AiTask = (typeof AI_TASKS)[number];

export const AI_PROVIDERS = ["claude-code", "openrouter"] as const;

export type AiProviderId = (typeof AI_PROVIDERS)[number];

export const isAiTask = (value: string): value is AiTask => AI_TASKS.some((t) => t === value);

export const isAiProvider = (value: string): value is AiProviderId =>
  AI_PROVIDERS.some((p) => p === value);
