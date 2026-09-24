import { describe, expect, it } from "vitest";
import { contrastRatio, MIN_TEXT_CONTRAST, parseColor } from "./contrast";

describe("parseColor", () => {
  it("reads hex and rgb(a)", () => {
    expect(parseColor("#fff")).toEqual({ r: 255, g: 255, b: 255, a: 1 });
    expect(parseColor("#FF7A00")).toEqual({ r: 255, g: 122, b: 0, a: 1 });
    expect(parseColor("#00000080")?.a).toBeCloseTo(0.5, 2);
    expect(parseColor("rgba(24, 23, 34, 0.68)")).toEqual({ r: 24, g: 23, b: 34, a: 0.68 });
    expect(parseColor("rgb(1,2,3)")).toEqual({ r: 1, g: 2, b: 3, a: 1 });
  });

  it("rejects anything else", () => {
    expect(parseColor("red")).toBeUndefined();
    expect(parseColor("#12")).toBeUndefined();
    expect(parseColor("rgb(300,0,0)")).toBeUndefined();
  });
});

describe("contrastRatio", () => {
  it("gives the WCAG extremes", () => {
    expect(contrastRatio("#000", "#fff")).toBeCloseTo(21, 1);
    expect(contrastRatio("#777", "#777")).toBeCloseTo(1, 5);
  });

  it("is symmetric and matches known values", () => {
    expect(contrastRatio("#767676", "#ffffff")).toBeCloseTo(4.54, 2);
    expect(contrastRatio("#ffffff", "#767676")).toBeCloseTo(4.54, 2);
  });

  it("passes the seed brands and flags a poor pair", () => {
    expect(contrastRatio("#FFFFFF", "#0B0B0B")).toBeGreaterThan(MIN_TEXT_CONTRAST); // RAdev
    expect(contrastRatio("#F0EDF7", "#0B0B12")).toBeGreaterThan(MIN_TEXT_CONTRAST); // Lumus
    expect(contrastRatio("#3A3A3A", "#0B0B0B")).toBeLessThan(MIN_TEXT_CONTRAST);
  });

  it("blends a translucent text over the background", () => {
    const solid = contrastRatio("#ffffff", "#000000") ?? 0;
    const faded = contrastRatio("rgba(255,255,255,0.3)", "#000000") ?? 0;
    expect(faded).toBeLessThan(solid);
  });

  it("is undefined for unreadable colors", () => {
    expect(contrastRatio("nope", "#000")).toBeUndefined();
  });
});
