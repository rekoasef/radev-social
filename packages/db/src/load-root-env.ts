import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Only for CLI scripts (migrate, seed, drizzle-kit). Apps load their env on their own
// (scripts/with-root-env.mjs, which applies the same MEDIA_DIR rule).
const root = fileURLToPath(new URL("../../../", import.meta.url));
const rootEnvFile = resolve(root, ".env");

/**
 * Loads the repo root .env when it exists. Variables already set in the environment
 * (e.g. by Docker) take precedence. MEDIA_DIR defaults to <repo>/media, and a relative
 * MEDIA_DIR is relative to the repo root, whatever folder the script runs from.
 */
export function loadRootEnv(): void {
  if (existsSync(rootEnvFile)) process.loadEnvFile(rootEnvFile);
  process.env.MEDIA_DIR = resolve(root, process.env.MEDIA_DIR || "media");
}
