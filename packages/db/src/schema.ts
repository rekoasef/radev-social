import {
  type AccountStats,
  AI_PROVIDERS,
  AI_TASKS,
  ASSET_ROLES,
  BRAND_DOCUMENT_KINDS,
  DATA_SOURCES,
  type DataSeries,
  DOCUMENT_ORIGINS,
  GENERATION_RUN_STATUSES,
  type GenerationRequest,
  IDEA_REQUEST_STATUSES,
  IDEA_REQUEST_TASKS,
  IDEA_SOURCES,
  IDEA_STATUSES,
  type IdeaRequestParams,
  LEAD_CHANNELS,
  LEAD_STATUSES,
  MAX_POST_SCREENSHOTS,
  METRIC_SOURCES,
  NETWORKS,
  NOTIFICATION_KINDS,
  PAUSE_REASONS,
  PILLAR_GOALS,
  POST_STATUSES,
  type PostArt,
  PUBLICATION_STATUSES,
  RENDER_FORMATS,
  ROUTE_ROLES,
  SLIDE_REWRITE_STATUSES,
  SOCIAL_ACCOUNT_STATUSES,
  SOCIAL_NETWORKS,
  USAGE_KINDS,
  VERSION_ORIGINS,
  VIDEO_DOCUMENT_KINDS,
  VIDEO_STAGES,
  type VideoProgress,
  VOICE_PROVIDERS,
  VOICE_USES,
  WORKING_STAGES,
} from "@radev/core";
import { sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  real,
  smallint,
  text,
  time,
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
    /** The site the calls to action send people to, as shown ("radev.tech"); wins over WhatsApp. */
    website: text("website"),
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
    /** What its posts are for (PILLAR_GOALS); null until the operator sets it (ADR 0021). */
    goal: text("goal", { enum: PILLAR_GOALS }),
    /** Preferred hook types (HOOK_TYPES of packages/slides): a preference for the AI. */
    hookTypes: jsonb("hook_types").$type<string[]>().notNull().default([]),
    /** How its posts are told: angle, formats that suit it, example topics. */
    guide: text("guide").notNull().default(""),
    /** What its posts ask of the viewer at the end. */
    closing: text("closing").notNull().default(""),
    /** What doesn't go in this pillar. */
    avoid: text("avoid").notNull().default(""),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("content_pillars_brand_key_unique").on(t.brandId, t.key),
    check("content_pillars_key_format", sql`${t.key} ~ '^[a-z0-9]+(-[a-z0-9]+)*$'`),
    check("content_pillars_share_range", sql`${t.targetShare} >= 0 and ${t.targetShare} <= 1`),
    check("content_pillars_goal_valid", sql`${t.goal} in (${inList(PILLAR_GOALS)})`),
  ],
);

/**
 * When a brand publishes (docs/PRD.md RF-06): a weekday and a wall-clock time in the brand's time
 * zone. Turned into UTC instants only for a given week (packages/core, `upcomingSlots`).
 */
