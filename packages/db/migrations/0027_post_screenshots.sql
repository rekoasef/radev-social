CREATE TABLE "post_screenshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"post_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"path" text NOT NULL,
	"mime" text NOT NULL,
	"width" integer NOT NULL,
	"height" integer NOT NULL,
	"size_bytes" integer NOT NULL,
	"note" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "post_screenshots_position_valid" CHECK ("post_screenshots"."position" >= 0 and "post_screenshots"."position" < 4)
);
--> statement-breakpoint
ALTER TABLE "post_screenshots" ADD CONSTRAINT "post_screenshots_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "post_screenshots_post_position_unique" ON "post_screenshots" USING btree ("post_id","position");--> statement-breakpoint
CREATE UNIQUE INDEX "post_screenshots_path_unique" ON "post_screenshots" USING btree ("path");