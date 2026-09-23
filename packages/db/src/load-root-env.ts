import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

// Only for CLI scripts (migrate, seed, drizzle-kit). Apps load their env on their own.
const rootEnvFile = fileURLToPath(new URL("../../../.env", import.meta.url));

/**
 * Loads the repo root .env when it exists. Variables already set in the environment
 * (e.g. by Docker) take precedence.
 */
export function loadRootEnv(): void {
  if (existsSync(rootEnvFile)) process.loadEnvFile(rootEnvFile);
}
