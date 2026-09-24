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
