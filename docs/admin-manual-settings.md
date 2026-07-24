# Admin Manual Settings: Page-by-Page Reference

## 0. Architecture Summary

The admin app runs on **port 5176** as a separate SvelteKit static SPA. It is
**independent** of the consumer app — if the consumer crashes or deploys broken
config, the admin remains operational.

- **Route prefix**: `/admin/[slug]` where `[slug]` is the masjid slug (e.g. `masjid-al-noor`)
- **Auth**: JWT-based login (`POST /api/v1/auth/login`), same as current admin API
- **CSS**: Tailwind v4 (same as consumer — not the hand-written CSS used by TV)
- **PWA**: Manifest for installability + minimal push-only service worker (no caching SW)
- **No AI on this page**: Manual settings only. AI bot is on `/admin/[slug]/bot` (see `docs/admin-ai-capabilities.md`)

---

## 1. Navigation Shell (`AdminShell.svelte`)

### Layout

```
┌──────────────┬──────────────────────────────────────┐
│ Sidebar      │ TopBar: masjid name, state,          │
│              │ WhatsApp status indicator            │
│ ─ Dashboard  ├──────────────────────────────────────┤
│   Bot (AI)   │                                      │
│ ─ Settings   │        <slot> page content           │
│   Profile    │                                      │
│   Theme      │                                      │
│   Prayer     │                                      │
│   Jumu'ah    │                                      │
│   Anncmnts   │                                      │
│   Domain     │                                      │
│   Snapshots  │                                      │
│   Account    │                                      │
│ ─ Log out    │                                      │
└──────────────┴──────────────────────────────────────┘
```

**Desktop**: Fixed sidebar (220px), scrollable content area.
**Mobile**: Bottom tab bar (Dashboard | Bot | Settings menu | Account), no sidebar.
The sidebar uses the same glass morphism as the consumer app.

### Sidebar Items

| Item | Icon | Route |
|------|------|-------|
| Dashboard | `LayoutDashboard` (lucide) | `/admin/[slug]` |
| AI Assistant | `MessageSquare` | `/admin/[slug]/bot` |
| — (divider) | | |
| Profile | `Building2` | `/admin/[slug]/settings/profile` |
| Theme | `Palette` | `/admin/[slug]/settings/theme` |
| Prayer Rules | `Clock` | `/admin/[slug]/settings/prayer` |
| Jumu'ah | `Users` | `/admin/[slug]/settings/jumuah` |
| Announcements | `Megaphone` | `/admin/[slug]/settings/announcements` |
| Domain | `Globe` | `/admin/[slug]/settings/domain` |
| Snapshots | `History` | `/admin/[slug]/settings/snapshots` |
| Account | `Key` | `/admin/[slug]/settings/account` |
| Logout | `LogOut` | `/admin` (login page) |

Active route is highlighted with `--color-accent` background (matches per-masjid theme).

### TopBar

- Left: Masjid name + City, ST (from `page.data.masjid`)
- Right: Status indicators
  - **WhatsApp**: green dot + "Connected" if `admin.whatsapp_phone` is set; grey dot + "Not configured" otherwise
  - **Domain**: green/yellow/grey based on `ssl_status`

---

## 2. Dashboard (`/admin/[slug]`)

**Purpose**: At-a-glance overview after login. Every section loads independently.

### Sections

#### 2.1. Service Status Card
A row of three status chips:
- **WhatsApp**: Connected (+15551230001) / Not configured
- **Domain**: Active (masjid-al-noor.org) / Pending / Not configured
- **API Health**: green dot + "Healthy" (pinged via `GET /api/v1/masjids/[slug]`)

#### 2.2. Today's Schedule
A condensed version of the consumer PrayerList showing:
- Current/next prayer with countdown
- Jumu'ah sessions if today is Friday

#### 2.3. Active Sessions
If an OPEN branch exists:
- "Active session: web-2026-07-22 (3 changes pending)" with link to Bot page
- Auto-abandon warning if branch is in grace period