export const scheduleSlots = pgTable(
  "schedule_slots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    brandId: uuid("brand_id")
      .notNull()
      .references(() => brands.id, { onDelete: "cascade" }),
    /** 0 = Sunday … 6 = Saturday. */
    weekday: smallint("weekday").notNull(),
    /** Local time in the brand's zone, e.g. "19:00:00". */
    localTime: time("local_time").notNull(),
    /** A paused slot stays configured but gets no posts. */
    active: boolean("active").notNull().default(true),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("schedule_slots_brand_weekday_time_unique").on(t.brandId, t.weekday, t.localTime),
    check("schedule_slots_weekday_range", sql`${t.weekday} between 0 and 6`),
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

/**
 * A slide rewrite asked from the editor: the carousel as the editor had it (it may be unsaved),
 * which slide and how. The worker leaves the rewritten slide in `result`; the editor shows it as
 * a proposal the operator accepts or discards. Nothing here changes a post.
 */
export const slideRewrites = pgTable(
  "slide_rewrites",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    brandId: uuid("brand_id")
      .notNull()
      .references(() => brands.id, { onDelete: "cascade" }),
    /** The post being edited; null for a new one (not saved yet). */
    postId: uuid("post_id").references(() => posts.id, { onDelete: "cascade" }),
    carousel: jsonb("carousel").$type<Record<string, unknown>>().notNull(),
    slideIndex: integer("slide_index").notNull(),
    /** The operator's instruction; empty: "make it better". */
    instruction: text("instruction").notNull().default(""),
    status: text("status", { enum: SLIDE_REWRITE_STATUSES }).notNull().default("queued"),
    /** The rewritten slide (a `Slide`), validated inside the whole carousel. */
    result: jsonb("result").$type<Record<string, unknown>>(),
    error: text("error"),
    createdAt: createdAt(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
  },
  (t) => [
    index("slide_rewrites_brand_created_idx").on(t.brandId, t.createdAt),
    check("slide_rewrites_status_valid", sql`${t.status} in (${inList(SLIDE_REWRITE_STATUSES)})`),
  ],
);

export type SlideRewrite = typeof slideRewrites.$inferSelect;

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
    /**
     * Planned publishing time (phase 4, T2). The `scheduled` status means its publish job is
     * queued; editing drops the job but keeps this time, and approving schedules it back.
     */
    scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
    /** The brand slot the planned time comes from; null for a time picked by hand. */
    slotId: uuid("slot_id").references((): AnyPgColumn => scheduleSlots.id, {
      onDelete: "set null",
    }),
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
    // One post per brand and time: an archived one frees its time.
    uniqueIndex("posts_brand_scheduled_at_unique")
      .on(t.brandId, t.scheduledAt)
      .where(sql`${t.scheduledAt} is not null and ${t.status} <> 'archived'`),
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
    /** When the operator was told this version is waiting for review (Telegram, phase 4 T6). */
    reviewNotifiedAt: timestamp("review_notified_at", { withTimezone: true }),
    /** Images of the cover and the close (ADR 0016); null when the version takes none. */
    art: jsonb("art").$type<PostArt>(),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("post_versions_post_number_unique").on(t.postId, t.number),
    check("post_versions_origin_valid", sql`${t.origin} in (${inList(VERSION_ORIGINS)})`),
  ],
);

/**
 * Screenshots the operator attached when asking the AI for the post (ADR 0024): the AI sees them
 * and shows them on `screen` slides. They belong to the post, so every version can use them.
 */
export const postScreenshots = pgTable(
  "post_screenshots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    postId: uuid("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    /** Order the operator gave them, from 0. */
    position: integer("position").notNull(),
    /** Relative to MEDIA_DIR: <brand>/screens/<file>. */
    path: text("path").notNull(),
    mime: text("mime").notNull(),
    width: integer("width").notNull(),
    height: integer("height").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    /** What it shows, in the operator's words; the AI reads it (and it is all a model without vision gets). */
    note: text("note").notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("post_screenshots_post_position_unique").on(t.postId, t.position),
    uniqueIndex("post_screenshots_path_unique").on(t.path),
    check(
      "post_screenshots_position_valid",
      sql`${t.position} >= 0 and ${t.position} < ${sql.raw(String(MAX_POST_SCREENSHOTS))}`,
    ),
  ],
);

/** Rendered slides of a version: one PNG (and its JPEG) per slide and format, in MEDIA_DIR. */
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
    /**
     * Same slide as JPEG, for TikTok (photo mode takes JPEG or WebP, not PNG; phase 5 T5), next to
     * the PNG: <index>.jpg. Null in versions rendered before it.
     */
    jpegPath: text("jpeg_path"),
    jpegChecksum: text("jpeg_checksum"),
    createdAt: createdAt(),
  },
  (t) => [
    // One file per slide and format: rendering twice replaces, never duplicates (rule 8).
    uniqueIndex("assets_version_format_slide_unique").on(t.postVersionId, t.format, t.slideIndex),
    uniqueIndex("assets_path_unique").on(t.path),
    check("assets_format_valid", sql`${t.format} in (${inList(RENDER_FORMATS)})`),
  ],
);

/**
 * A brand's account on a network, connected by OAuth (phase 5). Tokens are stored encrypted with
 * AES-256-GCM (token-crypto.ts); only queries/social-accounts.ts reads or writes them.
 */
