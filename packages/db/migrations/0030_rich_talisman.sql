ALTER TABLE "usage_events" DROP CONSTRAINT "usage_events_kind_valid";--> statement-breakpoint
ALTER TABLE "generation_runs" ADD COLUMN "check_problems" jsonb;--> statement-breakpoint
ALTER TABLE "videos" ADD COLUMN "progress" jsonb;--> statement-breakpoint
ALTER TABLE "voices" ADD COLUMN "preview_url" text;--> statement-breakpoint
ALTER TABLE "usage_events" ADD CONSTRAINT "usage_events_kind_valid" CHECK ("usage_events"."kind" in ('tts', 'render', 'download', 'office'));