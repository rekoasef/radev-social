import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const rootEnvFile = fileURLToPath(new URL("../../../.env", import.meta.url));

/**
 * Loads the repo root .env when it exists (local scripts). Variables already set in the
 * environment (e.g. by Docker) take precedence.
 */
export function loadRootEnv(): void {
  if (existsSync(rootEnvFile)) process.loadEnvFile(rootEnvFile);
}

export function requireDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL no está definida. Revisá tu .env (ver .env.example).");
  return url;
}
