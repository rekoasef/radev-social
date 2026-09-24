import "server-only";
import { pickActiveBrand } from "@radev/core";
import { type Brand, listBrands } from "@radev/db";
import { cookies } from "next/headers";
import { cache } from "react";
import { db } from "./db";

export const ACTIVE_BRAND_COOKIE = "active-brand";

const ONE_YEAR = 60 * 60 * 24 * 365;

/** Remembers the brand the operator works on. Only from Server Actions (it sets a cookie). */
export async function rememberActiveBrand(slug: string): Promise<void> {
  (await cookies()).set(ACTIVE_BRAND_COOKIE, slug, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: ONE_YEAR,
    path: "/",
  });
}

/** The slug the operator picked, if any (it may point to a deleted or archived brand). */
export async function preferredBrandSlug(): Promise<string | undefined> {
  return (await cookies()).get(ACTIVE_BRAND_COOKIE)?.value;
}

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
