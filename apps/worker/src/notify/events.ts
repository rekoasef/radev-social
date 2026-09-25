import {
  type FailureWhat,
  failureNotice,
  limitNotice,
  limitPutsAtRisk,
  limitRiskNotice,
} from "@radev/core";
import {
  type Database,
  getBrandById,
  getIdeaRequest,
  getPostById,
  getPostVersion,
} from "@radev/db";
import type { Logger } from "../logger";
import type { Notifier } from "./notifier";

// The operator's notices for things that go wrong (phase 4, T6): a job that failed for good, or a
// provider's limit. A notice never breaks the job that raises it: errors here are only logged.

export type Events = {
  postFailed: (input: {
    what: FailureWhat;
    postId: string;
    id: string;
    error: string;
  }) => Promise<void>;
  renderFailed: (input: { versionId: string; error: string }) => Promise<void>;
  ideasFailed: (input: { requestId: string; error: string }) => Promise<void>;
  rateLimited: (input: { postId: string; retryAt: Date }) => Promise<void>;
};

/** A thrown value as text, for a notice. */
export const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

export function createEvents(input: { db: Database; notifier: Notifier; log: Logger }): Events {
  const { db, notifier, log } = input;
  const safely = async (what: string, run: () => Promise<void>) => {
    try {
      await run();
    } catch (error) {
      log.error("notice not raised", { what, error });
    }
  };

  const postFailed: Events["postFailed"] = (event) =>
    safely("post failed", async () => {
      const post = await getPostById(db, event.postId);
      const brand = post && (await getBrandById(db, post.brandId));
      if (!post || !brand) return;
      await notifier.notify(
        failureNotice({
          what: event.what,
          id: `${event.postId}:${event.id}`,
          subject: `${post.publicCode} (${brand.name})`,
          error: event.error,
          link: `/posts/${post.publicCode}`,
          appUrl: notifier.appUrl,
        }),
      );
    });

  return {
    postFailed,
    renderFailed: (event) =>
      safely("render failed", async () => {
        const version = await getPostVersion(db, event.versionId);
        if (!version) return;
        await postFailed({
          what: "render",
          postId: version.postId,
          id: event.versionId,
          error: event.error,
        });
      }),
    ideasFailed: (event) =>
      safely("ideas failed", async () => {
        const request = await getIdeaRequest(db, event.requestId);
        const brand = request && (await getBrandById(db, request.brandId));
        if (!request || !brand) return;
        await notifier.notify(
          failureNotice({
            what: "ideas",
            id: request.id,
            subject: brand.name,
            error: event.error,
            link: "/ideas",
            appUrl: notifier.appUrl,
          }),
        );
      }),
    rateLimited: (event) =>
      safely("rate limited", async () => {
        const post = await getPostById(db, event.postId);
        const brand = post && (await getBrandById(db, post.brandId));
        if (!post || !brand) return;
        await notifier.notify(
          limitNotice({ now: new Date(), retryAt: event.retryAt, timeZone: brand.timezone }),
        );
        if (post.scheduledAt && limitPutsAtRisk(event.retryAt, post.scheduledAt)) {
          await notifier.notify(
            limitRiskNotice({
              post: {
                id: post.id,
                code: post.publicCode,
                brandName: brand.name,
                plannedAt: post.scheduledAt,
              },
              retryAt: event.retryAt,
              timeZone: brand.timezone,
              appUrl: notifier.appUrl,
            }),
          );
        }
      }),
  };
}
