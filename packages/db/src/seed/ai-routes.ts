import type { AiRouteTarget, AiTask } from "@radev/core";

// Initial global AI routes (docs/ARCHITECTURE.md §7). Loaded only when a task has no global
// route yet: after that they belong to the panel (Ajustes → Ruteo de IA).

const claude: AiRouteTarget = { provider: "claude-code", model: "sonnet" };
/** Answered well in the phase 3, T10 real test. The free offer rotates: change it from the panel. */
const free: AiRouteTarget = {
  provider: "openrouter",
  model: "nvidia/nemotron-3-super-120b-a12b:free",
};

export const seedAiRoutes: {
  task: AiTask;
  primary: AiRouteTarget;
  fallback: AiRouteTarget | null;
}[] = [
  { task: "carousel.generate", primary: claude, fallback: free },
  { task: "slide.rewrite", primary: claude, fallback: free },
  { task: "ideas.generate", primary: free, fallback: claude },
  { task: "ideas.research", primary: claude, fallback: null },
  { task: "caption.variants", primary: free, fallback: claude },
  { task: "metrics.extract", primary: claude, fallback: null },
  { task: "video.research", primary: claude, fallback: null },
  { task: "video.sources", primary: claude, fallback: null },
  { task: "video.images", primary: claude, fallback: null },
  { task: "video.script", primary: claude, fallback: null },
  { task: "video.review", primary: claude, fallback: null },
  { task: "video.package", primary: claude, fallback: null },
  { task: "video.ideas", primary: claude, fallback: null },
  { task: "video.ideas.research", primary: claude, fallback: null },
];
