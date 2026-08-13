# Consumer Homepage Overhaul — Agent Spec

> **Status:** Active workstream (one-night sprint). Read this entire file before starting.
> **Goal:** Make the consumer homepage genuinely *beautiful* so it can be presented to the masjid board as the primary option. This is a visual/design overhaul, not a backend rewrite.

### What changed in this revision (read if you saw an older draft)

- **No new DB columns.** `photo_url`/`logo_url` columns and the `style_options` "mirror" are gone. Photo/logo/WhatsApp-link are `style_options` keys only (`photoUrl`, `logoUrl`, `whatsappGroupUrl`). No `schema.sql` / Drizzle / `ensureTables` / `check-schema` changes.
- **Corrected the passthrough claim.** `style_options` is *not* a single passthrough everywhere: the API read path and the Zod write path pass unknown keys through, but the consumer-side resolver (`parseStyleOptions`/`resolveStyleOptions` in `@masjid/ui-utils`) **whitelists and drops unknown keys**. New keys must be added there, and components must read them via `resolveStyleOptions`, not raw `theme.style_options`.
- **`donateAppeal` and `emblem: 'engraved'` already exist** and are fully wired (Zod schema, ui-utils resolver, admin UI). Workstream F/G are reduced to the *rendering* that is still missing, not the field plumbing.
- **The R2 upload plan was wrong.** The API worker's `ASSETS` binding is already taken by SvelteKit's static-assets binding (`apps/api/wrangler.toml`). File upload is an optional stretch; the sprint default is URL-only.

---

## 1. The overarching goal (read this first)

The consumer homepage (`http://localhost:5175/{masjid-slug}`) is currently **functional but not pretty**. A non-technical board reviewed it and gave concrete feedback:

1. **No images.** The homepage has a mihrab arch (Mishkaat) and a plain dark/light background, but no actual photo. "A visitor needs to see it being pretty."
2. **The arch + prayer table take up 2/3 of the width** and aren't that important (there's a dedicated timings page). They should be de-emphasized.
3. **Announcements must be front and center.** Any current event ("Maktab Registration Open", "Meeting Sunday") should hit the visitor immediately.
4. **The Hadith of the Day card is not useful on the homepage.** Remove it from the homepage (keep the component for other uses).
5. **The header needs a real logo image**, not a text/decal. The masjid name should be a logo image.
6. **A masjid photo should appear on the homepage.** The homepage should feel like the entrance of a house — aesthetic, not just functional.
7. **Wording/content fixes:** donation messaging, nav link labels, hide the Posts tab, WhatsApp group link on the About Us page.

