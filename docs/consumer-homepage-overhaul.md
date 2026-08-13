# Consumer Homepage Overhaul — Agent Spec

> **Status:** Active workstream (one-night sprint). Read this entire file before starting.
> **Goal:** Make the consumer homepage genuinely *beautiful* so it can be presented to the masjid board as the primary option. This is a visual/design overhaul, not a backend rewrite.

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

### Contract 2: New database columns (on `masjid_themes`)

Two new columns, **appended at the END** of the `CREATE TABLE` statement and the Drizzle column list (per AGENTS.md: never insert columns in the middle).

- `photo_url TEXT` — URL to the masjid photo (R2 public URL, or a local `/uploads/...` path, or an external URL).
- `logo_url TEXT` — URL to the masjid logo image.

### Contract 3: New `style_options` keys (JSON passthrough)

`style_options` is a JSON column validated with `.passthrough()` — unknown keys are silently accepted. Add two keys so the consumer can read them without new data plumbing:

- `photoUrl` — mirror of `photo_url`
- `logoUrl` — mirror of `logo_url`

The consumer components read `theme.style_options.photoUrl` / `logoUrl`. The admin writes both the column and the style_options key (keep them in sync).

### Contract 4: File ownership (hard rule)

Each file has exactly ONE owning workstream. Other agents must NOT edit files they don't own. If you need a change in a file you don't own, note it in your workstream summary; the owner applies it, or coordinate via the scratch notes.

| File | Owner |
|------|-------|
| `apps/consumer/src/routes/[masjid_slug]/+page.svelte` | Workstream B |
| `apps/consumer/src/routes/[masjid_slug]/+layout.svelte` | Workstream C |
| `apps/consumer/src/app.css` | Workstream D |
| `apps/consumer/src/lib/components/SectionDivider.svelte` (new) | Workstream D |
| `apps/consumer/src/lib/components/EngravedEmblem.svelte` (new) | Workstream G |
| `packages/schemas/src/masjid.ts` | Workstream A |
| `apps/api/src/lib/server/db/schema.ts` | Workstream A |
| `apps/api/src/lib/server/db/index.ts` | Workstream A |
| `schema.sql` | Workstream A |
| `apps/api/wrangler.toml` | Workstream A |
| `apps/admin/src/routes/admin/[slug]/settings/theme/+page.svelte` | Workstream A |
| `apps/consumer/src/routes/[masjid_slug]/donate/+page.svelte` | Workstream F |
| `apps/consumer/src/routes/[masjid_slug]/info/+page.svelte` | Workstream F |
| `apps/consumer/src/routes/[masjid_slug]/resources/+page.svelte` (new) | Workstream F |
| `tooling/engrave-photo.ts` (new) | Workstream G |
| `tooling/seed.ts` | Workstream A (add photo/logo seed values) |

---

## 3. Workstreams

Launch order and dependencies:

```
Wave 1 (no dependencies, launch immediately):
  A — Backend photo/logo fields + R2 upload + admin UI
  F — Wording/content fixes + Resources page
  G — Engraved line-art wireframe

Wave 2 (start against hardcoded URLs; wire to real fields once A lands):
  B — Homepage restructure
  C — Layout shell + header logo + footer

Wave 3 (after B + C have locked the DOM):
  D — Visual polish CSS
```

---

### Workstream A — Backend: photo/logo fields + R2 upload + admin UI

**Files owned:** see Contract 4.

**Tasks:**
1. Append `photo_url TEXT` and `logo_url TEXT` to `masjid_themes` in all three authoritative files:
   - `schema.sql` (end of `CREATE TABLE masjid_themes`)
   - `apps/api/src/lib/server/db/schema.ts` (end of the Drizzle column list)
   - `apps/api/src/lib/server/db/index.ts` `ensureTables()` (mirror for local SQLite)
2. Update `ThemeSchema` in `packages/schemas/src/masjid.ts`: add optional `photo_url` and `logo_url` (URL strings, or plain string if URL validation is awkward — keep it simple; use `.optional()`).
3. Update `PUT /api/v1/admin/masjids/{id}` so it writes `photo_url`/`logo_url` to the `masjid_themes` table AND mirrors them into the `style_options` JSON (`photoUrl`/`logoUrl`). See how existing theme keys are split between table and JSON in `+server.ts`.
4. Add `[[r2_buckets]]` to `apps/api/wrangler.toml`:
   ```toml
   [[r2_buckets]]
   binding = "ASSETS"
   bucket_name = "masjid-assets"
   ```
   (Same bucket the WhatsApp worker uses.)
