// Recurring series of a brand (docs/PRD.md RF-12), e.g. "¿Cuánto cuesta realmente…?". A series
// has a fixed structure: a brief the AI follows and slide types every post of it must have.

import type { RuleCheck } from "../brands/brand-rules";

export const SERIES_NAME_MAX = 80;
export const SERIES_BRIEF_MIN = 20;
export const SERIES_BRIEF_MAX = 3000;
/** Slide types a series can require at most (a carousel has 10 slides at most). */
export const SERIES_REQUIRED_SLIDES_MAX = 4;

/** Required slide types missing from a carousel, in the series' order. */
export function missingSeriesSlides(
  slideTypes: readonly string[],
  required: readonly string[],
): string[] {
  const present = new Set(slideTypes);
  return required.filter((type) => !present.has(type));
}

/** A series with ideas is archived, never deleted, so its ideas keep their series. */
export function canDeleteSeries(ideaCount: number): RuleCheck {
  return ideaCount === 0
    ? { ok: true }
    : { ok: false, reason: "La serie tiene ideas: archivala en lugar de borrarla." };
}
