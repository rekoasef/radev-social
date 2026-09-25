import { type Notice, type PostPublishJob, publishNotice } from "@radev/core";
import { type Database, startScheduledPublishing } from "@radev/db";
import { manualPublisher, type PublisherAdapter } from "@radev/publishers";
import type { Logger } from "../logger";

// post.publish (docs/ARCHITECTURE.md §6 and §9, phase 4 T2): at a scheduled post's time, move it
// to `publishing` and hand it to its adapter. Today every brand publishes by hand (`manual`): the
// post waits for the operator's "Marcar como publicado", with a reminder on Telegram. A stale job
// (the post was unscheduled, moved or edited) does nothing (rules 3 and 8).

export type PublishDeps = {
  db: Database;
  log: Logger;
  publisher?: PublisherAdapter;
  /** The reminder to publish by hand (Telegram, phase 4 T6). */
  notify?: (notice: Notice, options: { urgent: boolean }) => Promise<void>;
  appUrl?: string;
};

export type PublishOutcome = "waiting" | "published" | "stale" | "missing";

export async function publishPost(deps: PublishDeps, job: PostPublishJob): Promise<PublishOutcome> {
  const publisher = deps.publisher ?? manualPublisher;
  const start = await startScheduledPublishing(deps.db, { job, network: publisher.network });
  if (!start.started) {
    deps.log.info("publish job skipped", { postId: job.postId, reason: start.reason });
    return start.reason;
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
      // Only automatic adapters (TikTok, later) get here; manual always waits.
      throw new Error(`${publisher.network} publicó sin confirmación: todavía no se registra.`);
    case "failed":
      throw new Error(result.error);
  }
}
