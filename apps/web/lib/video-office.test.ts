import type { OfficeHistory } from "@radev/db";
import { describe, expect, it } from "vitest";
import { OFFICE_SLUG, type OfficeVideo, officeView, stageOfSlug } from "./video-office";

const now = new Date("2026-11-26T17:32:00Z");
const video: OfficeVideo = {
  id: "v1",
  title: null,
  topic: "Tunguska",
  stage: "scripting",
  pausedAt: null,
  pauseReason: null,
  resumeAt: null,
  failure: null,
  progress: {
    stage: "scripting",
    startedAt: "2026-11-26T17:30:48Z",
    attempt: 2,
    attempts: 3,
    problems: ["scenes.6.narration › el número 26 no está en el dossier"],
  },
  updatedAt: now,
};
const run = (id: string, minutes: number, over: object = {}) =>
  ({
    id,
    videoId: "v1",
    title: null,
    topic: "Tunguska",
    status: "succeeded",
    checkProblems: null,
    error: null,
    inputTokens: 1000,
    outputTokens: 100,
    costUsd: 0.1,
    durationMs: 60_000,
    createdAt: new Date(now.getTime() - minutes * 60_000),
    ...over,
  }) as OfficeHistory["runs"][number];
const event = (id: string, kind: string, minutes: number, data: object | null = null) =>
  ({
    id,
    videoId: "v1",
    title: null,
    topic: "Tunguska",
    kind,
    quantity: 1,
    durationMs: kind === "office" ? 90_000 : null,
    data,
    createdAt: new Date(now.getTime() - minutes * 60_000),
  }) as OfficeHistory["events"][number];
const view = (history: OfficeHistory, stage: "scripting" | "rendering" = "scripting") =>
  officeView({ stage, videos: [video], history, now, timeZone: "UTC" });

describe("officeView", () => {
  const history: OfficeHistory = {
    runs: [run("r1", 10, { checkProblems: ["scenes.2 › corta"] }), run("r2", 5)],
    events: [
      event("e1", "office", 4, { outcome: "done" }),
      event("e2", "return", 2, { note: "la escena 2 es una pregunta suelta" }),
    ],
  };

  it("shows the video on the desk with its try and why the last one did not pass", () => {
    expect(view(history).current).toMatchObject({
      status: "Escribiendo · intento 2 de 3",
      time: "1:12",
      attempt: 2,
      problems: ["Escena 7: el número 26 no está en el dossier"],
    });
  });

  it("lists attempts and returns, newest first, without repeating the whole run", () => {
    expect(view(history).history.map((r) => [r.result, r.detail[0]])).toEqual([
      ["Devuelto por vos", "la escena 2 es una pregunta suelta"],
      ["Aceptada", undefined],
      ["No pasó · 1", "Escena 3: corta"],
    ]);
  });

  it("reports runs, returns, average time and the API-equivalent cost", () => {
    expect(view(history).report).toMatchObject({
      runs: 2,
      returns: 1,
      averageMs: 90_000,
      costUsd: 0.2,
    });
  });

  it("an office of code lists its own runs and has no AI cost", () => {
    const code = view(
      { runs: [], events: [event("e1", "office", 4, { outcome: "failed" })] },
      "rendering",
    );
    expect(code.current).toBeNull();
    expect(code.history).toMatchObject([{ result: "Falló", ms: 90_000 }]);
    expect(code.report).toMatchObject({ runs: 1, failed: 1, costUsd: null });
  });
});

describe("slugs", () => {
  it("go both ways and refuse the unknown", () => {
    expect(stageOfSlug(OFFICE_SLUG.rendering)).toBe("rendering");
    expect(stageOfSlug("nada")).toBeNull();
  });
});
