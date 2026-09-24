"use server";

import { getBrandById, listBrandAssets, updateBrandTheme } from "@radev/db";
import { type BrandTheme, checkTheme, type StylePreset } from "@radev/slides";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireOperator } from "@/lib/session";

export type IdentityState =
  | { status: "idle" }
  | {
      status: "ok";
      message: string;
      /** What was stored, so the editor treats it as the saved version. */
      saved: { preset: StylePreset; tokens: BrandTheme["tokens"] };
      savedAt: number;
    }
  | { status: "error"; message: string; fields?: Record<string, string> };

const input = z.object({
  id: z.uuid(),
  preset: z.string().min(1),
  tokens: z.string().max(100_000),
});

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

/** Validates the tokens with the preset's schema and stores them complete (defaults filled in). */
export async function saveIdentityAction(_: IdentityState, form: FormData): Promise<IdentityState> {
  await requireOperator();
  const parsed = input.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { status: "error", message: "Datos inválidos." };

  const brand = await getBrandById(db, parsed.data.id);
  if (!brand) return { status: "error", message: "Esa marca ya no existe." };

  const check = checkTheme(parsed.data.preset, parseJson(parsed.data.tokens));
  if (!check.ok) {
    return { status: "error", message: "Hay campos para corregir.", fields: check.fields };
  }

  // Asset tokens may only point to this brand's files.
  const own = new Set((await listBrandAssets(db, brand.id)).map((asset) => asset.id));
  const fields: Record<string, string> = {};
  for (const [key, value] of Object.entries(check.theme.tokens)) {
    if (key.endsWith("Asset") && typeof value === "string" && !own.has(value)) {
      fields[key] = "Ese archivo no es de esta marca o ya no existe.";
    }
  }
  if (Object.keys(fields).length > 0) {
    return { status: "error", message: "Hay campos para corregir.", fields };
  }

  await updateBrandTheme(db, brand.id, {
    stylePreset: check.theme.preset,
    themeTokens: check.theme.tokens as Record<string, unknown>,
  });
  revalidatePath("/", "layout");
  return {
    status: "ok",
    message: "Identidad guardada.",
    saved: { preset: check.theme.preset, tokens: check.theme.tokens },
    savedAt: Date.now(),
  };
}
