import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

// Env: the scripts in package.json load the repo root .env through Node before Next starts.
// In Docker, variables come from the container.
const nextConfig: NextConfig = {
  // Self-contained server for the Docker image (apps/web/.next/standalone).
  output: "standalone",
  // Trace from the monorepo root so workspace packages end up in the standalone output.
  outputFileTracingRoot: fileURLToPath(new URL("../../", import.meta.url)),
  // Workspace packages export TypeScript source; Next compiles them.
  transpilePackages: ["@radev/db", "@radev/slides"],
  experimental: {
    // Brand assets go up to 5 MB (packages/core, MAX_ASSET_BYTES) plus the rest of the form.
    serverActions: { bodySizeLimit: "6mb" },
  },
};

export default nextConfig;
