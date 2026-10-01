ALTER TABLE "content_series" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "content_series" CASCADE;--> statement-breakpoint
ALTER TABLE "ideas" DROP CONSTRAINT "ideas_source_valid";--> statement-breakpoint
ALTER TABLE "ideas" DROP COLUMN "series_key";--> statement-breakpoint
-- Ideas that came from a series keep living as AI ideas (ADR 0020).
UPDATE "ideas" SET "source" = 'ai' WHERE "source" = 'series';--> statement-breakpoint
ALTER TABLE "ideas" ADD CONSTRAINT "ideas_source_valid" CHECK ("ideas"."source" in ('manual', 'ai', 'research', 'recycled'));