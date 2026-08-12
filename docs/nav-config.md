# Configurable Navigation

> **Status**: Spec + Implemented (2026-08-06, updated 2026-08-11). This document is the canonical reference for per-masjid
> navigation configuration across the consumer app and admin dashboard.
>
> **Implementation notes**: (a) The `UpdateNavItemSchema` uses a flat partial object (all fields optional), not `z.discriminatedUnion` — discriminated unions reject partial updates without the `kind` field (see AGENTS.md Lesson 52). (b) The D1 schema uses `INTEGER 0/1` not `BOOLEAN`. (c) No `UNIQUE(masjid_id, sort_order)` constraint exists — the reorder endpoint handles dedup. (d) All CRUD endpoints and the consumer `/nav` route are implemented.

---

## 1. Motivation

Today the consumer navigation is 100% hardcoded (5 items in `+layout.svelte:57-83`).
Every masjid gets the same nav — Home, Times, News, Info, Maktab. Masjids want to:

- Hide pages they don't use (e.g. no Maktab program → remove Maktab)
- Pin additional built-in routes (Donate, Jumu'ah, Announcements)
- Add custom pages (markdown content managed via admin)
- Add external links (e.g. link to their existing website or donation platform)
- Reorder items
- Highlight one important item (typically Times)
- Control which items appear on the mobile bottom bar vs hamburger-only

---

## 2. Data Model

### 2.1 New table: `nav_items`

```sql
CREATE TABLE nav_items (
    id              TEXT PRIMARY KEY,
    masjid_id       TEXT NOT NULL REFERENCES masjids(id) ON DELETE CASCADE,
    sort_order      INTEGER NOT NULL,
    kind            TEXT NOT NULL CHECK(kind IN ('route', 'page', 'link')),

    -- kind='route': built-in system route
    route_segment   TEXT,       -- prayer | news | info | maktab | donate | jumuah | announcements
                                -- (Home is IMPLICIT — clicking the masjid name/logo goes home.
                                --  Home must never appear in nav_items.)

    -- kind='page': custom markdown page (FK to masjid_pages.slug)
    page_slug       TEXT,

    -- kind='link': external URL
    external_url    TEXT,

    -- Display
    label           TEXT NOT NULL,
    icon            TEXT,       -- Lucide icon name (e.g. 'Clock', 'Newspaper', 'Info', 'GraduationCap',
                                --   'Heart', 'Users', 'Megaphone', 'ExternalLink', 'FileText')
    is_highlighted  BOOLEAN NOT NULL DEFAULT FALSE,
    show_on_desktop_header BOOLEAN NOT NULL DEFAULT TRUE,
    show_on_mobile_bottom  BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(masjid_id, sort_order)
);
CREATE INDEX idx_nav_items_masjid ON nav_items(masjid_id, sort_order);
```

### 2.2 Constraints

- **Only one item can be `is_highlighted = TRUE`** per masjid. Enforced at the API layer (not DB, since SQLite doesn't have partial unique indexes with conditions on expressions).
- **`route_segment` must be a valid built-in route**: one of `prayer`, `news`, `info`, `maktab`, `donate`, `jumuah`, `announcements`. `home` is NOT a valid segment — it's implicit.
- **`kind` determines required fields**: `route` requires `route_segment`; `page` requires `page_slug`; `link` requires `external_url`.
- **`sort_order` must be contiguous** starting from 0. The reorder endpoint handles this.
- **Maximum 5 items on mobile bottom bar**. Items beyond 5 with `show_on_mobile_bottom = TRUE` are demoted to hamburger-only at render time.

### 2.3 Icon Identifiers

Icons use **Lucide icon names** (matching the `lucide-svelte` import). The consumer frontend maps these strings to Lucide components via a lookup:

| Identifier | Lucide Icon | Default for |
|---|---|---|
| `Clock` | `Clock` | Times |
| `Newspaper` | `Newspaper` | News |
| `Info` | `Info` | Info |
| `GraduationCap` | `GraduationCap` | Maktab |
| `Heart` | `Heart` | Donate |
| `Users` | `Users` | Jumu'ah |
| `Megaphone` | `Megaphone` | Announcements |
| `ExternalLink` | `ExternalLink` | External links |
| `FileText` | `FileText` | Custom pages |

An icon mapping utility in the consumer maps these strings to actual Lucide component imports. Unknown/null icons fall back to a default per kind.

### 2.4 Default Seed

New registrations get these 4 items (Home is implicit):

| sort_order | kind | segment | label | icon | highlighted | desktop | mobile_bottom |
|---|---|---|---|---|---|---|---|
| 0 | route | prayer | Times | Clock | **TRUE** | TRUE | TRUE |
| 1 | route | news | News | Newspaper | FALSE | TRUE | TRUE |
| 2 | route | info | Info | Info | FALSE | TRUE | TRUE |
| 3 | route | maktab | Maktab | GraduationCap | FALSE | TRUE | TRUE |

Existing masjids: a migration backfills these 4 items for every masjid that has zero nav_items.

---

## 3. API Endpoints

### 3.1 Public

**`GET /api/v1/masjids/{slug}/nav`**

Returns ordered nav items for the consumer frontend. No auth required.

Response:
```json
{
  "nav_items": [
    {
      "id": "...",
      "sort_order": 0,
      "kind": "route",
      "route_segment": "prayer",
      "label": "Times",
      "icon": "Clock",
      "is_highlighted": true,
      "show_on_desktop_header": true,
      "show_on_mobile_bottom": true
    },
    {
      "id": "...",
      "sort_order": 1,
      "kind": "link",
      "external_url": "https://donate.example.com",
      "label": "Donate",
      "icon": "Heart",
      "is_highlighted": false,
      "show_on_desktop_header": true,
      "show_on_mobile_bottom": false
    }
  ]
}
```

Also: **add `nav_items` to the existing `PagePayload`** in `apps/consumer/src/lib/api.ts` and to the response of `GET /api/v1/masjids/{slug}` so the layout load function gets it in one request.

### 3.2 Admin (all require JWT auth)

All under `/api/v1/admin/masjids/{id}/nav`:

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/nav` | List all items (ordered by sort_order) |
| `POST` | `/nav` | Add a new item (appended at end) |
| `PUT` | `/nav/{itemId}` | Update a single item |
| `DELETE` | `/nav/{itemId}` | Delete an item (reorders remaining) |
| `PUT` | `/nav/reorder` | Bulk reorder. Body: `{ "item_ids": ["id1", "id2", ...] }` — sets sort_order based on array position |

**Validation on create/update:**
- `kind='route'`: `route_segment` required, must be a valid segment
- `kind='page'`: `page_slug` required, referenced page must exist
- `kind='link'`: `external_url` required, must be a valid URL
- Only one `is_highlighted=TRUE` allowed — setting it auto-clears any other
- `label` max 30 chars
- `icon` must be a known identifier or null (defaults per kind if null)

### 3.3 Custom Pages — Wire Up `masjid_pages`

The `masjid_pages` table already exists but has zero API routes. Add:

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/v1/admin/masjids/{id}/pages` | List all pages |
| `POST` | `/api/v1/admin/masjids/{id}/pages` | Create page (slug, title, raw_markdown) |
| `GET` | `/api/v1/admin/masjids/{id}/pages/{pageSlug}` | Get single page |
| `PUT` | `/api/v1/admin/masjids/{id}/pages/{pageSlug}` | Update page |
| `DELETE` | `/api/v1/admin/masjids/{id}/pages/{pageSlug}` | Delete page |
| `GET` | `/api/v1/masjids/{slug}/pages/{pageSlug}` | Public page view (returns title, compiled_html, last_updated) |

**Markdown compilation**: When a page is created/updated, compile `raw_markdown` → `compiled_html` using the same markdown compiler used for posts and announcements (check existing `compileMarkdown` utility in the API codebase).

### 3.4 Consumer Route for Custom Pages

Add route: `apps/consumer/src/routes/[masjid_slug]/pages/[page_slug]/+page.svelte`
- Load function fetches `GET /api/v1/masjids/{slug}/pages/{pageSlug}`
- Renders `compiled_html` in a prose container

---

## 4. Consumer Frontend

### 4.1 Component Extraction

Extract inline nav markup from `+layout.svelte` into dedicated components.

All components use **Lucide icons** via a mapping utility (see §4.2).

#### `lib/components/Header.svelte`
**Props**: `masjid`, `navItems: NavItem[]`, `theme`, `pathname: string`
- Desktop-only (`hidden lg:flex`)
- Left: masjid name + logo/rosette → links to `/{slug}` (moved from current layout, same markup)
- Right: nav items row, right-aligned
  - Highlighted item: accent pill style (`bg-accent/15 text-accent rounded-full px-3 py-1.5`)
  - Regular items: muted color, `px-3 py-2 rounded-lg`
  - Icons: 18px Lucide icon, `stroke: currentColor`
- Overflow: If items > 5, last visible slot becomes a hamburger button that toggles a dropdown (click-outside-close). Dropdown shows overflow items.

#### `lib/components/MobileTopBar.svelte`
**Props**: `masjid`, `navItems: NavItem[]`, `theme`, `pathname: string`, `onToggleDrawer: () => void`
- Mobile-only (`lg:hidden`)
- Row: masjid name (truncated, → home) + highlighted item pill + hamburger button
- Hamburger button calls `onToggleDrawer()`

#### `lib/components/MobileBottomNav.svelte`
**Props**: `navItems: NavItem[]`, `pathname: string`, `masjidSlug: string`
- Mobile-only (`fixed bottom-0 lg:hidden`)
- Shows items where `show_on_mobile_bottom === true`, maximum 5
- Same icon + label style as current bottom nav

#### `lib/components/NavDrawer.svelte`
**Props**: `navItems: NavItem[]`, `pathname: string`, `masjidSlug: string`, `isOpen: boolean`, `onClose: () => void`
- Full-height slide-out from right edge with semi-transparent backdrop
- Lists ALL nav items (including bottom-pinned ones, for discoverability)
- Close button (X) in top-right
- Active item highlighted

### 4.2 Icon Utility

Create `apps/consumer/src/lib/icon-map.ts`:

```typescript
import { default as Clock } from 'lucide-svelte/icons/clock';
import { default as Newspaper } from 'lucide-svelte/icons/newspaper';
import { default as Info } from 'lucide-svelte/icons/info';
import { default as GraduationCap } from 'lucide-svelte/icons/graduation-cap';
import { default as Heart } from 'lucide-svelte/icons/heart';
import { default as Users } from 'lucide-svelte/icons/users';
import { default as Megaphone } from 'lucide-svelte/icons/megaphone';
import { default as ExternalLink } from 'lucide-svelte/icons/external-link';
import { default as FileText } from 'lucide-svelte/icons/file-text';
import { default as Menu } from 'lucide-svelte/icons/menu';
import { default as X } from 'lucide-svelte/icons/x';

import type { ComponentType } from 'svelte';

const ICON_MAP: Record<string, ComponentType> = {
  Clock, Newspaper, Info, GraduationCap, Heart, Users, Megaphone, ExternalLink, FileText, Menu, X,
};

const DEFAULTS: Record<string, string> = {
  route: 'FileText',
  page: 'FileText',
  link: 'ExternalLink',
};

export function getIconComponent(icon: string | null | undefined, kind: string): ComponentType {
  if (icon && ICON_MAP[icon]) return ICON_MAP[icon];
  const fallback = DEFAULTS[kind] ?? 'FileText';
  return ICON_MAP[fallback];
}
```

### 4.3 Layout Changes

`+layout.svelte` changes:
- Remove hardcoded `navItems` array
- Add `let navItems = $derived($page.data.nav_items ?? [])`
- Replace inline nav with `<Header>`, `<MobileTopBar>`, `<MobileBottomNav>`, `<NavDrawer>`
- Maintain `drawerOpen` state
- Embed mode: hide all nav as before

`+layout.ts` changes:
- Include `nav_items` in the returned data

### 4.4 Overflow Behavior (Desktop)

```typescript
const MAX_VISIBLE_DESKTOP = 5;
const visibleItems = navItems.filter(i => i.show_on_desktop_header);
const hasOverflow = visibleItems.length > MAX_VISIBLE_DESKTOP;
const shownItems = hasOverflow ? visibleItems.slice(0, MAX_VISIBLE_DESKTOP - 1) : visibleItems;
const overflowItems = hasOverflow ? visibleItems.slice(MAX_VISIBLE_DESKTOP - 1) : [];
```

The last slot in `shownItems` is a hamburger button when overflow exists. Clicking it reveals a dropdown with `overflowItems`.

### 4.5 Mobile Bottom Bar (Max 5)

```typescript
const bottomItems = navItems
  .filter(i => i.show_on_mobile_bottom)
  .slice(0, 5);
```

---

## 5. Admin Frontend

### 5.1 New Route

`apps/admin/src/routes/admin/[slug]/settings/navigation/+page.svelte`

### 5.2 Update AdminShell

Add to `AdminShell.svelte` nav items array, between Posts and Domain:

```typescript
{ href: `/admin/${masjidSlug}/settings/navigation`, label: 'Navigation', icon: Navigation },
```

Import `Navigation` from `lucide-svelte`.

### 5.3 Page Features

1. **List view** — items displayed in sort order with up/down reorder buttons
2. **Add buttons**:
   - "Add Built-in Route" — dropdown of available routes not yet in nav
   - "Add Custom Page" — opens a modal to create a page (title, slug, markdown), then adds it to nav
   - "Add External Link" — inline fields for URL + label
3. **Per-item controls:**
   - Toggle `show_on_desktop_header`
   - Toggle `show_on_mobile_bottom`
   - Toggle `is_highlighted` (radio-button behavior — selecting one clears others)
   - Edit label (inline text input)
   - Delete button (with confirmation)
4. **Preview strip** — a simplified visual of how the nav will look on desktop and mobile
5. **Reset to defaults** button (with confirmation dialog)

### 5.4 Custom Pages Management

The "Add Custom Page" flow creates the page via the masjid_pages CRUD endpoints and adds the nav item in one step. A separate tab or section within the page lists existing custom pages for editing/deleting.

---

## 6. Schemas (packages/schemas)

### 6.1 New File: `packages/schemas/src/nav.ts`

```typescript
import { z } from 'zod';

export const NavItemKind = z.enum(['route', 'page', 'link']);
export type NavItemKind = z.infer<typeof NavItemKind>;

export const RouteSegment = z.enum([
  'prayer', 'news', 'info', 'maktab', 'donate', 'jumuah', 'announcements',
]);
export type RouteSegment = z.infer<typeof RouteSegment>;

export const IconName = z.enum([
  'Clock', 'Newspaper', 'Info', 'GraduationCap', 'Heart',
  'Users', 'Megaphone', 'ExternalLink', 'FileText',
]);
export type IconName = z.infer<typeof IconName>;

export const CreateNavItemSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('route'),
    route_segment: RouteSegment,
    label: z.string().min(1).max(30),
    icon: IconName.optional(),
    is_highlighted: z.boolean().default(false),
    show_on_desktop_header: z.boolean().default(true),
    show_on_mobile_bottom: z.boolean().default(true),
  }),
  z.object({
    kind: z.literal('page'),
    page_slug: z.string().min(1).max(50),
    label: z.string().min(1).max(30),
    icon: IconName.optional(),
    is_highlighted: z.boolean().default(false),
    show_on_desktop_header: z.boolean().default(true),
    show_on_mobile_bottom: z.boolean().default(true),
  }),
  z.object({
    kind: z.literal('link'),
    external_url: z.string().url(),
    label: z.string().min(1).max(30),
    icon: IconName.optional(),
    is_highlighted: z.boolean().default(false),
    show_on_desktop_header: z.boolean().default(true),
    show_on_mobile_bottom: z.boolean().default(true),
  }),
]);

export type CreateNavItem = z.infer<typeof CreateNavItemSchema>;

export const UpdateNavItemSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('route'),
    route_segment: RouteSegment.optional(),
    label: z.string().min(1).max(30).optional(),
    icon: IconName.optional().nullable(),
    is_highlighted: z.boolean().optional(),
    show_on_desktop_header: z.boolean().optional(),
    show_on_mobile_bottom: z.boolean().optional(),
  }),
  z.object({
    kind: z.literal('page'),
    page_slug: z.string().min(1).max(50).optional(),
    label: z.string().min(1).max(30).optional(),
    icon: IconName.optional().nullable(),
    is_highlighted: z.boolean().optional(),
    show_on_desktop_header: z.boolean().optional(),
    show_on_mobile_bottom: z.boolean().optional(),
  }),
  z.object({
    kind: z.literal('link'),
    external_url: z.string().url().optional(),
    label: z.string().min(1).max(30).optional(),
    icon: IconName.optional().nullable(),
    is_highlighted: z.boolean().optional(),
    show_on_desktop_header: z.boolean().optional(),
    show_on_mobile_bottom: z.boolean().optional(),
  }),
]);

export const ReorderNavSchema = z.object({
  item_ids: z.array(z.string()),
});

export const NavItemResponseSchema = z.object({
  id: z.string(),
  masjid_id: z.string(),
  sort_order: z.number().int(),
  kind: NavItemKind,
  route_segment: z.string().optional().nullable(),
  page_slug: z.string().optional().nullable(),
  external_url: z.string().optional().nullable(),
  label: z.string(),
  icon: z.string().optional().nullable(),
  is_highlighted: z.boolean(),
  show_on_desktop_header: z.boolean(),
  show_on_mobile_bottom: z.boolean(),
  created_at: z.string(),
});

export const CreatePageSchema = z.object({
  slug: z.string().min(1).max(50).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  title: z.string().min(1).max(200),
  raw_markdown: z.string(),
});

export const UpdatePageSchema = CreatePageSchema.partial();

export const PageResponseSchema = z.object({
  id: z.string(),
  masjid_id: z.string(),
  slug: z.string(),
  title: z.string(),
  compiled_html: z.string().nullable(),
  raw_markdown: z.string(),
  last_updated: z.string().nullable(),
});
```

### 6.2 Update `packages/schemas/src/index.ts`

Export all nav schemas. Add `nav` to the package exports if using subpath exports.

---

## 7. Files Changed (Summary)

| File | Action |
|---|---|
| `schema.sql` | Add `nav_items` table |
| `apps/api/src/lib/server/db/schema.ts` | Add `navItems` Drizzle table |
| `apps/api/src/lib/server/db/index.ts` | Add `ensureTables` for `nav_items` |
| `packages/schemas/src/nav.ts` | **New** — Zod schemas |
| `packages/schemas/src/index.ts` | Export nav schemas |
| `apps/api/src/routes/api/v1/admin/masjids/[id]/nav/+server.ts` | **New** — admin nav CRUD (GET list, POST create) |
| `apps/api/src/routes/api/v1/admin/masjids/[id]/nav/[itemId]/+server.ts` | **New** — PUT update, DELETE |
| `apps/api/src/routes/api/v1/admin/masjids/[id]/nav/reorder/+server.ts` | **New** — PUT reorder |
| `apps/api/src/routes/api/v1/admin/masjids/[id]/pages/+server.ts` | **New** — admin pages CRUD |
| `apps/api/src/routes/api/v1/admin/masjids/[id]/pages/[pageSlug]/+server.ts` | **New** |
| `apps/api/src/routes/api/v1/masjids/[slug]/+server.ts` | Add `nav_items` to response |
| `apps/api/src/routes/api/v1/masjids/[slug]/nav/+server.ts` | **New** — public nav endpoint |
| `apps/api/src/routes/api/v1/masjids/[slug]/pages/[pageSlug]/+server.ts` | **New** — public page view |
| `apps/consumer/src/lib/api.ts` | Add `nav_items` to `PagePayload` |
| `apps/consumer/src/lib/icon-map.ts` | **New** — Lucide icon lookup |
| `apps/consumer/src/lib/components/Header.svelte` | **New** |
| `apps/consumer/src/lib/components/MobileTopBar.svelte` | **New** |
| `apps/consumer/src/lib/components/MobileBottomNav.svelte` | **New** |
| `apps/consumer/src/lib/components/NavDrawer.svelte` | **New** |
| `apps/consumer/src/routes/[masjid_slug]/+layout.svelte` | Replace inline nav with components |
| `apps/consumer/src/routes/[masjid_slug]/+layout.ts` | Include `nav_items` in data |
| `apps/consumer/src/routes/[masjid_slug]/pages/[page_slug]/+page.svelte` | **New** |
| `apps/consumer/src/routes/[masjid_slug]/pages/[page_slug]/+page.ts` | **New** |
| `apps/admin/src/lib/components/AdminShell.svelte` | Add Navigation link |
| `apps/admin/src/routes/admin/[slug]/settings/navigation/+page.svelte` | **New** |
| `tooling/seed.ts` | Seed default nav items |

---

## 8. Design Decisions

| Decision | Answer |
|---|---|
| Data storage | Dedicated `nav_items` table (not JSON column) |
| Built-in routes | `prayer`, `news`, `info`, `maktab`, `donate`, `jumuah`, `announcements` (7 routes). Home is implicit via name click |
| Custom content | Both markdown pages (`masjid_pages` table) and external URLs |
| Mobile bottom bar | Admin toggles `show_on_mobile_bottom` per item. Default: first 4 auto-pinned, max 5 displayed |
| Highlight | Only one item highlighted (radio-button behavior). Default: Times |
| Icons | Lucide icon names (string mapping to lucide-svelte components) |
| Desktop overflow | Max 5 visible items, 6th+ → hamburger dropdown |
| Hamburger on mobile | Slide-out drawer from right edge, lists all items |

---

## 9. Test Requirements

### API Tests (vitest, node)
- Admin CRUD for nav_items: create, update, delete, reorder
- Validation: invalid kind, missing required fields, duplicate highlighted
- Admin CRUD for masjid_pages
- Public nav endpoint returns correct order
- Public page endpoint returns compiled HTML

### Consumer Tests (vitest, jsdom)
- Header renders name + nav items
- Highlighted item gets pill style
- Overflow hamburger appears with 6+ items
- Mobile top bar renders name + highlighted pill + hamburger
- Mobile bottom nav shows max 5 items
- NavDrawer lists all items
- Custom page route renders compiled HTML
- Embed mode hides all nav

### Admin Tests (vitest, jsdom)
- Navigation page loads and displays items
- Add built-in route, custom page, external link
- Reorder via buttons
- Highlight toggle enforces single selection
- Delete with confirmation

### E2E Tests (Playwright)
- Log in as admin, navigate to Navigation settings
- Add a custom link, verify it appears on consumer page
- Reorder items, verify new order
- Mobile bottom bar reflects admin settings