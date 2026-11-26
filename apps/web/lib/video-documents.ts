import "server-only";
import { canReuseVoice } from "@radev/core";
import { getCurrentVideoDocument, listVideoDocumentVersions, type VideoDocument } from "@radev/db";
import {
  compactDossier,
  dossierSchema,
  imagesDocSchema,
  reviewSchema,
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
});

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
  return {
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
