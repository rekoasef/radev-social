CREATE TABLE "video_idea_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"brand_id" uuid,
	"mode" text NOT NULL,
	"focus" text,
	"status" text DEFAULT 'queued' NOT NULL,
	"error" text,
	"ideas" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"model" text,
	"input_tokens" integer DEFAULT 0 NOT NULL,
	"output_tokens" integer DEFAULT 0 NOT NULL,
	"duration_ms" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	CONSTRAINT "video_idea_requests_mode_valid" CHECK ("video_idea_requests"."mode" in ('generate', 'research')),
	CONSTRAINT "video_idea_requests_status_valid" CHECK ("video_idea_requests"."status" in ('queued', 'running', 'succeeded', 'failed'))
);
--> statement-breakpoint
ALTER TABLE "ai_routes" DROP CONSTRAINT "ai_routes_task_valid";--> statement-breakpoint
ALTER TABLE "generation_runs" DROP CONSTRAINT "generation_runs_task_valid";--> statement-breakpoint
ALTER TABLE "video_idea_requests" ADD CONSTRAINT "video_idea_requests_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "video_idea_requests_created_idx" ON "video_idea_requests" USING btree ("created_at");--> statement-breakpoint
ALTER TABLE "ai_routes" ADD CONSTRAINT "ai_routes_task_valid" CHECK ("ai_routes"."task" in ('carousel.generate', 'slide.rewrite', 'ideas.generate', 'ideas.research', 'caption.variants', 'metrics.extract', 'video.research', 'video.images', 'video.script', 'video.review', 'video.package', 'video.ideas', 'video.ideas.research'));--> statement-breakpoint
ALTER TABLE "generation_runs" ADD CONSTRAINT "generation_runs_task_valid" CHECK ("generation_runs"."task" in ('carousel.generate', 'slide.rewrite', 'ideas.generate', 'ideas.research', 'caption.variants', 'metrics.extract', 'video.research', 'video.images', 'video.script', 'video.review', 'video.package', 'video.ideas', 'video.ideas.research'));