import { type VoiceDoc, videoFrames } from "@radev/video";
import { describe, expect, it, vi } from "vitest";
import candidatesFixture from "../../../../packages/video/test/fixtures/mona-candidates.json";
import scriptFixture from "../../../../packages/video/test/fixtures/mona-script.json";
import manifest from "../../../../packages/video/test/fixtures/mona-voice-manifest.json";
import type { RenderJob } from "../remotion";
import { makeCtx } from "./harness";
import { createRenderOffice } from "./render";

const script = () => structuredClone(scriptFixture);
const voiceDoc = (): VoiceDoc => ({
  fingerprint: "f",
  voiceId: "voz-1",
  model: "m",
  speed: null,
  characters: 100,
  fps: 30,
  totalFrames: manifest.scenes.reduce((n, s) => n + s.frames, 0),
  full: "voice/full.mp3",
  scenes: manifest.scenes.map((s, i) => ({
    index: i,
    frames: s.frames,
    text: s.text,
    audio: `voice/s${String(i).padStart(2, "0")}.wav`,
    words: `voice/s${String(i).padStart(2, "0")}.words.json`,
  })),
});
const words = new TextEncoder().encode(JSON.stringify([{ word: "hola", start: 0, end: 0.3 }]));
const wordFiles = () => Object.fromEntries(voiceDoc().scenes.map((s) => [s.words, words]));
const docs = () => ({
  script: script(),
  images: { candidates: structuredClone(candidatesFixture) },
  voice: voiceDoc(),
});
const expectedFrames = () =>
  videoFrames(
    manifest.scenes.map((s) => s.frames),
    script().scenes.map((s) => s.tail),
  );

function deps(
  probeFor: (file: string) => { seconds: number; width: number; height: number; bytes: number },
) {
  const jobs: RenderJob[] = [];
  return {
    jobs,
    renderer: {
      renderAll: vi.fn(async (j: readonly RenderJob[]) => {
        jobs.push(...j);
        return j.map(() => 1000);
      }),
    },
    probe: vi.fn(async (file: string) => probeFor(file)),
  };
}
const good = (file: string) =>
  file.includes("9x16")
    ? { seconds: expectedFrames() / 30, width: 1080, height: 1920, bytes: 40_000_000 }
    : { seconds: expectedFrames() / 30, width: 1920, height: 1080, bytes: 40_000_000 };

describe("render office", () => {
  it("renders both formats from the video's folder and leaves the render document", async () => {
    const d = deps(good);
    const { ctx } = makeCtx({ docs: docs(), files: wordFiles() });
    const r = await createRenderOffice(d)(ctx);
    expect(d.renderer.renderAll).toHaveBeenCalledOnce();
    expect(d.jobs.map((j) => j.props.format)).toEqual(["9x16", "16x9"]);
    expect(d.jobs[0]).toMatchObject({
      publicDir: "/media/videos/v1",
      outFile: "/media/videos/v1/render/video-9x16.mp4",
    });
    expect(d.jobs[0]?.props.shots).toHaveLength(script().scenes.length);
    expect(d.jobs[0]?.props.shots[0]).toMatchObject({
      image: expect.stringMatching(/^images\/i\d+\./),
      voice: 0,
    });
    if (r.kind !== "done") throw new Error("debía terminar");
    const doc = r.documents[0]?.data as {
      formats: { format: string; file: string }[];
      totalFrames: number;
    };
    expect(doc.totalFrames).toBe(expectedFrames());
    expect(doc.formats.map((f) => f.file)).toEqual([
      "render/video-9x16.mp4",
      "render/video-16x9.mp4",
    ]);
    expect(r.usage).toEqual([{ kind: "render", quantity: 2, unit: "seconds" }]);
  });

  it("fails the quality check when a video comes out short or with the wrong size", async () => {
    const d = deps((file) => ({ ...good(file), seconds: 50 }));
    const { ctx } = makeCtx({ docs: docs(), files: wordFiles() });
    await expect(createRenderOffice(d)(ctx)).rejects.toThrow(/control de calidad.*dura 50/);
  });

  it("fails without retrying when the voice no longer matches the script", async () => {
    const stale = docs();
    stale.voice.scenes.pop();
    const { ctx } = makeCtx({ docs: stale, files: wordFiles() });
    await expect(createRenderOffice(deps(good))(ctx)).rejects.toMatchObject({
      retryable: false,
      message: expect.stringContaining("rehacé la locución"),
    });
  });

  it("fails without retrying when a times file is gone", async () => {
    const { ctx } = makeCtx({ docs: docs() });
    await expect(createRenderOffice(deps(good))(ctx)).rejects.toMatchObject({ retryable: false });
  });

  it("fails without the voice document", async () => {
    const { voice: _voice, ...rest } = docs();
    const { ctx } = makeCtx({ docs: rest });
    await expect(createRenderOffice(deps(good))(ctx)).rejects.toMatchObject({ retryable: false });
  });
});
