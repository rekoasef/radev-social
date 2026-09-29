CREATE TABLE "slide_rewrites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"brand_id" uuid NOT NULL,
	"post_id" uuid,
	"carousel" jsonb NOT NULL,
	"slide_index" integer NOT NULL,
	"instruction" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"result" jsonb,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	CONSTRAINT "slide_rewrites_status_valid" CHECK ("slide_rewrites"."status" in ('queued', 'running', 'done', 'failed'))
);
--> statement-breakpoint
ALTER TABLE "ai_routes" DROP CONSTRAINT "ai_routes_task_valid";--> statement-breakpoint
ALTER TABLE "generation_runs" DROP CONSTRAINT "generation_runs_task_valid";--> statement-breakpoint
ALTER TABLE "slide_rewrites" ADD CONSTRAINT "slide_rewrites_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "slide_rewrites" ADD CONSTRAINT "slide_rewrites_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "slide_rewrites_brand_created_idx" ON "slide_rewrites" USING btree ("brand_id","created_at");--> statement-breakpoint
ALTER TABLE "ai_routes" ADD CONSTRAINT "ai_routes_task_valid" CHECK ("ai_routes"."task" in ('carousel.generate', 'slide.rewrite', 'ideas.generate', 'ideas.research', 'caption.variants', 'metrics.extract'));--> statement-breakpoint
ALTER TABLE "generation_runs" ADD CONSTRAINT "generation_runs_task_valid" CHECK ("generation_runs"."task" in ('carousel.generate', 'slide.rewrite', 'ideas.generate', 'ideas.research', 'caption.variants', 'metrics.extract'));