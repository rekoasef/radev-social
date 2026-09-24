// Contrast between two colors (WCAG 2.x relative luminance), for the warning of the visual
// identity editor (docs/DESIGN-SYSTEM.md §9, point 4).

export type Rgba = { r: number; g: number; b: number; a: number };

/** Minimum ratio for body text (WCAG AA). */
export const MIN_TEXT_CONTRAST = 4.5;

/** Parses #rgb, #rrggbb, #rrggbbaa, rgb(...) and rgba(...). Undefined for anything else. */
export function parseColor(value: string): Rgba | undefined {
  const text = value.trim().toLowerCase();
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/.exec(text)?.[1];
  if (hex) {
    const full = hex.length === 3 ? [...hex].map((c) => c + c).join("") : hex;
    const byte = (i: number) => Number.parseInt(full.slice(i, i + 2), 16);
    return { r: byte(0), g: byte(2), b: byte(4), a: full.length === 8 ? byte(6) / 255 : 1 };
  }
  const fn = /^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*(?:,\s*([\d.]+)\s*)?\)$/.exec(
    text,
  );
  if (fn) {
    const [r, g, b] = [fn[1], fn[2], fn[3]].map(Number) as [number, number, number];
    if ([r, g, b].some((c) => c > 255)) return undefined;
    return { r, g, b, a: fn[4] === undefined ? 1 : Math.min(1, Number(fn[4])) };
  }
  return undefined;
}

/** A translucent color painted over an opaque one. */
function over(top: Rgba, bottom: Rgba): Rgba {
  const mix = (t: number, b: number) => t * top.a + b * (1 - top.a);
  return { r: mix(top.r, bottom.r), g: mix(top.g, bottom.g), b: mix(top.b, bottom.b), a: 1 };
}

function luminance({ r, g, b }: Rgba): number {
  const channel = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/**
 * Contrast ratio (1 to 21) of a text color over a background. A translucent text is blended
 * over the background first; the background is taken as opaque. Undefined if either color
 * cannot be read.
 */
export function contrastRatio(text: string, background: string): number | undefined {
  const fg = parseColor(text);
  const bg = parseColor(background);
  if (!fg || !bg) return undefined;
  const opaqueBg = { ...bg, a: 1 };
  const [hi, lo] = [luminance(over(fg, opaqueBg)), luminance(opaqueBg)].sort((a, b) => b - a) as [
    number,
    number,
  ];
  return (hi + 0.05) / (lo + 0.05);
}
