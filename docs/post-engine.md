# Post Engine — Implementation Plan

**Status**: Implemented (shipped 2026-08-09)
**Created**: 2026-08-05
**Updated**: 2026-08-13 (merged `posts` + `masjid_pages` into single `content` table)

> **This feature is fully implemented**: `content` table in D1 (unified `posts` + `masjid_pages` with a `content_type` discriminator: `'post'` or `'page'`), admin CRUD + homepage/info pin endpoints for posts, consumer `/news` tabbed page + `/posts/[post_slug]` detail page + `/pages/[page_slug]` detail page, 6 agent tools (`content_list` through `content_pin_info`), admin settings page, and config snapshot inclusion. The custom page system was previously the `masjid_pages` table — now unified into `content` with `content_type='page'`.

## Overview

Adds a `content` table — a unified content type for the platform. Combines what were previously two separate tables: `posts` (rich, permanent informational posts distinct from time-sensitive announcements) and `masjid_pages` (custom markdown pages). Both content types now live in one table with a `content_type` discriminator (`'post'` or `'page'`). Posts have their own News page, individual detail pages, and can be independently pinned to the homepage or Info page. Custom pages are rendered at `/{slug}/pages/{page_slug}`.

## Design Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Data model | Unified `content` table with `content_type` discriminator (`'post'` / `'page'`) | Clean separation from announcements; posts and pages share the same schema with minor field differences |
| Navigation | `/news` tabs page (Posts + Announcements) | Single destination for all content; admin-chosen preference |
| Post detail URL | `/{slug}/posts/{post-slug}` | Clean, distinct from announcements |
| Pinning | Exactly one homepage-pinned post AND one info-pinned post (enforced server-side) | Same pattern as announcement pinning |
| Ordering | `created_at` DESC | Simplest, most expected for a news feed |
| Status | `is_hidden` boolean (default `false`) | Simpler than draft/published/archived |
| Delete | Hard delete | Admin-chosen preference |
| Images | URLs in markdown only (no upload system yet) | Simpler initial implementation |
| Announcements | No changes to the existing system | Separate concerns |
| TV | Posts are consumer-only | Informational content doesn't belong on the prayer-hall display |
| Snapshots | Posts included in config snapshots + rollback | Consistency with announcements |
| Announcement length heuristic | Admin UI + Agent tool warnings when announcement content is lengthy | Helps admins decide whether content belongs as a post |

### What does NOT change

- Announcements: DB table, API, admin page, agent tools, TV display, consumer page at `/announcements` — zero changes
- Custom pages: now live in the `content` table (filtered by `content_type='page'`) alongside posts (filtered by `content_type='post'`) — previously separate `masjid_pages` table
- TV display: no post or page content surfaces on TV
- Service worker, deploy pipeline

---

## Phase 1 — Database + Shared Schemas

### `content` table

Posts and custom pages are now unified in a single `content` table with a `content_type` discriminator (`'post'` or `'page'`). Appended to all three locations (D1 `ALTER TABLE ADD COLUMN` requires appending):

1. **`schema.sql`** — after existing tables
2. **`apps/api/src/lib/server/db/schema.ts`** — Drizzle schema
3. **`apps/api/src/lib/server/db/index.ts`** — `ensureTables()`

```sql
CREATE TABLE content (
    id TEXT PRIMARY KEY,
    masjid_id TEXT NOT NULL REFERENCES masjids(id) ON DELETE CASCADE,
    content_type TEXT NOT NULL CHECK(content_type IN ('post', 'page')),
    slug TEXT NOT NULL,
    title TEXT NOT NULL,
    content_markdown TEXT NOT NULL,
    compiled_html TEXT,
    -- post-specific fields (NULL for pages)
    show_on_homepage INTEGER NOT NULL DEFAULT 0,
    show_on_info INTEGER NOT NULL DEFAULT 0,
    is_hidden INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(masjid_id, slug)
);
CREATE INDEX idx_content_masjid ON content(masjid_id, content_type, created_at);
CREATE INDEX idx_content_homepage ON content(masjid_id, show_on_homepage) WHERE show_on_homepage = 1;
CREATE INDEX idx_content_info ON content(masjid_id, show_on_info) WHERE show_on_info = 1;
```

### Shared Zod schemas (`packages/schemas/src/content.ts`)

```typescript
// CreateContentSchema: content_type ('post' | 'page'), title (1-300 chars),
//   content_markdown (min 1),
//   show_on_homepage (default false, post only), show_on_info (default false, post only),
//   is_hidden (default false)
// UpdateContentSchema: all optional
// ContentSchema: full read shape (id, masjid_id, content_type, slug, title,
//   content_markdown, compiled_html, show_on_homepage, show_on_info,
//   is_hidden, created_at, updated_at)
```

Export from `packages/schemas/src/index.ts`.

---

