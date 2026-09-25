import {
  AI_PROVIDERS,
  AI_TASKS,
  ASSET_ROLES,
  BRAND_DOCUMENT_KINDS,
  DATA_SOURCES,
  type DataSeries,
  GENERATION_RUN_STATUSES,
  type GenerationRequest,
  IDEA_REQUEST_STATUSES,
  IDEA_REQUEST_TASKS,
  IDEA_SOURCES,
  IDEA_STATUSES,
  type IdeaRequestParams,
  NETWORKS,
  POST_STATUSES,
  PUBLICATION_STATUSES,
  RENDER_FORMATS,
  ROUTE_ROLES,
  VERSION_ORIGINS,
} from "@radev/core";
import { sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  check,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  real,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updatedAt = () =>
  timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date());

/** A brand owns everything else in the system (ADR 0006, 0008). */
export const brands = pgTable(
  "brands",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    /** Prefix for public post codes, e.g. "RA" -> RA-0142. */
    codePrefix: text("code_prefix").notNull(),
    /** Style preset implemented in packages/slides (e.g. "bold", "soft"). */
    stylePreset: text("style_preset").notNull(),
    /** Tokens for the preset, validated with its Zod schema (packages/slides, parseTheme). */
    themeTokens: jsonb("theme_tokens").$type<Record<string, unknown>>().notNull().default({}),
    /** IANA time zone used to display and schedule posts. */
    timezone: text("timezone").notNull().default("America/Argentina/Buenos_Aires"),
    postsPerDayTarget: integer("posts_per_day_target").notNull().default(1),
    /** Null means no limit. */
    aiDailyLimit: integer("ai_daily_limit"),
    /** Null means no limit. */
    aiMonthlyLimit: integer("ai_monthly_limit"),
    whatsappNumber: text("whatsapp_number"),
    whatsappMessageTemplate: text("whatsapp_message_template"),
    /** Data sources whose numbers the brand's content may show (DATA_SOURCES, e.g. bluelytics). */
    dataSources: text("data_sources")
      .array()
      .$type<string[]>()
      .notNull()
      .default(sql`'{}'::text[]`),
    /** Number the next post gets in its public code (RA-0001, RA-0002…). Never reused. */
    nextPostNumber: integer("next_post_number").notNull().default(1),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("brands_slug_unique").on(t.slug),
    uniqueIndex("brands_code_prefix_unique").on(t.codePrefix),
    check("brands_slug_format", sql`${t.slug} ~ '^[a-z0-9]+(-[a-z0-9]+)*$'`),
    check("brands_code_prefix_format", sql`${t.codePrefix} ~ '^[A-Z]{2,4}$'`),
    check("brands_posts_per_day_target_non_negative", sql`${t.postsPerDayTarget} >= 0`),
    check("brands_ai_daily_limit_non_negative", sql`${t.aiDailyLimit} >= 0`),
    check("brands_ai_monthly_limit_non_negative", sql`${t.aiMonthlyLimit} >= 0`),
  ],
);

/**
 * Files a brand uses in its slides (logo, hero element, decorations). The file lives in
 * MEDIA_DIR at `path`; theme tokens point to it by id (docs/ARCHITECTURE.md §4).
 */
export const brandAssets = pgTable(
  "brand_assets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    brandId: uuid("brand_id")
      .notNull()
      .references(() => brands.id, { onDelete: "cascade" }),
    role: text("role", { enum: ASSET_ROLES }).notNull(),
    /** Relative to MEDIA_DIR, e.g. "lumus/brand/<file>.png". Changes when the file is replaced. */
    path: text("path").notNull(),
    mime: text("mime").notNull(),
    /** Pixels; for SVG, the size it declares (null when it declares none). */
    width: integer("width"),
    height: integer("height"),
    sizeBytes: integer("size_bytes").notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("brand_assets_brand_id_idx").on(t.brandId),
    uniqueIndex("brand_assets_path_unique").on(t.path),
    check("brand_assets_role_valid", sql`${t.role} in ('logo', 'hero', 'decoration', 'other')`),
  ],
);

