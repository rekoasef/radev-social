CREATE TABLE "ai_routes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task" text NOT NULL,
	"brand_id" uuid,
	"provider" text NOT NULL,
	"model" text NOT NULL,
	"fallback_provider" text,
	"fallback_model" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ai_routes_task_brand_unique" UNIQUE NULLS NOT DISTINCT("task","brand_id"),
	CONSTRAINT "ai_routes_task_valid" CHECK ("ai_routes"."task" in ('carousel.generate', 'ideas.generate', 'ideas.research', 'caption.variants', 'metrics.extract')),
	CONSTRAINT "ai_routes_provider_valid" CHECK ("ai_routes"."provider" in ('claude-code', 'openrouter')),
	CONSTRAINT "ai_routes_fallback_provider_valid" CHECK ("ai_routes"."fallback_provider" is null or "ai_routes"."fallback_provider" in ('claude-code', 'openrouter')),
	CONSTRAINT "ai_routes_fallback_complete" CHECK (("ai_routes"."fallback_provider" is null) = ("ai_routes"."fallback_model" is null))
);
--> statement-breakpoint
CREATE TABLE "generation_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"brand_id" uuid NOT NULL,
	"post_id" uuid,
	"task" text NOT NULL,
	"role" text NOT NULL,
	"provider" text NOT NULL,
	"model" text NOT NULL,
	"status" text NOT NULL,
	"error_kind" text,
	"error" text,
	"input_tokens" integer DEFAULT 0 NOT NULL,
	"output_tokens" integer DEFAULT 0 NOT NULL,
	"cost_usd" real,
	"duration_ms" integer,
	"num_turns" integer,
	"session_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "generation_runs_task_valid" CHECK ("generation_runs"."task" in ('carousel.generate', 'ideas.generate', 'ideas.research', 'caption.variants', 'metrics.extract')),
	CONSTRAINT "generation_runs_role_valid" CHECK ("generation_runs"."role" in ('primary', 'fallback')),
	CONSTRAINT "generation_runs_provider_valid" CHECK ("generation_runs"."provider" in ('claude-code', 'openrouter')),
	CONSTRAINT "generation_runs_status_valid" CHECK ("generation_runs"."status" in ('succeeded', 'failed'))
);
--> statement-breakpoint
ALTER TABLE "ai_routes" ADD CONSTRAINT "ai_routes_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generation_runs" ADD CONSTRAINT "generation_runs_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generation_runs" ADD CONSTRAINT "generation_runs_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "generation_runs_brand_created_idx" ON "generation_runs" USING btree ("brand_id","created_at");