import type { Rect } from "../../frame/geometry";
import type { Point } from "./layout";

// Geometry of `chart` slides, as pure functions (tested). Coordinates are relative to the
// chart's own SVG, `width` × `height`.

/** Round step for about `count` intervals: 1, 2 or 5 × 10^n. */
export function niceStep(range: number, count: number): number {
  const raw = range / count;
  const power = 10 ** Math.floor(Math.log10(raw));
  const fraction = raw / power;
  const nice = fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10;
  return nice * power;
}

/** Axis bounds on round numbers that contain every value (and 0 for bars). */
export function niceScale(values: number[], { includeZero = false, ticks = 4 } = {}) {
  let min = Math.min(...values, ...(includeZero ? [0] : []));
  let max = Math.max(...values, ...(includeZero ? [0] : []));
  if (min === max) {
    const pad = Math.abs(min) * 0.1 || 1;
    min -= pad;
    max += pad;
  }
  const step = niceStep(max - min, ticks);
  const lo = Math.floor(min / step) * step;
  const hi = Math.ceil(max / step) * step;
  const values_: number[] = [];
  // Rounded to avoid 0.30000000000000004-style ticks.
  for (let v = lo; v <= hi + step / 2; v += step) values_.push(Number(v.toPrecision(12)));
  return { min: lo, max: hi, ticks: values_ };
}

export type ChartLayout = {
  plot: Rect;
  yTicks: { value: number; y: number }[];
  xLabels: { index: number; x: number }[];
  /** Line charts: one point per value. */
  points: Point[];
  /** Bar charts: one bar per value. */
  bars: Rect[];
};

export const CHART_MARGIN = { top: 72, right: 12, bottom: 52, left: 104 };

export function chartLayout(
  values: number[],
  kind: "line" | "bar",
  width: number,
  height: number,
): ChartLayout {
  const m = CHART_MARGIN;
  const plot: Rect = {
    x: m.left,
    y: m.top,
    width: width - m.left - m.right,
    height: height - m.top - m.bottom,
  };
  const scale = niceScale(values, { includeZero: kind === "bar" });
  const yOf = (v: number) =>
    plot.y + plot.height - ((v - scale.min) / (scale.max - scale.min)) * plot.height;
  const n = values.length;

  const band = plot.width / n;
  const xOf = (i: number) =>
    kind === "bar"
      ? plot.x + band * (i + 0.5)
      : plot.x + (n === 1 ? 0 : (i / (n - 1)) * plot.width);

  const points = kind === "line" ? values.map((v, i) => ({ x: xOf(i), y: yOf(v) })) : [];
  const barWidth = Math.min(band * 0.62, 90);
  const zero = yOf(Math.max(scale.min, Math.min(0, scale.max)));
  const bars =
    kind === "bar"
      ? values.map((v, i) => {
          const y = yOf(v);
          return {
            x: xOf(i) - barWidth / 2,
            y: Math.min(y, zero),
            width: barWidth,
            height: Math.abs(zero - y),
          };
        })
      : [];

  // Few categories: label each one. Many: first, middle and last.
  const shown = n <= 8 ? values.map((_, i) => i) : [0, Math.floor((n - 1) / 2), n - 1];
  return {
    plot,
    yTicks: scale.ticks.map((value) => ({ value, y: yOf(value) })),
    xLabels: shown.map((index) => ({ index, x: xOf(index) })),
    points,
    bars,
  };
}
