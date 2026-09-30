import type { Weekday } from "../scheduling/slots";
import { wallClock } from "../scheduling/zoned";

// Metrics (phase 6, docs/ARCHITECTURE.md §6 metrics.sync and ADR 0018): what each post did on the
// network and how the account grows, and the numbers the Métricas page shows. Pure: the worker
// fetches, the database stores, this reads.

/** Where a count came from: TikTok's API, a screenshot read by AI (RF-39) or typed by hand. */
export const METRIC_SOURCES = ["api", "screenshot", "manual"] as const;
export type MetricSource = (typeof METRIC_SOURCES)[number];

/** Every 4 h (in DATA_REFRESH_TZ): enough to follow a post's first day, few calls to TikTok. */
export const METRICS_SYNC_CRON = "20 */4 * * *";

/** Linking our posts to TikTok's asks for the status of the posts sent in the last days. */
export const METRICS_LINK_DAYS = 60;

/** The account's totals on a day (TikTok: user.info.stats). */
export type AccountStats = {
  followers: number;
  following: number;
  likes: number;
  videos: number;
};

export function isAccountStats(value: unknown): value is AccountStats {
  if (value === null || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return ["followers", "following", "likes", "videos"].every(
    (key) => typeof record[key] === "number" && Number.isFinite(record[key]),
  );
}

export type PostCounts = { views: number; likes: number; comments: number; shares: number };

/** Interactions per view (likes, comments and shares), 0–1; null without views. */
export function engagementRate(counts: PostCounts): number | null {
  if (counts.views <= 0) return null;
  return (counts.likes + counts.comments + counts.shares) / counts.views;
}

/** A post of the account as the page reads it: its latest counts and what we know of it. */
export type MetricsPost = PostCounts & {
  id: string;
  publishedAt: Date;
  /** Our post (RA-0007) when it came out of the system; null for the rest of the account. */
  code: string | null;
  pillar: string | null;
  hookType: string | null;
  /** The AI model that wrote it, when it did. */
  model: string | null;
};

export type MetricsSummary = PostCounts & {
  posts: number;
  engagement: number | null;
  /** Middle post's views: one viral post doesn't hide how the rest did. */
  medianViews: number | null;
  avgViews: number | null;
};

export function median(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? (sorted[mid] as number)
    : ((sorted[mid - 1] as number) + (sorted[mid] as number)) / 2;
}

export function summarize(posts: readonly PostCounts[]): MetricsSummary {
  const total = posts.reduce(
    (sum, post) => ({
      views: sum.views + post.views,
      likes: sum.likes + post.likes,
      comments: sum.comments + post.comments,
      shares: sum.shares + post.shares,
    }),
    { views: 0, likes: 0, comments: 0, shares: 0 },
  );
  return {
    ...total,
    posts: posts.length,
    engagement: engagementRate(total),
    medianViews: median(posts.map((post) => post.views)),
    avgViews: posts.length === 0 ? null : total.views / posts.length,
  };
}

export type MetricsGroup = MetricsSummary & { key: string };

/**
 * Posts grouped by a trait (pillar, hook type, model…), best median views first. Posts without the
 * trait are left out: the groups compare what the system made.
 */
export function groupPosts(
  posts: readonly MetricsPost[],
  keyOf: (post: MetricsPost) => string | null,
): MetricsGroup[] {
  const groups = new Map<string, MetricsPost[]>();
  for (const post of posts) {
    const key = keyOf(post);
    if (key === null) continue;
    groups.set(key, [...(groups.get(key) ?? []), post]);
  }
  return [...groups]
    .map(([key, list]) => ({ key, ...summarize(list) }))
    .sort((a, b) => (b.medianViews ?? 0) - (a.medianViews ?? 0) || b.posts - a.posts);
}

export type TimeBucket = { bucket: number; posts: number; medianViews: number | null };

/** Median views by the weekday the posts went out, in the brand's zone (0 = Sunday). */
export function byWeekday(posts: readonly MetricsPost[], timeZone: string): TimeBucket[] {
  return buckets(posts, 7, (post) => {
    const w = wallClock(post.publishedAt, timeZone);
    return new Date(Date.UTC(w.year, w.month - 1, w.day, 12)).getUTCDay() as Weekday;
  });
}

/** Median views by the hour the posts went out, in the brand's zone (0–23). */
export function byHour(posts: readonly MetricsPost[], timeZone: string): TimeBucket[] {
  return buckets(posts, 24, (post) => wallClock(post.publishedAt, timeZone).hour);
}

function buckets(
  posts: readonly MetricsPost[],
  size: number,
  bucketOf: (post: MetricsPost) => number,
): TimeBucket[] {
  const views: number[][] = Array.from({ length: size }, () => []);
  for (const post of posts) views[bucketOf(post)]?.push(post.views);
  return views.map((list, bucket) => ({ bucket, posts: list.length, medianViews: median(list) }));
}

/** The account's totals on a local day, as stored by metrics.sync. */
export type AccountDay = { day: string; stats: AccountStats };

export type AccountGrowth = {
  current: AccountStats | null;
  /** Change since the first day of the range; null with fewer than two days. */
  followersDelta: number | null;
  likesDelta: number | null;
};

export function accountGrowth(days: readonly AccountDay[]): AccountGrowth {
  const sorted = [...days].sort((a, b) => a.day.localeCompare(b.day));
  const first = sorted[0];
  const last = sorted.at(-1);
  if (!first || !last) return { current: null, followersDelta: null, likesDelta: null };
  const span = sorted.length > 1;
  return {
    current: last.stats,
    followersDelta: span ? last.stats.followers - first.stats.followers : null,
    likesDelta: span ? last.stats.likes - first.stats.likes : null,
  };
}

/** The ranges the page offers, in days back from today; `all` is the account's whole history. */
export const METRICS_RANGES = { "7": 7, "30": 30, "90": 90, all: null } as const;
export type MetricsRange = keyof typeof METRICS_RANGES;

export function isMetricsRange(value: unknown): value is MetricsRange {
  return typeof value === "string" && Object.hasOwn(METRICS_RANGES, value);
}
