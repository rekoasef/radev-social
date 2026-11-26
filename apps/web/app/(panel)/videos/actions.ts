"use server";

import { isWorkingStage, type WorkingStage } from "@radev/core";
import {
  createVideo,
  getBrandById,
  getVideo,
  getVoiceById,
  resumeVideoById,
  retryVideoById,
  transitionVideo,
} from "@radev/db";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { queueVideoOffice } from "@/lib/jobs";
import { requireOperator } from "@/lib/session";
import { newVideoSchema } from "@/lib/video-form";

// The web only changes the stage (through `transitionVideo`) and queues the office's job: the
// video-worker does the work (rule 5).

export type VideoActionState = { status: "idle" } | { status: "error"; message: string };

const error = (message: string): VideoActionState => ({ status: "error", message });

export async function createVideoAction(
  _previous: VideoActionState,
  form: FormData,
): Promise<VideoActionState> {
  await requireOperator();
  const input = newVideoSchema.safeParse({
    topic: form.get("topic"),
    brandId: form.get("brandId") ?? "",
    voiceId: form.get("voiceId") ?? "",
  });
  if (!input.success) return error(input.error.issues[0]?.message ?? "Revisá los datos.");
  const { topic, brandId, voiceId } = input.data;
  const voice = await getVoiceById(db, voiceId);
  if (!voice?.active) return error("Esa voz ya no está disponible.");
  if (brandId && !(await getBrandById(db, brandId))) return error("Esa marca no existe.");

  const video = await createVideo(db, { topic, voiceId, brandId: brandId || null });
  // If the queue is down the video stays at Research and the worker's sweep picks it up.
  await queueVideoOffice(video.id, "researching").catch((cause) =>
    console.error("video: research not queued", cause),
  );
  revalidatePath("/videos", "layout");
  redirect("/videos");
}

const videoId = z.uuid();

/** "Reintentar" after a failure, or "Retomar" after a pause that waits for the operator. */
export async function retryVideoAction(
  _previous: VideoActionState,
  form: FormData,
): Promise<VideoActionState> {
  await requireOperator();
  const id = videoId.safeParse(form.get("videoId"));
  const video = id.success ? await getVideo(db, id.data) : null;
  if (!video) return error("Ese video no existe.");
  if (!isWorkingStage(video.stage) || (!video.failure && !video.pausedAt)) {
    return error("Ese video no está frenado.");
  }
  // The limit's pause has its own job waiting: resuming it here would only hit the limit again.
  if (video.pauseReason === "provider_limit") return error("Retoma solo cuando pase el límite.");
  if (video.failure) await retryVideoById(db, video.id);
  if (video.pausedAt) await resumeVideoById(db, video.id);
  await queueVideoOffice(video.id, video.stage as WorkingStage);
  revalidatePath("/videos", "layout");
  return { status: "idle" };
}

export async function discardVideoAction(
  _previous: VideoActionState,
  form: FormData,
): Promise<VideoActionState> {
  await requireOperator();
  const id = videoId.safeParse(form.get("videoId"));
  if (!id.success) return error("Ese video no existe.");
  const outcome = await transitionVideo(db, id.data, "archive");
  if (!outcome.ok) return error(outcome.reason);
  revalidatePath("/videos", "layout");
  redirect("/videos");
}
