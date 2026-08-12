# Admin App: Test Strategy & Test Plan

## 1. Test Pyramid

```
        ┌──────┐
        │ E2E  │  5%  — Playwright: full admin workflow
        ├──────┤
        │ Int. │ 25%  — vitest + testing-library: page-level integration
        ├──────┤
        │ Unit │ 70%  — vitest: components, api client, auth, validation
        └──────┘
```

| Layer | Runner | Environment | File location |
|-------|--------|-------------|---------------|
| Unit | vitest | jsdom | `apps/admin/src/__tests__/components/`, `lib/` |
| Integration | vitest | jsdom | `apps/admin/src/__tests__/routes/` |
| E2E | Playwright | Chromium (headless) | `apps/admin/tests/e2e/` |

---

## 2. Vitest Configuration

```ts
// vitest.admin.config.ts
import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import path from 'path';

export default defineConfig({
  plugins: [svelte({ compilerOptions: { runes: true } })],
  resolve: {
    alias: {
      $lib: path.resolve(__dirname, 'apps/admin/src/lib'),
      $app: path.resolve(__dirname, 'apps/admin/src/__tests__/__mocks__/$app'),
    },
    conditions: ['browser'],
  },
  test: {
    globals: true,
    include: ['apps/admin/src/__tests__/**/*.test.ts'],
    environment: 'jsdom',
    setupFiles: ['apps/admin/src/__tests__/setup.ts'],
  },
});
```

**Test script**: `"test:admin": "vitest run --config vitest.admin.config.ts"`

---

## 3. Test Setup File

```ts
// apps/admin/src/__tests__/setup.ts
import '@testing-library/jest-dom/vitest';

// Mock global fetch for api client tests
globalThis.fetch = vi.fn();

// Mock localStorage for auth tests
const store: Record<string, string> = {};
globalThis.localStorage = {
  getItem: vi.fn((key: string) => store[key] ?? null),
  setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
  removeItem: vi.fn((key: string) => { delete store[key]; }),
  clear: vi.fn(() => { for (const k in store) delete store[k]; }),
  length: 0,
  key: vi.fn(() => null),
};

// Mock matchMedia for Tailwind responsive classes
globalThis.matchMedia = vi.fn().mockImplementation((query: string) => ({
  matches: false,
  media: query,
  onchange: null,
  addListener: vi.fn(),
  removeListener: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  dispatchEvent: vi.fn(),
}));

// Mock IntersectionObserver
globalThis.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Reset fetch mock between tests
beforeEach(() => {
  vi.mocked(globalThis.fetch).mockReset();
});
```

---

## 4. SvelteKit Mock (`$app` mocks)

```ts
// apps/admin/src/__tests__/__mocks__/$app/navigation.ts
export const goto = vi.fn();
export const invalidate = vi.fn();
export const invalidateAll = vi.fn();
export const beforeNavigate = vi.fn();
export const afterNavigate = vi.fn();
```

```ts
// apps/admin/src/__tests__/__mocks__/$app/stores.ts
import { writable } from 'svelte/store';

export const page = writable({
  url: new URL('http://localhost/admin/masjid-al-noor'),
  params: { slug: 'masjid-al-noor' },
  data: {},
  status: 200,
  error: null,
});

export const navigating = writable(null);
export const updated = writable(false);
```

---

## 5. Unit Tests

### 5.1 API Client (`lib/api.test.ts`) — ~25 tests

Tests the admin API client (`apps/admin/src/lib/api.ts`). This is **not** the
`@masjid/agent` proxy — it's a browser-side fetch wrapper that attaches the
login JWT and handles errors.

