# Consumer Homepage Overhaul — Agent Spec

> **Status:** Active workstream (one-night sprint). Read this entire file before starting.
> **Goal:** Make the consumer homepage genuinely *beautiful* so it can be presented to the masjid board as the primary option. This is a visual/design overhaul, not a backend rewrite.

### What changed in this revision (read if you saw an older draft)

- **No new DB columns.** `photo_url`/`logo_url` columns and the `style_options` "mirror" are gone. Photo/logo/WhatsApp-link are `style_options` keys only (`photoUrl`, `logoUrl`, `whatsappGroupUrl`). No `schema.sql` / Drizzle / `ensureTables` / `check-schema` changes.
- **Corrected the passthrough claim.** `style_options` is *not* a single passthrough everywhere: the API read path and the Zod write path pass unknown keys through, but the consumer-side resolver (`parseStyleOptions`/`resolveStyleOptions` in `@masjid/ui-utils`) **whitelists and drops unknown keys**. New keys must be added there, and components must read them via `resolveStyleOptions`, not raw `theme.style_options`.
- **`donateAppeal` and `emblem: 'engraved'` already exist** and are fully wired (Zod schema, ui-utils resolver, admin UI). Workstream F/G are reduced to the *rendering* that is still missing, not the field plumbing.
- **The R2 upload plan was wrong.** The API worker's `ASSETS` binding is already taken by SvelteKit's static-assets binding (`apps/api/wrangler.toml`). File upload is an optional stretch; the sprint default is URL-only.

### Layout correction (2026-08-13, post-implementation)

The original Workstream B put the hero and prayer table in the left 2/3 column — directly contradicting board feedback #2 ("the arch + prayer table take up 2/3 of the width… de-emphasized") and producing an orphan empty grid cell (top-right) because `col-span-2` hero + `col-span-2` main + aside in a 3-col grid leaves row 1 column 3 empty. **Shipped layout is now:**

- **Desktop, right 1/3 "timings" column:** fallback hero (mihrab niche / countdown card) → prayer table → Jumu'ah (pinned *above* the prayer table Thu–Fri). With `photoUrl` set, the photo hero is full-width *above* the grid and the right column is prayer table + Jumu'ah only.
- **Desktop, left 2/3 "content" column:** pinned announcement (`.c-announce-prominent`) → homepage post → donate CTA. `.c-section-divider` renders only between announcement and post when both exist.
- **Mobile (single column):** hero → announcement → post → donate → prayer table → Jumu'ah (with `photoUrl`: photo hero → announcement → … → prayer/Jumu'ah).
- Implementation: explicit `lg:col-start-*`/`lg:row-start-*`/`lg:row-span-*` placement on the three grid children (hero, content, timings) + `order-*` for mobile — no orphan cells by construction.
- **Header logo pitfall:** an SVG logo without intrinsic `width`/`height` contributes ~0 to the header flex basis and squeezes the masjid name into ellipsis. `.c-logo-img` is a definite 38×38 box (`object-fit: contain`) so any image sizes correctly.
- **Seed data:** Al-Noor (Mishkaat) seeds `photoUrl`/`logoUrl`/`whatsappGroupUrl`/`donateReasons` (assets committed at `apps/consumer/static/uploads/seed/`); Al-Jabal (Sakeenah) seeds `whatsappGroupUrl`/`donateReasons`, a homepage post, a Resources custom page, and a full nav item set — every overhaul branch is covered by one seed masjid or the other.

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

- `photoUrl` — URL to the masjid photo (absolute URL, or a `/uploads/...` path).
- `logoUrl` — URL to the masjid logo image.
- `whatsappGroupUrl` — WhatsApp group invite link shown on the About/Info page.
- `donateReasons` — array of `{ icon, title, desc }` cards for the "Why Give?" section on the Donate page (max 8). Defaults to the three current hardcoded cards.

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
| `packages/schemas/src/masjid.ts` (engravedSvg key) | Workstream G |
| `packages/ui-utils/src/style-options.ts` (engravedSvg key) | Workstream G |
| `apps/admin/src/routes/admin/[slug]/settings/theme/+page.svelte` (tracing UI) | Workstream G |
| `tooling/engrave-photo.ts` | **Removed** — generation moved to admin browser |

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

### Agent launch order

Worktrees are independent filesystems but the workstreams have data dependencies. Launch agents in this order:

```
Phase 1 — launch all three in parallel NOW (no deps on other streams):

  Agent A  ~/code/masjid-consumer-overhaul-A   style_options keys + admin UI
  Agent F  ~/code/masjid-consumer-overhaul-F   wording fixes + WhatsApp + Resources
  Agent G  ~/code/masjid-consumer-overhaul-G   engraved emblem (optional)

Phase 2 — launch AFTER Agent A commits (B/C read photoUrl/logoUrl from resolveStyleOptions):

  Agent B  ~/code/masjid-consumer-overhaul-B   homepage restructure
  Agent C  ~/code/masjid-consumer-overhaul-C   header logo + footer

Phase 3 — launch AFTER B and C have shipped (needs the final DOM):

  Agent D  ~/code/masjid-consumer-overhaul-D   visual polish CSS
```

