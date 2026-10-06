import { describe, expect, it } from "vitest";
import { MAX_ASSET_BYTES } from "../brands/assets";
import { checkScreenshotFile, normalizeScreenshotNote, SCREENSHOT_NOTE } from "./screenshots";

const bytes = (...values: number[]) => new Uint8Array(values);
const text = (value: string) => new Uint8Array([...value].map((char) => char.charCodeAt(0)));

const png = bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13);
const jpeg = bytes(0xff, 0xd8, 0xff, 0xe0, 0, 16);
const webp = text("RIFF\u0000\u0000\u0000\u0000WEBPVP8 ");

describe("checkScreenshotFile", () => {
  it("takes PNG, JPEG and WebP", () => {
    expect(checkScreenshotFile(png)).toEqual({ ok: true, type: "png" });
    expect(checkScreenshotFile(jpeg)).toEqual({ ok: true, type: "jpeg" });
    expect(checkScreenshotFile(webp)).toEqual({ ok: true, type: "webp" });
  });

  it("rejects SVG and anything that is not an image", () => {
    const svg = checkScreenshotFile(text('<svg xmlns="http://www.w3.org/2000/svg"/>'));
    expect(svg).toEqual({ ok: false, error: "Las capturas tienen que ser PNG, JPEG o WebP." });
    expect(checkScreenshotFile(text("GIF89a")).ok).toBe(false);
  });

  it("keeps the general limits: empty and too heavy", () => {
    expect(checkScreenshotFile(new Uint8Array())).toEqual({
      ok: false,
      error: "El archivo está vacío.",
    });
    const heavy = new Uint8Array(MAX_ASSET_BYTES + 1);
    heavy.set(png);
    expect(checkScreenshotFile(heavy)).toEqual({
      ok: false,
      error: "El archivo pesa más de 5 MB.",
    });
  });
});

describe("normalizeScreenshotNote", () => {
  it("trims and collapses spaces", () => {
    expect(normalizeScreenshotNote("  cargar   un\ngasto ")).toEqual({
      ok: true,
      value: "cargar un gasto",
    });
  });

  it("asks for a few words and caps the length", () => {
    expect(normalizeScreenshotNote(" a ").ok).toBe(false);
    expect(normalizeScreenshotNote("x".repeat(SCREENSHOT_NOTE.max)).ok).toBe(true);
    expect(normalizeScreenshotNote("x".repeat(SCREENSHOT_NOTE.max + 1)).ok).toBe(false);
  });
});
