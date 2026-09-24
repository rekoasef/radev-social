import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { eq } from "drizzle-orm";
import { createDb } from "../client";
import { loadRootEnv } from "../load-root-env";
import { createBrandAsset, listBrandAssets, setBrandAssetToken } from "../queries/brand-assets";
import { brands, contentPillars } from "../schema";
import { pendingSeedAssets, seedBrandAssets, seedBrands, seedPillars } from "./brands";

loadRootEnv();

const seedsDir = new URL("../../../../seeds/brands/", import.meta.url);
const { db, pool } = createDb();

try {
  // Only inserts missing brands: never overwrites what was edited from the panel.
  const inserted = await db
    .insert(brands)
    .values(seedBrands)
    .onConflictDoNothing({ target: brands.slug })
    .returning({ slug: brands.slug });

  const skipped = seedBrands.length - inserted.length;
  console.log(
    `Marcas creadas: ${inserted.map((b) => b.slug).join(", ") || "ninguna"}` +
      (skipped > 0 ? ` · ya existían: ${skipped}` : ""),
  );

  const linked: string[] = [];
  for (const [slug, planned] of Object.entries(seedBrandAssets)) {
    await db.transaction(async (tx) => {
      // Locked so two seeds running at once cannot both link the same file.
      const [brand] = await tx.select().from(brands).where(eq(brands.slug, slug)).for("update");
      if (!brand) return;
      const existing = await listBrandAssets(tx, brand.id);
      const pending = pendingSeedAssets(
        planned,
        brand.themeTokens,
        existing.map((asset) => asset.role),
      );

      let tokens = brand.themeTokens;
      for (const asset of pending) {
        const bytes = await readFile(
          fileURLToPath(new URL(`${slug}/assets/${asset.file}`, seedsDir)),
        );
        const created = await createBrandAsset(tx, { brand, role: asset.role, bytes });
        if (!created.ok) throw new Error(`${slug}/${asset.file}: ${created.error}`);
        await setBrandAssetToken(
          tx,
          { id: brand.id, themeTokens: tokens },
          asset.token,
          created.value.id,
        );
        tokens = { ...tokens, [asset.token]: created.value.id };
        linked.push(`${slug}/${asset.file}`);
      }
    });
  }
  console.log(`Assets enlazados: ${linked.join(", ") || "ninguno (ya estaban)"}`);

  // Pillars: only the missing keys; never overwrites what was edited from the panel.
  let pillarsAdded = 0;
  for (const [slug, pillars] of Object.entries(seedPillars)) {
    const [brand] = await db.select().from(brands).where(eq(brands.slug, slug));
    if (!brand) continue;
    const added = await db
      .insert(contentPillars)
      .values(pillars.map((pillar) => ({ ...pillar, brandId: brand.id })))
      .onConflictDoNothing({ target: [contentPillars.brandId, contentPillars.key] })
      .returning({ key: contentPillars.key });
    pillarsAdded += added.length;
  }
  console.log(`Pilares creados: ${pillarsAdded || "ninguno (ya estaban)"}`);
} finally {
  await pool.end();
}
