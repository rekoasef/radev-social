import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, resolve, sep } from "node:path";

// Files under MEDIA_DIR (uploaded brand assets; rendered slides from phase 2). The database
// stores paths relative to it, so the folder can move between machines. The folder is only known
// at runtime: the `turbopackIgnore` comments stop Next from tracing the whole project into the
// production build because of these calls.

export function requireMediaDir(): string {
  const dir = process.env.MEDIA_DIR;
  if (!dir) throw new Error("MEDIA_DIR no está definida. Revisá tu .env (ver .env.example).");
  return dir;
}

// Lowercase folders, then a file name without dots at the start: no "..", no hidden files.
const RELATIVE_PATH = /^[a-z0-9-]+(\/[a-z0-9-]+)*\/[a-z0-9][a-z0-9._-]*$/;

/**
 * Absolute path of a file in MEDIA_DIR, or undefined when `relativePath` is not one of ours
 * (e.g. "../.env", absolute paths, backslashes). Safe to call with user input.
 */
export function resolveMediaPath(relativePath: string): string | undefined {
  if (!RELATIVE_PATH.test(relativePath) || relativePath.split("/").includes("..")) {
    return undefined;
  }
  const root = resolve(/*turbopackIgnore: true*/ requireMediaDir());
  const absolute = resolve(root, relativePath);
  return absolute.startsWith(root + sep) ? absolute : undefined;
}

function mustResolve(relativePath: string): string {
  const absolute = resolveMediaPath(relativePath);
  if (!absolute) throw new Error(`Ruta de media inválida: ${relativePath}`);
  return absolute;
}

/** A new, unguessable path for a brand asset. */
export function newBrandAssetPath(brandSlug: string, extension: string): string {
  return `${brandSlug}/brand/${randomUUID()}.${extension}`;
}

/** A new, unguessable path for a screenshot attached to a post (ADR 0024). */
export function newScreenshotPath(brandSlug: string, extension: string): string {
  return `${brandSlug}/screens/${randomUUID()}.${extension}`;
}

/** Writes the whole file or nothing: a half-written file never takes the final name. */
export async function writeMediaFile(relativePath: string, bytes: Uint8Array): Promise<void> {
  const absolute = mustResolve(relativePath);
  await mkdir(/*turbopackIgnore: true*/ dirname(absolute), { recursive: true });
  const temporary = `${absolute}.${randomUUID()}.tmp`;
  try {
    await writeFile(/*turbopackIgnore: true*/ temporary, bytes, { flag: "wx" });
    await rename(/*turbopackIgnore: true*/ temporary, absolute);
  } catch (error) {
    await rm(/*turbopackIgnore: true*/ temporary, { force: true });
    throw error;
  }
}

/** Contents of a file, or undefined when the path is invalid or the file does not exist. */
export async function readMediaFile(relativePath: string): Promise<Buffer | undefined> {
  const absolute = resolveMediaPath(relativePath);
  if (!absolute) return undefined;
  try {
    return await readFile(/*turbopackIgnore: true*/ absolute);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  }
}

/** Deletes a file; a file that is already gone is not an error. */
export async function removeMediaFile(relativePath: string): Promise<void> {
  await rm(/*turbopackIgnore: true*/ mustResolve(relativePath), { force: true });
}