## Phase 2 — API Endpoints

### Markdown compiler

Reuse the existing `compileMarkdown()` function from announcement routes (headings, bold, italic, links, `<hr>`, auto-paragraphs). Extract to a shared utility in `apps/api/src/lib/server/markdown.ts` so both announcements and content use it.

### Public endpoints

| Method | Route | Description |
|---|---|---|
| `GET` | `/api/v1/masjids/{slug}/content` | List non-hidden content, `created_at DESC`; filter by `content_type` via query param |
| `GET` | `/api/v1/masjids/{slug}/content/{item_slug}` | Single content item detail (non-hidden only) |
| `GET` | `/api/v1/masjids/{slug}` | **Add** `homepage_post` + `info_post` to payload |

**File structure:**
```
apps/api/src/routes/api/v1/masjids/[slug]/content/+server.ts
apps/api/src/routes/api/v1/masjids/[slug]/content/[item_slug]/+server.ts
```

**Page payload additions** (in `/[slug]/+server.ts`):
```typescript
homepage_post: { title, slug, compiled_html, created_at } | null
info_post: { title, slug, compiled_html, created_at } | null
```

Same pattern as `pinned_announcement`:
```sql
SELECT ... FROM content
WHERE masjid_id = X AND content_type = 'post' AND show_on_homepage = TRUE
  AND is_hidden = FALSE
LIMIT 1
```

### Admin endpoints

All require JWT auth + masjid ownership check.

| Method | Route | Description |
|---|---|---|
| `GET` | `/api/v1/admin/masjids/{id}/content` | All content (hidden included); filter by `content_type` |
| `POST` | `/api/v1/admin/masjids/{id}/content` | Create (slugify, compile, enforce pin exclusivity for posts) |
| `PUT` | `/api/v1/admin/masjids/{id}/content/{slug}` | Update (partial, recompile if content changed) |
| `DELETE` | `/api/v1/admin/masjids/{id}/content/{slug}` | Hard delete |
| `PUT` | `/api/v1/admin/masjids/{id}/content/{slug}/homepage` | Toggle homepage pin (unpins previous; post only) |
| `PUT` | `/api/v1/admin/masjids/{id}/content/{slug}/info` | Toggle info pin (unpins previous; post only) |

**File structure:**
```
apps/api/src/routes/api/v1/admin/masjids/[id]/content/+server.ts
apps/api/src/routes/api/v1/admin/masjids/[id]/content/[slug]/+server.ts
apps/api/src/routes/api/v1/admin/masjids/[id]/content/[slug]/homepage/+server.ts
apps/api/src/routes/api/v1/admin/masjids/[id]/content/[slug]/info/+server.ts
```

**Pin enforcement:** When toggling `show_on_homepage` to true:
1. `UPDATE content SET show_on_homepage = 0 WHERE masjid_id = X AND content_type = 'post' AND show_on_homepage = 1`
2. `UPDATE content SET show_on_homepage = 1 WHERE masjid_id = X AND slug = target`

Same pattern for `show_on_info`. Also enforced on POST if either flag is true.

**Cache invalidation:** Every CUD operation calls `invalidatePageCache()`.

---

## Phase 3 — Consumer Frontend

### New routes

**`/[slug]/news/+page.svelte`** — Tabs page (Posts default active):
- Two tab buttons: Posts | Announcements
- Posts tab: `fetchContent({ content_type: 'post' })` → cards with title, date, compiled_html excerpt, link to `/posts/{slug}`
- Announcements tab: reuses existing `fetchAnnouncements()` + `AnnouncementCard` components
- Loading, empty ("No posts yet"), error states

**`/[slug]/posts/[post_slug]/+page.svelte`** — Detail page:
- Title, formatted date, `{@html compiled_html}` body
- `<svelte:head>` title + meta
- Back link to `/news`
- 404 state for missing/hidden posts

**`/[slug]/posts/[post_slug]/+page.ts`** — Load function:
- Fetch `GET /api/v1/masjids/{slug}/content/{post_slug}` (uses `event.fetch` for SSR if applicable)
- Return content data or throw 404

**`/[slug]/pages/[page_slug]/+page.svelte`** — Custom page route:
- Works the same as posts but uses `content_type='page'`
- No pin/hidden controls needed

### Modified files

**`apps/consumer/src/lib/api.ts`:**
- Add `Content` interface (with `content_type` field)
- Add `homepage_post` + `info_post` to `PagePayload` interface
- Add `fetchContent(params)` function (accepts `content_type` filter)
- Add `fetchContentItem(slug)` function

```
apps/consumer/src/routes/[masjid_slug]/news/+page.svelte
apps/consumer/src/routes/[masjid_slug]/posts/[post_slug]/+page.svelte
apps/consumer/src/routes/[masjid_slug]/posts/[post_slug]/+page.ts
apps/consumer/src/routes/[masjid_slug]/pages/[page_slug]/+page.svelte
apps/consumer/src/routes/[masjid_slug]/pages/[page_slug]/+page.ts
```

