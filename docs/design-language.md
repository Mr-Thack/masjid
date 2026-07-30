# Design Language & Naming — Mihraab, Sakeenah, Mishkaat

> **Status:** Canonical. This document is the single source of truth for product naming,
> style-system architecture, and the Mishkaat flagship specification.
> All agents MUST follow the terminology and rules here. (2026-07-28)

---

## 1. Names (decided, do not re-litigate)

| Name | What it is | Spelling / pronunciation |
|---|---|---|
| **Mihraab** | The **platform** itself — the entire product (API, consumer PWA, TV display, admin, WhatsApp worker) | `Mihraab` (double-a), "mih-RAAB". Domain: **mihraab.pro** |
| **Sakeenah** | The **minimal style system** — what exists today (`glass-dark`, `minimal-light`). Kept for masjids wanting super simple | `Sakeenah`, "sa-KEE-nah" |
| **Mishkaat** | The **flagship style system** — the new soul-forward experience specified below | `Mishkaat` (double-a), "mish-KAAT" |

### Why these names

- **Mihraab** — the mihrab is the niche every masjid orients toward; the screen is what the
  congregation turns toward five times a day. The mihrab arch is also a free, ownable logo shape.
  (`mihrab.app` / `mihraab.app` were taken; `mihraab.pro` is ours.)
- **Sakeenah** — tranquility. The current system is calm, quiet, and simple. It is *not* deprecated;
  it is the supported "simple & minimal" choice.
- **Mishkaat** — from Ayat an-Nur (24:35): *"...a niche (mishkaat) within which is a lamp; the lamp
  is in glass, as if it were a brilliant star."* A warm lamp behind glass in a darkened prayer hall —
  the exact visual thesis of the flagship system. Also nods to *Mishkat al-Masabih*, the hadith
  collection, fitting the teaching-screen mission.

### Reserved names (future Mishkaat presets — do not use for anything else)

| Name | Reserved for |
|---|---|
| `manara` | Portrait-orientation Mishkaat preset (vertically mounted TVs — minarets are tall) |
| `mashrabiya` | Pattern-forward lattice preset |
| `qandeel` | Festive/seasonal preset (Ramadan-forward) |

**Forbidden collisions:** never name anything `sakina` (collides with Sakeenah) and never name a
preset `mihrab` (collides with the platform name Mihraab).

### The one-word rule

Total invented vocabulary imposed on this project: **three words** (Mihraab, Sakeenah, Mishkaat),
plus future preset names that only ever appear in a dropdown with a thumbnail. Everything else is
plain English — in admin UI labels **and in code identifiers** (`hadithFrame`, `quietMode`,
`ambientPalette` — not `mishkatEngine`, not `sakinaMode`).

---

## 2. Terminology standard (use exactly these terms)

| Term | Meaning | Storage / code |
|---|---|---|
| **Style system** | A top-level design family with its own layout behavior, feature set, and presets. One of: `sakeenah`, `mishkaat` | `masjid_themes.style_system` (new column) |
| **Preset** | A named token bundle *within* a style system (colors, surfaces, shadows) | `masjid_themes.layout_preset` (existing column) |
| **Theme option** | A single parametric customization (metal, motif, arch, numerals, density, …) | `masjid_themes.style_options` JSON column (new) |
| **Frame** | One rotating content panel in the Mishkaat soul column (hadith, announcements, jumu'ah, …) | `hadithFrame`, `frameRotation` in code |
| **Ceremony state** | A full-screen behavioral mode triggered by prayer-time events (adhaan, iqaamah, quiet, night calm) | `ceremonyState` in code |
| **Quiet mode** | Post-iqaamah dimmed state | `quietMode` |
| **Night calm** | After-Isha light veil over the readable board, lifts before Fajr | `'night-calm'` ceremony state |
| **Ambient palette** | Time-of-day background tint that follows the sun | `ambientPalette` |
| **Soul column** | The left column of the Mishkaat TV layout hosting rotating frames | `soulColumn` |

**Do / don't:**

- DO say "style system" — DON'T say "theme engine", "skin", or "style method".
- DO say "preset" for a token bundle — DON'T call presets "themes" (the DB field stays
  `layout_preset`; the table stays `masjid_themes`; but in prose, a *preset* lives inside a
  *style system*).
- Admin-facing UI NEVER shows architecture jargon. Admins see plain labels (§7.9).

---

## 3. The two style systems at a glance

