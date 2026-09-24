"use server";

import {
  addPostVersion,
  approvePost,
  createPost,
  getBrandById,
  getPostByCode,
  getPostVersion,
  listPillars,
  markPublishedManually,
  transitionPost,
} from "@radev/db";
import { confirmManualPublication } from "@radev/publishers";
import { carouselSchema } from "@radev/slides";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { queueRender } from "@/lib/jobs";
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
    await queueRender(result.version.id);
    publicCode = post.publicCode;
  } else {
    const { post, version } = await createPost(db, {
      brandId: brand.id,
      content: carousel.data,
      origin: "manual",
    });
    await queueRender(version.id);
    publicCode = post.publicCode;
  }

  revalidatePath("/posts");
  redirect(`/posts/${publicCode}`);
}

const restoreInput = z.object({ code: z.string().min(1).max(20), versionId: z.uuid() });

/**
 * Brings back an old version: a new version with its content (history is never rewritten), so
 * the post goes back to render and review like any edit.
 */
export async function restoreVersionAction(form: FormData): Promise<void> {
  await requireOperator();
  const { code, versionId } = restoreInput.parse(Object.fromEntries(form));
  const post = await getPostByCode(db, code);
  if (!post) throw new Error("Ese post ya no existe.");
  const version = await getPostVersion(db, versionId);
  if (!version || version.postId !== post.id) throw new Error("Esa versión no es de este post.");

  // Validated again: an old version may predate a schema change (CLAUDE.md, rule 4).
  const content = carouselSchema.safeParse(version.content);
  if (!content.success)
    throw new Error("Esa versión ya no cumple el formato actual: abrila en el editor.");

  const result = await addPostVersion(db, {
    postId: post.id,
    content: content.data,
    origin: "manual",
  });
  if (!result.ok) throw new Error(result.reason);
  await queueRender(result.version.id);
  revalidatePath("/posts");
  redirect(`/posts/${post.publicCode}`);
}

const retryInput = z.object({ code: z.string().min(1).max(20) });

/** A failed render, again: back to `rendering` and queued (state machine: `retryRender`). */
export async function retryRenderAction(form: FormData): Promise<void> {
  await requireOperator();
  const { code } = retryInput.parse(Object.fromEntries(form));
  const post = await getPostByCode(db, code);
  if (!post?.currentVersionId) throw new Error("Ese post ya no existe.");
  const moved = await transitionPost(db, post.id, "retryRender");
  if (!moved.ok) throw new Error(moved.reason);
  await queueRender(post.currentVersionId);
  revalidatePath("/posts");
  redirect(`/posts/${post.publicCode}`);
}

export type ApproveState = { status: "idle" } | { status: "error"; message: string };

const approveInput = z.object({ code: z.string().min(1).max(20), versionId: z.uuid() });

/**
 * Approves the version the operator reviewed (state machine: `approve`). Refused if the post
 * changed meanwhile or a slide has no PNG: what gets approved is what was on screen.
 */
export async function approvePostAction(_: ApproveState, form: FormData): Promise<ApproveState> {
  await requireOperator();
  const parsed = approveInput.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { status: "error", message: "Datos inválidos." };
  const post = await getPostByCode(db, parsed.data.code);
  if (!post) return { status: "error", message: "Ese post ya no existe." };
  const approved = await approvePost(db, {
    postId: post.id,
    reviewedVersionId: parsed.data.versionId,
  });
  if (!approved.ok) return { status: "error", message: approved.reason };
  revalidatePath("/posts");
  redirect(`/posts/${post.publicCode}`);
}

export type PublishState = { status: "idle" } | { status: "error"; message: string };

const publishInput = z.object({
  code: z.string().min(1).max(20),
  url: z.string().max(600).optional(),
});

/**
 * The operator posted it by hand (adapter `manual`): approved → publishing → published, with
 * the optional link to the post.
 */
export async function markPublishedAction(_: PublishState, form: FormData): Promise<PublishState> {
  await requireOperator();
  const parsed = publishInput.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { status: "error", message: "Datos inválidos." };
  const post = await getPostByCode(db, parsed.data.code);
  if (!post) return { status: "error", message: "Ese post ya no existe." };
  const confirmed = confirmManualPublication({ url: parsed.data.url, now: new Date() });
  if (confirmed.status === "failed") return { status: "error", message: confirmed.error };
  if (confirmed.status !== "published") return { status: "error", message: "No se pudo marcar." };
  const marked = await markPublishedManually(db, {
    postId: post.id,
    url: confirmed.url,
    publishedAt: confirmed.publishedAt,
  });
  if (!marked.ok) return { status: "error", message: marked.reason };
  revalidatePath("/posts");
  redirect(`/posts/${post.publicCode}`);
}
