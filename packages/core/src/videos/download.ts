import {
  VIDEO_FORMAT_FOLDERS,
  VIDEO_FORMATS,
  type VideoFormat,
  type VideoStage,
} from "./constants";

// The package the operator downloads (REVISION §7.5): the same folder the V0 spike left, to upload
// to YouTube and to keep in Drive. Only an approved video can be downloaded (like rule 3 for posts).

export const DOWNLOADABLE_STAGES: readonly VideoStage[] = ["approved"];

export function canDownload(stage: VideoStage): boolean {
  return DOWNLOADABLE_STAGES.includes(stage);
}

/** The folder name of a video: a slug of its title, e.g. `el-robo-de-la-mona-lisa`. */
export function packageSlug(title: string): string {
  const slug = title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  // at most 60 characters, cut between words
  const cut = slug.length <= 60 ? slug : slug.slice(0, slug.lastIndexOf("-", 60));
  return cut || "video";
}

/** The files of the ZIP, as `[path inside the zip, role]`. The paths are the same in every video. */
export function packageFiles(
  slug: string,
): { path: string; format: VideoFormat; file: "video" | "thumbnail" | "description" }[] {
  return VIDEO_FORMATS.flatMap((format) => {
    const folder = `${slug}/${VIDEO_FORMAT_FOLDERS[format]}`;
    return [
      { path: `${folder}/video.mp4`, format, file: "video" as const },
      { path: `${folder}/miniatura.png`, format, file: "thumbnail" as const },
      { path: `${folder}/descripcion.txt`, format, file: "description" as const },
    ];
  });
}

type PackageFile = ReturnType<typeof packageFiles>[number];

/** Where the offices left each file of the package, relative to `media/videos/<id>/`. */
export function packageSource({ format, file }: Pick<PackageFile, "format" | "file">): string {
  if (file === "video") return `render/video-${format}.mp4`;
  if (file === "thumbnail") return `package/miniatura-${format}.png`;
  return format === "9x16" ? "package/descripcion-short.txt" : "package/descripcion.txt";
}

/** The image credits go at the root of the folder, when the Publication office left them. */
export const PACKAGE_CREDITS = { source: "package/creditos.txt", name: "creditos.txt" } as const;
