import { describe, expect, it, vi } from "vitest";
import { TikTokError } from "./oauth";
import {
  fetchPostState,
  fitUtf16,
  initPhotoPost,
  isTiktokAuthError,
  isTiktokPermanentError,
  TIKTOK_DESCRIPTION_MAX,
  TIKTOK_TITLE_MAX,
} from "./posting";

function fakeFetch(status: number, body: unknown) {
  return vi.fn(
    async (_url: string | URL | Request, _init?: RequestInit) =>
      new Response(typeof body === "string" ? body : JSON.stringify(body), { status }),
  );
}

const ok = { code: "ok", message: "", log_id: "L0" };
const photos = ["https://media.example/a/0.jpg", "https://media.example/a/1.jpg"];

describe("fitUtf16", () => {
  it("leaves short text alone and cuts long text", () => {
    expect(fitUtf16("hola", 10)).toBe("hola");
    expect(fitUtf16("abcdef", 3)).toBe("abc");
  });

  it("never splits an emoji", () => {
    const text = `ab${"🚀"}`; // 🚀 takes 2 UTF-16 units
    expect(fitUtf16(text, 3)).toBe("ab");
  });

  it("trims the space left at the cut", () => {
    expect(fitUtf16("una frase larga", 4)).toBe("una");
  });
});

describe("initPhotoPost", () => {
  it("sends a MEDIA_UPLOAD photo post pulled from the URLs, cover first", async () => {
    const fetchImpl = fakeFetch(200, { data: { publish_id: "pub-1" }, error: ok });
    const id = await initPhotoPost(
      "act.X",
      { photoUrls: photos, title: "Título", description: "Desc", mode: "MEDIA_UPLOAD" },
      { fetchImpl },
    );
    expect(id).toBe("pub-1");
    const [url, init] = fetchImpl.mock.calls[0] ?? [];
    expect(url).toBe("https://open.tiktokapis.com/v2/post/publish/content/init/");
    expect(new Headers(init?.headers).get("Authorization")).toBe("Bearer act.X");
    expect(JSON.parse(String(init?.body))).toEqual({
      media_type: "PHOTO",
      post_mode: "MEDIA_UPLOAD",
      post_info: { title: "Título", description: "Desc" },
      source_info: { source: "PULL_FROM_URL", photo_images: photos, photo_cover_index: 0 },
    });
  });

  it("fits title and description to TikTok's limits", async () => {
    const fetchImpl = fakeFetch(200, { data: { publish_id: "p" }, error: ok });
    await initPhotoPost(
      "t",
      {
        photoUrls: photos,
        title: "t".repeat(200),
        description: "d".repeat(5000),
        mode: "MEDIA_UPLOAD",
      },
      { fetchImpl },
    );
    const body = JSON.parse(String(fetchImpl.mock.calls[0]?.[1]?.body));
    expect(body.post_info.title).toHaveLength(TIKTOK_TITLE_MAX);
    expect(body.post_info.description).toHaveLength(TIKTOK_DESCRIPTION_MAX);
  });

  it("refuses no photos or more than 35 without calling TikTok", async () => {
    const fetchImpl = fakeFetch(200, {});
    const input = { title: "", description: "", mode: "MEDIA_UPLOAD" as const };
    await expect(initPhotoPost("t", { ...input, photoUrls: [] }, { fetchImpl })).rejects.toThrow();
    await expect(
      initPhotoPost("t", { ...input, photoUrls: Array(36).fill(photos[0]) }, { fetchImpl }),
    ).rejects.toThrow(/35/);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("turns TikTok's error into a TikTokError with its code", async () => {
    const fetchImpl = fakeFetch(403, {
      error: { code: "url_ownership_unverified", message: "Verify the domain", log_id: "L9" },
    });
    const error = await initPhotoPost(
      "t",
      { photoUrls: photos, title: "", description: "", mode: "MEDIA_UPLOAD" },
      { fetchImpl },
    ).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(TikTokError);
    expect(error).toMatchObject({ code: "url_ownership_unverified", logId: "L9" });
    expect(isTiktokPermanentError(error)).toBe(true);
  });

  it("fails on a 5xx without a JSON body (retryable)", async () => {
    const fetchImpl = fakeFetch(503, "<html>down</html>");
    const error = await initPhotoPost(
      "t",
      { photoUrls: photos, title: "", description: "", mode: "MEDIA_UPLOAD" },
      { fetchImpl },
    ).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(TikTokError);
    expect(isTiktokPermanentError(error)).toBe(false);
  });
});

describe("fetchPostState", () => {
  const state = async (data: unknown) =>
    fetchPostState("act.X", "pub-1", { fetchImpl: fakeFetch(200, { data, error: ok }) });

  it("asks by publish id", async () => {
    const fetchImpl = fakeFetch(200, { data: { status: "PROCESSING_DOWNLOAD" }, error: ok });
    await fetchPostState("act.X", "pub-1", { fetchImpl });
    const [url, init] = fetchImpl.mock.calls[0] ?? [];
    expect(url).toBe("https://open.tiktokapis.com/v2/post/publish/status/fetch/");
    expect(JSON.parse(String(init?.body))).toEqual({ publish_id: "pub-1" });
  });

  it("maps TikTok's statuses", async () => {
    expect(await state({ status: "PROCESSING_DOWNLOAD" })).toEqual({
      kind: "processing",
      status: "PROCESSING_DOWNLOAD",
    });
    expect(await state({ status: "SEND_TO_USER_INBOX" })).toEqual({ kind: "inbox" });
    expect(
      await state({ status: "PUBLISH_COMPLETE", publicaly_available_post_id: [7123456789] }),
    ).toEqual({ kind: "published", postId: "7123456789" });
    expect(await state({ status: "PUBLISH_COMPLETE" })).toEqual({
      kind: "published",
      postId: null,
    });
    expect(await state({ status: "FAILED", fail_reason: "photo_pull_failed" })).toEqual({
      kind: "failed",
      reason: "photo_pull_failed",
      retryable: false,
    });
    expect(await state({ status: "FAILED", fail_reason: "internal" })).toEqual({
      kind: "failed",
      reason: "internal",
      retryable: true,
    });
  });
});

describe("error classes", () => {
  const err = (code: string | null) => new TikTokError("x", code, null);

  it("auth errors mean connecting again", () => {
    for (const code of ["access_token_invalid", "scope_not_authorized", "invalid_grant"]) {
      expect(isTiktokAuthError(err(code))).toBe(true);
      expect(isTiktokPermanentError(err(code))).toBe(true);
    }
  });

  it("rate limit, TikTok's own errors and plain errors are retried", () => {
    for (const error of [
      err("rate_limit_exceeded"),
      err("internal_error"),
      err(null),
      new Error("fetch failed"),
    ]) {
      expect(isTiktokAuthError(error)).toBe(false);
      expect(isTiktokPermanentError(error)).toBe(false);
    }
  });

  it("limits and rejected content need the operator", () => {
    for (const code of [
      "spam_risk_too_many_pending_share",
      "invalid_param",
      "reached_active_user_cap",
    ]) {
      expect(isTiktokPermanentError(err(code))).toBe(true);
      expect(isTiktokAuthError(err(code))).toBe(false);
    }
  });
});
