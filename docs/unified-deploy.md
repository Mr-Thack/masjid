# Unified deployment — all page apps on masjid-live.pages.dev

**Status**: LIVE in production (2026-07-29). Consumer, TV, and admin are all
served from **one Cloudflare Pages project: `masjid-live`**
(https://masjid-live.pages.dev). The old per-app Pages projects
(`masjid-live-tv`, `masjid-live-admin`) have been **deleted** and their CORS
origins removed from the API — cutover is complete.

## What this is

All 3 client-facing apps deploy as **one merged Pages project** using Pages
"advanced mode": the merged output contains a `_worker.js` that the Pages
project runs for every request. Routes never collide because each app owns a
path namespace:

| Namespace | App | SPA fallback file |
|---|---|---|
| `/{masjid_slug}/*` (and everything else) | consumer | `__consumer_spa.html` |
| `/display/*` | tv | `__tv_spa.html` |
| `/admin/*`, `/login`, `/register` | admin | `__admin_spa.html` |

## Architecture

```
browser → Cloudflare edge → masjid-live Pages project
            │
            └─ _worker.js (Pages advanced mode, runs for EVERY request)
                 │
                 ├─ env.ASSETS.fetch(request) → real asset (js/css/png/
                 │   sw.js/manifest.json…) → return it
                 │
                 └─ 404 → pick SPA fallback by path prefix
                      → env.ASSETS.fetch('/__xxx_spa.html')  ← reads the
                        asset manifest directly; NOT an HTTP subrequest
                      → return with status 200 + forced headers:
                        content-type: text/html;charset=UTF-8
                        cache-control: no-cache, no-store, must-revalidate
```

The `_worker.js` source of truth lives at `workers/gateway/src/index.js`;
`tooling/merge-pages.js` copies it into `.merged/_worker.js` on every merge.
(The same file can be deployed standalone as a Worker for staging — that was
done as `masjid-gateway` during testing; it has since been deleted.)

### Why advanced mode instead of… (all tried or ruled out)

1. **A standalone Worker with a pages.dev hostname** — impossible:
   `*.pages.dev` hostnames belong to Pages projects and cannot be attached to
   Workers. Advanced mode gives the same Worker behavior while keeping the
   `masjid-live.pages.dev` domain.
2. **Pages Function doing `fetch(self)` subrequests** → the subrequest
   re-entered the same Function → **infinite loop**.
3. **`_redirects` with 200 rewrites** (`/display/* /__tv_spa.html 200` …) →
   Pages evaluates `_redirects` BEFORE static assets, trapping **every** path
   (including real assets) at one fallback file.

`env.ASSETS.fetch()` has none of these problems: it reads the asset manifest
directly and cannot loop.

## The merge pipeline (`tooling/merge-pages.js`)

1. Builds all 3 apps independently (`npm run build --workspace=…`).
   **Tolerates individual app failures** — merges whatever built; exits 1 only
   if ALL fail.
2. Renames each app's `adapter-static` fallback so they can't collide:
   - consumer `build/index.html` → `__consumer_spa.html`
   - tv `build/404.html` → `__tv_spa.html`
   - admin `build/index.html` → `__admin_spa.html`
3. Copies all 3 `build/` dirs into `.merged/`. `_app/immutable/*` filenames
   are content-hashed so chunks never collide (one shared SvelteKit internal
   chunk `wbPk3Yxo.js` is identical across apps — harmless).
4. Copies `workers/gateway/src/index.js` → `.merged/_worker.js`.
5. Writes `.merged/_headers` (see the Cache-Control lesson below).
6. Does **NOT** write `_redirects` — meaningless in advanced mode; the
   per-app `static/_redirects` leftovers were deleted from the repo.

### `VITE_API_URL` is build-time

Consumer and admin read `import.meta.env.VITE_API_URL`, inlined **at build
time**. If unset, they call their own origin → HTML instead of JSON → parse
errors. Always merge with:

```bash
VITE_API_URL=https://mapi.mr-thack.workers.dev node tooling/merge-pages.js
```

Verify: `grep -rl 'mapi\.mr-thack' .merged/_app/immutable/ | wc -l` → > 0.

## Deploy commands

```bash
# One-shot: build + merge + deploy to masjid-live (requires VITE_API_URL
# and Cloudflare credentials from .env.prod in the environment)
set -a; source .env.prod; set +a
VITE_API_URL=https://mapi.mr-thack.workers.dev node tooling/deploy-pages.js

# Or each app's `npm run deploy` does the same thing.
```

Deploying the API worker (mapi) — **build first, wrangler does NOT build**:

```bash
npm run build --workspace=@masjid/api
set -a; source .env.prod; set +a
cd apps/api
VAR_ARGS=(); for v in JWT_SECRET SQUARE_ACCESS_TOKEN SQUARE_APP_ID \
  SQUARE_LOCATION_ID BREVO_API_KEY SENDER_EMAIL SENDER_NAME \
  FORWARD_TO_EMAIL LOGGING_EMAIL API_URL LLM_API_KEY \
  VAPID_PUBLIC_KEY VAPID_PRIVATE_KEY; do
  val="${(P)v}"; [ -n "$val" ] && VAR_ARGS+=(--var "$v:$val")
done
npx wrangler@latest deploy --env production --keep-vars \
  --var ENVIRONMENT:production "${VAR_ARGS[@]}"
```

## Verification checklist (do ALL of these after a deploy)

1. **Route→SPA mapping** (hash-compare against local files — page content
   can't be checked with curl because nothing is prerendered):
   ```bash
   for f in __consumer_spa __tv_spa __admin_spa; do
     echo "$f: $(sha256sum .merged/$f.html | cut -c1-12)"; done
   for p in /masjid-al-noor /display/masjid-al-noor /admin/masjid-al-noor /login; do
     echo "$p: $(curl -s "https://masjid-live.pages.dev$p?cb=1" | sha256sum | cut -c1-12)"; done
   ```
   (The `?cb=1` cache-buster matters — see lesson 8 below.)
2. **Cache headers**: an `_app/immutable` chunk must have exactly
   `cache-control: public, max-age=31536000, immutable` (nothing appended).
   `/sw.js` must have `no-cache, no-store, must-revalidate`.
3. **CORS**: `curl -s -H "Origin: https://masjid-live.pages.dev" -D - -o /dev/null https://mapi.mr-thack.workers.dev/api/v1/masjids/masjid-al-noor | grep -i access-control-allow-origin`
4. **Rendered content in a real browser**: `/` shows "Please Verify Your
   URL", `/masjid-al-noor` shows live prayer times, `/display/<slug>` shows
   the TV board, `/login` shows the admin sign-in.
5. **Wait for edge propagation** before concluding anything is broken.

## Root `/` behavior — deliberate

`/` renders the consumer app's root page, which says:

> **Please Verify Your URL** — You seem to have made a mistake.

It does **NOT** redirect to any specific masjid. A redirect confused people
("why am I suddenly on some other masjid's page?"). Do not re-add one.

## Lessons (the hard-earned kind)

1. **`wrangler deploy` does not run your build.** For `apps/api` it uploads
   the prebuilt `.svelte-kit/cloudflare/_worker.js`. Editing source and
   deploying without `npm run build` silently deploys stale code.
2. **`_headers` rules COMBINE.** Cloudflare appends the values of *every*
   matching pattern (comma-joined). A `/*` catch-all with
   `Cache-Control: no-store` plus a `/_app/immutable/*` rule with `immutable`
   yields a contradictory header on every chunk — the strictest directive
   wins, defeating immutable caching. Rule: security headers on broad
   patterns are fine; **Cache-Control only on narrow patterns**
   (`/_app/immutable/*`, `/sw.js`). SPA fallbacks get `no-store` from
   `_worker.js` instead.
3. **Use `--keep-vars`** when deploying the API worker manually (and in CI).
   Wrangler v4 deletes dashboard-set variables that aren't in config/`--var`
   (e.g. `LLM_API_KEY`, which is empty in `.env.prod` but may be set on the
   deployed worker).
4. **Build `--var` args with a loop, not `&&` chains.** An empty env var
   makes `[ -n "$VAR" ] && …` return 1 and silently aborts the chain — no
   deploy, no error.
5. **Check cwd before chaining commands.** The merge script lives at repo
   root; wrangler commands run elsewhere. A failed merge (wrong cwd) followed
   by a successful deploy = deploying stale `.merged`. The merge script
   resolves its own paths — call it by absolute path when chaining.
6. **Nothing is prerendered.** All 3 apps are pure SPAs. `curl` can verify
   the shell (hash) and headers, but *never* page content — use a real
   browser for content checks.
7. **Edge propagation lag.** After a deploy, different edge nodes serve old
   vs new versions for ~30s. Retry with `?cb=N` before debugging code that
   isn't broken.
8. **Stale CDN cache survives redeploys.** The OLD consumer Pages deployment
   sent cacheable HTML (`stale-while-revalidate` etc.); those responses were
   cached at the pages.dev shared CDN with `s-maxage=604800` (7 days) and
   **neither new deployments nor any API purge endpoint clears them** (the
   Pages purge API path returns `method_not_allowed`). The new deployment's
   `no-store` SPA responses can never be poisoned this way, but entries
   cached before the cutover linger until they expire. Mitigations: users
   hard-refresh (Ctrl+Shift+R sends `no-cache`, forcing revalidation);
   everyone else gets fresh content. Always verify with `?cb=N` first.
9. **zsh gotchas**: `$VAR` inside a double-quoted `node -e "…"` string is
   expanded by the outer shell before node runs — use single quotes. And
   `.env.prod` values containing spaces must be quoted, otherwise sourcing
   truncates them (`command not found` warnings).
10. **Pages advanced mode runs `_worker.js` for EVERY request** (unlike
    Workers Static Assets, where matching assets bypass the Worker). The
    first line of the worker (`env.ASSETS.fetch(request)`) is therefore not
    just defensive — it IS the asset-serving path.

## Cutover history

Completed 2026-07-29: unified deploy went live on masjid-live.pages.dev;
the `masjid-live-tv` and `masjid-live-admin` Pages projects were deleted
(nobody was using them) and their origins removed from `ALLOWED_ORIGINS`
in `apps/api/src/hooks.server.ts`.
