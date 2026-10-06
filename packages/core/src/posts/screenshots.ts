import { type AssetCheck, checkAssetFile, detectAssetType } from "../brands/assets";

// Screenshots the operator attaches when asking the AI for a carousel (ADR 0024): the AI sees
// them and shows them on `screen` slides, inside a phone or a laptop. They belong to the post.

/** At most this many per post. */
export const MAX_POST_SCREENSHOTS = 4;

/** The operator's short line about a screenshot ("cargar un gasto"); the AI reads it. */
export const SCREENSHOT_NOTE = { min: 3, max: 120 } as const;

/**
 * Whether an uploaded file can be a screenshot: a PNG, JPEG or WebP (an SVG is not a screenshot,
 * and the AI providers only see raster images). Messages are shown to the operator.
 */
export function checkScreenshotFile(bytes: Uint8Array): AssetCheck {
  const type = detectAssetType(bytes);
  if (bytes.byteLength > 0 && (type === undefined || type === "svg")) {
    return { ok: false, error: "Las capturas tienen que ser PNG, JPEG o WebP." };
  }
  return checkAssetFile(bytes);
}

/** The note as stored, or an error for the operator. */
export function normalizeScreenshotNote(
  note: string,
): { ok: true; value: string } | { ok: false; error: string } {
  const value = note.trim().replace(/\s+/g, " ");
  if (value.length < SCREENSHOT_NOTE.min) {
    return { ok: false, error: "Contá en pocas palabras qué muestra cada captura." };
  }
  if (value.length > SCREENSHOT_NOTE.max) {
    return {
      ok: false,
      error: `La descripción de una captura tiene hasta ${SCREENSHOT_NOTE.max} caracteres.`,
    };
  }
  return { ok: true, value };
}
