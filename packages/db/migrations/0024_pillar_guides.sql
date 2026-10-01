ALTER TABLE "content_pillars" ADD COLUMN "goal" text;--> statement-breakpoint
ALTER TABLE "content_pillars" ADD COLUMN "hook_types" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "content_pillars" ADD COLUMN "guide" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "content_pillars" ADD COLUMN "closing" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "content_pillars" ADD COLUMN "avoid" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "content_pillars" ADD CONSTRAINT "content_pillars_goal_valid" CHECK ("content_pillars"."goal" in ('reach', 'trust', 'sales'));