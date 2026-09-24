CREATE TABLE "brand_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"brand_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"content" text NOT NULL,
	"version" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "brand_documents_kind_valid" CHECK ("brand_documents"."kind" in ('voice', 'pricing', 'cases', 'rules')),
	CONSTRAINT "brand_documents_version_positive" CHECK ("brand_documents"."version" >= 1)
);
--> statement-breakpoint
ALTER TABLE "brand_documents" ADD CONSTRAINT "brand_documents_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "brand_documents_brand_kind_version_unique" ON "brand_documents" USING btree ("brand_id","kind","version");