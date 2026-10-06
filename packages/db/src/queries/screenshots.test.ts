import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { resolveMediaPath } from "../media";
import { prepareScreenshots, removeScreenshotFiles, writeScreenshotFiles } from "./screenshots";

let dir: string;
beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), "screenshots-test-"));
  process.env.MEDIA_DIR = dir;
});
afterAll(() => rmSync(dir, { recursive: true, force: true }));

/** The header of a PNG of the given size: all image-size reads. */
function png(width: number, height: number): Uint8Array {
  const bytes = new Uint8Array(33);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13]);
  bytes.set(
    [..."IHDR"].map((c) => c.charCodeAt(0)),
    12,
  );
  const view = new DataView(bytes.buffer);
  view.setUint32(16, width);
  view.setUint32(20, height);
  return bytes;
}

describe("prepareScreenshots", () => {
  it("reads type and size and normalizes the note", () => {
    const result = prepareScreenshots([{ bytes: png(738, 1600), note: "  cargar  un gasto " }]);
    expect(result.ok && result.value[0]).toMatchObject({
      note: "cargar un gasto",
      mime: "image/png",
      extension: "png",
      width: 738,
      height: 1600,
    });
  });

  it("takes none", () => {
    expect(prepareScreenshots([])).toEqual({ ok: true, value: [] });
  });

  it("caps how many", () => {
    const file = { bytes: png(10, 10), note: "una pantalla" };
    const result = prepareScreenshots([file, file, file, file, file]);
    expect(result).toEqual({ ok: false, error: "Podés adjuntar hasta 4 capturas." });
  });

  it("says which screenshot failed", () => {
    const result = prepareScreenshots([
      { bytes: png(10, 10), note: "una pantalla" },
      { bytes: png(10, 10), note: "" },
    ]);
    expect(result.ok === false && result.error).toMatch(/^Captura 2: /);
  });

  it("rejects an SVG", () => {
    const svg = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"/>');
    expect(prepareScreenshots([{ bytes: svg, note: "una pantalla" }]).ok).toBe(false);
  });
});

describe("writeScreenshotFiles", () => {
  it("writes each file under <brand>/screens and removes them on request", async () => {
    const prepared = prepareScreenshots([
      { bytes: png(10, 20), note: "una pantalla" },
      { bytes: png(20, 10), note: "otra pantalla" },
    ]);
    if (!prepared.ok) throw new Error(prepared.error);
    const paths = await writeScreenshotFiles("lumus", prepared.value);
    expect(paths).toHaveLength(2);
    for (const path of paths) {
      expect(path).toMatch(/^lumus\/screens\/[0-9a-f-]{36}\.png$/);
      expect(existsSync(resolveMediaPath(path) as string)).toBe(true);
    }
    await removeScreenshotFiles(paths);
    for (const path of paths) expect(existsSync(resolveMediaPath(path) as string)).toBe(false);
  });
});
