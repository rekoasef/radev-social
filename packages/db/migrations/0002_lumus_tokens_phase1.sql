-- Phase 1 (T2): brand tokens stored before the preset schemas existed, rewritten to their shape.
-- Idempotent: each statement only matches rows that still have the old shape.

-- soft: wordmark tracking "0.18em" (text) -> 0.18 (number, in em).
UPDATE "brands"
SET "theme_tokens" = jsonb_set(
  "theme_tokens",
  '{wordmark,tracking}',
  to_jsonb(left("theme_tokens" #>> '{wordmark,tracking}', -2)::numeric)
)
WHERE "style_preset" = 'soft'
  AND "theme_tokens" #>> '{wordmark,tracking}' ~ '^[0-9]*\.?[0-9]+em$';
--> statement-breakpoint

-- Asset tokens now hold brand_assets ids. File names from the first seed are cleared; the seed
-- links the files again once brand_assets exists (T7).
UPDATE "brands"
SET "theme_tokens" = jsonb_set("theme_tokens", '{heroAsset}', 'null')
WHERE jsonb_typeof("theme_tokens" -> 'heroAsset') = 'string'
  AND "theme_tokens" ->> 'heroAsset' !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
--> statement-breakpoint

UPDATE "brands"
SET "theme_tokens" = jsonb_set("theme_tokens", '{logoAsset}', 'null')
WHERE jsonb_typeof("theme_tokens" -> 'logoAsset') = 'string'
  AND "theme_tokens" ->> 'logoAsset' !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
