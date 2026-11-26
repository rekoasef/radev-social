import { describe, expect, it } from "vitest";
import { currentProgress } from "./progress";

const progress = { stage: "rendering", startedAt: "2026-11-26T12:00:00.000Z", percent: 41 };

describe("currentProgress", () => {
  it("returns the progress of the stage the video is at", () => {
    expect(currentProgress(progress, "rendering")).toEqual(progress);
  });

  it("ignores the progress of another stage", () => {
    expect(currentProgress(progress, "packaging")).toBeNull();
    expect(currentProgress(progress, "in_review")).toBeNull();
  });

  it("ignores what is not a progress", () => {
    expect(currentProgress(null, "rendering")).toBeNull();
    expect(currentProgress({ stage: "rendering" }, "rendering")).toBeNull();
    expect(currentProgress("41%", "rendering")).toBeNull();
  });
});
