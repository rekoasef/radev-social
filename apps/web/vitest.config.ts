import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// The same `@/` as tsconfig.json, for the tests that import route handlers.
export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./", import.meta.url)) } },
});
