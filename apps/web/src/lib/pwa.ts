export const SW_VERSION = 3;

export const CURRENT_CACHES = new Set([`personalos-v${SW_VERSION}`, `personalos-runtime-v${SW_VERSION}`]);
export const CURRENT_CACHE_NAMES = CURRENT_CACHES;

export function isStaleCache(key: string): boolean {
  return !CURRENT_CACHES.has(key);
}

export function currentCacheNames(): string[] {
  return [...CURRENT_CACHES];
}

export async function registerServiceWorker(): Promise<void> {
  // Only production installs the worker. In dev, assets change on every
  // compile and intercepting them breaks HMR, so the app runs without it.
  if (process.env.NODE_ENV !== "production") return;
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;

  const clearStaleCaches = async () => {
    if (typeof caches === "undefined") return;
    const keys = await caches.keys();
    await Promise.all(
      keys.filter((key) => !CURRENT_CACHES.has(key)).map((key) => caches.delete(key)),
    );
  };

  const takeControl = async (registration: ServiceWorkerRegistration) => {
    await registration.update();
    if (registration.waiting) {
      registration.waiting.postMessage("skip-waiting");
      return;
    }
    if (registration.active) return;
    const worker = registration.installing;
    if (!worker) return;
    await new Promise<void>((resolve) => {
      worker.addEventListener("statechange", () => {
        if (worker.state === "activated") resolve();
      });
    });
  };

  try {
    const registration = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
    await takeControl(registration);
    await clearStaleCaches();
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      void clearStaleCaches();
    });
  } catch {
    // Offline support is a progressive enhancement; the app works without it.
  }
}

export async function unregisterServiceWorker(): Promise<void> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  const registrations = await navigator.serviceWorker.getRegistrations();
  await Promise.all(registrations.map((registration) => registration.unregister()));
  if (typeof caches === "undefined") return;
  const keys = await caches.keys();
  await Promise.all(keys.map((key) => caches.delete(key)));
}
