import { type Network, type Notice, type PostPublishJob, publishNotice } from "@radev/core";
import { type Database, getPostById, getSocialAccount, startScheduledPublishing } from "@radev/db";
import { manualPublisher, type PublisherAdapter } from "@radev/publishers";
import type { Logger } from "../logger";

// post.publish (docs/ARCHITECTURE.md §6 and §9, phase 4 T2 and phase 5 T6): at a scheduled post's
// time, move it to `publishing` and hand it over. A brand with its TikTok connected (and allowed to
// upload) goes through TikTok: the tiktok.publish job sends it. Any other brand, or one whose
// TikTok needs connecting again, publishes by hand (`manual`): the post waits for the operator's
// "Marcar como publicado", with a reminder on Telegram. A stale job (the post was unscheduled,
// moved or edited) does nothing (rules 3 and 8).

export type PublishDeps = {
  db: Database;
  log: Logger;
  publisher?: PublisherAdapter;
  /** Queues tiktok.publish for a post already `publishing`. Without it, everything is manual. */
  queueTiktok?: (postId: string) => Promise<void>;
  /** The reminder to publish by hand (Telegram, phase 4 T6). */
  notify?: (notice: Notice, options: { urgent: boolean }) => Promise<void>;
  appUrl?: string;
};

export type PublishOutcome = "waiting" | "sent" | "published" | "stale" | "missing";

/** TikTok when the brand has it connected and it can send drafts; otherwise by hand. */
async function networkFor(deps: PublishDeps, postId: string): Promise<Network> {
  if (!deps.queueTiktok) return "manual";
  const post = await getPostById(deps.db, postId);
  if (!post) return "manual";
  const account = await getSocialAccount(deps.db, post.brandId, "tiktok");
  const usable = account?.status === "active" && account.scopes.includes("video.upload");
  if (account && !usable) {
    deps.log.warn("tiktok connected but not usable: publishing by hand", {
      postId,
      status: account.status,
    });
  }
  return usable ? "tiktok" : "manual";
}

export async function publishPost(deps: PublishDeps, job: PostPublishJob): Promise<PublishOutcome> {
  const network = await networkFor(deps, job.postId);
  const publisher = network === "manual" ? (deps.publisher ?? manualPublisher) : null;
  const start = await startScheduledPublishing(deps.db, { job, network });
  if (!start.started) {
    deps.log.info("publish job skipped", { postId: job.postId, reason: start.reason });
    return start.reason;
  }
  if (!publisher) {
    await deps.queueTiktok?.(start.postId);
    deps.log.info("post handed to tiktok", { post: start.publicCode });
    return "sent";
  }
  const result = await publisher.publish({ postId: start.postId, publicCode: start.publicCode });
  switch (result.status) {
    case "pending":
      deps.log.info("post waiting to be published by hand", { post: start.publicCode });
      await deps.notify?.(
        publishNotice(
          {
            id: start.postId,
            code: start.publicCode,
            brandName: start.brandName,
            hook: start.hook,
            scheduledAt: start.scheduledAt,
          },
          deps.appUrl ?? "",
        ),
        { urgent: true },
      );
      return "waiting";
    case "published":
      // Only manual gets here, and it always waits.
      throw new Error(`${publisher.network} publicó sin confirmación: no se registra.`);
    case "failed":
      throw new Error(result.error);
  }
}
