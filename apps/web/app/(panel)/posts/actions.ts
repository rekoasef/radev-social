"use server";

import { addPostVersion, createPost, getBrandById, getPostByCode, listPillars } from "@radev/db";
import { carouselSchema } from "@radev/slides";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireOperator } from "@/lib/session";

export type SaveCarouselState =
  | { status: "idle" }
  | { status: "error"; message: string; fields?: Record<string, string> };

const input = z.object({
  brandId: z.uuid(),
  /** Public code of the post being edited; empty for a new post. */
  code: z.string().max(20).optional(),
  content: z.string().max(200_000),
});

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

/**
 * Saves a carousel from the editor: a new post (version 1) or a new version of an existing one.
 * The content is validated with the carousel schema like any AI output (CLAUDE.md, rule 4).
 */
export async function saveCarouselAction(
  _: SaveCarouselState,
  form: FormData,
): Promise<SaveCarouselState> {
  await requireOperator();
  const parsed = input.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { status: "error", message: "Datos inválidos." };
  const { brandId, code, content } = parsed.data;

  const brand = await getBrandById(db, brandId);
  if (!brand || brand.archivedAt)
    return { status: "error", message: "Esa marca no existe o está archivada." };

  const carousel = carouselSchema.safeParse(parseJson(content));
  if (!carousel.success) {
    const fields: Record<string, string> = {};
    for (const issue of carousel.error.issues)
      fields[issue.path.map(String).join(".")] ??= issue.message;
    return { status: "error", message: "Hay campos para corregir.", fields };
  }

  const pillars = await listPillars(db, brand.id);
  if (!pillars.some((p) => p.key === carousel.data.pillarKey)) {
    return {
      status: "error",
      message: "Elegí un pilar de la marca.",
      fields: { pillarKey: "Elegí un pilar." },
    };
  }

  let publicCode: string;
  if (code) {
    const post = await getPostByCode(db, code);
    if (!post || post.brandId !== brand.id)
      return { status: "error", message: "Ese post ya no existe." };
    const result = await addPostVersion(db, {
      postId: post.id,
      content: carousel.data,
      origin: "manual",
    });
    if (!result.ok) return { status: "error", message: result.reason };
    publicCode = post.publicCode;
  } else {
    const { post } = await createPost(db, {
      brandId: brand.id,
      content: carousel.data,
      origin: "manual",
    });
    publicCode = post.publicCode;
  }
  // Rendering is queued from here once the worker job exists (phase 2, T6).

  revalidatePath("/posts");
  redirect(`/posts/${publicCode}`);
}
