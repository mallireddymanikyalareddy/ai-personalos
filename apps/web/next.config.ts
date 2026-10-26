import path from "node:path";

import type { NextConfig } from "next";

const monorepoRoot = path.join(__dirname, "..", "..");

const apiUrl = (process.env.API_URL ?? "http://localhost:8080").replace(/\/$/, "");

const nextConfig: NextConfig = {
  transpilePackages: ["@personalos/core", "@personalos/api-contract"],
  reactStrictMode: true,
  allowedDevOrigins: ["*.preview.emergentagent.com", "*.emergentagent.com"],
  outputFileTracingRoot: monorepoRoot,
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${apiUrl}/api/:path*` }];
  },
};

export default nextConfig;
