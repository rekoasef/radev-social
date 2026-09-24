"use server";

import { listBrands } from "@radev/db";
import { z } from "zod";
import { rememberActiveBrand } from "@/lib/active-brand";
import { db } from "@/lib/db";
import { requireOperator } from "@/lib/session";

const input = z.object({ slug: z.string().trim().min(1).max(64) });

/** Remembers the brand the operator works on. Setting the cookie re-renders the panel. */
export async function setActiveBrand(raw: { slug: string }): Promise<void> {
  await requireOperator();
  const { slug } = input.parse(raw);

  const brands = await listBrands(db);
  if (!brands.some((brand) => brand.slug === slug && brand.archivedAt === null)) {
    throw new Error("Esa marca no existe o está archivada.");
  }

  await rememberActiveBrand(slug);
}
