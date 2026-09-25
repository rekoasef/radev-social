import {
  canApprove,
  INITIAL_STATUSES,
  nextStatus,
  type PostEffect,
  type PostEvent,
  type PostStatus,
  publicCode,
  type VersionOrigin,
} from "@radev/core";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import type { Database } from "../client";
import {
  assets,
  brands,
  contentPillars,
  type Post,
  type PostVersion,
  type Publication,
  posts,
  postVersions,
  publications,
  type RenderedAsset,
} from "../schema";
import type { Executor } from "./brand-assets";

// Posts and their versions. `transitionPost` is the only code that writes `posts.status`
// (CLAUDE.md, rule 2): it applies the state machine of packages/core inside a transaction.
// Content must be validated with the carousel schema (packages/slides) before it gets here
// (rule 4): this package stores it as given.

/** What a version stores: a Carousel (packages/slides). Kept loose here on purpose. */
export type CarouselContent = { pillarKey: string; hookType: string } & Record<string, unknown>;

export type TransitionOutcome =
  | { ok: true; from: PostStatus; to: PostStatus; effects: readonly PostEffect[] }
  | { ok: false; reason: string };

/** Applies an event of the state machine to a post, locking its row. */
export async function transitionPost(
  db: Executor,
  postId: string,
  event: PostEvent,
): Promise<TransitionOutcome> {
  const [post] = await db
    .select({ status: posts.status })
    .from(posts)
    .where(eq(posts.id, postId))
    .for("update");
  if (!post) return { ok: false, reason: "Ese post no existe." };
  const result = nextStatus(post.status, event);
  if (!result.ok) return result;
  await db.update(posts).set({ status: result.to }).where(eq(posts.id, postId));
  return { ok: true, from: post.status, to: result.to, effects: result.effects };
}

export async function pillarId(db: Executor, brandId: string, key: string): Promise<string | null> {
  const [pillar] = await db
    .select({ id: contentPillars.id })
    .from(contentPillars)
    .where(and(eq(contentPillars.brandId, brandId), eq(contentPillars.key, key)));
  return pillar?.id ?? null;
}

/** The brand's next post number and public code. Call inside the transaction that inserts it. */
export async function takePostNumber(
  tx: Executor,
  brandId: string,
): Promise<{ number: number; code: string }> {
  const [brand] = await tx
    .update(brands)
    .set({ nextPostNumber: sql`${brands.nextPostNumber} + 1` })
    .where(eq(brands.id, brandId))
    .returning({
      codePrefix: brands.codePrefix,
      taken: sql<number>`${brands.nextPostNumber} - 1`,
    });
  if (!brand) throw new Error("Esa marca no existe.");
  const number = Number(brand.taken);
  return { number, code: publicCode(brand.codePrefix, number) };
}

export type CreatedPost = { post: Post; version: PostVersion };

/**
 * A post written in the editor: takes the brand's next public code, stores version 1 and starts
 * rendering. Everything in one transaction, so a failed insert never burns a code.
 */
export async function createPost(
  db: Database,
  input: { brandId: string; content: CarouselContent; origin: VersionOrigin },
): Promise<CreatedPost> {
  return db.transaction(async (tx) => {
    const { number, code } = await takePostNumber(tx, input.brandId);

    const [post] = await tx
      .insert(posts)
      .values({
        brandId: input.brandId,
        number,
        publicCode: code,
        pillarId: await pillarId(tx, input.brandId, input.content.pillarKey),
        hookType: input.content.hookType,
        status: INITIAL_STATUSES[input.origin],
      })
      .returning();
    if (!post) throw new Error("No se pudo crear el post.");

    const [version] = await tx
      .insert(postVersions)
      .values({ postId: post.id, number: 1, content: input.content, origin: input.origin })
      .returning();
    if (!version) throw new Error("No se pudo guardar la versión.");

    const [updated] = await tx
      .update(posts)
      .set({ currentVersionId: version.id })
      .where(eq(posts.id, post.id))
      .returning();
    return { post: updated ?? post, version };
  });
}

export type NewVersionResult =
  | { ok: true; version: PostVersion; effects: readonly PostEffect[] }
  | { ok: false; reason: string };

