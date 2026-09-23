import { describe, expect, it } from "vitest";
import { chartLayout, niceScale, niceStep } from "./chart-layout";

describe("niceStep", () => {
  it("rounds to 1, 2 or 5 × 10^n", () => {
    expect(niceStep(100, 4)).toBe(50);
    expect(niceStep(37, 4)).toBe(10);
    expect(niceStep(0.8, 4)).toBe(0.2);
    expect(niceStep(1300, 4)).toBe(500);
  });
});

describe("niceScale", () => {
  it("covers every value with round bounds", () => {
    const s = niceScale([983, 1041, 1120]);
    expect(s.min).toBeLessThanOrEqual(983);
    expect(s.max).toBeGreaterThanOrEqual(1120);
    expect(s.ticks[0]).toBe(s.min);
    expect(s.ticks[s.ticks.length - 1]).toBe(s.max);
  });

  it("includes zero for bars and survives flat series", () => {
    expect(niceScale([40, 60], { includeZero: true }).min).toBe(0);
    const flat = niceScale([5, 5]);
    expect(flat.max).toBeGreaterThan(flat.min);
  });

  it("does not produce floating point noise", () => {
    for (const tick of niceScale([0.1, 0.7]).ticks) expect(String(tick).length).toBeLessThan(6);
  });
});

describe("chartLayout", () => {
  const values = Array.from({ length: 30 }, (_, i) => 1000 + i * 3);

  it("keeps the line inside the plot, from left to right edge", () => {
    const { plot, points } = chartLayout(values, "line", 850, 440);
    expect(points).toHaveLength(30);
    expect(points[0]?.x).toBe(plot.x);
    expect(points[29]?.x).toBeCloseTo(plot.x + plot.width);
    for (const p of points) {
      expect(p.y).toBeGreaterThanOrEqual(plot.y - 0.001);
      expect(p.y).toBeLessThanOrEqual(plot.y + plot.height + 0.001);
    }
  });

  it("labels few categories one by one and long series at three points", () => {
    expect(chartLayout(values, "line", 850, 440).xLabels.map((l) => l.index)).toEqual([0, 14, 29]);
    expect(chartLayout([1, 2, 3, 4], "bar", 850, 440).xLabels).toHaveLength(4);
  });

  it("grows bars from zero, negatives included", () => {
    const { bars, plot } = chartLayout([10, -5, 20], "bar", 850, 440);
    expect(bars).toHaveLength(3);
    for (const bar of bars) {
      expect(bar.height).toBeGreaterThan(0);
      expect(bar.x).toBeGreaterThanOrEqual(plot.x);
      expect(bar.x + bar.width).toBeLessThanOrEqual(plot.x + plot.width);
    }
    // The negative bar starts where the positive ones end: at zero.
    expect(bars[1]?.y).toBeCloseTo((bars[0]?.y ?? 0) + (bars[0]?.height ?? 0));
  });
});
