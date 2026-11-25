import {
  PAUSE_REASONS,
  type PauseReason,
  REJECTION_NOTE_MAX,
  REJECTION_NOTE_MIN,
  REVIEW_STAGES,
  type VideoStage,
  WORKING_STAGES,
} from "./constants";
import { stageLabel } from "./state-machine";

// Pause and failure are a condition of the video, not stages (REVISION §4.4 and §7.2): they do not
// move the video and never delete a document. A paused video's jobs do not advance it.

export type VideoFailure = {
  /** The stage whose office failed. */
  stage: VideoStage;
  message: string;
  /** Whether trying again can work (a limit or a network error) or the operator has to step in. */
  retryable: boolean;
  at: Date;
};

export type VideoCondition = {
  pausedAt: Date | null;
  pauseReason: PauseReason | null;
  /** When a `provider_limit` pause ends by itself. */
  resumeAt: Date | null;
  failure: VideoFailure | null;
};

export const CLEAR_CONDITION: VideoCondition = {
  pausedAt: null,
  pauseReason: null,
  resumeAt: null,
  failure: null,
};

export const isPauseReason = (value: unknown): value is PauseReason =>
  typeof value === "string" && (PAUSE_REASONS as readonly string[]).includes(value);

export const isWorkingStage = (stage: VideoStage): boolean =>
  (WORKING_STAGES as readonly VideoStage[]).includes(stage);

export const isReviewStage = (stage: VideoStage): boolean =>
  (REVIEW_STAGES as readonly VideoStage[]).includes(stage);

export function pauseVideo(
  condition: VideoCondition,
  reason: PauseReason,
  now: Date,
  resumeAt: Date | null = null,
): VideoCondition {
  return { ...condition, pausedAt: now, pauseReason: reason, resumeAt };
}

/** Takes the pause away. A failure stays: it is not a pause. */
export function resumeVideo(condition: VideoCondition): VideoCondition {
  return { ...condition, pausedAt: null, pauseReason: null, resumeAt: null };
}

/** A failure does not change the stage or delete anything: it is only recorded. */
export function failVideo(condition: VideoCondition, failure: VideoFailure): VideoCondition {
  return { ...condition, failure };
}

/** "Reintentar": clears the failure so the office can run again. */
export function retryVideo(condition: VideoCondition): VideoCondition {
  return { ...condition, failure: null };
}

/** Whether a pause is over: only `provider_limit` ends by itself, at `resumeAt`. */
export function pauseEnded(condition: VideoCondition, now: Date): boolean {
  return (
    condition.pausedAt !== null &&
    condition.pauseReason === "provider_limit" &&
    condition.resumeAt !== null &&
    condition.resumeAt.getTime() <= now.getTime()
  );
}

/**
 * Whether a job may work on a video right now: the stage is an office's, nothing is paused (or a
 * limit pause already ended) and the last try did not fail. Every job asks this when it starts.
 */
export function canRunOffice(stage: VideoStage, condition: VideoCondition, now: Date): boolean {
  if (!isWorkingStage(stage) || condition.failure !== null) return false;
  return condition.pausedAt === null || pauseEnded(condition, now);
}

/** Whether the stage may change: a paused video does not advance (it can still be discarded). */
export function canAdvance(
  condition: VideoCondition,
  event: string,
  now: Date,
): { ok: true } | { ok: false; reason: string } {
  const paused = condition.pausedAt !== null && !pauseEnded(condition, now);
  if (paused && event !== "archive") {
    return { ok: false, reason: "El video está pausado: reanudalo antes de seguir." };
  }
  return { ok: true };
}

/** A rejection note, trimmed, or the reason it is not valid. */
export function checkRejectionNote(
  note: string | null | undefined,
): { ok: true; note: string } | { ok: false; reason: string } {
  const trimmed = (note ?? "").trim();
  if (trimmed.length < REJECTION_NOTE_MIN) {
    return { ok: false, reason: `Escribí qué corregir (al menos ${REJECTION_NOTE_MIN} letras).` };
  }
  if (trimmed.length > REJECTION_NOTE_MAX) {
    return { ok: false, reason: `La nota es muy larga (máximo ${REJECTION_NOTE_MAX} caracteres).` };
  }
  return { ok: true, note: trimmed };
}

/** What the panel shows for a video (REVISION §4.4: stage + condition → one visible status). */
export type VideoDisplayStatus = {
  kind:
    | "working"
    | "paused"
    | "failed"
    | "needs_attention"
    | "waiting_review"
    | "approved"
    | "archived";
  label: string;
  detail?: string;
};

const PAUSE_LABELS: Record<PauseReason, string> = {
  operator: "pausado por vos",
  provider_limit: "pausado por el límite de Claude",
  budget: "pausado por el tope de gasto",
  window: "pausado hasta la ventana de trabajo",
};

export function videoDisplayStatus(
  stage: VideoStage,
  condition: VideoCondition,
  now: Date,
): VideoDisplayStatus {
  if (stage === "archived") return { kind: "archived", label: "Descartado" };
  if (stage === "approved") return { kind: "approved", label: "Aprobado" };
  const paused = condition.pausedAt !== null && !pauseEnded(condition, now);
  if (paused && condition.pauseReason) {
    const byItself =
      condition.pauseReason === "provider_limit" || condition.pauseReason === "window";
    return {
      kind: byItself ? "paused" : "needs_attention",
      label: byItself ? "Pausado" : "Esperando intervención",
      detail:
        condition.resumeAt && byItself
          ? `${PAUSE_LABELS[condition.pauseReason]}; sigue solo`
          : PAUSE_LABELS[condition.pauseReason],
    };
  }
  if (condition.failure) {
    return {
      kind: condition.failure.retryable ? "failed" : "needs_attention",
      label: condition.failure.retryable ? "Falló" : "Esperando intervención",
      detail: `${stageLabel(condition.failure.stage)}: ${condition.failure.message}`,
    };
  }
  if (isReviewStage(stage)) {
    return { kind: "waiting_review", label: "Esperando tu revisión", detail: stageLabel(stage) };
  }
  return { kind: "working", label: "En producción", detail: stageLabel(stage) };
}
