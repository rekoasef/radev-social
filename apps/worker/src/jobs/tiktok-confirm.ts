import { type Notice, TIKTOK_INBOX_GIVE_UP_DAYS, tiktokPublishedNotice } from "@radev/core";
import {
  type Database,
  getSocialAccount,
  listTiktokInboxDrafts,
  settleTiktokPublication,
  type TiktokInboxDraft,
} from "@radev/db";
import {
  fetchPostState,
  isTiktokAuthError,
  listTiktokVideos,
  refreshTiktokToken,
  type TikTokClient,
  TikTokError,
  type TikTokVideo,
} from "@radev/publishers";
import { z } from "zod";
import type { Logger } from "../logger";
import { TokenSource } from "../tiktok/renew";

// tiktok.confirm (phase 6): every 5 min, the drafts waiting in a TikTok inbox. Once the operator
// posts one from the app, TikTok's status still says SEND_TO_USER_INBOX but hands the public post's
// id (seen with RA-0006 and RA-0007): the post is marked published with its link, taken from the
// account's latest posts (video.list), and the operator is told. "Marcar como publicado" stays as
// the way by hand. A draft not posted in TIKTOK_INBOX_GIVE_UP_DAYS is given up: publish_failed.
//
// Idempotent (rule 8): settleTiktokPublication only acts on a post still `publishing` with the
// publication in the inbox, and the notice has a key per post. With no drafts it calls nobody.

/** TikTok allows 30 status fetches per minute per token: one every 2.5 s stays below. */
const STATUS_INTERVAL_MS = 2_500;
const DAY_MS = 86_400_000;

export type TiktokConfirmApi = {
  fetchPostState: typeof fetchPostState;
  listTiktokVideos: typeof listTiktokVideos;
  refreshTiktokToken: typeof refreshTiktokToken;
};

export type TiktokConfirmDeps = {
  db: Database;
  log: Logger;
  /** Null without TIKTOK_CLIENT_KEY/SECRET: nothing to ask with. */
  client: TikTokClient | null;
  notify?: (notice: Notice, options: { urgent: boolean }) => Promise<void>;
  /** A draft was given up: tell the operator (Telegram). */
  onFailed?: (input: { postId: string; error: string }) => Promise<void>;
  appUrl?: string;
  api?: TiktokConfirmApi;
  sleep?: (ms: number) => Promise<void>;
  now?: () => Date;
};

export type TiktokConfirmOutcome = {
  drafts: number;
  published: number;
  givenUp: number;
  failed: number;
};

const hookSchema = z.object({ hook: z.string().catch("") }).catch({ hook: "" });

export async function confirmTiktokDrafts(deps: TiktokConfirmDeps): Promise<TiktokConfirmOutcome> {
  const { db, log, client } = deps;
  const drafts = await listTiktokInboxDrafts(db);
  const outcome: TiktokConfirmOutcome = {
    drafts: drafts.length,
    published: 0,
    givenUp: 0,
    failed: 0,
  };
  if (drafts.length === 0) return outcome;
  if (!client) {
    log.warn("tiktok confirm skipped: tiktok not configured");
    return outcome;
  }

  const byBrand = new Map<string, TiktokInboxDraft[]>();
  for (const draft of drafts) {
    byBrand.set(draft.brand.id, [...(byBrand.get(draft.brand.id) ?? []), draft]);
  }
  for (const [brandId, brandDrafts] of byBrand) {
    try {
      const done = await confirmBrand(deps, client, brandId, brandDrafts);
      outcome.published += done.published;
      outcome.givenUp += done.givenUp;
    } catch (error) {
      // TikTok down or a revoked access (tokens.refresh reports that one): the next run asks again.
      outcome.failed++;
      log.error("tiktok drafts not checked", {
        brandId,
        auth: isTiktokAuthError(error),
        code: error instanceof TikTokError ? error.code : null,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  if (outcome.published > 0 || outcome.givenUp > 0 || outcome.failed > 0) {
    log.info("tiktok confirm finished", outcome);
  }
  return outcome;
}

async function confirmBrand(
  deps: TiktokConfirmDeps,
  client: TikTokClient,
  brandId: string,
  drafts: TiktokInboxDraft[],
): Promise<{ published: number; givenUp: number }> {
  const { db, log } = deps;
  const api = deps.api ?? { fetchPostState, listTiktokVideos, refreshTiktokToken };
  const sleep = deps.sleep ?? ((ms: number) => new Promise((r) => setTimeout(r, ms)));
  const now = deps.now ?? (() => new Date());
  const done = { published: 0, givenUp: 0 };

  const account = await getSocialAccount(db, brandId, "tiktok");
  // Disconnected or to reconnect: nothing to ask with; "Marcar como publicado" still works.
  if (account?.status !== "active") return done;
  const tokens = new TokenSource(db, client, account.id, api.refreshTiktokToken, now);
  // The account's latest posts, read once per run and only when a draft got posted.
  let latest: TikTokVideo[] | null = null;

  let asked = 0;
  for (const draft of drafts) {
    if (now().getTime() - draft.sentAt.getTime() > TIKTOK_INBOX_GIVE_UP_DAYS * DAY_MS) {
      const error = `No se publicó desde la bandeja de TikTok en ${TIKTOK_INBOX_GIVE_UP_DAYS} días. Si lo publicaste, marcalo a mano`;
      if (
        await settleTiktokPublication(db, {
          postId: draft.postId,
          outcome: { kind: "failed", error },
        })
      ) {
        done.givenUp++;
        log.warn("tiktok draft given up", { post: draft.publicCode });
        await deps.onFailed?.({ postId: draft.postId, error });
      }
      continue;
    }

    if (asked++ > 0) await sleep(STATUS_INTERVAL_MS);
    const state = await tokens.use((token) => api.fetchPostState(token, draft.publishId));
    // Still in the inbox (no public id yet), or anything odd: the next run asks again.
    if (state.kind !== "inbox" && state.kind !== "published") continue;
    if (!state.postId) continue;

    if (latest === null) {
      latest = account.scopes.includes("video.list")
        ? await tokens.use((token) => api.listTiktokVideos(token, { maxPages: 1 }))
        : [];
    }
    const video = latest.find((candidate) => candidate.id === state.postId);
    const link = video?.url ?? null;
    const settled = await settleTiktokPublication(db, {
      postId: draft.postId,
      outcome: { kind: "published", url: link, at: video?.createdAt ?? now() },
    });
    if (!settled) continue;
    done.published++;
    log.info("tiktok draft published", { post: draft.publicCode, tiktokId: state.postId, link });
    await deps.notify?.(
      tiktokPublishedNotice(
        {
          id: draft.postId,
          code: draft.publicCode,
          brandName: draft.brand.name,
          hook: hookSchema.parse(draft.content).hook,
          link,
        },
        deps.appUrl ?? "",
      ),
      { urgent: false },
    );
  }
  return done;
}
