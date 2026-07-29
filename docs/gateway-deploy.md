# Unified gateway deployment (workers/gateway)

**Status**: staging live at `https://masjid-gateway.mr-thack.workers.dev` (2026-07-29).
Production still uses the 3 separate Pages projects until cutover.

## What this is

All 3 client-facing apps (consumer, TV, admin) are deployed as **one Cloudflare
Worker with Static Assets** instead of 3 separate Pages projects. Their routes
never collide because each app owns a path namespace:

| Namespace | App | SPA fallback file |
|---|---|---|
| `/{masjid_slug}/*` (and everything else) | consumer | `__consumer_spa.html` |
| `/display/*` | tv | `__tv_spa.html` |
| `/admin/*`, `/login`, `/register` | admin | `__admin_spa.html` |

## Architecture

```
browser → Cloudflare edge
            │
            ├─ path matches a real asset (js/css/png/sw.js/manifest.json…)
            │     → served directly by the Static Assets binding
            │     → Worker NEVER runs for these
            │
            └─ no asset match
                  → Worker runs (workers/gateway/src/index.js)
                  → picks SPA fallback by path prefix
                  → env.ASSETS.fetch('/__xxx_spa.html')  ← reads the asset
                    manifest directly; NOT an HTTP subrequest
                  → returns it with status 200 + forced headers:
                    content-type: text/html;charset=UTF-8
                    cache-control: no-cache, no-store, must-revalidate
```

### Why not Pages Functions or `_redirects`? (both tried, both failed in prod)

1. **Pages Function doing `fetch(self)` subrequests** → the subrequest
   re-entered the same Function → **infinite loop**. There is no way to fetch
   "the static asset that would have been served" from inside a Pages Function
   without `env.ASSETS`, which Pages Functions don't get.
2. **`_redirects` with 200 rewrites** (`/display/* /__tv_spa.html 200` …) →
   Pages evaluates `_redirects` BEFORE static assets, and a splat rule at the
   wrong precedence traps **every** path (including real assets) at one
   fallback file. Ordering tricks did not save it.

Worker + Static Assets has neither problem: real assets are served before the
Worker is consulted, and `env.ASSETS.fetch()` cannot loop.

## The merge pipeline (`tooling/merge-pages.js`)

1. Builds all 3 apps independently (`npm run build --workspace=…`).
   **Tolerates individual app failures** — merges whatever built; exits 1 only
   if ALL fail. (An app with a broken build must not block deploying fixes to
   the other two.)
2. Renames each app's `adapter-static` fallback so they can't collide in the
   merged directory:
   - consumer `build/index.html` → `__consumer_spa.html`
   - tv `build/404.html` → `__tv_spa.html`
   - admin `build/index.html` → `__admin_spa.html`
3. Copies all 3 `build/` dirs into `.merged/`. `_app/immutable/*` filenames are
   content-hashed, so chunks from different apps never collide (one shared
   SvelteKit internal chunk `wbPk3Yxo.js` is identical across apps — harmless).
4. Writes `.merged/_headers` (see the Cache-Control lesson below).
5. Does **NOT** write `_redirects` — Workers Static Assets ignores it, and the
   per-app `static/_redirects` leftovers were deleted from the repo for the
   same reason.

### `VITE_API_URL` is build-time

Consumer and admin read `import.meta.env.VITE_API_URL`, which Vite inlines
**at build time**. If unset, they fall back to relative paths and call the
gateway's own origin → HTML instead of JSON → parse errors. Always merge with:

```bash
VITE_API_URL=https://mapi.mr-thack.workers.dev node tooling/merge-pages.js
```

Verify it landed: `grep -rl 'mapi\.mr-thack' .merged/_app/immutable/ | wc -l`
should be > 0 (currently ~5 chunks).

## Deploy commands

```bash
# 1. Build + merge the 3 apps (from repo root — the script resolves its own paths)
VITE_API_URL=https://mapi.mr-thack.workers.dev node tooling/merge-pages.js

# 2. Deploy the gateway worker (from workers/gateway)
set -a; source .env.prod; set +a
cd workers/gateway && npx wrangler@latest deploy
```

Deploying the API worker (mapi) — **build first, wrangler does NOT build for you**:

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

1. **Route→SPA mapping** (hash-compare against local files — content can only
   be verified this way or in a browser, because nothing is prerendered):
   ```bash
   for f in __consumer_spa __tv_spa __admin_spa; do
     echo "$f: $(sha256sum .merged/$f.html | cut -c1-12)"; done
   for p in /masjid-al-noor /display/masjid-al-noor /admin/masjid-al-noor /login; do
     echo "$p: $(curl -s https://masjid-gateway.mr-thack.workers.dev$p | sha256sum | cut -c1-12)"; done
   ```
