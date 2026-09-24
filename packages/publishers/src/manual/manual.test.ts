import { describe, expect, it } from "vitest";
import { confirmManualPublication, manualPublisher } from "./manual";

const now = new Date("2026-09-24T18:00:00Z");

describe("manual publisher", () => {
  it("never publishes by itself: it waits for the operator", async () => {
    const result = await manualPublisher.publish({ postId: "p1", publicCode: "LU-0001" });
    expect(result).toMatchObject({ status: "pending", note: expect.stringContaining("LU-0001") });
    // Asking again gives the same answer (idempotent).
    expect(await manualPublisher.publish({ postId: "p1", publicCode: "LU-0001" })).toEqual(result);
  });

  it("confirms without a link", () => {
    expect(confirmManualPublication({ url: "  ", now })).toEqual({
      status: "published",
      url: null,
      publishedAt: now,
    });
    expect(confirmManualPublication({ now })).toMatchObject({ status: "published", url: null });
  });

  it("keeps an http(s) link", () => {
    const url = "https://www.tiktok.com/@lumus/photo/7420000000000000000";
    expect(confirmManualPublication({ url: ` ${url} `, now })).toEqual({
      status: "published",
      url,
      publishedAt: now,
    });
  });

  it("refuses anything that is not an http(s) address", () => {
    for (const url of [
      "tiktok",
      "javascript:alert(1)",
      "ftp://x.com/a",
      `https://x.com/${"a".repeat(600)}`,
    ]) {
      expect(confirmManualPublication({ url, now }).status).toBe("failed");
    }
  });
});
