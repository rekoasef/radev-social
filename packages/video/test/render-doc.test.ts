import { describe, expect, it } from "vitest";
import { checkRenderQuality, renderDocSchema, videoFrames } from "../src";
import { monaManifest, monaScript } from "./fixtures";

describe("videoFrames", () => {
  it("adds each scene's tail (seconds) to its voice frames", () => {
    expect(videoFrames([30, 60], [undefined, 1.5])).toBe(30 + 60 + 45);
  });

  it("matches the 139 s Mona Lisa video that was rendered in V0", () => {
    const frames = videoFrames(
      monaManifest().scenes.map((s) => s.frames),
      monaScript().scenes.map((s) => s.tail),
    );
    expect(frames / 30).toBeCloseTo(139.1, 0);
  });
});

describe("checkRenderQuality", () => {
  const ok = { seconds: 139.1, width: 1080, height: 1920, bytes: 40_000_000 };

  it("accepts a video of the right length and size", () => {
    expect(checkRenderQuality("9x16", ok, 4173)).toEqual([]);
  });

  it("rejects a video cut short or too long", () => {
    expect(checkRenderQuality("9x16", { ...ok, seconds: 100 }, 4173).join()).toMatch(
      /dura 100\.00 s/,
    );
    expect(checkRenderQuality("9x16", { ...ok, seconds: 150 }, 4173).join()).toMatch(/dura/);
  });

  it("rejects the wrong size for the format", () => {
    expect(checkRenderQuality("16x9", ok, 4173).join()).toMatch(/pide 1920×1080/);
  });

  it("rejects an almost empty file", () => {
    expect(checkRenderQuality("9x16", { ...ok, bytes: 1000 }, 4173).join()).toMatch(
      /vacío o cortado/,
    );
  });

  it("the document needs at least one format", () => {
    expect(renderDocSchema.safeParse({ fps: 30, totalFrames: 1, formats: [] }).success).toBe(false);
  });
});
