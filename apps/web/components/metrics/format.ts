// Number formats of the Métricas page (es-AR): compact for tiles and axes, full in tables.

const compact = new Intl.NumberFormat("es-AR", { notation: "compact", maximumFractionDigits: 1 });
const full = new Intl.NumberFormat("es-AR");
const percent = new Intl.NumberFormat("es-AR", { style: "percent", maximumFractionDigits: 1 });

/** 1234 → "1,2 mil"; below 10 000 the whole number reads better: "9.242". */
export function formatCompact(value: number): string {
  return Math.abs(value) < 10_000 ? full.format(Math.round(value)) : compact.format(value);
}

export function formatNumber(value: number): string {
  return full.format(Math.round(value));
}

/** 0.0423 → "4,2 %". */
export function formatPercent(value: number | null): string {
  return value === null ? "—" : percent.format(value);
}

/** Signed change: "+8", "−3", "0". */
export function formatDelta(value: number): string {
  if (value === 0) return "0";
  return `${value > 0 ? "+" : "−"}${formatCompact(Math.abs(value))}`;
}

/** Clean axis steps: 0, 500, 1.000… for a maximum. */
export function niceTicks(max: number, count = 4): number[] {
  if (max <= 0) return [0];
  const rough = max / count;
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((s) => s >= rough) ?? rough;
  const ticks: number[] = [];
  for (let value = 0; value <= max + step * 0.001; value += step) ticks.push(value);
  if ((ticks.at(-1) ?? 0) < max) ticks.push((ticks.at(-1) ?? 0) + step);
  return ticks;
}
