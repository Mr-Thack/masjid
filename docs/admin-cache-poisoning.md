# Admin app cache-poisoning incident

## What was reported

> "Something wrong with the service worker in the admin page poisoning the clients."

## Investigation result

After searching `apps/admin` thoroughly, there is **no service worker in the admin app**:

- No `src/service-worker.*` file.
- No `navigator.serviceWorker.register('/sw.js')` in `app.html`.
- No `static/sw.js` file.

The only active service worker in the repo is the consumer PWA worker at `apps/consumer/static/sw.js`, which belongs to the consumer app running on a separate origin in both local dev and production.

So: **we do not have a service worker in the admin page.** Push notifications are not implemented, and the admin dashboard is not intended to be offline-first, so there is no current justification for registering one.

## Root cause of the poisoning symptom

The admin app *did* have a poisoning vector, but it was HTTP-cache-based, not service-worker-based.

`apps/admin/static/_headers` contained:

```text
/*
  Cache-Control: public, max-age=3600, stale-while-revalidate=86400
  Access-Control-Allow-Origin: *
```

Because `@sveltejs/adapter-static` is configured with `fallback: 'index.html'`, **every path** returns `index.html` with a `200` response. The catch-all header above therefore cached the SPA shell (i.e. `index.html`) for up to an hour and allowed stale-while-revalidate for up to a day.

After a deployment, returning admins could receive a cached `index.html` whose `<script src="/_app/immutable/entry/app.<OLD_HASH>.js">` references no longer existed. The browser would fail to load the old JS, hydration would break, and the app appeared "dead" until the cache entry expired or the user cleared site data.

This is the same **persistent client-poisoning** pattern as the old consumer service-worker bug described in `docs/consumer-service-worker.md`, just through `Cache-Control` instead of `CacheStorage`.

## What was changed

### 1. Hardened `apps/admin/static/_headers` (later superseded — see below)

- Only immutable hashed assets get long-term caching:
  - `/_app/immutable/*`
  - `/*.js`, `/*.css`, `/*.png`, `/*.svg`, `/*.ico`, `/*.woff2`, `/*.webmanifest`, `/*.json`
- Every other path, including `/index.html` and all SPA rewrites, now returns:
  ```http
  Cache-Control: no-cache, no-store, must-revalidate
  ```
- Added `Permissions-Policy: camera=(), microphone=(), geolocation=()`.
- Removed the broad `Access-Control-Allow-Origin: *` from the catch-all.
- Made `/sw.js` itself uncacheable (`no-store`) defensively, in case a worker is ever added intentionally.

### 2026-08 update — file deleted, rules centralized

The admin app's standalone `static/_headers` was **deleted** during the
caching-strategy consolidation: production serves admin exclusively through
the merged `masjid-live` Pages project, whose canonical `_headers` is written
by `tooling/merge-pages.js` (immutable only for `/_app/immutable/*`, no-store
for `/sw.js` and direct `/__*_spa.html` hits, `max-age=3600` for unversioned
root statics, security headers on `/*` — and **never** a Cache-Control on a
catch-all, because rules combine). The old per-app file was dead config in
production and dangerous if ever deployed standalone (`/*.js` + `/*.json`
immutable would have cached `version.json`/`manifest.json` forever).

### 2. `/sw-kill` escape hatch — moved to the gateway (2026-08)

The recovery route used to be a page-level script in the admin `app.html`.
On the unified origin that was broken by construction: `/sw-kill` routes to
the *consumer* SPA fallback, so the admin script could never run there.
The route is now served by the **gateway worker**
(`workers/gateway/src/index.js`) before SPA routing — one canonical URL,
works for all three apps, unregisters every service worker for the origin,
purges all `CacheStorage` caches, redirects to `/`. It is permanent
infrastructure; do not remove it.

## Recovery steps

If an admin client is stuck with a stale app shell:

1. Visit `https://masjid-live.pages.dev/sw-kill`. The kill page will clear any stale registration and caches, then reload the app.
2. If that fails, open DevTools → **Application → Storage → Clear site data**, then hard-reload with **Ctrl+Shift+R** (or **Cmd+Shift+R** on macOS).

## Future note

If the admin app ever genuinely needs a service worker (e.g. for push notifications):

- It must be registered intentionally, not via accidental caching.
- It must follow the hardening checklist in `docs/consumer-service-worker.md`
  ("Re-adding a service worker"): scheme/method/origin guards, versioned
  cache names, no navigation caching, and verification that the gateway
  `/sw-kill` route clears it.
- Until then, the admin app remains service-worker-free.
