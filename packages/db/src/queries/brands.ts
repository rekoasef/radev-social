import { asc } from "drizzle-orm";
import type { Database } from "../client";
import { type Brand, brands } from "../schema";

/** All brands, archived included, in creation order (name breaks ties). */
export function listBrands(db: Database): Promise<Brand[]> {
  return db.select().from(brands).orderBy(asc(brands.createdAt), asc(brands.name));
}
