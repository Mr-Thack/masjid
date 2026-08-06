// ---------------------------------------------------------------------------
// Masjid consumer — service worker REMOVAL worker ("suicide worker")
//
// The consumer app no longer registers a service worker (push/offline were
// never wired up; a purpose-built, hardened worker will return with the real
// PWA feature work — see docs/consumer-service-worker.md).
//
// This file exists to heal browsers that still carry an older worker:
// because /sw.js is served with no-store, any existing registration picks up
// this version on its next update check — which purges every CacheStorage
// cache for the origin and then unregisters itself.
//
// KEEP SERVING THIS FILE INDEFINITELY. It costs nothing, intercepts nothing
// (no fetch handler), and heals dormant installs whenever they return.
// The manual escape hatch is /sw-kill (served by the gateway worker before
// SPA routing — works for all apps on the origin).
// ---------------------------------------------------------------------------

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      try {
        const names = await caches.keys();
        await Promise.all(names.map((n) => caches.delete(n)));
      } catch (err) {
        console.warn('[sw] cache purge failed', err);
      }
      try {
        await self.registration.unregister();
      } catch (err) {
        console.warn('[sw] unregister failed', err);
      }
    })(),
  );
});

// Deliberately NO fetch handler: nothing is intercepted, nothing is cached.