**`apps/consumer/src/routes/[masjid_slug]/+layout.svelte`:**
- Change nav segment: `'announcements'` → `'news'`
- `isActive('news')` matches both `/news` and `/posts/` prefix
- Old `/announcements` route stays intact but unlinked from nav

**`apps/consumer/src/routes/[masjid_slug]/+layout.ts`:**
- Add `homepage_post: payload.homepage_post` to load data
- Add `info_post: payload.info_post` to load data

**`apps/consumer/src/routes/[masjid_slug]/+page.svelte` (homepage):**
- After pinned announcement section: `homepage_post` card
- Same card style (accent left border, title, compiled_html)
- Only renders if `homepage_post` exists

**`apps/consumer/src/routes/[masjid_slug]/info/+page.svelte`:**
- After social links section: `info_post` card
- Glass-card style, title, compiled_html
- Only renders if `info_post` exists

---

## Phase 4 — Admin Frontend

### New route

**`admin/[slug]/settings/content/+page.svelte`:**
- Filter tabs: Posts / Pages / All / Visible / Hidden
- List: title, content_type badge, created date, hidden badge, homepage-pin badge, info-pin badge
- Create/edit inline form: content_type selector, title, slug, markdown textarea, homepage toggle (post only), info toggle (post only), hidden toggle
- Delete: confirmation dialog → hard delete
- Pin buttons per row (separate Pin/PinOff for homepage + info; post rows only)
- Uses `svelte-sonner` toasts, `lucide-svelte` icons, `SkeletonForm`, `ConfirmDialog`
- Newspaper icon (or BookOpen) from lucide

**`apps/admin/src/lib/api.ts`**: Add methods:
- `getContent(masjidId, filters?)` → `GET /admin/.../content`
- `createContent(masjidId, body)` → `POST /admin/.../content`
- `updateContent(masjidId, slug, body)` → `PUT /admin/.../content/{slug}`
- `deleteContent(masjidId, slug)` → `DELETE /admin/.../content/{slug}`
- `pinContentHomepage(masjidId, slug)` → `PUT .../content/{slug}/homepage`
- `pinContentInfo(masjidId, slug)` → `PUT .../content/{slug}/info`

### Modified files

**`apps/admin/src/lib/components/AdminShell.svelte`:**
- Add "Content" nav item between Announcements and Domain:
  ```js
  { href: `/admin/${masjidSlug}/settings/content`, label: 'Content', icon: Newspaper },
  ```

**`apps/admin/src/routes/admin/[slug]/+page.svelte` (dashboard):**
- Add content count to stats cards

### Announcement length heuristic (admin UI)

In the announcements settings page, when the title + content_markdown exceeds ~300 characters, show a subtle info banner:

> "This looks lengthy — consider creating a Post instead. Posts support rich, permanent content."

Non-blocking, informational only. Implemented as a `<div>` with an info icon, yellow/amber tone, that appears conditionally.

---

## Phase 5 — Agent/Bot (`@masjid/agent`)

### New domain: `CONTENT`

6 tools (following the exact same patterns as announcements tools):

| Tool | Method | API endpoint |
|---|---|---|
| `content_list` | GET | `/admin/.../content` |
| `content_create` | POST | `/admin/.../content` |
| `content_update` | PUT | `/admin/.../content/{slug}` |
| `content_delete` | DELETE | `/admin/.../content/{slug}` |
| `content_pin_homepage` | PUT | `.../content/{slug}/homepage` |
| `content_pin_info` | PUT | `.../content/{slug}/info` |

### Files to modify

**`packages/agent/src/tools.ts`:**
- Add 6 CONTENT tool definitions after the announcements tools (before `timetable_preview`)
- Each tool: name, description, parameters (Zod-style), handler with `describeMutation` + `storeMutation`
- `content_type` parameter distinguishes posts ('post') from pages ('page')

**`packages/agent/src/prompt.ts`:**
- Add CONTENT domain guide + examples in the system prompt
- Example: "User: 'Create a post about our food pantry, pin it to the info page' → `content_create({content_type:"post", title:"Food Pantry", content_markdown:"...", show_on_info:true})`"

**`packages/agent/src/api-client.ts`:**
- Add 6 content API functions: `getContent`, `createContent`, `updateContent`, `deleteContent`, `pinContentHomepage`, `pinContentInfo`

**`packages/agent/src/format.ts`:**
- Add CONTENT domain diff formatting for WhatsApp diff receipts

**`workers/whatsapp/src/agent/prompt.ts`:**
- Wire up new CONTENT domain context (if needed)

### Config snapshots / rollback