**Phase 1 agents**: start immediately. Write code against the `resolveStyleOptions` shape that Workstream A will ship (keys: `photoUrl`, `logoUrl`, `whatsappGroupUrl`, `donateAppeal`, `emblem` — all already typed in `@masjid/ui-utils` after A lands). For development, hardcode test URLs and switch to the real resolver when A's branch is merged.

**Phase 2 agents**: wait for A's branch to be merged to master, then `git pull` (or rebase onto master) before starting. This ensures `resolveStyleOptions` returns `photoUrl`/`logoUrl` typed.

**Phase 3 agent**: wait for B + C to be merged so the DOM structure (`.c-hero-photo`, `.c-announce-prominent`, `.c-prayer-compact`, `.c-ftr`) is concrete.

**After all agents are done**: merge every branch back into master (see AGENTS.md branching model — `master` = dev, commit freely).

---

### Workstream A — Backend: style_options keys + admin "Images" UI

**Worktree:** `~/code/masjid-consumer-overhaul-A` | **Branch:** `consumer-overhaul/A`

**Files owned:** see Contract 3.

**Tasks:**
1. Add these keys to `StyleOptionsSchema` in `packages/schemas/src/masjid.ts` (append to the `.object({...})`, before `.passthrough()`):
   - `photoUrl: z.string().min(1).max(2000).optional()`
   - `logoUrl: z.string().min(1).max(2000).optional()`
   - `whatsappGroupUrl: z.string().min(1).max(2000).optional()`
   - `donateReasons: z.array(z.object({ icon: z.string().max(10), title: z.string().max(100), desc: z.string().max(200) })).max(8).optional()`
   Use plain-string validation (not `.url()`) so relative `/uploads/...` paths are allowed.
2. Add the same keys to `packages/ui-utils/src/style-options.ts`:
   - `MishkaatStyleOptions`: add `photoUrl`, `logoUrl`, `whatsappGroupUrl`, and a `DonateReason` interface + `donateReasons?: DonateReason[]`.
   - `ResolvedMishkaatOptions`: same fields with resolved types. Default `donateReasons` to the three current hardcoded cards (🕌 Maintain the House of Allah, 📚 Support Education, 🤝 Serve the Community).
   - `parseStyleOptions`: copy the existing `donateAppeal` pattern (trim, non-empty guard) for the string keys. For `donateReasons`, validate it's an array of objects with non-empty `icon`/`title`/`desc`.
   - `resolveStyleOptions`: fill defaults for all new keys.
3. Admin theme page (`apps/admin/.../settings/theme/+page.svelte`):
   - Add an **"Images"** section (both style systems): photo URL + logo URL text inputs with preview thumbnails. Add `photoUrl: ''`, `logoUrl: ''` to the initial `form.style_options`.
   - Add a **"Donate Reasons"** section (both style systems): up to 8 rows, each with Icon (emoji input, short), Title, and Description. Replace or extend the existing "Donate Appeal" section. Default to the three emoji cards.
   The existing `deepMerge` round-trips unknown keys, and `style_options` flows through `handleSave` — no other wiring needed.
4. *(Optional, stretch — skip unless there is spare time.)* File upload via R2. **Do not use binding name `ASSETS`** — it is already taken by SvelteKit's static-assets binding in `apps/api/wrangler.toml`. Use a distinct binding (e.g. `MEDIA`) pointed at the existing `masjid-assets` bucket the WhatsApp worker uses. In local dev, `platform.env.MEDIA` is undefined; write to `apps/consumer/static/uploads/` and return `/uploads/{filename}` (dev-only — a production build will not serve runtime-written files; R2 is the only prod path). This is deliberately out of scope for the demo.

**Acceptance criteria:**
- `npm run test` (API), `npm run test:tv` (ui-utils consumers), `npm run test:admin` all green.
- Admin theme page can set photo/logo URLs and donate reason cards; they persist and reload.
- Unit test in `apps/tv/src/__tests__/lib/style-options.test.ts` verifies new resolver keys.

---

### Workstream B — Homepage restructure

**Worktree:** `~/code/masjid-consumer-overhaul-B` | **Branch:** `consumer-overhaul/B`

**Files owned:** `apps/consumer/src/routes/[masjid_slug]/+page.svelte` ONLY.