#### 2.4. Content Summary Cards
Three stat cards showing counts:
- **Announcements**: Drafts (badge) / Published / Archived
- **Jumu'ah**: Active sessions count
- **Prayer Rules**: Total rules count

#### 2.5. Recent Snapshots
Last 5 snapshots as a compact list: timestamp, source (WhatsApp/Web from branch prefix), mutation count. "View all" → `/admin/[slug]/settings/snapshots`

### Resilience
Each section is wrapped in its own `{#await}` block with an `ErrorCard` fallback.
If the API is partially down, the sections that work still render.

---

## 3. Profile Settings (`/admin/[slug]/settings/profile`)

### Form Fields

| Field | Input Type | Zod Validation | Notes |
|-------|-----------|----------------|-------|
| Masjid Name | text | 1-255 chars, required | |
| Address | textarea | optional | |
| City | text | optional | |
| State | text | optional, max 2 chars | State abbreviation |
| Postal Code | text | optional | |
| Phone | tel | optional, E.164 if provided | |
| Email | email | optional, valid email | |
| Website | url | optional, valid URL | |
| Donation URL | url | optional, valid URL | |
| Facebook URL | url | optional | |
| Twitter/X URL | url | optional | |
| YouTube URL | url | optional | |
| Instagram URL | url | optional | |
| Latitude | number (step=0.0001) | -90 to 90 | Used for prayer calculation |
| Longitude | number (step=0.0001) | -180 to 180 | Used for prayer calculation |
| Calculation Method | select | 1-7, required | See dropdown labels below |
| Timezone | searchable select | required | IANA tz (e.g. "America/Chicago") |

### Calculation Method Dropdown
```
1 — Shia Ithna-Ashari
2 — ISNA (Islamic Society of North America)
3 — MWL (Muslim World League)
4 — Makkah (Umm al-Qura University)
5 — Egyptian General Authority of Survey
6 — University of Tehran (Institute of Geophysics)
7 — University of Karachi (Hanafi)
```

### Timezone Picker
Uses an `<input list>` or a lightweight searchable dropdown component (not a full
date/time picker — just a list of IANA timezone strings filtered by region).
Defaults to `Intl.DateTimeFormat().resolvedOptions().timeZone`.

### Behavior
- **Load**: Fetches `GET /admin/masjids/[id]` — fills all fields
- **Save**: `PUT /admin/masjids/[id]` with only dirty fields (uses Zod partial schema)
- **Reset**: Button to revert all fields to last-saved state
- **Validation**: Client-side Zod mirror of `UpdateMasjidSchema` + `PrayerConfigUpdateSchema`
- **Error handling**: Inline field errors (red border + message below field). Toast on save success/failure.

---

## 4. Theme Settings (`/admin/[slug]/settings/theme`)

### Section: Layout Preset

Two radio cards (not radio buttons — visual preview cards):

```
┌──────────────────────┐  ┌──────────────────────┐
│  ░░░░░░░░░░░░░░░░░░  │  │  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓  │
│  ░░  glass-dark  ░░  │  │  ▓▓ minimal-light ▓▓ │
│  ░░░░░░░░░░░░░░░░░░  │  │  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓  │
│  Dark, glass panels   │  │  Light, clean cards  │
└──────────────────────┘  └──────────────────────┘
```

Each card shows a mini preview of the preset.

### Section: Colors

Two color pickers with hex input:
- **Primary Color** — native `<input type="color">` + text input for hex value
- **Accent Color** — same

Swatch preview next to each: a 24px circle with the current color.

### Section: Fonts

Two searchable selects (same component as timezone picker):
- **Heading Font**: Inter, Roboto, Amiri, Noto Naskh Arabic, Scheherazade New
- **Body Font**: same list

Font names are rendered in their own typeface (WYSIWYG).

### Section: Time Format

Toggle switch: `12h  [===]  24h`. Default based on current `time_format` (or `'24h'`).