export const socialAccounts = pgTable(
  "social_accounts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    brandId: uuid("brand_id")
      .notNull()
      .references(() => brands.id, { onDelete: "cascade" }),
    network: text("network", { enum: SOCIAL_NETWORKS }).notNull(),
    /** The account's id on the network (TikTok: open_id). */
    externalId: text("external_id").notNull(),
    /** Username, e.g. "radev.tech" (shown to confirm which account is connected). */
    handle: text("handle"),
    displayName: text("display_name"),
    /** Scopes the operator granted (may be fewer than the app asked for). */
    scopes: text("scopes").array().notNull().default(sql`'{}'::text[]`),
    accessTokenEnc: text("access_token_enc").notNull(),
    accessExpiresAt: timestamp("access_expires_at", { withTimezone: true }).notNull(),
    refreshTokenEnc: text("refresh_token_enc"),
    refreshExpiresAt: timestamp("refresh_expires_at", { withTimezone: true }),
    status: text("status", { enum: SOCIAL_ACCOUNT_STATUSES }).notNull().default("active"),
    /** Why it needs to be connected again (never contains a token). */
    lastError: text("last_error"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    // One account per brand and network; the same account can't belong to two brands.
    uniqueIndex("social_accounts_brand_network_unique").on(t.brandId, t.network),
    uniqueIndex("social_accounts_network_external_unique").on(t.network, t.externalId),
    check("social_accounts_network_valid", sql`${t.network} in (${inList(SOCIAL_NETWORKS)})`),
    check("social_accounts_status_valid", sql`${t.status} in (${inList(SOCIAL_ACCOUNT_STATUSES)})`),
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
 * Every post of a connected account as the network shows it (phase 6, ADR 0018): ours and the ones
 * made outside the system. `post_id` links it to our post when metrics.sync finds which one it is.
 * Its counts are the latest; `post_metrics` keeps how they grew.
 */
export const networkPosts = pgTable(
  "network_posts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    brandId: uuid("brand_id")
      .notNull()
      .references(() => brands.id, { onDelete: "cascade" }),
    network: text("network", { enum: SOCIAL_NETWORKS }).notNull(),
    /** The post's id on the network (TikTok: 19 digits, kept as text). */
    externalId: text("external_id").notNull(),
    postId: uuid("post_id").references(() => posts.id, { onDelete: "set null" }),
    caption: text("caption").notNull().default(""),
    url: text("url"),
    /** `photo` (carousel) or `video`. */
    kind: text("kind").notNull().default("photo"),
    /** Cover downloaded to MEDIA_DIR (the network's link expires); null until then. */
    coverPath: text("cover_path"),
    publishedAt: timestamp("published_at", { withTimezone: true }).notNull(),
    views: integer("views").notNull().default(0),
    likes: integer("likes").notNull().default(0),
    comments: integer("comments").notNull().default(0),
    shares: integer("shares").notNull().default(0),
    /** When the counts above were read. */
    metricsAt: timestamp("metrics_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("network_posts_network_external_unique").on(t.network, t.externalId),
    // One network post per post of ours and network.
    uniqueIndex("network_posts_post_network_unique")
      .on(t.postId, t.network)
      .where(sql`${t.postId} is not null`),
    index("network_posts_brand_published_idx").on(t.brandId, t.publishedAt),
    check("network_posts_network_valid", sql`${t.network} in (${inList(SOCIAL_NETWORKS)})`),
    check("network_posts_kind_valid", sql`${t.kind} in ('photo', 'video')`),
  ],
);

/**
 * A post's counts on a day, in the brand's zone: one row per post, source and day, the latest read
 * of the day wins (rule 8). How a post grew after it went out.
 */
export const postMetrics = pgTable(
  "post_metrics",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    networkPostId: uuid("network_post_id")
      .notNull()
      .references(() => networkPosts.id, { onDelete: "cascade" }),
    capturedOn: date("captured_on").notNull(),
    capturedAt: timestamp("captured_at", { withTimezone: true }).notNull().defaultNow(),
    views: integer("views").notNull(),
    likes: integer("likes").notNull(),
    comments: integer("comments").notNull(),
    shares: integer("shares").notNull(),
    /** Not in TikTok's API: only from screenshots or by hand. */
    saves: integer("saves"),
    source: text("source", { enum: METRIC_SOURCES }).notNull(),
  },
  (t) => [
    uniqueIndex("post_metrics_post_source_day_unique").on(t.networkPostId, t.source, t.capturedOn),
    check("post_metrics_source_valid", sql`${t.source} in (${inList(METRIC_SOURCES)})`),
  ],
);

/**
 * The account's totals on a day, in the brand's zone (followers, likes, posts). One per brand,
 * network, source and day; the latest read of the day wins (rule 8).
 */
export const audienceSnapshots = pgTable(
  "audience_snapshots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    brandId: uuid("brand_id")
      .notNull()
      .references(() => brands.id, { onDelete: "cascade" }),
    network: text("network", { enum: SOCIAL_NETWORKS }).notNull(),
    capturedOn: date("captured_on").notNull(),
    capturedAt: timestamp("captured_at", { withTimezone: true }).notNull().defaultNow(),
    /** AccountStats from the API; screenshots (RF-39) may add more keys. */
    data: jsonb("data").$type<AccountStats & Record<string, unknown>>().notNull(),
    source: text("source", { enum: METRIC_SOURCES }).notNull(),
  },
  (t) => [
    uniqueIndex("audience_snapshots_brand_network_source_day_unique").on(
      t.brandId,
      t.network,
      t.source,
      t.capturedOn,
    ),
    check("audience_snapshots_network_valid", sql`${t.network} in (${inList(SOCIAL_NETWORKS)})`),
    check("audience_snapshots_source_valid", sql`${t.source} in (${inList(METRIC_SOURCES)})`),
  ],
);

