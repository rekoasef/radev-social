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
export {
  exampleCarousel,
  exampleCarouselByPreset,
  exampleDatasets,
  exampleSlides,
  exampleSlidesByPreset,
} from "./content/examples";
export { extremeSlides, fillText } from "./content/extremes";
export {
  EDITOR_MIDDLE_TYPES,
  emptyField,
  emptySlide,
  type FieldSpec,
  SLIDE_FIELDS,
  SLIDE_LABELS,
} from "./content/form";
export {
  type AiCarousel,
  type AiCarouselSchema,
  aiCarouselSchema,
  aiSlideGuide,
  brandMakesArt,
  DATA_SLIDES,
  versionTakesArt,
} from "./content/generation";
export { default as ICON_NAMES } from "./content/icon-names.json";
export {
  isMoved,
  LAYER_LABELS,
  LAYER_LIMITS,
  LAYERS,
  type LayerAdjust,
  type LayerName,
  layerAdjust,
  type SlideLayout,
  slideLayoutSchema,
  withLayer,
} from "./content/layout";
export { limits } from "./content/limits";
export {
  SAMPLE_SCREEN_ASSETS,
  SAMPLE_SCREENS,
  type ScreenComposition,
  type ScreenDevice,
  screenComposition,
  screenDevice,
} from "./content/screens";
export {
  SLIDE_TYPES,
  type Slide,
  type SlideOf,
  type SlideType,
  slideSchema,
} from "./content/slides";
export {
  type AppliedEdits,
  applyTextEdits,
  parseHashtags,
  postTexts,
  type SlideTexts,
  slideTexts,
  type TextEdits,
  type TextField,
} from "./content/text-fields";
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
  type Box,
  GUIDES,
  type MoveResult,
  moveBox,
  resizeBox,
  SNAP_DISTANCE,
  scaleBox,
} from "./frame/drag";
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
export { resolveAsset, type SlideAsset, type SlideAssets } from "./frame/types";
export { iconComponent, SlideIcon } from "./icons";
export { type BoldTokens, boldTokensSchema } from "./presets/bold/tokens";
export type { TokenWidget } from "./presets/fields";
export {
  getTokenValue,
  setTokenValue,
  type TokenField,
  type TokenGroup,
  type TokenPath,
  tokenFormSpec,
} from "./presets/form-spec";
export {
  type BrandTheme,
  checkTheme,
  defaultTokens,
  isStylePreset,
  parseTheme,
  presets,
  STYLE_PRESETS,
  type StylePreset,
  switchPresetTokens,
  type ThemeCheck,
  type ThemeResult,
  themeColors,
} from "./presets/registry";
export { GLOW_POSITIONS, type SoftTokens, softTokensSchema } from "./presets/soft/tokens";
export {
  isLookId,
  LOOK_ART,
  LOOK_COOLDOWN,
  LOOK_GUIDE,
  LOOK_IDS,
  LOOK_NAMES,
  type LookId,
  lookChoices,
  lookTakesArt,
} from "./presets/studio/look-ids";
export { resolveLook } from "./presets/studio/looks";
export { enabledLooks, type StudioTokens, studioTokensSchema } from "./presets/studio/tokens";
export { RenderSlide, type RenderSlideProps } from "./render-slide";
export { hasTemplate, SlideContent, STUDIO_ONLY_TYPES } from "./slide-content";
