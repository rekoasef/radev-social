import { localDateOf, METRICS_LINK_DAYS } from "@radev/core";
import {
  type Database,
  getBrandById,
  linkNetworkPost,
  listActiveSocialAccounts,
  listUnlinkedPublications,
  type SocialAccount,
  saveAccountStats,
  saveNetworkPostCounts,
  setNetworkPostCover,
  writeMediaFile,
} from "@radev/db";
import {
  fetchPostState,
  fetchTiktokStats,
  isTiktokAuthError,
  listTiktokVideos,
  refreshTiktokToken,
  type TikTokClient,
  TikTokError,
  tiktokIdFromUrl,
} from "@radev/publishers";
import type { Logger } from "../logger";
import { TokenSource } from "../tiktok/renew";

// metrics.sync (phase 6, ADR 0018): every few hours, for each connected TikTok account, the
// account's totals of the day and every post with its counts, ours and the rest. Our posts are
// linked to TikTok's by what TikTok says of the draft we sent (its public post id) or by the link
// the operator pasted when marking it published.
//
// Idempotent (rule 8): everything is an upsert by post, source and day, and a post is linked once.
// An account that fails doesn't stop the others; the job retries at the end.

/** TikTok allows 30 status fetches per minute per token: one every 2.5 s stays below. */
const STATUS_INTERVAL_MS = 2_500;

export type MetricsApi = {
  fetchTiktokStats: typeof fetchTiktokStats;
  listTiktokVideos: typeof listTiktokVideos;
  fetchPostState: typeof fetchPostState;
  refreshTiktokToken: typeof refreshTiktokToken;
};

export type MetricsSyncDeps = {
  db: Database;
  log: Logger;
  /** Null without TIKTOK_CLIENT_KEY/SECRET: nothing to read with. */
  client: TikTokClient | null;
  api?: MetricsApi;
  /** Downloads a cover (TikTok's link expires in hours); throws when it can't. */
  download?: (url: string) => Promise<Cover>;
  saveMedia?: (path: string, bytes: Uint8Array) => Promise<void>;
  sleep?: (ms: number) => Promise<void>;
  now?: () => Date;
};

export type MetricsSyncOutcome = {
  accounts: number;
  posts: number;
  linked: number;
  covers: number;
  failed: number;
};

