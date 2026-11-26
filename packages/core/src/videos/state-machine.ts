import { type VideoStage, WORKING_STAGES, type WorkingStage } from "./constants";

// The only way a video's stage changes (CLAUDE.md, rule 2; docs/RADEV-STUDIO-REVISION.md §7.2).
// Each event lists where it may happen from and where it leads. packages/db applies it in a
// transaction; nothing else writes `videos.stage`. Pause and failure are a separate condition
// (./condition.ts), not stages.

type Transition = {
  from: readonly VideoStage[];
  /** `null`: depends on the stage (`officeDone`, see OFFICE_NEXT). */
  to: VideoStage | null;
  /** The rejection note is required (it goes back to the office that will redo the work). */
  needsNote?: boolean;
  /** Spanish, for errors shown to the operator. */
  label: string;
};

/** Where each working stage leads when its office finishes. */
export const OFFICE_NEXT = {
  researching: "checking_sources",
  checking_sources: "finding_images",
  finding_images: "scripting",
  scripting: "checking_facts",
  checking_facts: "script_review",
  voicing: "rendering",
  rendering: "packaging",
  packaging: "in_review",
} as const satisfies Record<WorkingStage, VideoStage>;

export const VIDEO_TRANSITIONS = {
  /** The office working on the current stage finished: on to the next one. */
  officeDone: { from: WORKING_STAGES, to: null, label: "terminar la oficina" },
  /** First desk: the script is good, the voice can be paid for (rule: no voice without it). */
  approveScript: { from: ["script_review"], to: "voicing", label: "aprobar el guion" },
  /** Back to the Script office with the operator's note; the dossier and images stay. */
  rejectScript: {
    from: ["script_review"],
    to: "scripting",
    needsNote: true,
    label: "rechazar el guion",
  },
  /** The operator edited the script (a new version). The stage does not change. */
  editScript: { from: ["script_review"], to: "script_review", label: "editar el guion" },
  /** Second desk: the video is ready to download. */
  approveVideo: { from: ["in_review"], to: "approved", label: "aprobar el video" },
  /** The story or the facts are wrong: the Script office writes again. */
  rejectVideoToScript: {
    from: ["in_review"],
    to: "scripting",
    needsNote: true,
    label: "rechazar el video y rehacer el guion",
  },
  /** The voice is wrong (a pronunciation, the pace): the voice is made again, then the render. */
  rejectVideoToVoice: {
    from: ["in_review"],
    to: "voicing",
    needsNote: true,
    label: "rechazar el video y rehacer la voz",
  },
  /** Only the picture is wrong (an image, a frame): render again, the voice is not paid twice. */
  rejectVideoToRender: {
    from: ["in_review"],
    to: "rendering",
    needsNote: true,
    label: "rechazar el video y volver a renderizar",
  },
  /**
   * The operator wants to change something himself (an image, a caption) without the AI writing
   * again: back to his script desk. Approving it again reuses the voice if the text did not change.
   */
  returnToScriptDesk: {
    from: ["in_review"],
    to: "script_review",
    label: "volver al escritorio del guion",
  },
  /** An approved video that needs another look (any edit invalidates the approval). */
  reopen: { from: ["approved"], to: "in_review", label: "volver a revisar" },
  archive: {
    from: [
      "researching",
      "checking_sources",
      "finding_images",
      "scripting",
      "checking_facts",
      "script_review",
      "voicing",
      "rendering",
      "packaging",
      "in_review",
      "approved",
    ],
    to: "archived",
    label: "descartar",
  },
} as const satisfies Record<string, Transition>;

export type VideoEvent = keyof typeof VIDEO_TRANSITIONS;
export const VIDEO_EVENTS = Object.keys(VIDEO_TRANSITIONS) as VideoEvent[];

export type VideoTransitionResult = { ok: true; to: VideoStage } | { ok: false; reason: string };

const STAGE_LABELS: Record<VideoStage, string> = {
  researching: "en investigación",
  checking_sources: "verificando fuentes",
  finding_images: "buscando imágenes",
  scripting: "escribiendo el guion",
  checking_facts: "verificando hechos",
  script_review: "esperando que apruebes el guion",
  voicing: "en locución",
  rendering: "renderizándose",
  packaging: "armando la publicación",
  in_review: "esperando que apruebes el video",
  approved: "aprobado",
  archived: "descartado",
};

/** Where `event` takes a video that is at `from`, or why it cannot happen. */
export function nextStage(from: VideoStage, event: VideoEvent): VideoTransitionResult {
  const transition: Transition = VIDEO_TRANSITIONS[event];
  if (!transition.from.includes(from)) {
    return { ok: false, reason: `No se puede ${transition.label} un video ${STAGE_LABELS[from]}.` };
  }
  if (transition.to !== null) return { ok: true, to: transition.to };
  return { ok: true, to: OFFICE_NEXT[from as WorkingStage] };
}

/** Whether `event` needs the operator's rejection note. */
export function needsNote(event: VideoEvent): boolean {
  const transition: Transition = VIDEO_TRANSITIONS[event];
  return transition.needsNote === true;
}

/** Events available from a stage, for the panel's buttons (`officeDone` is the worker's). */
export function availableVideoEvents(from: VideoStage): VideoEvent[] {
  return VIDEO_EVENTS.filter(
    (event) =>
      event !== "officeDone" &&
      (VIDEO_TRANSITIONS[event].from as readonly VideoStage[]).includes(from),
  );
}

/** Spanish description of a stage, for the panel and for errors. */
export function stageLabel(stage: VideoStage): string {
  return STAGE_LABELS[stage];
}

/** Stages from which a video can still be discarded. */
export const DISCARDABLE_STAGES: readonly VideoStage[] = VIDEO_TRANSITIONS.archive.from;