| Test | What it verifies |
|------|-----------------|
| `login()` | POSTs email+password, stores JWT, returns admin record |
| `login()` failure | Returns error on 401, clears JWT |
| `getMasjidProfile()` | GET with auth header, returns parsed profile |
| `getMasjidProfile()` 401 | Redirects to login page |
| `updateMasjidProfile()` | PUT with auth header + body |
| `updateMasjidProfile()` validation error | Returns field-level errors |
| `getPrayerRules()` | GET returns parsed rules array |
| `createPrayerRule()` | POST with body, returns new rule |
| `deletePrayerRule()` | DELETE with rule ID |
| `reorderPrayerRules()` | PUT with new order array |
| `getJumuahSessions()` | GET returns parsed sessions |
| `createJumuahSession()` | POST with label+time |
| `updateJumuahSession()` | PUT with partial body |
| `deleteJumuahSession()` | DELETE with session ID |
| `getAnnouncements()` | GET returns parsed announcements |
| `createAnnouncement()` | POST with title+content |
| `updateAnnouncement()` | PUT with slug + body |
| `archiveAnnouncement()` | DELETE soft-deletes |
| `pinAnnouncement()` | PUT toggles pin |
| `getSnapshots()` | GET returns snapshots with mutation counts |
| `rollbackRestore()` | POST with snapshot_id |
| `changePassword()` | PUT with current+new password |
| `changePassword()` wrong | Returns error on 401 |
| `getOpenBranches()` | GET returns active branches |
| `token refresh` | Automatically includes JWT from storage |

### 5.2 Auth Store (`lib/auth.svelte.test.ts`) — ~10 tests

Tests the auth rune (`auth.svelte.ts`) that manages login state.

| Test | What it verifies |
|------|-----------------|
| Initial state | Not logged in, no admin data |
| `login(email, password)` | Calls API, sets admin, stores token |
| `logout()` | Clears admin, removes token, redirects |
| `checkAuth()` | Valids: reads token from localStorage, validates with server |
| `checkAuth()` expired | Clears token, redirects to login |
| Token in URL | Extracts token from `?token=` param on deep link |
| Auto-logout on 401 | Any API call returning 401 triggers logout |
| `isAuthenticated` | Derived boolean from admin state |
| `currentMasjidSlug` | Derived from admin data |
| `hasWhatsApp` | Derived boolean from admin.whatsapp_phone |

### 5.3 Formatters (`lib/format.test.ts`) — ~8 tests

| Test | What it verifies |
|------|-----------------|
| `formatTime()` 24h | Returns "14:30" |
| `formatTime()` 12h | Returns "2:30 PM" |
| `formatTime()` midnight | Returns "12:00 AM" / "00:00" |
| `formatDate()` | Returns "Jul 22, 2026" |
| `formatRelative()` | Returns "2 hours ago", "3 days ago" |
| `formatDomainLabel()` | "PRAYER_RULES" → "Prayer Rules" |
| `formatMutationAction()` | "CREATE" → "+ Create", "DELETE" → "− Delete" |
| `truncate()` | Long string → "The quick brown..." (30 chars) |

---

## 6. Component Tests — Settings Pages

All component tests use `@testing-library/svelte` with `render()` and follow
the same pattern as consumer tests (e.g., `PrayerTable.test.ts`).

### 6.1 `ProfileForm.svelte` — ~10 tests

| Test | What it verifies |
|------|-----------------|
| Renders all fields | 18 fields visible (name, address, contact, URLs, coords, method, tz) |
| Pre-fills from props | All fields show values from `data` prop |
| Validation: required | Name empty → error message, submit disabled |
| Validation: email | Invalid email → error message |
| Validation: URL | Invalid URL → error message |
| Validation: coords | Lat > 90 → error message |
| Submit calls API | `onSave` callback called with dirty fields only |
| Reset button | Reverts all fields to initial values |
| Disabled when not dirty | Submit button disabled until change made |
| Loading state | Submit button shows spinner, fields disabled |
| Error state | API error shown as toast, form retains values |

### 6.2 `ThemeForm.svelte` — ~12 tests

| Test | What it verifies |
|------|-----------------|
| Preset cards render | Two preset cards (glass-dark, minimal-light) |
| Active preset highlighted | Currently selected preset has accent border |
| Color pickers | Primary + accent color inputs work |
| Hex text input | Typing "#ff0000" updates swatch |
| Font selects | Dropdown shows font names in their typeface |
| Time format toggle | Click toggles between 12h/24h |
| Label inputs | 10 text inputs, show defaults as placeholder |
| Indo-Pak preset button | Fills Azaan/Iqamah/Zuhr/Jummah |
| Live preview updates | Changing primary color updates preview iframe |
| Preset switch | Switching preset resets colors/fonts to defaults |
| Reset to defaults | Button + confirmation resets all fields |
| Submit calls API | `onSave` callback with `{ theme: {...} }` |

### 6.3 `PrayerRulesTable.svelte` — ~14 tests