/**
 * Someone who wrote to the brand (RF-42), typed by the operator. `post_ref` is what the message
 * said (RA-0142, TK-545557); `network_post_id` the post it points to, when it's one of the account.
 */
export const leads = pgTable(
  "leads",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    brandId: uuid("brand_id")
      .notNull()
      .references(() => brands.id, { onDelete: "cascade" }),
    name: text("name").notNull().default(""),
    contact: text("contact").notNull().default(""),
    channel: text("channel", { enum: LEAD_CHANNELS }).notNull().default("whatsapp"),
    postRef: text("post_ref"),
    networkPostId: uuid("network_post_id").references(() => networkPosts.id, {
      onDelete: "set null",
    }),
    status: text("status", { enum: LEAD_STATUSES }).notNull().default("new"),
    notes: text("notes").notNull().default(""),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("leads_brand_created_idx").on(t.brandId, t.createdAt),
    index("leads_network_post_idx").on(t.networkPostId),
    check("leads_channel_valid", sql`${t.channel} in (${inList(LEAD_CHANNELS)})`),
    check("leads_status_valid", sql`${t.status} in (${inList(LEAD_STATUSES)})`),
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
    // Null for a video without a brand (ADR 0029, D-B): then `videoId` says whose run it is.
    brandId: uuid("brand_id").references(() => brands.id, { onDelete: "cascade" }),
    postId: uuid("post_id").references(() => posts.id, { onDelete: "set null" }),
    // Cascade: a video's AI runs die with it (set null would leave a brandless run without an owner).
    videoId: uuid("video_id").references((): AnyPgColumn => videos.id, { onDelete: "cascade" }),
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
    /** The answer was well formed but did not pass the office's checks: why (video). */
    checkProblems: jsonb("check_problems").$type<string[]>(),
    createdAt: createdAt(),
  },
  (t) => [
    index("generation_runs_brand_created_idx").on(t.brandId, t.createdAt),
    check("generation_runs_task_valid", sql`${t.task} in (${inList(AI_TASKS)})`),
    check("generation_runs_role_valid", sql`${t.role} in (${inList(ROUTE_ROLES)})`),
    check("generation_runs_provider_valid", sql`${t.provider} in (${inList(AI_PROVIDERS)})`),
    check("generation_runs_status_valid", sql`${t.status} in (${inList(GENERATION_RUN_STATUSES)})`),
    check("generation_runs_owner", sql`${t.brandId} is not null or ${t.videoId} is not null`),
    index("generation_runs_video_idx").on(t.videoId),
  ],
);

