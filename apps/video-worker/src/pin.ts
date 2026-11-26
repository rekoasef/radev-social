import type { VideoPinJob, VideoPinResult } from "@radev/core";
import type { Video } from "@radev/db";
import {
  type CommonsClient,
  candidateFromHit,
  imageId,
  imagesDocSchema,
  smallImagePath,
  thumbExtension,
} from "@radev/video";

// "Sumar una imagen de Commons por nombre", from the script desk (docs/ARCHITECTURE.md §14.1). The
// web only asks: downloading and shrinking happen here. It adds a new version of the `images`
// document with one more candidate; the operator then puts it on a scene. Not an office: it never
// moves the video. Running it twice adds the image once (rule 8).

export type PinDeps = {
  getVideo(id: string): Promise<Video | null>;
  images(videoId: string): Promise<unknown | null>;
  saveImages(videoId: string, data: Record<string, unknown>): Promise<void>;
  commons: Pick<CommonsClient, "fileByTitle" | "download">;
  shrink(bytes: Uint8Array): Promise<Uint8Array>;
  sizeOf(bytes: Uint8Array): { width: number; height: number } | undefined;
  write(videoId: string, path: string, bytes: Uint8Array): Promise<void>;
};

const refused = (message: string): VideoPinResult => ({ ok: false, message });

export async function pinImage(deps: PinDeps, job: VideoPinJob): Promise<VideoPinResult> {
  const video = await deps.getVideo(job.videoId);
  if (!video) return refused("Ese video no existe.");
  if (video.stage !== "script_review") {
    return refused("El video ya no está esperando tu aprobación del guion.");
  }
  const doc = imagesDocSchema.safeParse(await deps.images(video.id));
  if (!doc.success) return refused("El video no tiene la hoja de imágenes.");

  const hit = await deps.commons.fileByTitle(job.title);
  if (!hit) {
    return refused(
      "Commons no tiene ese archivo, o no sirve (licencia no libre, o menos de 500 px de ancho).",
    );
  }
  const already = doc.data.candidates.find((c) => c.page === hit.page);
  if (already) return { ok: true, imageId: already.id, message: "Ya estaba en la hoja." };

  const next = Math.max(0, ...doc.data.candidates.map((c) => Number(c.id.slice(1)))) + 1;
  const id = imageId(next);
  const file = `images/${id}.${thumbExtension(hit.thumb)}`;
  const bytes = await deps.commons.download(hit.thumb);
  await deps.write(video.id, file, bytes);
  await deps.write(video.id, smallImagePath(id), await deps.shrink(bytes));
  const candidate = candidateFromHit(hit, id, file, deps.sizeOf(bytes));
  await deps.saveImages(video.id, { candidates: [...doc.data.candidates, candidate] });
  return { ok: true, imageId: id, message: "Imagen sumada a la hoja." };
}