| Test | What it verifies |
|------|-----------------|
| Empty state | "No rules yet" message + add button |
| Renders rules | Rules displayed in table with prayer badge, name, conditions, action |
| Sort order | Rules displayed in `execution_order` order |
| Inline edit open | Clicking pencil opens edit form in row |
| Edit: change prayer | Radio buttons update prayer field |
| Edit: change conditions | Add/remove condition rows |
| Edit: change action | Action type radio updates value input |
| Edit: save | Calls `onUpdateRule` with updated fields |
| Edit: cancel | Closes form without saving |
| Add new rule | "Add Rule" button opens blank edit row |
| Add: save | Calls `onCreateRule` with new rule data |
| Delete rule | Trash icon → confirmation → calls `onDeleteRule` |
| Reorder drag | Row can be dragged to new position |
| Corrupt rule | ⚠️ icon shown for rule with broken JSON |

### 6.4 `DryRunSimulator.svelte` — ~6 tests

| Test | What it verifies |
|------|-----------------|
| Collapsed by default | Panel is hidden, shows expand button |
| Expand | Clicking expands to show simulator |
| Date picker | Defaults to next Friday |
| Method/timezone | Pre-filled from profile |
| Run button | Click calls `onRun` with config |
| Results table | Renders 5 prayer rows with adhaan/iqaamah/right-after |

### 6.5 `JumuahTable.svelte` — ~8 tests

| Test | What it verifies |
|------|-----------------|
| Empty state | "No sessions" + add button |
| Renders sessions | Each row: active toggle, label, time, khateeb, location, speech |
| Toggle active | Toggle switch calls `onUpdateSession` with `is_active: false` |
| Edit inline | Row becomes editable |
| Edit: save | Calls `onUpdateSession` |
| Add session | Inline row at bottom |
| Add: save | Calls `onCreateSession` |
| Delete | Confirmation → calls `onDeleteSession` |

### 6.6 `AnnouncementEditor.svelte` — ~12 tests

| Test | What it verifies |
|------|-----------------|
| Empty editor | Title + markdown textarea + preview + status + pin + expiry |
| Markdown preview | Typing `**bold**` shows bold in preview |
| Heading preview | `# Title` shows h1 in preview |
| Link preview | `[text](url)` shows link in preview |
| Status radio | Draft / Published toggle |
| Pin checkbox | Checkbox + "only one pinned" helper text |
| Expiry date picker | Date input, optional |
| Save draft | Calls `onSave` with `status: 'draft'` |
| Publish | Calls `onSave` with `status: 'published'` |
| Edit existing | Pre-fills all fields from props |
| Title required | Empty title → error, save disabled |
| Broken markdown | Shows raw text in preview with warning banner |
| Auto-save to localStorage | Content saved every 10 seconds |

### 6.7 `AnnouncementsList.svelte` — ~6 tests

| Test | What it verifies |
|------|-----------------|
| Empty state | "No announcements" message |
| Status filter tabs | All / Draft / Published / Archived tabs filter rows |
| Pin toggle | Clicking pin icon updates announcement |
| Click title | Opens editor with that announcement |
| Delete (archive) | Click → confirmation → calls `onArchive` |
| Undo delete | Toast undo button calls `onRestore` |

### 6.8 `SnapshotList.svelte` — ~8 tests

| Test | What it verifies |
|------|-----------------|
| Empty state | "No snapshots yet" |
| Renders snapshots | Each: timestamp, source badge, type badge, count |
| Expand preview | Clicking chevron shows mutation list |
| Domain badges | Colored badges for affected domains |
| Restore button | Enabled for valid snapshots |
| Restore confirmation | Dialog shows affected domains |
| Restore success | Calls `onRestore`, shows toast |
| Corrupted snapshot | "Corrupted" badge, restore disabled |
| Auto-snapshot label | "Auto" badge shown for `pre-` snapshots |

### 6.9 `PasswordForm.svelte` — ~4 tests

| Test | What it verifies |
|------|-----------------|
| Three password fields | Current, new, confirm rendered |
| Validation: min length | < 8 chars → error |
| Validation: match | Confirm doesn't match → error |
| Submit calls API | `onChangePassword` called with correct fields |

### 6.10 `DomainForm.svelte` — ~4 tests

| Test | What it verifies |
|------|-----------------|
| No domain | Shows "No domain configured" + add button |
| Has domain | Shows domain + SSL status badge + verification instructions |
| Add domain | Validates FQDN, calls `onAddDomain` |
| Delete domain | Confirmation → calls `onDeleteDomain` |

