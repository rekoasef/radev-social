CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"kind" text NOT NULL,
	"text" text NOT NULL,
	"silent" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sent_at" timestamp with time zone,
	"error" text,
	CONSTRAINT "notifications_kind_valid" CHECK ("notifications"."kind" in ('review', 'publish', 'failure', 'limit', 'cap', 'test'))
);
--> statement-breakpoint
ALTER TABLE "post_versions" ADD COLUMN "review_notified_at" timestamp with time zone;--> statement-breakpoint
CREATE UNIQUE INDEX "notifications_key_unique" ON "notifications" USING btree ("key");