import type { AccountDay, AccountStats, SocialNetwork } from "@radev/core";
import { isAccountStats } from "@radev/core";
import {
  and,
  asc,
  desc,
  eq,
  gte,
  inArray,
  isNotNull,
  isNull,
  max,
  notExists,
  sql,
} from "drizzle-orm";
import {
  audienceSnapshots,
  contentPillars,
  generationRuns,
  type NetworkPost,
  networkPosts,
  postMetrics,
  posts,
  postVersions,
  publications,
} from "../schema";
import type { Executor } from "./brand-assets";

// Metrics (phase 6, ADR 0018): what metrics.sync stores and what the Métricas page reads. Every
// write is an upsert keyed by post (or account), source and day, so running the sync twice never
// duplicates (rule 8).

/** The account's totals of a day (the latest read of the day wins). */
export async function saveAccountStats(
  db: Executor,
  input: { brandId: string; network: SocialNetwork; capturedOn: string; stats: AccountStats },
): Promise<void> {
  const data = { ...input.stats };
  await db
    .insert(audienceSnapshots)
    .values({
      brandId: input.brandId,
      network: input.network,
      capturedOn: input.capturedOn,
      data,
      source: "api",
    })
    .onConflictDoUpdate({
      target: [
        audienceSnapshots.brandId,
        audienceSnapshots.network,
        audienceSnapshots.source,
        audienceSnapshots.capturedOn,
      ],
      set: { data, capturedAt: sql`now()` },
    });
}

export type NetworkPostInput = {
  externalId: string;
  caption: string;
  url: string | null;
  kind: "photo" | "video";
  publishedAt: Date;
  views: number;
  likes: number;
  comments: number;
  shares: number;
};

/**
 * A post of the account with its counts today: updates (or adds) the post and its row of the day.
 * Returns the stored post, to download its cover or link it.
 */
export async function saveNetworkPostCounts(
  db: Executor,
  input: { brandId: string; network: SocialNetwork; capturedOn: string; post: NetworkPostInput },
): Promise<Pick<NetworkPost, "id" | "coverPath" | "postId">> {
  const { post } = input;
  const counts = {
    views: post.views,
    likes: post.likes,
    comments: post.comments,
    shares: post.shares,
  };
  const [row] = await db
    .insert(networkPosts)
    .values({
      brandId: input.brandId,
      network: input.network,
      externalId: post.externalId,
      caption: post.caption,
      url: post.url,
      kind: post.kind,
      publishedAt: post.publishedAt,
      ...counts,
    })
    .onConflictDoUpdate({
      target: [networkPosts.network, networkPosts.externalId],
      set: {
        brandId: input.brandId,
        caption: post.caption,
        url: post.url,
        kind: post.kind,
        ...counts,
        metricsAt: sql`now()`,
      },
    })
    .returning({
      id: networkPosts.id,
      coverPath: networkPosts.coverPath,
      postId: networkPosts.postId,
    });
  if (!row) throw new Error("No se pudo guardar el post de la red.");
  await db
    .insert(postMetrics)
    .values({ networkPostId: row.id, capturedOn: input.capturedOn, source: "api", ...counts })
    .onConflictDoUpdate({
      target: [postMetrics.networkPostId, postMetrics.source, postMetrics.capturedOn],
      set: { ...counts, capturedAt: sql`now()` },
    });
  return row;
}

export async function setNetworkPostCover(
  db: Executor,
  input: { id: string; coverPath: string },
): Promise<void> {
  await db
    .update(networkPosts)
    .set({ coverPath: input.coverPath })
    .where(eq(networkPosts.id, input.id));
}

/**
 * Our posts of a brand sent to the network (or published by hand) since a date that no network
 * post points to yet: metrics.sync asks TikTok which post each one became.
 */
export async function listUnlinkedPublications(
  db: Executor,
  input: { brandId: string; network: SocialNetwork; since: Date },
): Promise<
  { postId: string; code: string; network: string; externalId: string | null; url: string | null }[]
> {
  return db
    .select({
      postId: publications.postId,
      code: posts.publicCode,
      network: publications.network,
      externalId: publications.externalId,
      url: publications.url,
    })
    .from(publications)
    .innerJoin(posts, eq(posts.id, publications.postId))
    .where(
      and(
        eq(posts.brandId, input.brandId),
        // `manual`: the operator may have pasted the TikTok link when marking it published.
        inArray(publications.network, [input.network, "manual"]),
        inArray(publications.status, ["inbox", "published"]),
        gte(publications.createdAt, input.since),
        notExists(
          db
            .select({ id: networkPosts.id })
            .from(networkPosts)
            .where(
              and(
                eq(networkPosts.postId, publications.postId),
                eq(networkPosts.network, input.network),
              ),
            ),
        ),
      ),
    );
}

/**
 * Links a network post to our post. Only a network post not linked yet, and only when our post has
 * no other one: a repeated sync changes nothing. Returns whether it linked.
 */
export async function linkNetworkPost(
  db: Executor,
  input: { network: SocialNetwork; externalId: string; postId: string },
): Promise<boolean> {
  const linked = await db
    .update(networkPosts)
    .set({ postId: input.postId })
    .where(
      and(
        eq(networkPosts.network, input.network),
        eq(networkPosts.externalId, input.externalId),
        isNull(networkPosts.postId),
        notExists(
          db
            .select({ id: networkPosts.id })
            .from(networkPosts)
            .where(
              and(eq(networkPosts.postId, input.postId), eq(networkPosts.network, input.network)),
            ),
        ),
      ),
    )
    .returning({ id: networkPosts.id });
  return linked.length > 0;
}

