import { TikTokError, type TikTokVideo } from "@radev/publishers";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createLogger } from "../logger";
import { type MetricsApi, type MetricsSyncDeps, syncMetrics } from "./metrics-sync";

const db = vi.hoisted(() => ({
  listActiveSocialAccounts: vi.fn(),
  getBrandById: vi.fn(),
  renewSocialAccountTokens: vi.fn(),
  saveAccountStats: vi.fn(),
  saveNetworkPostCounts: vi.fn(),
  setNetworkPostCover: vi.fn(),
  listUnlinkedPublications: vi.fn(),
  linkNetworkPost: vi.fn(),
  writeMediaFile: vi.fn(),
}));
vi.mock("@radev/db", () =>
  Object.fromEntries(
    Object.keys(db).map((name) => [
      name,
      (...a: unknown[]) => (db as Record<string, (...b: unknown[]) => unknown>)[name]?.(...a),
    ]),
  ),
);

// 2026-10-01 01:30 UTC is still 2026-09-30 in Buenos Aires.
const now = new Date("2026-10-01T01:30:00Z");
const AR = "America/Argentina/Buenos_Aires";
const scopes = ["user.info.basic", "user.info.stats", "video.list", "video.upload"];

const video = (id: string, over: Partial<TikTokVideo> = {}): TikTokVideo => ({
  id,
  caption: "Caption",
  createdAt: new Date("2026-09-30T14:05:00Z"),
  url: `https://www.tiktok.com/@radev906/video/${id}`,
  coverUrl: `https://cdn.example/${id}.jpeg`,
  kind: "photo",
  views: 82,
  likes: 1,
  comments: 0,
  shares: 0,
  ...over,
});

let api: { [K in keyof MetricsApi]: ReturnType<typeof vi.fn> };
let deps: MetricsSyncDeps;

beforeEach(() => {
  for (const fn of Object.values(db)) fn.mockReset();
  db.listActiveSocialAccounts.mockResolvedValue([
    { id: "a1", brandId: "b1", network: "tiktok", scopes },
  ]);
  db.getBrandById.mockResolvedValue({ id: "b1", slug: "radev", timezone: AR });
  // Like the real one: the stored token is still good.
  db.renewSocialAccountTokens.mockResolvedValue({
    tokens: { accessToken: "act.X", accessExpiresAt: new Date(now.getTime() + 3_600_000) },
  });
  db.saveNetworkPostCounts.mockImplementation(
    async (_db: unknown, input: { post: { externalId: string } }) => ({
      id: `np-${input.post.externalId}`,
      coverPath: null,
      postId: null,
    }),
  );
  db.listUnlinkedPublications.mockResolvedValue([]);
  db.linkNetworkPost.mockResolvedValue(true);
  api = {
    fetchTiktokStats: vi.fn(async () => ({
      followers: 1132,
      following: 5,
      likes: 9242,
      videos: 2,
    })),
    listTiktokVideos: vi.fn(async () => [
      video("7691331151528545557"),
      video("7678363808074648852"),
    ]),
    fetchPostState: vi.fn(),
    refreshTiktokToken: vi.fn(),
  };
  deps = {
    db: {} as never,
    log: createLogger({}, "error"),
    client: { clientKey: "k", clientSecret: "s" },
    api: api as unknown as MetricsApi,
    download: vi.fn(async () => ({ bytes: new Uint8Array([1]), extension: "webp" })),
    saveMedia: vi.fn(async () => {}),
    sleep: vi.fn(async () => {}),
    now: () => now,
  };
});

