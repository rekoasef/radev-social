import type { PostStatus } from "./constants";

// The only way a post's status changes (CLAUDE.md, rule 2; docs/ARCHITECTURE.md §5). Each event
// lists where it may happen from and where it leads. packages/db applies it in a transaction;
// nothing else writes `posts.status`.

export type PostEffect =
  /** A publish job is waiting for this post: cancel it. */
  "cancel_publish_job";

type Transition = {
  from: readonly PostStatus[];
  to: PostStatus;
  effects?: readonly PostEffect[];
  /** Spanish, for errors shown to the operator. */
  label: string;
};

/** Statuses a post can be born with. */
export const INITIAL_STATUSES = {
  /** Saved from the editor: its first version renders right away. */
  manual: "rendering",
  /** Created for the AI to write (phase 3). */
  ai: "generating",
} as const satisfies Record<string, PostStatus>;

export const TRANSITIONS = {
  generationDone: { from: ["generating"], to: "rendering", label: "terminar la generación" },
  generationFailed: {
    from: ["generating"],
    to: "failed",
    label: "marcar la generación como fallida",
  },
  renderDone: { from: ["rendering"], to: "in_review", label: "terminar el render" },
  renderFailed: { from: ["rendering"], to: "failed", label: "marcar el render como fallido" },
  approve: { from: ["in_review"], to: "approved", label: "aprobar" },
  reject: { from: ["in_review"], to: "rejected", label: "rechazar" },
  regenerate: { from: ["rejected"], to: "generating", label: "regenerar" },
  /**
   * A new version from the editor (or a restored one): back to render and review. Editing an
   * approved or scheduled post takes it back too, and a scheduled one loses its publish job.
   */
  edit: {
    from: ["in_review", "approved", "scheduled", "rejected", "failed"],
    to: "rendering",
    effects: ["cancel_publish_job"],
    label: "editar",
  },
  retryRender: { from: ["failed"], to: "rendering", label: "reintentar el render" },
  retryGeneration: { from: ["failed"], to: "generating", label: "reintentar la generación" },
  schedule: { from: ["approved"], to: "scheduled", label: "programar" },
  unschedule: {
    from: ["scheduled"],
    to: "approved",
    effects: ["cancel_publish_job"],
    label: "desprogramar",
  },
  /** Publishing starts from an approved post (manual, now) or a scheduled one (at its time). */
  startPublishing: { from: ["approved", "scheduled"], to: "publishing", label: "publicar" },
  publishDone: { from: ["publishing"], to: "published", label: "marcar como publicado" },
  publishFailed: {
    from: ["publishing"],
    to: "publish_failed",
    label: "marcar la publicación como fallida",
  },
  retryPublish: { from: ["publish_failed"], to: "publishing", label: "reintentar la publicación" },
  archive: {
    from: [
      "generating",
      "rendering",
      "in_review",
      "rejected",
      "approved",
      "scheduled",
      "publish_failed",
      "failed",
    ],
    to: "archived",
    effects: ["cancel_publish_job"],
    label: "archivar",
  },
} as const satisfies Record<string, Transition>;

export type PostEvent = keyof typeof TRANSITIONS;
export const POST_EVENTS = Object.keys(TRANSITIONS) as PostEvent[];

export type TransitionResult =
  | { ok: true; to: PostStatus; effects: readonly PostEffect[] }
  | { ok: false; reason: string };

const STATUS_LABELS: Record<PostStatus, string> = {
  generating: "generándose",
  rendering: "renderizándose",
  in_review: "en revisión",
  rejected: "rechazado",
  approved: "aprobado",
  scheduled: "programado",
  publishing: "publicándose",
  published: "publicado",
  publish_failed: "con la publicación fallida",
  failed: "fallido",
  archived: "archivado",
};

/** Where `event` takes a post that is `from`, or why it cannot happen. */
export function nextStatus(from: PostStatus, event: PostEvent): TransitionResult {
  const transition: Transition = TRANSITIONS[event];
  if (!transition.from.includes(from)) {
    return { ok: false, reason: `No se puede ${transition.label} un post ${STATUS_LABELS[from]}.` };
  }
  // Effects only matter when there was something to undo (a scheduled post's job).
  const effects = from === "scheduled" ? (transition.effects ?? []) : [];
  return { ok: true, to: transition.to, effects };
}

/** Events available from a status, for the panel's buttons. */
export function availableEvents(from: PostStatus): PostEvent[] {
  return POST_EVENTS.filter((event) =>
    (TRANSITIONS[event].from as readonly PostStatus[]).includes(from),
  );
}

/** Spanish name of a status, for the panel. */
export function statusLabel(status: PostStatus): string {
  return STATUS_LABELS[status];
}
