"use server";

import { listBrands } from "@radev/db";
import { cookies } from "next/headers";
import { z } from "zod";
import { ACTIVE_BRAND_COOKIE } from "@/lib/active-brand";
import { db } from "@/lib/db";
import { requireOperator } from "@/lib/session";

const ONE_YEAR = 60 * 60 * 24 * 365;

const input = z.object({ slug: z.string().trim().min(1).max(64) });

/** Remembers the brand the operator works on. Setting the cookie re-renders the panel. */
export async function setActiveBrand(raw: { slug: string }): Promise<void> {
  await requireOperator();
  const { slug } = input.parse(raw);

  const brands = await listBrands(db);
  if (!brands.some((brand) => brand.slug === slug && brand.archivedAt === null)) {
    throw new Error("Esa marca no existe o está archivada.");
  }

  (await cookies()).set(ACTIVE_BRAND_COOKIE, slug, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: ONE_YEAR,
    path: "/",
  });
}
