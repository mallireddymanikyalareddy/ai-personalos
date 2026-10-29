import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

const dir = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@": `${dir}src`,
    },
  },
  oxc: false,
  esbuild: {
    jsx: "automatic",
    jsxImportSource: "react",
  },
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.{ts,tsx}"],
    // Worker threads start faster and more reliably than per-file forks on Windows.
    pool: "threads",
    // Heavy module renders can exceed Vitest's 5s default when files run in parallel.
    testTimeout: 15000,
    hookTimeout: 15000,
  },
});