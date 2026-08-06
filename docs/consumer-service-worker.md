# Consumer service worker — removed (2026-08) — and how to re-add it safely

## Current state: no service worker

The consumer app **does not register a service worker**. The SW was removed
because it provided no user-facing value — caching had already been disabled
(pass-through fetch handler), push notifications were never wired up (no
`pushManager.subscribe()` anywhere, push worker is a skeleton), and offline
mode was never implemented — while remaining a root-scope worker that
controlled **every** page on the unified origin (consumer + `/display/*` TV +
`/admin/*`). A root-scope SW is a loaded gun: any careless edit affects all
three apps, and `CacheStorage` poisoning is a permanent per-browser condition
(July 2026 incident, below).

**PWA installability is unaffected.** Chrome/Edge dropped the SW requirement
for installability (manifest + HTTPS suffice); iOS "Add to Home Screen" never
required one. `manifest.json` + icons remain in place.

Two permanent safety mechanisms remain:

### 1. The suicide worker (`apps/consumer/static/sw.js`)

Browsers that still carry an old worker registration pick up the new `/sw.js`
on their next update check (it is served `no-store`). That file's only job:

1. purge every `CacheStorage` cache for the origin,
2. `self.registration.unregister()`.

It has **no fetch handler** — it intercepts nothing. **Keep serving it
indefinitely**: it costs nothing and heals dormant installs whenever they
return. Do not delete it just because "surely everyone's updated by now" —
a browser that hasn't visited since the old SW shipped still has it.

### 2. The `/sw-kill` recovery hatch (gateway route)

`https://masjid-live.pages.dev/sw-kill` is served by the **gateway worker**
(`workers/gateway/src/index.js`) *before* SPA routing. It is a tiny static
page that unregisters all service workers for the origin, purges all caches,
and redirects to `/`. Serving it from the gateway (rather than an app shell)
means one canonical URL works for all three apps — an app-shell-level script
can only ever exist in the shell that happens to serve that path (this exact
flaw made the old app-level kill scripts unreachable in production).

This route is **permanent infrastructure**, not a migration shim. Keep it
forever — it is the documented escape hatch for any future client-side
caching bug.

## What caching the consumer app relies on now (HTTP only)

One caching layer, configured in exactly one place
(`tooling/merge-pages.js` → `.merged/_headers` + gateway code):

| Resource | Header | Why |
|---|---|---|
| `/_app/immutable/*` (content-hashed JS/CSS) | `public, max-age=31536000, immutable` | hash changes when content changes — always safe |
| SPA fallbacks (via gateway) | `no-cache, no-store, must-revalidate` | stale HTML referencing deleted chunks = white screen |
| `/sw.js` | `no-cache, no-store, must-revalidate` | suicide worker must propagate immediately |
| `/manifest.json`, `/icon-*.png` | `public, max-age=3600` | unversioned — bounded staleness, never immutable |
| asset-like path with no matching file | **404** + no-store (gateway) | serving SPA HTML for a missing chunk made browsers parse markup as JS |
| API JSON | no cache headers → no caching | (short edge caching is a possible future phase — measure first) |

## What went wrong (July 2026 incident)

A buggy service-worker state in the browser caused the consumer page to fail
hydration permanently in normal Chromium windows while still working in
Incognito. Root triggers:

1. The SW did not filter by URL scheme — `chrome-extension://` requests were
   passed to `cache.put()`, which threw.
2. SW registration and `CacheStorage` are persistent per origin; the bad
   state survived reloads, restarts, and extension disabling.
3. DevTools "Disable cache" bypasses only the HTTP cache, **not**
   `CacheStorage` or service workers.

Clearing site data fixed it. The SW was later reduced to pass-through, then
removed entirely (2026-08).

## Re-adding a service worker (when push/offline actually ships)

Design it as part of that feature work, with this checklist:

- **Versioned cache name** injected at build time (`masjid-consumer-<hash>`);
  purge all other caches on activate.
- **Guards, early returns**: non-`http(s)` schemes, non-`GET` methods,
  `mode === 'navigate'`, cross-origin URLs, and `/api/` paths all bypass.
- **Never cache HTML** — navigations pass through (the "live but broken
  forever" PWA failure mode).
- **Opaque responses** (status 0) are never cached.
- **Cache trim** (max entries) to bound growth.
- **Root-scope awareness**: the worker controls `/display/*` and `/admin/*`
  too — decide explicitly what it does with those paths.
- **Kill switch**: verify `/sw-kill` (gateway) still clears it — it will,
  since it unregisters *all* registrations.
- **Tests**: integration tests must cover registration, cache versioning,
  kill-switch behavior, and the guards. The old suite
  (`apps/consumer/tests/sw-integration.test.js`, pre-removal) is in git
  history as a starting point.
- Serve `/sw.js` `no-store` forever (already the rule).

## How to recover a broken local session

1. Visit `/sw-kill` on the origin (works in production; locally there is no
   gateway, so use step 2).
2. DevTools → **Application** → **Storage** → **Clear site data** (all boxes,
   including "Unregister service workers").
3. Hard reload with **Ctrl+Shift+R**.

## References

- `apps/consumer/static/sw.js` — suicide worker
- `workers/gateway/src/index.js` — `/sw-kill` route + asset-miss 404
- `tooling/merge-pages.js` — canonical `_headers`
- `apps/consumer/tests/sw-integration.test.js` — removal-strategy tests
- `docs/admin-cache-poisoning.md` — the HTTP-cache twin of this incident
- `docs/unified-deploy.md` — deployment + `_headers` combining rules
