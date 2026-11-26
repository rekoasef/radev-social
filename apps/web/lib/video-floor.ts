import { currentProgress, type VideoStage, WORKING_STAGES, type WorkingStage } from "@radev/core";
import { type DisplayVideo, elapsed } from "./video-display";

// What each room of the floor plan shows, from the videos. Pure.

export type FloorVideo = DisplayVideo & {
  id: string;
  title: string;
  folder: { code: string; color: number };
};

/** The rooms where a folder can be: the eight offices, your desk and the archive. */
export type RoomId = WorkingStage | "desk" | "archive";

/** What an office is doing, from the worst news to none. */
export type OfficeMode = "fail" | "working" | "paused" | "queued" | "idle";

export type OfficeRoom = {
  mode: OfficeMode;
  /** The door sign: full on a computer, short on a phone. */
  status: string;
  short: string;
  /** What the character says. */
  bubble: string | null;
  /** The video the room is about, to open it. */
  videoId: string | null;
  /** Only the Render room, while it renders. */
  percent: number | null;
  format: string | null;
};

export type FloorFolder = {
  id: string;
  title: string;
  code: string;
  color: number;
  room: RoomId;
  /** Position in the pile of its room (0 on top). */
  pile: number;
};

export type Floor = {
  offices: Record<WorkingStage, OfficeRoom>;
  desk: { scripts: number; videos: number; videoId: string | null };
  archive: { count: number; videoId: string | null };
  folders: FloorFolder[];
};

/** Folders drawn per room; the sign says how many there are. */
export const PILE_MAX = 3;

const VERB: Record<WorkingStage, string> = {
  researching: "Investigando",
  checking_sources: "Revisando",
  finding_images: "Buscando",
  scripting: "Escribiendo",
  checking_facts: "Verificando",
  voicing: "Grabando",
  rendering: "Renderizando",
  packaging: "Publicando",
};

export function roomOf(stage: VideoStage): RoomId | null {
  if (stage === "archived") return null;
  if (stage === "script_review" || stage === "in_review") return "desk";
  return stage === "approved" ? "archive" : stage;
}

function modeOf(video: FloorVideo): OfficeMode {
  if (video.failure) return "fail";
  if (video.pausedAt) return "paused";
  return currentProgress(video.progress, video.stage) ? "working" : "queued";
}

const MODES: OfficeMode[] = ["fail", "working", "paused", "queued", "idle"];

function officeRoom(
  stage: WorkingStage,
  videos: readonly FloorVideo[],
  now: Date,
  clock: (at: Date) => string,
): OfficeRoom {
  const here = videos
    .filter((v) => v.stage === stage)
    .map((video) => ({ video, mode: modeOf(video) }))
    .sort((a, b) => MODES.indexOf(a.mode) - MODES.indexOf(b.mode));
  const first = here[0];
  const waiting = here.length > 1 ? ` · ${here.length}` : "";
  const room: OfficeRoom = {
    mode: first?.mode ?? "idle",
    status: "Libre",
    short: "Libre",
    bubble: null,
    videoId: first?.video.id ?? null,
    percent: null,
    format: null,
  };
  if (!first) return room;
  const { video, mode } = first;
  if (mode === "fail") {
    return { ...room, status: `Falla · reintentar${waiting}`, short: "Falla", bubble: "¡falló!" };
  }
  if (mode === "paused") {
    const until =
      video.pauseReason === "provider_limit" && video.resumeAt
        ? ` · retoma ${clock(video.resumeAt)}`
        : video.pauseReason === "budget"
          ? " · sin créditos"
          : "";
    return { ...room, status: `Pausada${until}`, short: "Pausada" };
  }
  if (mode === "queued") {
    return { ...room, status: `En cola${waiting}`, short: "En cola" };
  }
  const progress = currentProgress(video.progress, stage);
  const time = progress ? elapsed(now.getTime() - new Date(progress.startedAt).getTime()) : "";
  if (progress?.percent !== undefined) {
    const format = progress.detail ?? "";
    return {
      ...room,
      percent: progress.percent,
      format,
      status: `${format} al ${progress.percent} % · ${time}`,
      short: `${progress.percent} %`,
    };
  }
  const retry = progress?.attempt && progress.attempt > 1;
  return {
    ...room,
    status: `${VERB[stage]} · ${time}`,
    short: time,
    bubble: retry ? `intento ${progress.attempt}/${progress.attempts}` : null,
  };
}

export function studioFloor(
  videos: readonly FloorVideo[],
  now: Date,
  clock: (at: Date) => string,
): Floor {
  const offices = Object.fromEntries(
    WORKING_STAGES.map((stage) => [stage, officeRoom(stage, videos, now, clock)]),
  ) as Record<WorkingStage, OfficeRoom>;
  // Oldest first: what has waited longest is on top and opens first.
  const ordered = [...videos].sort((a, b) => a.updatedAt.getTime() - b.updatedAt.getTime());
  const at = (stage: VideoStage) => ordered.filter((v) => v.stage === stage);
  const scripts = at("script_review");
  const reviews = at("in_review");
  const approved = at("approved");

  const piles = new Map<RoomId, number>();
  const folders = ordered.flatMap((video) => {
    const room = roomOf(video.stage);
    if (!room) return [];
    const pile = piles.get(room) ?? 0;
    piles.set(room, pile + 1);
    if (pile >= PILE_MAX) return [];
    return [{ id: video.id, title: video.title, ...video.folder, room, pile }];
  });

  return {
    offices,
    desk: {
      scripts: scripts.length,
      videos: reviews.length,
      videoId: reviews[0]?.id ?? scripts[0]?.id ?? null,
    },
    archive: { count: approved.length, videoId: approved.at(-1)?.id ?? null },
    folders,
  };
}
