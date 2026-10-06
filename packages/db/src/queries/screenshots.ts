import {
  ASSET_TYPES,
  checkScreenshotFile,
  MAX_POST_SCREENSHOTS,
  normalizeScreenshotNote,
} from "@radev/core";
import { asc, eq } from "drizzle-orm";
import { imageSize } from "image-size";
import { newScreenshotPath, removeMediaFile, writeMediaFile } from "../media";
import { type PostScreenshot, postScreenshots } from "../schema";
import type { AssetResult, Executor } from "./brand-assets";

// Screenshots attached to a post when asking the AI for it (ADR 0024). Files go to MEDIA_DIR;
// rows to post_screenshots, in the same transaction that creates the post.

/** A checked screenshot, ready to be saved. */
export type PreparedScreenshot = {
  bytes: Uint8Array;
  note: string;
  extension: string;
  mime: string;
  width: number;
  height: number;
};

/**
 * Checks the files and notes the operator sent (type, weight, size, note, how many). Nothing is
 * written. Messages are shown to the operator and say which screenshot failed.
 */
export function prepareScreenshots(
  files: { bytes: Uint8Array; note: string }[],
): AssetResult<PreparedScreenshot[]> {
  if (files.length > MAX_POST_SCREENSHOTS) {
    return { ok: false, error: `Podés adjuntar hasta ${MAX_POST_SCREENSHOTS} capturas.` };
  }
  const prepared: PreparedScreenshot[] = [];
  for (const [i, file] of files.entries()) {
    const which = files.length > 1 ? `Captura ${i + 1}: ` : "";
    const check = checkScreenshotFile(file.bytes);
    if (!check.ok) return { ok: false, error: which + check.error };
    const note = normalizeScreenshotNote(file.note);
    if (!note.ok) return { ok: false, error: which + note.error };
    let size: ReturnType<typeof imageSize>;
    try {
      size = imageSize(file.bytes);
    } catch {
      return { ok: false, error: `${which}No se pudo leer la imagen: puede estar dañada.` };
    }
    // EXIF orientations 5 to 8 rotate the photo 90°: the visible size is swapped.
    const rotated = (size.orientation ?? 1) >= 5;
    const { mime, extension } = ASSET_TYPES[check.type];
    prepared.push({
      bytes: file.bytes,
      note: note.value,
      extension,
      mime,
      width: rotated ? size.height : size.width,
      height: rotated ? size.width : size.height,
    });
  }
  return { ok: true, value: prepared };
}

/** Writes the files to MEDIA_DIR; their paths, in order. Removes them all if one fails. */
export async function writeScreenshotFiles(
  brandSlug: string,
  screenshots: PreparedScreenshot[],
): Promise<string[]> {
  const paths: string[] = [];
  try {
    for (const screenshot of screenshots) {
      const path = newScreenshotPath(brandSlug, screenshot.extension);
      await writeMediaFile(path, screenshot.bytes);
      paths.push(path);
    }
  } catch (error) {
    await removeScreenshotFiles(paths);
    throw error;
  }
  return paths;
}

export async function removeScreenshotFiles(paths: string[]): Promise<void> {
  await Promise.all(paths.map((path) => removeMediaFile(path)));
}

/** Registers the written files of a post, in order. */
export async function insertPostScreenshots(
  db: Executor,
  postId: string,
  screenshots: PreparedScreenshot[],
  paths: string[],
): Promise<PostScreenshot[]> {
  if (screenshots.length === 0) return [];
  return db
    .insert(postScreenshots)
    .values(
      screenshots.map(({ note, mime, width, height, bytes }, position) => ({
        postId,
        position,
        path: paths[position] as string,
        mime,
        width,
        height,
        sizeBytes: bytes.byteLength,
        note,
      })),
    )
    .returning();
}

export function listPostScreenshots(db: Executor, postId: string): Promise<PostScreenshot[]> {
  return db
    .select()
    .from(postScreenshots)
    .where(eq(postScreenshots.postId, postId))
    .orderBy(asc(postScreenshots.position));
}
