import type { ArtImage, PostArt } from "@radev/core";
import { and, eq, gte, isNotNull } from "drizzle-orm";
import type { Database } from "../client";
import { postVersions } from "../schema";

// Images of a post's versions (ADR 0016). The state lives in post_versions.art; the files, in
// MEDIA_DIR next to the version's PNGs.

export async function setVersionArt(db: Database, versionId: string, art: PostArt): Promise<void> {
  await db.update(postVersions).set({ art }).where(eq(postVersions.id, versionId));
}

/**
 * Images generated since `since` (a rolling day for the daily cap). Counts the images created in
 * that window, whatever the version they belong to (reused ones keep their first date).
 */
export async function countArtImagesSince(db: Database, since: Date): Promise<number> {
  const rows = await db
    .select({ art: postVersions.art })
    .from(postVersions)
    .where(and(isNotNull(postVersions.art), gte(postVersions.createdAt, since)));
  const seen = new Set<string>();
  for (const { art } of rows) {
    for (const image of Object.values(art?.images ?? {})) {
      if (image && Date.parse(image.createdAt) >= since.getTime()) seen.add(image.path);
    }
  }
  return seen.size;
}

/** Every image of a post's versions, to reuse one when the prompt did not change. */
export async function listPostArtImages(db: Database, postId: string): Promise<ArtImage[]> {
  const rows = await db
    .select({ art: postVersions.art })
    .from(postVersions)
    .where(and(eq(postVersions.postId, postId), isNotNull(postVersions.art)));
  return rows.flatMap(({ art }) =>
    Object.values(art?.images ?? {}).filter((image): image is ArtImage => Boolean(image)),
  );
}
