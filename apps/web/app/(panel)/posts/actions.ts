"use server";

import { canDiscard, REJECTION_FEEDBACK_MAX, REJECTION_FEEDBACK_MIN } from "@radev/core";
import {
  addPostVersion,
  approvePost,
  type Brand,
  checkBrandAiQuota,
  createGeneratingPost,
  createPost,
  getBrandById,
  getIdea,
  getPostByCode,
  getPostVersion,
  getSocialAccount,
  listPillars,
  markPublishedManually,
  rejectAndRegenerate,
  resolveVersionDatasets,
  retryGeneration,
  retryTiktokPublication,
  transitionPost,
} from "@radev/db";
import { confirmManualPublication } from "@radev/publishers";
import { carouselSchema, enabledLooks, HOOK_TYPES, isLookId, parseTheme } from "@radev/slides";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  applyPostEffects,
  artFor,
  queueGenerate,
  queuePublish,
  queueRender,
  queueTiktokPublish,
  queueVersion,
} from "@/lib/jobs";
import { requireOperator } from "@/lib/session";

export type SaveCarouselState =
  | { status: "idle" }
  | { status: "error"; message: string; fields?: Record<string, string> };

const input = z.object({
  brandId: z.uuid(),
  /** Public code of the post being edited; empty for a new post. */
  code: z.string().max(20).optional(),
  content: z.string().max(200_000),
  /** "1": new images for the post, even if their description did not change (ADR 0016). */
  freshArt: z.literal("1").optional(),
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
  const { brandId, code, content, freshArt } = parsed.data;

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

  const post = code ? await getPostByCode(db, code) : undefined;
  if (code && (!post || post.brandId !== brand.id))
    return { status: "error", message: "Ese post ya no existe." };

  // Charts freeze their points with the version: the ones already in the post keep theirs, a
  // new one takes the brand's data of today (phase 3, T11).
  const datasets = await resolveVersionDatasets(db, {
    brandId: brand.id,
    postId: post?.id ?? null,
    content: carousel.data,
  });
  if (!datasets.ok) {
    const fields: Record<string, string> = {};
    carousel.data.slides.forEach((slide, index) => {
      if (slide.type === "chart" && datasets.missing.includes(slide.datasetRef))
        fields[`slides.${index}.datasetRef`] = "No hay datos para este gráfico.";
    });
    return { status: "error", message: "Hay gráficos sin datos de la marca.", fields };
  }

  let publicCode: string;
  if (post) {
    const result = await addPostVersion(db, {
      postId: post.id,
      content: carousel.data,
      origin: "manual",
      datasets: datasets.datasets,
      art: artFor(brand, carousel.data),
    });
    if (!result.ok) return { status: "error", message: result.reason };
    // A scheduled post loses its publish job (it keeps its time: approving schedules it again).
    await applyPostEffects(post.id, result.effects);
    await queueVersion(result.version, { fresh: freshArt === "1" });
    publicCode = post.publicCode;
  } else {
    const created = await createPost(db, {
      brandId: brand.id,
      content: carousel.data,
      origin: "manual",
      datasets: datasets.datasets,
      art: artFor(brand, carousel.data),
    });
    await queueVersion(created.version);
    publicCode = created.post.publicCode;
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

  const brand = await getBrandById(db, post.brandId);
  const result = await addPostVersion(db, {
    postId: post.id,
    content: content.data,
    origin: "manual",
    // Its charts come back with the numbers they had; its images, too (same prompts: reused).
    datasets: version.datasets,
    art: brand ? artFor(brand, content.data) : null,
  });
  if (!result.ok) throw new Error(result.reason);
  await applyPostEffects(post.id, result.effects);
  await queueVersion(result.version);
  revalidatePath("/posts");
  redirect(`/posts/${post.publicCode}`);
}

const lookInput = z.object({ code: z.string().min(1).max(20), look: z.string().refine(isLookId) });

/**
 * "Usar este look" from the post page: a new version with the same content in another look (no
 * AI involved), back to render and review like any edit. Its images are reused when the new look
 * takes them and their descriptions are unchanged (ADR 0016).
 */
export async function applyLookAction(form: FormData): Promise<void> {
  await requireOperator();
  const { code, look } = lookInput.parse(Object.fromEntries(form));
  const post = await getPostByCode(db, code);
  if (!post?.currentVersionId) throw new Error("Ese post ya no existe.");
  const [brand, version] = await Promise.all([
    getBrandById(db, post.brandId),
    getPostVersion(db, post.currentVersionId),
  ]);
  if (!brand || !version) throw new Error("Ese post ya no existe.");
  const theme = parseTheme(brand.stylePreset, brand.themeTokens);
  if (!theme.ok || theme.theme.preset !== "studio" || !isLookId(look))
    throw new Error("Esta marca no usa looks.");
  if (!enabledLooks(theme.theme.tokens).includes(look))
    throw new Error("Ese look no está activo en la marca.");
  const current = carouselSchema.safeParse(version.content);
  if (!current.success)
    throw new Error("La versión actual ya no cumple el formato actual: abrila en el editor.");

  const content = { ...current.data, look };
  const result = await addPostVersion(db, {
    postId: post.id,
    content,
    origin: "manual",
    datasets: version.datasets,
    art: artFor(brand, content),
  });
  if (!result.ok) throw new Error(result.reason);
  await applyPostEffects(post.id, result.effects);
  await queueVersion(result.version);
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

/**
 * TikTok couldn't take the post (phase 5 T6): send it again now, through the state machine
 * (`retryPublish`). Only with the brand's TikTok still usable.
 */
export async function retryTiktokAction(form: FormData): Promise<void> {
  await requireOperator();
  const { code } = retryInput.parse(Object.fromEntries(form));
  const post = await getPostByCode(db, code);
  if (!post) throw new Error("Ese post ya no existe.");
  const account = await getSocialAccount(db, post.brandId, "tiktok");
  if (account?.status !== "active" || !account.scopes.includes("video.upload")) {
    throw new Error("La marca no tiene TikTok listo para publicar: revisalo en Marcas → Canales.");
  }
  const retried = await retryTiktokPublication(db, post.id);
  if (!retried.ok) throw new Error(retried.reason);
  await queueTiktokPublish(post.id);
  revalidatePath("/posts");
  redirect(`/posts/${post.publicCode}`);
}

export type ApproveState = { status: "idle" } | { status: "error"; message: string };

/** Where a review action came from: the review queue goes back to it (phase 4, T7). */
const reviewOrigin = z.literal("review").optional();

/** After reviewing: the post's page, or the queue with a word on what happened to this one. */
function afterReview(code: string, origin: "review" | undefined): never {
  redirect(origin === "review" ? `/review?listo=${encodeURIComponent(code)}` : `/posts/${code}`);
}

const approveInput = z.object({
  code: z.string().min(1).max(20),
  versionId: z.uuid(),
  from: reviewOrigin,
});

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
    now: new Date(),
  });
  if (!approved.ok) return { status: "error", message: approved.reason };
  // It had a planned time still ahead: approving scheduled it.
  if (approved.scheduledAt) await queuePublish(post.id, approved.scheduledAt);
  revalidatePath("/posts");
  revalidatePath("/review");
  afterReview(post.publicCode, parsed.data.from);
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

export type GenerateState =
  | { status: "idle" }
  | { status: "error"; message: string }
  /** The brand reached its cap: the operator has to confirm (docs/ARCHITECTURE.md §7). */
  | { status: "limit"; message: string };

const generateInput = z.object({
  brandId: z.uuid(),
  idea: z
    .string()
    .trim()
    .min(10, { error: "Contá la idea en al menos 10 caracteres." })
    .max(600, { error: "Máximo 600 caracteres." }),
  // Empty: the AI picks.
  pillarKey: z.string().trim().max(64).optional().default(""),
  hookType: z
    .union([z.enum(HOOK_TYPES), z.literal("")])
    .optional()
    .default(""),
  confirmOverLimit: z.literal("on").optional(),
  /** The bank idea it comes from, if any: it turns used with the post. */
  ideaId: z
    .union([z.uuid(), z.literal("")])
    .optional()
    .default(""),
});

/**
 * "Generar con IA": creates the post in `generating` with the operator's request and queues the
 * worker's carousel.generate. The web never runs AI (CLAUDE.md, rule 5).
 */
export async function generateCarouselAction(
  _: GenerateState,
  form: FormData,
): Promise<GenerateState> {
  await requireOperator();
  const parsed = generateInput.safeParse(Object.fromEntries(form));
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }
  const { brandId, idea, pillarKey, hookType, confirmOverLimit, ideaId } = parsed.data;
  const brand = await getBrandById(db, brandId);
  if (!brand || brand.archivedAt)
    return { status: "error", message: "Esa marca no existe o está archivada." };

  const pillars = await listPillars(db, brand.id);
  if (pillars.length === 0)
    return { status: "error", message: `${brand.name} no tiene pilares de contenido.` };
  if (pillarKey && !pillars.some((p) => p.key === pillarKey))
    return { status: "error", message: "Elegí un pilar de la marca." };

  if (ideaId) {
    const bankIdea = await getIdea(db, ideaId);
    if (!bankIdea || bankIdea.brandId !== brand.id || bankIdea.status !== "new") {
      return { status: "error", message: "Esa idea ya se usó, se descartó o es de otra marca." };
    }
  }

  const overLimit = await quotaWarning(brand);
  if (overLimit && !confirmOverLimit) return { status: "limit", message: overLimit };

  const post = await createGeneratingPost(db, {
    brandId: brand.id,
    request: {
      idea,
      pillarKey: pillarKey || null,
      hookType: hookType || null,
    },
    ideaId: ideaId || null,
  });
  await queueGenerate(post.id);
  revalidatePath("/posts");
  redirect(`/posts/${post.publicCode}`);
}

