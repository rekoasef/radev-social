import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { BRAND_DOCUMENT_KINDS, isBrandDocumentKind } from "@radev/core";
import { eq } from "drizzle-orm";
import { createDb } from "../client";
import { loadRootEnv } from "../load-root-env";
import { createBrandAsset, listBrandAssets, setBrandAssetToken } from "../queries/brand-assets";
import { listCurrentBrandDocuments, saveBrandDocument } from "../queries/brand-documents";
import { addScheduleSlots } from "../queries/schedule";
import { aiRoutes, brands, contentPillars } from "../schema";
import { seedAiRoutes } from "./ai-routes";
import {
  pendingSeedAssets,
  pendingSeedDocuments,
  seedBrandAssets,
  seedBrands,
  seedPillars,
  seedSlots,
} from "./brands";

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

  // Slots: only for the brands created just now (see seedSlots).
  let slotsAdded = 0;
  for (const { slug } of inserted) {
    const [brand] = await db.select().from(brands).where(eq(brands.slug, slug));
    if (!brand) continue;
    for (const slots of seedSlots[slug] ?? []) {
      slotsAdded += await addScheduleSlots(db, { brandId: brand.id, ...slots });
    }
  }
  console.log(`Horarios creados: ${slotsAdded || "ninguno (solo en marcas nuevas)"}`);

  // Documents: version 1 of each kind with a file in seeds/brands/<slug>/, only when missing.
  const documentsAdded: string[] = [];
  for (const { slug } of seedBrands) {
    const [brand] = await db.select().from(brands).where(eq(brands.slug, slug));
    if (!brand) continue;
    const dir = fileURLToPath(new URL(`${slug}/`, seedsDir));
    const onDisk = (await readdir(dir))
      .filter((file) => file.endsWith(".md"))
      .map((file) => file.slice(0, -3))
      .filter(isBrandDocumentKind);
    const current = await listCurrentBrandDocuments(db, brand.id);
    const existing = BRAND_DOCUMENT_KINDS.filter((kind) => current[kind] !== undefined);
    for (const kind of pendingSeedDocuments(onDisk, existing)) {
      const content = await readFile(`${dir}${kind}.md`, "utf8");
      const saved = await saveBrandDocument(db, { brandId: brand.id, kind, content });
      if (!saved.ok) throw new Error(`${slug}/${kind}.md: ${saved.error}`);
      documentsAdded.push(`${slug}/${kind}`);
    }
  }
  console.log(`Documentos cargados: ${documentsAdded.join(", ") || "ninguno (ya estaban)"}`);

  // Global AI routes: only for tasks without one (a conflict on the task leaves it as it is).
  const routesAdded = await db
    .insert(aiRoutes)
    .values(
      seedAiRoutes.map(({ task, primary, fallback }) => ({
        task,
        provider: primary.provider,
        model: primary.model,
        fallbackProvider: fallback?.provider ?? null,
        fallbackModel: fallback?.model ?? null,
      })),
    )
    .onConflictDoNothing()
    .returning({ task: aiRoutes.task });
  console.log(
    `Rutas de IA creadas: ${routesAdded.map((r) => r.task).join(", ") || "ninguna (ya estaban)"}`,
  );
} finally {
  await pool.end();
}