const inList = (values: readonly string[]) => sql.raw(values.map((v) => `'${v}'`).join(", "));

/**
 * Voice, pricing, cases and rules of a brand, in Markdown (docs/ARCHITECTURE.md §4). Never
 * updated in place: every save is a new version, and the current one is the highest.
 */
export const brandDocuments = pgTable(
  "brand_documents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    brandId: uuid("brand_id")
      .notNull()
      .references(() => brands.id, { onDelete: "cascade" }),
    kind: text("kind", { enum: BRAND_DOCUMENT_KINDS }).notNull(),
    /** Normalized with normalizeBrandDocument (packages/core). */
    content: text("content").notNull(),
    version: integer("version").notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("brand_documents_brand_kind_version_unique").on(t.brandId, t.kind, t.version),
    check("brand_documents_kind_valid", sql`${t.kind} in (${inList(BRAND_DOCUMENT_KINDS)})`),
    check("brand_documents_version_positive", sql`${t.version} >= 1`),
  ],
);

/** What a brand talks about, with its target share of the mix (docs/PRD.md RF-05). */
export const contentPillars = pgTable(
  "content_pillars",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    brandId: uuid("brand_id")
      .notNull()
      .references(() => brands.id, { onDelete: "cascade" }),
    /** Stable key the AI and the carousel use (`pillarKey`), e.g. "money-habits". */
    key: text("key").notNull(),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    /** 0 to 1: share of the brand's posts this pillar should get. */
    targetShare: real("target_share").notNull().default(0),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("content_pillars_brand_key_unique").on(t.brandId, t.key),
    check("content_pillars_key_format", sql`${t.key} ~ '^[a-z0-9]+(-[a-z0-9]+)*$'`),
    check("content_pillars_share_range", sql`${t.targetShare} >= 0 and ${t.targetShare} <= 1`),
  ],
);

/**
 * A recurring series of a brand (docs/PRD.md RF-12): the brief is the fixed structure the AI
 * follows; every carousel of the series has the required slide types (checked with Zod).
 */
export const contentSeries = pgTable(
  "content_series",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    brandId: uuid("brand_id")
      .notNull()
      .references(() => brands.id, { onDelete: "cascade" }),
    /** Stable key ideas and generation requests use (`seriesKey`), e.g. "real-cost". */
    key: text("key").notNull(),
    name: text("name").notNull(),
    /** Pillar of its posts; null lets the AI pick. */
    pillarId: uuid("pillar_id").references(() => contentPillars.id, { onDelete: "set null" }),
    /** Suggested hook type (a HOOK_TYPES value of packages/slides), e.g. "cost". */
    hookType: text("hook_type"),
    /** Structure and rules of the series, in Markdown, for the AI. */
    brief: text("brief").notNull(),
    /** Slide types (SLIDE_TYPES of packages/slides) every post of the series has. */
    requiredSlides: jsonb("required_slides").$type<string[]>().notNull().default([]),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("content_series_brand_key_unique").on(t.brandId, t.key),
    check("content_series_key_format", sql`${t.key} ~ '^[a-z0-9]+(-[a-z0-9]+)*$'`),
  ],
);

/**
 * A request for ideas to the AI (phase 3, T10), with its parameters and outcome. Its ideas point
 * back to it, so running the job twice never adds them twice (rule 8).
 */
export const ideaRequests = pgTable(
  "idea_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    brandId: uuid("brand_id")
      .notNull()
      .references(() => brands.id, { onDelete: "cascade" }),
    task: text("task", { enum: IDEA_REQUEST_TASKS }).notNull(),
    params: jsonb("params").$type<IdeaRequestParams>().notNull(),
    status: text("status", { enum: IDEA_REQUEST_STATUSES }).notNull().default("queued"),
    /** Why it failed, for the panel. */
    error: text("error"),
    ideaCount: integer("idea_count").notNull().default(0),
    createdAt: createdAt(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
  },
  (t) => [
    index("idea_requests_brand_created_idx").on(t.brandId, t.createdAt),
    check("idea_requests_task_valid", sql`${t.task} in (${inList(IDEA_REQUEST_TASKS)})`),
    check("idea_requests_status_valid", sql`${t.status} in (${inList(IDEA_REQUEST_STATUSES)})`),
  ],
);

