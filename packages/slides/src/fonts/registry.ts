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
] as const;

export type FontFamily = (typeof FONT_FAMILIES)[number];

export type FontSpec = {
  /** npm package that ships the font files. */
  package: string;
  /** Family name declared by the package's @font-face rules. */
  cssFamily: string;
  /** Range of the variable weight axis. */
  weights: { min: number; max: number };
  category: "sans" | "mono";
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
};

const fallbacks: Record<FontSpec["category"], string> = {
  sans: "system-ui, sans-serif",
  mono: "ui-monospace, monospace",
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
