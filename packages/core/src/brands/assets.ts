// Rules for brand assets (logos, hero elements, decorations): which files are accepted and where
// a brand's tokens use them. Files are stored by packages/db; this module only decides.

export const ASSET_ROLES = ["logo", "hero", "decoration", "other"] as const;
export type AssetRole = (typeof ASSET_ROLES)[number];

/** Upper bound for one uploaded file. */
export const MAX_ASSET_BYTES = 5 * 1024 * 1024;

export const ASSET_TYPES = {
  png: { mime: "image/png", extension: "png" },
  jpeg: { mime: "image/jpeg", extension: "jpg" },
  webp: { mime: "image/webp", extension: "webp" },
  svg: { mime: "image/svg+xml", extension: "svg" },
} as const;
export type AssetType = keyof typeof ASSET_TYPES;
export type AssetMime = (typeof ASSET_TYPES)[AssetType]["mime"];

function startsWith(bytes: Uint8Array, signature: readonly number[], offset = 0): boolean {
  return signature.every((byte, i) => bytes[offset + i] === byte);
}

const ascii = (text: string) => [...text].map((char) => char.charCodeAt(0));

/** Looks at the SVG prologue: optional BOM, XML declaration, comments and doctype, then <svg. */
function isSvg(bytes: Uint8Array): boolean {
  let head = String.fromCharCode(...bytes.subarray(0, 4096));
  if (head.startsWith("ï»¿")) head = head.slice(3);
  head = head.replace(/^\s+/, "");
  const prologue = /^(<\?xml[^>]*\?>\s*|<!--[\s\S]*?-->\s*|<!doctype[^>]*>\s*)*/i;
  return /^<svg[\s>]/i.test(head.replace(prologue, ""));
}

/**
 * The file type from its content, never from its name or the browser's claim. Undefined for
 * anything that is not a supported image.
 */
export function detectAssetType(bytes: Uint8Array): AssetType | undefined {
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "png";
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return "jpeg";
  if (startsWith(bytes, ascii("RIFF")) && startsWith(bytes, ascii("WEBP"), 8)) return "webp";
  if (isSvg(bytes)) return "svg";
  return undefined;
}

export type AssetCheck = { ok: true; type: AssetType } | { ok: false; error: string };

/** Whether an uploaded file can become a brand asset. Messages are shown to the operator. */
export function checkAssetFile(bytes: Uint8Array): AssetCheck {
  if (bytes.byteLength === 0) return { ok: false, error: "El archivo está vacío." };
  if (bytes.byteLength > MAX_ASSET_BYTES) {
    return { ok: false, error: "El archivo pesa más de 5 MB." };
  }
  const type = detectAssetType(bytes);
  if (!type) return { ok: false, error: "Solo se aceptan imágenes PNG, JPEG, WebP o SVG." };
  return { ok: true, type };
}

/**
 * Where a brand's theme tokens point to an asset, as token paths (e.g. ["heroAsset"]). Walks
 * the whole object so it works for any preset. An asset in use cannot be deleted.
 */
export function findAssetReferences(tokens: unknown, assetId: string): string[][] {
  const found: string[][] = [];
  const walk = (value: unknown, path: string[]) => {
    if (value === assetId) found.push(path);
    // Arrays too: their entries are keyed "0", "1", ...
    else if (value !== null && typeof value === "object") {
      for (const [key, item] of Object.entries(value)) walk(item, [...path, key]);
    }
  };
  walk(tokens, []);
  return found;
}