// ───────────── RAdev Studio: video (docs/RADEV-STUDIO-REVISION.md §7.3, ADR 0029) ─────────────

/** A narrator's voice (ADR 0027). The video picks one; the brand may have a default. */
export const voices = pgTable(
  "voices",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    provider: text("provider", { enum: VOICE_PROVIDERS }).notNull(),
    /** The provider's id for the voice (ElevenLabs: `l1zE9xgNpUTaQCZzpNJa`). */
    externalId: text("external_id").notNull(),
    name: text("name").notNull(),
    use: text("use", { enum: VOICE_USES }).notNull(),
    language: text("language").notNull().default("es"),
    /** Null: the speed saved in the voice. */
    speed: real("speed"),
    /** The voice a new video gets for its use and language. One per use and language. */
    isDefault: boolean("is_default").notNull().default(false),
    /** A sample to listen to before choosing (the provider's public link). */
    previewUrl: text("preview_url"),
    /** A voice the library no longer offers is marked inactive, never deleted. */
    active: boolean("active").notNull().default(true),
    createdAt: createdAt(),
  },
  (t) => [
    unique("voices_provider_external_unique").on(t.provider, t.externalId),
    uniqueIndex("voices_default_unique").on(t.use, t.language).where(sql`${t.isDefault}`),
    check("voices_provider_valid", sql`${t.provider} in (${inList(VOICE_PROVIDERS)})`),
    check("voices_use_valid", sql`${t.use} in (${inList(VOICE_USES)})`),
  ],
);

/** The last failure of a video's office, as stored (dates as ISO strings). */
export type VideoFailureRecord = {
  stage: (typeof VIDEO_STAGES)[number];
  message: string;
  retryable: boolean;
  at: string;
};

/**
 * A video moving through the offices. `stage` only changes through `transitionVideo`
 * (queries/videos.ts; rule 2); pause and failure are a separate condition.
 */
export const videos = pgTable(
  "videos",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // Optional (D-B): a video of history or curiosities needs no brand. Archived, never deleted.
    brandId: uuid("brand_id").references(() => brands.id, { onDelete: "restrict" }),
    topic: text("topic").notNull(),
    /** Set when the script exists; the folder of the downloaded package is a slug of it. */
    title: text("title"),
    language: text("language").notNull().default("es"),
    voiceId: uuid("voice_id").references(() => voices.id, { onDelete: "restrict" }),
    stage: text("stage", { enum: VIDEO_STAGES }).notNull(),
    pausedAt: timestamp("paused_at", { withTimezone: true }),
    pauseReason: text("pause_reason", { enum: PAUSE_REASONS }),
    /** When a `provider_limit` pause ends by itself. */
    resumeAt: timestamp("resume_at", { withTimezone: true }),
    failure: jsonb("failure").$type<VideoFailureRecord>(),
    /** What the office working on it is doing (try, percent). Cleared on every stage change. */
    progress: jsonb("progress").$type<VideoProgress>(),
    /** The operator's last rejection: the Script office reads it when it writes again. */
    rejectionNote: text("rejection_note"),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("videos_stage_idx").on(t.stage),
    index("videos_brand_idx").on(t.brandId),
    check("videos_stage_valid", sql`${t.stage} in (${inList(VIDEO_STAGES)})`),
    check("videos_pause_reason_valid", sql`${t.pauseReason} in (${inList(PAUSE_REASONS)})`),
    check("videos_pause_consistent", sql`(${t.pausedAt} is null) = (${t.pauseReason} is null)`),
  ],
);

/**
 * What each office leaves for the next one: a versioned, Zod-validated document (rule 4). A
 * rejection writes a new version and never touches the old ones; the highest version is current.
 */