5. Create upload endpoints:
   - `POST /api/v1/admin/masjids/{id}/upload-photo`
   - `POST /api/v1/admin/masjids/{id}/upload-logo`
   Each accepts `multipart/form-data`, calls `uploadToR2()` and `registerAsset()` from `@masjid/agent` (see `packages/agent/src/media.ts`), sets `associatedDomain = 'THEME'`, updates the `masjid_themes` row with the public R2 URL. JWT-authenticated.
   - **Local dev fallback:** in dev, `env.ASSETS` (R2 binding) is undefined. Write the file to `apps/consumer/static/uploads/` instead and return `/uploads/{filename}` as the URL. Detect dev mode the same way `getDb()` does (`import.meta.dirname` / better-sqlite3).
6. Admin theme page (`apps/admin/.../settings/theme/+page.svelte`): add a new "Images" section with:
   - Logo: file upload (→ upload-logo) + URL text input fallback
   - Homepage photo: file upload (→ upload-photo) + URL text input fallback
   - Show a preview thumbnail when a value is set.
7. Update `tooling/seed.ts`: set `photo_url`/`logo_url` on the seed masjids (can be null/empty for now — the demo will set them via admin UI or a one-off seed).

**Acceptance criteria:**
- `npm run check-schema` passes.
- The admin theme page can set a logo URL and photo URL and they persist.
- The upload endpoint works in local dev (writes to `static/uploads/`) and returns a usable URL.
- Existing API tests still pass (`npm run test`).

---

### Workstream B — Homepage restructure

**Files owned:** `apps/consumer/src/routes/[masjid_slug]/+page.svelte` ONLY.

**Tasks:**
1. **New hero with photo.** If `theme.style_options.photoUrl` is set, render a full-width hero `<section class="c-hero-photo">` with:
   - `background-image: url(photoUrl)` (inline style)
   - `<div class="c-hero-photo-overlay">` (gradient overlay, see Contract 1)
   - Masjid name in `<h1 class="c-hero-photo-title">`
   - Countdown in `<div class="c-hero-photo-count">` (reuse existing `countdownDisplay` / hero label logic)
   If `photoUrl` is NOT set, fall back to the current hero (HeroNiche for Mishkaat, countdown card for Sakeenah). Do NOT delete the existing hero code — keep it as the fallback branch.