**Tasks:**
1. **New hero with photo.** Read `const opts = resolveStyleOptions(parseStyleOptions(theme?.style_options))` (it is already called at the top of this file for `ceremony`; reuse or add one). If `opts.photoUrl` is set, render a full-width hero `<section class="c-hero-photo" style="background-image: url({opts.photoUrl})">` **above the two-column grid** with:
   - `<div class="c-hero-photo-overlay">` (gradient overlay, Contract 1)
   - Masjid name in `<h1 class="c-hero-photo-title">`
   - Countdown in `<div class="c-hero-photo-count">` (reuse existing `heroLabel`/`heroCountdown`).
   If `opts.photoUrl` is NOT set, the fallback hero (HeroNiche for Mishkaat, countdown card for Sakeenah) renders as the **top of the right-hand timings column**. Do NOT delete the existing hero code — keep it as the fallback branch.
2. **Move announcements up, front and center.** The pinned announcement (formerly in the right `<aside>` with class `border-l-4`) moves to the LEFT content column, first block, using class `c-announce-prominent`. Show title + compiled HTML prominently. Keep it simple: pinned first.
3. **Demote the prayer table.** It leaves the main column entirely and joins the right-hand timings column under the hero. Heading: "Today's Prayer Times". Wrap in `c-prayer-compact`. Keep the table fully functional (current-row highlight, rosette marker, etc.).
4. **Remove HadithCard from the homepage.** Delete the `hadith` derived value, the `HadithCard` import, and the render block. (Do not delete `HadithCard.svelte` itself.)
5. **Remove the "upcoming changes" section.** Delete the `upcomingChanges` state, `loadUpcomingChanges`, its `$effect`, the `fetchWeeklyPrayerTimes` import, and the render block.
6. **Two clean columns.** Right timings column: fallback hero → prayer table → Jumu'ah (pinned above the table Thu–Fri for Mishkaat). Left content column: announcement → homepage post (if any) → donate CTA. Use explicit `lg:col-start`/`lg:row-start`/`lg:row-span` placement so no orphan grid cell exists, and `order-*` classes for the mobile sequence (hero → announcement → post → donate → prayer → Jumu'ah).
7. **Section divider** between the announcement and the homepage post (only when both exist) using `<SectionDivider />` (Workstream D creates the component; if it doesn't exist yet, add a `<!-- divider -->` placeholder comment and let D fill it in).

**Acceptance criteria:**
- Homepage shows: photo hero (full width) or fallback hero (right column top) → left: announcements/post/donate → right: prayer table + Jumu'ah.
- No empty grid cell anywhere; no hadith card, no upcoming-changes section, no unused imports on the homepage.
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
1. **Donate page "Why Give?" messaging.** The Donate page has a "Why Give?" section (`donate/+page.svelte`, lines ~119–137) — three cards with emoji logos (🕌, 📚, 🤝) and hardcoded blurbs. The board wants both the emojis AND the text to be customizable. **Use `donateReasons`** — a new `style_options` array (Workstream A adds it to schema + resolver + admin UI). Each entry: `{ icon, title, desc }`. Replace the three hardcoded cards with a dynamic `.map()` over `resolveStyleOptions(...).donateReasons`. The old `donateAppeal` field (single string) is used elsewhere (TV) and stays untouched. Default values match the current hardcoded cards.
2. **Hide the Posts tab.** The "Posts tab" is not a nav item — it's a hardcoded tab on the `/news` page (`news/+page.svelte`, tabs `Posts` / `Announcements`). Hide the Posts tab and make **Announcements the default (and only) tab**. Keep the posts *engine* and the `/posts/[slug]` routes intact.
3. **Nav label changes.** The nav engine already supports custom labels/order per masjid (`docs/nav-config.md`). For the demo, apply the board's preferred labels via the admin Navigation settings — no code change. Document the exact labels to set in your summary.
4. **WhatsApp group link on About Us.** `whatsappGroupUrl` is a new `style_options` key (Workstream A). In `info/+page.svelte`, read it via `resolveStyleOptions(parseStyleOptions($page.data.theme?.style_options))` and render a "Join Our WhatsApp Group" link (with a WhatsApp icon) in the existing "Links" section when set. `info/+page.svelte` does not currently read `theme` — `$page.data.theme` is available (it flows from `+layout.ts`), so just reference it.
5. **Resources page — use the existing custom-page engine (no new route, no nav schema change).** Create a "Resources" page via the admin custom-pages flow (`docs/nav-config.md` §3.3 — `kind: 'page'`, markdown body), and add it to the nav as a `page` item. Content is markdown-driven (nikah officiation, financial help, etc.) and changeable without code. If a dedicated `/resources` route is preferred, that requires a new `route_segment` in the nav enum (`packages/schemas` + layout) — out of scope unless explicitly asked.

**Acceptance criteria:**
- Donate page "Why Give?" cards driven by `donateReasons`, with emoji + title + desc all configurable via admin.
- Posts tab hidden (announcements-only) on the News page.
- About Us shows a WhatsApp group link when `whatsappGroupUrl` is set.
- A Resources page exists and is reachable via nav (custom page).
- `npm run test:consumer` passes.

---

### Workstream G — Engraved line-art wireframe (optional)

**Worktree:** `~/code/masjid-consumer-overhaul-G` | **Branch:** `consumer-overhaul/G`

**Files owned:** new `apps/consumer/src/lib/components/EngravedEmblem.svelte`, `packages/schemas/src/masjid.ts` (engravedSvg key), `packages/ui-utils/src/style-options.ts` (engravedSvg key), `apps/admin/.../settings/theme/+page.svelte` (tracing UI). The `tooling/engrave-photo.ts` static script is **removed** — architecture changed per below.

**Context that is already done:** `emblem` is an existing `style_options` key (`'medallion' | 'engraved'`, default `'medallion'`), already typed, resolved, and editable in the admin theme page. This workstream builds the *rendering* and the *admin-side generation*.

**Architecture (revised 2026-08-13 — not in the original draft):** The original plan traced the photo client-side on every consumer page load with `imagetracerjs`. This was wrong: the output is deterministic, so we trace **once** in the admin browser and store the SVG string. This eliminates the SSR/canvas problem, CORS concerns, and the 50 KB `imagetracerjs` dependency from the consumer bundle. The consumer just renders pre-computed SVG.

- **`engravedSvg`** is a new `style_options` string key (max 500KB) — added to the Zod schema, the ui-utils resolver (`parseStyleOptions` / `resolveStyleOptions`), and the admin theme page form.
- **The admin theme page** (`apps/admin/.../settings/theme/+page.svelte`, Masjid Logo section): when `emblem === 'engraved'` and `photoUrl` is set, a "Generate Engraving" button traces the image with `imagetracerjs` client-side and stores the SVG in `engravedSvg`. A preview and regenerate/clear controls are shown.
- **The consumer** does zero tracing. `EngravedEmblem.svelte` renders `engravedSvg` as raw SVG, or falls back to a CSS filter on the photo (`grayscale(100%) contrast(150%) brightness(90%)`).
- **`imagetracerjs`** is a dependency of `@masjid/admin` only.

**Tasks:**
1. Added `engravedSvg` to the Zod schema (`StyleOptionsSchema`), the ui-utils resolver (`MishkaatStyleOptions`, `ResolvedMishkaatOptions`, `parseStyleOptions`, `resolveStyleOptions`, `MISHKAAT_OPTION_DEFAULTS`), and the admin theme page initial form.
2. Added the "Generate Engraving" button + preview to the admin theme page's Masjid Logo section, using `imagetracerjs` (3 colors, 1.5 stroke, CORS enabled).
3. `EngravedEmblem.svelte` renders the pre-computed SVG when available, falls back to CSS-etched `<img>` otherwise.
4. Wire into the hero (coordinate with Workstream B): if `opts.emblem === 'engraved'` and `opts.photoUrl`, show `<EngravedEmblem photoUrl={opts.photoUrl} engravedSvg={opts.engravedSvg} />`; otherwise show the photo normally. Mishkaat only.

#### Integration guide for Workstream B (homepage restructure)

In `apps/consumer/src/routes/[masjid_slug]/+page.svelte`, when the hero renders with
a photo (the `opts.photoUrl` branch), replace the plain `<img>` with:

```svelte
import EngravedEmblem from '$lib/components/EngravedEmblem.svelte';

let opts = $derived(resolveStyleOptions(parseStyleOptions(theme?.style_options ?? null)));

// ...inside the hero section:
{#if opts.emblem === 'engraved' && opts.photoUrl}
  <section class="c-hero-photo">
    <EngravedEmblem photoUrl={opts.photoUrl} engravedSvg={opts.engravedSvg} />
    <!-- overlay, title, countdown as normal -->
  </section>
{:else if opts.photoUrl}
  <section class="c-hero-photo" style="background-image: url({opts.photoUrl})">
    <!-- overlay, title, countdown as normal -->
  </section>
{/if}
```

`resolveStyleOptions` is already called at the top of `+page.svelte` for
`ceremony` — reuse that same call. The `engravedSvg` key is already resolved
by Workstream G and available on the returned `opts` object. Mishkaat only
(the `emblem` key exists only in the Mishkaat branch; Sakeenah never shows it).

**Acceptance criteria:**
- Admin can generate an engraving from a photo URL.
- No regressions to existing tests (`npm run test:consumer`, `npm run test:admin`, `npm run test:tv`, `npm run check-schema`).
- **E2E tests added:** ADM-31 (emblem toggle via UI, verify via API, restore) and CON-52 (set emblem=engraved via API, visit consumer homepage, no crash).

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
