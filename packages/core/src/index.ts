// Pure domain: types, post state machine, rules. No I/O and no dependencies on other workspace packages.
export {
  isEmailAllowed,
  isOperator,
  type OperatorIdentity,
  parseAllowedEmails,
} from "./auth/allowlist";
export { pickActiveBrand, type SelectableBrand } from "./brands/active-brand";
export {
  ASSET_ROLES,
  ASSET_TYPES,
  type AssetCheck,
  type AssetMime,
  type AssetRole,
  type AssetType,
  checkAssetFile,
  detectAssetType,
  findAssetReferences,
  MAX_ASSET_BYTES,
} from "./brands/assets";
export {
  CODE_PREFIX_PATTERN,
  canChangeCodePrefix,
  canDeleteBrand,
  RESERVED_SLUGS,
  type RuleCheck,
  SLUG_MAX,
  SLUG_PATTERN,
  slugify,
} from "./brands/brand-rules";
export { contrastRatio, MIN_TEXT_CONTRAST, parseColor, type Rgba } from "./colors/contrast";
export {
  NETWORKS,
  type Network,
  POST_STATUSES,
  type PostStatus,
  PUBLICATION_STATUSES,
  type PublicationStatus,
  publicCode,
  RENDER_FORMATS,
  type RenderFormat,
  VERSION_ORIGINS,
  type VersionOrigin,
} from "./posts/constants";
export {
  availableEvents,
  INITIAL_STATUSES,
  nextStatus,
  POST_EVENTS,
  type PostEffect,
  type PostEvent,
  statusLabel,
  TRANSITIONS,
  type TransitionResult,
} from "./posts/state-machine";
