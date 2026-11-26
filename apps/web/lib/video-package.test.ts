import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { removeMediaFile, writeMediaFile } from "@radev/db";
import { unzipSync } from "fflate";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type DownloadableVideo, videoPackageResponse } from "./video-package";

const video: DownloadableVideo = {
  id: "11111111-2222-3333-4444-555555555555",
  stage: "approved",
  title: "El robo de la Mona Lisa",
  topic: "mona lisa",
};
const folder = `videos/${video.id}`;
// Bigger than one chunk, so a file arrives in pieces.
const big = Uint8Array.from({ length: 700_000 }, (_, i) => i % 253);
const text = (value: string) => new TextEncoder().encode(value);

const FILES: Record<string, Uint8Array> = {
  "render/video-9x16.mp4": big,
  "render/video-16x9.mp4": big.subarray(0, 1000),
  "package/miniatura-9x16.png": text("png vertical"),
  "package/miniatura-16x9.png": text("png horizontal"),
  "package/descripcion-short.txt": text("descripción corta"),
  "package/descripcion.txt": text("descripción larga"),
  "package/creditos.txt": text("créditos"),
};

let dir: string;
beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), "video-package-"));
  process.env.MEDIA_DIR = dir;
  for (const [path, bytes] of Object.entries(FILES)) {
    await writeMediaFile(`${folder}/${path}`, bytes);
  }
});
afterAll(() => rmSync(dir, { recursive: true, force: true }));

const unzip = async (response: Response) => unzipSync(new Uint8Array(await response.arrayBuffer()));

describe("videoPackageResponse", () => {
  it("zips the folder of both formats, byte for byte", async () => {
    const response = await videoPackageResponse(video);
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Disposition")).toBe(
      'attachment; filename="el-robo-de-la-mona-lisa.zip"',
    );
    const files = await unzip(response);
    const root = "el-robo-de-la-mona-lisa";
    const expected = {
      [`${root}/short/video.mp4`]: "render/video-9x16.mp4",
      [`${root}/short/miniatura.png`]: "package/miniatura-9x16.png",
      [`${root}/short/descripcion.txt`]: "package/descripcion-short.txt",
      [`${root}/normal/video.mp4`]: "render/video-16x9.mp4",
      [`${root}/normal/miniatura.png`]: "package/miniatura-16x9.png",
      [`${root}/normal/descripcion.txt`]: "package/descripcion.txt",
      [`${root}/creditos.txt`]: "package/creditos.txt",
    };
    expect(Object.keys(files).sort()).toEqual(Object.keys(expected).sort());
    for (const [name, source] of Object.entries(expected)) {
      const got = Buffer.from(files[name] ?? []);
      expect(got.equals(Buffer.from(FILES[source] ?? [])), name).toBe(true);
    }
  });

  it("refuses a video that is not approved", async () => {
    const response = await videoPackageResponse({ ...video, stage: "in_review" });
    expect(response.status).toBe(409);
    expect(response.headers.get("Content-Type")).toContain("text/plain");
  });

  it("refuses before sending anything when a file is missing", async () => {
    await removeMediaFile(`${folder}/package/miniatura-16x9.png`);
    const response = await videoPackageResponse(video);
    expect(response.status).toBe(409);
    expect(await response.text()).toContain("normal/miniatura.png");
  });
});
