import { describe, expect, it } from "vitest";
import { canDeleteSeries, missingSeriesSlides } from "./series";

describe("missingSeriesSlides", () => {
  it("is empty when every required slide is there", () => {
    expect(
      missingSeriesSlides(["cover", "statement", "costBreakdown", "cta"], ["costBreakdown"]),
    ).toEqual([]);
  });

  it("lists the missing ones in the series' order, once", () => {
    expect(missingSeriesSlides(["cover", "cta"], ["costBreakdown", "cover", "steps"])).toEqual([
      "costBreakdown",
      "steps",
    ]);
  });

  it("a series without required slides accepts anything", () => {
    expect(missingSeriesSlides(["cover"], [])).toEqual([]);
  });
});

describe("canDeleteSeries", () => {
  it("only without ideas; with ideas it is archived", () => {
    expect(canDeleteSeries(0)).toEqual({ ok: true });
    expect(canDeleteSeries(2).ok).toBe(false);
  });
});
