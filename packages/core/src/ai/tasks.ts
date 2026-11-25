// AI tasks and providers (docs/ARCHITECTURE.md §7). Here, not in packages/ai, because the database
// (ai_routes, generation_runs) and the web use the same names.

export const AI_TASKS = [
  "carousel.generate",
  "slide.rewrite",
  "ideas.generate",
  "ideas.research",
  "caption.variants",
  "metrics.extract",
  // RAdev Studio (ADR 0029): the offices of the video that use AI.
  "video.research",
  "video.images",
  "video.script",
  "video.review",
  "video.package",
] as const;

export type AiTask = (typeof AI_TASKS)[number];

export const AI_PROVIDERS = ["claude-code", "openrouter"] as const;

export type AiProviderId = (typeof AI_PROVIDERS)[number];

export const isAiTask = (value: string): value is AiTask => AI_TASKS.some((t) => t === value);

export const isAiProvider = (value: string): value is AiProviderId =>
  AI_PROVIDERS.some((p) => p === value);

/** Outcome of one attempt of a generation (generation_runs.status). */
export const GENERATION_RUN_STATUSES = ["succeeded", "failed"] as const;
export type GenerationRunStatus = (typeof GENERATION_RUN_STATUSES)[number];

/** Which place of the route the attempt took. */
export const ROUTE_ROLES = ["primary", "fallback"] as const;
export type RouteRole = (typeof ROUTE_ROLES)[number];
