import { VIDEO_IDEA_MODES, type VideoIdea, type VideoIdeaMode } from "@radev/core";
import type { VideoIdeaRequest } from "@radev/db";

// What "Nuevo video" shows of the requests for topic ideas: what is on its way, what failed and
// the ideas of the last answer of each button.

export const IDEA_MODE_LABELS: Record<VideoIdeaMode, string> = {
  generate: "Proponer ideas",
  research: "Investigar temas",
};

export type IdeaBoard = {
  waiting: { mode: VideoIdeaMode; started: boolean }[];
  /** Only when the latest request of a button failed. */
  failed: { mode: VideoIdeaMode; error: string }[];
  /** The newest answer first. */
  groups: { mode: VideoIdeaMode; id: string; ideas: VideoIdea[] }[];
};

type Row = Pick<VideoIdeaRequest, "id" | "mode" | "status" | "error" | "ideas" | "createdAt">;

/** `requests`: newest first. */
export function ideaBoard(requests: readonly Row[]): IdeaBoard {
  const board: IdeaBoard = { waiting: [], failed: [], groups: [] };
  const answered: Row[] = [];
  for (const mode of VIDEO_IDEA_MODES) {
    const ofMode = requests.filter((r) => r.mode === mode);
    const latest = ofMode[0];
    if (latest?.status === "queued" || latest?.status === "running") {
      board.waiting.push({ mode, started: latest.status === "running" });
    } else if (latest?.status === "failed") {
      board.failed.push({ mode, error: latest.error ?? "No se pudo." });
    }
    const last = ofMode.find((r) => r.status === "succeeded");
    if (last) answered.push(last);
  }
  board.groups = answered
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .map(({ mode, id, ideas }) => ({ mode, id, ideas }));
  return board;
}
