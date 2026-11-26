"use server";

import { checkRejectionNote } from "@radev/core";
import {
  decideScript,
  decideVideo,
  getVideo,
  saveOperatorScript,
  transitionVideo,
} from "@radev/db";
import { commonsTitle, editScene } from "@radev/video";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { type PinStatus, pinStatus, queuePinImage, queueVideoOffice } from "@/lib/jobs";
import { requireOperator } from "@/lib/session";
import { type DecideDeps, type DeskEvent, decideAndQueue } from "@/lib/video-decide";
import { loadScriptDocuments } from "@/lib/video-documents";

// The script desk. Every change carries the version of the script the operator was looking at, so a
// stale tab never writes over (or approves) something he has not seen.

export type DeskState =
  | { status: "idle" }
  | { status: "done" }
  | { status: "error"; messages: string[] };

const fail = (...messages: string[]): DeskState => ({ status: "error", messages });

const target = z.object({ videoId: z.uuid(), version: z.coerce.number().int().min(1) });

const sceneInput = target.extend({
  scene: z.coerce.number().int().min(1),
  narration: z.string().max(400).optional(),
  caption: z.string().max(100).optional(),
  image: z
    .string()
    .regex(/^i\d{2,3}$/)
    .optional(),
});

export async function editSceneAction(_previous: DeskState, form: FormData): Promise<DeskState> {
  await requireOperator();
  const input = sceneInput.safeParse(Object.fromEntries(form));
  if (!input.success) return fail("Revisá el texto: es demasiado largo o está vacío.");
  const { videoId, version, ...change } = input.data;
  const documents = await loadScriptDocuments(videoId);
  if (!documents) return fail("No encuentro el guion de este video.");

  const edited = editScene(
    documents.script,
    change,
    documents.images.candidates,
    documents.dossierText,
  );
  if (!edited.ok) return fail(...edited.errors);
  const saved = await saveOperatorScript(db, videoId, version, edited.script);
  if (!saved.ok) return fail(saved.reason);
  revalidatePath(`/videos/${videoId}`);
  return { status: "done" };
}

const decideDeps: DecideDeps = {
  decide: (videoId, version, { event, note }) =>
    event === "approveScript" || event === "rejectScript"
      ? decideScript(db, videoId, version, event, note)
      : decideVideo(db, videoId, version, event, note),
  queue: queueVideoOffice,
};

/** Applies the operator's answer and reloads the studio. */
async function answer(form: FormData, event: DeskEvent, note?: string): Promise<DeskState> {
  const input = target.safeParse(Object.fromEntries(form));
  if (!input.success) return fail("Ese video no existe.");
  const { videoId, version } = input.data;
  const outcome = await decideAndQueue(decideDeps, videoId, version, { event, note });
  if (!outcome.ok) return fail(outcome.reason);
  revalidatePath("/videos", "layout");
  return { status: "done" };
}

/** A return needs its note. */
async function sendBack(form: FormData, event: DeskEvent): Promise<DeskState> {
  const note = checkRejectionNote(form.get("note")?.toString());
  return note.ok ? answer(form, event, note.note) : fail(note.reason);
}

export async function approveScriptAction(
  _previous: DeskState,
  form: FormData,
): Promise<DeskState> {
  await requireOperator();
  return answer(form, "approveScript");
}

export async function rejectScriptAction(_previous: DeskState, form: FormData): Promise<DeskState> {
  await requireOperator();
  return sendBack(form, "rejectScript");
}

export async function approveVideoAction(_previous: DeskState, form: FormData): Promise<DeskState> {
  await requireOperator();
  return answer(form, "approveVideo");
}

const RETURN_TO = {
  render: "rejectVideoToRender",
  voice: "rejectVideoToVoice",
  script: "rejectVideoToScript",
} as const;

export async function rejectVideoAction(_previous: DeskState, form: FormData): Promise<DeskState> {
  await requireOperator();
  const to = z.enum(["render", "voice", "script"]).safeParse(form.get("to"));
  return to.success ? sendBack(form, RETURN_TO[to.data]) : fail("Elegí a qué oficina vuelve.");
}

/** An approved video goes back to the desk: the download closes until it is approved again. */
export async function reopenVideoAction(_previous: DeskState, form: FormData): Promise<DeskState> {
  await requireOperator();
  const id = z.uuid().safeParse(form.get("videoId"));
  if (!id.success) return fail("Ese video no existe.");
  const outcome = await transitionVideo(db, id.data, "reopen");
  if (!outcome.ok) return fail(outcome.reason);
  revalidatePath("/videos", "layout");
  return { status: "done" };
}

export async function pinImageAction(input: {
  videoId: string;
  name: string;
}): Promise<{ ok: true; jobId: string } | { ok: false; message: string }> {
  await requireOperator();
  const id = z.uuid().safeParse(input.videoId);
  const title = commonsTitle(z.string().max(600).catch("").parse(input.name));
  if (!title) {
    return {
      ok: false,
      message: "Pegá la dirección del archivo en Commons, o su nombre con extensión (.jpg, .png).",
    };
  }
  const video = id.success ? await getVideo(db, id.data) : null;
  if (video?.stage !== "script_review") {
    return { ok: false, message: "El video ya no está esperando tu aprobación del guion." };
  }
  const jobId = await queuePinImage(video.id, title);
  return jobId ? { ok: true, jobId } : { ok: false, message: "No se pudo encolar el pedido." };
}

export async function pinStatusAction(videoId: string, jobId: string): Promise<PinStatus> {
  await requireOperator();
  const ids = z.tuple([z.uuid(), z.uuid()]).safeParse([videoId, jobId]);
  if (!ids.success) return { state: "done", result: { ok: false, message: "Pedido inválido." } };
  const status = await pinStatus(...ids.data);
  if (status.state === "done" && status.result.ok) revalidatePath(`/videos/${videoId}`);
  return status;
}