/** A network post of the page: its latest counts and what we know of it when it's ours. */
export type MetricsPostRow = {
  id: string;
  externalId: string;
  caption: string;
  url: string | null;
  kind: string;
  coverPath: string | null;
  publishedAt: Date;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  postId: string | null;
  code: string | null;
  pillar: string | null;
  hookType: string | null;
  model: string | null;
};

/** The brand's network posts published since `from` (all without it), newest first. */
export async function listMetricsPosts(
  db: Executor,
  input: { brandId: string; network: SocialNetwork; from: Date | null },
): Promise<MetricsPostRow[]> {
  return db
    .select({
      id: networkPosts.id,
      externalId: networkPosts.externalId,
      caption: networkPosts.caption,
      url: networkPosts.url,
      kind: networkPosts.kind,
      coverPath: networkPosts.coverPath,
      publishedAt: networkPosts.publishedAt,
      views: networkPosts.views,
      likes: networkPosts.likes,
      comments: networkPosts.comments,
      shares: networkPosts.shares,
      postId: networkPosts.postId,
      code: posts.publicCode,
      pillar: contentPillars.name,
      hookType: posts.hookType,
      model: generationRuns.model,
    })
    .from(networkPosts)
    .leftJoin(posts, eq(posts.id, networkPosts.postId))
    .leftJoin(contentPillars, eq(contentPillars.id, posts.pillarId))
    .leftJoin(postVersions, eq(postVersions.id, posts.currentVersionId))
    .leftJoin(generationRuns, eq(generationRuns.id, postVersions.generationRunId))
    .where(
      and(
        eq(networkPosts.brandId, input.brandId),
        eq(networkPosts.network, input.network),
        input.from ? gte(networkPosts.publishedAt, input.from) : undefined,
      ),
    )
    .orderBy(desc(networkPosts.publishedAt));
}

/** The account's totals day by day since `fromDay` (all without it), oldest first. */
export async function listAccountDays(
  db: Executor,
  input: { brandId: string; network: SocialNetwork; fromDay: string | null },
): Promise<AccountDay[]> {
  const rows = await db
    .select({ day: audienceSnapshots.capturedOn, data: audienceSnapshots.data })
    .from(audienceSnapshots)
    .where(
      and(
        eq(audienceSnapshots.brandId, input.brandId),
        eq(audienceSnapshots.network, input.network),
        eq(audienceSnapshots.source, "api"),
        input.fromDay ? gte(audienceSnapshots.capturedOn, input.fromDay) : undefined,
      ),
    )
    .orderBy(asc(audienceSnapshots.capturedOn));
  return rows.flatMap((row) =>
    isAccountStats(row.data) ? [{ day: row.day, stats: row.data }] : [],
  );
}

/**
 * The views of all the brand's posts added up, day by day since `fromDay`: the difference between
 * two days is what the account got that day. Oldest first.
 */
export async function listViewTotals(
  db: Executor,
  input: { brandId: string; network: SocialNetwork; fromDay: string | null },
): Promise<{ day: string; views: number; likes: number; posts: number }[]> {
  const rows = await db
    .select({
      day: postMetrics.capturedOn,
      views: sql<number>`sum(${postMetrics.views})::int`,
      likes: sql<number>`sum(${postMetrics.likes})::int`,
      posts: sql<number>`count(*)::int`,
    })
    .from(postMetrics)
    .innerJoin(networkPosts, eq(networkPosts.id, postMetrics.networkPostId))
    .where(
      and(
        eq(networkPosts.brandId, input.brandId),
        eq(networkPosts.network, input.network),
        eq(postMetrics.source, "api"),
        input.fromDay ? gte(postMetrics.capturedOn, input.fromDay) : undefined,
      ),
    )
    .groupBy(postMetrics.capturedOn)
    .orderBy(asc(postMetrics.capturedOn));
  return rows;
}

/** When the brand's counts were last read; null before the first sync. */
export async function getLastMetricsAt(
  db: Executor,
  input: { brandId: string; network: SocialNetwork },
): Promise<Date | null> {
  const [row] = await db
    .select({ at: max(networkPosts.metricsAt) })
    .from(networkPosts)
    .where(and(eq(networkPosts.brandId, input.brandId), eq(networkPosts.network, input.network)));
  return row?.at ?? null;
}

/** Our post on the network, with its counts day by day: the post page shows them. */
export async function getPostNetworkMetrics(
  db: Executor,
  postId: string,
): Promise<{
  post: NetworkPost;
  days: { day: string; views: number; likes: number; comments: number; shares: number }[];
} | null> {
  const [post] = await db
    .select()
    .from(networkPosts)
    .where(and(eq(networkPosts.postId, postId), isNotNull(networkPosts.postId)))
    .limit(1);
  if (!post) return null;
  const days = await db
    .select({
      day: postMetrics.capturedOn,
      views: postMetrics.views,
      likes: postMetrics.likes,
      comments: postMetrics.comments,
      shares: postMetrics.shares,
    })
    .from(postMetrics)
    .where(and(eq(postMetrics.networkPostId, post.id), eq(postMetrics.source, "api")))
    .orderBy(asc(postMetrics.capturedOn));
  return { post, days };
}

/** Whether any metrics were read yet: the worker reads them on start when not. */
export async function hasNetworkPosts(db: Executor): Promise<boolean> {
  const [row] = await db.select({ id: networkPosts.id }).from(networkPosts).limit(1);
  return row !== undefined;
}
