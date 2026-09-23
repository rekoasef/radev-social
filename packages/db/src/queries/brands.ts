import { asc, eq } from "drizzle-orm";
import type { Database } from "../client";
import { type Brand, brands } from "../schema";

/** All brands, archived included, in creation order (name breaks ties). */
export function listBrands(db: Database): Promise<Brand[]> {
  return db.select().from(brands).orderBy(asc(brands.createdAt), asc(brands.name));
}

export async function getBrandBySlug(db: Database, slug: string): Promise<Brand | undefined> {
  const [brand] = await db.select().from(brands).where(eq(brands.slug, slug)).limit(1);
  return brand;
}