### Section: Custom Labels

10 text inputs:

| Label | Field | Default |
|-------|-------|---------|
| Adhaan label | `label_adhaan` | "Adhaan" |
| Iqaamah label | `label_iqaamah` | "Iqaamah" |
| Jumu'ah label | `label_jumuah` | "Jumu'ah" |
| Sunrise label | `label_sunrise` | "Sunrise" |
| Fajr prayer name | `label_fajr` | "Fajr" |
| Dhuhr prayer name | `label_dhuhr` | "Dhuhr" |
| Asr prayer name | `label_asr` | "Asr" |
| Maghrib prayer name | `label_maghrib` | "Maghrib" |
| Isha prayer name | `label_isha` | "Isha" |
| Speech label | `label_speech` | "Speech" |

Inputs show the default as placeholder text. Empty = use default.
Common presets button: "Indo-Pak" fills Azaan/Iqamah/Zuhr/Jummah.

### Section: Live Preview

An `<iframe srcdoc="...">` or shadow-DOM div that renders a miniature PrayerCard
with the current theme selections. Updates on input change (debounced 300ms).

```
┌─────────────────────────────┐
│  Fajr                        │
│  Adhaan    4:32 AM           │
│  Iqamah    4:52 AM  [Now]    │
└─────────────────────────────┘
```

The preview uses the same `applyTheme()` function from `@masjid/ui-utils` and
honors all custom labels.

### Behavior
- **Load**: `GET /admin/masjids/[id]` — extracts the `theme` object
- **Save**: `PUT /admin/masjids/[id]` with `theme: { ... }` subset
- **Preset change**: When switching presets, the color/font fields update to
  the preset defaults (with a toast: "Preset applied. You can customize further.")
- **Reset to defaults**: Button with confirmation dialog. Resets all fields to
  the current preset's defaults.

### Resilience
- If the theme in the DB is corrupted (invalid hex color, missing fields),
  the form falls back to `glass-dark` defaults for rendering but still shows
  the raw DB values for editing.
- Color inputs reject non-hex values client-side before submission.
- Font dropdown defaults to "Inter" if the DB value isn't in the list.
- Labels that are empty or missing show the default as placeholder.

---

## 5. Prayer Rules (`/admin/[slug]/settings/prayer`)

### Section: Rules Table

A sortable table with drag-and-drop reorder.

| Column | Content |
|--------|---------|
| # | Drag handle (≡) + order number |
| Prayer | Colored badge: Fajr / Dhuhr / Asr / Maghrib / Isha |
| Name | Rule name (editable inline) |
| Conditions | Summary chips (e.g. "Sundays", "Jun–Aug", "Always") |
| Action | Summary (e.g. "+10 min", "Round up 5", "Fixed 1:30 PM") |
| Actions | Edit (pencil icon), Delete (trash icon) |

**Inline Edit** (opens when clicking the pencil):
- Prayer: radio buttons or select
- Rule name: text input
- Conditions: add/remove condition rows
  - Condition type: select (Always / Day of week / Month / Hijri month / Date range)
  - Value: multi-select chips (days: S M T W T F S, months: Jan–Dec, date range: two date pickers)
- Action: radio for type, dependent value input
- Save / Cancel buttons

**Reorder**: Rows are draggable (using `@atlaskit/pragmatic-drag-and-drop`).
On drop, calls `PUT /prayer/rules/reorder` with the new ID order.

**Delete**: Confirmation dialog: "Delete rule '[rule_name]'? This cannot be undone."

**Add Rule**: Button below the table opens a blank inline editor row.

### Section: Dry-Run Simulator

Collapsible panel below the rules table.

