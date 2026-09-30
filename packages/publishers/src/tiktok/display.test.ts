import { describe, expect, it, vi } from "vitest";
import { cleanShareUrl, fetchTiktokStats, listTiktokVideos, tiktokIdFromUrl } from "./display";
import { TikTokError } from "./oauth";

const ok = { code: "ok", message: "", log_id: "L0" };

function answers(...bodies: unknown[]) {
  const queue = [...bodies];
  return vi.fn(
    async (_url: string | URL | Request, _init?: RequestInit) =>
      new Response(JSON.stringify(queue.shift()), { status: 200 }),
  );
}

// Shaped like the sandbox answered on 2026-09-30 (RAdev and Lumus).
const video = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  create_time: 1790777586,
  title: "Caption",
  video_description: "Caption",
  duration: 0,
  view_count: 82,
  like_count: 1,
  comment_count: 0,
  share_count: 0,
  share_url: `https://www.tiktok.com/@radev906/video/${id}?utm_campaign=tt4d_open_api&utm_source=x`,
  ...extra,
});

describe("fetchTiktokStats", () => {
  it("asks for the counts and maps them", async () => {
    const fetchImpl = answers({
      data: {
        user: { follower_count: 1132, following_count: 5, likes_count: 9242, video_count: 62 },
      },
      error: ok,
    });
    expect(await fetchTiktokStats("act.X", { fetchImpl })).toEqual({
      followers: 1132,
      following: 5,
      likes: 9242,
      videos: 62,
    });
    const [url, init] = fetchImpl.mock.calls[0] ?? [];
    expect(String(url)).toContain("https://open.tiktokapis.com/v2/user/info/?fields=");
    expect(init?.method).toBe("GET");
    expect(new Headers(init?.headers).get("authorization")).toBe("Bearer act.X");
  });

  it("fails with TikTok's code when the scope is missing", async () => {
    const fetchImpl = answers({
      data: {},
      error: { code: "scope_not_authorized", message: "no", log_id: "L1" },
    });
    const error = await fetchTiktokStats("t", { fetchImpl }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(TikTokError);
    expect((error as TikTokError).code).toBe("scope_not_authorized");
  });
});

describe("listTiktokVideos", () => {
  it("pages with the cursor until has_more ends", async () => {
    const fetchImpl = answers(
      { data: { videos: [video("7691331151528545557")], cursor: 111, has_more: true }, error: ok },
      { data: { videos: [video("7678363808074648852")], cursor: 222, has_more: false }, error: ok },
    );
    const videos = await listTiktokVideos("t", { fetchImpl });
    expect(videos.map((v) => v.id)).toEqual(["7691331151528545557", "7678363808074648852"]);
    expect(JSON.parse(String(fetchImpl.mock.calls[0]?.[1]?.body))).toEqual({ max_count: 20 });
    expect(JSON.parse(String(fetchImpl.mock.calls[1]?.[1]?.body))).toEqual({
      max_count: 20,
      cursor: 111,
    });
  });

  it("maps a photo post: exact id, date, clean link, counts", async () => {
    const fetchImpl = answers({
      data: { videos: [video("7691331151528545557")], has_more: false },
      error: ok,
    });
    const [first] = await listTiktokVideos("t", { fetchImpl });
    expect(first).toEqual({
      id: "7691331151528545557",
      caption: "Caption",
      createdAt: new Date(1790777586 * 1000),
      url: "https://www.tiktok.com/@radev906/video/7691331151528545557",
      coverUrl: null,
      kind: "photo",
      views: 82,
      likes: 1,
      comments: 0,
      shares: 0,
    });
  });

  it("skips a malformed post and stops on a repeated cursor", async () => {
    const fetchImpl = answers(
      { data: { videos: [{ id: 123 }, video("1")], cursor: 5, has_more: true }, error: ok },
      { data: { videos: [video("2", { duration: 14 })], cursor: 5, has_more: true }, error: ok },
    );
    const videos = await listTiktokVideos("t", { fetchImpl });
    expect(videos.map((v) => [v.id, v.kind])).toEqual([
      ["1", "photo"],
      ["2", "video"],
    ]);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });
});

describe("links", () => {
  it("drops TikTok's tracking parameters", () => {
    expect(cleanShareUrl("https://www.tiktok.com/@a/video/1?utm_source=x#y")).toBe(
      "https://www.tiktok.com/@a/video/1",
    );
  });

  it("reads the id of a pasted link; short links have none", () => {
    expect(tiktokIdFromUrl("https://www.tiktok.com/@gestor.lumus/photo/7690759066334809364")).toBe(
      "7690759066334809364",
    );
    expect(tiktokIdFromUrl("https://www.tiktok.com/@radev906/video/123?lang=es")).toBe("123");
    expect(tiktokIdFromUrl("https://vt.tiktok.com/ZSbAnn3mJ/")).toBeNull();
    expect(tiktokIdFromUrl(null)).toBeNull();
  });
});
