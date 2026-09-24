// Label sizing shared by the presets' diagrams: estimated from character counts, so it is
// deterministic and needs no measuring in the browser.

/** Average glyph width of the body font, in em (Inter, mixed case). Calibrated on renders. */
const AVG_GLYPH_EM = 0.56;

/**
 * One font size for a set of labels (all the nodes of a diagram share it) so each fits `width`:
 * the whole label when it must stay on one line, or its longest word when it may wrap (words
 * are never broken). Estimated from the character count, so it is deterministic and needs no
 * measuring in the browser. Never below `min`.
 */
export function fitFontSize(
  texts: string[],
  width: number,
  { base, min, oneLine = false }: { base: number; min: number; oneLine?: boolean },
): number {
  const units = oneLine ? texts : texts.flatMap((text) => text.split(/\s+/));
  const longest = Math.max(1, ...units.map((unit) => [...unit].length));
  const fits = Math.floor(width / (longest * AVG_GLYPH_EM));
  return Math.max(min, Math.min(base, fits));
}

/** Average widths of a font, in em: a letter (with the tracking applied) and a space. */
export type GlyphWidths = { char: number; space: number };

/**
 * Lines a text takes at `size` in a box `width` wide, breaking between words like the browser
 * does. A word longer than the line takes its own line (titles never break words).
 */
export function countLines(text: string, width: number, size: number, glyphs: GlyphWidths): number {
  const words = text.split(/\s+/).filter(Boolean);
  let lines = words.length > 0 ? 1 : 0;
  let used = 0;
  for (const word of words) {
    const w = [...word].length * glyphs.char * size;
    const gap = used === 0 ? 0 : glyphs.space * size;
    if (used > 0 && used + gap + w > width) {
      lines++;
      used = w;
    } else {
      used += gap + w;
    }
  }
  return lines;
}

/**
 * The biggest of `sizes` (largest first) at which the text fits in `maxLines`; the smallest one
 * if none does. Deterministic, from measured glyph widths: no measuring in the browser.
 */
export function fitTextSize(
  text: string,
  {
    width,
    sizes,
    maxLines,
    glyphs,
  }: { width: number; sizes: readonly number[]; maxLines: number; glyphs: GlyphWidths },
): number {
  const longest = Math.max(0, ...text.split(/\s+/).map((word) => [...word].length));
  for (const size of sizes) {
    // A word wider than the box would overflow it (titles never break words).
    if (longest * glyphs.char * size > width) continue;
    if (countLines(text, width, size, glyphs) <= maxLines) return size;
  }
  return sizes[sizes.length - 1] ?? 16;
}
