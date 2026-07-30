# Code Quality Audit (2026-07-30)

Snapshot: 48,242 lines, 348 files. No refactoring in recent history.

## 1. Duplication in WhatsApp worker (~200 lines)

The bot logic was extracted from the worker into `@masjid/agent` (see
`docs/bot-abstraction.md`), but format/mutation helpers were left behind in
two places.

### 1a. `format.ts` ↔ `runner.ts` overlap (~75 dup lines)

`workers/whatsapp/src/agent/runner.ts` (230 lines) contains near-identical
copies of functions that live in `workers/whatsapp/src/agent/format.ts` (149
lines):

| Function | runner.ts | format.ts |
|---|---|---|
| `formatMutationAsWhatsApp` | 151-189 | 17-72 |
| `domainLabel` + `DOMAIN_LABELS` | 191-200 | 5-11 |
| `truncate` | 202-204 | 13-15 |
| `formatNoChangesMessage` | 206-212 | 123-129 |

`runner.ts` should import these from `format.ts` instead of redefining them.

### 1b. `proxy.ts` mechanical wrappers (~90 dup lines)

`workers/whatsapp/src/proxy.ts` (114 lines) exports 24 functions that all
follow the identical pattern:

```ts
export function someApiCall(..., env: Env, adminId: string, masjidId: string) {
  return coreSomeApiCall(..., config(env, adminId, masjidId));
}
```

Replace with a single higher-order function:

```ts
function withConfig<F extends (cfg: ApiClientConfig, ...args: any[]) => any>(fn: F) {
  return (env: Env, adminId: string, masjidId: string, ...args: Tail<Parameters<F>>) =>
    fn(config(env, adminId, masjidId), ...args);
}
```

### 1c. Dead / trivial code

- `workers/whatsapp/src/agent/tools.ts`: 1-line re-export. Delete; the sole
  caller (`agent/runner.ts`) can import from `@masjid/agent` directly.
- `workers/whatsapp/src/agent/format.ts` lines 2-3: imports `coreBuildDiffReceipt`
  and `buildNoChangesResult` — never called anywhere in the file.
- `workers/whatsapp/src/agent/runner.ts` line 119-121: `formatAsWhatsApp`
  is an identity function that returns its input unchanged.

## 2. Shared utility consolidation (~25 lines)

`formatTime()` is duplicated in two places:

| File | Lines |
|---|---|
| `apps/tv/src/lib/time.ts` | 12 |
| `apps/consumer/src/lib/time.ts` | 13 |

Move to `@masjid/ui-utils` (which already hosts shared theme/ceremony code).

## 3. Large Svelte pages (maintenance debt, no line savings)

These pages exceed 300 lines and mix markup, script, and style in one file:

| File | Lines |
|---|---|
| `admin/settings/maktab/+page.svelte` | 637 |
| `tv/display/[slug]/+page.svelte` | 557 |
| `consumer/[slug]/+page.svelte` | 473 |
| `consumer/maktab/enroll/+page.svelte` | 439 |
| `admin/settings/profile/+page.svelte` | 362 |
| `admin/settings/prayer/+page.svelte` | 335 |
| `admin/settings/theme/+page.svelte` | 324 |
| `admin/register/+page.svelte` | 305 |
| `admin/settings/announcements/+page.svelte` | 268 |
| `admin/settings/jumuah/+page.svelte` | 236 |

Extract `<script>` logic into companion `+page.svelte.ts` modules. SvelteKit
supports co-located modules that don't create routes. This doesn't reduce
lines but makes each file do one thing.

## 4. TV CSS file (937 lines, single file)

`apps/tv/src/app.css` is the largest file in the project. It's hand-written
(Tailwind was removed after it failed in the static build) and carries two
complete style systems (Mishkaat + Sakeenah). This is legitimate density, not
bloat — but it's fragile. Any future style work should consider splitting it
by concern (layout, ceremony states, Mishkaat, Sakeenah) and importing via
`@import` or CSS layers.

## 5. Build artifacts in git (1.2 MB, 125 files)

The `.merged/` directory contains the unified Pages deploy output generated
by `tooling/merge-pages.js`. It's committed to git alongside source code.
These are generated files (hashed JS chunks, SPA fallbacks, gateway worker)
that should live only in CI artifacts or the deploy pipeline. Adding
`.merged/` to `.gitignore` removes ~1,250 lines from the tracked codebase
and eliminates merge conflicts on generated content.

## 6. Historical docs that could be archived (~460 lines)

Three docs capture completed/fixed work and have no ongoing value:

| File | Lines | Why |
|---|---|---|
| `docs/adhan-js-migration.md` | 297 | Migration completed |
| `docs/svelte-hydration-firstchild-issue.md` | 94 | Bug fixed, lesson captured in AGENTS.md §Consumer service worker |
| `docs/admin-cache-poisoning.md` | 71 | Fixed, lesson captured in AGENTS.md §Admin app |

Move to `docs/archive/` or remove — the relevant lessons are already in
AGENTS.md.

## 7. Test coverage profile (healthy, no action)

75 test files, 14,410 lines, ~30% of codebase. Per-component ratios:

| Component | Test ratio |
|---|---|
| WhatsApp worker | 65% |
| API | 53% |
| TV | 21% |
| Consumer | 15% |
| Admin | 14% |

The low consumer/admin ratios are expected for UI-heavy code with jsdom.
No action needed — this is above industry average.

## Summary

| Area | Lines saved | Effort |
|---|---|---|
| WhatsApp worker dedup | ~200 | Medium |
| Consolidate `formatTime` | ~25 | Low |
| Split large Svelte pages | 0 lines, maintenance win | Medium |
| Gitignore `.merged/` | ~1,250 (tracked) | Trivial |
| Archive historical docs | ~460 | Trivial |
| **Total** | **~1,935** | 2-3 days of focused work |

None of this is urgent. The codebase is in good shape — the duplication is
a clean artifact of the bot extraction, and the large files are mostly dense
Svelte pages that work correctly.