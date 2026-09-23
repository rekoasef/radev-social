// SlideFrame, style presets, slide templates and their Zod schemas.
export { type Carousel, carouselSchema, HOOK_TYPES, type HookType } from "./content/carousel";
export {
  type ChartDataset,
  chartDatasetSchema,
  type Datasets,
} from "./content/datasets";
export {
  countEmphasis,
  MAX_EMPHASIS_PER_SLIDE,
  type ParsedText,
  parseEmphasis,
  type TextSegment,
} from "./content/emphasis";
export { exampleCarousel, exampleDatasets, exampleSlides } from "./content/examples";
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
export { formatNumber } from "./format";
export {
  EXCLUSION_ZONES,
  FORMAT,
  isInSafeZone,
  type Rect,
  SAFE_AREA,
  SAFE_MARGINS,
} from "./frame/geometry";
export { createRandom, type Random } from "./frame/random";
export { SafeZoneOverlay } from "./frame/safe-zone-overlay";
export { SlideFrame, type SlideFrameProps } from "./frame/slide-frame";
export { iconComponent, SlideIcon } from "./icons";
export { type BoldTokens, boldTokensSchema } from "./presets/bold/tokens";
export type { TokenWidget } from "./presets/fields";
export {
  type BrandTheme,
  defaultTokens,
  isStylePreset,
  parseTheme,
  presets,
  STYLE_PRESETS,
  type StylePreset,
  type ThemeResult,
} from "./presets/registry";
export { GLOW_POSITIONS, type SoftTokens, softTokensSchema } from "./presets/soft/tokens";
export { hasTemplate, SlideContent } from "./slide-content";
