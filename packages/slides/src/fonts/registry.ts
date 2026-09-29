import metricsJson from "./metrics.json";

/**
 * Curated typefaces for slides (docs/DESIGN-SYSTEM.md §2). The files ship with the project
 * through @fontsource-variable packages: nothing is fetched from the internet at build or
 * render time. To add one: install its package, import it in ./load.ts and list it here
 * (the registry test checks that both stay in sync).
 */
export const FONT_FAMILIES = [
  "Inter",
  "Inter Tight",
  "Hanken Grotesk",
  "Geist Sans",
  "Geist Mono",
  "Space Grotesk",
  "Manrope",
  "DM Sans",
  "JetBrains Mono",
  "Fraunces",
] as const;

export type FontFamily = (typeof FONT_FAMILIES)[number];

export type FontSpec = {
  /** npm package that ships the font files. */
  package: string;
  /** Family name declared by the package's @font-face rules. */
  cssFamily: string;
  /** Range of the variable weight axis. */
  weights: { min: number; max: number };
  category: "sans" | "mono" | "serif";
};

export const fonts: Record<FontFamily, FontSpec> = {
  Inter: {
    package: "@fontsource-variable/inter",
    cssFamily: "Inter Variable",
    weights: { min: 100, max: 900 },
    category: "sans",
  },
  "Inter Tight": {
    package: "@fontsource-variable/inter-tight",
    cssFamily: "Inter Tight Variable",
    weights: { min: 100, max: 900 },
    category: "sans",
  },
  "Hanken Grotesk": {
    package: "@fontsource-variable/hanken-grotesk",
    cssFamily: "Hanken Grotesk Variable",
    weights: { min: 100, max: 900 },
    category: "sans",
  },
  "Geist Sans": {
    package: "@fontsource-variable/geist",
    cssFamily: "Geist Variable",
    weights: { min: 100, max: 900 },
    category: "sans",
  },
  "Geist Mono": {
    package: "@fontsource-variable/geist-mono",
    cssFamily: "Geist Mono Variable",
    weights: { min: 100, max: 900 },
    category: "mono",
  },
  "Space Grotesk": {
    package: "@fontsource-variable/space-grotesk",
    cssFamily: "Space Grotesk Variable",
    weights: { min: 300, max: 700 },
    category: "sans",
  },
  Manrope: {
    package: "@fontsource-variable/manrope",
    cssFamily: "Manrope Variable",
    weights: { min: 200, max: 800 },
    category: "sans",
  },
  "DM Sans": {
    package: "@fontsource-variable/dm-sans",
    cssFamily: "DM Sans Variable",
    weights: { min: 100, max: 1000 },
    category: "sans",
  },
  "JetBrains Mono": {
    package: "@fontsource-variable/jetbrains-mono",
    cssFamily: "JetBrains Mono Variable",
    weights: { min: 100, max: 800 },
    category: "mono",
  },
  Fraunces: {
    package: "@fontsource-variable/fraunces",
    cssFamily: "Fraunces Variable",
    weights: { min: 100, max: 900 },
    category: "serif",
  },
};

const fallbacks: Record<FontSpec["category"], string> = {
  sans: "system-ui, sans-serif",
  mono: "ui-monospace, monospace",
  serif: "Georgia, serif",
};

export function isFontFamily(value: string): value is FontFamily {
  return (FONT_FAMILIES as readonly string[]).includes(value);
}

/** CSS `font-family` value for a curated typeface. */
export function fontStack(family: FontFamily): string {
  const spec = fonts[family];
  return `"${spec.cssFamily}", ${fallbacks[spec.category]}`;
}

/** Whether the typeface's variable axis covers the weight. */
export function supportsWeight(family: FontFamily, weight: number): boolean {
  const { min, max } = fonts[family].weights;
  return weight >= min && weight <= max;
}

/** Measured letter widths (scripts/measure-fonts.mjs): family → weight → [lowercase, uppercase] em. */
const metrics: Record<string, Record<string, number[]>> = metricsJson;

/** Average letter width of a family at a weight, in em (closest measured weight). */
export function letterWidth(family: FontFamily, weight: number, caps = false): number {
  const byWeight = metrics[family];
  if (!byWeight) return caps ? 0.6 : 0.5;
  const closest = Object.keys(byWeight)
    .map(Number)
    .reduce((best, w) => (Math.abs(w - weight) < Math.abs(best - weight) ? w : best));
  const [lower = 0.5, upper = 0.6] = byWeight[String(closest)] ?? [];
  return caps ? upper : lower;
}

/**
 * How much to shrink a text set in `font` so it is no wider than in the preset's reference
 * font: layouts are calibrated with the reference (T11). Never enlarges; never below 0.7.
 */
export function widthScale(
  font: { family: FontFamily; weight: number },
  reference: { family: FontFamily; weight: number },
  caps = false,
): number {
  const ratio =
    letterWidth(reference.family, reference.weight, caps) /
    letterWidth(font.family, font.weight, caps);
  return Math.round(Math.min(1, Math.max(0.7, ratio)) * 1000) / 1000;
}