2. **Move announcements up, front and center.** The pinned announcement (currently in the right sidebar, rendered as inline HTML) moves to the LEFT column, right under the hero, full-width, using class `c-announce-prominent`. Show the title + compiled HTML prominently. (Also consider showing recent announcements below the pinned one — but keep it simple; pinned first.)
3. **Demote the prayer table.** Move it below announcements. Change the heading to "Today's Prayer Times". Wrap in `c-prayer-compact`. Keep the table fully functional (current-row highlight, rosette marker, etc.).
4. **Remove HadithCard from the homepage.** Do not render it. Keep the import/component (used elsewhere / future use) but remove the render block.
5. **Remove the "upcoming changes" section** from the homepage (keep the data fetch if trivial, but do not render the section).
6. **Clean sidebar.** Right sidebar now contains: jumu'ah (pinned Thu–Fri for Mishkaat, otherwise normal position), homepage post (if any), donate CTA. No announcement card (it moved to the main column).
7. **Add section dividers** between hero → announcements → prayer using `<SectionDivider />` (Workstream D creates the component; if it doesn't exist yet, add a `<!-- divider -->` placeholder comment and let D fill it in).

**Acceptance criteria:**
- Homepage shows: hero (photo or fallback) → announcements → prayer table → sidebar (jumu'ah/post/donate).
- No hadith card, no upcoming-changes section on the homepage.
- Existing consumer tests still pass (`npm run test:consumer`). Update any tests that asserted the old section order.

---

### Workstream C — Layout shell + header logo + footer

**Files owned:** `apps/consumer/src/routes/[masjid_slug]/+layout.svelte` ONLY.

**Tasks:**
1. **Header logo.** If `theme.style_options.logoUrl` is set, render `<img class="c-logo-img" src={logoUrl} alt="{masjid.name} logo" />` in place of the current logo area (rosette for Mishkaat, letter avatar for Sakeenah). Fall back to current behavior when `logoUrl` is null. Keep the masjid name text next to the logo (or hide it if a logo makes it redundant — your call, but keep it simple and readable).
2. **Footer.** Add a `<footer class="c-ftr">` after `</main>`, before the closing root div:
   - `<div class="c-ftr-band"><StarBand band={16} /></div>` (import StarBand from `@masjid/ui-utils/components/StarBand.svelte`)
   - `<div class="c-ftr-body">` with: masjid name + `<Rosette size={12} />` glyph + `city, state` + contact phone/email
   - Muted text color (`--color-text-muted`), small font, centered or left-aligned (consistent with the app).
3. Ensure `photo_url`/`logo_url` (or `style_options.photoUrl`/`logoUrl`) are available in `$page.data`. The theme object already flows through `+layout.ts` → `$page.data.theme`. If `style_options` is used, `theme.style_options.photoUrl`/`logoUrl` are automatically available. If you rely on top-level `photo_url`/`logo_url`, confirm the page payload includes them (Workstream A's API change should surface them in the theme object).

**Acceptance criteria:**
- Header shows the logo image when set, fallback otherwise.
- Footer renders with name, rosette, location, contact, star band.
- Existing consumer tests still pass.

---

### Workstream D — Visual polish CSS

**Files owned:** `apps/consumer/src/app.css` ONLY, plus new `apps/consumer/src/lib/components/SectionDivider.svelte`.

**Tasks:**
1. **SectionDivider component** (`SectionDivider.svelte`): thin wrapper around `<StarBand band={...} />` with `opacity: 0.2`, centered, used between major sections. Import StarBand from `@masjid/ui-utils/components/StarBand.svelte`.
2. **Hero photo overlay** (`.c-hero-photo-overlay`): gradient from transparent → semi-transparent `--color-primary`/dark tint → `--color-bg` at the bottom, so the photo dissolves into the page rather than having a hard edge. Text on top must be readable (`text-shadow` or a dark scrim).
3. **Announcement card** (`.c-announce-prominent`): accent left border (`border-left` using `--color-accent`), `font-heading` title, subtle background tint, pinned badge (inline rosette). Build on the existing `.glass-card` base class.
4. **Mobile hero**: `@media (max-width: 640px)` — photo scales to viewport width, title/countdown text sizes reduce, overlay deepens for readability. Test at 375px.
5. **Gradient section backgrounds**: alternate subtle gradients between hero/announcement/prayer sections using `--color-bg` variants. Keep it subtle.
6. **Hover micro-effects**: cards get `transition: transform 150ms, box-shadow 150ms` and `:hover { transform: translateY(-1px); }` plus a slightly stronger shadow. Subtle.
7. **Loading skeleton**: a shimmer that mirrors the new hero + announcement + prayer layout during initial load (check how the current skeleton/shimmer works and adapt it).
8. **Footer CSS** (`.c-ftr`, `.c-ftr-band`, `.c-ftr-body`): minimal, muted, anchored to the bottom, respecting `--color-bg`/`--color-surface`.

**Rules:**
- Use ONLY the class names in Contract 1. If you need a new class, add it to Contract 1 in this doc and mention it in your summary.
- Respect the existing CSS architecture. This app uses hand-written CSS + CSS custom properties (`--color-*`, `--font-*`). No Tailwind classes for new work (the consumer uses Tailwind v4 but the design system reads from custom properties — match existing style). Read `app.css` first to understand conventions.
- Both style systems (Mishkaat and Sakeenah) must look correct. Gate Mishkaat-specific CSS behind `html[data-style-system='mishkaat']` if needed.

**Acceptance criteria:**
- The restructured homepage (from B + C) looks intentional and polished in both style systems.
- No layout regressions on mobile or desktop.
- Existing consumer tests still pass.

---

### Workstream F — Wording/content fixes + Resources page

**Files owned:** `apps/consumer/src/routes/[masjid_slug]/donate/+page.svelte`, `apps/consumer/src/routes/[masjid_slug]/info/+page.svelte`, new `apps/consumer/src/routes/[masjid_slug]/resources/+page.svelte`.

**Tasks:**
1. **Donate page messaging.** Add an admin-editable appeal field. Simplest approach: add a `donate_appeal` string key to `style_options` (passthrough — no schema migration) OR a new masjid profile field. Render it on the donate page. Default text: "Your contributions help sustain the masjid and its programs." Coordinate with Workstream A if a real field is preferred — but `style_options` passthrough is the fastest path and does NOT require A.
2. **Nav label changes.** The nav engine already supports custom labels/ordering (see `docs/nav-config.md`). For the demo, configure seed data / nav config to use the board's preferred labels. No code changes needed — just verify the mechanism works and document which labels to set.
3. **Hide the Posts tab.** Remove the Posts nav item from the default nav config (keep the posts engine and routes intact — just don't surface the tab). See `docs/nav-config.md` and the nav seed.
4. **WhatsApp group link on About Us.** Add `whatsapp_group_url` to the masjid profile (new column via Workstream A, OR a `style_options` key). Render a "Join Our WhatsApp Group" link (with a WhatsApp icon) on the Info/About page. Use `style_options` passthrough to avoid migration if A is backed up.
5. **Resources page.** Create `apps/consumer/src/routes/[masjid_slug]/resources/+page.svelte` that renders a markdown body (from a custom page or a `style_options.resourcesMarkdown` key, or a hardcoded default listing services like nikah officiation, financial help, etc.). Keep it markdown-driven so content can change without code. Add "Resources" to the default nav items.

**Acceptance criteria:**
- Donate page shows customizable appeal text.
- Posts tab is hidden, nav labels are configurable.
- About Us shows a WhatsApp group link when configured.
- Resources page renders markdown content and is reachable via nav.

---

### Workstream G — Engraved line-art wireframe

**Files owned:** new `tooling/engrave-photo.ts`, new static asset in `apps/consumer/static/`, new `apps/consumer/src/lib/components/EngravedEmblem.svelte`.

**Tasks:**
1. Install `imagetracerjs` (pure JS image-to-SVG tracer, no native deps): `npm install imagetracerjs` at the root (or add to the appropriate workspace).
2. Write `tooling/engrave-photo.ts`: reads a source photo path, runs imagetracer, outputs an SVG string, writes it to `apps/consumer/static/masjid-engraved.svg`.
3. Create `EngravedEmblem.svelte`: renders the engraved SVG inline. Used when `style_options.emblem === 'engraved'` (Mishkaat only). Apply it wherever the emblem would show (hero area, footer, about page — coordinate with B/C/D on placement, but the component is yours).
4. **Fallback:** if the engraving looks bad, provide a CSS-only treatment — `filter: grayscale(100%) contrast(150%) brightness(90%)` on the photo. This costs nothing and gives an etched look. Make `EngravedEmblem` able to fall back to this.
5. Wire into the hero: if `emblem === 'engraved'` and the engraved SVG exists, show it; otherwise show the photo. Mishkaat only.

**Reality check:** the masjid is plain brick (no minaret), so an engraving may actually *elevate* the building by abstracting away texture and color, leaving only form. Worth trying. But keep the CSS-filter fallback ready for tonight's demo if the tracer output is noisy.

**Acceptance criteria:**
- `node tooling/engrave-photo.ts <photo-path>` produces a usable SVG.
- `EngravedEmblem` renders the SVG or falls back to the CSS treatment.
- No regressions to existing tests.

---

## 4. Testing & verification (everyone)

- **Before committing any change:** run the relevant test suite for the files you touched.
  - Backend (A): `npm run test` and `npm run check-schema`
  - Consumer (B, C, D, F, G): `npm run test:consumer`
  - Admin (A): `npm run test:admin`
- **Schema changes (A):** run `npm run check-schema` and update `schema.sql` + `schema.ts` + `ensureTables()` together. New columns go at the END.
- **No `console.log`, `debugger`, or commented-out code** unless intentional.
- **`git add <specific-files>`** — never `git add -A`.

## 5. Demo notes (for the human coordinating)

- The masjid being redesigned ("Masjid Suffah") is configured in **production**, not in the local seed DB. For the local demo, configure a local masjid with the same settings via the admin UI, or register it fresh and apply settings.
- Photo/logo assets: the human has a photo (mediocre) and two logo files. Both logos will be tried; pick the better one during the demo.
- The business directory and Square paid-listings are **out of scope** for this sprint.
