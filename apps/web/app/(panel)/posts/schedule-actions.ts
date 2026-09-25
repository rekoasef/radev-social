"use server";

import { zonedToUtc } from "@radev/core";
import { getBrandById, getPostByCode, schedulePost, unschedulePost } from "@radev/db";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { cancelPublish, queuePublish } from "@/lib/jobs";
import { requireOperator } from "@/lib/session";

// Scheduling a post (phase 4, T2): in one of the brand's free slots or at a time picked by hand,
// in the brand's zone (CLAUDE.md, rule 11).

export type ScheduleState =
  | { status: "idle" }
  | { status: "ok"; message: string }
  | { status: "error"; message: string };

const code = z.string().min(1).max(20);

const scheduleInput = z.discriminatedUnion("mode", [
  z.object({
    mode: z.literal("slot"),
    code,
    /** "<slot id>|<ISO instant>" of an offered slot time. */
    slot: z.string().regex(/^[0-9a-f-]{36}\|\d{4}-\d{2}-\d{2}T[\d:.]+Z$/),
  }),
  z.object({
    mode: z.literal("custom"),
    code,
    /** A datetime-local value, in the brand's zone. */
    localDateTime: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, {
      error: "Elegí una fecha y una hora.",
    }),
  }),
]);

export async function schedulePostAction(_: ScheduleState, form: FormData): Promise<ScheduleState> {
  await requireOperator();
  const parsed = scheduleInput.safeParse(Object.fromEntries(form));
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }
  const post = await getPostByCode(db, parsed.data.code);
  const brand = post && (await getBrandById(db, post.brandId));
  if (!post || !brand) return { status: "error", message: "Ese post ya no existe." };

  let at: Date;
  let slotId: string | null;
  if (parsed.data.mode === "slot") {
    const [id = "", iso = ""] = parsed.data.slot.split("|");
    at = new Date(iso);
    slotId = id;
  } else {
    const [date = "", time = ""] = parsed.data.localDateTime.split("T");
    const [year, month, day] = date.split("-").map(Number);
    const [hour, minute] = time.split(":").map(Number);
    at = zonedToUtc(
      {
        year: year ?? 0,
        month: month ?? 0,
        day: day ?? 0,
        hour: hour ?? 0,
        minute: minute ?? 0,
      },
      brand.timezone,
    );
    slotId = null;
  }

  const scheduled = await schedulePost(db, { postId: post.id, at, slotId, now: new Date() });
  if (!scheduled.ok) return { status: "error", message: scheduled.reason };
  // queuePublish cancels the job of the previous time first.
  if (scheduled.queue) await queuePublish(post.id, scheduled.at);
  revalidatePath("/posts");
  revalidatePath(`/posts/${post.publicCode}`);
  return { status: "ok", message: scheduled.wasScheduled ? "Reprogramado." : "Programado." };
}

export async function unschedulePostAction(form: FormData): Promise<void> {
  await requireOperator();
  const post = await getPostByCode(db, code.parse(form.get("code")));
  if (!post) return;
  const moved = await unschedulePost(db, post.id);
  if (!moved.ok) throw new Error(moved.reason);
  await cancelPublish(post.id);
  revalidatePath("/posts");
  revalidatePath(`/posts/${post.publicCode}`);
}
