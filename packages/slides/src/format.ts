// Number formatting for slides, in Argentine Spanish: "." for thousands, "," for decimals.
// Written by hand instead of Intl so the render doesn't depend on the ICU data of each runtime.

export function formatNumber(value: number, decimals = 0): string {
  const fixed = Math.abs(value).toFixed(decimals);
  const [whole = "0", fraction] = fixed.split(".");
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const sign = value < 0 && Number(fixed) !== 0 ? "-" : "";
  return `${sign}${grouped}${fraction ? `,${fraction}` : ""}`;
}

/**
 * Decimals worth showing for values of this size: none for whole numbers or from 100 up, up to
 * 2 below.
 */
export function decimalsFor(values: number[]): number {
  if (values.every(Number.isInteger)) return 0;
  const largest = Math.max(...values.map(Math.abs));
  if (largest >= 100) return 0;
  if (largest >= 10) return 1;
  return 2;
}

export function withUnit(text: string, unit: string | undefined, position: "before" | "after") {
  if (!unit) return text;
  return position === "before" ? `${unit} ${text}` : `${text} ${unit}`;
}
