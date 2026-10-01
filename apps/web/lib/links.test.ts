import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { normalizeLinkUrl, withRef } = await import("./links");

describe("normalizeLinkUrl", () => {
  it("accepts https links and adds the scheme when missing", () => {
    expect(normalizeLinkUrl("lumus.app/registro")).toEqual({
      ok: true,
      url: "https://lumus.app/registro",
    });
    expect(normalizeLinkUrl(" https://radev.com.ar ")).toEqual({
      ok: true,
      url: "https://radev.com.ar/",
    });
  });

  it("rejects http, bare words and junk", () => {
    expect(normalizeLinkUrl("http://radev.com.ar").ok).toBe(false);
    expect(normalizeLinkUrl("radev").ok).toBe(false);
    expect(normalizeLinkUrl("https://").ok).toBe(false);
    expect(normalizeLinkUrl(`https://a.com/${"x".repeat(600)}`).ok).toBe(false);
  });
});

describe("withRef", () => {
  it("adds the post's reference, keeping other parameters", () => {
    expect(withRef("https://lumus.app/registro?plan=free", "LU-0004")).toBe(
      "https://lumus.app/registro?plan=free&ref=LU-0004",
    );
    expect(withRef("https://lumus.app/?ref=old", "LU-0005")).toBe("https://lumus.app/?ref=LU-0005");
  });
});
