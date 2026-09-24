import { getPostByCode, getPostVersion } from "@radev/db";
import { db } from "@/lib/db";
import { requireOperator } from "@/lib/session";

// What the post page polls while a render runs: the status and how far the worker got.

export async function GET(_request: Request, { params }: RouteContext<"/posts/[code]/status">) {
  await requireOperator();
  const post = await getPostByCode(db, (await params).code);
  if (!post) return Response.json({ error: "Ese post no existe." }, { status: 404 });
  const version = post.currentVersionId
    ? await getPostVersion(db, post.currentVersionId)
    : undefined;
  return Response.json(
    { status: post.status, progress: version?.renderProgress ?? null },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
