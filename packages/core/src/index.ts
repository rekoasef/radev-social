// Pure domain: types, post state machine, rules. No I/O and no dependencies on other workspace packages.

export {
  type AiQuota,
  type AiQuotaCheck,
  checkAiQuota,
  RATE_LIMIT_BACKOFF_MINUTES,
  rateLimitDelayMs,
  zonedPeriodStart,
} from "./ai/limits";
export {
  AI_PROVIDER_LABELS,
  AI_TASK_LABELS,
  type AiRoute,
  type AiRouteTarget,
  checkAiRoute,
  isFreeModel,
  MAX_MODEL_ID_LENGTH,
  resolveAiRoute,
  TOOL_TASKS,
} from "./ai/routing";
export {
  AI_PROVIDERS,
  AI_TASKS,
  type AiProviderId,
  type AiTask,
  GENERATION_RUN_STATUSES,
  type GenerationRunStatus,
  isAiProvider,
  isAiTask,
  ROUTE_ROLES,
  type RouteRole,
} from "./ai/tasks";
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
export {
  type ContactCheck,
  normalizeWhatsappMessage,
  normalizeWhatsappNumber,
  POST_CODE_PLACEHOLDER,
  WHATSAPP_MESSAGE_MAX,
  WHATSAPP_NUMBER_PATTERN,
  whatsappLink,
  whatsappMessage,
} from "./brands/contact";
export {
  BRAND_DOCUMENT_KINDS,
  type BrandDocumentKind,
  isBrandDocumentKind,
  MAX_BRAND_DOCUMENT_CHARS,
  normalizeBrandDocument,
} from "./brands/documents";
export {
  canDeletePillar,
  canRemovePillar,
  checkPillarMix,
  PILLAR_DESCRIPTION_MAX,
  PILLAR_NAME_MAX,
  percentToShare,
  shareToPercent,
} from "./brands/pillars";
export { contrastRatio, MIN_TEXT_CONTRAST, parseColor, type Rgba } from "./colors/contrast";
export {
  IDEA_ANGLE_MAX,
  IDEA_EVENTS,
  IDEA_SOURCES,
  IDEA_STATUSES,
  IDEA_TITLE_MAX,
  IDEA_TITLE_MIN,
  IDEA_TRANSITIONS,
  type IdeaEvent,
  type IdeaSource,
  type IdeaStatus,
  ideaPrompt,
  nextIdeaStatus,
} from "./ideas/ideas";
export {
  type CarouselGenerateJob,
  type CarouselRenderJob,
  carouselGenerateKey,
  carouselRenderKey,
  type GenerationRequest,
  JOBS,
  QUEUE_OPTIONS,
} from "./jobs";
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
  canExport,
  EXPORTABLE_STATUSES,
  exportImageName,
  exportText,
  type PostCopy,
  postDescription,
} from "./posts/export";
export {
  MAX_QA_REGENERATIONS,
  REJECTION_FEEDBACK_MAX,
  REJECTION_FEEDBACK_MIN,
  RENDER_ERROR_KIND,
  type RenderOutcome,
  renderOutcome,
} from "./posts/regeneration";
export { type ApprovalInput, canApprove, checkRenderedSlides } from "./posts/review";
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
