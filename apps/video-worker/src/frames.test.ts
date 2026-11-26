import { framePath, sceneFrames } from "@radev/video";
import { describe, expect, it, vi } from "vitest";
import candidatesFixture from "../../../packages/video/test/fixtures/mona-candidates.json";
import scriptFixture from "../../../packages/video/test/fixtures/mona-script.json";
import { drawFrames } from "./frames";

const candidates = structuredClone(candidatesFixture);
const script = structuredClone(scriptFixture) as Parameters<typeof drawFrames>[1];

describe("drawFrames", () => {
  it("draws both formats of every scene the first time", async () => {
    const renderStills = vi.fn(async () => {});
    const result = await drawFrames(
      { renderer: { renderStills }, exists: async () => false, mediaDir: "/m" },
      script,
      candidates,
    );
    expect(result.frames).toHaveLength(script.scenes.length);
    expect(result.drawn).toBe(script.scenes.length * 2);
    const [jobs] = renderStills.mock.calls[0] as unknown as [
      { composition: string; outFile: string }[],
    ];
    expect(jobs[0]).toMatchObject({ composition: "frame" });
    expect(jobs[0]?.outFile).toMatch(/^\/m\/frames\/[0-9a-f]{8}-9x16\.jpg$/);
  });

  it("draws only what changed, and nothing when nothing did", async () => {
    const first = sceneFrames(script, candidates)[0];
    if (!first) throw new Error("sin escenas");
    const have = new Set(
      sceneFrames(script, candidates)
        .slice(1)
        .flatMap((f) => [framePath(f.key, "9x16"), framePath(f.key, "16x9")]),
    );
    const renderStills = vi.fn(async () => {});
    const deps = {
      renderer: { renderStills },
      exists: async (p: string) => have.has(p),
      mediaDir: "/m",
    };
    expect((await drawFrames(deps, script, candidates)).drawn).toBe(2);
    have.add(framePath(first.key, "9x16")).add(framePath(first.key, "16x9"));
    expect((await drawFrames(deps, script, candidates)).drawn).toBe(0);
    expect(renderStills).toHaveBeenCalledTimes(1);
  });
});
