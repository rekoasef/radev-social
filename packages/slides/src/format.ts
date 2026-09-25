// Number formatting for slides, in Argentine Spanish: "." for thousands, "," for decimals.
// Written by hand instead of Intl so the render doesn't depend on the ICU data of each runtime.

export function formatNumber(value: number, decimals = 0): string {
  const fixed = Math.abs(value).toFixed(decimals);
  const [whole = "0", fraction] = fixed.split(".");
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const sign = value < 0 && Number(fixed) !== 0 ? "-" : "";
  return `${sign}${grouped}${fraction ? `,${fraction}` : ""}`;
}

/** Decimals a value is written with (0,4 → 1; 1,25 → 2), up to 4. */
function ownDecimals(value: number): number {
  for (let d = 0; d < 4; d++) if (Number(value.toFixed(d)) === value) return d;
  return 4;
}

/**
 * Decimals worth showing for values of this size: none for whole numbers or from 100 up, up to
 * 2 below; never more than the values have (a gap of 1,4 % shows as "1,4 %", not "1,40 %").
 */
export function decimalsFor(values: number[]): number {
  if (values.every(Number.isInteger)) return 0;
  const largest = Math.max(...values.map(Math.abs));
  const bySize = largest >= 100 ? 0 : largest >= 10 ? 1 : 2;
  return Math.min(bySize, Math.max(...values.map(ownDecimals)));
}

export function withUnit(text: string, unit: string | undefined, position: "before" | "after") {
  if (!unit) return text;
  return position === "before" ? `${unit} ${text}` : `${text} ${unit}`;
}
