import type { IdeaRequestParams, IdeaRequestTask, IdeaSource } from "@radev/core";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import type { Database } from "../client";
import { type IdeaRequest, type IdeaSourceLink, ideaRequests, ideas } from "../schema";

// Requests for ideas to the AI (phase 3, T10). queued → running → succeeded | failed. The ideas
// of a request are stored in the same transaction that closes it, so a repeated job finds the
// request closed and adds nothing (CLAUDE.md, rule 8).

export type IdeaRequestResult =
  | { ok: true; request: IdeaRequest }
  | { ok: false; error: string; open: IdeaRequest };

/** A new request, unless the brand already has one of that task waiting or running. */
export async function createIdeaRequest(
  db: Database,
  input: { brandId: string; task: IdeaRequestTask; params: IdeaRequestParams },
): Promise<IdeaRequestResult> {
  return db.transaction(async (tx) => {
    // One request of a task per brand at a time, even with two clicks at once.
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtext(${`${input.brandId}:${input.task}`}))`,
    );
    const [open] = await tx
      .select()
      .from(ideaRequests)
      .where(
        and(
          eq(ideaRequests.brandId, input.brandId),
          eq(ideaRequests.task, input.task),
          inArray(ideaRequests.status, ["queued", "running"]),
        ),
      )
      .limit(1);
    if (open) return { ok: false, error: "Ya hay un pedido en curso.", open };
    const [request] = await tx.insert(ideaRequests).values(input).returning();
    if (!request) throw new Error("No se pudo crear el pedido.");
    return { ok: true, request };
  });
}

export async function getIdeaRequest(db: Database, id: string): Promise<IdeaRequest | undefined> {
  const [request] = await db.select().from(ideaRequests).where(eq(ideaRequests.id, id));
  return request;
}

/** The brand's latest requests, newest first. */
export function listIdeaRequests(db: Database, brandId: string, limit = 5) {
  return db
    .select()
    .from(ideaRequests)
    .where(eq(ideaRequests.brandId, brandId))
    .orderBy(desc(ideaRequests.createdAt))
    .limit(limit);
}

/**
 * Marks the request as running. Undefined when it is already closed: the job has nothing to do.
 * A running request is taken again (a retry after an error).
 */
export async function startIdeaRequest(db: Database, id: string): Promise<IdeaRequest | undefined> {
  const [request] = await db
    .update(ideaRequests)
    .set({ status: "running" })
    .where(and(eq(ideaRequests.id, id), inArray(ideaRequests.status, ["queued", "running"])))
    .returning();
  return request;
}

export type ProposedIdea = {
  title: string;
  angle: string;
  pillarId: string | null;
  seriesKey: string | null;
  source: IdeaSource;
  sources: IdeaSourceLink[];
};

/**
 * Stores the ideas and closes the request, in one transaction. Zero when the request was
 * already closed (nothing is stored).
 */
export async function completeIdeaRequest(
  db: Database,
  request: Pick<IdeaRequest, "id" | "brandId">,
  proposed: readonly ProposedIdea[],
): Promise<number> {
  return db.transaction(async (tx) => {
    const [closed] = await tx
      .update(ideaRequests)
      .set({ status: "succeeded", ideaCount: proposed.length, error: null, finishedAt: new Date() })
      .where(and(eq(ideaRequests.id, request.id), eq(ideaRequests.status, "running")))
      .returning({ id: ideaRequests.id });
    if (!closed) return 0;
    if (proposed.length > 0) {
      await tx
        .insert(ideas)
        .values(
          proposed.map((idea) => ({ ...idea, brandId: request.brandId, requestId: request.id })),
        );
    }
    return proposed.length;
  });
}

export async function failIdeaRequest(db: Database, id: string, error: string): Promise<void> {
  await db
    .update(ideaRequests)
    .set({ status: "failed", error, finishedAt: new Date() })
    .where(and(eq(ideaRequests.id, id), inArray(ideaRequests.status, ["queued", "running"])));
}

/** What the brand's bank already has, for the AI not to repeat it: newest first. */
export function listIdeaTitles(db: Database, brandId: string, limit = 80) {
  return db
    .select({ title: ideas.title, status: ideas.status, seriesKey: ideas.seriesKey })
    .from(ideas)
    .where(eq(ideas.brandId, brandId))
    .orderBy(desc(ideas.createdAt))
    .limit(limit);
}