### 6.11 `AdminShell.svelte` — ~6 tests

| Test | What it verifies |
|------|-----------------|
| Sidebar renders | All nav items visible |
| Active route highlighted | Current route has accent background |
| Masjid name in topbar | Shows masjid name + city/state |
| WhatsApp status | Green dot when phone set, grey when not |
| Domain status | Green/yellow/grey based on SSL |
| Slot content | Page content rendered in slot area |

### 6.12 Shared Components — ~10 tests

| Component | Tests |
|-----------|-------|
| `SkeletonForm` | 1 test — renders shimmer placeholders |
| `ErrorCard` | 3 tests — renders title, message, retry button click |
| `Toast` | 3 tests — renders message, auto-dismiss, undo button if provided |
| `ConfirmDialog` | 3 tests — renders title, body, confirm/cancel button callbacks |

---

## 7. Component Tests — Bot Panel

### 7.1 `BotChat.svelte` — ~14 tests

| Test | What it verifies |
|------|-----------------|
| Empty state | Welcome message from system, input ready |
| Send text message | User message appears, "Thinking..." indicator |
| Bot text response | Bot message appears after API response |
| Bot diff receipt | `DiffReceiptCard` rendered when `diff_data` present |
| Confirm button | Click → success message, branch merged |
| Cancel button | Click → "Session cancelled", branch abandoned |
| Multiple rounds | Second message appends to same session |
| Session bar | Shows branch name + mutation count |
| Input disabled during send | Input + button disabled while "Thinking..." |
| Enter to send | Pressing Enter sends (Shift+Enter = newline) |
| File upload click | Paperclip → file picker → image appears as user message |
| Drag-and-drop | dragging file shows overlay, drop sends |
| Invalid file type | Shows error toast for non-image files |
| File too large | Shows error toast for >10MB |

### 7.2 `DiffReceiptCard.svelte` — ~10 tests

