// ---------------------------------------------------------------------------
// Service worker for Masjid consumer PWA
//
// - Push notification handler
// - Notification click — focus existing window or open new one
// - Message — respond to page health-check requests
// - ALL request caching is DISABLED — fetch events pass through to the browser
// ---------------------------------------------------------------------------

const CACHE_NAME = 'masjid-consumer-nocache';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Notify all controlled clients of an event (error, health, etc.) */
async function postToClients(message) {
  const clients = await self.clients.matchAll({ type: 'window' });
  for (const client of clients) {
    client.postMessage(message);
  }
}

/** Collect cache stats for health checks */
async function getCacheStats() {
  const cache = await caches.open(CACHE_NAME);
  const keys = await cache.keys();
  return { name: CACHE_NAME, count: keys.length, urls: keys.map((r) => r.url) };
}

// ---------------------------------------------------------------------------
// Install
// ---------------------------------------------------------------------------

self.addEventListener('install', () => {
  self.skipWaiting();
});

// ---------------------------------------------------------------------------
// Activate — purge old cache versions, claim clients
// ---------------------------------------------------------------------------

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(
        names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n)),
      ),
    ).catch((err) => {
      console.warn('[sw] activate: failed to purge old caches', err);
    }),
  );
  self.clients.claim();
});

// ---------------------------------------------------------------------------
// Fetch — PASS-THROUGH ONLY, no caching, no interception
// ---------------------------------------------------------------------------

self.addEventListener('fetch', (event) => {
  // All requests pass through to the browser's native network handling.
  // No respondWith() call means the browser handles the request normally.
  // The event listener exists only so we can add logging if needed;
  // it never caches, never blocks, never returns error responses.
});

// ---------------------------------------------------------------------------
// Push notifications
// ---------------------------------------------------------------------------

self.addEventListener('push', (event) => {
  if (!event.data) return;

  try {
    const data = event.data.json();
    event.waitUntil(
      self.registration.showNotification(data.title, {
        body: data.body,
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        data: { url: data.url },
      }),
    );
  } catch {
    // Ignore malformed push payloads
  }
});

// ---------------------------------------------------------------------------
// Notification click — focus existing window or open new one
// ---------------------------------------------------------------------------

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((clients) => {
      const existing = clients.find((c) => c.url.includes(url));
      if (existing) return existing.focus();
      return self.clients.openWindow(url);
    }).catch((err) => {
      console.warn('[sw] notificationclick failed', err);
    }),
  );
});

// ---------------------------------------------------------------------------
// Message — respond to page health-check requests
// ---------------------------------------------------------------------------

self.addEventListener('message', (event) => {
  if (event.data?.type === 'health-check') {
    getCacheStats().then((stats) => {
      event.source?.postMessage({ type: 'health-check-result', stats });
    });
  }
});