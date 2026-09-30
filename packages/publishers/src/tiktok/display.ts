import { z } from "zod";
import { type Fetch, tiktokCall } from "./http";
import { TikTokError } from "./oauth";

// Display API: the account's numbers and its posts' metrics (phase 6, docs/ARCHITECTURE.md §6
// metrics.sync). developers.tiktok.com/doc/tiktok-api-v2-get-user-info and
// /doc/tiktok-api-v2-video-list, checked on 2026-09-30 against the sandbox: photo carousels come
// in the list too (duration 0), with the same counts as videos. Scopes: user.info.stats and
// video.list. No saves, profile visits or audience: those come from screenshots (RF-39).

const USER_INFO_URL = "https://open.tiktokapis.com/v2/user/info/";
const VIDEO_LIST_URL = "https://open.tiktokapis.com/v2/video/list/";

/** TikTok's page size limit for video.list. */
const PAGE_SIZE = 20;
/** 50 pages = 1000 posts: far above any brand here, and a stop if the cursor never ends. */
const MAX_PAGES = 50;

const count = z.number().int().nonnegative().catch(0);

const userInfoResponse = z.object({
  data: z.object({
    user: z.object({
      follower_count: count,
      following_count: count,
      likes_count: count,
      video_count: count,
    }),
  }),
});

export type TikTokAccountStats = {
  followers: number;
  following: number;
  likes: number;
  videos: number;
};

/** The account's totals today (user.info.stats). */
export async function fetchTiktokStats(
  accessToken: string,
  { fetchImpl = fetch }: { fetchImpl?: Fetch } = {},
): Promise<TikTokAccountStats> {
  const fields = "follower_count,following_count,likes_count,video_count";
  const { data } = await tiktokCall(
    `${USER_INFO_URL}?fields=${fields}`,
    accessToken,
    undefined,
    fetchImpl,
  );
  const parsed = userInfoResponse.safeParse(data);
  if (!parsed.success) {
    throw new TikTokError(
      "TikTok respondió los datos de la cuenta con un formato inesperado.",
      null,
      null,
    );
  }
  const user = parsed.data.data.user;
  return {
    followers: user.follower_count,
    following: user.following_count,
    likes: user.likes_count,
    videos: user.video_count,
  };
}

const videoSchema = z.object({
  // A string in the answer; a number would already be rounded (see postIdsFrom).
  id: z.string().regex(/^\d+$/),
  create_time: z.number().int(),
  title: z.string().catch(""),
  video_description: z.string().catch(""),
  share_url: z.string().url().optional().catch(undefined),
  cover_image_url: z.string().url().optional().catch(undefined),
  duration: z.number().catch(0),
  view_count: count,
  like_count: count,
  comment_count: count,
  share_count: count,
});

const videoListResponse = z.object({
  data: z.object({
    videos: z.array(z.unknown()).catch([]),
    cursor: z.number().optional(),
    has_more: z.boolean().catch(false),
  }),
});

export type TikTokVideo = {
  id: string;
  /** The post's text (for photo posts TikTok puts the whole description in both fields). */
  caption: string;
  createdAt: Date;
  /** Link to the post, without TikTok's tracking parameters. */
  url: string | null;
  /** Signed CDN link that expires in hours: download it, don't store it. */
  coverUrl: string | null;
  /** Photo carousel (TikTok reports no duration) or video. */
  kind: "photo" | "video";
  views: number;
  likes: number;
  comments: number;
  shares: number;
};

/** Every post of the account, newest first, with its counts today (video.list). */
export async function listTiktokVideos(
  accessToken: string,
  { fetchImpl = fetch, maxPages = MAX_PAGES }: { fetchImpl?: Fetch; maxPages?: number } = {},
): Promise<TikTokVideo[]> {
  const fields = [
    "id",
    "create_time",
    "title",
    "video_description",
    "share_url",
    "cover_image_url",
    "duration",
    "view_count",
    "like_count",
    "comment_count",
    "share_count",
  ].join(",");
  const videos: TikTokVideo[] = [];
  let cursor: number | undefined;
  for (let page = 0; page < maxPages; page++) {
    const { data } = await tiktokCall(
      `${VIDEO_LIST_URL}?fields=${fields}`,
      accessToken,
      cursor === undefined ? { max_count: PAGE_SIZE } : { max_count: PAGE_SIZE, cursor },
      fetchImpl,
    );
    const parsed = videoListResponse.safeParse(data);
    if (!parsed.success) {
      throw new TikTokError(
        "TikTok respondió la lista de posts con un formato inesperado.",
        null,
        null,
      );
    }
    for (const raw of parsed.data.data.videos) {
      const video = videoSchema.safeParse(raw);
      // One odd post doesn't stop the rest.
      if (video.success) videos.push(toVideo(video.data));
    }
    const next = parsed.data.data.cursor;
    if (!parsed.data.data.has_more || next === undefined || next === cursor) break;
    cursor = next;
  }
  return videos;
}

function toVideo(raw: z.infer<typeof videoSchema>): TikTokVideo {
  return {
    id: raw.id,
    caption: (raw.video_description || raw.title).trim(),
    createdAt: new Date(raw.create_time * 1000),
    url: raw.share_url ? cleanShareUrl(raw.share_url) : null,
    coverUrl: raw.cover_image_url ?? null,
    kind: raw.duration > 0 ? "video" : "photo",
    views: raw.view_count,
    likes: raw.like_count,
    comments: raw.comment_count,
    shares: raw.share_count,
  };
}

/** TikTok's share links carry utm parameters of the app: the post's link is the rest. */
export function cleanShareUrl(url: string): string {
  const parsed = new URL(url);
  parsed.search = "";
  parsed.hash = "";
  return parsed.toString();
}

/**
 * A post's id from a TikTok link the operator pasted (…/video/<id> or …/photo/<id>). Short
 * links (vt.tiktok.com) carry no id: null.
 */
export function tiktokIdFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  return /tiktok\.com\/@[^/]+\/(?:video|photo)\/(\d+)/.exec(url)?.[1] ?? null;
}
