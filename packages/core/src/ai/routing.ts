import type { AiProviderId, AiTask } from "./tasks";

// Which provider and model each AI task uses (docs/ARCHITECTURE.md §7, "Ruteo por tarea").
// The routes live in the database (ai_routes) and are edited from the panel; these are the rules
// they have to follow, shared by the panel, the seed and the worker.

export const AI_TASK_LABELS: Record<AiTask, string> = {
  "carousel.generate": "Generar carrusel",
  "ideas.generate": "Generar ideas",
  "ideas.research": "Investigar temas",
  "caption.variants": "Variantes de descripción",
  "metrics.extract": "Leer capturas de métricas",
};

export const AI_PROVIDER_LABELS: Record<AiProviderId, string> = {
  "claude-code": "Claude Code (suscripción)",
  openrouter: "OpenRouter (gratuito)",
};

/** Tasks that need tools (web search, reading images): only claude-code has them. */
export const TOOL_TASKS: readonly AiTask[] = ["ideas.research", "metrics.extract"];

export const MAX_MODEL_ID_LENGTH = 200;

/** OpenRouter's free variants end in `:free`; any other model could cost money (rule 13). */
export const isFreeModel = (model: string) => model.trim().endsWith(":free");

export type AiRouteTarget = { provider: AiProviderId; model: string };

export type AiRoute = {
  task: AiTask;
  /** Null: the global route. A brand's own route wins over it. */
  brandId: string | null;
  primary: AiRouteTarget;
  fallback: AiRouteTarget | null;
};

/** The route of a task for a brand: its own one if it has it, else the global one. */
export function resolveAiRoute(
  routes: readonly AiRoute[],
  task: AiTask,
  brandId: string,
): AiRoute | null {
  const forTask = routes.filter((route) => route.task === task);
  return (
    forTask.find((route) => route.brandId === brandId) ??
    forTask.find((route) => route.brandId === null) ??
    null
  );
}

function checkTarget(task: AiTask, target: AiRouteTarget, role: string): string[] {
  const problems: string[] = [];
  const model = target.model.trim();
  if (model === "") problems.push(`Falta el modelo ${role}.`);
  else if (model.length > MAX_MODEL_ID_LENGTH)
    problems.push(`El modelo ${role} es demasiado largo.`);
  if (target.provider === "openrouter" && model !== "" && !isFreeModel(model)) {
    problems.push(`El modelo ${role} de OpenRouter tiene que ser gratuito (terminar en ":free").`);
  }
  if (target.provider !== "claude-code" && TOOL_TASKS.includes(task)) {
    problems.push(
      `"${AI_TASK_LABELS[task]}" necesita herramientas: el ${role} tiene que ser Claude Code.`,
    );
  }
  return problems;
}

/** Problems of a route, in Spanish for the panel. Empty when it can be saved. */
export function checkAiRoute(route: Pick<AiRoute, "task" | "primary" | "fallback">): string[] {
  const problems = checkTarget(route.task, route.primary, "principal");
  if (route.fallback) {
    problems.push(...checkTarget(route.task, route.fallback, "de respaldo"));
    if (
      route.fallback.provider === route.primary.provider &&
      route.fallback.model.trim() === route.primary.model.trim()
    ) {
      problems.push("El respaldo es igual al principal.");
    }
  }
  return problems;
}
