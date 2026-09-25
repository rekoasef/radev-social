CREATE TABLE "content_series" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"brand_id" uuid NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"pillar_id" uuid,
	"hook_type" text,
	"brief" text NOT NULL,
	"required_slides" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "content_series_key_format" CHECK ("content_series"."key" ~ '^[a-z0-9]+(-[a-z0-9]+)*$')
);
--> statement-breakpoint
CREATE TABLE "idea_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"brand_id" uuid NOT NULL,
	"task" text NOT NULL,
	"params" jsonb NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"error" text,
	"idea_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	CONSTRAINT "idea_requests_task_valid" CHECK ("idea_requests"."task" in ('ideas.generate', 'ideas.research')),
	CONSTRAINT "idea_requests_status_valid" CHECK ("idea_requests"."status" in ('queued', 'running', 'succeeded', 'failed'))
);
--> statement-breakpoint
ALTER TABLE "ideas" ADD COLUMN "sources" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "ideas" ADD COLUMN "request_id" uuid;--> statement-breakpoint
ALTER TABLE "content_series" ADD CONSTRAINT "content_series_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_series" ADD CONSTRAINT "content_series_pillar_id_content_pillars_id_fk" FOREIGN KEY ("pillar_id") REFERENCES "public"."content_pillars"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "idea_requests" ADD CONSTRAINT "idea_requests_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "content_series_brand_key_unique" ON "content_series" USING btree ("brand_id","key");--> statement-breakpoint
CREATE INDEX "idea_requests_brand_created_idx" ON "idea_requests" USING btree ("brand_id","created_at");--> statement-breakpoint
ALTER TABLE "ideas" ADD CONSTRAINT "ideas_request_id_idea_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."idea_requests"("id") ON DELETE set null ON UPDATE no action;