/**
 * A new version of a post (an edit or a restored one): it becomes the current one and the post
 * goes back to render and review (state machine: `edit`).
 */
export async function addPostVersion(
  db: Database,
  input: { postId: string; content: CarouselContent; origin: VersionOrigin },
): Promise<NewVersionResult> {
  return db.transaction(async (tx) => {
    const moved = await transitionPost(tx, input.postId, "edit");
    if (!moved.ok) return moved;

    const [last] = await tx
      .select({ number: postVersions.number })
      .from(postVersions)
      .where(eq(postVersions.postId, input.postId))
      .orderBy(desc(postVersions.number))
      .limit(1);
    const [post] = await tx
      .select({ brandId: posts.brandId })
      .from(posts)
      .where(eq(posts.id, input.postId));
    if (!post) return { ok: false, reason: "Ese post no existe." };

    const [version] = await tx
      .insert(postVersions)
      .values({
        postId: input.postId,
        number: (last?.number ?? 0) + 1,
        content: input.content,
        origin: input.origin,
      })
      .returning();
    if (!version) throw new Error("No se pudo guardar la versión.");

    await tx
      .update(posts)
      .set({
        currentVersionId: version.id,
        hookType: input.content.hookType,
        pillarId: await pillarId(tx, post.brandId, input.content.pillarKey),
      })
      .where(eq(posts.id, input.postId));
    return { ok: true, version, effects: moved.effects };
  });
}

export type PostSummary = Post & {
  pillarName: string | null;
  versionNumber: number | null;
  /** The current version's content (hook, slides…). */
  content: CarouselContent | null;
};

/** Posts of a brand, newest first, optionally only some statuses. */
export async function listPosts(
  db: Database,
  brandId: string,
  statuses?: readonly PostStatus[],
): Promise<PostSummary[]> {
  const rows = await db
    .select({ post: posts, pillarName: contentPillars.name, version: postVersions })
    .from(posts)
    .leftJoin(contentPillars, eq(contentPillars.id, posts.pillarId))
    .leftJoin(postVersions, eq(postVersions.id, posts.currentVersionId))
    .where(
      statuses && statuses.length > 0
        ? and(eq(posts.brandId, brandId), inArray(posts.status, [...statuses]))
        : eq(posts.brandId, brandId),
    )
    .orderBy(desc(posts.number));
  return rows.map(({ post, pillarName, version }) => ({
    ...post,
    pillarName,
    versionNumber: version?.number ?? null,
    content: (version?.content as CarouselContent | undefined) ?? null,
  }));
}

/** Counts per status for a brand (the list's filters). */
export async function countPostsByStatus(
  db: Database,
  brandId: string,
): Promise<Partial<Record<PostStatus, number>>> {
  const rows = await db
    .select({ status: posts.status, n: sql<number>`count(*)::int` })
    .from(posts)
    .where(eq(posts.brandId, brandId))
    .groupBy(posts.status);
  return Object.fromEntries(rows.map((r) => [r.status, r.n]));
}

export async function getPostById(db: Executor, id: string): Promise<Post | undefined> {
  const [post] = await db.select().from(posts).where(eq(posts.id, id)).limit(1);
  return post;
}

export async function getPostByCode(db: Database, code: string): Promise<Post | undefined> {
  const [post] = await db.select().from(posts).where(eq(posts.publicCode, code)).limit(1);
  return post;
}

export async function getPostVersion(db: Executor, id: string): Promise<PostVersion | undefined> {
  const [version] = await db.select().from(postVersions).where(eq(postVersions.id, id)).limit(1);
  return version;
}

/** Versions of a post, newest first. */
export function listPostVersions(db: Database, postId: string): Promise<PostVersion[]> {
  return db
    .select()
    .from(postVersions)
    .where(eq(postVersions.postId, postId))
    .orderBy(desc(postVersions.number));
}

/** Pillars of a brand that can take new posts (not archived). */
export function listPillars(db: Database, brandId: string) {
  return db
    .select()
    .from(contentPillars)
    .where(and(eq(contentPillars.brandId, brandId), sql`${contentPillars.archivedAt} is null`))
    .orderBy(desc(contentPillars.targetShare), contentPillars.name);
}

