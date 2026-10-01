CREATE TABLE "brand_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"brand_id" uuid NOT NULL,
	"title" text NOT NULL,
	"url" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"primary" boolean DEFAULT false NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "leads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"brand_id" uuid NOT NULL,
	"name" text DEFAULT '' NOT NULL,
	"contact" text DEFAULT '' NOT NULL,
	"channel" text DEFAULT 'whatsapp' NOT NULL,
	"post_ref" text,
	"network_post_id" uuid,
	"status" text DEFAULT 'new' NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "leads_channel_valid" CHECK ("leads"."channel" in ('whatsapp', 'tiktok', 'instagram', 'other')),
	CONSTRAINT "leads_status_valid" CHECK ("leads"."status" in ('new', 'talking', 'client', 'lost'))
);
--> statement-breakpoint
CREATE TABLE "link_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"brand_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"network_post_id" uuid,
	"link_id" uuid,
	"referrer" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "link_events_kind_valid" CHECK ("link_events"."kind" in ('view', 'whatsapp', 'link'))
);
--> statement-breakpoint
ALTER TABLE "brand_links" ADD CONSTRAINT "brand_links_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_network_post_id_network_posts_id_fk" FOREIGN KEY ("network_post_id") REFERENCES "public"."network_posts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "link_events" ADD CONSTRAINT "link_events_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "link_events" ADD CONSTRAINT "link_events_network_post_id_network_posts_id_fk" FOREIGN KEY ("network_post_id") REFERENCES "public"."network_posts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "link_events" ADD CONSTRAINT "link_events_link_id_brand_links_id_fk" FOREIGN KEY ("link_id") REFERENCES "public"."brand_links"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "brand_links_brand_position_idx" ON "brand_links" USING btree ("brand_id","position");--> statement-breakpoint
CREATE UNIQUE INDEX "brand_links_brand_primary_unique" ON "brand_links" USING btree ("brand_id") WHERE "brand_links"."primary";--> statement-breakpoint
CREATE INDEX "leads_brand_created_idx" ON "leads" USING btree ("brand_id","created_at");--> statement-breakpoint
CREATE INDEX "leads_network_post_idx" ON "leads" USING btree ("network_post_id");--> statement-breakpoint
CREATE INDEX "link_events_brand_created_idx" ON "link_events" USING btree ("brand_id","created_at");--> statement-breakpoint
CREATE INDEX "link_events_network_post_idx" ON "link_events" USING btree ("network_post_id");