| | **Sakeenah** (minimal) | **Mishkaat** (flagship) |
|---|---|---|
| Purpose | Simple, clean, fast. For masjids that want only times | Full soul: identity, ceremony, teaching |
| Presets | `glass-dark` (default), `minimal-light` | `mishkaat` (default; gold-on-espresso). Reserved: `manara`, `mashrabiya`, `qandeel` |
| Layout | Current layouts, unchanged | RTL reading grammar (§7.1) |
| Frames / rotation | No | Yes (§7.5) |
| Ceremony states | No (existing flash-pulse only) | Yes (§7.6) |
| Ambient palette | No | Yes (§7.4) |
| Ornament | None | Honeycomb hairlines, one arch, rosette (§7.3) |
| Typography | Inter/Roboto | Amiri headings + tabular numerals (§7.2) |
| Who it's for | "Just the times" | The default for new masjids once shipped |

Existing masjids keep their current settings (their `style_system` stays `sakeenah`). Mishkaat
becomes the default for **new** masjids once Phase 1 ships.

---

## 4. The overarching goal (read this before touching any of it)

A prayer-hall screen must have **soul**. Soul decomposes into five properties:

1. **Specificity** — it could only belong to a masjid (arch, calligraphy, gold, Hijri date, hadith).
   Generic modernism is placeless; placelessness reads as sterile.
2. **Warmth of light** — the room's screen should feel like a window onto the time of day, not a
   spreadsheet. Dark-warm base, gold accents, ambient palette that follows the sun.
3. **Reverence** — the times are framed as something precious (manuscript discipline), not as
   departures-board logistics.
4. **It teaches** — hadith, duas, observances. The screen gives, not only informs.
5. **Adab** — the screen observes the room's etiquette: it quiets itself for salah, sleeps at
   night, celebrates Eid, and never competes with the prayer.

**Why the old client screen was loved:** it had specificity, warmth, and teaching (arched gold
panels, sunset photography, hadith panel, Arabic calligraphy).
**Why it failed:** inverted hierarchy (decoration > data), photo-killed contrast, cryptic columns,
clip-art, static density.
**Why the current (Sakeenah) screen was rejected by the board:** it deleted every identity marker
at once — no arch, no gold, no calligraphy, no hadith — and its full-white background caused
physical glare in a dim prayer hall ("it's too white").

Mishkaat keeps the new information hierarchy (huge tabular times, single board payload, flash
pulse) and restores the soul inside that discipline.

### The three budgets (non-negotiable)

Soul dies by accumulation. Every Mishkaat surface obeys:

1. **Motion budget** — at most ONE island animates at a time; 15–30s rotation cadence; 600–900ms
   gentle transitions; nothing drifts constantly; `prefers-reduced-motion` disables rotation
   entirely (highest-priority frame renders statically).
2. **Audio budget** — silence. (Adhaan audio is parked, see §9.)
3. **Ornament budget** — pattern lives at edges, corners, and dividers only, tone-on-tone at low
   contrast, **never behind a numeral**; one arch per screen; one motif per screen.

### The content rules

- **Deterministic content gets built-in frames** (prayer times, dates, seasons, observances).
- **Community-variable content flows through the announcements system** (taraweeh pace, Juz'
  tracking, fundraiser totals, events). The masjid controls everything that varies by community.
- **The screen never rules on a fiqh question.** No moon-sighting implications, no
  calculation-as-ruling, no madhhab endorsements. It displays what the masjid has decided.
