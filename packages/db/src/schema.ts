import { sql } from "drizzle-orm";
import {
  check,
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
    /** Tokens for the preset. Validated against the preset's Zod schema from phase 1 on. */
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

/** Global key/value settings (e.g. the AI generation window). */
export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  updatedAt: updatedAt(),
});

export type Brand = typeof brands.$inferSelect;
export type NewBrand = typeof brands.$inferInsert;
export type Setting = typeof settings.$inferSelect;

export * from "./auth-schema";
