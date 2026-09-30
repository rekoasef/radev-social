import { TikTokError } from "@radev/publishers";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createLogger } from "../logger";
import { publishToTiktok, type TiktokApi, type TiktokPublishDeps } from "./tiktok-publish";

const db = {
  getTiktokPublishContext: vi.fn(),
  getSocialAccount: vi.fn(),
  getSocialAccountTokens: vi.fn(),
  renewSocialAccountTokens: vi.fn(),
  updateSocialAccountTokens: vi.fn(),
  markSocialAccountReauth: vi.fn(),
  setTiktokPublishId: vi.fn(),
  settleTiktokPublication: vi.fn(),
  setAssetJpeg: vi.fn(),
  readMediaFile: vi.fn(),
  writeMediaFile: vi.fn(),
};
vi.mock("@radev/db", () => ({
  getTiktokPublishContext: (...a: unknown[]) => db.getTiktokPublishContext(...a),
  getSocialAccount: (...a: unknown[]) => db.getSocialAccount(...a),
  getSocialAccountTokens: (...a: unknown[]) => db.getSocialAccountTokens(...a),
  renewSocialAccountTokens: (...a: unknown[]) => db.renewSocialAccountTokens(...a),
  updateSocialAccountTokens: (...a: unknown[]) => db.updateSocialAccountTokens(...a),
  markSocialAccountReauth: (...a: unknown[]) => db.markSocialAccountReauth(...a),
  setTiktokPublishId: (...a: unknown[]) => db.setTiktokPublishId(...a),
  settleTiktokPublication: (...a: unknown[]) => db.settleTiktokPublication(...a),
  setAssetJpeg: (...a: unknown[]) => db.setAssetJpeg(...a),
  readMediaFile: (...a: unknown[]) => db.readMediaFile(...a),
  writeMediaFile: (...a: unknown[]) => db.writeMediaFile(...a),
}));

const now = new Date("2026-10-01T22:00:00Z");
const hours = (n: number) => new Date(now.getTime() + n * 3_600_000);

const context = (over: Record<string, unknown> = {}) => ({
  postId: "p1",
  publicCode: "RA-0007",
  status: "publishing",
  brand: { id: "b1", name: "RAdev", slug: "radev" },
  versionId: "v1",
  content: { hook: "Tu web", caption: "Texto", hashtags: ["web", "pymes"] },
  publication: { id: "pub", status: "pending", externalId: null },
  slides: [
    {
      assetId: "a0",
      index: 0,
      pngPath: "radev/p1/v1/4x5/0.png",
      jpegPath: "radev/p1/v1/4x5/0.jpg",
    },
    {
      assetId: "a1",
      index: 1,
      pngPath: "radev/p1/v1/4x5/1.png",
      jpegPath: "radev/p1/v1/4x5/1.jpg",
    },
  ],
  ...over,
});

const tokens = (accessExpiresAt = hours(12)) => ({
  account: { id: "acc" },
  tokens: {
    accessToken: "act.OLD",
    accessExpiresAt,
    refreshToken: "rft.OLD",
    refreshExpiresAt: hours(24 * 300),
  },
});

let api: { [K in keyof TiktokApi]: ReturnType<typeof vi.fn> };
let deps: TiktokPublishDeps;
const job = { postId: "p1" };

beforeEach(() => {
  for (const fn of Object.values(db)) fn.mockReset();
  db.settleTiktokPublication.mockResolvedValue(true);
  db.readMediaFile.mockResolvedValue(Buffer.from("png"));
  // Like the real one (which holds the row): renew only if due, and save what came back.
  db.renewSocialAccountTokens.mockImplementation(
    async (
      _db: unknown,
      id: string,
      due: (t: unknown) => boolean,
      renew: (r: string | null) => Promise<unknown>,
    ) => {
      const { tokens: stored } = await db.getSocialAccountTokens({}, id);
      if (!due(stored)) return { tokens: stored, renewed: false };
      const tokens = await renew(stored.refreshToken);
      await db.updateSocialAccountTokens({}, id, tokens);
      return { tokens, renewed: true };
    },
  );
  db.getTiktokPublishContext.mockResolvedValue(context());
  db.getSocialAccount.mockResolvedValue({ id: "acc", status: "active", scopes: ["video.upload"] });
  db.getSocialAccountTokens.mockResolvedValue(tokens());
  api = {
    initPhotoPost: vi.fn(async () => "pub-1"),
    fetchPostState: vi.fn(async () => ({ kind: "inbox" })),
    refreshTiktokToken: vi.fn(async () => ({
      openId: "o",
      accessToken: "act.NEW",
      accessExpiresAt: hours(24),
      refreshToken: "rft.NEW",
      refreshExpiresAt: hours(24 * 365),
      scopes: [],
    })),
  };
  deps = {
    db: {} as never,
    log: createLogger({}, "error"),
    client: { clientKey: "k", clientSecret: "s" },
    mediaBaseUrl: "https://media.gestorlumus.site/",
    jpegFromPng: vi.fn(async () => Buffer.from("jpeg")),
    notify: vi.fn(async () => {}),
    onFailed: vi.fn(async () => {}),
    appUrl: "https://app.gestorlumus.site",
    api: api as unknown as TiktokApi,
    sleep: vi.fn(async () => {}),
    now: () => now,
  };
});