export const videoDocuments = pgTable(
  "video_documents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    videoId: uuid("video_id")
      .notNull()
      .references(() => videos.id, { onDelete: "cascade" }),
    kind: text("kind", { enum: VIDEO_DOCUMENT_KINDS }).notNull(),
    version: integer("version").notNull(),
    data: jsonb("data").$type<Record<string, unknown>>().notNull(),
    schemaVersion: integer("schema_version").notNull().default(1),
    origin: text("origin", { enum: DOCUMENT_ORIGINS }).notNull(),
    generationRunId: uuid("generation_run_id").references((): AnyPgColumn => generationRuns.id, {
      onDelete: "set null",
    }),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("video_documents_video_kind_version_unique").on(t.videoId, t.kind, t.version),
    check("video_documents_kind_valid", sql`${t.kind} in (${inList(VIDEO_DOCUMENT_KINDS)})`),
    check("video_documents_origin_valid", sql`${t.origin} in (${inList(DOCUMENT_ORIGINS)})`),
    check("video_documents_version_valid", sql`${t.version} >= 1`),
  ],
);

/** Voice credits, render time and downloads of a video, for the offices' reports. Cost is 0. */
export const usageEvents = pgTable(
  "usage_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    videoId: uuid("video_id")
      .notNull()
      .references(() => videos.id, { onDelete: "cascade" }),
    /** The office that did the work; null for a download. */
    office: text("office", { enum: WORKING_STAGES }),
    kind: text("kind", { enum: USAGE_KINDS }).notNull(),
    quantity: real("quantity").notNull(),
    /** credits, seconds, MB… */
    unit: text("unit").notNull(),
    durationMs: integer("duration_ms"),
    data: jsonb("data").$type<Record<string, unknown>>(),
    createdAt: createdAt(),
  },
  (t) => [
    index("usage_events_video_idx").on(t.videoId, t.createdAt),
    check("usage_events_kind_valid", sql`${t.kind} in (${inList(USAGE_KINDS)})`),
    check("usage_events_office_valid", sql`${t.office} in (${inList(WORKING_STAGES)})`),
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

/**
 * Messages to the operator (Telegram, phase 4 T6). `key` says what it is about (e.g.
 * "publish:<post>:<time>"): the same key is never stored, nor sent, twice (rule 8).
 */
export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    key: text("key").notNull(),
    kind: text("kind", { enum: NOTIFICATION_KINDS }).notNull(),
    text: text("text").notNull(),
    /** Sent without sound (inside the generation window). */
    silent: boolean("silent").notNull().default(false),
    createdAt: createdAt(),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    /** Last sending error (never the token). */
    error: text("error"),
  },
  (t) => [
    uniqueIndex("notifications_key_unique").on(t.key),
    check("notifications_kind_valid", sql`${t.kind} in (${inList(NOTIFICATION_KINDS)})`),
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
export type ScheduleSlot = typeof scheduleSlots.$inferSelect;
export type Notification = typeof notifications.$inferSelect;
export type NewContentPillar = typeof contentPillars.$inferInsert;
export type Idea = typeof ideas.$inferSelect;
export type IdeaRequest = typeof ideaRequests.$inferSelect;
export type Post = typeof posts.$inferSelect;
export type PostVersion = typeof postVersions.$inferSelect;
export type RenderedAsset = typeof assets.$inferSelect;
export type PostScreenshot = typeof postScreenshots.$inferSelect;
export type Publication = typeof publications.$inferSelect;
export type SocialAccountRow = typeof socialAccounts.$inferSelect;
export type NewBrandAsset = typeof brandAssets.$inferInsert;
export type BrandDocument = typeof brandDocuments.$inferSelect;
export type AiRouteRow = typeof aiRoutes.$inferSelect;
export type DataSnapshot = typeof dataSnapshots.$inferSelect;
export type GenerationRun = typeof generationRuns.$inferSelect;
export type NetworkPost = typeof networkPosts.$inferSelect;
export type PostMetric = typeof postMetrics.$inferSelect;
export type AudienceSnapshot = typeof audienceSnapshots.$inferSelect;
export type Lead = typeof leads.$inferSelect;
export type NewGenerationRun = typeof generationRuns.$inferInsert;

export * from "./auth-schema";

export type Voice = typeof voices.$inferSelect;
export type Video = typeof videos.$inferSelect;
export type VideoDocument = typeof videoDocuments.$inferSelect;
export type UsageEvent = typeof usageEvents.$inferSelect;
