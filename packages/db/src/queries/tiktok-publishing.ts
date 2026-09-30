import type { PostStatus } from "@radev/core";
import { and, eq } from "drizzle-orm";
import type { Database } from "../client";
import { assets, brands, posts, postVersions, publications } from "../schema";
import type { Executor } from "./brand-assets";
import { listVersionAssets, transitionPost } from "./posts";

// Publishing through TikTok (phase 5 T6, docs/ARCHITECTURE.md §9). The post is already
// `publishing` (post.publish started it) with a `pending` tiktok publication; the tiktok.publish
// job sends it, saves TikTok's publish id and follows it until TikTok takes it or fails. The
// post's status only changes through the state machine (rule 2).

export type TiktokPublishContext = {
  postId: string;
  publicCode: string;
  status: PostStatus;
  brand: { id: string; name: string; slug: string };
  versionId: string;
  content: unknown;
  publication: {
    id: string;
    status: string;
    /** TikTok's publish id once sent: a retry follows it instead of sending again (rule 8). */
    externalId: string | null;
  } | null;
  /** The slides' files, in order: `jpegPath` null in versions rendered before phase 5 T5. */
  slides: { assetId: string; index: number; pngPath: string; jpegPath: string | null }[];
};

export async function getTiktokPublishContext(
  db: Executor,
  postId: string,
): Promise<TiktokPublishContext | undefined> {
  const [row] = await db
    .select({
      postId: posts.id,
      publicCode: posts.publicCode,
      status: posts.status,
      brand: { id: brands.id, name: brands.name, slug: brands.slug },
      versionId: postVersions.id,
      content: postVersions.content,
    })
    .from(posts)
    .innerJoin(brands, eq(brands.id, posts.brandId))
    .innerJoin(postVersions, eq(postVersions.id, posts.currentVersionId))
    .where(eq(posts.id, postId));
  if (!row) return undefined;
  const [publication] = await db
    .select({
      id: publications.id,
      status: publications.status,
      externalId: publications.externalId,
    })
    .from(publications)
    .where(and(eq(publications.postId, postId), eq(publications.network, "tiktok")));
  const rendered = await listVersionAssets(db, row.versionId);
  return {
    ...row,
    publication: publication ?? null,
    slides: rendered.map((asset) => ({
      assetId: asset.id,
      index: asset.slideIndex,
      pngPath: asset.path,
      jpegPath: asset.jpegPath,
    })),
  };
}

/** A JPEG made later for a slide rendered before phase 5 T5. */
export async function setAssetJpeg(
  db: Executor,
  input: { assetId: string; jpegPath: string; jpegChecksum: string },
): Promise<void> {
  await db
    .update(assets)
    .set({ jpegPath: input.jpegPath, jpegChecksum: input.jpegChecksum })
    .where(eq(assets.id, input.assetId));
}

/** Saved right after TikTok accepts the post, before anything else can fail. */
export async function setTiktokPublishId(
  db: Executor,
  input: { postId: string; publishId: string | null },
): Promise<void> {
  await db
    .update(publications)
    .set({ externalId: input.publishId })
    .where(and(eq(publications.postId, input.postId), eq(publications.network, "tiktok")));
}

export type TiktokOutcome =
  /** A draft in the account's inbox: the post stays `publishing` until the operator marks it. */
  | { kind: "inbox" }
  | { kind: "published"; url: string | null; at: Date }
  | { kind: "failed"; error: string };

/**
 * Settles the tiktok publication, and the post when it's final: published → `published`, failed →
 * `publish_failed`. Only acts while the post is `publishing` with that publication still pending
 * or in the inbox, so a repeated job changes nothing (rule 8). Returns whether it acted.
 */
export async function settleTiktokPublication(
  db: Database,
  input: { postId: string; outcome: TiktokOutcome },
): Promise<boolean> {
  return db.transaction(async (tx) => {
    const [post] = await tx
      .select({ status: posts.status })
      .from(posts)
      .where(eq(posts.id, input.postId))
      .for("update");
    if (post?.status !== "publishing") return false;
    const [publication] = await tx
      .select({ status: publications.status })
      .from(publications)
      .where(and(eq(publications.postId, input.postId), eq(publications.network, "tiktok")))
      .for("update");
    if (!publication || (publication.status !== "pending" && publication.status !== "inbox")) {
      return false;
    }
    const where = and(eq(publications.postId, input.postId), eq(publications.network, "tiktok"));
    const { outcome } = input;
    switch (outcome.kind) {
      case "inbox":
        if (publication.status === "inbox") return false;
        await tx.update(publications).set({ status: "inbox", error: null }).where(where);
        return true;
      case "published": {
        await tx
          .update(publications)
          .set({ status: "published", url: outcome.url, publishedAt: outcome.at, error: null })
          .where(where);
        const moved = await transitionPost(tx, input.postId, "publishDone");
        if (!moved.ok) throw new Error(moved.reason);
        return true;
      }
      case "failed": {
        await tx
          .update(publications)
          .set({ status: "failed", error: outcome.error.slice(0, 1000) })
          .where(where);
        const moved = await transitionPost(tx, input.postId, "publishFailed");
        if (!moved.ok) throw new Error(moved.reason);
        return true;
      }
    }
  });
}

export type RetryTiktokResult = { ok: true } | { ok: false; reason: string };

/**
 * "Reintentar en TikTok" on a post whose TikTok send failed: back to `publishing` through the state
 * machine (`retryPublish`), with the TikTok publication pending again and without the old publish
 * id, so tiktok.publish sends it anew. Refused for anything else.
 */
export async function retryTiktokPublication(
  db: Database,
  postId: string,
): Promise<RetryTiktokResult> {
  return db.transaction(async (tx) => {
    const [post] = await tx
      .select({ status: posts.status })
      .from(posts)
      .where(eq(posts.id, postId))
      .for("update");
    if (post?.status !== "publish_failed") {
      return { ok: false, reason: "Solo se reintenta un post con la publicación fallida." };
    }
    const where = and(eq(publications.postId, postId), eq(publications.network, "tiktok"));
    const [publication] = await tx
      .select({ status: publications.status, attempts: publications.attempts })
      .from(publications)
      .where(where);
    if (publication?.status !== "failed") {
      return { ok: false, reason: "Este post no falló en TikTok." };
    }
    const moved = await transitionPost(tx, postId, "retryPublish");
    if (!moved.ok) return moved;
    await tx
      .update(publications)
      .set({ status: "pending", error: null, externalId: null, attempts: publication.attempts + 1 })
      .where(where);
    return { ok: true };
  });
}
