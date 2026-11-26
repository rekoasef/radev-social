import { describe, expect, it } from "vitest";
import { ago, type DisplayVideo, describeVideo, elapsed, folders } from "./video-display";

const now = new Date("2026-11-26T17:32:00Z");
const zone = "America/Argentina/Buenos_Aires";
const video = (over: Partial<DisplayVideo> = {}): DisplayVideo => ({
  stage: "scripting",
  pausedAt: null,
  pauseReason: null,
  resumeAt: null,
  failure: null,
  progress: null,
  updatedAt: new Date("2026-11-26T17:10:00Z"),
  ...over,
});
const describeIt = (over: Partial<DisplayVideo>) => describeVideo(video(over), now, zone);
const progress = { stage: "scripting", startedAt: "2026-11-26T17:30:48Z" };

describe("describeVideo", () => {
  it("a working stage without progress is queued, not working", () => {
    expect(describeIt({})).toMatchObject({ tally: "standby", status: "En cola", working: false });
  });

  it("shows the office at work with its time and its try", () => {
    expect(describeIt({ progress: { ...progress, attempt: 2, attempts: 3 } })).toMatchObject({
      office: "Guion",
      tally: "live",
      status: "Escribiendo · intento 2 de 3",
      time: "1:12",
      working: true,
    });
  });

  it("shows the percent of the format being rendered", () => {
    const rendering = { stage: "rendering" as const };
    const p = { ...progress, stage: "rendering", percent: 40, detail: "16:9" };
    expect(describeIt({ ...rendering, progress: p }).status).toBe("Renderizando 16:9 al 40 %");
  });

  it("a failure and a pause win over the stage", () => {
    expect(describeIt({ failure: { message: "Commons respondió 429" }, progress })).toMatchObject({
      tally: "fail",
      status: "Falla · Commons respondió 429",
      working: false,
    });
    expect(
      describeIt({
        pausedAt: now,
        pauseReason: "provider_limit",
        resumeAt: new Date("2026-11-26T20:45:00Z"),
      }).status,
    ).toBe("Pausado · límite de Claude, retoma 17:45");
    expect(describeIt({ pausedAt: now, pauseReason: "budget" }).status).toBe(
      "Pausado · sin créditos de voz",
    );
  });

  it("only the two desks wait for the operator", () => {
    expect(describeIt({ stage: "script_review" })).toMatchObject({ waiting: true, tally: "cued" });
    expect(describeIt({ stage: "in_review" }).status).toBe("Te espera · aprobar video");
    expect(describeIt({ stage: "approved" }).waiting).toBe(false);
  });
});

describe("times", () => {
  it("formats the elapsed time and how long ago", () => {
    expect(elapsed(72_000)).toBe("1:12");
    expect(elapsed(3_723_000)).toBe("1:02:03");
    expect(ago(now, now)).toBe("recién");
    expect(ago(new Date("2026-11-26T02:32:00Z"), now)).toBe("hace 15 h");
    expect(ago(new Date("2026-11-23T17:32:00Z"), now)).toBe("hace 3 días");
  });
});

describe("folders", () => {
  it("numbers by creation order, whatever order they come in", () => {
    const list = [2, 1, 6, 3, 4, 5].map((n) => ({
      id: `v${n}`,
      createdAt: new Date(2026, 10, n),
    }));
    const map = folders(list);
    expect(map.get("v1")).toEqual({ code: "01", color: 1 });
    expect(map.get("v6")).toEqual({ code: "06", color: 1 });
  });
});
