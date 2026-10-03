import { TikTokError, type TikTokVideo } from "@radev/publishers";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createLogger } from "../logger";
import {
  confirmTiktokDrafts,
  type TiktokConfirmApi,
  type TiktokConfirmDeps,
} from "./tiktok-confirm";

const db = vi.hoisted(() => ({
  listTiktokInboxDrafts: vi.fn(),
  getSocialAccount: vi.fn(),
  settleTiktokPublication: vi.fn(),
  renewSocialAccountTokens: vi.fn(),
}));
vi.mock("@radev/db", () =>
  Object.fromEntries(
    Object.keys(db).map((name) => [
      name,
      (...a: unknown[]) => (db as Record<string, (...b: unknown[]) => unknown>)[name]?.(...a),
    ]),
  ),
);

const now = new Date("2026-10-03T15:00:00Z");
const TIKTOK_ID = "7691331151528545557";
const LINK = `https://www.tiktok.com/@radev906/photo/${TIKTOK_ID}`;

const draft = (code: string, over: Record<string, unknown> = {}) => ({
  postId: `post-${code}`,
  publicCode: code,
  brand: { id: "b1", name: "RAdev" },
  content: { hook: "Tu web" },
  publishId: `pub-${code}`,
  sentAt: new Date("2026-10-03T14:00:00Z"),
  ...over,
});

const video = (id: string): TikTokVideo => ({
  id,
  caption: "Caption",
  createdAt: new Date("2026-10-03T14:30:00Z"),
  url: `https://www.tiktok.com/@radev906/photo/${id}`,
  coverUrl: null,
  kind: "photo",
  views: 0,
  likes: 0,
  comments: 0,
  shares: 0,
});

let api: { [K in keyof TiktokConfirmApi]: ReturnType<typeof vi.fn> };
let deps: TiktokConfirmDeps;
let notify: ReturnType<typeof vi.fn<NonNullable<TiktokConfirmDeps["notify"]>>>;
let onFailed: ReturnType<typeof vi.fn<NonNullable<TiktokConfirmDeps["onFailed"]>>>;

beforeEach(() => {
  for (const fn of Object.values(db)) fn.mockReset();
  db.listTiktokInboxDrafts.mockResolvedValue([draft("RA-0008")]);
  db.getSocialAccount.mockResolvedValue({
    id: "a1",
    status: "active",
    scopes: ["video.list", "video.upload"],
  });
  db.settleTiktokPublication.mockResolvedValue(true);
  db.renewSocialAccountTokens.mockResolvedValue({
    tokens: { accessToken: "act.X", accessExpiresAt: new Date(now.getTime() + 3_600_000) },
  });
  api = {
    fetchPostState: vi.fn(async () => ({ kind: "inbox", postId: TIKTOK_ID })),
    listTiktokVideos: vi.fn(async () => [video(TIKTOK_ID), video("7678363808074648852")]),
    refreshTiktokToken: vi.fn(),
  };
  notify = vi.fn(async () => {});
  onFailed = vi.fn(async () => {});
  deps = {
    db: {} as never,
    log: createLogger({}, "error"),
    client: { clientKey: "k", clientSecret: "s" },
    notify,
    onFailed,
    appUrl: "https://app.gestorlumus.site",
    api: api as unknown as TiktokConfirmApi,
    sleep: vi.fn(async () => {}),
    now: () => now,
  };
});

