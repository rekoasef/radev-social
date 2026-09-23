import { defineConfig } from "drizzle-kit";
import { requireDatabaseUrl } from "./src/env";
import { loadRootEnv } from "./src/load-root-env";

loadRootEnv();

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/schema.ts",
  out: "./migrations",
  dbCredentials: { url: requireDatabaseUrl() },
  strict: true,
  verbose: true,
});