export type IdeaSourceLink = { title: string; url: string };

/**
 * The brand's idea bank (docs/PRD.md RF-09). An idea is never deleted: discarded ones stay so they
 * can come back and the AI does not propose them again. Status rules: packages/core (ideas.ts).
 */
export const ideas = pgTable(
  "ideas",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    brandId: uuid("brand_id")
      .notNull()
      .references(() => brands.id, { onDelete: "cascade" }),
    /** Null: the AI picks the pillar when the idea is generated. */
    pillarId: uuid("pillar_id").references(() => contentPillars.id, { onDelete: "set null" }),
    title: text("title").notNull(),
    angle: text("angle").notNull().default(""),
    source: text("source", { enum: IDEA_SOURCES }).notNull(),
    /** The recurring series it belongs to (T10), e.g. "real-cost". */
    seriesKey: text("series_key"),
    /** Web pages the research drew on (ideas.research), for the operator to check. */
    sources: jsonb("sources").$type<IdeaSourceLink[]>().notNull().default([]),
    /** The AI request that proposed it; null for ideas typed by hand. */
    requestId: uuid("request_id").references(() => ideaRequests.id, { onDelete: "set null" }),
    status: text("status", { enum: IDEA_STATUSES }).notNull().default("new"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("ideas_brand_status_created_idx").on(t.brandId, t.status, t.createdAt),
    check("ideas_source_valid", sql`${t.source} in (${inList(IDEA_SOURCES)})`),
    check("ideas_status_valid", sql`${t.status} in (${inList(IDEA_STATUSES)})`),
  ],
);

/**
 * A carousel of a brand. Its status only changes through the state machine in packages/core
 * (CLAUDE.md, rule 2); its content lives in versions.
 */
export const posts = pgTable(
  "posts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // Restrict: a brand with posts is archived, never deleted (docs/ARCHITECTURE.md §4).
    brandId: uuid("brand_id")
      .notNull()
      .references(() => brands.id, { onDelete: "restrict" }),
    /** Brand prefix + number, e.g. RA-0142. Immutable. */
    publicCode: text("public_code").notNull(),
    number: integer("number").notNull(),
    pillarId: uuid("pillar_id").references(() => contentPillars.id, { onDelete: "restrict" }),
    /** The bank idea it was generated from, if any. */
    ideaId: uuid("idea_id").references(() => ideas.id, { onDelete: "set null" }),
    /** Copied from the current version, for filters. Validated by the carousel schema. */
    hookType: text("hook_type"),
    status: text("status", { enum: POST_STATUSES }).notNull(),
    currentVersionId: uuid("current_version_id").references((): AnyPgColumn => postVersions.id, {
      onDelete: "set null",
    }),
    scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
    /** The operator's last rejection: the AI reads it in every regeneration of the post. */
    rejectionFeedback: text("rejection_feedback"),
    /** Automatic regenerations for render QA problems since the last rejection (max. 2). */
    qaRegenerations: integer("qa_regenerations").notNull().default(0),
    /** What the operator asked the AI for (idea, pillar, hook). Null for posts made by hand. */
    generationRequest: jsonb("generation_request").$type<GenerationRequest>(),
    /** When a generation that hit a provider's limit tries again. Null otherwise. */
    generationRetryAt: timestamp("generation_retry_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("posts_public_code_unique").on(t.publicCode),
    uniqueIndex("posts_brand_number_unique").on(t.brandId, t.number),
    index("posts_brand_status_idx").on(t.brandId, t.status),
    check("posts_status_valid", sql`${t.status} in (${inList(POST_STATUSES)})`),
  ],
);