describe("tiktok.confirm", () => {
  it("marks published a draft the operator posted, with its link and time, and says so", async () => {
    expect(await confirmTiktokDrafts(deps)).toEqual({
      drafts: 1,
      published: 1,
      givenUp: 0,
      failed: 0,
    });
    expect(api.fetchPostState).toHaveBeenCalledWith("act.X", "pub-RA-0008");
    expect(api.listTiktokVideos).toHaveBeenCalledWith("act.X", { maxPages: 1 });
    expect(db.settleTiktokPublication).toHaveBeenCalledWith(
      {},
      {
        postId: "post-RA-0008",
        outcome: { kind: "published", url: LINK, at: new Date("2026-10-03T14:30:00Z") },
      },
    );
    expect(notify).toHaveBeenCalledTimes(1);
    const notice = notify.mock.calls[0]?.[0];
    expect(notice?.key).toBe("tiktok-published:post-RA-0008");
    expect(notice?.text).toContain(LINK);
  });

  it("leaves a draft still in the inbox for the next run", async () => {
    api.fetchPostState.mockResolvedValue({ kind: "inbox", postId: null });
    expect((await confirmTiktokDrafts(deps)).published).toBe(0);
    expect(api.listTiktokVideos).not.toHaveBeenCalled();
    expect(db.settleTiktokPublication).not.toHaveBeenCalled();
    expect(notify).not.toHaveBeenCalled();
  });

  it("calls nobody when no draft is waiting", async () => {
    db.listTiktokInboxDrafts.mockResolvedValue([]);
    expect(await confirmTiktokDrafts(deps)).toEqual({
      drafts: 0,
      published: 0,
      givenUp: 0,
      failed: 0,
    });
    expect(db.getSocialAccount).not.toHaveBeenCalled();
    expect(api.fetchPostState).not.toHaveBeenCalled();
  });

  it("doesn't tell twice when the draft was already settled (rule 8)", async () => {
    db.settleTiktokPublication.mockResolvedValue(false);
    expect((await confirmTiktokDrafts(deps)).published).toBe(0);
    expect(notify).not.toHaveBeenCalled();
  });

  it("marks it published without a link when the post isn't among the latest", async () => {
    api.listTiktokVideos.mockResolvedValue([video("7678363808074648852")]);
    await confirmTiktokDrafts(deps);
    expect(db.settleTiktokPublication).toHaveBeenCalledWith(
      {},
      { postId: "post-RA-0008", outcome: { kind: "published", url: null, at: now } },
    );
  });

  it("doesn't read the posts list without video.list", async () => {
    db.getSocialAccount.mockResolvedValue({ id: "a1", status: "active", scopes: ["video.upload"] });
    await confirmTiktokDrafts(deps);
    expect(api.listTiktokVideos).not.toHaveBeenCalled();
    expect(db.settleTiktokPublication).toHaveBeenCalledWith(
      {},
      { postId: "post-RA-0008", outcome: { kind: "published", url: null, at: now } },
    );
  });

  it("reads the posts list once for several drafts, spacing the status calls", async () => {
    db.listTiktokInboxDrafts.mockResolvedValue([draft("RA-0008"), draft("RA-0009")]);
    api.fetchPostState
      .mockResolvedValueOnce({ kind: "inbox", postId: TIKTOK_ID })
      .mockResolvedValueOnce({ kind: "inbox", postId: "7678363808074648852" });
    expect((await confirmTiktokDrafts(deps)).published).toBe(2);
    expect(api.listTiktokVideos).toHaveBeenCalledTimes(1);
    expect(deps.sleep).toHaveBeenCalledTimes(1);
  });

  it("gives up a draft not posted in 7 days, without asking TikTok", async () => {
    db.listTiktokInboxDrafts.mockResolvedValue([
      draft("RA-0005", { sentAt: new Date("2026-09-26T14:00:00Z") }),
    ]);
    expect((await confirmTiktokDrafts(deps)).givenUp).toBe(1);
    expect(api.fetchPostState).not.toHaveBeenCalled();
    expect(db.settleTiktokPublication).toHaveBeenCalledWith(
      {},
      {
        postId: "post-RA-0005",
        outcome: { kind: "failed", error: expect.stringContaining("7 días") },
      },
    );
    expect(onFailed).toHaveBeenCalledWith({
      postId: "post-RA-0005",
      error: expect.stringContaining("marcalo a mano"),
    });
  });

  it("skips a brand whose account has to be reconnected", async () => {
    db.getSocialAccount.mockResolvedValue({ id: "a1", status: "reauth_required", scopes: [] });
    expect((await confirmTiktokDrafts(deps)).published).toBe(0);
    expect(api.fetchPostState).not.toHaveBeenCalled();
  });

  it("goes on with the other brands when TikTok fails for one", async () => {
    db.listTiktokInboxDrafts.mockResolvedValue([
      draft("RA-0008"),
      draft("LU-0003", { brand: { id: "b2", name: "Lumus" } }),
    ]);
    api.fetchPostState
      .mockRejectedValueOnce(new TikTokError("TikTok caído", "internal_error", null))
      .mockResolvedValueOnce({ kind: "inbox", postId: TIKTOK_ID });
    expect(await confirmTiktokDrafts(deps)).toEqual({
      drafts: 2,
      published: 1,
      givenUp: 0,
      failed: 1,
    });
  });

  it("does nothing without the app's keys", async () => {
    deps.client = null;
    expect((await confirmTiktokDrafts(deps)).published).toBe(0);
    expect(api.fetchPostState).not.toHaveBeenCalled();
  });
});