describe("metrics.sync", () => {
  it("stores the account's totals and every post's counts on the brand's local day", async () => {
    expect(await syncMetrics(deps)).toEqual({
      accounts: 1,
      posts: 2,
      linked: 0,
      covers: 2,
      failed: 0,
    });
    expect(db.saveAccountStats).toHaveBeenCalledWith(
      {},
      {
        brandId: "b1",
        network: "tiktok",
        capturedOn: "2026-09-30",
        stats: { followers: 1132, following: 5, likes: 9242, videos: 2 },
      },
    );
    expect(db.saveNetworkPostCounts).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        capturedOn: "2026-09-30",
        post: expect.objectContaining({
          externalId: "7691331151528545557",
          views: 82,
          kind: "photo",
        }),
      }),
    );
    expect(deps.saveMedia).toHaveBeenCalledWith(
      "metrics/tiktok/7691331151528545557.webp",
      expect.any(Uint8Array),
    );
    expect(db.setNetworkPostCover).toHaveBeenCalledWith(
      {},
      { id: "np-7691331151528545557", coverPath: "metrics/tiktok/7691331151528545557.webp" },
    );
  });

  it("downloads a cover only once, and a failed download doesn't stop the sync", async () => {
    db.saveNetworkPostCounts
      .mockResolvedValueOnce({ id: "np-1", coverPath: "metrics/tiktok/1.jpg", postId: null })
      .mockResolvedValueOnce({ id: "np-2", coverPath: null, postId: null });
    vi.mocked(deps.download as () => Promise<unknown>).mockRejectedValueOnce(new Error("403"));
    const outcome = await syncMetrics(deps);
    expect(outcome).toMatchObject({ posts: 2, covers: 0, failed: 0 });
    expect(deps.download).toHaveBeenCalledTimes(1);
  });

  it("links a draft the operator posted by the public id TikTok gives", async () => {
    db.listUnlinkedPublications.mockResolvedValue([
      {
        postId: "p7",
        code: "RA-0007",
        network: "tiktok",
        externalId: "pub-7",
        url: "https://vt.tiktok.com/ZS/",
      },
      { postId: "p8", code: "RA-0008", network: "tiktok", externalId: "pub-8", url: null },
    ]);
    api.fetchPostState
      .mockResolvedValueOnce({ kind: "inbox", postId: "7691331151528545557" })
      // Still a draft: no public id yet, asked again next time.
      .mockResolvedValueOnce({ kind: "inbox", postId: null });
    expect((await syncMetrics(deps)).linked).toBe(1);
    expect(api.fetchPostState).toHaveBeenCalledWith("act.X", "pub-7");
    expect(db.linkNetworkPost).toHaveBeenCalledTimes(1);
    expect(db.linkNetworkPost).toHaveBeenCalledWith(
      {},
      { network: "tiktok", externalId: "7691331151528545557", postId: "p7" },
    );
    // Spaced out for TikTok's status limit.
    expect(deps.sleep).toHaveBeenCalledTimes(1);
  });

  it("links a post marked published by hand with its TikTok link, without asking TikTok", async () => {
    db.listUnlinkedPublications.mockResolvedValue([
      {
        postId: "p1",
        code: "RA-0001",
        network: "manual",
        externalId: null,
        url: "https://www.tiktok.com/@radev906/photo/7678363808074648852",
      },
    ]);
    expect((await syncMetrics(deps)).linked).toBe(1);
    expect(api.fetchPostState).not.toHaveBeenCalled();
  });

  it("doesn't link to a post the account doesn't show", async () => {
    db.listUnlinkedPublications.mockResolvedValue([
      { postId: "p9", code: "RA-0009", network: "tiktok", externalId: "pub-9", url: null },
    ]);
    api.fetchPostState.mockResolvedValueOnce({ kind: "inbox", postId: "999" });
    expect((await syncMetrics(deps)).linked).toBe(0);
    expect(db.linkNetworkPost).not.toHaveBeenCalled();
  });

  it("skips the totals without user.info.stats, and the account without video.list", async () => {
    db.listActiveSocialAccounts.mockResolvedValue([
      { id: "a1", brandId: "b1", network: "tiktok", scopes: ["video.list"] },
      { id: "a2", brandId: "b1", network: "tiktok", scopes: ["user.info.basic"] },
    ]);
    expect(await syncMetrics(deps)).toMatchObject({ accounts: 1, posts: 2, failed: 0 });
    expect(api.fetchTiktokStats).not.toHaveBeenCalled();
    expect(api.listTiktokVideos).toHaveBeenCalledTimes(1);
  });

  it("goes on with the other accounts when one fails, then asks for a retry", async () => {
    db.listActiveSocialAccounts.mockResolvedValue([
      { id: "a1", brandId: "b1", network: "tiktok", scopes },
      { id: "a2", brandId: "b1", network: "tiktok", scopes },
    ]);
    api.fetchTiktokStats.mockRejectedValueOnce(new TikTokError("down", "internal_error", null));
    await expect(syncMetrics(deps)).rejects.toThrow("1 cuenta(s)");
    expect(api.listTiktokVideos).toHaveBeenCalledTimes(1);
  });

  it("does nothing without the app's keys", async () => {
    expect(await syncMetrics({ ...deps, client: null })).toMatchObject({ accounts: 0 });
    expect(db.listActiveSocialAccounts).not.toHaveBeenCalled();
  });
});