/** Every save of a carousel (AI or editor) is a new version; the post points to the current one. */
export const postVersions = pgTable(
  "post_versions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    postId: uuid("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    number: integer("number").notNull(),
    /** A `Carousel` (packages/slides), validated with Zod before it is stored (rule 4). */
    content: jsonb("content").$type<Record<string, unknown>>().notNull(),
    schemaVersion: integer("schema_version").notNull().default(1),
    origin: text("origin", { enum: VERSION_ORIGINS }).notNull(),
    /** Render QA problems of this version (docs/ARCHITECTURE.md §8), null when it rendered fine. */
    renderIssues: jsonb("render_issues").$type<unknown[]>(),
    /** 0–100 while the worker renders this version (slides done); null otherwise. */
    renderProgress: integer("render_progress"),
    /** The generation attempt that wrote this version (origin `ai`). */
    generationRunId: uuid("generation_run_id").references((): AnyPgColumn => generationRuns.id, {
      onDelete: "set null",
    }),
    /**
     * Points of this version's `chart` slides, by datasetRef, frozen when it was saved (phase 3,
     * T11): a new render always draws the numbers the text was written with.
     */
    datasets: jsonb("datasets").$type<Record<string, DataSeries>>(),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("post_versions_post_number_unique").on(t.postId, t.number),
    check("post_versions_origin_valid", sql`${t.origin} in (${inList(VERSION_ORIGINS)})`),
  ],
);

/** Rendered slides of a version: one PNG per slide and format, in MEDIA_DIR. */
export const assets = pgTable(
  "assets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    postVersionId: uuid("post_version_id")
      .notNull()
      .references(() => postVersions.id, { onDelete: "cascade" }),
    format: text("format", { enum: RENDER_FORMATS }).notNull(),
    slideIndex: integer("slide_index").notNull(),
    /** Relative to MEDIA_DIR: <brand>/<postId>/<versionId>/<format>/<index>.png */
    path: text("path").notNull(),
    width: integer("width").notNull(),
    height: integer("height").notNull(),
    /** SHA-256 of the file. */
    checksum: text("checksum").notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    // One file per slide and format: rendering twice replaces, never duplicates (rule 8).
    uniqueIndex("assets_version_format_slide_unique").on(t.postVersionId, t.format, t.slideIndex),
    uniqueIndex("assets_path_unique").on(t.path),
    check("assets_format_valid", sql`${t.format} in (${inList(RENDER_FORMATS)})`),
  ],
);

/** A post published (or being published) on a network. One per post and network (rule 8). */
export const publications = pgTable(
  "publications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    postId: uuid("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    network: text("network", { enum: NETWORKS }).notNull(),
    status: text("status", { enum: PUBLICATION_STATUSES }).notNull(),
    externalId: text("external_id"),
    url: text("url"),
    error: text("error"),
    attempts: integer("attempts").notNull().default(0),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("publications_post_network_unique").on(t.postId, t.network),
    check("publications_network_valid", sql`${t.network} in (${inList(NETWORKS)})`),
    check("publications_status_valid", sql`${t.status} in (${inList(PUBLICATION_STATUSES)})`),
  ],
);

/**
 * Provider and model of each AI task, with an optional fallback (docs/ARCHITECTURE.md §7).
 * `brand_id` null is the global route; a brand's own route wins over it. Checked with
 * checkAiRoute (packages/core) before saving.
 */
export const aiRoutes = pgTable(
  "ai_routes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    task: text("task", { enum: AI_TASKS }).notNull(),
    brandId: uuid("brand_id").references(() => brands.id, { onDelete: "cascade" }),
    provider: text("provider", { enum: AI_PROVIDERS }).notNull(),
    model: text("model").notNull(),
    fallbackProvider: text("fallback_provider", { enum: AI_PROVIDERS }),
    fallbackModel: text("fallback_model"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    // One route per task and brand, and one global (null brand) per task.
    unique("ai_routes_task_brand_unique").on(t.task, t.brandId).nullsNotDistinct(),
    check("ai_routes_task_valid", sql`${t.task} in (${inList(AI_TASKS)})`),
    check("ai_routes_provider_valid", sql`${t.provider} in (${inList(AI_PROVIDERS)})`),
    check(
      "ai_routes_fallback_provider_valid",
      sql`${t.fallbackProvider} is null or ${t.fallbackProvider} in (${inList(AI_PROVIDERS)})`,
    ),
    check(
      "ai_routes_fallback_complete",
      sql`(${t.fallbackProvider} is null) = (${t.fallbackModel} is null)`,
    ),
  ],
);