Content is included in config snapshots using the same pattern as announcements. In `rollbackRestore()`:
- Delete all content for the masjid
- Re-insert from snapshot data

### Announcement length heuristic (agent)

When `announcements_create` or `announcements_update` is called and content_markdown exceeds ~500 characters, the tool response includes a warning in the `mutationSummary`:

> "Note: This announcement is quite long (X characters). A Post might be better suited for detailed, permanent content."

This is a soft advisory — does not block the operation.

---

## Phase 6 — Tests

### New tests

| Suite | Tests | Description |
|---|---|---|
| API (unit) | ~15 | Public content (list, single, page payload pins), admin content (CRUD, pin enforcement, hidden filter, content_type filter) |
| Consumer | ~12 | `/news` page (tabs, posts list, announcements list, empty/loading/error states), `/posts/{slug}` (detail, 404), `/pages/{slug}` (custom page), homepage pin card, info pin card |
| Admin | ~8 | Content settings page (CRUD, pins, hidden, filters, content_type tabs, delete confirmation) |
| Agent | ~7 | 6 content tools + prompt/format |

### Existing tests to update

| Suite | Changes |
|---|---|
| Consumer | Nav segment `announcements` → `news`, page payload now includes `homepage_post` + `info_post` |
| Admin | Sidebar nav includes Content, dashboard content count |
| E2E | Any tests that navigate to `/announcements` or check nav labels |

---

## File Manifest

### New files (~15)

```
packages/schemas/src/content.ts                                    # Shared Zod schemas
apps/api/src/lib/server/markdown.ts                             # Shared markdown compiler
apps/api/src/routes/api/v1/masjids/[slug]/content/+server.ts   # Public content list
apps/api/src/routes/api/v1/masjids/[slug]/content/[item_slug]/+server.ts  # Public single content item
apps/api/src/routes/api/v1/admin/masjids/[id]/content/+server.ts  # Admin content CRUD (GET, POST)
apps/api/src/routes/api/v1/admin/masjids/[id]/content/[slug]/+server.ts  # Admin content (PUT, DELETE)
apps/api/src/routes/api/v1/admin/masjids/[id]/content/[slug]/homepage/+server.ts  # Homepage pin toggle
apps/api/src/routes/api/v1/admin/masjids/[id]/content/[slug]/info/+server.ts      # Info pin toggle
apps/consumer/src/routes/[masjid_slug]/news/+page.svelte         # News tabs page
apps/consumer/src/routes/[masjid_slug]/posts/[post_slug]/+page.svelte  # Post detail page
apps/consumer/src/routes/[masjid_slug]/posts/[post_slug]/+page.ts     # Post detail load function
apps/consumer/src/routes/[masjid_slug]/pages/[page_slug]/+page.svelte # Custom page view
apps/consumer/src/routes/[masjid_slug]/pages/[page_slug]/+page.ts    # Custom page load function
apps/admin/src/routes/admin/[slug]/settings/content/+page.svelte   # Admin content settings page
```

### Modified files (~12)

```
schema.sql                                                       # Add content table
apps/api/src/lib/server/db/schema.ts                             # Drizzle content schema
apps/api/src/lib/server/db/index.ts                              # ensureTables() + addColumnIfMissing
packages/schemas/src/index.ts                                    # Export content schemas
apps/api/src/routes/api/v1/masjids/[slug]/+server.ts            # Add homepage_post + info_post to payload
apps/consumer/src/lib/api.ts                                     # Content interfaces + fetch functions
apps/consumer/src/routes/[masjid_slug]/+layout.svelte            # Nav: news segment
apps/consumer/src/routes/[masjid_slug]/+layout.ts                # Load: homepage_post + info_post
apps/consumer/src/routes/[masjid_slug]/+page.svelte              # Homepage: homepage_post card
apps/consumer/src/routes/[masjid_slug]/info/+page.svelte         # Info: info_post card
apps/admin/src/lib/components/AdminShell.svelte                  # Sidebar: Content nav item
apps/admin/src/lib/api.ts                                        # Content API methods
apps/admin/src/routes/admin/[slug]/+page.svelte                  # Dashboard: content count
packages/agent/src/tools.ts                                      # 6 CONTENT tools
packages/agent/src/prompt.ts                                     # CONTENT domain + examples
packages/agent/src/api-client.ts                                 # 6 content API functions
packages/agent/src/format.ts                                     # CONTENT diff rendering
```

---

## Implementation Order

1. **Phase 1**: DB + Markdown utility + Shared schemas (foundation)
2. **Phase 2**: Public + Admin API endpoints (both can be parallel)
3. **Phase 3**: Consumer frontend (pages + nav + pin cards)
4. **Phase 4**: Admin frontend (settings page + sidebar + dashboard)
5. **Phase 5**: Agent tools + prompts + api-client
6. **Phase 6**: Tests — write after all phases to verify the whole stack