```
┌─────────────────────────────────────────────────────┐
│ Dry-Run Simulator                              [−]  │
│                                                     │
│ Date: [2026-07-24    ]  Method: [ISNA (2)     ▾]    │
│                                 [Run Simulation]    │
│                                                     │
│ ┌─────────┬──────────┬──────────┬─────────────┐     │
│ │ Prayer  │ Adhaan   │ Iqaamah  │ Right After? │    │
│ ├─────────┼──────────┼──────────┼─────────────┤     │
│ │ Fajr    │ 4:32 AM  │ 4:52 AM  │      —      │     │
│ │ Dhuhr   │ 1:15 PM  │ 1:30 PM  │      —      │     │
│ │ Asr     │ 5:45 PM  │ 6:00 PM  │      —      │     │
│ │ Maghrib │ 8:30 PM  │ 8:40 PM  │      —      │     │
│ │ Isha    │ 10:15 PM │ 10:30 PM │      ✓       │     │
│ └─────────┴──────────┴──────────┴─────────────┘     │
└─────────────────────────────────────────────────────┘
```

- Date defaults to the next Friday (for Jumu'ah testing); can be changed
- Method and timezone are pre-filled from profile but can be overridden
- "Run Simulation" button manually triggers `POST /prayer/dry-run`
- Results table highlights cells where ad-hoc overrides differ from stored rules
- No auto-run on every rule change — explicit button to avoid API spam

### Behavior
- **Load**: `GET /prayer/rules` — populates table
- **Create**: `POST /prayer/rules`
- **Update**: `PUT /prayer/rules/[rule_id]`
- **Delete**: `DELETE /prayer/rules/[rule_id]` — auto-reorders remaining rules
- **Reorder**: `PUT /prayer/rules/reorder`

### Resilience
- Rules with broken `conditions_json` or `action_json` show a ⚠️ icon and
  "Invalid — edit to fix" in the conditions/action columns. Opening the edit
  form pre-fills with empty valid defaults.
- Before bulk reorder, an auto-snapshot is created (see §10 Snapshots).
- Dry-run works even if the rules list fails to load (uses only ad-hoc overrides).

---

## 6. Jumu'ah Settings (`/admin/[slug]/settings/jumuah`)

### Table

| Column | Content |
|--------|---------|
| Active | Toggle switch |
| Label | Text input |
| Time | Time picker (HH:MM) |
| Khateeb | Text input |
| Location | Text input (optional) |
| Speech Time | Time picker (optional, HH:MM) |
| Actions | Edit / Delete |

### Add Session
Button below table → inline row with empty fields. "Save" commits `POST /jumuah`.

### Behavior
- **Load**: `GET /jumuah`
- **Create**: `POST /jumuah` — required: label + time; optional: khateeb, location, speech_time
- **Update**: `PUT /jumuah/[session_id]` — partial update including `is_active` toggle
- **Delete**: `DELETE /jumuah/[session_id]` — confirmation dialog, undo toast for 5s

### Resilience
- Null/empty khateeb or speech_time show "—" instead of crashing.
- Delete undo: when the user deletes, the row fades out and a toast appears:
  "Session deleted. [Undo]". Clicking Undo re-creates the session via `POST /jumuah`
  with the previous values. After 5 seconds, the toast dismisses and deletion is final.

---

## 7. Announcements (`/admin/[slug]/settings/announcements`)

### Section: Announcements List

A table with status filter tabs: **All | Draft | Published | Archived**

| Column | Content |
|--------|---------|
| Status | Colored badge (draft=grey, published=green, archived=red) |
| Pinned | Pin icon (click to toggle) |
| Title | Clickable → opens editor |
| Published | Date or "—" |
| Expires | Date or "Never" |
| Actions | Edit / Delete (archive) |

### Section: Announcement Editor

Side panel (slides in from right on desktop, full-screen modal on mobile).

**Fields**:
- **Title**: text input, required
- **Content**: Markdown textarea + live preview (split pane on desktop, tabbed on mobile)
  - Preview compiles markdown client-side using `marked` (mirrors API's `compileMarkdown()`)
  - Supported syntax: `# ## ###`, `**bold**`, `*italic*`, `[link](url)`, `---`, paragraphs
  - Preview uses the masjid's theme (colors/fonts) for a realistic look
- **Status**: radio (Draft / Published)
- **Pin**: checkbox — "Pin this announcement (only one pinned at a time)"
- **Expiry Date**: date picker (optional)

### Behavior
- **Load**: `GET /announcements`
- **Create**: `POST /announcements`
- **Update**: `PUT /announcements/[slug]`
- **Delete**: `DELETE /announcements/[slug]` — soft-deletes (sets status to "archived")
- **Pin**: `PUT /announcements/[slug]/pin` — toggles pin, auto-unpins previous

### Resilience
- Broken markdown in editor displays raw text in preview with a subtle warning banner:
  "Preview may be inaccurate — check your syntax." The API-side `compileMarkdown()`
  is regex-based and won't crash on bad input.
- If an announcement has no `compiled_html` (shouldn't happen, but defensive),
  the editor shows the `content_markdown` fallback.
- Editor auto-saves draft content to `localStorage` every 10 seconds so the admin
  doesn't lose work if they accidentally navigate away.

---

## 8. Domain Settings (`/admin/[slug]/settings/domain`)

### Current Domain Display
- If a domain exists: shows domain name, SSL status badge, verification instructions
- If no domain: shows "No custom domain configured" with an Add button

### Add Domain
- **Input**: FQDN text field with client-side regex validation
- **Help text**: "Enter your domain (e.g. masjid-alnoor.org). You'll need to add a
  CNAME record in your DNS settings pointing to Cloudflare."
- **Save**: `POST /domains`

### Delete Domain
- Button → confirmation: "Remove [domain]? Your site will revert to the default
  subdomain."
- **Delete**: `DELETE /domains/[domain_id]`

### Resilience
- If the domain API is unreachable, show "Domain management unavailable" instead
  of crashing.
- Domain validation uses the same regex as `CreateDomainSchema`:
  `/^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/`

---

## 9. Snapshots / Rollback (`/admin/[slug]/settings/snapshots`)

### Snapshot List Table

| Column | Content |
|--------|---------|
| Created | Timestamp (e.g. "2026-07-22 14:30 UTC") |
| Source | Badge: "WhatsApp" or "Web" (from branch name prefix) |
| Type | Badge: "Auto" (prefixed `pre-`) or "Manual" (user `/confirm`) |
| Changes | Count (e.g. "5 mutations") |
| Domains affected | Domain badges (e.g. "PRAYER_RULES", "THEME") |
| Preview | Expand/collapse chevron → shows mutation list |
| Restore | Button → confirmation dialog |

### Expandable Preview Row

When expanded, shows a mini diff receipt (styled, not WhatsApp markdown):

```
PRAYER_RULES
  + Create: "Friday Dhuhr" — Set fixed time 1:30 PM
  + Create: "Default Dhuhr" — Add 10 minutes

THEME
  ~ Update: primary_color → #2563eb
  ~ Update: font_body → Roboto
```

### Restore Flow

1. Click "Restore" → confirmation dialog:
   ```
   ┌─────────────────────────────────────────┐
   │ Restore from snapshot?                   │
   │                                          │
   │ This will overwrite your current         │
   │ configuration with the state from        │
   │ 2026-07-22 14:30 UTC.                   │
   │                                          │
   │ Affected: Profile, Theme, Prayer Rules   │
   │                                          │
   │ A backup of your current state will be   │
   │ saved before restoring.                  │
   │                                          │
   │         [Cancel]    [Restore]            │
   └─────────────────────────────────────────┘
   ```
2. Before restoring, the admin API creates a new snapshot labeled `pre-rollback-auto`
   containing the current state.
3. On success: toast "Configuration restored to 2026-07-22 14:30 UTC. [Undo]"
   Undo restores from the `pre-rollback-auto` snapshot.
4. On failure: toast "Restore failed. Your current configuration was not modified."

### Behavior
- **Load**: Calls a new admin endpoint `GET /admin/snapshots?masjid_id=...` that returns
  the same data as `listSnapshots()` but enriched with domain breakdowns and mutation
  previews.

### Resilience
- Auto-snapshots TTL out after 30 days (cleanup via `scheduled()` cron in worker).
- Manual snapshots (from `/confirm`) are permanent.
- Auto-snapshot before every dangerous operation (theme preset switch, bulk rule
  reorder, manual rollback) → "pre-{operation}-auto" label.
- If the snapshots endpoint returns 500, the table shows an error state with a
  retry button.

---

## 10. Account Settings (`/admin/[slug]/settings/account`)

### Password Change Form

| Field | Input | Validation |
|-------|-------|------------|
| Current Password | password | Required, min 1 |
| New Password | password | Required, min 8, max 128 |
| Confirm New Password | password | Must match new password |

### Password Strength Meter
- < 8 chars: red "Too short"
- 8-11 chars: yellow "Fair"
- >= 12 chars: green "Strong"

### Behavior
- **Save**: `PUT /admin/masjids/[id]/admin` with `{ current_password, new_password }`
- **Error**: Inline error on current password field if wrong ("Current password is incorrect")
- **Success**: Toast "Password changed." Fields clear.

### Resilience
- If the API returns 401, the error is shown inline on the current password field.
- If 500, generic toast: "Something went wrong. Please try again later." Form retains values.

---

## 11. Cross-Cutting Resilience Patterns

### 11.1 Section-Level Error Boundaries

Every page wraps each data-fetching section in its own error boundary:

```svelte
{#await profilePromise}
  <SkeletonForm />
{:then profile}
  <ProfileForm data={profile} />
{:catch error}
  <ErrorCard
    title="Could not load profile"
    message={error.message}
    onRetry={() => profilePromise = loadProfile()}
  />
{/await}
```

If the profile API fails, the form area shows an error card but the sidebar
navigation and other page sections continue to work.

### 11.2 Auto-Snapshot Before Dangerous Operations

| Operation | Auto-snapshot label |
|-----------|-------------------|
| Theme preset switch | `pre-theme-switch-{preset}` |
| Bulk rule reorder | `pre-rules-reorder` |
| Delete all rules | `pre-rules-bulk-delete` |
| Manual rollback restore | `pre-rollback-auto` |
| Bot `/confirm` | Handled by `mergeBranch()` in `@masjid/agent` |

### 11.3 Form Safety

- **Dirty tracking**: Submit button disabled until form is changed AND valid
- **No partial saves**: Forms submit atomically. If validation fails, nothing is saved.
- **Confirm dialogs**: Required for delete operations, preset switches, and rollback.
- **Undo toasts**: Deletions show a 5-second undo toast that re-creates the deleted item.

### 11.4 Offline Awareness (No Caching)

The admin app does **not** cache via service worker. The browser's built-in cache
handles static assets. A `.push-only-sw.js` exists solely to receive push notifications.

When `navigator.onLine === false`, a non-dismissible banner appears at the top:
"You're offline — changes cannot be saved." Form submit buttons are disabled.
When connectivity returns, the banner disappears automatically.

### 11.5 Self-Healing on Corrupt Config

| Scenario | Recovery |
|----------|----------|
| Theme color is invalid hex | `applyTheme()` falls back to `glass-dark`. Form shows raw value with warning badge. |
| Prayer rule has broken JSON | Table row shows ⚠️. Edit form pre-fills with valid defaults. |
| Announcement HTML is corrupted | Editor shows raw markdown with warning. Save re-compiles. |
| Jumu'ah time is invalid format | Cell shows "Invalid" in red. Edit still works. |
| Calculation method is out of range | Dry-run falls back to ISNA (2). Profile form shows warning. |
| Timezone is unrecognized | Falls back to "America/Chicago" with warning badge in form. |
| Snapshot has corrupted `full_state_json` | Row shows "Corrupted" badge. Restore button is disabled. |