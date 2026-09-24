CREATE TABLE "assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"post_version_id" uuid NOT NULL,
	"format" text NOT NULL,
	"slide_index" integer NOT NULL,
	"path" text NOT NULL,
	"width" integer NOT NULL,
	"height" integer NOT NULL,
	"checksum" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "assets_format_valid" CHECK ("assets"."format" in ('4x5'))
);
--> statement-breakpoint
CREATE TABLE "content_pillars" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"brand_id" uuid NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"target_share" real DEFAULT 0 NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "content_pillars_key_format" CHECK ("content_pillars"."key" ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
	CONSTRAINT "content_pillars_share_range" CHECK ("content_pillars"."target_share" >= 0 and "content_pillars"."target_share" <= 1)
);
--> statement-breakpoint
CREATE TABLE "post_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"post_id" uuid NOT NULL,
	"number" integer NOT NULL,
	"content" jsonb NOT NULL,
	"schema_version" integer DEFAULT 1 NOT NULL,
	"origin" text NOT NULL,
	"render_issues" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "post_versions_origin_valid" CHECK ("post_versions"."origin" in ('ai', 'manual'))
);
--> statement-breakpoint
CREATE TABLE "posts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"brand_id" uuid NOT NULL,
	"public_code" text NOT NULL,
	"number" integer NOT NULL,
	"pillar_id" uuid,
	"hook_type" text,
	"status" text NOT NULL,
	"current_version_id" uuid,
	"scheduled_at" timestamp with time zone,
	"rejection_feedback" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "posts_status_valid" CHECK ("posts"."status" in ('generating', 'rendering', 'in_review', 'rejected', 'approved', 'scheduled', 'publishing', 'published', 'publish_failed', 'failed', 'archived'))
);
--> statement-breakpoint
CREATE TABLE "publications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"post_id" uuid NOT NULL,
	"network" text NOT NULL,
	"status" text NOT NULL,
	"external_id" text,
	"url" text,
	"error" text,
	"attempts" integer DEFAULT 0 NOT NULL,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "publications_network_valid" CHECK ("publications"."network" in ('manual', 'tiktok')),
	CONSTRAINT "publications_status_valid" CHECK ("publications"."status" in ('pending', 'published', 'failed'))
);
--> statement-breakpoint
ALTER TABLE "brands" ADD COLUMN "next_post_number" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_post_version_id_post_versions_id_fk" FOREIGN KEY ("post_version_id") REFERENCES "public"."post_versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_pillars" ADD CONSTRAINT "content_pillars_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_versions" ADD CONSTRAINT "post_versions_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_pillar_id_content_pillars_id_fk" FOREIGN KEY ("pillar_id") REFERENCES "public"."content_pillars"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_current_version_id_post_versions_id_fk" FOREIGN KEY ("current_version_id") REFERENCES "public"."post_versions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "publications" ADD CONSTRAINT "publications_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "assets_version_format_slide_unique" ON "assets" USING btree ("post_version_id","format","slide_index");--> statement-breakpoint
CREATE UNIQUE INDEX "assets_path_unique" ON "assets" USING btree ("path");--> statement-breakpoint
CREATE UNIQUE INDEX "content_pillars_brand_key_unique" ON "content_pillars" USING btree ("brand_id","key");--> statement-breakpoint
CREATE UNIQUE INDEX "post_versions_post_number_unique" ON "post_versions" USING btree ("post_id","number");--> statement-breakpoint
CREATE UNIQUE INDEX "posts_public_code_unique" ON "posts" USING btree ("public_code");--> statement-breakpoint
CREATE UNIQUE INDEX "posts_brand_number_unique" ON "posts" USING btree ("brand_id","number");--> statement-breakpoint
CREATE INDEX "posts_brand_status_idx" ON "posts" USING btree ("brand_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "publications_post_network_unique" ON "publications" USING btree ("post_id","network");