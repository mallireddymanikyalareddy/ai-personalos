import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const swSource = readFileSync(join(process.cwd(), "public", "sw.js"), "utf8");

describe("service worker", () => {
  it("bypasses the cache for API requests so stale onboarding data is never served", () => {
    expect(swSource).toContain('pathname.startsWith("/api/")');
    expect(swSource).toContain("if (isApiRequest(url)) return;");
  });

  it("never stubs API failures with a synthetic network error", () => {
    const fetchHandler = swSource.slice(swSource.indexOf('self.addEventListener("fetch"'));
    const guard = fetchHandler.indexOf("if (isApiRequest(url)) return;");
    expect(guard).toBeGreaterThan(-1);
    expect(fetchHandler.slice(0, guard)).not.toContain("respondWith");
    expect(fetchHandler.slice(0, guard)).not.toContain("cache.match");
  });

  it("serves navigations network-first so deploys land immediately", () => {
    expect(swSource).toContain("event.respondWith(networkFirst(request, RUNTIME_CACHE))");
  });

  it("falls back to cache only when offline", () => {
    expect(swSource).toContain("const hit = await cache.match(request)");
    expect(swSource).toContain("if (hit) return hit");
  });

  it("serves every non-api request network-first so nothing goes stale", () => {
    expect(swSource).not.toContain("cacheFirstWithRevalidate");
    expect(swSource).toContain("event.respondWith(networkFirst(request, RUNTIME_CACHE))");
  });

  it("drops caches from an older version on activation", () => {
    expect(swSource).toContain("caches.delete(key)");
    expect(swSource).toMatch(/personalos-v\d+/);
  });

  it("never lets a cache failure surface as a network error", () => {
    expect(swSource).toContain("let cache = null;");
    expect(swSource).toContain("cache = null;");
    expect(swSource).toMatch(/caches\.open\(cacheName\)/);
    expect(swSource).toMatch(/cache\.put\(request, response\.clone\(\)\)/);
  });
});
