CREATE TABLE "social_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"brand_id" uuid NOT NULL,
	"network" text NOT NULL,
	"external_id" text NOT NULL,
	"handle" text,
	"display_name" text,
	"scopes" text[] DEFAULT '{}'::text[] NOT NULL,
	"access_token_enc" text NOT NULL,
	"access_expires_at" timestamp with time zone NOT NULL,
	"refresh_token_enc" text,
	"refresh_expires_at" timestamp with time zone,
	"status" text DEFAULT 'active' NOT NULL,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "social_accounts_network_valid" CHECK ("social_accounts"."network" in ('tiktok')),
	CONSTRAINT "social_accounts_status_valid" CHECK ("social_accounts"."status" in ('active', 'reauth_required'))
);
--> statement-breakpoint
ALTER TABLE "social_accounts" ADD CONSTRAINT "social_accounts_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "social_accounts_brand_network_unique" ON "social_accounts" USING btree ("brand_id","network");--> statement-breakpoint
CREATE UNIQUE INDEX "social_accounts_network_external_unique" ON "social_accounts" USING btree ("network","external_id");