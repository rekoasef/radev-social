import { describe, expect, it } from "vitest";
import { type FloorVideo, studioFloor } from "./video-floor";

const now = new Date("2026-11-26T17:32:00Z");
const clock = () => "17:45";
let n = 0;
const video = (over: Partial<FloorVideo>): FloorVideo => ({
  id: `v${++n}`,
  title: "t",
  folder: { code: "01", color: 1 },
  stage: "scripting",
  pausedAt: null,
  pauseReason: null,
  resumeAt: null,
  failure: null,
  progress: null,
  updatedAt: new Date(now.getTime() - 1000 * n),
  ...over,
});
const working = (stage: FloorVideo["stage"], extra = {}) =>
  video({ stage, progress: { stage, startedAt: "2026-11-26T17:30:48Z", ...extra } });
const floor = (...videos: FloorVideo[]) => studioFloor(videos, now, clock);

describe("studioFloor", () => {
  it("an office without videos is free and dark", () => {
    expect(floor().offices.scripting).toMatchObject({ mode: "idle", status: "Libre" });
  });

  it("shows the work, its time and the retry", () => {
    const room = floor(working("scripting", { attempt: 2, attempts: 3 })).offices.scripting;
    expect(room).toMatchObject({
      mode: "working",
      status: "Escribiendo · 1:12",
      short: "1:12",
      bubble: "intento 2/3",
    });
  });

  it("the render shows its percent", () => {
    const room = floor(working("rendering", { percent: 41, detail: "16:9" })).offices.rendering;
    expect(room).toMatchObject({ percent: 41, format: "16:9", status: "16:9 al 41 % · 1:12" });
  });

  it("a failure shows over the rest of the room", () => {
    const failed = video({
      stage: "finding_images",
      failure: { message: "429" },
    });
    const room = floor(working("finding_images"), failed).offices.finding_images;
    expect(room).toMatchObject({ mode: "fail", videoId: failed.id });
  });

  it("says when a pause ends", () => {
    const paused = video({ pausedAt: now, pauseReason: "provider_limit", resumeAt: now });
    expect(floor(paused).offices.scripting.status).toBe("Pausada · retoma 17:45");
  });

  it("puts the folders in their room, three at most, and counts your desk and the archive", () => {
    const reviews = [1, 2, 3, 4].map(() => video({ stage: "in_review" }));
    const result = floor(
      ...reviews,
      video({ stage: "script_review" }),
      video({ stage: "approved" }),
      video({ stage: "archived" }),
    );
    expect(result.desk).toMatchObject({ videos: 4, scripts: 1 });
    // The one that has waited longest opens first.
    expect(result.desk.videoId).toBe(reviews[3]?.id);
    expect(result.archive.count).toBe(1);
    expect(result.folders.filter((f) => f.room === "desk")).toHaveLength(3);
    expect(result.folders).toHaveLength(4);
  });
});
