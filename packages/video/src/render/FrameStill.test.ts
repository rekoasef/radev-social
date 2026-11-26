import { describe, expect, it } from "vitest";
import { fakeWords, settledTime } from "./FrameStill";

const words = fakeWords("En 1980 un chico encontró billetes podridos en la orilla del río.");

describe("settledTime", () => {
  it("draws a graphic once it has come in", () => {
    const at = settledTime(
      { kind: "fecha", text: "1980", pos: "abajo", at: { word: "1980" } },
      words,
    );
    expect(at).toBeCloseTo(0.32 + 0.5);
  });

  it("draws one that leaves early halfway through its life", () => {
    const at = settledTime(
      { kind: "fecha", text: "1980", pos: "abajo", at: { word: "En" }, until: { word: "1980" } },
      words,
    );
    expect(at).toBeCloseTo((0 + 0.32) / 2);
  });

  it("skips a graphic whose word is not said", () => {
    expect(
      settledTime({ kind: "fecha", text: "x", pos: "abajo", at: { word: "nunca" } }, words),
    ).toBeNull();
  });
});
