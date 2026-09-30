import { and, eq } from "drizzle-orm";
import { publications } from "../schema";
import type { Executor } from "./brand-assets";

// A publication's own status (not the post's: that one only changes through the state machine,
// in queries/posts.ts).

/**
 * The operator published by hand a draft TikTok left in the inbox (phase 5 T6): that TikTok
 * publication becomes the published one. Returns whether there was such a draft.
 */
export async function publishTiktokInboxDraft(
  db: Executor,
  input: { postId: string; url: string | null; publishedAt: Date },
): Promise<boolean> {
  const updated = await db
    .update(publications)
    .set({ status: "published", url: input.url, error: null, publishedAt: input.publishedAt })
    .where(
      and(
        eq(publications.postId, input.postId),
        eq(publications.network, "tiktok"),
        eq(publications.status, "inbox"),
      ),
    )
    .returning({ id: publications.id });
  return updated.length > 0;
}
