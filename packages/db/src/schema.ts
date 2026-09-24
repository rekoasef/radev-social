import {
  ASSET_ROLES,
  BRAND_DOCUMENT_KINDS,
  NETWORKS,
  POST_STATUSES,
  PUBLICATION_STATUSES,
  RENDER_FORMATS,
  VERSION_ORIGINS,
} from "@radev/core";
import { sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  real,
  text,
  timestamp,
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
    /** Copied from the current version, for filters. Validated by the carousel schema. */
    hookType: text("hook_type"),
    status: text("status", { enum: POST_STATUSES }).notNull(),
    currentVersionId: uuid("current_version_id").references((): AnyPgColumn => postVersions.id, {
      onDelete: "set null",
    }),
    scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
    rejectionFeedback: text("rejection_feedback"),
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
export type Post = typeof posts.$inferSelect;
export type PostVersion = typeof postVersions.$inferSelect;
export type RenderedAsset = typeof assets.$inferSelect;
export type Publication = typeof publications.$inferSelect;
export type NewBrandAsset = typeof brandAssets.$inferInsert;
export type BrandDocument = typeof brandDocuments.$inferSelect;

export * from "./auth-schema";
