import { describe, expect, it } from "vitest";
import manifest from "./fixtures/mona-manifest.json";
import words from "./fixtures/mona-words.json";
import { SAMPLE_RATE, splitScenes } from "./split";
import type { TtsWord } from "./types";

const texts = manifest.scenes.map((s) => s.text);
const real = words as TtsWord[];
const take = (seconds: number) => new Int16Array(Math.round(seconds * SAMPLE_RATE)).fill(7);

describe("splitScenes with the real Mona Lisa take (137 s, 20 scenes)", () => {
  const total = (real.at(-1)?.end ?? 0) + 0.4;
  const scenes = splitScenes(take(total), real, texts);

  it("gives one audio per scene, with the same number of frames the V0 spike measured", () => {
    expect(scenes).toHaveLength(texts.length);
    // every scene but the last depends only on the cuts (the last one, on the decoded length)
    expect(scenes.slice(0, -1).map((s) => s.frames)).toEqual(
      manifest.scenes.slice(0, -1).map((s) => s.frames),
    );
  });

  it("pads every scene to a whole number of frames", () => {
    for (const s of scenes) expect(s.pcm.length).toBe(s.frames * (SAMPLE_RATE / 30));
  });

  it("keeps every word of the take exactly once, in order", () => {
    expect(scenes.flatMap((s) => s.words.map((w) => w.word))).toEqual(real.map((w) => w.word));
  });

  it("makes the words' times relative to their scene and inside it", () => {
    for (const s of scenes) {
      const first = s.words[0];
      const last = s.words.at(-1);
      expect(first?.start).toBeGreaterThanOrEqual(0);
      expect(last?.end).toBeLessThanOrEqual(s.frames / 30 + 0.001);
    }
  });

  it("cuts in the middle of the pause, so both scenes keep half of it", () => {
    const a = scenes[0];
    const b = scenes[1];
    const gap =
      (real[manifest.scenes[0]?.text.split(/\s+/).length ?? 0]?.start ?? 0) -
      (real[(manifest.scenes[0]?.text.split(/\s+/).length ?? 1) - 1]?.end ?? 0);
    expect(gap).toBeGreaterThan(0);
    const tailOfA = (a?.frames ?? 0) / 30 - (a?.words.at(-1)?.end ?? 0);
    const headOfB = b?.words[0]?.start ?? 0;
    // each keeps about half the pause (padding to a frame adds at most 1/30 s to the end of A)
    expect(Math.abs(tailOfA - gap / 2)).toBeLessThan(1 / 30 + 0.002);
    expect(Math.abs(headOfB - gap / 2)).toBeLessThan(0.002);
  });
});

describe("splitScenes", () => {
  const w = (word: string, start: number, end: number): TtsWord => ({ word, start, end });

  it("pads with silence and carries the audio samples over", () => {
    const pcm = take(1.95); // the last scene is 0.95 s: 28.5 frames, padded to 29
    const scenes = splitScenes(pcm, [w("a", 0.1, 0.5), w("b", 1.5, 1.9)], ["a", "b"]);
    expect(scenes[0]?.pcm[0]).toBe(7);
    // the first scene ends mid-pause at 1.0 s = 30 frames
    expect(scenes[0]?.frames).toBe(30);
    expect(scenes[1]?.frames).toBe(29);
    expect(scenes[1]?.words).toEqual([w("b", 0.5, 0.9)]);
    const pad = scenes[1]?.pcm ?? new Int16Array(1);
    expect(pad[pad.length - 1]).toBe(0);
  });

  it("refuses a take whose words do not match the text", () => {
    expect(() => splitScenes(take(1), [w("a", 0, 0.5)], ["a b"])).toThrow(/Palabras del texto 2/);
  });
});
