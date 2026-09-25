ALTER TABLE "post_versions" ADD COLUMN "generation_run_id" uuid;--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "generation_request" jsonb;--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "generation_retry_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "post_versions" ADD CONSTRAINT "post_versions_generation_run_id_generation_runs_id_fk" FOREIGN KEY ("generation_run_id") REFERENCES "public"."generation_runs"("id") ON DELETE set null ON UPDATE no action;