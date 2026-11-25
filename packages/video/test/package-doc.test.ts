import { describe, expect, it } from "vitest";
import { packageDocSchema, thumbnailProps } from "../src";
import { monaCandidates, monaPublication } from "./fixtures";

const pub = monaPublication();
const image = (aspect: number) => ({ ...monaCandidates()[0]!, width: 1000, height: 1000 * aspect });

describe("thumbnailProps", () => {
  it("uses the chosen framing as is in 9:16 and for a landscape image in 16:9", () => {
    expect(thumbnailProps(pub, image(2), "9x16").view).toEqual({
      cx: pub.thumbnail.cx,
      cy: pub.thumbnail.cy,
      vw: pub.thumbnail.vw,
    });
    expect(thumbnailProps(pub, image(0.7), "16x9").view.vw).toBe(pub.thumbnail.vw);
  });

  it("opens the framing and moves the subject right for a tall photo in 16:9", () => {
    const v = thumbnailProps(pub, image(1.5), "16x9").view;
    expect(v.vw).toBeGreaterThan(pub.thumbnail.vw);
    expect(v.vw).toBeLessThanOrEqual(1);
    expect(v.cx).toBeLessThan(pub.thumbnail.cx);
  });

  it("carries the text and the image file", () => {
    const p = thumbnailProps(pub, image(1.5), "9x16");
    expect(p).toMatchObject({
      kicker: pub.thumbnail.kicker,
      lines: pub.thumbnail.lines,
      accent: pub.thumbnail.accent,
      image: image(1.5).file,
    });
  });
});

describe("packageDocSchema", () => {
  it("accepts a complete document and rejects one without descriptions", () => {
    const doc = {
      publication: pub,
      descriptionNormal: "a",
      descriptionShort: "b",
      credits: "c",
      thumbnails: { "9x16": "package/x.png", "16x9": "package/y.png" },
    };
    expect(packageDocSchema.safeParse(doc).success).toBe(true);
    const { descriptionShort: _d, ...bad } = doc;
    expect(packageDocSchema.safeParse(bad).success).toBe(false);
  });
});
