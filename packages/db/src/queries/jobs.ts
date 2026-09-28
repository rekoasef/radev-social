import type { IdeaRequestStatus, JobState, PostStatus } from "@radev/core";
import { eq, inArray, type SQL, sql } from "drizzle-orm";
import type { Database } from "../client";
import { brands, ideaRequests, notifications, posts, postVersions } from "../schema";

// The jobs view (phase 4, T8): read-only queries on pg-boss's own table. pg-boss owns the queue
// ("pgboss" schema, created by the worker); here it is only read, with a filter and a limit, and
// changes go through the pg-boss API (the web's lib/jobs.ts). pg-boss's internal queues
// ("__pgboss__…") stay out.

export type JobRow = {
  id: string;
  name: string;
  state: JobState;
  data: unknown;
  output: unknown;
  retryCount: number;
  retryLimit: number;
  startAfter: Date;
  createdOn: Date;
  startedOn: Date | null;
  completedOn: Date | null;
};

/** Most recent first, except pending jobs: the next one to run first. */
export function listJobs(
  db: Database,
  input: { states: readonly JobState[]; limit: number; since?: Date },
): Promise<JobRow[]> {
  const pending = input.states.every((state) => state === "created" || state === "retry");
  const since = input.since
    ? sql`and coalesce(completed_on, started_on, created_on) >= ${input.since.toISOString()}`
    : sql``;
  return listJobsWhere(
    db,
    sql`state::text in (${sql.join(
      input.states.map((state) => sql`${state}`),
      sql`, `,
    )}) ${since}`,
    pending ? sql`start_after asc` : sql`coalesce(completed_on, started_on, created_on) desc`,
    input.limit,
  );
}

async function listJobsWhere(
  db: Database,
  where: SQL,
  order: SQL,
  limit: number,
): Promise<JobRow[]> {
  const result = await db.execute<{
    id: string;
    name: string;
    state: JobState;
    data: unknown;
    output: unknown;
    retry_count: number;
    retry_limit: number;
    start_after: Date;
    created_on: Date;
    started_on: Date | null;
    completed_on: Date | null;
  }>(sql`
    select id, name, state, data, output, retry_count, retry_limit, start_after, created_on,
      started_on, completed_on
    from pgboss.job
    where name not like '\\_\\_pgboss%' and ${where}
    order by ${order}
    limit ${limit}
  `);
  return result.rows.map((row) => ({
    id: row.id,
    name: row.name,
    state: row.state,
    data: row.data,
    output: row.output,
    retryCount: row.retry_count,
    retryLimit: row.retry_limit,
    startAfter: new Date(row.start_after),
    createdOn: new Date(row.created_on),
    startedOn: row.started_on ? new Date(row.started_on) : null,
    completedOn: row.completed_on ? new Date(row.completed_on) : null,
  }));
}

/** One job by id (pg-boss ids are unique across queues). */
export async function getJob(db: Database, id: string): Promise<JobRow | undefined> {
  const [job] = await listJobsWhere(db, sql`id = ${id}`, sql`created_on desc`, 1);
  return job;
}

export type JobCounts = {
  /** Waiting to run now (or retrying). */
  waiting: number;
  /** Waiting for a time ahead (scheduled posts). */
  scheduled: number;
  active: number;
  /** Failed in the last 7 days. */
  failed: number;
  /** Done in the last 24 hours. */
  completed: number;
};

export async function countJobs(db: Database, now: Date): Promise<JobCounts> {
  const at = now.toISOString();
  const result = await db.execute<Record<keyof JobCounts, number>>(sql`
    select
      count(*) filter (where state in ('created', 'retry') and start_after <= ${at})::int as waiting,
      count(*) filter (where state in ('created', 'retry') and start_after > ${at})::int as scheduled,
      count(*) filter (where state = 'active')::int as active,
      count(*) filter (where state = 'failed'
        and coalesce(completed_on, created_on) >= ${at}::timestamptz - interval '7 days')::int as failed,
      count(*) filter (where state = 'completed'
        and completed_on >= ${at}::timestamptz - interval '24 hours')::int as completed
    from pgboss.job
    where name not like '\\_\\_pgboss%'
  `);
  const row = result.rows[0];
  return {
    waiting: row?.waiting ?? 0,
    scheduled: row?.scheduled ?? 0,
    active: row?.active ?? 0,
    failed: row?.failed ?? 0,
    completed: row?.completed ?? 0,
  };
}

export type JobPostTarget = {
  id: string;
  publicCode: string;
  status: PostStatus;
  currentVersionId: string | null;
  brandName: string;
};

export type JobTargets = {
  posts: Map<string, JobPostTarget>;
  /** Version id → its post. */
  versions: Map<string, JobPostTarget>;
  ideaRequests: Map<string, { status: IdeaRequestStatus; task: string; brandName: string }>;
  notifications: Map<string, { kind: string; sent: boolean }>;
};

/** What the listed jobs work on, in a few queries. Missing ones (deleted) are just not there. */
export async function loadJobTargets(
  db: Database,
  ids: { postIds: string[]; versionIds: string[]; requestIds: string[]; notificationIds: string[] },
): Promise<JobTargets> {
  const postColumns = {
    id: posts.id,
    publicCode: posts.publicCode,
    status: posts.status,
    currentVersionId: posts.currentVersionId,
    brandName: brands.name,
  };
  const [postRows, versionRows, requestRows, noticeRows] = await Promise.all([
    ids.postIds.length > 0
      ? db
          .select(postColumns)
          .from(posts)
          .innerJoin(brands, eq(brands.id, posts.brandId))
          .where(inArray(posts.id, ids.postIds))
      : [],
    ids.versionIds.length > 0
      ? db
          .select({ versionId: postVersions.id, ...postColumns })
          .from(postVersions)
          .innerJoin(posts, eq(posts.id, postVersions.postId))
          .innerJoin(brands, eq(brands.id, posts.brandId))
          .where(inArray(postVersions.id, ids.versionIds))
      : [],
    ids.requestIds.length > 0
      ? db
          .select({
            id: ideaRequests.id,
            status: ideaRequests.status,
            task: ideaRequests.task,
            brandName: brands.name,
          })
          .from(ideaRequests)
          .innerJoin(brands, eq(brands.id, ideaRequests.brandId))
          .where(inArray(ideaRequests.id, ids.requestIds))
      : [],
    ids.notificationIds.length > 0
      ? db
          .select({ id: notifications.id, kind: notifications.kind, sentAt: notifications.sentAt })
          .from(notifications)
          .where(inArray(notifications.id, ids.notificationIds))
      : [],
  ]);
  return {
    posts: new Map(postRows.map((row) => [row.id, row])),
    versions: new Map(versionRows.map(({ versionId, ...post }) => [versionId, post])),
    ideaRequests: new Map(requestRows.map(({ id, ...request }) => [id, request])),
    notifications: new Map(
      noticeRows.map(({ id, kind, sentAt }) => [id, { kind, sent: sentAt !== null }]),
    ),
  };
}
