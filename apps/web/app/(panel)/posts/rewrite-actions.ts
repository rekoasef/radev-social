"use server";

import { SLIDE_REWRITE_STATUSES } from "@radev/core";
import { createSlideRewrite, getBrandById, getPostByCode, getSlideRewrite } from "@radev/db";
import { carouselSchema, limits, type Slide, slideSchema } from "@radev/slides";
import { z } from "zod";
import { db } from "@/lib/db";
import { queueSlideRewrite } from "@/lib/jobs";
import { requireOperator } from "@/lib/session";

// "Rehacer con IA" in the editor: the web only files the request and queues it (rule 5); the
// worker writes the slide and the editor polls for it. Nothing here changes a post: the result is
// a proposal the operator takes into the editor and saves as usual.

const requestInput = z.object({
  brandId: z.uuid(),
  code: z.string().max(20).optional(),
  content: z.string().max(200_000),
  slideIndex: z.number().int().min(0).max(20),
  instruction: z.string().trim().max(limits.rewrite.instruction),
});

export type RewriteRequestResult = { ok: true; id: string } | { ok: false; message: string };

export async function requestSlideRewriteAction(
  input: z.input<typeof requestInput>,
): Promise<RewriteRequestResult> {
  await requireOperator();
  const parsed = requestInput.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Datos inválidos." };
  const { brandId, code, content, slideIndex, instruction } = parsed.data;

  const brand = await getBrandById(db, brandId);
  if (!brand || brand.archivedAt)
    return { ok: false, message: "Esa marca no existe o está archivada." };
  let json: unknown;
  try {
    json = JSON.parse(content);
  } catch {
    return { ok: false, message: "Datos inválidos." };
  }
  // The rest of the carousel has to be valid: the new slide is checked inside it.
  const carousel = carouselSchema.safeParse(json);
  if (!carousel.success) {
    return { ok: false, message: "Corregí los errores del carrusel antes de pedirle a la IA." };
  }
  if (!carousel.data.slides[slideIndex]) return { ok: false, message: "Esa slide no existe." };

  const post = code ? await getPostByCode(db, code) : undefined;
  if (code && (!post || post.brandId !== brand.id))
    return { ok: false, message: "Ese post ya no existe." };

  const request = await createSlideRewrite(db, {
    brandId: brand.id,
    postId: post?.id ?? null,
    carousel: carousel.data as unknown as Record<string, unknown>,
    slideIndex,
    instruction,
  });
  await queueSlideRewrite(request.id);
  return { ok: true, id: request.id };
}

export type RewriteState =
  | { status: "queued" | "running" }
  | { status: "done"; slide: Slide }
  | { status: "failed"; message: string };

/** How a request is going, for the editor's polling. */
export async function getSlideRewriteAction(id: string): Promise<RewriteState> {
  await requireOperator();
  const parsedId = z.uuid().safeParse(id);
  const request = parsedId.success ? await getSlideRewrite(db, parsedId.data) : undefined;
  if (!request) return { status: "failed", message: "No se encontró el pedido." };
  const status = SLIDE_REWRITE_STATUSES.includes(request.status) ? request.status : "failed";
  if (status === "done") {
    // Validated again: what goes into the editor is always a valid slide (rule 4).
    const slide = slideSchema.safeParse(request.result);
    return slide.success
      ? { status: "done", slide: slide.data }
      : { status: "failed", message: "La IA devolvió una slide inválida." };
  }
  if (status === "failed")
    return { status, message: request.error ?? "No se pudo rehacer la slide." };
  return { status };
}