/** A failed generation, again with the same request (state machine: `retryGeneration`). */
export async function retryGenerationAction(form: FormData): Promise<void> {
  await requireOperator();
  const { code } = retryInput.parse(Object.fromEntries(form));
  const post = await getPostByCode(db, code);
  if (!post?.generationRequest) throw new Error("Ese post no se generó con IA.");
  const moved = await retryGeneration(db, post.id);
  if (!moved.ok) throw new Error(moved.reason);
  await queueGenerate(post.id);
  revalidatePath("/posts");
  redirect(`/posts/${post.publicCode}`);
}

/** Why the brand should not generate now (its cap), or null. Manual runs can confirm past it. */
async function quotaWarning(brand: Brand): Promise<string | null> {
  const quota = await checkBrandAiQuota(db, brand);
  if (quota.ok) return null;
  const period = quota.period === "day" ? "hoy" : "este mes";
  return quota.limit === 0
    ? `La generación de ${brand.name} está pausada (tope 0).`
    : `${brand.name} ya usó sus ${quota.limit} generaciones de ${period}.`;
}

export type RejectState = GenerateState;

const rejectInput = z.object({
  code: z.string().min(1).max(20),
  versionId: z.uuid(),
  feedback: z
    .string()
    .trim()
    .min(REJECTION_FEEDBACK_MIN, {
      error: `Contá qué cambiar en al menos ${REJECTION_FEEDBACK_MIN} caracteres.`,
    })
    .max(REJECTION_FEEDBACK_MAX, { error: `Máximo ${REJECTION_FEEDBACK_MAX} caracteres.` }),
  confirmOverLimit: z.literal("on").optional(),
  from: reviewOrigin,
});