export async function syncMetrics(deps: MetricsSyncDeps): Promise<MetricsSyncOutcome> {
  const { db, log } = deps;
  const outcome: MetricsSyncOutcome = { accounts: 0, posts: 0, linked: 0, covers: 0, failed: 0 };
  if (!deps.client) {
    log.warn("metrics sync skipped: tiktok not configured");
    return outcome;
  }
  for (const account of await listActiveSocialAccounts(db)) {
    if (account.network !== "tiktok") continue;
    try {
      const done = await syncAccount(deps, deps.client, account);
      if (!done) continue;
      outcome.accounts++;
      outcome.posts += done.posts;
      outcome.linked += done.linked;
      outcome.covers += done.covers;
    } catch (error) {
      // A revoked access is tokens.refresh's to report (with its notice); here it's one more failure.
      outcome.failed++;
      log.error("metrics not synced", {
        account: account.id,
        auth: isTiktokAuthError(error),
        code: error instanceof TikTokError ? error.code : null,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  log.info("metrics sync finished", outcome);
  if (outcome.failed > 0) {
    throw new Error(`No se leyeron las métricas de ${outcome.failed} cuenta(s); se reintenta.`);
  }
  return outcome;
}

async function syncAccount(
  deps: MetricsSyncDeps,
  client: TikTokClient,
  account: SocialAccount,
): Promise<{ posts: number; linked: number; covers: number } | null> {
  const { db, log } = deps;
  const api = deps.api ?? {
    fetchTiktokStats,
    listTiktokVideos,
    fetchPostState,
    refreshTiktokToken,
  };
  const now = deps.now ?? (() => new Date());
  const sleep = deps.sleep ?? ((ms: number) => new Promise((r) => setTimeout(r, ms)));
  const brand = await getBrandById(db, account.brandId);
  if (!brand) return null;
  const brandLog = log.child({ brand: brand.slug });
  if (!account.scopes.includes("video.list")) {
    brandLog.warn("metrics skipped: the account didn't grant video.list (reconnect it)");
    return null;
  }
  const tokens = new TokenSource(db, client, account.id, api.refreshTiktokToken, now);
  // The day in the brand's zone (rule 11): the page draws days as the brand lives them.
  const capturedOn = localDateOf(now(), brand.timezone);

  if (account.scopes.includes("user.info.stats")) {
    const stats = await tokens.use((token) => api.fetchTiktokStats(token));
    await saveAccountStats(db, { brandId: brand.id, network: "tiktok", capturedOn, stats });
  }

  const videos = await tokens.use((token) => api.listTiktokVideos(token));
  let covers = 0;
  for (const video of videos) {
    const stored = await saveNetworkPostCounts(db, {
      brandId: brand.id,
      network: "tiktok",
      capturedOn,
      post: {
        externalId: video.id,
        caption: video.caption,
        url: video.url,
        kind: video.kind,
        publishedAt: video.createdAt,
        views: video.views,
        likes: video.likes,
        comments: video.comments,
        shares: video.shares,
      },
    });
    if (!stored.coverPath && video.coverUrl && deps.download) {
      // Only once per post; a failure is tried again on the next sync.
      try {
        const cover = await deps.download(video.coverUrl);
        const coverPath = `metrics/tiktok/${video.id}.${cover.extension}`;
        await (deps.saveMedia ?? writeMediaFile)(coverPath, cover.bytes);
        await setNetworkPostCover(db, { id: stored.id, coverPath });
        covers++;
      } catch (error) {
        brandLog.warn("cover not saved", { tiktokId: video.id, error });
      }
    }
  }

  // Which TikTok post each of ours became.
  const since = new Date(now().getTime() - METRICS_LINK_DAYS * 86_400_000);
  const known = new Set(videos.map((video) => video.id));
  let linked = 0;
  let asked = 0;
  for (const publication of await listUnlinkedPublications(db, {
    brandId: brand.id,
    network: "tiktok",
    since,
  })) {
    let tiktokId = tiktokIdFromUrl(publication.url);
    if (!tiktokId && publication.network === "tiktok" && publication.externalId) {
      if (asked++ > 0) await sleep(STATUS_INTERVAL_MS);
      const publishId = publication.externalId;
      const state = await tokens.use((token) => api.fetchPostState(token, publishId));
      tiktokId = state.kind === "inbox" || state.kind === "published" ? state.postId : null;
    }
    // Not posted from the inbox yet, or deleted: the next sync asks again.
    if (!tiktokId || !known.has(tiktokId)) continue;
    if (
      await linkNetworkPost(db, {
        network: "tiktok",
        externalId: tiktokId,
        postId: publication.postId,
      })
    ) {
      linked++;
      brandLog.info("post linked to tiktok", { post: publication.code, tiktokId });
    }
  }
  return { posts: videos.length, linked, covers };
}

export type Cover = { bytes: Uint8Array; extension: string };

/** Formats every browser shows; TikTok's CDN answers one of these. */
const COVER_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

/** A cover from TikTok's CDN, a few dozen KB. */
export async function downloadCover(url: string): Promise<Cover> {
  const response = await fetch(url, { signal: AbortSignal.timeout(20_000) });
  if (!response.ok) throw new Error(`La portada respondió HTTP ${response.status}.`);
  const type = (response.headers.get("content-type") ?? "").split(";")[0]?.trim() ?? "";
  const extension = COVER_TYPES[type];
  if (!extension) throw new Error(`La portada vino en un formato que no se muestra (${type}).`);
  return { bytes: new Uint8Array(await response.arrayBuffer()), extension };
}
