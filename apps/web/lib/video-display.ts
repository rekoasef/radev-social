import { currentProgress, type PauseReason, type VideoStage } from "@radev/core";
import type { TallyState } from "@/components/console/tally";

// What the studio says about a video: where it is, its lamp and how long ago. Pure: the pages give
// it the row and the clock.

export type DisplayVideo = {
  stage: VideoStage;
  pausedAt: Date | null;
  pauseReason: PauseReason | null;
  resumeAt: Date | null;
  failure: { message: string } | null;
  progress: unknown;
  updatedAt: Date;
};

export const STAGE_OFFICE: Record<VideoStage, string> = {
  researching: "Investigación",
  checking_sources: "Fuentes",
  finding_images: "Imágenes",
  scripting: "Guion",
  checking_facts: "Verificación",
  script_review: "Tu escritorio",
  voicing: "Locución",
  rendering: "Render",
  packaging: "Publicación",
  in_review: "Tu escritorio",
  approved: "Archivo",
  archived: "—",
};

const WORKING_VERB: Partial<Record<VideoStage, string>> = {
  researching: "Investigando",
  checking_sources: "Revisando fuentes",
  finding_images: "Buscando imágenes",
  scripting: "Escribiendo",
  checking_facts: "Verificando hechos",
  voicing: "Grabando la voz",
  rendering: "Renderizando",
  packaging: "Armando la publicación",
};

export type VideoDisplay = {
  office: string;
  tally: TallyState;
  status: string;
  /** "1:12" while an office works, "hace 15 h" otherwise. */
  time: string;
  /** An office is on it now (the page refreshes itself). */
  working: boolean;
  /** It waits for the operator at one of the two desks. */
  waiting: boolean;
};

/** "1:12", "12:05", "1:02:03". */
export function elapsed(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = String(total % 60).padStart(2, "0");
  return hours
    ? `${hours}:${String(minutes).padStart(2, "0")}:${seconds}`
    : `${minutes}:${seconds}`;
}

/** "recién", "hace 22 min", "hace 15 h", "hace 3 días". */
export function ago(at: Date, now: Date): string {
  const minutes = Math.floor((now.getTime() - at.getTime()) / 60_000);
  if (minutes < 1) return "recién";
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  const days = Math.floor(hours / 24);
  return days === 1 ? "hace 1 día" : `hace ${days} días`;
}

const clock = (at: Date, timeZone: string) =>
  new Intl.DateTimeFormat("es-AR", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(at);

export function describeVideo(video: DisplayVideo, now: Date, timeZone: string): VideoDisplay {
  const base = {
    office: STAGE_OFFICE[video.stage],
    time: ago(video.updatedAt, now),
    working: false,
    waiting: false,
  };
  if (video.stage === "archived") return { ...base, tally: "off", status: "Descartado" };
  if (video.failure) {
    return { ...base, tally: "fail", status: `Falla · ${video.failure.message}` };
  }
  if (video.pausedAt) {
    const why =
      video.pauseReason === "provider_limit" && video.resumeAt
        ? `límite de Claude, retoma ${clock(video.resumeAt, timeZone)}`
        : video.pauseReason === "budget"
          ? "sin créditos de voz"
          : "por vos";
    return { ...base, tally: "timed", status: `Pausado · ${why}` };
  }
  if (video.stage === "script_review" || video.stage === "in_review") {
    const what = video.stage === "script_review" ? "aprobar guion" : "aprobar video";
    return { ...base, tally: "cued", status: `Te espera · ${what}`, waiting: true };
  }
  if (video.stage === "approved") {
    return { ...base, tally: "ready", status: "Aprobado · paquete listo" };
  }

  const progress = currentProgress(video.progress, video.stage);
  if (!progress) return { ...base, tally: "standby", status: "En cola" };
  let status = WORKING_VERB[video.stage] ?? "Trabajando";
  if (progress.percent !== undefined) {
    status += `${progress.detail ? ` ${progress.detail}` : ""} al ${progress.percent} %`;
  } else if (progress.attempt && progress.attempt > 1) {
    status += ` · intento ${progress.attempt} de ${progress.attempts}`;
  }
  return {
    ...base,
    tally: "live",
    status,
    time: elapsed(now.getTime() - new Date(progress.startedAt).getTime()),
    working: true,
  };
}

export const FOLDER_COLORS = 5;

/**
 * The folder of each video: its two-digit number (order of creation, discarded ones included, so it
 * never changes) and one of the five tab colors.
 */
export function folders(
  videos: readonly { id: string; createdAt: Date }[],
): Map<string, { code: string; color: number }> {
  const ordered = [...videos].sort(
    (a, b) => a.createdAt.getTime() - b.createdAt.getTime() || a.id.localeCompare(b.id),
  );
  return new Map(
    ordered.map((video, i) => [
      video.id,
      { code: String(i + 1).padStart(2, "0"), color: (i % FOLDER_COLORS) + 1 },
    ]),
  );
}
