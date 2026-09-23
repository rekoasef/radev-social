// SlideFrame, style presets, slide templates and their Zod schemas.
export { type Carousel, carouselSchema, HOOK_TYPES, type HookType } from "./content/carousel";
export {
  countEmphasis,
  MAX_EMPHASIS_PER_SLIDE,
  type ParsedText,
  parseEmphasis,
  type TextSegment,
} from "./content/emphasis";
export { exampleCarousel, exampleSlides } from "./content/examples";
export { limits } from "./content/limits";
export {
  SLIDE_TYPES,
  type Slide,
  type SlideOf,
  type SlideType,
  slideSchema,
} from "./content/slides";
export {
  FONT_FAMILIES,
  type FontFamily,
  type FontSpec,
  fontStack,
  fonts,
  isFontFamily,
  supportsWeight,
} from "./fonts/registry";
