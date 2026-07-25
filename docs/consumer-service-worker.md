# Consumer service worker — hardening guide

## Why we have a service worker

The consumer app (`apps/consumer`) registers `/sw.js` so that:

- Prayer-time assets can be cached for offline use.
- The app qualifies as an installable PWA.
- Push notifications can be handled in the future.

The app renders fine without the service worker; the SW is an enhancement, not a requirement.

## What went wrong (July 2026 incident)

A buggy service-worker state in the browser caused the consumer page to fail hydration permanently in normal Chromium windows while still working in Incognito.

The root triggers were:

1. The SW did not filter by URL scheme.
2. Extension requests (e.g. `chrome-extension://`) were being intercepted and passed to `cache.put()`, which threw because the Cache API only accepts `http:`/`https:` URLs.
3. The SW registration and `CacheStorage` are persistent per origin. Once the SW or its cache entered a bad state, it survived reloads, browser restarts, and extension disabling.
4. DevTools “Disable cache” only bypasses the HTTP cache, **not** `CacheStorage`, service workers, or other origin storage.

Clearing site data fixed it because it unregistered the SW and deleted its caches.

## Current state

`apps/consumer/static/sw.js` now has an early return for non-HTTP(S) requests:

```js
if (url.protocol !== 'http:' && url.protocol !== 'https:') return;
```

This stops `chrome-extension` errors and prevents extension resources from corrupting SW state.

## Recommended hardening

### 1. Version the cache name with the build

Static cache names (`masjid-consumer-v1`) let stale entries live forever. Use a build hash instead:

```js
const CACHE_NAME = `masjid-consumer-${BUILD_HASH}`;
```

This is a compile-time replacement that must be injected by the build step (e.g. Vite `define`).

### 2. Do not cache navigation / HTML fallback

The current SW already avoids caching navigation requests, but make that explicit:

```js
if (event.request.mode === 'navigate') return;
```

Caching the fallback `index.html` under a static name is a common source of “live but broken forever” PWAs.

### 3. Add an emergency self-destruct route

Because you cannot remotely kill a bad SW from the server, the SW itself should be able to uninstall when it sees a kill signal:

```js
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (url.pathname === '/sw-kill') {
    event.respondWith(
      (async () => {
        await self.registration.unregister();
        const names = await caches.keys();
        await Promise.all(names.map((n) => caches.delete(n)));
        return new Response('Service worker unregistered', { status: 200 });
      })(),
    );
    return;
  }
});
```

A bad deploy can then be mitigated by asking affected users to visit `/sw-kill`, or by returning a specific header the SW checks.

### 4. Surface SW errors to the user

Right now the SW silently catches cache errors and falls back. During an incident this makes diagnosis hard. Consider logging to the page via `postMessage`, or at least reporting failures in the console.

### 5. Decision point: do we need a service worker at all?

Pros:
- Offline prayer-time access.
- Installable PWA.
- Push notification foundation.

Cons:
- Sticky, persistent state that can outlast bad deployments.
- Requires operational discipline (versioned caches, kill switch).

If offline prayer times are not a priority, removing the SW eliminates this entire class of risk.

## How to recover a broken local session

1. DevTools → **Application** → **Storage** → **Clear site data** (check all boxes, including “Unregister service workers”).
2. Or visit `chrome://serviceworker-internals/` and unregister the entry for `localhost:5175` / the production origin.
3. Hard reload with **Ctrl+Shift+R**.

## A similar poisoning pattern in the admin app

The admin app (`apps/admin`) does **not** register a service worker. However, it had an analogous client-poisoning vector in its `static/_headers` file:

```text
/*
  Cache-Control: public, max-age=3600, stale-while-revalidate=86400
```

Because `@sveltejs/adapter-static` rewrites every path to `index.html`, this catch-all header cached the SPA shell for up to an hour and allowed stale-while-revalidate for a day. After a deployment, a stale `index.html` could reference immutable JS/CSS files that no longer existed, producing the same permanent hydration/breakage that the consumer service-worker bug caused.

The admin `_headers` were hardened so only immutable hashed assets are long-cached, while the shell gets `no-cache, no-store, must-revalidate`. A page-level `/sw-kill` route was also added to clear any stale service-worker/cache state. See `docs/admin-cache-poisoning.md` for the full write-up.

## References

- `apps/consumer/static/sw.js`
- `apps/consumer/src/app.html` (registers the SW)
- `apps/admin/static/_headers`
- `docs/admin-cache-poisoning.md`
