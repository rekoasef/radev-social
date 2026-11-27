import type { VideoIdea, VideoIdeaMode } from "@radev/core";
import { and, desc, eq, gte, inArray, lt, sql } from "drizzle-orm";
import type { Database } from "../client";
import { type VideoIdeaRequest, videoIdeaRequests } from "../schema";

// Requests for topic ideas of a new video. queued → running → succeeded | failed. The answer is
// written by the same update that closes the request, so a repeated job changes nothing (rule 8).

const OPEN = ["queued", "running"] as const;
/** An open request older than this lost its job: it does not block the next one. */
const STALE_MS = 60 * 60_000;

export type CreateVideoIdeaRequestResult =
  | { ok: true; request: VideoIdeaRequest }
  | { ok: false; error: string };

/** A new request, unless one of that mode is already waiting or running. */
export async function createVideoIdeaRequest(
  db: Database,
  input: { mode: VideoIdeaMode; brandId: string | null; focus: string | null },
): Promise<CreateVideoIdeaRequestResult> {
  return db.transaction(async (tx) => {
    // Two clicks at once still make one request.
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`video-ideas:${input.mode}`}))`);
    await tx
      .update(videoIdeaRequests)
      .set({ status: "failed", error: "El pedido anterior no terminó.", finishedAt: new Date() })
      .where(
        and(
          inArray(videoIdeaRequests.status, [...OPEN]),
          lt(videoIdeaRequests.createdAt, new Date(Date.now() - STALE_MS)),
        ),
      );
    const [open] = await tx
      .select({ id: videoIdeaRequests.id })
      .from(videoIdeaRequests)
      .where(
        and(eq(videoIdeaRequests.mode, input.mode), inArray(videoIdeaRequests.status, [...OPEN])),
      )
      .limit(1);
    if (open) return { ok: false, error: "Ya hay un pedido en curso." };
    const [request] = await tx.insert(videoIdeaRequests).values(input).returning();
    if (!request) throw new Error("No se pudo crear el pedido.");
    return { ok: true, request };
  });
}

/** The latest requests, newest first. */
export function listVideoIdeaRequests(db: Database, limit = 20): Promise<VideoIdeaRequest[]> {
  return db
    .select()
    .from(videoIdeaRequests)
    .orderBy(desc(videoIdeaRequests.createdAt))
    .limit(limit);
}

/** Marks it as running. Undefined when it is already closed: the job has nothing to do. */
export async function startVideoIdeaRequest(
  db: Database,
  id: string,
): Promise<VideoIdeaRequest | undefined> {
  const [request] = await db
    .update(videoIdeaRequests)
    .set({ status: "running" })
    .where(and(eq(videoIdeaRequests.id, id), inArray(videoIdeaRequests.status, [...OPEN])))
    .returning();
  return request;
}

export type VideoIdeaUsage = {
  model: string | null;
  inputTokens: number;
  outputTokens: number;
  /** API-equivalent cost; null when the provider does not report it. */
  costUsd: number | null;
  durationMs: number | null;
};

/** Closes a running request, with its ideas or its error, and what it spent. */
export async function finishVideoIdeaRequest(
  db: Database,
  id: string,
  outcome: ({ ideas: VideoIdea[] } | { error: string }) & VideoIdeaUsage,
): Promise<void> {
  const { model, inputTokens, outputTokens, costUsd, durationMs } = outcome;
  await db
    .update(videoIdeaRequests)
    .set({
      ...("ideas" in outcome
        ? { status: "succeeded" as const, ideas: outcome.ideas, error: null }
        : { status: "failed" as const, error: outcome.error }),
      model,
      inputTokens,
      outputTokens,
      costUsd,
      durationMs,
      finishedAt: new Date(),
    })
    .where(and(eq(videoIdeaRequests.id, id), inArray(videoIdeaRequests.status, [...OPEN])));
}

/** A request the web could not queue: it must not stay open and block the next one. */
export async function failVideoIdeaRequest(db: Database, id: string, error: string): Promise<void> {
  await finishVideoIdeaRequest(db, id, {
    error,
    model: null,
    inputTokens: 0,
    outputTokens: 0,
    costUsd: null,
    durationMs: null,
  });
}

/** Tokens (and their API-equivalent cost) spent on ideas since a date, for the studio's daily total. */
export async function videoIdeaTokens(
  db: Pick<Database, "select">,
  since: Date,
): Promise<{ input: number; output: number; costUsd: number }> {
  const [total] = await db
    .select({
      input: sql<number>`coalesce(sum(${videoIdeaRequests.inputTokens}), 0)::int`,
      output: sql<number>`coalesce(sum(${videoIdeaRequests.outputTokens}), 0)::int`,
      costUsd: sql<number>`coalesce(sum(${videoIdeaRequests.costUsd}), 0)::float8`,
    })
    .from(videoIdeaRequests)
    .where(gte(videoIdeaRequests.createdAt, since));
  return { input: total?.input ?? 0, output: total?.output ?? 0, costUsd: total?.costUsd ?? 0 };
}
