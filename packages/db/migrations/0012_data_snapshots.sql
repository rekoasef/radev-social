CREATE TABLE "data_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source" text NOT NULL,
	"as_of" date NOT NULL,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL,
	"payload" jsonb NOT NULL,
	CONSTRAINT "data_snapshots_source_valid" CHECK ("data_snapshots"."source" in ('bluelytics'))
);
--> statement-breakpoint
ALTER TABLE "brands" ADD COLUMN "data_sources" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "post_versions" ADD COLUMN "datasets" jsonb;--> statement-breakpoint
CREATE UNIQUE INDEX "data_snapshots_source_as_of_unique" ON "data_snapshots" USING btree ("source","as_of");