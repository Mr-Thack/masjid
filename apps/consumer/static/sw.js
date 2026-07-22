// ---------------------------------------------------------------------------
// Service worker for Masjid consumer PWA
//
// - Cache-first for static assets (JS, CSS, images, fonts, icons)
// - Offline-ready prayer-time shell
// - Push notification handler (future)
// - /sw-kill emergency self-destruct route
// - Reports errors to page clients via postMessage
// ---------------------------------------------------------------------------

const CACHE_NAME = 'masjid-consumer-__BUILD_HASH__';

const SKIP_PATH_PREFIXES = ['/api/', '/@'];
const CACHEABLE_EXTENSIONS = /\.(js|css|png|svg|ico|woff2)$/;
const CACHEABLE_PATH_PREFIXES = ['/icon-'];
const MAX_CACHE_ENTRIES = 100;

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

function isCacheable(url) {
  return CACHEABLE_EXTENSIONS.test(url.pathname) ||
    CACHEABLE_PATH_PREFIXES.some((p) => url.pathname.startsWith(p));
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
// Fetch — cache-first for static assets, pass-through for everything else
// ---------------------------------------------------------------------------

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // --- Guards ---

  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;
  if (event.request.method !== 'GET') return;
  if (event.request.mode === 'navigate') return;
  if (SKIP_PATH_PREFIXES.some((p) => url.pathname.startsWith(p))) return;
  if (url.origin !== self.location.origin) return;

  // --- /sw-kill self-destruct ---

  if (url.pathname === '/sw-kill') {
    event.respondWith(
      self.registration.unregister()
        .then(() => caches.keys())
        .then((names) => Promise.all(names.map((n) => caches.delete(n))))
        .then(() => {
          console.log('[sw] self-destruct complete');
          return new Response('Service worker unregistered and caches cleared.', {
            status: 200,
            headers: { 'content-type': 'text/plain' },
          });
        })
        .catch((err) => {
          console.error('[sw] self-destruct failed', err);
          return new Response('Self-destruct failed', { status: 500 });
        }),
    );
    return;
  }

  // --- Cache-first handler ---

  let cacheWork;

  event.respondWith(
    (async () => {
      try {
        const cached = await caches.match(event.request);
        if (cached) return cached;
      } catch (err) {
        console.warn('[sw] cache.match failed', url.href, err);
      }

      let response;
      try {
        response = await fetch(event.request);
      } catch (err) {
        console.warn('[sw] fetch failed, checking cache fallback', url.href, err);
        return (await caches.match(event.request)) || Response.error();
      }

      if (!response.ok) return response;
      if (response.type === 'opaque') return response;

      if (isCacheable(url)) {
        const clone = response.clone();
        cacheWork = (async () => {
          try {
            const cache = await caches.open(CACHE_NAME);
            await cache.put(event.request, clone);
            // Trim cache if over limit
            const keys = await cache.keys();
            if (keys.length > MAX_CACHE_ENTRIES) {
              const toDelete = keys.slice(0, keys.length - MAX_CACHE_ENTRIES);
              await Promise.all(toDelete.map((r) => cache.delete(r)));
            }
          } catch (err) {
            console.warn('[sw] cache.put failed', url.href, err);
            postToClients({ type: 'sw-error', detail: `cache.put failed for ${url.pathname}` });
          }
        })();
      }

      return response;
    })(),
  );

  if (cacheWork) {
    event.waitUntil(cacheWork);
  }
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