import { describe, expect, it } from "vitest";
import { thumbImageBox, thumbTextSize } from "./thumb-layout";

describe("thumbImageBox", () => {
  it("keeps a landscape photo in the top part of the vertical thumbnail", () => {
    const box = thumbImageBox({ format: "9x16", aspect: 0.66, width: 1080, height: 1920 });
    expect(box.height).toBeLessThan(1920);
  });

  it("fills the frame with a portrait photo, and always in horizontal", () => {
    expect(thumbImageBox({ format: "9x16", aspect: 1.4, width: 1080, height: 1920 }).height).toBe(
      1920,
    );
    expect(thumbImageBox({ format: "16x9", aspect: 0.66, width: 1280, height: 720 }).height).toBe(
      720,
    );
  });
});

describe("thumbTextSize", () => {
  it("shrinks with the longest line so it never leaves the frame", () => {
    const short = thumbTextSize({ format: "9x16", lines: ["EL ROBO"], width: 960 });
    const long = thumbTextSize({ format: "9x16", lines: ["EL ROBO", "DESAPARECIDO"], width: 960 });
    expect(long).toBeLessThan(short);
    expect(long * 0.61 * 12).toBeLessThanOrEqual(960);
  });

  it("is capped so three lines fit in the horizontal one", () => {
    expect(thumbTextSize({ format: "16x9", lines: ["A", "B", "C"], width: 1168 })).toBe(140);
  });
});
