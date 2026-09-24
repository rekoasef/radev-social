import { ASSET_ROLES } from "@radev/core";
import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  jsonb,
  pgTable,
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
export type NewBrandAsset = typeof brandAssets.$inferInsert;

export * from "./auth-schema";
