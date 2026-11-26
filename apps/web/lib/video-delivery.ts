import "server-only";
import {
  PACKAGE_CREDITS,
  packageFiles,
  packageSlug,
  packageSource,
  type WorkingStage,
} from "@radev/core";
import {
  getCurrentVideoDocument,
  listUsageEvents,
  listVideoRuns,
  statMediaFile,
  type Video,
} from "@radev/db";
import {
  clock,
  dossierSchema,
  imagesDocSchema,
  packageDocSchema,
  renderDocSchema,
  reviewSchema,
  sceneStarts,
  scriptSchema,
  sourcesSchema,
  voiceDocSchema,
} from "@radev/video";
import { db } from "./db";
import { videoReport } from "./video-report";

// What the video desk shows: the two renders, the package and what it cost.

export async function loadDelivery(video: Video) {
  const document = (kind: Parameters<typeof getCurrentVideoDocument>[2]) =>
    getCurrentVideoDocument(db, video.id, kind);
  const [packageDoc, renderDoc, scriptDoc, voiceDoc, runs, usage] = await Promise.all([
    document("package"),
    document("render"),
    document("script"),
    document("voice"),
    listVideoRuns(db, video.id),
    listUsageEvents(db, video.id),
  ]);
  const pack = packageDocSchema.safeParse(packageDoc?.data);
  const render = renderDocSchema.safeParse(renderDoc?.data);
  const script = scriptSchema.safeParse(scriptDoc?.data);
  const voice = voiceDocSchema.safeParse(voiceDoc?.data);
  if (!packageDoc || !pack.success || !render.success || !script.success || !voice.success) {
    return null;
  }

  const starts = sceneStarts(
    voice.data.scenes.map((s) => s.frames),
    script.data.scenes.map((s) => s.tail),
  );
  const seconds = render.data.totalFrames / render.data.fps;
  const base = `/media/videos/${video.id}`;

  // The folder of the ZIP with the size of each file (null: it is missing).
  const slug = packageSlug(video.title ?? video.topic);
  const files = await Promise.all(
    [
      ...packageFiles(slug).map((f) => ({
        name: f.path.slice(slug.length + 1),
        source: packageSource(f),
      })),
      { name: PACKAGE_CREDITS.name, source: PACKAGE_CREDITS.source as string },
    ].map(async ({ name, source }) => ({
      name,
      bytes: (await statMediaFile(`videos/${video.id}/${source}`))?.size ?? null,
    })),
  );

  return {
    version: packageDoc.version,
    title: pack.data.publication.title,
    seconds,
    scenes: script.data.scenes.length,
    characters: voice.data.characters,
    formats: render.data.formats.map((f) => ({
      format: f.format,
      src: `${base}/${f.file}`,
      poster: `${base}/${pack.data.thumbnails[f.format]}`,
      width: f.width,
      height: f.height,
      bytes: f.bytes,
    })),
    chapters: pack.data.publication.chapters.map((c) => {
      const start = starts[c.scene - 1] ?? 0;
      return { title: c.title, start, time: clock(start) };
    }),
    descriptions: { normal: pack.data.descriptionNormal, short: pack.data.descriptionShort },
    slug,
    files,
    report: videoReport({ runs, usage, notes: await officeNotes(video.id) }),
  };
}

export type Delivery = NonNullable<Awaited<ReturnType<typeof loadDelivery>>>;

/** One line per office about what it left, for the report. */
async function officeNotes(videoId: string): Promise<Partial<Record<WorkingStage, string>>> {
  const data = async (kind: Parameters<typeof getCurrentVideoDocument>[2]) =>
    (await getCurrentVideoDocument(db, videoId, kind))?.data;
  const dossier = dossierSchema.safeParse(await data("dossier"));
  const sources = sourcesSchema.safeParse(await data("sources"));
  const images = imagesDocSchema.safeParse(await data("images"));
  const review = reviewSchema.shape.fixes.safeParse((await data("review"))?.applied);
  const render = renderDocSchema.safeParse(await data("render"));
  const notes: Partial<Record<WorkingStage, string>> = {};
  if (dossier.success) {
    notes.researching = `${dossier.data.facts.length} hechos, ${dossier.data.disputed.length} en disputa`;
  }
  if (sources.success) {
    const s = sources.data.summary;
    notes.checking_sources = `${s.textual} en su página, ${s.casi} casi, ${s.noEsta} no, ${s.sinPagina} sin página`;
  }
  if (images.success) notes.finding_images = `${images.data.candidates.length} candidatas`;
  if (review.success) notes.checking_facts = `${review.data.length} correcciones`;
  if (render.success) {
    notes.rendering = render.data.formats
      .map((f) => `${f.format.replace("x", ":")} ${clock(f.renderMs / 1000)}`)
      .join(" · ");
  }
  return notes;
}