2. **Cache headers**: an `_app/immutable` chunk must have exactly
   `cache-control: public, max-age=31536000, immutable` (nothing appended).
   `/sw.js` must have `no-cache, no-store, must-revalidate`.
3. **CORS**: `curl -s -H "Origin: https://masjid-gateway.mr-thack.workers.dev" -D - -o /dev/null https://mapi.mr-thack.workers.dev/api/v1/masjids/masjid-al-noor | grep -i access-control-allow-origin`
4. **Rendered content in a real browser**: `/` shows "Please Verify Your URL",
   `/masjid-al-noor` shows live prayer times (proves SPA + API + CORS).
5. **Wait for edge propagation** before concluding anything is broken — see
   lessons.

## Root `/` behavior — deliberate

`/` renders the consumer app's root page, which says:

> **Please Verify Your URL** — You seem to have made a mistake.

It does **NOT** redirect to any specific masjid. A redirect confused people
("why am I suddenly on some other masjid's page?"). Do not re-add one.

## Lessons (the hard-earned kind)

1. **`wrangler deploy` does not run your build.** For `apps/api` it uploads the
   prebuilt `.svelte-kit/cloudflare/_worker.js`. Editing source and deploying
   without `npm run build` silently deploys stale code. (A CORS fix "didn't
   work" in prod for exactly this reason — the old worker kept running.)
2. **`_headers` rules COMBINE.** Cloudflare appends the values of *every*
   matching pattern (comma-joined). A `/*` catch-all with
   `Cache-Control: no-store` plus a `/_app/immutable/*` rule with `immutable`
   yields `no-cache, no-store, must-revalidate, public, max-age=31536000,
   immutable` on every chunk — the strictest directive wins in browsers, so
   immutable caching was completely defeated. Rule: security headers on broad
   patterns are fine; **Cache-Control only ever on narrow patterns**
   (`/_app/immutable/*`, `/sw.js`). SPA fallbacks get their `no-store` from
   the gateway Worker code instead.
3. **Use `--keep-vars`** when deploying the API worker manually. Wrangler v4
   deletes dashboard-set variables that aren't in your config/`--var` list
   (e.g. `LLM_API_KEY`, which is empty in `.env.prod` but may be set on the
   deployed worker). CI has the same `--var` pattern.
4. **Build `--var` args with a loop, not `&&` chains.** An empty env var makes
   `[ -n "$VAR" ] && …` return 1 and silently aborts the entire `&&` chain —
   the deploy then never runs and you get no output and no error.
5. **Check cwd before chaining commands.** The merge script lives at repo
   root; wrangler for the gateway runs in `workers/gateway`. A failed merge
   (wrong cwd) followed by a successful deploy = you just deployed the stale
   `.merged` from before. The merge script resolves its own paths, so call it
   by absolute path when chaining.
6. **Nothing is prerendered.** All 3 apps are pure SPAs (`adapter-static`
   fallback only). `curl` can verify the shell (hash) and headers, but *never*
   page content — use a real browser for content checks.
7. **Edge propagation lag.** After a Worker deploy, different edge nodes serve
   old vs new versions for up to ~30s. Two curls seconds apart can return
   different SPA hashes. Retry with a cache-busting query (`?cb=N`) a few
   times before debugging code that isn't broken.
8. **zsh gotchas that cost real time**: `$VAR` inside a double-quoted
   `node -e "…"` string is expanded by the outer shell (which doesn't have
   the prefix assignment) before node ever runs — use single quotes for test
   harnesses. And `.env.prod` values containing spaces must be quoted
   (`SENDER_NAME="…"`), otherwise sourcing the file truncates the value and
   prints `command not found`.
9. **Static Assets honors `_headers` but NOT `_redirects`.** Redirect/rewrite
   logic belongs in the Worker.
10. **`html_handling = "none"` + `not_found_handling = "none"`** in
    `workers/gateway/wrangler.toml` keep asset lookup literal and pass all
    misses to the Worker. Don't enable `run_worker_first` — the Worker's
    first line defends against it (`env.ASSETS.fetch(request)` returns any
    real asset before the SPA logic), but there's no reason to pay for the
    extra invocation on every asset request.

## Cutover plan (not done yet)

1. Commit this work on `unified-pages-deploy` and merge to master.
2. Update `.github/workflows/deploy.yml`: replace the 3-project Pages deploy
   with: `npm ci` → merge (with `VITE_API_URL` secret) → `wrangler deploy`
   in `workers/gateway`.
3. Attach the production custom domain / `masjid-live.pages.dev` hostname to
   the gateway Worker (Workers → masjid-gateway → Domains).
4. Verify production traffic, then delete the 3 old Pages projects.
5. Remove the old Pages origins (`masjid-live-admin.pages.dev`,
   `masjid-live-tv.pages.dev`) from `ALLOWED_ORIGINS` in
   `apps/api/src/hooks.server.ts` and redeploy the API.
