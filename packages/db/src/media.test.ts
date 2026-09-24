import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  newBrandAssetPath,
  readMediaFile,
  removeMediaFile,
  resolveMediaPath,
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