The ultimate outcome the board wants: a homepage that looks *modern and deliberate*, while keeping all the existing features working (prayer table, countdown, jumu'ah, donate, etc.).

### Non-goals (do NOT do these)
- Do **not** rewrite the backend, prayer engine, or API logic.
- Do **not** build the business directory (deferred).
- Do **not** build the Square paid-listing feature (deferred).
- Do **not** touch the TV app (`apps/tv/`).
- Do **not** build presentation slides (separate concern).

---

## 2. Coordination contracts (agents MUST agree on these)

Parallel agents editing the same files will cause merge hell. These contracts are the shared vocabulary. Use them exactly as written.

### Contract 1: CSS class names

All new markup uses these exact class names. CSS in `app.css` targets these names. Do not invent new names without updating this doc.

```
.c-hero-photo          # new hero section with photo background
.c-hero-photo-overlay  # gradient overlay on top of the photo
.c-hero-photo-title    # masjid name rendered over the photo
.c-hero-photo-count    # countdown rendered over the photo
.c-announce-prominent  # front-and-center announcement card
.c-prayer-compact      # demoted prayer section wrapper
.c-ftr                 # footer wrapper
.c-ftr-band            # star band atop the footer
.c-ftr-body            # footer content
.c-section-divider     # star band between major sections
.c-logo-img            # logo <img> in the header
```

### Contract 2: Data model — `style_options` keys only

Photo, logo, and WhatsApp-link are **`style_options` JSON keys** on `masjid_themes`. There are **no new columns**, no schema migration, and no `check-schema` step. The keys:

- `photoUrl` — URL to the masjid photo (absolute URL, or a `/uploads/...` path served from dev static).
- `logoUrl` — URL to the masjid logo image.
- `whatsappGroupUrl` — WhatsApp group invite link shown on the About/Info page.

**How the key actually flows — this is the part agents get wrong:**

| Path | Mechanism | Does an unknown key survive? |
|---|---|---|
| Admin → DB (write) | `StyleOptionsSchema` in `packages/schemas/src/masjid.ts` uses `.passthrough()`; the theme `PUT` handler `JSON.stringify`s the whole `style_options` object. | **Yes**, with zero backend change. |
| DB → consumer payload (read) | `parseStyleOptionsJson` in `apps/api/src/lib/server/style-options.ts` is a raw `JSON.parse` passthrough; `theme.style_options` reaches `$page.data` intact. | **Yes**. |
| Consumer resolver | `parseStyleOptions` / `resolveStyleOptions` in `packages/ui-utils/src/style-options.ts` **whitelist** known keys and drop the rest. | **No** — a raw `theme.style_options.photoUrl` is `unknown` and can't be trusted to survive the resolver. |

**Rule:** the three keys MUST be added to `@masjid/ui-utils` (`MishkaatStyleOptions`, `ResolvedMishkaatOptions`, `MISHKAAT_OPTION_DEFAULTS`, `parseStyleOptions`, `resolveStyleOptions`) — this is part of Workstream A. Consumer components read them through `resolveStyleOptions(parseStyleOptions(theme.style_options))`, exactly like the existing `donateAppeal`/`emblem` keys. Never read raw `theme.style_options.photoUrl` directly.

`resolveStyleOptions` is already called for both style systems (`apply-theme.ts`, `+layout.svelte`, `+page.svelte`, `ambient.ts`), so these keys are available to Sakeenah and Mishkaat alike despite the type name.

### Contract 3: File ownership (hard rule)

Each file has exactly ONE owning workstream. Other agents must NOT edit files they don't own. If you need a change in a file you don't own, note it in your workstream summary; the owner applies it, or coordinate via the scratch notes.

| File | Owner |
|------|-------|
| `packages/schemas/src/masjid.ts` | Workstream A |
| `packages/ui-utils/src/style-options.ts` | Workstream A |
| `apps/admin/src/routes/admin/[slug]/settings/theme/+page.svelte` | Workstream A |
| `apps/consumer/src/routes/[masjid_slug]/+page.svelte` | Workstream B |
| `apps/consumer/src/routes/[masjid_slug]/+layout.svelte` | Workstream C |
| `apps/consumer/src/app.css` | Workstream D |
| `apps/consumer/src/lib/components/SectionDivider.svelte` (new) | Workstream D |
| `apps/consumer/src/routes/[masjid_slug]/donate/+page.svelte` | Workstream F |
| `apps/consumer/src/routes/[masjid_slug]/info/+page.svelte` | Workstream F |
| `apps/consumer/src/routes/[masjid_slug]/news/+page.svelte` | Workstream F |
| `apps/consumer/src/lib/components/EngravedEmblem.svelte` (new) | Workstream G |
| `tooling/engrave-photo.ts` (new, optional) | Workstream G |

`+layout.ts` needs no changes (the theme object already flows into `$page.data`). `api.ts` needs no changes for the sprint; if Workstream A wants typed `style_options` instead of `Record<string, unknown>`, that's an optional add-on and is Workstream A's file.

---

## 3. Workstreams

Launch order and dependencies:

```
Wave 1 (no dependencies, launch immediately):
  A — Add style_options keys + typed resolver + admin "Images" section
  F — Wording/content fixes + WhatsApp link + Resources
  G — Engraved line-art wireframe (optional)

Wave 2 (start against hardcoded URLs; wire to real keys once A lands):
  B — Homepage restructure
  C — Layout shell + header logo + footer

Wave 3 (after B + C have locked the DOM):
  D — Visual polish CSS
```

### Agent setup (worktrees)

Each workstream runs in its own `git worktree` so agents never collide on the same working tree. Every worktree needs `npm run setup` before starting. All branches fork from `master`.

| Stream | Worktree path | Branch | Files owned |
|--------|--------------|--------|-------------|
| A | `~/code/masjid-consumer-overhaul-A` | `consumer-overhaul/A` | `packages/schemas`, `@masjid/ui-utils`, admin theme page |
| B | `~/code/masjid-consumer-overhaul-B` | `consumer-overhaul/B` | consumer `+page.svelte` |
| C | `~/code/masjid-consumer-overhaul-C` | `consumer-overhaul/C` | consumer `+layout.svelte` |
| D | `~/code/masjid-consumer-overhaul-D` | `consumer-overhaul/D` | consumer `app.css`, `SectionDivider.svelte` |
| F | `~/code/masjid-consumer-overhaul-F` | `consumer-overhaul/F` | consumer donate, info, news pages |
| G | `~/code/masjid-consumer-overhaul-G` | `consumer-overhaul/G` | `EngravedEmblem.svelte`, `tooling/engrave-photo.ts` |

To create all worktrees in one pass:
```bash
for s in A B C D F G; do
  git worktree add ~/code/masjid-consumer-overhaul-$s -b consumer-overhaul/$s master
done
```

Then in each worktree: `cd ~/code/masjid-consumer-overhaul-X && npm run setup`

---

### Workstream A — Backend: style_options keys + admin "Images" UI

**Worktree:** `~/code/masjid-consumer-overhaul-A` | **Branch:** `consumer-overhaul/A`

**Files owned:** see Contract 3.

**Tasks:**
1. Add three optional keys to `StyleOptionsSchema` in `packages/schemas/src/masjid.ts` (append to the `.object({...})`, before `.passthrough()`):
   - `photoUrl: z.string().min(1).max(2000).optional()`
   - `logoUrl: z.string().min(1).max(2000).optional()`
   - `whatsappGroupUrl: z.string().min(1).max(2000).optional()`
   Use plain-string validation (not `.url()`) so relative `/uploads/...` paths are allowed.
2. Add the same three keys to `packages/ui-utils/src/style-options.ts`:
   - `MishkaatStyleOptions`: `photoUrl?: string; logoUrl?: string; whatsappGroupUrl?: string;`
   - `ResolvedMishkaatOptions`: `photoUrl: string; logoUrl: string; whatsappGroupUrl: string;`
   - `MISHKAAT_OPTION_DEFAULTS`: empty-string defaults.
   - `parseStyleOptions`: copy the existing `donateAppeal` pattern (trim, non-empty guard) for each of the three keys.
   - `resolveStyleOptions`: `photoUrl: input?.photoUrl ?? defaults.photoUrl`, etc.
3. Admin theme page (`apps/admin/.../settings/theme/+page.svelte`): add an **"Images"** section (render it for *both* style systems, not just Mishkaat — the homepage photo and header logo are style-system-agnostic). Fields:
   - Homepage photo: URL text input (`form.style_options.photoUrl`) + preview thumbnail when set.
   - Logo: URL text input (`form.style_options.logoUrl`) + preview thumbnail when set.
   - Add `photoUrl: ''` and `logoUrl: ''` to the initial `form.style_options` object. The existing `deepMerge` already round-trips unknown keys, and `style_options` already flows through `handleSave`, so no other wiring is needed.
4. *(Optional, stretch — skip unless there is spare time.)* File upload via R2. **Do not use binding name `ASSETS`** — it is already taken by SvelteKit's static-assets binding in `apps/api/wrangler.toml`. Use a distinct binding (e.g. `MEDIA`) pointed at the existing `masjid-assets` bucket the WhatsApp worker uses. In local dev, `platform.env.MEDIA` is undefined; write to `apps/consumer/static/uploads/` and return `/uploads/{filename}` (dev-only — a production build will not serve runtime-written files; R2 is the only prod path). This is deliberately out of scope for the demo.

**Acceptance criteria:**
- `npm run test` (API), `npm run test:tv` (ui-utils consumers), `npm run test:admin` all green.
- Admin theme page can set photo/logo URLs and they persist and reload.
- `resolveStyleOptions(parseStyleOptions({ photoUrl: 'x' })).photoUrl === 'x'` — add/verify a unit test in `apps/tv/src/__tests__/lib/style-options.test.ts` (it is the existing home for these tests).

---

### Workstream B — Homepage restructure

**Worktree:** `~/code/masjid-consumer-overhaul-B` | **Branch:** `consumer-overhaul/B`

**Files owned:** `apps/consumer/src/routes/[masjid_slug]/+page.svelte` ONLY.

**Tasks:**
1. **New hero with photo.** Read `const opts = resolveStyleOptions(parseStyleOptions(theme?.style_options))` (it is already called at the top of this file for `ceremony`; reuse or add one). If `opts.photoUrl` is set, render a full-width hero `<section class="c-hero-photo" style="background-image: url({opts.photoUrl})">` with:
   - `<div class="c-hero-photo-overlay">` (gradient overlay, Contract 1)
   - Masjid name in `<h1 class="c-hero-photo-title">`
   - Countdown in `<div class="c-hero-photo-count">` (reuse existing `heroLabel`/`heroCountdown`).
   If `opts.photoUrl` is NOT set, fall back to the current hero (HeroNiche for Mishkaat, countdown card for Sakeenah). Do NOT delete the existing hero code — keep it as the fallback branch.
2. **Move announcements up, front and center.** The pinned announcement (currently in the right `<aside>` with class `border-l-4`) moves to the LEFT column, directly under the hero, using class `c-announce-prominent`. Show title + compiled HTML prominently. Keep it simple: pinned first.
3. **Demote the prayer table.** Move it below announcements. Change the heading to "Today's Prayer Times". Wrap in `c-prayer-compact`. Keep the table fully functional (current-row highlight, rosette marker, etc.).
4. **Remove HadithCard from the homepage.** Delete the `hadith` derived value, the `HadithCard` import, and the render block. (Do not delete `HadithCard.svelte` itself.)
5. **Remove the "upcoming changes" section.** Delete the `upcomingChanges` state, `loadUpcomingChanges`, its `$effect`, the `fetchWeeklyPrayerTimes` import, and the render block.
6. **Clean sidebar.** Right `<aside>` now contains: jumu'ah (pinned Thu–Fri for Mishkaat, otherwise normal position), homepage post (if any), donate CTA. No announcement card (it moved to the main column).
7. **Add section dividers** between hero → announcements → prayer using `<SectionDivider />` (Workstream D creates the component; if it doesn't exist yet, add a `<!-- divider -->` placeholder comment and let D fill it in).

**Acceptance criteria:**
- Homepage shows: hero (photo or fallback) → announcements → prayer table → sidebar (jumu'ah/post/donate).
- No hadith card, no upcoming-changes section, no unused imports on the homepage.
- `npm run test:consumer` passes. Update any test that asserted the old section order.

---

### Workstream C — Layout shell + header logo + footer

**Worktree:** `~/code/masjid-consumer-overhaul-C` | **Branch:** `consumer-overhaul/C`

**Files owned:** `apps/consumer/src/routes/[masjid_slug]/+layout.svelte` ONLY.

**Tasks:**
1. **Header logo.** Read `const opts = resolveStyleOptions(parseStyleOptions(theme?.style_options))` (already imported/used in this file for `adminMode`). If `opts.logoUrl` is set, render `<img class="c-logo-img" src={opts.logoUrl} alt="{masjid.name} logo" />` in place of the current logo area (rosette for Mishkaat, letter avatar for Sakeenah). Fall back to current behavior when `logoUrl` is empty. Keep the masjid name text next to the logo.
2. **Footer.** Add a `<footer class="c-ftr">` after `</main>`, before the closing root `<div>` (guard with `{#if !embed}` like the header):
   - `<div class="c-ftr-band"><StarBand band={16} /></div>` (StarBand is already imported).
   - `<div class="c-ftr-body">` with: masjid name + `<Rosette size={12} />` glyph + `city, state` + contact phone/email.
   - Muted text (`--color-text-muted`), small font.

**Acceptance criteria:**
- Header shows the logo image when set, fallback otherwise.
- Footer renders with name, rosette, location, contact, star band.
- `npm run test:consumer` passes.

---

### Workstream D — Visual polish CSS

**Worktree:** `~/code/masjid-consumer-overhaul-D` | **Branch:** `consumer-overhaul/D`

**Files owned:** `apps/consumer/src/app.css` ONLY, plus new `apps/consumer/src/lib/components/SectionDivider.svelte`.

**Tasks:**
1. **SectionDivider component** (`SectionDivider.svelte`): thin wrapper around `<StarBand band={...} />` with `opacity: 0.2`, centered, used between major sections. Import StarBand from `@masjid/ui-utils/components/StarBand.svelte`.
2. **Hero photo overlay** (`.c-hero-photo-overlay`): gradient from transparent → semi-transparent `--color-primary`/dark tint → `--color-bg` at the bottom, so the photo dissolves into the page rather than having a hard edge. Text on top must be readable (`text-shadow` or a dark scrim).
3. **Announcement card** (`.c-announce-prominent`): accent left border (`border-left` using `--color-accent`), `font-heading` title, subtle background tint. Build on the existing `.glass-card` base.
4. **Mobile hero**: `@media (max-width: 640px)` — photo scales to viewport width, title/countdown text sizes reduce, overlay deepens for readability. Test at 375px.
5. **Gradient section backgrounds**: alternate subtle gradients between hero/announcement/prayer sections using `--color-bg` variants. Keep it subtle.
6. **Hover micro-effects**: cards get `transition: transform 150ms, box-shadow 150ms` and `:hover { transform: translateY(-1px); }` plus a slightly stronger shadow. Subtle.
7. **Loading skeleton**: a shimmer that mirrors the new hero + announcement + prayer layout during initial load.
8. **Footer CSS** (`.c-ftr`, `.c-ftr-band`, `.c-ftr-body`): minimal, muted, anchored to the bottom, respecting `--color-bg`/`--color-surface`.

**Rules:**
- Use ONLY the class names in Contract 1. If you need a new class, add it to Contract 1 in this doc and mention it in your summary.
- The consumer uses Tailwind v4 *plus* a hand-written CSS design system that reads from CSS custom properties (`--color-*`, `--font-*`). Match the existing hand-written style; do not introduce new Tailwind utility patterns for this work.
- Both style systems (Mishkaat and Sakeenah) must look correct. Gate Mishkaat-specific CSS behind `html[data-style-system='mishkaat']` if needed.

**Acceptance criteria:**
- The restructured homepage (from B + C) looks intentional and polished in both style systems.
- No layout regressions on mobile or desktop.
- `npm run test:consumer` passes.

---

### Workstream F — Wording/content fixes + WhatsApp link + Resources

**Worktree:** `~/code/masjid-consumer-overhaul-F` | **Branch:** `consumer-overhaul/F`

**Files owned:** see Contract 3 (donate, info, news pages).

**Tasks:**
1. **Donate page messaging.** The Donate page (`donate/+page.svelte`) currently has a hardcoded blurb ("Your generous contributions help maintain our masjid…", lines ~82–85) that cannot be edited by the board. Make it admin-editable by reading `resolveStyleOptions(parseStyleOptions($page.data.theme?.style_options)).donateAppeal` — `donateAppeal` already exists in `style_options` and is editable in the admin theme page ("Donate Appeal" section). Use it instead of (or alongside) the hardcoded text. Falls back to the current hardcoded blurb when `donateAppeal` is empty. **No new field, no schema change.**
2. **Hide the Posts tab.** The "Posts tab" is not a nav item — it's a hardcoded tab on the `/news` page (`news/+page.svelte`, tabs `Posts` / `Announcements`). Hide the Posts tab and make **Announcements the default (and only) tab**. Keep the posts *engine* and the `/posts/[slug]` routes intact. (Alternatively, keep both tabs but default to Announcements — pick the simpler change and note it.)
3. **Nav label changes.** The nav engine already supports custom labels/order per masjid (`docs/nav-config.md`). For the demo, apply the board's preferred labels via the admin Navigation settings — no code change. Verify the mechanism and document the exact labels to set in your summary.
4. **WhatsApp group link on About Us.** `whatsappGroupUrl` is a new `style_options` key (Workstream A). In `info/+page.svelte`, read it via `resolveStyleOptions(parseStyleOptions($page.data.theme?.style_options))` and render a "Join Our WhatsApp Group" link (with a WhatsApp icon) in the existing "Links" section when set. Note `info/+page.svelte` does not currently read `theme` — `$page.data.theme` is available (it flows from `+layout.ts`), so just reference it.
5. **Resources page — use the existing custom-page engine (no new route, no nav schema change).** Create a "Resources" page via the admin custom-pages flow (`docs/nav-config.md` §3.3 — `kind: 'page'`, markdown body), and add it to the nav as a `page` item. Content is markdown-driven (nikah officiation, financial help, etc.) and changeable without code. If a dedicated `/resources` route is preferred instead, that additionally requires a new `route_segment` in the nav enum (`packages/schemas` + layout) — treat that as out of scope unless explicitly asked.

**Acceptance criteria:**
- Donate page shows the admin-editable `donateAppeal`.
- Posts tab hidden (announcements-only or announcements-first) on the News page.
- About Us shows a WhatsApp group link when `whatsappGroupUrl` is set.
- A Resources page exists and is reachable via nav (custom page).
- `npm run test:consumer` passes.

---

### Workstream G — Engraved line-art wireframe (optional)

**Worktree:** `~/code/masjid-consumer-overhaul-G` | **Branch:** `consumer-overhaul/G`

**Files owned:** new `apps/consumer/src/lib/components/EngravedEmblem.svelte`, optional new `tooling/engrave-photo.ts`.

**Context that is already done:** `emblem` is an existing `style_options` key (`'medallion' | 'engraved'`, default `'medallion'`), already typed, resolved, and editable in the admin theme page ("Masjid Logo" section). This workstream only builds the *rendering*.

**Tasks:**
1. `EngravedEmblem.svelte` renders the engraved line-art for the masjid photo. **Preferred approach:** trace `photoUrl` client-side with `imagetracerjs` (pure JS, no native deps) at render time, so it works per-masjid with no build step and no baked asset. Needs a CORS-friendly image.
2. **Fallback:** CSS-only etched treatment on the photo — `filter: grayscale(100%) contrast(150%) brightness(90%)`. Make `EngravedEmblem` fall back to this when tracing fails or when there is no photo.
3. *(Optional, static demo path)* `tooling/engrave-photo.ts`: `node tooling/engrave-photo.ts <photo-path>` → writes an SVG. **This bakes a single masjid's engraving** — fine for a one-masjid demo, but it does not generalize; prefer the client-side approach for anything beyond tonight.
4. Wire into the hero (coordinate with Workstream B): if `opts.emblem === 'engraved'` and a photo exists, show `EngravedEmblem`; otherwise show the photo. Mishkaat only.

**Reality check:** the masjid is plain brick (no minaret), so an engraving may actually *elevate* the building by abstracting away texture and color. But keep the CSS-filter fallback ready for tonight's demo if the tracer output is noisy.

**Acceptance criteria:**
- `EngravedEmblem` renders an engraving or falls back to the CSS treatment without error.
- No regressions to existing tests (`npm run test:consumer`).

---

## 4. Testing & verification (everyone)

- **Before committing any change:** run the relevant test suite for the files you touched.
  - `@masjid/ui-utils` (A): `npm run test:tv` (covers `style-options.test.ts`) and `npm run test:consumer`.
  - Consumer (B, C, D, F, G): `npm run test:consumer`.
  - Admin (A): `npm run test:admin`.
- **No `check-schema` step** — this revision has no schema changes. If you find yourself touching `schema.sql`/`schema.ts`/`ensureTables`, stop: you are doing something out of scope.
- **No `console.log`, `debugger`, or commented-out code** unless intentional.
- **`git add <specific-files>`** — never `git add -A`.

## 5. Demo notes (for the human coordinating)

- The masjid being redesigned ("Masjid Suffah") is configured in **production**, not in the local seed DB. For the local demo, configure a local masjid with the same settings via the admin UI, or register it fresh and apply settings.
- Photo/logo assets: the human has a photo (mediocre) and two logo files. Both logos will be tried; pick the better one during the demo. For URL-only input, host the files anywhere reachable (or drop them in `apps/consumer/static/uploads/` and use `/uploads/...` in local dev).
- The business directory and Square paid-listings are **out of scope** for this sprint.
