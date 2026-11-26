import { describe, expect, it } from "vitest";
import { frameKey, framePath, sceneFrames } from "./frames";
import type { ImageCandidate } from "./images";
import type { Script, ScriptScene } from "./script";

const candidate = {
  id: "i01",
  title: "Foto",
  description: "",
  author: "A",
  license: "Public domain",
  file: "images/i01.jpg",
  width: 1280,
  height: 850,
} as ImageCandidate;
const scene = {
  narration: "Un hombre aborda el vuelo 305.",
  image: "i01",
  from: { cx: 0.5, cy: 0.5, vw: 1 },
  to: { cx: 0.5, cy: 0.5, vw: 0.7 },
  graphics: [],
} as ScriptScene;

describe("frameKey", () => {
  it("is stable and changes with what the frame shows", () => {
    const key = frameKey(scene, candidate);
    expect(frameKey(structuredClone(scene), candidate)).toBe(key);
    expect(frameKey({ ...scene, caption: "Otro avión" }, candidate)).not.toBe(key);
    expect(frameKey({ ...scene, to: { cx: 0.4, cy: 0.5, vw: 0.7 } }, candidate)).not.toBe(key);
    expect(framePath(key, "9x16")).toMatch(/^frames\/[0-9a-f]{8}-9x16\.jpg$/);
  });

  it("does not change with what the frame does not show", () => {
    expect(frameKey({ ...scene, exact: true, tail: 1.2 }, candidate)).toBe(
      frameKey(scene, candidate),
    );
  });
});

describe("sceneFrames", () => {
  it("numbers the scenes from 1 and skips a missing image", () => {
    const script = { scenes: [scene, { ...scene, image: "i99" }, scene] } as Script;
    expect(sceneFrames(script, [candidate]).map((f) => f.scene)).toEqual([1, 3]);
  });
});
