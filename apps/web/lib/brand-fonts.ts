import { fontStack, isFontFamily } from "@radev/slides";

/**
 * CSS `font-family` for a brand typeface from the curated list (packages/slides). Unknown
 * families return undefined so the element keeps the panel face.
 */
export function brandFontFamily(family: string | undefined): string | undefined {
  return family && isFontFamily(family) ? fontStack(family) : undefined;
}
