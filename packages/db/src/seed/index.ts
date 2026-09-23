import { createDb } from "../client";
import { loadRootEnv } from "../load-root-env";
import { brands } from "../schema";
import { seedBrands } from "./brands";

loadRootEnv();

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
} finally {
  await pool.end();
}
