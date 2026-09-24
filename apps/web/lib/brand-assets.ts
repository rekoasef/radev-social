import type { AssetRole } from "@radev/core";
import { isStylePreset, presets } from "@radev/slides";
import type { z } from "zod";

export const ROLE_LABELS: Record<AssetRole, string> = {
  logo: "Logo",
  hero: "Protagonista",
  decoration: "Decoración",
  other: "Otro",
};

/** URL of a file in MEDIA_DIR (app/media/[...path]/route.ts). */
export function mediaUrl(path: string): string {
  return `/media/${path}`;
}

/** Spanish name of a theme token, from the preset schema (e.g. ["heroAsset"] → "Elemento protagonista"). */
export function tokenLabel(preset: string, path: readonly string[]): string {
  const [key] = path;
  if (isStylePreset(preset) && path.length === 1 && key) {
    const shape: Record<string, z.ZodType> = presets[preset].tokens.shape;
    const title = shape[key]?.meta()?.title;
    if (typeof title === "string") return title;
  }
  return path.join(" › ");
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;
}
