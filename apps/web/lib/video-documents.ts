import "server-only";
import { canReuseVoice } from "@radev/core";
import {
  getCurrentVideoDocument,
  listVideoDocumentVersions,
  statMediaFile,
  type VideoDocument,
} from "@radev/db";
import {
  compactDossier,
  dossierSchema,
  framePath,
  imagesDocSchema,
  reviewSchema,
  sceneFrames,
  scriptSchema,
  sourcesSchema,
  voiceDocSchema,
} from "@radev/video";
import { z } from "zod";
import { db } from "./db";

// The documents behind the script desk, parsed (they were validated when saved; parsing gives the
// types and catches an old shape).

const reviewDocSchema = z.object({
  applied: reviewSchema.shape.fixes,
  rejected: z.array(z.unknown()),
  /** The second look of the Verification, at the drawn frames (older reviews have none). */
  frames: z
    .union([
      z.object({ status: z.literal("done"), frames: z.number(), applied: z.number() }),
      z.object({ status: z.literal("skipped"), reason: z.string() }),
    ])
    .optional(),
});

/** The frames of the script as it is now: a URL per scene and format, or null if not drawn yet. */
async function loadFrames(
  videoId: string,
  script: z.infer<typeof scriptSchema>,
  candidates: z.infer<typeof imagesDocSchema>["candidates"],
) {
  const url = async (path: string) =>
    (await statMediaFile(`videos/${videoId}/${path}`)) ? `/media/videos/${videoId}/${path}` : null;
  const frames = new Map<number, { short: string | null; normal: string | null }>();
  await Promise.all(
    sceneFrames(script, candidates).map(async ({ scene, key }) => {
      const [short, normal] = await Promise.all([
        url(framePath(key, "9x16")),
        url(framePath(key, "16x9")),
      ]);
      frames.set(scene, { short, normal });
    }),
  );
  return frames;
}

export async function loadScriptDocuments(videoId: string) {
  const [scriptDoc, imagesDoc, dossierDoc, sourcesDoc, reviewDoc, versions, voiceDoc] =
    await Promise.all([
      getCurrentVideoDocument(db, videoId, "script"),
      getCurrentVideoDocument(db, videoId, "images"),
      getCurrentVideoDocument(db, videoId, "dossier"),
      getCurrentVideoDocument(db, videoId, "sources"),
      getCurrentVideoDocument(db, videoId, "review"),
      listVideoDocumentVersions(db, videoId, "script"),
      getCurrentVideoDocument(db, videoId, "voice"),
    ]);
  const script = scriptSchema.safeParse(scriptDoc?.data);
  const images = imagesDocSchema.safeParse(imagesDoc?.data);
  const dossier = dossierSchema.safeParse(dossierDoc?.data);
  if (!scriptDoc || !script.success || !images.success || !dossier.success) return null;
  const sources = sourcesSchema.safeParse(sourcesDoc?.data);
  const review = reviewDocSchema.safeParse(reviewDoc?.data);
  // The same test the Voice office makes: with the take's own voice, model and speed.
  const voice = voiceDocSchema.safeParse(voiceDoc?.data);
  const voiceReused =
    voice.success &&
    canReuseVoice(voice.data.fingerprint, {
      texts: script.data.scenes.map((s) => s.narration),
      voiceId: voice.data.voiceId,
      model: voice.data.model,
      speed: voice.data.speed,
    });
  const frames = await loadFrames(videoId, script.data, images.data.candidates);
  return {
    frames,
    voiceReused,
    version: scriptDoc.version,
    script: script.data,
    images: images.data,
    dossier: dossier.data,
    dossierText: compactDossier(dossier.data).text,
    sources: sources.success ? sources.data : null,
    review: review.success ? review.data : null,
    beforeReview: scriptBeforeReview(versions, reviewDoc),
  };
}

/** The version the fact check read: the one before the version it wrote (same AI run). */
function scriptBeforeReview(versions: VideoDocument[], review: VideoDocument | null) {
  if (!review?.generationRunId) return null;
  const written = versions.findIndex((v) => v.generationRunId === review.generationRunId);
  const parsed = scriptSchema.safeParse(versions[written - 1]?.data);
  return written > 0 && parsed.success ? parsed.data : null;
}
