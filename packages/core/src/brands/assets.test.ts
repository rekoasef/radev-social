import { describe, expect, it } from "vitest";
import { checkAssetFile, detectAssetType, findAssetReferences, MAX_ASSET_BYTES } from "./assets";

const bytes = (...values: number[]) => new Uint8Array(values);
const text = (value: string) => new Uint8Array([...value].map((char) => char.charCodeAt(0)));

const png = bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13);
const jpeg = bytes(0xff, 0xd8, 0xff, 0xe0, 0, 16);
const webp = text("RIFF\u0000\u0000\u0000\u0000WEBPVP8 ");

describe("detectAssetType", () => {
  it("recognizes PNG, JPEG and WebP by their signature", () => {
    expect(detectAssetType(png)).toBe("png");
    expect(detectAssetType(jpeg)).toBe("jpeg");
    expect(detectAssetType(webp)).toBe("webp");
  });

  it("recognizes SVG after a BOM, XML declaration, comments and doctype", () => {
    expect(detectAssetType(text('<svg xmlns="http://www.w3.org/2000/svg"/>'))).toBe("svg");
    expect(
      detectAssetType(
        text(
          'ï»¿  <?xml version="1.0"?>\n<!-- logo -->\n<!DOCTYPE svg>\n<svg viewBox="0 0 1 1"></svg>',
        ),
      ),
    ).toBe("svg");
  });

  it("rejects anything else, whatever its name says", () => {
    expect(detectAssetType(text("GIF89a"))).toBeUndefined();
    expect(detectAssetType(text("<html><svg></svg></html>"))).toBeUndefined();
    expect(detectAssetType(text("%PDF-1.7"))).toBeUndefined();
    expect(detectAssetType(text("RIFF\u0000\u0000\u0000\u0000WAVE"))).toBeUndefined();
    expect(detectAssetType(bytes(0x89, 0x50))).toBeUndefined();
  });
});

describe("checkAssetFile", () => {
  it("accepts a supported image", () => {
    expect(checkAssetFile(png)).toEqual({ ok: true, type: "png" });
  });

  it("rejects empty files", () => {
    expect(checkAssetFile(new Uint8Array())).toMatchObject({ ok: false });
  });

  it("rejects files over 5 MB, even valid images", () => {
    const big = new Uint8Array(MAX_ASSET_BYTES + 1);
    big.set(png);
    expect(checkAssetFile(big)).toEqual({ ok: false, error: "El archivo pesa más de 5 MB." });
    const limit = new Uint8Array(MAX_ASSET_BYTES);
    limit.set(png);
    expect(checkAssetFile(limit).ok).toBe(true);
  });

  it("rejects unsupported types", () => {
    expect(checkAssetFile(text("GIF89a"))).toMatchObject({ ok: false });
  });
});

describe("findAssetReferences", () => {
  const id = "0b9f3c2e-4a1d-4c7b-9e2f-1a2b3c4d5e6f";

  it("finds every token that points to the asset", () => {
    const tokens = { heroAsset: id, logoAsset: id, colors: { bg: "#000" } };
    expect(findAssetReferences(tokens, id)).toEqual([["heroAsset"], ["logoAsset"]]);
  });

  it("looks inside nested objects and arrays", () => {
    const tokens = { decorations: [{ asset: "other" }, { asset: id }] };
    expect(findAssetReferences(tokens, id)).toEqual([["decorations", "1", "asset"]]);
  });

  it("returns nothing when the asset is not used", () => {
    expect(findAssetReferences({ logoAsset: null }, id)).toEqual([]);
    expect(findAssetReferences(null, id)).toEqual([]);
  });
});
