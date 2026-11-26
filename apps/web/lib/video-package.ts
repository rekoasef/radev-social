import {
  canDownload,
  PACKAGE_CREDITS,
  packageFiles,
  packageSlug,
  packageSource,
  type VideoStage,
} from "@radev/core";
import { readMediaChunks, statMediaFile } from "@radev/db";
import { Zip, ZipPassThrough } from "fflate";
import { byteStream } from "./byte-stream";

// The package of an approved video as a ZIP (REVISION §7.5), built while it downloads: one chunk of
// one file in memory at a time, and nothing compressed (MP4 and PNG already are).

type Entry = { name: string; path: string };

async function* zipChunks(
  entries: readonly Entry[],
): AsyncGenerator<Uint8Array<ArrayBuffer>, void, undefined> {
  let ready: Uint8Array<ArrayBuffer>[] = [];
  const zip = new Zip((error, chunk) => {
    if (error) throw error;
    ready.push(chunk as Uint8Array<ArrayBuffer>);
  });
  function* drain() {
    const chunks = ready;
    ready = [];
    yield* chunks;
  }

  for (const entry of entries) {
    const file = new ZipPassThrough(entry.name);
    zip.add(file);
    for await (const chunk of readMediaChunks(entry.path)) {
      file.push(chunk);
      yield* drain();
    }
    file.push(new Uint8Array(0), true);
    yield* drain();
  }
  zip.end();
  yield* drain();
}

const refuse = (message: string, status = 409) =>
  new Response(message, { status, headers: { "Content-Type": "text/plain; charset=utf-8" } });

export type DownloadableVideo = {
  id: string;
  stage: VideoStage;
  title: string | null;
  topic: string;
};

export async function videoPackageResponse(video: DownloadableVideo): Promise<Response> {
  if (!canDownload(video.stage)) {
    return refuse("El paquete se descarga con el video aprobado.");
  }
  const slug = packageSlug(video.title ?? video.topic);
  const folder = `videos/${video.id}`;

  const entries: Entry[] = packageFiles(slug).map((f) => ({
    name: f.path,
    path: `${folder}/${packageSource(f)}`,
  }));
  // Checked before the first byte: once the download starts there is no way to report an error.
  for (const entry of entries) {
    if (!(await statMediaFile(entry.path))) {
      return refuse(`Falta un archivo del paquete: ${entry.name}.`);
    }
  }
  const credits = `${folder}/${PACKAGE_CREDITS.source}`;
  if (await statMediaFile(credits)) {
    entries.push({ name: `${slug}/${PACKAGE_CREDITS.name}`, path: credits });
  }

  return new Response(byteStream(zipChunks(entries)), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${slug}.zip"`,
      "Cache-Control": "private, no-store",
    },
  });
}
