import type { ProgressPatch, VideoDocumentKind } from "@radev/core";
import type { Video } from "@radev/db";
import { vi } from "vitest";
import type { AiAnswer, AiRequest } from "../ai";
import { createLogger } from "../logger";
import type { OfficeContext } from "../office";

// Fakes for the office tests: the AI answers from a list (and records what it was asked), the
// documents and files live in memory. Nothing touches the network, the database or the disk.

export const video = (over: Partial<Video> = {}): Video => ({
  id: "v1",
  brandId: null,
  topic: "El robo de la Mona Lisa",
  title: null,
  language: "es",
  voiceId: null,
  stage: "researching",
  progress: null,
  pausedAt: null,
  pauseReason: null,
  resumeAt: null,
  failure: null,
  rejectionNote: null,
  approvedAt: null,
  createdAt: new Date("2026-11-25T12:00:00Z"),
  updatedAt: new Date("2026-11-25T12:00:00Z"),
  ...over,
});

export type Asked = AiRequest<unknown>;

export function makeCtx(opts: {
  video?: Video;
  docs?: Partial<Record<VideoDocumentKind, unknown>>;
  answers?: AiAnswer<unknown>[];
  files?: Record<string, Uint8Array>;
  voice?: { externalId: string; name: string; speed: number | null } | null;
}) {
  const asked: Asked[] = [];
  const rejected: { runId: string; problems: string[] }[] = [];
  const progressed: ProgressPatch[] = [];
  const answers = [...(opts.answers ?? [])];
  const files = new Map(Object.entries(opts.files ?? {}));
  const ctx: OfficeContext = {
    video: opts.video ?? video(),
    mediaDir: "/media/videos/v1",
    log: createLogger({}, "error"),
    ai: {
      run: vi.fn(async (_video: unknown, request: Asked) => {
        asked.push(request);
        const next = answers.shift();
        if (!next) throw new Error("la IA fue llamada de más");
        return next;
      }) as unknown as OfficeContext["ai"]["run"],
      reject: async (runId, problems) => {
        rejected.push({ runId, problems });
      },
    },
    progress: async (patch) => {
      progressed.push(patch);
    },
    voice: async () =>
      opts.voice === undefined ? { externalId: "voz-1", name: "Alberto", speed: null } : opts.voice,
    document: async (kind) => opts.docs?.[kind] ?? null,
    files: {
      write: async (path, bytes) => {
        files.set(path, bytes);
      },
      read: async (path) => files.get(path),
    },
  };
  return { ctx, asked, files, rejected, progressed };
}

export const answer = <T>(data: T, runId = "run-1"): AiAnswer<T> => ({ ok: true, data, runId });
export const failure = (
  error: Extract<AiAnswer<unknown>, { ok: false }>["error"],
): AiAnswer<unknown> => ({
  ok: false,
  error,
});
