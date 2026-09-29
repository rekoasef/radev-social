import { type GenerationRequest, INITIAL_STATUSES, type PostArt } from "@radev/core";
import { and, desc, eq, isNotNull, ne, sql } from "drizzle-orm";
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
import { transitionIdea } from "./ideas";
import {
  type CarouselContent,
  pillarId,
  type TransitionOutcome,
  takePostNumber,
  transitionPost,
  type VersionDatasets,
} from "./posts";

// AI generation of a post (phase 3, T7): the post is born `generating` with no version; the
// worker's carousel.generate adds the first version and moves it on through the state machine.

/**
 * A post the AI will write. It gets its public code now; its content comes with the job. From a
 * bank idea, the idea turns `used` in the same transaction (it has to be `new`).
 */
export async function createGeneratingPost(
  db: Database,
  input: {
    brandId: string;
    request: GenerationRequest;
    ideaId?: string | null;
    /** Planned time and slot (slots.fill, phase 4 T4): approving it schedules it there. */
    plan?: { at: Date; slotId: string | null };
  },
): Promise<Post> {
  return db.transaction(async (tx) => {
    if (input.ideaId) {
      const used = await transitionIdea(tx, {
        id: input.ideaId,
        brandId: input.brandId,
        event: "use",
      });
      if (!used) throw new Error("Esa idea ya se usó o se descartó.");
    }
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
        ideaId: input.ideaId ?? null,
        status: INITIAL_STATUSES.ai,
        generationRequest: input.request,
        scheduledAt: input.plan?.at ?? null,
        slotId: input.plan?.slotId ?? null,
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
  input: {
    postId: string;
    content: CarouselContent;
    generationRunId: string | null;
    datasets?: VersionDatasets;
    /** The images to generate (`pending`) or why there are none (ADR 0016). */
    art?: PostArt | null;
  },
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
        datasets: input.datasets ?? null,
        art: input.art ?? null,
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

/**
 * The operator rejected the post with feedback: in_review → rejected → generating in one go
 * (`reject`, `regenerate`), with the feedback stored for the AI and the QA count reset. Only for
 * posts the AI wrote (they have a request to regenerate from).
 */
export async function rejectAndRegenerate(
  db: Database,
  input: { postId: string; feedback: string },
): Promise<TransitionOutcome> {
  return db.transaction(async (tx) => {
    const [post] = await tx
      .select({ generationRequest: posts.generationRequest })
      .from(posts)
      .where(eq(posts.id, input.postId));
    if (!post) return { ok: false, reason: "Ese post no existe." };
    if (!post.generationRequest)
      return { ok: false, reason: "Este post se armó a mano: corregilo con Editar." };
    const rejected = await transitionPost(tx, input.postId, "reject");
    if (!rejected.ok) return rejected;
    const moved = await transitionPost(tx, input.postId, "regenerate");
    if (!moved.ok) throw new Error(moved.reason);
    await tx
      .update(posts)
      .set({ rejectionFeedback: input.feedback, qaRegenerations: 0, generationRetryAt: null })
      .where(eq(posts.id, input.postId));
    return moved;
  });
}

/**
 * An AI version failed the render QA: back to `generating` (`qaRegenerate`), one more on the
 * count. The worker checks the maximum before calling it (renderOutcome).
 */
export async function regenerateForQa(db: Database, postId: string): Promise<TransitionOutcome> {
  return db.transaction(async (tx) => {
    const moved = await transitionPost(tx, postId, "qaRegenerate");
    if (!moved.ok) return moved;
    await tx
      .update(posts)
      .set({ qaRegenerations: sql`${posts.qaRegenerations} + 1`, generationRetryAt: null })
      .where(eq(posts.id, postId));
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

export type RecentPost = {
  hook: string;
  hookType: string | null;
  pillarKey: string | null;
  /** Look of the post (`studio` brands), so the next one does not repeat it. */
  look: string | null;
  /** Its slide types in order, so the next one varies the structure. */
  slides: string[];
};

/**
 * The brand's latest posts that have content, for recent-posts.json: the AI reads them so as
 * not to repeat topics or hooks. `exceptPostId` leaves out the post being regenerated.
 */
export async function listRecentPostHooks(
  db: Database,
  brandId: string,
  options: { exceptPostId?: string; limit?: number } = {},
): Promise<RecentPost[]> {
  const { exceptPostId, limit = 10 } = options;
  const rows = await db
    .select({
      content: postVersions.content,
      hookType: posts.hookType,
      pillarKey: contentPillars.key,
    })
    .from(posts)
    .innerJoin(postVersions, eq(postVersions.id, posts.currentVersionId))
    .leftJoin(contentPillars, eq(contentPillars.id, posts.pillarId))
    .where(
      and(
        eq(posts.brandId, brandId),
        isNotNull(posts.currentVersionId),
        exceptPostId ? ne(posts.id, exceptPostId) : undefined,
      ),
    )
    .orderBy(desc(posts.number))
    .limit(limit);
  return rows.flatMap(({ content, hookType, pillarKey }) => {
    const { hook, look, slides } = content as { hook?: unknown; look?: unknown; slides?: unknown };
    if (typeof hook !== "string") return [];
    const types = Array.isArray(slides)
      ? slides.flatMap((slide) => {
          const type = (slide as { type?: unknown } | null)?.type;
          return typeof type === "string" ? [type] : [];
        })
      : [];
    return [
      { hook, hookType, pillarKey, look: typeof look === "string" ? look : null, slides: types },
    ];
  });
}
