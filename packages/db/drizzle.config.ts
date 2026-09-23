import { defineConfig } from "drizzle-kit";
import { loadRootEnv, requireDatabaseUrl } from "./src/env";

loadRootEnv();

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/schema.ts",
  out: "./migrations",
  dbCredentials: { url: requireDatabaseUrl() },
  strict: true,
  verbose: true,
});
