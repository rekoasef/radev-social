"use server";

import { isMovable } from "@radev/core";
import { getPostByCode, schedulePost } from "@radev/db";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { queuePublish } from "@/lib/jobs";
import { requireOperator } from "@/lib/session";

// Moving a post on the calendar (phase 4, T3): onto a free slot time of its brand. Approved and
// scheduled posts are (re)scheduled; the ones still being written or reviewed only get the planned
// time (approving them schedules them).

export type MoveResult = { ok: true; message: string } | { ok: false; message: string };

const moveInput = z.object({
  code: z.string().min(1).max(20),
  slotId: z.uuid(),
  at: z.iso.datetime(),
});

export async function movePostAction(input: {
  code: string;
  slotId: string;
  at: string;
}): Promise<MoveResult> {
  await requireOperator();
  const parsed = moveInput.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Datos inválidos." };
  const post = await getPostByCode(db, parsed.data.code);
  if (!post) return { ok: false, message: "Ese post ya no existe." };
  if (!isMovable(post.status)) {
    return { ok: false, message: `${post.publicCode} ya no se puede mover.` };
  }
  const moved = await schedulePost(db, {
    postId: post.id,
    at: new Date(parsed.data.at),
    slotId: parsed.data.slotId,
    now: new Date(),
  });
  if (!moved.ok) return { ok: false, message: moved.reason };
  if (moved.queue) await queuePublish(post.id, moved.at);
  revalidatePath("/calendar");
  revalidatePath(`/posts/${post.publicCode}`);
  return {
    ok: true,
    message: moved.queue
      ? `${post.publicCode} ${moved.wasScheduled ? "reprogramado" : "programado"}.`
      : `${post.publicCode} planeado: se programa al aprobarlo.`,
  };
}
