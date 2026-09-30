CREATE TABLE "audience_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"brand_id" uuid NOT NULL,
	"network" text NOT NULL,
	"captured_on" date NOT NULL,
	"captured_at" timestamp with time zone DEFAULT now() NOT NULL,
	"data" jsonb NOT NULL,
	"source" text NOT NULL,
	CONSTRAINT "audience_snapshots_network_valid" CHECK ("audience_snapshots"."network" in ('tiktok')),
	CONSTRAINT "audience_snapshots_source_valid" CHECK ("audience_snapshots"."source" in ('api', 'screenshot', 'manual'))
);
--> statement-breakpoint
CREATE TABLE "network_posts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"brand_id" uuid NOT NULL,
	"network" text NOT NULL,
	"external_id" text NOT NULL,
	"post_id" uuid,
	"caption" text DEFAULT '' NOT NULL,
	"url" text,
	"kind" text DEFAULT 'photo' NOT NULL,
	"cover_path" text,
	"published_at" timestamp with time zone NOT NULL,
	"views" integer DEFAULT 0 NOT NULL,
	"likes" integer DEFAULT 0 NOT NULL,
	"comments" integer DEFAULT 0 NOT NULL,
	"shares" integer DEFAULT 0 NOT NULL,
	"metrics_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "network_posts_network_valid" CHECK ("network_posts"."network" in ('tiktok')),
	CONSTRAINT "network_posts_kind_valid" CHECK ("network_posts"."kind" in ('photo', 'video'))
);
--> statement-breakpoint
CREATE TABLE "post_metrics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"network_post_id" uuid NOT NULL,
	"captured_on" date NOT NULL,
	"captured_at" timestamp with time zone DEFAULT now() NOT NULL,
	"views" integer NOT NULL,
	"likes" integer NOT NULL,
	"comments" integer NOT NULL,
	"shares" integer NOT NULL,
	"saves" integer,
	"source" text NOT NULL,
	CONSTRAINT "post_metrics_source_valid" CHECK ("post_metrics"."source" in ('api', 'screenshot', 'manual'))
);
--> statement-breakpoint
ALTER TABLE "audience_snapshots" ADD CONSTRAINT "audience_snapshots_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "network_posts" ADD CONSTRAINT "network_posts_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "network_posts" ADD CONSTRAINT "network_posts_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_metrics" ADD CONSTRAINT "post_metrics_network_post_id_network_posts_id_fk" FOREIGN KEY ("network_post_id") REFERENCES "public"."network_posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "audience_snapshots_brand_network_source_day_unique" ON "audience_snapshots" USING btree ("brand_id","network","source","captured_on");--> statement-breakpoint
CREATE UNIQUE INDEX "network_posts_network_external_unique" ON "network_posts" USING btree ("network","external_id");--> statement-breakpoint
CREATE UNIQUE INDEX "network_posts_post_network_unique" ON "network_posts" USING btree ("post_id","network") WHERE "network_posts"."post_id" is not null;--> statement-breakpoint
CREATE INDEX "network_posts_brand_published_idx" ON "network_posts" USING btree ("brand_id","published_at");--> statement-breakpoint
CREATE UNIQUE INDEX "post_metrics_post_source_day_unique" ON "post_metrics" USING btree ("network_post_id","source","captured_on");