import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { CURRENT_CACHE_NAMES, SW_VERSION, currentCacheNames, isStaleCache } from "@/lib/pwa";

const pwaSource = readFileSync(join(process.cwd(), "src", "lib", "pwa.ts"), "utf8");

describe("pwa registration guard", () => {
  it("only installs the worker in production builds", () => {
    expect(pwaSource).toContain('process.env.NODE_ENV !== "production"');
    const guardIndex = pwaSource.indexOf('process.env.NODE_ENV !== "production"');
    expect(guardIndex).toBeGreaterThan(-1);
    expect(pwaSource.slice(guardIndex, guardIndex + 80)).toContain("return");
  });

  it("bails out before touching navigator in dev", () => {
    const guardIndex = pwaSource.indexOf('process.env.NODE_ENV !== "production"');
    const navigatorIndex = pwaSource.indexOf('"serviceWorker" in navigator');
    expect(guardIndex).toBeLessThan(navigatorIndex);
  });
});

describe("pwa cache lifecycle", () => {
  it("keeps only the current generation of caches", () => {
    const keys = [
      "personalos-v1",
      "personalos-v2",
      "personalos-v3",
      "personalos-runtime-v3",
      "personalos-v4",
    ];
    expect(keys.filter(isStaleCache)).toEqual([
      "personalos-v1",
      "personalos-v2",
      "personalos-v4",
    ]);
    expect(keys.filter((key) => !isStaleCache(key))).toEqual([
      "personalos-v3",
      "personalos-runtime-v3",
    ]);
  });

  it("claims the caches the worker actually writes", () => {
    expect(currentCacheNames()).toEqual([
      `personalos-v${SW_VERSION}`,
      `personalos-runtime-v${SW_VERSION}`,
    ]);
    expect(CURRENT_CACHE_NAMES.size).toBe(2);
  });
});
