// The brand's idea bank (docs/PRD.md RF-09, docs/ARCHITECTURE.md §10). An idea is `new` until a
// carousel is generated from it (`used`) or the operator discards it. Discarded ideas stay, so
// they can come back and the AI (T10) knows what not to propose again.

/** Where an idea came from: the operator, the AI, the weekly research or a recycled post. */
export const IDEA_SOURCES = ["manual", "ai", "research", "recycled"] as const;
export type IdeaSource = (typeof IDEA_SOURCES)[number];

export const IDEA_STATUSES = ["new", "used", "discarded"] as const;
export type IdeaStatus = (typeof IDEA_STATUSES)[number];

export const IDEA_EVENTS = ["use", "discard", "restore"] as const;
export type IdeaEvent = (typeof IDEA_EVENTS)[number];

/** Only new ideas are used or discarded; only discarded ones come back. Used ideas stay used. */
export const IDEA_TRANSITIONS: Record<IdeaEvent, { from: IdeaStatus; to: IdeaStatus }> = {
  use: { from: "new", to: "used" },
  discard: { from: "new", to: "discarded" },
  restore: { from: "discarded", to: "new" },
};

/** The status after an event, or null when the event does not apply to that status. */
export function nextIdeaStatus(status: IdeaStatus, event: IdeaEvent): IdeaStatus | null {
  const transition = IDEA_TRANSITIONS[event];
  return transition.from === status ? transition.to : null;
}

// Title and angle together become the idea of "Generar con IA" (10 to 600 characters).
export const IDEA_TITLE_MIN = 10;
export const IDEA_TITLE_MAX = 200;
export const IDEA_ANGLE_MAX = 380;

/** The text the AI gets for an idea: the title, and the angle below it when there is one. */
export function ideaPrompt(idea: { title: string; angle: string }): string {
  const title = idea.title.trim();
  const angle = idea.angle.trim();
  return angle ? `${title}\n\n${angle}` : title;
}
