import type { IdeaRequestStatus } from "./ideas/requests";
import { JOBS } from "./jobs";
import type { PostStatus } from "./posts/constants";

// The jobs view of the panel (phase 4, T8): what each pg-boss job is, what it works on, why it
// failed and whether running it again makes sense. Pure: the web reads the queue and the targets.

export type JobName = (typeof JOBS)[keyof typeof JOBS];

export const JOB_NAMES = Object.values(JOBS) as readonly JobName[];

export function isJobName(value: string): value is JobName {
  return (JOB_NAMES as readonly string[]).includes(value);
}

export const JOB_LABELS: Record<JobName, string> = {
  [JOBS.carouselGenerate]: "Generación con IA",
  [JOBS.carouselRender]: "Render",
  [JOBS.ideasGenerate]: "Ideas con IA",
  [JOBS.ideasResearch]: "Investigación de temas",
  [JOBS.dataRefresh]: "Datos reales",
  [JOBS.postPublish]: "Publicación",
  [JOBS.slotsFill]: "Llenado automático",
  [JOBS.reviewNotify]: "Aviso de revisión",
  [JOBS.notifySend]: "Aviso de Telegram",
};

/** pg-boss job states. */
export const JOB_STATES = [
  "created",
  "retry",
  "active",
  "completed",
  "cancelled",
  "failed",
] as const;
export type JobState = (typeof JOB_STATES)[number];

/** The view's tabs, and the pg-boss states each one shows. */
export const JOB_VIEW_TABS = {
  pending: ["created", "retry"],
  active: ["active"],
  failed: ["failed"],
  done: ["completed", "cancelled"],
} as const satisfies Record<string, readonly JobState[]>;
export type JobViewTab = keyof typeof JOB_VIEW_TABS;

export const JOB_VIEW_TAB_LABELS: Record<JobViewTab, string> = {
  pending: "Pendientes",
  active: "En curso",
  failed: "Fallidos",
  done: "Recientes",
};

export function isJobViewTab(value: unknown): value is JobViewTab {
  return typeof value === "string" && Object.hasOwn(JOB_VIEW_TABS, value);
}

/** What a job works on, from its payload (jobs.ts). */
export type JobTarget =
  | { kind: "post"; postId: string }
  | { kind: "version"; versionId: string }
  | { kind: "ideaRequest"; requestId: string }
  | { kind: "notification"; notificationId: string }
  | { kind: "source"; source: string }
  | { kind: "none" };

const text = (data: unknown, key: string): string | undefined => {
  if (data === null || typeof data !== "object") return undefined;
  const value = (data as Record<string, unknown>)[key];
  return typeof value === "string" && value !== "" ? value : undefined;
};

export function jobTarget(name: string, data: unknown): JobTarget {
  switch (name) {
    case JOBS.carouselGenerate:
    case JOBS.postPublish: {
      const postId = text(data, "postId");
      return postId ? { kind: "post", postId } : { kind: "none" };
    }
    case JOBS.carouselRender: {
      const versionId = text(data, "versionId");
      return versionId ? { kind: "version", versionId } : { kind: "none" };
    }
    case JOBS.ideasGenerate:
    case JOBS.ideasResearch: {
      const requestId = text(data, "requestId");
      return requestId ? { kind: "ideaRequest", requestId } : { kind: "none" };
    }
    case JOBS.notifySend: {
      const notificationId = text(data, "notificationId");
      return notificationId ? { kind: "notification", notificationId } : { kind: "none" };
    }
    case JOBS.dataRefresh: {
      const source = text(data, "source");
      return source ? { kind: "source", source } : { kind: "none" };
    }
    default:
      return { kind: "none" };
  }
}

export const JOB_ERROR_MAX = 400;

/**
 * The message of a failed job's output (pg-boss stores the serialized error, with its stack):
 * only the message, cut, for the panel.
 */
export function jobError(output: unknown): string | null {
  if (output === null || output === undefined) return null;
  let message: string | undefined;
  if (typeof output === "string") message = output;
  else if (typeof output === "object") {
    const record = output as Record<string, unknown>;
    message =
      text(record, "message") ??
      text(record.value, "message") ??
      (typeof record.value === "string" ? record.value : undefined);
  }
  if (!message) return null;
  const clean = message.replace(/\s+/g, " ").trim();
  return clean.length > JOB_ERROR_MAX ? `${clean.slice(0, JOB_ERROR_MAX - 1)}…` : clean;
}

/** The state of what a job works on, as far as a retry cares. */
export type RetryContext = {
  post?: { status: PostStatus; currentVersionId: string | null } | null;
  /** For a render: the version the job renders. */
  versionId?: string;
  ideaRequest?: { status: IdeaRequestStatus } | null;
};

export type RetryCheck =
  | { ok: true }
  /** `open`: where the real retry is (the post page, the ideas page). */
  | { ok: false; reason: string; open?: "post" | "ideas" };

/**
 * Whether "Reintentar" can run a failed job again and do something. Jobs are idempotent and skip
 * a target that moved on: a generation or a render whose post was already marked failed does
 * nothing, so for those the view points to the post, where "Reintentar" is the real thing. They
 * are retried here only when the post is still waiting for them (the worker died mid-job).
 */
export function canRetryJob(name: string, state: string, context: RetryContext = {}): RetryCheck {
  if (state !== "failed") return { ok: false, reason: "Solo se reintentan los fallidos." };
  switch (name) {
    case JOBS.notifySend:
    case JOBS.dataRefresh:
    case JOBS.slotsFill:
    case JOBS.reviewNotify:
      return { ok: true };
    case JOBS.postPublish:
      return context.post?.status === "scheduled"
        ? { ok: true }
        : { ok: false, reason: "El post ya no está programado.", open: "post" };
    case JOBS.carouselGenerate:
      return context.post?.status === "generating"
        ? { ok: true }
        : { ok: false, reason: "Se reintenta desde el post.", open: "post" };
    case JOBS.carouselRender:
      return context.post?.status === "rendering" &&
        context.post.currentVersionId === context.versionId
        ? { ok: true }
        : { ok: false, reason: "Se reintenta desde el post.", open: "post" };
    case JOBS.ideasGenerate:
    case JOBS.ideasResearch:
      return context.ideaRequest?.status === "queued" || context.ideaRequest?.status === "running"
        ? { ok: true }
        : { ok: false, reason: "Pedí ideas de nuevo desde Ideas.", open: "ideas" };
    default:
      return { ok: false, reason: "Este trabajo no se reintenta desde acá." };
  }
}
