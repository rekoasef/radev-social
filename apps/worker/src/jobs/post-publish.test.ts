import type { PublisherAdapter } from "@radev/publishers";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createLogger } from "../logger";
import { publishPost } from "./post-publish";

const start = vi.fn();
const account = vi.fn();
vi.mock("@radev/db", () => ({
  startScheduledPublishing: (...args: unknown[]) => start(...args),
  getPostById: async (_db: unknown, id: string) => ({ id, brandId: "b" }),
  getSocialAccount: (...args: unknown[]) => account(...args),
}));

const job = { postId: "p1", scheduledAt: "2026-09-28T22:00:00.000Z" };
const log = createLogger({}, "error");
const deps = (publisher?: PublisherAdapter) => ({ db: {} as never, log, publisher });
const started = {
  started: true,
  postId: "p1",
  publicCode: "LU-0001",
  brandId: "b",
  brandName: "Lumus",
  hook: "Tu plata",
  scheduledAt: new Date(job.scheduledAt),
};

describe("post.publish", () => {
  beforeEach(() => {
    start.mockReset();
    account.mockReset();
  });

  it("leaves a due post waiting for the operator (manual)", async () => {
    start.mockResolvedValue(started);
    const notify = vi.fn(async () => {});
    expect(await publishPost({ ...deps(), notify, appUrl: "https://app" }, job)).toBe("waiting");
    expect(start).toHaveBeenCalledWith({}, { job, network: "manual" });
    // The reminder, with sound even at night.
    expect(notify).toHaveBeenCalledWith(
      expect.objectContaining({ key: `publish:p1:${job.scheduledAt}`, kind: "publish" }),
      { urgent: true },
    );
  });

  it("does nothing for a stale job, without asking the adapter (rules 3 and 8)", async () => {
    start.mockResolvedValue({ started: false, reason: "stale" });
    const publish = vi.fn();
    expect(await publishPost(deps({ network: "manual", publish }), job)).toBe("stale");
    expect(publish).not.toHaveBeenCalled();
  });

  it("fails loudly if the adapter fails, so pg-boss retries", async () => {
    start.mockResolvedValue(started);
    const publisher: PublisherAdapter = {
      network: "manual",
      publish: async () => ({ status: "failed", error: "sin red" }),
    };
    await expect(publishPost(deps(publisher), job)).rejects.toThrow("sin red");
  });

  describe("a brand with TikTok connected (phase 5 T6)", () => {
    const tiktok = (status: string, scopes = ["user.info.basic", "video.upload"]) => ({
      id: "acc",
      status,
      scopes,
    });

    it("starts publishing on tiktok and hands the post to tiktok.publish", async () => {
      account.mockResolvedValue(tiktok("active"));
      start.mockResolvedValue(started);
      const queueTiktok = vi.fn(async () => {});
      const notify = vi.fn(async () => {});
      expect(await publishPost({ ...deps(), queueTiktok, notify }, job)).toBe("sent");
      expect(start).toHaveBeenCalledWith({}, { job, network: "tiktok" });
      expect(queueTiktok).toHaveBeenCalledWith("p1");
      // No "publish by hand" reminder: TikTok's own notice comes later.
      expect(notify).not.toHaveBeenCalled();
    });

    it("publishes by hand when the account needs connecting again or can't upload", async () => {
      for (const found of [
        tiktok("reauth_required"),
        tiktok("active", ["user.info.basic"]),
        undefined,
      ]) {
        account.mockResolvedValue(found);
        start.mockResolvedValue(started);
        const queueTiktok = vi.fn(async () => {});
        expect(await publishPost({ ...deps(), queueTiktok }, job)).toBe("waiting");
        expect(start).toHaveBeenLastCalledWith({}, { job, network: "manual" });
        expect(queueTiktok).not.toHaveBeenCalled();
      }
    });

    it("doesn't queue tiktok for a stale job (rules 3 and 8)", async () => {
      account.mockResolvedValue(tiktok("active"));
      start.mockResolvedValue({ started: false, reason: "stale" });
      const queueTiktok = vi.fn(async () => {});
      expect(await publishPost({ ...deps(), queueTiktok }, job)).toBe("stale");
      expect(queueTiktok).not.toHaveBeenCalled();
    });
  });
});
