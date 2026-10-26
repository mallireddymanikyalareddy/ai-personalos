import path from "node:path";

import type { NextConfig } from "next";

const monorepoRoot = path.join(__dirname, "..", "..");
const staticExport = process.env.STATIC_EXPORT === "1";
const apiUrl = (process.env.API_URL ?? "http://localhost:8001").replace(/\/$/, "");

const nextConfig: NextConfig = {
  transpilePackages: ["@personalos/core", "@personalos/api-contract"],
  reactStrictMode: true,
  allowedDevOrigins: ["*.preview.emergentagent.com", "*.emergentagent.com", "*.preview.emergentcf.cloud", "*.emergentcf.cloud"],
  outputFileTracingRoot: monorepoRoot,
  images: { unoptimized: true },
  ...(staticExport
    ? { output: "export" as const, distDir: ".next-export" }
    : {
        async rewrites() {
          return [{ source: "/api/:path*", destination: `${apiUrl}/api/:path*` }];
        },
      }),
};

export default nextConfig;
