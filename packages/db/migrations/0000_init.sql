CREATE TABLE "brands" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"code_prefix" text NOT NULL,
	"style_preset" text NOT NULL,
	"theme_tokens" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"timezone" text DEFAULT 'America/Argentina/Buenos_Aires' NOT NULL,
	"posts_per_day_target" integer DEFAULT 1 NOT NULL,
	"ai_daily_limit" integer,
	"ai_monthly_limit" integer,
	"whatsapp_number" text,
	"whatsapp_message_template" text,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "brands_slug_format" CHECK ("brands"."slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
	CONSTRAINT "brands_code_prefix_format" CHECK ("brands"."code_prefix" ~ '^[A-Z]{2,4}$'),
	CONSTRAINT "brands_posts_per_day_target_non_negative" CHECK ("brands"."posts_per_day_target" >= 0),
	CONSTRAINT "brands_ai_daily_limit_non_negative" CHECK ("brands"."ai_daily_limit" >= 0),
	CONSTRAINT "brands_ai_monthly_limit_non_negative" CHECK ("brands"."ai_monthly_limit" >= 0)
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "brands_slug_unique" ON "brands" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "brands_code_prefix_unique" ON "brands" USING btree ("code_prefix");