/**
 * "Rechazar y regenerar": the operator says what to change and the AI writes a new version from
 * the current one (state machine: `reject`, then `regenerate`). Only for posts the AI wrote.
 */
export async function rejectPostAction(_: RejectState, form: FormData): Promise<RejectState> {
  await requireOperator();
  const parsed = rejectInput.safeParse(Object.fromEntries(form));
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }
  const { code, versionId, feedback, confirmOverLimit } = parsed.data;
  const post = await getPostByCode(db, code);
  if (!post) return { status: "error", message: "Ese post ya no existe." };
  if (post.currentVersionId !== versionId)
    return {
      status: "error",
      message: "El post cambió mientras lo revisabas: mirá la versión nueva antes de rechazar.",
    };
  const brand = await getBrandById(db, post.brandId);
  if (!brand || brand.archivedAt)
    return { status: "error", message: "Esa marca no existe o está archivada." };

  const overLimit = await quotaWarning(brand);
  if (overLimit && !confirmOverLimit) return { status: "limit", message: overLimit };

  const moved = await rejectAndRegenerate(db, { postId: post.id, feedback });
  if (!moved.ok) return { status: "error", message: moved.reason };
  await queueGenerate(post.id);
  revalidatePath("/posts");
  revalidatePath("/review");
  afterReview(post.publicCode, parsed.data.from);
}

export type DiscardState = { status: "idle" } | { status: "error"; message: string };

const discardInput = z.object({ code: z.string().min(1).max(20), from: reviewOrigin });

/**
 * "Descartar": the post leaves the lists, the calendar and the queue for good (state machine:
 * `archive`). A scheduled one gets its publish job cancelled and its time freed for another post.
 * Nothing is deleted: the code and the versions stay, for the history.
 */
export async function discardPostAction(_: DiscardState, form: FormData): Promise<DiscardState> {
  await requireOperator();
  const parsed = discardInput.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { status: "error", message: "Datos inválidos." };
  const post = await getPostByCode(db, parsed.data.code);
  if (!post) return { status: "error", message: "Ese post ya no existe." };
  if (!canDiscard(post.status))
    return { status: "error", message: "Este post no se puede descartar ahora." };

  const moved = await transitionPost(db, post.id, "archive");
  if (!moved.ok) return { status: "error", message: moved.reason };
  await applyPostEffects(post.id, moved.effects);
  revalidatePath("/posts");
  revalidatePath("/review");
  revalidatePath("/calendar");
  afterReview(post.publicCode, parsed.data.from);
}
