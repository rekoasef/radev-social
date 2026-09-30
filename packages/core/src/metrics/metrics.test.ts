import { describe, expect, it } from "vitest";
import {
  accountGrowth,
  byHour,
  byWeekday,
  engagementRate,
  groupPosts,
  isAccountStats,
  isMetricsRange,
  type MetricsPost,
  median,
  summarize,
} from "./metrics";

const AR = "America/Argentina/Buenos_Aires";

const post = (over: Partial<MetricsPost> = {}): MetricsPost => ({
  id: "1",
  publishedAt: new Date("2026-09-30T14:05:00Z"), // Wednesday 11:05 in Buenos Aires
  code: null,
  pillar: null,
  hookType: null,
  model: null,
  views: 100,
  likes: 5,
  comments: 1,
  shares: 4,
  ...over,
});

describe("engagementRate", () => {
  it("is interactions per view", () => {
    expect(engagementRate({ views: 200, likes: 10, comments: 2, shares: 8 })).toBe(0.1);
  });

  it("is null without views", () => {
    expect(engagementRate({ views: 0, likes: 3, comments: 0, shares: 0 })).toBeNull();
  });
});

describe("median", () => {
  it("takes the middle, or the mean of the two middles", () => {
    expect(median([5, 1, 3])).toBe(3);
    expect(median([4, 1, 3, 2])).toBe(2.5);
    expect(median([])).toBeNull();
  });
});

describe("summarize", () => {
  it("adds counts and keeps a viral post from hiding the rest", () => {
    const summary = summarize([post({ views: 100 }), post({ views: 120 }), post({ views: 5000 })]);
    expect(summary).toMatchObject({ posts: 3, views: 5220, likes: 15, medianViews: 120 });
    expect(summary.avgViews).toBe(1740);
    expect(summary.engagement).toBeCloseTo(30 / 5220);
  });

  it("is empty without posts", () => {
    expect(summarize([])).toMatchObject({
      posts: 0,
      views: 0,
      engagement: null,
      medianViews: null,
      avgViews: null,
    });
  });
});

describe("groupPosts", () => {
  it("groups by a trait, best median first, leaving out posts without it", () => {
    const groups = groupPosts(
      [
        post({ pillar: "costos", views: 100 }),
        post({ pillar: "costos", views: 300 }),
        post({ pillar: "casos", views: 900 }),
        post({ pillar: null, views: 10_000 }),
      ],
      (p) => p.pillar,
    );
    expect(groups.map((g) => [g.key, g.posts, g.medianViews])).toEqual([
      ["casos", 1, 900],
      ["costos", 2, 200],
    ]);
  });
});

describe("byWeekday and byHour", () => {
  it("buckets in the brand's zone, not UTC", () => {
    // 01:30 UTC Thursday is 22:30 Wednesday in Buenos Aires.
    const late = post({ publishedAt: new Date("2026-10-01T01:30:00Z"), views: 40 });
    const days = byWeekday([post(), late], AR);
    expect(days).toHaveLength(7);
    expect(days[3]).toEqual({ bucket: 3, posts: 2, medianViews: 70 });
    expect(days[4]?.posts).toBe(0);

    const hours = byHour([post(), late], AR);
    expect(hours).toHaveLength(24);
    expect(hours[11]).toEqual({ bucket: 11, posts: 1, medianViews: 100 });
    expect(hours[22]).toEqual({ bucket: 22, posts: 1, medianViews: 40 });
  });
});

describe("accountGrowth", () => {
  const stats = (followers: number, likes: number) => ({
    followers,
    following: 5,
    likes,
    videos: 62,
  });

  it("compares the last day with the first, in date order", () => {
    expect(
      accountGrowth([
        { day: "2026-10-02", stats: stats(1140, 9300) },
        { day: "2026-09-30", stats: stats(1132, 9242) },
      ]),
    ).toEqual({ current: stats(1140, 9300), followersDelta: 8, likesDelta: 58 });
  });

  it("has no change with one day, and nothing without days", () => {
    expect(accountGrowth([{ day: "2026-09-30", stats: stats(1, 2) }])).toEqual({
      current: stats(1, 2),
      followersDelta: null,
      likesDelta: null,
    });
    expect(accountGrowth([]).current).toBeNull();
  });
});

describe("guards", () => {
  it("checks stored account stats", () => {
    expect(isAccountStats({ followers: 1, following: 1, likes: 2, videos: 2 })).toBe(true);
    expect(isAccountStats({ followers: "1", following: 1, likes: 2, videos: 2 })).toBe(false);
    expect(isAccountStats(null)).toBe(false);
  });

  it("knows the ranges", () => {
    expect(isMetricsRange("30")).toBe(true);
    expect(isMetricsRange("all")).toBe(true);
    expect(isMetricsRange("365")).toBe(false);
  });
});