/**
 * One attempt of a generation: which provider and model answered, what it used and how it
 * ended. The brand's caps count the successful ones (docs/ARCHITECTURE.md §7, "Registro").
 */
export const generationRuns = pgTable(
  "generation_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    brandId: uuid("brand_id")
      .notNull()
      .references(() => brands.id, { onDelete: "cascade" }),
    postId: uuid("post_id").references(() => posts.id, { onDelete: "set null" }),
    task: text("task", { enum: AI_TASKS }).notNull(),
    role: text("role", { enum: ROUTE_ROLES }).notNull(),
    provider: text("provider", { enum: AI_PROVIDERS }).notNull(),
    /** The model that answered (the canonical name when the provider reports it). */
    model: text("model").notNull(),
    status: text("status", { enum: GENERATION_RUN_STATUSES }).notNull(),
    /** validation, rate_limited or provider_error; null when it succeeded. */
    errorKind: text("error_kind"),
    error: text("error"),
    inputTokens: integer("input_tokens").notNull().default(0),
    outputTokens: integer("output_tokens").notNull().default(0),
    /** List price reported by the provider; with the Claude subscription nothing is charged. */
    costUsd: real("cost_usd"),
    durationMs: integer("duration_ms"),
    numTurns: integer("num_turns"),
    sessionId: text("session_id"),
    createdAt: createdAt(),
  },
  (t) => [
    index("generation_runs_brand_created_idx").on(t.brandId, t.createdAt),
    check("generation_runs_task_valid", sql`${t.task} in (${inList(AI_TASKS)})`),
    check("generation_runs_role_valid", sql`${t.role} in (${inList(ROUTE_ROLES)})`),
    check("generation_runs_provider_valid", sql`${t.provider} in (${inList(AI_PROVIDERS)})`),
    check("generation_runs_status_valid", sql`${t.status} in (${inList(GENERATION_RUN_STATUSES)})`),
  ],
);

/**
 * What a data source said on a day (`data.refresh`), e.g. the dollar from Bluelytics. One per
 * source and day: a second refresh the same day replaces it (rule 8).
 */
export const dataSnapshots = pgTable(
  "data_snapshots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    source: text("source", { enum: DATA_SOURCES }).notNull(),
    /** Date of the data, as the source reports it. */
    asOf: date("as_of").notNull(),
    fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull().defaultNow(),
    /** The source's own shape, validated when fetched (e.g. BluelyticsSnapshot of packages/core). */
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
  },
  (t) => [
    uniqueIndex("data_snapshots_source_as_of_unique").on(t.source, t.asOf),
    check("data_snapshots_source_valid", sql`${t.source} in (${inList(DATA_SOURCES)})`),
  ],
);

/** Global key/value settings (e.g. the AI generation window). */
export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  updatedAt: updatedAt(),
});

export type Brand = typeof brands.$inferSelect;
export type NewBrand = typeof brands.$inferInsert;
export type Setting = typeof settings.$inferSelect;
export type BrandAsset = typeof brandAssets.$inferSelect;
export type ContentPillar = typeof contentPillars.$inferSelect;
export type NewContentPillar = typeof contentPillars.$inferInsert;
export type Idea = typeof ideas.$inferSelect;
export type ContentSeries = typeof contentSeries.$inferSelect;
export type IdeaRequest = typeof ideaRequests.$inferSelect;
export type Post = typeof posts.$inferSelect;
export type PostVersion = typeof postVersions.$inferSelect;
export type RenderedAsset = typeof assets.$inferSelect;
export type Publication = typeof publications.$inferSelect;
export type NewBrandAsset = typeof brandAssets.$inferInsert;
export type BrandDocument = typeof brandDocuments.$inferSelect;
export type AiRouteRow = typeof aiRoutes.$inferSelect;
export type DataSnapshot = typeof dataSnapshots.$inferSelect;
export type GenerationRun = typeof generationRuns.$inferSelect;
export type NewGenerationRun = typeof generationRuns.$inferInsert;

export * from "./auth-schema";