/** Stores (or replaces) the PNG of one slide: rendering twice never duplicates (rule 8). */
export async function saveRenderedAsset(
  db: Executor,
  values: Omit<RenderedAsset, "id" | "createdAt">,
): Promise<void> {
  await db
    .insert(assets)
    .values(values)
    .onConflictDoUpdate({
      target: [assets.postVersionId, assets.format, assets.slideIndex],
      set: {
        path: values.path,
        width: values.width,
        height: values.height,
        checksum: values.checksum,
      },
    });
}

/** Rendered PNGs of a version, in slide order. */
export function listVersionAssets(db: Executor, versionId: string): Promise<RenderedAsset[]> {
  return db
    .select()
    .from(assets)
    .where(eq(assets.postVersionId, versionId))
    .orderBy(assets.slideIndex);
}

/** Render QA problems of a version (null when it rendered fine). */
export async function setVersionRenderIssues(
  db: Executor,
  versionId: string,
  issues: unknown[] | null,
): Promise<void> {
  await db.update(postVersions).set({ renderIssues: issues }).where(eq(postVersions.id, versionId));
}

/**
 * The operator approves the version they reviewed (state machine: `approve`). Locks the post so
 * an edit saved at the same time cannot slip in between the check and the change.
 */
export async function approvePost(
  db: Database,
  input: { postId: string; reviewedVersionId: string },
): Promise<TransitionOutcome> {
  return db.transaction(async (tx) => {
    const [post] = await tx
      .select({ status: posts.status, currentVersionId: posts.currentVersionId })
      .from(posts)
      .where(eq(posts.id, input.postId))
      .for("update");
    if (!post) return { ok: false, reason: "Ese post no existe." };
    const version = await getPostVersion(tx, input.reviewedVersionId);
    const slides = (version?.content as { slides?: unknown[] } | undefined)?.slides;
    const rendered = await listVersionAssets(tx, input.reviewedVersionId);
    const check = canApprove({
      status: post.status,
      currentVersionId: post.currentVersionId,
      reviewedVersionId: input.reviewedVersionId,
      slideCount: Array.isArray(slides) ? slides.length : 0,
      renderedSlides: rendered.map((asset) => asset.slideIndex),
    });
    if (!check.ok) return check;
    return transitionPost(tx, input.postId, "approve");
  });
}

/**
 * The operator published an approved post by hand (adapter `manual`): approved → publishing →
 * published and the publication recorded, in one transaction. The (post, network) key keeps a
 * repeated click from recording twice; the state machine refuses it anyway (rule 8).
 */
export async function markPublishedManually(
  db: Database,
  input: { postId: string; url: string | null; publishedAt: Date },
): Promise<TransitionOutcome> {
  return db.transaction(async (tx) => {
    const started = await transitionPost(tx, input.postId, "startPublishing");
    if (!started.ok) return started;
    await tx
      .insert(publications)
      .values({
        postId: input.postId,
        network: "manual",
        status: "published",
        url: input.url,
        attempts: 1,
        publishedAt: input.publishedAt,
      })
      .onConflictDoUpdate({
        target: [publications.postId, publications.network],
        set: {
          status: "published",
          url: input.url,
          error: null,
          attempts: sql`${publications.attempts} + 1`,
          publishedAt: input.publishedAt,
        },
      });
    const done = await transitionPost(tx, input.postId, "publishDone");
    // Cannot fail right after startPublishing; if it did, roll everything back.
    if (!done.ok) throw new Error(done.reason);
    return { ...done, from: started.from };
  });
}

/** Where and when a post was published, one row per network. */
export function listPublications(db: Executor, postId: string): Promise<Publication[]> {
  return db
    .select()
    .from(publications)
    .where(eq(publications.postId, postId))
    .orderBy(publications.createdAt);
}

/** How far the render of a version got (0–100), or null when it is not rendering. */
export async function setVersionRenderProgress(
  db: Executor,
  versionId: string,
  progress: number | null,
): Promise<void> {
  await db
    .update(postVersions)
    .set({ renderProgress: progress })
    .where(eq(postVersions.id, versionId));
}
