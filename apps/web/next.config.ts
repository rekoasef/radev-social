import type { NextConfig } from "next";

// Env: the scripts in package.json load the repo root .env through Node before Next starts.
// In Docker, variables come from the container.
const nextConfig: NextConfig = {
  // Workspace packages export TypeScript source; Next compiles them.
  transpilePackages: ["@radev/db"],
};

export default nextConfig;
