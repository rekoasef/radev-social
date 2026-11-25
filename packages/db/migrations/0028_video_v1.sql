CREATE TABLE "usage_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"video_id" uuid NOT NULL,
	"office" text,
	"kind" text NOT NULL,
	"quantity" real NOT NULL,
	"unit" text NOT NULL,
	"duration_ms" integer,
	"data" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "usage_events_kind_valid" CHECK ("usage_events"."kind" in ('tts', 'render', 'download')),
	CONSTRAINT "usage_events_office_valid" CHECK ("usage_events"."office" in ('researching', 'checking_sources', 'finding_images', 'scripting', 'checking_facts', 'voicing', 'rendering', 'packaging'))
);
--> statement-breakpoint
CREATE TABLE "video_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"video_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"version" integer NOT NULL,
	"data" jsonb NOT NULL,
	"schema_version" integer DEFAULT 1 NOT NULL,
	"origin" text NOT NULL,
	"generation_run_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "video_documents_kind_valid" CHECK ("video_documents"."kind" in ('dossier', 'sources', 'images', 'script', 'review', 'voice', 'render', 'package')),
	CONSTRAINT "video_documents_origin_valid" CHECK ("video_documents"."origin" in ('office', 'operator')),
	CONSTRAINT "video_documents_version_valid" CHECK ("video_documents"."version" >= 1)
);
--> statement-breakpoint
CREATE TABLE "videos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"brand_id" uuid,
	"topic" text NOT NULL,
	"title" text,
	"language" text DEFAULT 'es' NOT NULL,
	"voice_id" uuid,
	"stage" text NOT NULL,
	"paused_at" timestamp with time zone,
	"pause_reason" text,
	"resume_at" timestamp with time zone,
	"failure" jsonb,
	"rejection_note" text,
	"approved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "videos_stage_valid" CHECK ("videos"."stage" in ('researching', 'checking_sources', 'finding_images', 'scripting', 'checking_facts', 'script_review', 'voicing', 'rendering', 'packaging', 'in_review', 'approved', 'archived')),
	CONSTRAINT "videos_pause_reason_valid" CHECK ("videos"."pause_reason" in ('operator', 'provider_limit', 'budget', 'window')),
	CONSTRAINT "videos_pause_consistent" CHECK (("videos"."paused_at" is null) = ("videos"."pause_reason" is null))
);
--> statement-breakpoint
CREATE TABLE "voices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" text NOT NULL,
	"external_id" text NOT NULL,
	"name" text NOT NULL,
	"use" text NOT NULL,
	"language" text DEFAULT 'es' NOT NULL,
	"speed" real,
	"is_default" boolean DEFAULT false NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "voices_provider_external_unique" UNIQUE("provider","external_id"),
	CONSTRAINT "voices_provider_valid" CHECK ("voices"."provider" in ('elevenlabs', 'kokoro')),
	CONSTRAINT "voices_use_valid" CHECK ("voices"."use" in ('narrative', 'commercial'))
);
--> statement-breakpoint
ALTER TABLE "ai_routes" DROP CONSTRAINT "ai_routes_task_valid";--> statement-breakpoint
ALTER TABLE "generation_runs" DROP CONSTRAINT "generation_runs_task_valid";--> statement-breakpoint
ALTER TABLE "generation_runs" ALTER COLUMN "brand_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "generation_runs" ADD COLUMN "video_id" uuid;--> statement-breakpoint
ALTER TABLE "usage_events" ADD CONSTRAINT "usage_events_video_id_videos_id_fk" FOREIGN KEY ("video_id") REFERENCES "public"."videos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_documents" ADD CONSTRAINT "video_documents_video_id_videos_id_fk" FOREIGN KEY ("video_id") REFERENCES "public"."videos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_documents" ADD CONSTRAINT "video_documents_generation_run_id_generation_runs_id_fk" FOREIGN KEY ("generation_run_id") REFERENCES "public"."generation_runs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "videos" ADD CONSTRAINT "videos_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "videos" ADD CONSTRAINT "videos_voice_id_voices_id_fk" FOREIGN KEY ("voice_id") REFERENCES "public"."voices"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "usage_events_video_idx" ON "usage_events" USING btree ("video_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "video_documents_video_kind_version_unique" ON "video_documents" USING btree ("video_id","kind","version");--> statement-breakpoint
CREATE INDEX "videos_stage_idx" ON "videos" USING btree ("stage");--> statement-breakpoint
CREATE INDEX "videos_brand_idx" ON "videos" USING btree ("brand_id");--> statement-breakpoint
CREATE UNIQUE INDEX "voices_default_unique" ON "voices" USING btree ("use","language") WHERE "voices"."is_default";--> statement-breakpoint
ALTER TABLE "generation_runs" ADD CONSTRAINT "generation_runs_video_id_videos_id_fk" FOREIGN KEY ("video_id") REFERENCES "public"."videos"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "generation_runs_video_idx" ON "generation_runs" USING btree ("video_id");--> statement-breakpoint
ALTER TABLE "ai_routes" ADD CONSTRAINT "ai_routes_task_valid" CHECK ("ai_routes"."task" in ('carousel.generate', 'slide.rewrite', 'ideas.generate', 'ideas.research', 'caption.variants', 'metrics.extract', 'video.research', 'video.images', 'video.script', 'video.review', 'video.package'));--> statement-breakpoint
ALTER TABLE "generation_runs" ADD CONSTRAINT "generation_runs_owner" CHECK ("generation_runs"."brand_id" is not null or "generation_runs"."video_id" is not null);--> statement-breakpoint
ALTER TABLE "generation_runs" ADD CONSTRAINT "generation_runs_task_valid" CHECK ("generation_runs"."task" in ('carousel.generate', 'slide.rewrite', 'ideas.generate', 'ideas.research', 'caption.variants', 'metrics.extract', 'video.research', 'video.images', 'video.script', 'video.review', 'video.package'));