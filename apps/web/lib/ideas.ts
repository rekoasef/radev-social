import type { IdeaRequestTask, IdeaSource, IdeaStatus } from "@radev/core";

export const IDEA_STATUS_LABELS: Record<IdeaStatus, string> = {
  new: "Nuevas",
  used: "Usadas",
  discarded: "Descartadas",
};

export const IDEA_SOURCE_LABELS: Record<IdeaSource, string> = {
  manual: "Manual",
  ai: "IA",
  research: "Investigación",
  recycled: "Reciclada",
  series: "Serie",
};

export const IDEA_REQUEST_LABELS: Record<IdeaRequestTask, string> = {
  "ideas.generate": "Propuesta de ideas",
  "ideas.research": "Investigación",
};
