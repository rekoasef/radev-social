import { and, eq, inArray } from "drizzle-orm";
import type { Database } from "../client";
import { type SlideRewrite, slideRewrites } from "../schema";

// Slide rewrites asked from the editor: the web creates them `queued`, the worker takes them
// (`running`) and leaves the proposal (`done`) or why not (`failed`). A job only takes a request
// that is still open (queued, or running when pg-boss retries it), so a repeated job finds a
// finished one and does nothing (rule 8).

export async function createSlideRewrite(
  db: Database,
  input: {
    brandId: string;
    postId: string | null;
    carousel: Record<string, unknown>;
    slideIndex: number;
    instruction: string;
  },
): Promise<SlideRewrite> {
  const [row] = await db.insert(slideRewrites).values(input).returning();
  if (!row) throw new Error("No se pudo guardar el pedido.");
  return row;
}

export async function getSlideRewrite(db: Database, id: string): Promise<SlideRewrite | undefined> {
  const [row] = await db.select().from(slideRewrites).where(eq(slideRewrites.id, id));
  return row;
}

/** Takes an open request for the worker; undefined when it is finished. */
export async function startSlideRewrite(
  db: Database,
  id: string,
): Promise<SlideRewrite | undefined> {
  const [row] = await db
    .update(slideRewrites)
    .set({ status: "running" })
    .where(and(eq(slideRewrites.id, id), inArray(slideRewrites.status, ["queued", "running"])))
    .returning();
  return row;
}

export async function finishSlideRewrite(
  db: Database,
  id: string,
  outcome: { result: Record<string, unknown> } | { error: string },
): Promise<void> {
  await db
    .update(slideRewrites)
    .set(
      "result" in outcome
        ? { status: "done", result: outcome.result, error: null, finishedAt: new Date() }
        : { status: "failed", error: outcome.error, finishedAt: new Date() },
    )
    .where(eq(slideRewrites.id, id));
}
