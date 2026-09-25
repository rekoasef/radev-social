CREATE TABLE "ideas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"brand_id" uuid NOT NULL,
	"pillar_id" uuid,
	"title" text NOT NULL,
	"angle" text DEFAULT '' NOT NULL,
	"source" text NOT NULL,
	"series_key" text,
	"status" text DEFAULT 'new' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ideas_source_valid" CHECK ("ideas"."source" in ('manual', 'ai', 'research', 'recycled', 'series')),
	CONSTRAINT "ideas_status_valid" CHECK ("ideas"."status" in ('new', 'used', 'discarded'))
);
--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "idea_id" uuid;--> statement-breakpoint
ALTER TABLE "ideas" ADD CONSTRAINT "ideas_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ideas" ADD CONSTRAINT "ideas_pillar_id_content_pillars_id_fk" FOREIGN KEY ("pillar_id") REFERENCES "public"."content_pillars"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ideas_brand_status_created_idx" ON "ideas" USING btree ("brand_id","status","created_at");--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_idea_id_ideas_id_fk" FOREIGN KEY ("idea_id") REFERENCES "public"."ideas"("id") ON DELETE set null ON UPDATE no action;