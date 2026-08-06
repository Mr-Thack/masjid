// masjid-live SPA router — shipped as `_worker.js` in the merged Pages deploy
// (Pages "advanced mode"), produced by tooling/merge-pages.js. It can also be
// deployed standalone as the masjid-gateway staging Worker.
//
// Every request arrives here. Real assets (js/css/images, sw.js,
// manifest.json, …) are served via the ASSETS binding; when no asset matches
// the path, we decide what the miss means:
//
//   /sw-kill                  → permanent cache/SW recovery page (below)
//   asset-like miss           → real 404 + no-store (NEVER the SPA shell —
//                               serving HTML for a missing JS chunk makes the
//                               browser execute markup as JS: white-screen)
//   /display/*                → __tv_spa.html
//   /admin/*, /login, /register → __admin_spa.html
//   everything else           → __consumer_spa.html
//
// The fallback files are produced by tooling/merge-pages.js (each app's
// adapter-static fallback renamed so they can't collide).

const TV_PREFIX = '/display';
const ADMIN_PATHS = ['/admin', '/login', '/register'];

const NO_STORE = 'no-cache, no-store, must-revalidate';

function pickSpaFallback(pathname) {
  if (pathname === TV_PREFIX || pathname.startsWith(TV_PREFIX + '/')) {
    return '/__tv_spa.html';
  }
  if (ADMIN_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'))) {
    return '/__admin_spa.html';
  }
  return '/__consumer_spa.html';
}

// A path is "asset-like" if it lives under /_app/ or its final segment carries
// a file extension. All real routes (masjid slugs, /display/*, /admin/*,
// /login, /register) are extension-less, so this never eats a legit route.
function looksLikeAsset(pathname) {
  if (pathname.startsWith('/_app/')) return true;
  const segment = pathname.slice(pathname.lastIndexOf('/') + 1);
  return segment.includes('.');
}

// Permanent recovery hatch. Unregisters every service worker registered for
// this origin and purges all CacheStorage caches, then lands on /. Served by
// the gateway BEFORE SPA routing so one canonical URL works for all three
// apps (consumer/TV/admin) — an app-shell-level kill script can only ever
// exist in one app. Keep this route forever: it is the documented escape
// hatch for any future client-side caching bug.
const SW_KILL_HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="robots" content="noindex" />
<title>Clearing cached data…</title>
<style>
  body { background: #030712; color: #f9fafb; font-family: system-ui, sans-serif;
         display: flex; align-items: center; justify-content: center;
         min-height: 100dvh; margin: 0; text-align: center; padding: 2rem; }
  p { color: #9ca3af; }
</style>
</head>
<body>
<div>
  <h1>Clearing cached app data…</h1>
  <p id="status">You will be redirected in a moment.</p>
  <noscript><p>JavaScript is required here. Please clear site data manually
  (browser settings → privacy → site data) for this origin.</p></noscript>
</div>
<script>
(async function () {
  var status = document.getElementById('status');
  try {
    if ('serviceWorker' in navigator) {
      var regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map(function (r) { return r.unregister(); }));
    }
    if ('caches' in window) {
      var names = await caches.keys();
      await Promise.all(names.map(function (n) { return caches.delete(n); }));
    }
    status.textContent = 'Done. Loading fresh…';
  } catch (err) {
    status.textContent = 'Cleanup partially failed; continuing anyway.';
  }
  location.replace('/');
})();
</script>
</body>
</html>`;

export default {
  async fetch(request, env) {
    // Real assets always win.
    const asset = await env.ASSETS.fetch(request);
    if (asset.status !== 404) return asset;

    const url = new URL(request.url);
    const { pathname } = url;

    // Recovery hatch (permanent — see SW_KILL_HTML above).
    if (pathname === '/sw-kill') {
      return new Response(SW_KILL_HTML, {
        status: 200,
        headers: {
          'content-type': 'text/html;charset=UTF-8',
          'cache-control': NO_STORE,
        },
      });
    }

    // Asset-like misses are real 404s. Falling through to the SPA shell here
    // is what turned "stale HTML references deleted chunk" into a white
    // screen: the browser would get text/html with a 200 and try to parse it
    // as JavaScript. A clean 404 lets SvelteKit's failed-import recovery
    // (full reload → fresh HTML → fresh chunks) do its job.
    if (looksLikeAsset(pathname)) {
      return new Response('Not found', {
        status: 404,
        headers: {
          'content-type': 'text/plain;charset=UTF-8',
          'cache-control': NO_STORE,
        },
      });
    }

    const spa = await env.ASSETS.fetch(
      new Request(new URL(pickSpaFallback(pathname), url)),
    );
    if (!spa.ok) {
      return new Response('Not found', {
        status: 404,
        headers: { 'cache-control': NO_STORE },
      });
    }

    const headers = new Headers(spa.headers);
    headers.set('content-type', 'text/html;charset=UTF-8');
    // Never cache SPA fallbacks (see docs/admin-cache-poisoning.md).
    headers.set('cache-control', NO_STORE);
    return new Response(spa.body, { status: 200, headers });
  },
};
