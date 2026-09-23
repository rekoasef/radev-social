import "server-only";
import { pickActiveBrand } from "@radev/core";
import { type Brand, listBrands } from "@radev/db";
import { cookies } from "next/headers";
import { cache } from "react";
import { db } from "./db";

export const ACTIVE_BRAND_COOKIE = "active-brand";

/**
 * Brands plus the one the panel is working on, read once per request so the layout and the
 * page share the same answer.
 */
export const getBrandContext = cache(
  async (): Promise<{ brands: Brand[]; activeBrand: Brand | undefined }> => {
    const [brands, cookieStore] = await Promise.all([listBrands(db), cookies()]);
    const activeBrand = pickActiveBrand(brands, cookieStore.get(ACTIVE_BRAND_COOKIE)?.value);
    return { brands, activeBrand };
  },
);
