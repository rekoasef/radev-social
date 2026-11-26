import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  newBrandAssetPath,
  readMediaChunks,
  readMediaFile,
  removeMediaFile,
  resolveMediaPath,
  statMediaFile,
  writeMediaFile,
} from "./media";

let dir: string;
beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), "media-test-"));
  process.env.MEDIA_DIR = dir;
});
afterAll(() => rmSync(dir, { recursive: true, force: true }));

describe("resolveMediaPath", () => {
  it("resolves paths inside MEDIA_DIR", () => {
    expect(resolveMediaPath("lumus/brand/a1b2.png")).toBe(join(dir, "lumus/brand/a1b2.png"));
  });

  it.each([
    "../.env",
    "lumus/../../.env",
    "lumus/brand/../../../etc/passwd",
    "/etc/passwd",
    "lumus\\..\\.env",
    "lumus/.hidden",
    "lumus/brand/",
    "lumus",
    "Lumus/brand/a.png",
    "lumus//a.png",
    "",
  ])("rejects %j", (path) => {
    expect(resolveMediaPath(path)).toBeUndefined();
  });
});

describe("media files", () => {
  it("writes, reads and removes a file", async () => {
    const path = newBrandAssetPath("lumus", "png");
    expect(path).toMatch(/^lumus\/brand\/[0-9a-f-]{36}\.png$/);
    await writeMediaFile(path, new Uint8Array([1, 2, 3]));
    expect(await readMediaFile(path)).toEqual(Buffer.from([1, 2, 3]));
    await removeMediaFile(path);
    expect(await readMediaFile(path)).toBeUndefined();
    await expect(removeMediaFile(path)).resolves.toBeUndefined();
  });

  it("refuses to write outside MEDIA_DIR", async () => {
    await expect(writeMediaFile("../escape.png", new Uint8Array([1]))).rejects.toThrow();
  });
});

describe("reading in chunks", () => {
  const path = "videos/abc/render/video.mp4";
  // Bigger than one chunk, with a recognizable pattern.
  const bytes = Uint8Array.from({ length: 700_000 }, (_, i) => i % 251);
  beforeAll(() => writeMediaFile(path, bytes));

  const collect = async (range?: { start: number; end: number }) => {
    const chunks: Uint8Array[] = [];
    for await (const chunk of readMediaChunks(path, range)) chunks.push(chunk);
    return { count: chunks.length, data: Buffer.concat(chunks) };
  };

  it("gives the whole file in several chunks", async () => {
    const { count, data } = await collect();
    expect(count).toBeGreaterThan(1);
    expect(data.equals(Buffer.from(bytes))).toBe(true);
  });

  it("gives only the bytes of a range, both ends included", async () => {
    const { data } = await collect({ start: 10, end: 300_009 });
    expect(data.equals(Buffer.from(bytes.subarray(10, 300_010)))).toBe(true);
  });

  it("fails when the file is shorter than asked", async () => {
    await expect(collect({ start: 0, end: bytes.length })).rejects.toThrow(/acortó/);
  });

  it("measures a file without reading it", async () => {
    expect(await statMediaFile(path)).toMatchObject({ size: bytes.length });
    expect(await statMediaFile("videos/abc/render/none.mp4")).toBeUndefined();
    expect(await statMediaFile("../.env")).toBeUndefined();
  });
});
