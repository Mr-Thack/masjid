// masjid-gateway — unified static host for consumer + tv + admin apps.
//
// Static assets (js/css/images, sw.js, manifest.json, …) are served directly
// by the Workers Static Assets binding. When no asset matches the path, this
// Worker picks the SPA fallback for the route namespace:
//
//   /display/*           → __tv_spa.html
//   /admin/*, /login, /register → __admin_spa.html
//   everything else      → __consumer_spa.html
//
// The fallback files are produced by tooling/merge-pages.js (each app's
// adapter-static fallback renamed so they can't collide).

const TV_PREFIX = '/display';
const ADMIN_PATHS = ['/admin', '/login', '/register'];

function pickSpaFallback(pathname) {
  if (pathname === TV_PREFIX || pathname.startsWith(TV_PREFIX + '/')) {
    return '/__tv_spa.html';
  }
  if (ADMIN_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'))) {
    return '/__admin_spa.html';
  }
  return '/__consumer_spa.html';
}

export default {
  async fetch(request, env) {
    // Defensive: with default config the Worker only runs on asset misses,
    // but if run_worker_first is ever enabled, real assets still win.
    const asset = await env.ASSETS.fetch(request);
    if (asset.status !== 404) return asset;

    const url = new URL(request.url);
    const spa = await env.ASSETS.fetch(new URL(pickSpaFallback(url.pathname), url));
    if (!spa.ok) {
      return new Response('Not found', { status: 404 });
    }

    const headers = new Headers(spa.headers);
    headers.set('content-type', 'text/html;charset=UTF-8');
    // Never cache SPA fallbacks (see docs/admin-cache-poisoning.md).
    headers.set('cache-control', 'no-cache, no-store, must-revalidate');
    return new Response(spa.body, { status: 200, headers });
  },
};
