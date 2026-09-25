import { type GenerationRequest, INITIAL_STATUSES } from "@radev/core";
import { and, desc, eq, isNotNull } from "drizzle-orm";
import type { Database } from "../client";
import {
  contentPillars,
  type GenerationRun,
  generationRuns,
  type Post,
  type PostVersion,
  posts,
  postVersions,
} from "../schema";
import type { Executor } from "./brand-assets";
import {
  type CarouselContent,
  pillarId,
  type TransitionOutcome,
  takePostNumber,
  transitionPost,
} from "./posts";

// AI generation of a post (phase 3, T7): the post is born `generating` with no version; the
// worker's carousel.generate adds the first version and moves it on through the state machine.

/** A post the AI will write. It gets its public code now; its content comes with the job. */
export async function createGeneratingPost(
  db: Database,
  input: { brandId: string; request: GenerationRequest },
): Promise<Post> {
  return db.transaction(async (tx) => {
    const { number, code } = await takePostNumber(tx, input.brandId);
    const [post] = await tx
      .insert(posts)
      .values({
        brandId: input.brandId,
        number,
        publicCode: code,
        pillarId: input.request.pillarKey
          ? await pillarId(tx, input.brandId, input.request.pillarKey)
          : null,
        hookType: input.request.hookType,
        status: INITIAL_STATUSES.ai,
        generationRequest: input.request,
      })
      .returning();
    if (!post) throw new Error("No se pudo crear el post.");
    return post;
  });
}

export type GeneratedVersionResult =
  | { ok: true; version: PostVersion }
  | { ok: false; reason: string };

/**
 * Stores what the AI wrote as a new version and moves the post to `rendering`
 * (`generationDone`). Only from `generating`: a repeated job finds the post moved on and stops.
 */
export async function addGeneratedVersion(
  db: Database,
  input: { postId: string; content: CarouselContent; generationRunId: string | null },
): Promise<GeneratedVersionResult> {
  return db.transaction(async (tx) => {
    const moved = await transitionPost(tx, input.postId, "generationDone");
    if (!moved.ok) return moved;

    const [post] = await tx
      .select({ brandId: posts.brandId })
      .from(posts)
      .where(eq(posts.id, input.postId));
    if (!post) return { ok: false, reason: "Ese post no existe." };
    const [last] = await tx
      .select({ number: postVersions.number })
      .from(postVersions)
      .where(eq(postVersions.postId, input.postId))
      .orderBy(desc(postVersions.number))
      .limit(1);

    const [version] = await tx
      .insert(postVersions)
      .values({
        postId: input.postId,
        number: (last?.number ?? 0) + 1,
        content: input.content,
        origin: "ai",
        generationRunId: input.generationRunId,
      })
      .returning();
    if (!version) throw new Error("No se pudo guardar la versión.");

    await tx
      .update(posts)
      .set({
        currentVersionId: version.id,
        hookType: input.content.hookType,
        pillarId: await pillarId(tx, post.brandId, input.content.pillarKey),
        generationRetryAt: null,
      })
      .where(eq(posts.id, input.postId));
    return { ok: true, version };
  });
}

/** The generation gave up: `failed` (`generationFailed`). The runs say why. */
export async function failGeneration(db: Database, postId: string): Promise<TransitionOutcome> {
  return db.transaction(async (tx) => {
    const moved = await transitionPost(tx, postId, "generationFailed");
    if (moved.ok) await clearRetryAt(tx, postId);
    return moved;
  });
}

/** A failed generation, again: back to `generating` (`retryGeneration`). */
export async function retryGeneration(db: Database, postId: string): Promise<TransitionOutcome> {
  return db.transaction(async (tx) => {
    const moved = await transitionPost(tx, postId, "retryGeneration");
    if (moved.ok) await clearRetryAt(tx, postId);
    return moved;
  });
}

const clearRetryAt = (tx: Executor, postId: string) =>
  tx.update(posts).set({ generationRetryAt: null }).where(eq(posts.id, postId));

/** When a generation waiting for a provider's limit tries again (shown on the post page). */
export async function setGenerationRetryAt(
  db: Database,
  postId: string,
  at: Date | null,
): Promise<void> {
  await db.update(posts).set({ generationRetryAt: at }).where(eq(posts.id, postId));
}

/** Generation attempts of a post, newest first. */
export function listGenerationRuns(db: Database, postId: string): Promise<GenerationRun[]> {
  return db
    .select()
    .from(generationRuns)
    .where(eq(generationRuns.postId, postId))
    .orderBy(desc(generationRuns.createdAt));
}

export type RecentPost = { hook: string; hookType: string | null; pillarKey: string | null };

/**
 * The brand's latest posts that have content, for recent-posts.json: the AI reads them so as
 * not to repeat topics or hooks.
 */
export async function listRecentPostHooks(
  db: Database,
  brandId: string,
  limit = 10,
): Promise<RecentPost[]> {
  const rows = await db
    .select({
      content: postVersions.content,
      hookType: posts.hookType,
      pillarKey: contentPillars.key,
    })
    .from(posts)
    .innerJoin(postVersions, eq(postVersions.id, posts.currentVersionId))
    .leftJoin(contentPillars, eq(contentPillars.id, posts.pillarId))
    .where(and(eq(posts.brandId, brandId), isNotNull(posts.currentVersionId)))
    .orderBy(desc(posts.number))
    .limit(limit);
  return rows.flatMap(({ content, hookType, pillarKey }) => {
    const hook = (content as { hook?: unknown }).hook;
    return typeof hook === "string" ? [{ hook, hookType, pillarKey }] : [];
  });
}