| Test | What it verifies |
|------|-----------------|
| Empty state | "No changes" message (shouldn't normally happen) |
| Single mutation | Renders domain badge + mutation detail |
| Multiple mutations | Renders all mutations grouped by domain |
| Grouping | Two PRAYER_RULES mutations under one domain header |
| Domain colors | Theme=purple, Profile=blue, Rules=amber, Jumuah=green, Announcements=cyan |
| Action icons | Create=+, Update=~, Delete=−, Pin=📌, Reorder=↕ |
| Confirm button | Emits `confirm` event |
| Cancel button | Emits `cancel` event |
| Multiple domains | Groups are separated, each with its own color |
| Long mutation text | Truncated with tooltip on hover |

### 7.3 `ChatInput.svelte` — ~4 tests

| Test | What it verifies |
|------|-----------------|
| Typing | Text updates in textarea |
| Send button | Enabled when text non-empty, disabled when empty |
| Send event | Emits `send` with message text, clears input |
| File button | Emits `file` event with selected file |

---

## 8. Integration Tests — Route-Level

These tests render full page components with mocked `fetch` to verify end-to-end
data flow from API to rendered DOM.

### 8.1 Login Page — ~4 tests

| Test | What it verifies |
|------|-----------------|
| Login form renders | Email + password inputs + submit button |
| Successful login | Calls API, stores token, redirects to dashboard |
| Failed login | Shows error message, form retains values |
| Already logged in | Redirects to dashboard |

### 8.2 Dashboard Page — ~6 tests

| Test | What it verifies |
|------|-----------------|
| Renders masjid info | Name + location from API |
| Service status | Shows WhatsApp/Domain/API health chips |
| Today's schedule | Shows current prayer from board data |
| Active session | Shows branch info when open branch exists |
| Content counts | Shows announcement/jumuah/rules counts |
| Error state | Section shows ErrorCard when API call fails |

### 8.3 Settings Pages (one per domain) — ~6 tests

| Test | What it verifies |
|------|-----------------|
| Page loads data | Fetches from API, renders form with data |
| Save mutation | Form submit → API call → success toast |
| Validation error | API returns 400 → field-level errors shown |
| Save failure | API returns 500 → error toast, form retains values |
| Not authorized | API returns 401 → redirect to login |
| Not your masjid | API returns 403 → error page |

---

## 9. E2E Tests (Playwright)

### 9.1 Setup

```ts
// apps/admin/tests/e2e/admin.spec.ts
import { test, expect } from '@playwright/test';

const API_URL = 'http://localhost:5173';
const ADMIN_URL = 'http://localhost:5176';
const CREDENTIALS = { email: 'admin@masjid-alnoor.org', password: 'password123' };
```

### 9.2 Test Scenarios (~15 tests)

| # | Test | Steps |
|---|------|-------|
| 1 | **Login flow** | Navigate to `/admin` → fill email+password → submit → redirected to dashboard |
| 2 | **Login fail** | Wrong password → error message shown |
| 3 | **Dashboard loads** | After login → dashboard shows masjid name, service status, prayer schedule |
| 4 | **Profile form** | Navigate to settings/profile → all fields pre-filled → change name → save → verify updated |
| 5 | **Theme preset switch** | Navigate to settings/theme → click minimal-light card → save → verify theme updated |
| 6 | **Prayer rule create** | Navigate to settings/prayer → click Add → fill rule → save → new rule appears in table |
| 7 | **Prayer rule delete** | Click trash on a rule → confirm → rule removed |
| 8 | **Dry-run** | Expand dry-run panel → click Run → table shows 5 prayer times |
| 9 | **Jumu'ah session create** | Navigate to settings/jumuah → add session → save → appears in list |
| 10 | **Announcement create** | Navigate to settings/announcements → new → fill title+content → publish → appears in list |
| 11 | **Snapshot restore** | Navigate to settings/snapshots → click Restore → confirm → toast success |
| 12 | **Password change** | Navigate to settings/account → fill current+new+confirm → save → success toast |
| 13 | **Bot chat** | Navigate to bot → type message → send → thinking indicator → diff receipt card → confirm |
| 14 | **Logout** | Click logout → redirected to login page → dashboard inaccessible without login |
| 15 | **Mobile navigation** | Resize to 375px → bottom tab bar visible → settings menu expands |

### 9.3 Playwright Config

```ts
// apps/admin/playwright.config.ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  retries: 1,
  use: {
    baseURL: 'http://localhost:5176',
    trace: 'on-first-retry',
  },
  webServer: [
    { command: 'npm run dev --workspace=@masjid/api', port: 5173, reuseExistingServer: true },
    { command: 'npm run dev --workspace=@masjid/admin', port: 5176, reuseExistingServer: true },
  ],
});
```

**Test script**: `"test:admin:e2e": "playwright test --config apps/admin/playwright.config.ts"`

---

## 10. Expected Test Counts

| Category | Tests |
|----------|-------|
| Unit: API client | 25 |
| Unit: Auth store | 10 |
| Unit: Formatters | 8 |
| Unit: Components (settings) | ~90 |
| Unit: Components (bot) | ~28 |
| Unit: Shared components | ~10 |
| **Unit subtotal** | **~171** |
| Integration: Route-level | ~16 |
| **Integration subtotal** | **~16** |
| E2E: Playwright | 15 |
| **E2E subtotal** | **15** |
| **Total** | **~230** |

This brings the total test suite to: 673 (API) + 266 (TV) + 40 (agent) + 231 (WhatsApp) + 165 (consumer) + 23 (tooling) + 230 (admin) = **~1,628 tests**. (Plus 12 SW tests and 7 integration tests that require running servers.)

---

## 11. Continuous Integration

```bash
# Root package.json scripts to add:
"test:admin": "vitest run --config vitest.admin.config.ts"
"test:admin:e2e": "playwright test --config apps/admin/playwright.config.ts"
"test:agent": "vitest run --config vitest.agent.config.ts"
"test:all": "npm run test && npm run test:agent && npm run test:tv && npm run test:consumer && npm run test:whatsapp && npm run test:admin"
```

---

## 12. Implementation Order for Tests

1. **API client tests** — Foundation: everything depends on `api.ts` working
2. **Auth store tests** — Second foundation: login/logout flow
3. **Shared component tests** — ErrorCard, Toast, ConfirmDialog, SkeletonForm
4. **Settings component tests** — One domain at a time (Profile → Theme → Prayer → Jumu'ah → Announcements → Domain → Snapshots → Account)
5. **AdminShell tests** — Shell + navigation
6. **Bot component tests** — DiffReceiptCard → ChatInput → BotChat
7. **Integration tests** — Route-level pages
8. **E2E tests** — Full workflows