- Hadith/verse content must come from a curated, sourced collection (Arabic + English, with
  reference), date-seeded so rotation needs zero admin work, and context-seeded where possible
  (Fajr virtues at Fajr, Jumu'ah hadith on Friday).

---

## 5. Continuity markers (board-acceptance strategy)

When demoing to a masjid board, plant 4–5 unmistakable carryovers from whatever they had:
**(1)** two-panel composition (times one side, reminders the other), **(2)** gold, **(3)** the
Arabic calligraphy name, **(4)** the hadith panel, **(5)** honeycomb — now a hairline border.
People approve renovations of *their* screen, not demolitions.

---

## 6. Sakeenah specification (the minimal system — already built)

Sakeenah is the current system, unchanged:

- Presets: `glass-dark` (default) and `minimal-light`, as defined in
  `packages/ui-utils/src/presets.ts`.
- TV: existing hand-written CSS (`apps/tv/src/app.css`), existing components, existing
  announcement marquee, existing flash pulse. No frames, no ceremony states, no ambient palette.
- Consumer: existing Tailwind v4 + `@theme` setup.
- Positioning: "simple & minimal". Fully supported, not legacy.
- Known gap (unchanged): `minimal-light` still lacks true light-mode glass variants.

---

## 7. Mishkaat specification (the flagship — to build)

### 7.1 Layout: RTL reading grammar

Arabic, Urdu, and Persian read right-to-left; the prayer board is the "start" of the page.
LTR readers locate the largest element regardless of position, so this costs them nothing and
gives RTL readers a screen that feels made for them.

- **Prayer board on the RIGHT** (~70%); **soul column on the LEFT** (~30%).
- Header mirrored: masjid name **right**, dates **left**. Arabic name above English name when
  provided (bilingual is space-permitting, not guaranteed).
- Announcement marquee scrolls **right-to-left**.
- Frame transitions slide rightward (enter from left, exit right).
- Numerals stay Western (`5:29`) and LTR by default; **Arabic-Indic numerals** (`٥:٢٩`) are a
  theme option (`numerals: 'western' | 'arabic-indic'`).
- Clock hands stay clockwise. Some conventions belong to everyone.

### 7.2 Typography

- **Amiri** (already in the font stack) for: masjid name, section headings, Hijri date, hadith.
  Theme option `font_heading` may substitute Scheherazade New or Noto Naskh.
- **Times and numbers: modern sans, `tabular-nums`, always.** 20-foot legibility is
  non-negotiable and outranks every other aesthetic concern.
- Hijri date gets typographic prominence (gold, with Arabic month name when feasible).

### 7.3 Ornament

- **Star-and-octagon band** on the prayer board — eight-point stars interlocking with octagons
  (the same star as the rosette), tone-on-tone, low contrast, edges only. The band is bracketed
  by hairline rules (panel border outside, inset rule inside) so it reads as one cohesive
  ribbon. Default motif: `eight-point-star`; options: `eight-point-star | honeycomb | girih |
  arabesque | none`. A motif band must always be at least one tiling row tall — narrower bands
  clip the pattern into meaningless notches.
- **One mihrab arch** per screen, as a **niche for the clock** in the soul column (the way a
  mihrab frames the imam); theme option `arch: true | false`.
- **Eight-point star rosette** as the recurring identity glyph: current-prayer marker, header
  divider, arch apex detail.
- Corner flourishes permitted on panels (manuscript discipline). No pattern behind numerals, ever.

### 7.4 Palette: dark-warm base + ambient palette

- Base: espresso/near-black backgrounds, warm ivory text, **gold default accent**
  (`#d4af37` family). **No large pure-white surfaces anywhere** (glare in dark halls, burn-in,
  "too white" complaint).
- **Metal** theme option recolors accents: `gold` (default) | `silver` | `copper` | `rose`.
  Same soul, different jewelry — this is the primary vanity knob.
- **Ambient palette** (theme option `ambient: true | false`, default true): the background tint
  breathes with the prayer-linked solar phases — deep pre-dawn blue before Fajr, gold wash at
  sunrise, neutral midday, amber approaching Maghrib, deep night after Isha. Subtlety is
  mandatory: tints shift surface hues a few percent, never content colors. Side effect: the
  screen is dimmest at Fajr exactly when the hall is darkest.
- `primary_color` / `accent_color` remain as raw overrides on top of metal.

### 7.5 Frames (the soul column)

Static screens must choose between soul and minimalism; rotating screens get both by
time-slicing. The soul column hosts exactly one visible frame at a time.

**Frame inventory (priority order):**

| Frame | Source | Behavior |
|---|---|---|
| Jumu'ah Times | board payload | **Pinned** Thursday–Friday; rotates normally otherwise |
| Hadith of the Day | curated collection (new data) | Arabic (Amiri) + English + source; date-seeded; context-seeded by occasion |
| Announcements | board payload (already returns 20) | One at a time |
| Schedule Changes | board payload upcoming changes | Suppressed when empty |
| Donate (two slides) | masjid donation URL | Slide 1: appeal text ("Same times, in your pocket"); slide 2: scan-to-give QR. Text and QR never share a frame — together they are visually too much |
| Community frames | announcements system | Taraweeh/Juz', fundraisers, events — masjid-controlled |

**Choreography rules:**

1. **The prayer board and clock NEVER move.** Rotation happens only in the soul column.
2. 15–30s per frame; 600–900ms crossfade or slow rightward slide; ease-out.
3. One island animates at a time. Nothing else on the screen may move during a transition
   (the marquee pauses or is demoted to a frame at implementer's discretion).
4. Empty frames do not render (an empty "JUMU'AH SESSIONS" header must be impossible).
5. Context-awareness: countdown dominates near iqaamah; hadith appears after iqaamah;
   announcements when people linger after salah.
6. `prefers-reduced-motion`: no rotation; render the single highest-priority non-empty frame.

### 7.6 Ceremony states ("Prayer Alerts" in admin)

The screen participates in the salah. Triggered by server-synchronized time (§7.7):

1. **Adhaan moment** — existing flash-pulse extends into a brief (~30s) full-screen state:
   everything dims, prayer name large in Amiri, "Adhaan now".
2. **Iqaamah countdown** — between adhaan and iqaamah, a serene full-screen countdown takes
   over. ("How long till iqaamah?" is the most-asked question in every musalla.)
3. **Prayer in progress** — after iqaamah, "prayer in progress" for the expected salah duration,
   so latecomers know before entering.
4. **Quiet mode** — then the screen fades to near-black: prayer name, one line of dhikr at most.
   Wakes gently before the next prayer window.
5. **Night calm** — after Isha + ~90 min, a 20% black veil settles over the whole board:
   noticeably calmer at night, but every prayer time stays readable (people still check times
   from the hall at night — a full shutdown is not acceptable). Lifts before Fajr.
6. **Friday mode** — khutbah times become the hero; quiet Surah al-Kahf reminder.
7. **Ramadan mode** — Maghrib (iftar) countdown becomes the emotional center; suhoor-ends shown
   at Fajr. (Juz'/taraweeh details come via announcements, not built-ins.)
8. **Eid mode** — on Eid mornings: Eid Mubarak calligraphy + Eid salah time as hero.
   Deterministic from the Hijri date.

### 7.7 Clock & time integrity

- **Server-derived time, always.** The TV clock is corrected against board-payload server time;
  smart-TV hardware clocks drift minutes, and every ceremony state depends on honesty here.
- **Classic clock face** — enamel/ivory or deep face, gold hands, clean ticks (the wireframe
  clock dies). Optional countdown arc on the dial showing time-to-next-iqaamah.
- Digital time remains available alongside.

### 7.8 Masjid Logo (engraved emblem)

- Admin uploads a photo of *their actual building* (admin UI or WhatsApp → `masjid_assets`).
- Rendered as a **duotone line-art engraving**, tone-on-tone, in the header or footer strip —
  the pride of the old photo backgrounds without the kitsch or the contrast poison.
- Default when absent: eight-point star medallion. Theme option `emblem: 'engraved' | 'medallion'`.

### 7.9 Admin-facing labels (admins never see our vocabulary)

| Feature | Admin sees |
|---|---|
| Style system picker | **Style** (cards with live previews: "Mishkaat — the full experience" / "Sakeenah — simple & minimal") |
| Theme options page | **Screen Appearance** (Metal, Pattern, Arch, Numerals, Density) |
| Frames | **Screen Panels** (toggle list) |
| Ceremony states | **Prayer Alerts** |
| Quiet mode + night calm | **Quiet Hours** |
| Ambient palette | **Day & Night Colors** |
| Hadith frame | **Hadith of the Day** |
| Engraved emblem | **Masjid Logo** |
| Multi-screen roles (future) | **Displays** |

### 7.10 Reliability & dignity

- **Dignified offline:** if the API drops, render the cached schedule in full Mishkaat styling
  with a graceful "showing cached schedule" note. Never an error page.
- **Burn-in:** quiet mode is the primary defense; the night calm veil dims but never blacks
  the screen (times stay readable), so pixel drift matters more at night. Pixel drift is
  optional and, if implemented, must wander ±12–16px (numeral strokes are ~30px; 1–2px does
  nothing).
- **Density option** (`density: 'standard' | 'large-print'`) for aging congregations.

---

## 8. Data model & code map

### Schema (keep `schema.sql` AND Drizzle schema in sync — lesson #18)

```sql
-- masjid_themes additions:
style_system  TEXT NOT NULL DEFAULT 'sakeenah'   -- 'sakeenah' | 'mishkaat'
style_options TEXT NOT NULL DEFAULT '{}'         -- JSON, interpreted per style system
```

- All 15 existing `masjid_themes` fields are unchanged and keep working.
- Mishkaat options live in `style_options`: `metal`, `motif`, `arch`, `numerals`, `density`,
  `ambient`, `quietHours`, `frames` (enabled list), `emblem`, `donateAppeal` (donate slide
  wording). Unknown keys are ignored; missing keys fall back to defaults. This avoids column
  sprawl per system.
- New masjids default to `style_system = 'mishkaat'` once Phase 1 ships.

### Where things live

| Concern | Location |
|---|---|
| Preset tokens (add Mishkaat blocks) | `packages/ui-utils/src/presets.ts` |
| Runtime application (`applyTheme` sets `data-style-system` on `<html>` so CSS can branch) | `packages/ui-utils/src/apply-theme.ts` |
| Zod schema (styleSystem enum, styleOptions passthrough) | `packages/schemas/src/masjid.ts` |
| TV implementation (no Tailwind — hand-written CSS only) | `apps/tv/src/app.css`, `apps/tv/src/lib/components/` |
| Consumer theming | `apps/consumer/src/app.css` (`@theme` bridge unchanged) |
| Hadith collection (new, curated JSON: arabic, english, source, occasion tags) | `packages/ui-utils/src/hadith.ts` (or new package data module) |
| Code identifiers | plain English: `hadithFrame`, `quietMode`, `ambientPalette`, `soulColumn`, `ceremonyState` |

### Constraints that still bind (unchanged)

- No Tailwind on TV. Hand-written CSS only.
- No prop-drilled colors; everything through CSS custom properties.
- API times are always 24h; `formatTime()` handles display.
- Svelte 5 runes only. No `class:` directive with `/`-containing classes.
- `prefers-reduced-motion` kills all animation.

---

## 9. Parked ideas (do not build without a new decision)

| Idea | Why parked |
|---|---|
| Adhaan audio from the TV | Some fuqaha do not accept a prerecorded adhaan; any sizable masjid has a muazzin. May return for small musallahs later. |
| Moon-phase / hilal features | Moon-sighting is a live community fault line; the screen must never appear to rule on fiqh. Possible opt-in far later. |
| Bilingual prayer names on the board | Space constraint. Bilingual lives in the hadith frame for now; add to the board only if space is found. |
| Janaza somber register | Large masjids have frequent janazah; a perpetually mourning screen inverts the feature. (A plain announcement `category` field may still be added as infrastructure.) |
| Multi-screen roles (`?role=lobby`) | Good idea, later phase. |
| City-wide federation ("Manara") | Absurd-tier but promising; parked. |
| Own TLD (`.msjd` / `.mihraab`) | ~$227k+ ICANN fee, registry operations burden, religious-string politics killed `.islam`/`.halal` in 2012. Subdomains (`name.mihraab.pro`) achieve the effect at $0. Revisit as a closed brand TLD only if the platform gets large. |

**Never import from the old client screen:** photographic backgrounds, ornament behind text,
cryptic "next change" columns, clip-art, fast motion.

---

## 10. Phased rollout

| Phase | Contents | Exit criteria |
|---|---|---|
| **0. Plumbing** | `style_system` + `style_options` columns (schema.sql + Drizzle), Zod updates, `applyTheme` sets `data-style-system` | Existing tests green; Sakeenah behavior identical |
| **1. Mishkaat core** | Preset tokens (espresso/gold), RTL layout, Amiri headings, honeycomb hairline + arch, classic clock face, server-time sync | Static flagship board renders on TV; board demo ready |
| **2. Frames** | Soul column, rotation choreography, hadith collection, schedule-changes frame, donate QR | Rotation respects all budgets + reduced-motion |
| **3. Ceremony** | Adhaan/iqaamah states, quiet mode, night calm, ambient palette, Friday/Ramadan/Eid modes | State machine driven by server time; glare solved at Fajr |
| **4. Vanity** | Logo engraving pipeline, numerals option, density option, admin "Screen Appearance" page | Admin can restyle without an agent |
| **5. Later** | Displays (roles), federation, anything parked | New decision required |

---

## 11. Agent checklist (before any Mishkaat PR)

- [ ] Uses the §2 terminology; code identifiers are plain English.
- [ ] Colors only via CSS custom properties / preset tokens — nothing hardcoded.
- [ ] Three budgets respected (motion, audio, ornament).
- [ ] Prayer board + clock never animate, never rotate away.
- [ ] `schema.sql` and Drizzle schema updated together.
- [ ] No fiqh rulings; no new vocabulary; no Tailwind on TV.
- [ ] `prefers-reduced-motion` path tested.
- [ ] Server-derived time used for all ceremony logic.