describe("tiktok.publish", () => {
  it("sends the JPEGs as a draft, saves the publish id and tells when it's in the inbox", async () => {
    api.fetchPostState
      .mockResolvedValueOnce({ kind: "processing", status: "PROCESSING_DOWNLOAD" })
      .mockResolvedValueOnce({ kind: "inbox" });
    expect(await publishToTiktok(deps, job)).toBe("inbox");
    expect(api.initPhotoPost).toHaveBeenCalledWith("act.OLD", {
      photoUrls: [
        "https://media.gestorlumus.site/radev/p1/v1/4x5/0.jpg",
        "https://media.gestorlumus.site/radev/p1/v1/4x5/1.jpg",
      ],
      title: "Tu web",
      description: "Texto\n\n#web #pymes",
      mode: "MEDIA_UPLOAD",
    });
    expect(db.setTiktokPublishId).toHaveBeenCalledWith({}, { postId: "p1", publishId: "pub-1" });
    expect(db.settleTiktokPublication).toHaveBeenCalledWith(
      {},
      {
        postId: "p1",
        outcome: { kind: "inbox" },
      },
    );
    expect(deps.notify).toHaveBeenCalledWith(
      expect.objectContaining({ key: "tiktok-inbox:p1", kind: "publish" }),
      { urgent: true },
    );
    expect(deps.sleep).toHaveBeenCalledTimes(1);
  });

  it("follows a post already sent instead of sending it again (rule 8)", async () => {
    db.getTiktokPublishContext.mockResolvedValue(
      context({ publication: { id: "pub", status: "pending", externalId: "pub-9" } }),
    );
    expect(await publishToTiktok(deps, job)).toBe("inbox");
    expect(api.initPhotoPost).not.toHaveBeenCalled();
    expect(api.fetchPostState).toHaveBeenCalledWith("act.OLD", "pub-9");
  });

  it("does nothing if the post moved on or the publication is not pending", async () => {
    for (const over of [
      { status: "published" },
      { status: "publish_failed" },
      { publication: { id: "pub", status: "inbox", externalId: "pub-1" } },
      { publication: null },
    ]) {
      db.getTiktokPublishContext.mockResolvedValue(context(over));
      expect(await publishToTiktok(deps, job)).toBe("stale");
    }
    expect(api.initPhotoPost).not.toHaveBeenCalled();
    expect(db.settleTiktokPublication).not.toHaveBeenCalled();
  });

  it("makes the JPEG of a slide rendered before phase 5 T5", async () => {
    db.getTiktokPublishContext.mockResolvedValue(
      context({
        slides: [{ assetId: "a0", index: 0, pngPath: "radev/p1/v1/4x5/0.png", jpegPath: null }],
      }),
    );
    await publishToTiktok(deps, job);
    expect(deps.jpegFromPng).toHaveBeenCalledWith(Buffer.from("png"), {
      width: 1080,
      height: 1350,
    });
    expect(db.writeMediaFile).toHaveBeenCalledWith("radev/p1/v1/4x5/0.jpg", Buffer.from("jpeg"));
    expect(db.setAssetJpeg).toHaveBeenCalledWith(
      {},
      expect.objectContaining({ assetId: "a0", jpegPath: "radev/p1/v1/4x5/0.jpg" }),
    );
    expect(api.initPhotoPost.mock.calls[0]?.[1].photoUrls).toEqual([
      "https://media.gestorlumus.site/radev/p1/v1/4x5/0.jpg",
    ]);
  });

  it("refreshes a token about to expire and keeps the new ones (encrypted by the query)", async () => {
    db.getSocialAccountTokens.mockResolvedValue(tokens(new Date(now.getTime() + 60_000)));
    await publishToTiktok(deps, job);
    expect(api.refreshTiktokToken).toHaveBeenCalledWith(deps.client, "rft.OLD", { now });
    expect(db.updateSocialAccountTokens).toHaveBeenCalledWith(
      {},
      "acc",
      expect.objectContaining({ accessToken: "act.NEW", refreshToken: "rft.NEW" }),
    );
    expect(api.initPhotoPost.mock.calls[0]?.[0]).toBe("act.NEW");
  });

  it("refreshes once when TikTok rejects the access token, and tries again", async () => {
    api.initPhotoPost
      .mockRejectedValueOnce(new TikTokError("x", "access_token_invalid", null))
      .mockResolvedValueOnce("pub-2");
    expect(await publishToTiktok(deps, job)).toBe("inbox");
    expect(api.refreshTiktokToken).toHaveBeenCalledTimes(1);
    expect(api.initPhotoPost.mock.calls.map((call) => call[0])).toEqual(["act.OLD", "act.NEW"]);
  });

  it("asks to connect again when the refresh token is refused", async () => {
    db.getSocialAccountTokens.mockResolvedValue(tokens(new Date(now.getTime() - 1000)));
    api.refreshTiktokToken.mockRejectedValue(new TikTokError("x", "invalid_grant", null));
    expect(await publishToTiktok(deps, job)).toBe("failed");
    expect(db.markSocialAccountReauth).toHaveBeenCalledWith({}, "acc", "invalid_grant");
    expect(db.settleTiktokPublication).toHaveBeenCalledWith(
      {},
      {
        postId: "p1",
        outcome: { kind: "failed", error: expect.stringContaining("reconectala") },
      },
    );
    expect(deps.onFailed).toHaveBeenCalled();
  });

  it("fails the post for good when TikTok rejects it, without retrying", async () => {
    api.initPhotoPost.mockRejectedValue(new TikTokError("x", "url_ownership_unverified", null));
    expect(await publishToTiktok(deps, job)).toBe("failed");
    expect(db.markSocialAccountReauth).not.toHaveBeenCalled();
    expect(deps.onFailed).toHaveBeenCalledWith({ postId: "p1", error: "x" });
  });

  it("fails the post when TikTok can't pull the photos", async () => {
    api.fetchPostState.mockResolvedValue({
      kind: "failed",
      reason: "photo_pull_failed",
      retryable: false,
    });
    expect(await publishToTiktok(deps, job)).toBe("failed");
    expect(db.settleTiktokPublication).toHaveBeenCalledWith(
      {},
      {
        postId: "p1",
        outcome: { kind: "failed", error: expect.stringContaining("media.gestorlumus.site") },
      },
    );
  });

  it("throws (pg-boss retries) on TikTok's rate limit or outage", async () => {
    api.initPhotoPost.mockRejectedValue(new TikTokError("x", "rate_limit_exceeded", null));
    await expect(publishToTiktok(deps, job)).rejects.toThrow();
    expect(db.settleTiktokPublication).not.toHaveBeenCalled();
  });

  it("forgets the attempt and retries when TikTok fails on its side", async () => {
    api.fetchPostState.mockResolvedValue({ kind: "failed", reason: "internal", retryable: true });
    await expect(publishToTiktok(deps, job)).rejects.toThrow(/internal/);
    expect(db.setTiktokPublishId).toHaveBeenLastCalledWith({}, { postId: "p1", publishId: null });
  });

  it("throws to look again later while TikTok keeps processing", async () => {
    api.fetchPostState.mockResolvedValue({ kind: "processing", status: "PROCESSING_DOWNLOAD" });
    await expect(publishToTiktok(deps, job)).rejects.toThrow(/procesando/);
    expect(db.setTiktokPublishId).toHaveBeenCalledTimes(1); // the id stays for the retry
  });

  it("marks a post published when TikTok says so", async () => {
    api.fetchPostState.mockResolvedValue({ kind: "published", postId: "7123" });
    expect(await publishToTiktok(deps, job)).toBe("published");
    expect(db.settleTiktokPublication).toHaveBeenCalledWith(
      {},
      {
        postId: "p1",
        outcome: { kind: "published", url: null, at: now },
      },
    );
  });

  it("fails without calling TikTok if the account needs connecting again or keys are missing", async () => {
    db.getSocialAccount.mockResolvedValue({ id: "acc", status: "reauth_required", scopes: [] });
    expect(await publishToTiktok(deps, job)).toBe("failed");
    db.getSocialAccount.mockResolvedValue({ id: "acc", status: "active", scopes: [] });
    expect(await publishToTiktok({ ...deps, client: null }, job)).toBe("failed");
    expect(await publishToTiktok({ ...deps, mediaBaseUrl: null }, job)).toBe("failed");
    expect(api.initPhotoPost).not.toHaveBeenCalled();
  });
});
