import { describe, expect, it } from "vitest";
import {
  BLUELYTICS_HISTORY_DAYS,
  type BluelyticsSnapshot,
  bluelyticsData,
  trimBluelyticsHistory,
} from "./bluelytics";
import {
  combineBrandData,
  type DataSeries,
  findFigure,
  formatChange,
  formatPesos,
  versionDatasets,
} from "./data";

/** Business days (Monday to Friday) from `from` to `to`, both included. */
function businessDays(from: string, to: string): string[] {
  const days: string[] = [];
  for (let at = new Date(`${from}T00:00:00Z`); at <= new Date(`${to}T00:00:00Z`); ) {
    const weekday = at.getUTCDay();
    if (weekday !== 0 && weekday !== 6) days.push(at.toISOString().slice(0, 10));
    at.setUTCDate(at.getUTCDate() + 1);
  }
  return days;
}

/** A year and a bit of history: the blue goes up $1 per business day from 1000, the official from 900. */
function snapshot(): BluelyticsSnapshot {
  const days = businessDays("2025-08-01", "2026-09-25");
  return {
    lastUpdate: "2026-09-25T10:45:51.077358-03:00",
    latest: { blue: { buy: 1527, sell: 1560 }, oficial: { buy: 1486, sell: 1538 } },
    history: days.flatMap((date, i) => [
      { date, kind: "blue" as const, buy: 990 + i, sell: 1000 + i },
      { date, kind: "oficial" as const, buy: 890 + i, sell: 900 + i },
    ]),
  };
}

describe("formatting", () => {
  it("writes pesos and changes in Argentine Spanish", () => {
    expect(formatPesos(1560)).toBe("$ 1.560");
    expect(formatPesos(1538.5)).toBe("$ 1.538,50");
    expect(formatChange(2.345)).toBe("+2,3 %");
    expect(formatChange(-0.84)).toBe("-0,8 %");
    expect(formatChange(0.01)).toBe("0,0 %");
  });
});

describe("bluelyticsData", () => {
  const data = bluelyticsData(snapshot());
  const figure = (key: string) => data.figures.find((f) => f.key === key);

  it("dates the data and names the source", () => {
    expect(data.asOf).toBe("2026-09-25");
    expect(figure("usd-blue-venta")).toEqual({
      key: "usd-blue-venta",
      label: "Dólar blue, venta",
      value: "$ 1.560",
      source: "Bluelytics, 25/09/2026",
    });
  });

  it("builds the daily series of the last 30 days", () => {
    const blue = data.datasets["usd-blue-30d"] as DataSeries;
    expect(blue.unit).toBe("$");
    // After 26/08, up to 25/09: 22 business days.
    expect(blue.points).toHaveLength(22);
    expect(blue.points[0]?.label).toBe("27/08");
    expect(blue.points.at(-1)?.label).toBe("25/09");
    expect(data.datasets["usd-oficial-30d"]?.points).toHaveLength(22);
  });

  it("builds the monthly closes of the last 12 months", () => {
    const blue = data.datasets["usd-blue-12m"] as DataSeries;
    expect(blue.points).toHaveLength(12);
    expect(blue.points[0]?.label).toBe("oct 25");
    expect(blue.points.at(-1)?.label).toBe("sep 26");
    // The close of each month is its last business day.
    const history = snapshot().history.filter((e) => e.kind === "blue" && e.date <= "2025-10-31");
    expect(blue.points[0]?.value).toBe(history.at(-1)?.sell);
    for (const point of blue.points) expect(point.label.length).toBeLessThanOrEqual(10);
  });

  it("computes the gap and the changes from the history", () => {
    const gap = data.datasets["brecha-30d"] as DataSeries;
    expect(gap.unit).toBe("%");
    expect(gap.unitPosition).toBe("after");
    // Today: 1560 / 1538 - 1 = 1,43 %.
    expect(figure("brecha")?.value).toBe("1,4 %");
    // 30 days ago (26/08/2026) the blue sold at 1000 + index of that day.
    const days = businessDays("2025-08-01", "2026-09-25");
    const before = 1000 + days.indexOf("2026-08-26");
    const expected = ((1560 - before) / before) * 100;
    expect(figure("usd-blue-var-30d")?.value).toBe(formatChange(expected));
    expect(figure("usd-oficial-var-12m")).toBeDefined();
  });

  it("keeps every figure within the bigNumber limit (10)", () => {
    for (const f of data.figures) expect(f.value.length).toBeLessThanOrEqual(10);
  });

  it("leaves out what the history is too short for", () => {
    const short = { ...snapshot(), history: snapshot().history.slice(-2) };
    const small = bluelyticsData(short);
    expect(small.datasets["usd-blue-30d"]).toBeUndefined();
    expect(small.figures.some((f) => f.key === "usd-blue-var-12m")).toBe(false);
    expect(small.figures.some((f) => f.key === "usd-blue-venta")).toBe(true);
  });
});

describe("trimBluelyticsHistory", () => {
  it("keeps only the last days before the date, oldest first", () => {
    const history = [...snapshot().history].reverse();
    const trimmed = trimBluelyticsHistory(history, "2026-09-25");
    expect((trimmed[0]?.date ?? "") > "2025-08-21").toBe(true);
    expect(trimmed.at(-1)?.date).toBe("2026-09-25");
    const span =
      (Date.parse(trimmed.at(-1)?.date ?? "") - Date.parse(trimmed[0]?.date ?? "")) / 86_400_000;
    expect(span).toBeLessThan(BLUELYTICS_HISTORY_DAYS);
  });
});

describe("findFigure", () => {
  const figures = bluelyticsData(snapshot()).figures;

  it("finds a figure as written, with or without spaces or the $", () => {
    expect(findFigure(figures, "$ 1.560")?.key).toBe("usd-blue-venta");
    expect(findFigure(figures, "$1.560")?.key).toBe("usd-blue-venta");
    expect(findFigure(figures, "1.560")?.key).toBe("usd-blue-venta");
    expect(findFigure(figures, "1,4%")?.key).toBe("brecha");
  });

  it("rejects a figure that is not in the data", () => {
    expect(findFigure(figures, "$ 1.600")).toBeUndefined();
    expect(findFigure(figures, "1.4 %")).toBeUndefined();
    expect(findFigure(figures, "1,4")).toBeUndefined();
  });
});

describe("versionDatasets", () => {
  const series = (value: number): DataSeries => ({
    title: "Serie",
    source: "Bluelytics",
    unitPosition: "before",
    points: [
      { label: "a", value },
      { label: "b", value },
    ],
  });

  it("keeps the points of a chart that was already there and takes today's for a new one", () => {
    const result = versionDatasets({
      refs: ["usd-blue-30d", "brecha-30d", "usd-blue-30d"],
      previous: { "usd-blue-30d": series(1), "usd-blue-12m": series(9) },
      current: { "usd-blue-30d": series(2), "brecha-30d": series(3) },
    });
    expect(result.missing).toEqual([]);
    expect(result.datasets).toEqual({ "usd-blue-30d": series(1), "brecha-30d": series(3) });
  });

  it("reports charts with no data", () => {
    expect(versionDatasets({ refs: ["x"], previous: null, current: null }).missing).toEqual(["x"]);
  });
});

describe("combineBrandData", () => {
  it("joins sources and dates them with the newest", () => {
    expect(combineBrandData([])).toBeNull();
    const a = { asOf: "2026-09-24", datasets: {}, figures: [] };
    const b = bluelyticsData(snapshot());
    expect(combineBrandData([a, b])?.asOf).toBe("2026-09-25");
  });
});
