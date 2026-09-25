import { AI_BLOCKED_SLIDES, SLIDE_TYPES, type SlideType } from "@radev/slides";

/**
 * Slide types a series can require: the ones the AI may write, minus the cover and the closing,
 * which every carousel has anyway.
 */
export const SERIES_SLIDE_CHOICES = SLIDE_TYPES.filter(
  (type) =>
    type !== "cover" && type !== "cta" && !(AI_BLOCKED_SLIDES as readonly string[]).includes(type),
) as [SlideType, ...SlideType[]];
