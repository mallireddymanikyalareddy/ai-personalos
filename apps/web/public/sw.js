const CACHE_NAME = "personalos-v3";
const RUNTIME_CACHE = "personalos-runtime-v3";
const PRECACHE_URLS = ["/", "/manifest.webmanifest", "/icon.svg"];

// Requests under /api/ are authenticated and change constantly. They must
// always hit the network: a cached 200 would serve stale onboarding state and
// a synthetic error would surface to the app as "Failed to fetch".
function isApiRequest(url) {
  return url.pathname.startsWith("/api/");
}

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .catch(() => undefined),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME && key !== RUNTIME_CACHE)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("message", (event) => {
  if (event.data === "skip-waiting") {
    self.skipWaiting();
  }
});

async function networkFirst(request, cacheName) {
  let cache = null;
  try {
    cache = await caches.open(cacheName);
  } catch {
    cache = null;
  }
  try {
    const response = await fetch(request);
    if (cache) {
      try {
        if (response.ok && response.type === "basic") {
          cache.put(request, response.clone());
        }
      } catch {
        /* caching is best effort */
      }
    }
    return response;
  } catch (error) {
    if (cache) {
      try {
        const hit = await cache.match(request);
        if (hit) return hit;
      } catch {
        /* fall through to the network error */
      }
    }
    throw error;
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Never intercept API traffic.
  if (isApiRequest(url)) return;

  // Everything else is network-first and only falls back to cache when we are
  // genuinely offline, so a deploy or a code change is picked up immediately.
  event.respondWith(networkFirst(request, RUNTIME_CACHE));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = event.notification.data && event.notification.data.url ? event.notification.data.url : "/today";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ("navigate" in client) {
          return client.navigate(target).then(() => client.focus());
        }
        if ("focus" in client) return client.focus();
      }
      return self.clients.openWindow(target);
    }),
  );
});

self.addEventListener("push", (event) => {
  if (!event.data) return;
  let payload = {};
  try {
    payload = event.data.json();
  } catch {
    payload = { title: event.data.text() };
  }
  event.waitUntil(
    self.registration.showNotification(payload.title || "AI PersonalOS", {
      body: payload.body || "",
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      data: { url: payload.url || "/today" },
    }),
  );
});