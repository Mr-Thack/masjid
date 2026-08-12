# Post Engine — Implementation Plan

**Status**: Implemented (shipped 2026-08-09)
**Created**: 2026-08-05
**Updated**: 2026-08-11 (status update)

> **This feature is fully implemented**: `posts` table in D1, admin CRUD + homepage/info pin endpoints, consumer `/news` tabbed page + `/posts/[post_slug]` detail page, 6 agent tools (`posts_list` through `posts_pin_info`), admin settings page, and config snapshot inclusion. The `masjid_pages` custom page system is also fully implemented and active (was "dormant" in the original spec).

## Overview

Adds a new `posts` content type to the platform — rich, permanent informational posts distinct from time-sensitive announcements. Posts have their own News page, individual detail pages, and can be independently pinned to the homepage or Info page.

## Design Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Data model | New `posts` table | Clean separation from announcements; different pinning model (two pin targets vs one) |
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
- `masjid_pages` table: now active (pages CRUD API + admin UI + consumer route + agent tools implemented alongside posts)
- TV display: no post content surfaces on TV
- Service worker, deploy pipeline

---

## Phase 1 — Database + Shared Schemas

### `posts` table

Append to all three locations (D1 `ALTER TABLE ADD COLUMN` requires appending):

1. **`schema.sql`** — after existing tables
2. **`apps/api/src/lib/server/db/schema.ts`** — Drizzle schema
3. **`apps/api/src/lib/server/db/index.ts`** — `ensureTables()`

```sql
CREATE TABLE posts (
    id TEXT PRIMARY KEY,
    masjid_id TEXT NOT NULL REFERENCES masjids(id) ON DELETE CASCADE,
    slug TEXT NOT NULL,
    title TEXT NOT NULL,
    content_markdown TEXT NOT NULL,
    compiled_html TEXT,
    show_on_homepage INTEGER NOT NULL DEFAULT 0,
    show_on_info INTEGER NOT NULL DEFAULT 0,
    is_hidden INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(masjid_id, slug)
);
CREATE INDEX idx_posts_masjid ON posts(masjid_id, created_at);
CREATE INDEX idx_posts_homepage ON posts(masjid_id, show_on_homepage) WHERE show_on_homepage = 1;
CREATE INDEX idx_posts_info ON posts(masjid_id, show_on_info) WHERE show_on_info = 1;
```

### Shared Zod schemas (`packages/schemas/src/post.ts`)

```typescript
// CreatePostSchema: title (1-300 chars), content_markdown (min 1),
//   show_on_homepage (default false), show_on_info (default false),
//   is_hidden (default false)
// UpdatePostSchema: all optional
// PostSchema: full read shape (id, masjid_id, slug, title,
//   content_markdown, compiled_html, show_on_homepage, show_on_info,
//   is_hidden, created_at, updated_at)
```

Export from `packages/schemas/src/index.ts`.

---

## Phase 2 — API Endpoints

### Markdown compiler

Reuse the existing `compileMarkdown()` function from announcement routes (headings, bold, italic, links, `<hr>`, auto-paragraphs). Extract to a shared utility in `apps/api/src/lib/server/markdown.ts` so both announcements and posts use it.

### Public endpoints

| Method | Route | Description |
|---|---|---|
| `GET` | `/api/v1/masjids/{slug}/posts` | List non-hidden posts, `created_at DESC` |
| `GET` | `/api/v1/masjids/{slug}/posts/{post_slug}` | Single post detail (non-hidden only) |
| `GET` | `/api/v1/masjids/{slug}` | **Add** `homepage_post` + `info_post` to payload |

**File structure:**
```
apps/api/src/routes/api/v1/masjids/[slug]/posts/+server.ts
apps/api/src/routes/api/v1/masjids/[slug]/posts/[post_slug]/+server.ts
```

**Page payload additions** (in `/[slug]/+server.ts`):
```typescript
homepage_post: { title, slug, compiled_html, created_at } | null
info_post: { title, slug, compiled_html, created_at } | null
```

Same pattern as `pinned_announcement`:
```sql
SELECT ... FROM posts
WHERE masjid_id = X AND show_on_homepage = TRUE AND is_hidden = FALSE
LIMIT 1
```

### Admin endpoints

All require JWT auth + masjid ownership check.

| Method | Route | Description |
|---|---|---|
| `GET` | `/api/v1/admin/masjids/{id}/posts` | All posts (hidden included) |
| `POST` | `/api/v1/admin/masjids/{id}/posts` | Create (slugify, compile, enforce pin exclusivity) |
| `PUT` | `/api/v1/admin/masjids/{id}/posts/{slug}` | Update (partial, recompile if content changed) |
| `DELETE` | `/api/v1/admin/masjids/{id}/posts/{slug}` | Hard delete |
| `PUT` | `/api/v1/admin/masjids/{id}/posts/{slug}/homepage` | Toggle homepage pin (unpins previous) |
| `PUT` | `/api/v1/admin/masjids/{id}/posts/{slug}/info` | Toggle info pin (unpins previous) |

**File structure:**
```
apps/api/src/routes/api/v1/admin/masjids/[id]/posts/+server.ts
apps/api/src/routes/api/v1/admin/masjids/[id]/posts/[slug]/+server.ts
apps/api/src/routes/api/v1/admin/masjids/[id]/posts/[slug]/homepage/+server.ts
apps/api/src/routes/api/v1/admin/masjids/[id]/posts/[slug]/info/+server.ts
```

**Pin enforcement:** When toggling `show_on_homepage` to true:
1. `UPDATE posts SET show_on_homepage = 0 WHERE masjid_id = X AND show_on_homepage = 1`
2. `UPDATE posts SET show_on_homepage = 1 WHERE masjid_id = X AND slug = target`

Same pattern for `show_on_info`. Also enforced on POST if either flag is true.

**Cache invalidation:** Every CUD operation calls `invalidatePageCache()`.

---

## Phase 3 — Consumer Frontend

### New routes

**`/[slug]/news/+page.svelte`** — Tabs page (Posts default active):
- Two tab buttons: Posts | Announcements
- Posts tab: `fetchPosts()` → cards with title, date, compiled_html excerpt, link to `/posts/{slug}`
- Announcements tab: reuses existing `fetchAnnouncements()` + `AnnouncementCard` components
- Loading, empty ("No posts yet"), error states

**`/[slug]/posts/[post_slug]/+page.svelte`** — Detail page:
- Title, formatted date, `{@html compiled_html}` body
- `<svelte:head>` title + meta
- Back link to `/news`
- 404 state for missing/hidden posts

**`/[slug]/posts/[post_slug]/+page.ts`** — Load function:
- Fetch `GET /api/v1/masjids/{slug}/posts/{post_slug}` (uses `event.fetch` for SSR if applicable)
- Return post data or throw 404

### Modified files

**`apps/consumer/src/lib/api.ts`:**
- Add `Post` interface
- Add `homepage_post` + `info_post` to `PagePayload` interface
- Add `fetchPosts(slug)` function
- Add `fetchPost(slug, postSlug)` function

```
apps/consumer/src/routes/[masjid_slug]/news/+page.svelte
apps/consumer/src/routes/[masjid_slug]/posts/[post_slug]/+page.svelte
apps/consumer/src/routes/[masjid_slug]/posts/[post_slug]/+page.ts
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

**`admin/[slug]/settings/posts/+page.svelte`:**
- Filter tabs: All / Visible / Hidden
- List: title, created date, hidden badge, homepage-pin badge, info-pin badge
- Create/edit inline form: title, markdown textarea, homepage toggle, info toggle, hidden toggle
- Delete: confirmation dialog → hard delete
- Pin buttons per row (separate Pin/PinOff for homepage + info)
- Uses `svelte-sonner` toasts, `lucide-svelte` icons, `SkeletonForm`, `ConfirmDialog`
- NewsPaper icon (or BookOpen) from lucide

**`apps/admin/src/lib/api.ts`**: Add 7 methods:
- `getPosts(masjidId)` → `GET /admin/.../posts`
- `createPost(masjidId, body)` → `POST /admin/.../posts`
- `updatePost(masjidId, slug, body)` → `PUT /admin/.../posts/{slug}`
- `deletePost(masjidId, slug)` → `DELETE /admin/.../posts/{slug}`
- `pinPostHomepage(masjidId, slug)` → `PUT .../posts/{slug}/homepage`
- `pinPostInfo(masjidId, slug)` → `PUT .../posts/{slug}/info`

### Modified files

**`apps/admin/src/lib/components/AdminShell.svelte`:**
- Add "Posts" nav item between Announcements and Domain:
  ```js
  { href: `/admin/${masjidSlug}/settings/posts`, label: 'Posts', icon: Newspaper },
  ```

**`apps/admin/src/routes/admin/[slug]/+page.svelte` (dashboard):**
- Add posts count to stats cards

### Announcement length heuristic (admin UI)

In the announcements settings page, when the title + content_markdown exceeds ~300 characters, show a subtle info banner:

> "This looks lengthy — consider creating a Post instead. Posts support rich, permanent content."

Non-blocking, informational only. Implemented as a `<div>` with an info icon, yellow/amber tone, that appears conditionally.

---

## Phase 5 — Agent/Bot (`@masjid/agent`)

### New domain: `POSTS`

6 tools (following the exact same patterns as announcements tools):

| Tool | Method | API endpoint |
|---|---|---|
| `posts_list` | GET | `/admin/.../posts` |
| `posts_create` | POST | `/admin/.../posts` |
| `posts_update` | PUT | `/admin/.../posts/{slug}` |
| `posts_delete` | DELETE | `/admin/.../posts/{slug}` |
| `posts_pin_homepage` | PUT | `.../posts/{slug}/homepage` |
| `posts_pin_info` | PUT | `.../posts/{slug}/info` |

### Files to modify

**`packages/agent/src/tools.ts`:**
- Add 6 POSTS tool definitions after the announcements tools (before `timetable_preview`)
- Each tool: name, description, parameters (Zod-style), handler with `describeMutation` + `storeMutation`

**`packages/agent/src/prompt.ts`:**
- Add POSTS domain guide + examples in the system prompt
- Example: "User: 'Create a post about our food pantry, pin it to the info page' → `posts_create({title:"Food Pantry", content_markdown:"...", show_on_info:true})`"

**`packages/agent/src/api-client.ts`:**
- Add 6 post API functions: `getPosts`, `createPost`, `updatePost`, `deletePost`, `pinPostHomepage`, `pinPostInfo`

**`packages/agent/src/format.ts`:**
- Add POSTS domain diff formatting for WhatsApp diff receipts

**`workers/whatsapp/src/agent/prompt.ts`:**
- Wire up new POSTS domain context (if needed)

### Config snapshots / rollback

Posts are included in config snapshots using the same pattern as announcements. In `rollbackRestore()`:
- Delete all posts for the masjid
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
| API (unit) | ~15 | Public posts (list, single, page payload pins), admin posts (CRUD, pin enforcement, hidden filter) |
| Consumer | ~12 | `/news` page (tabs, posts list, announcements list, empty/loading/error states), `/posts/{slug}` (detail, 404), homepage pin card, info pin card |
| Admin | ~8 | Posts settings page (CRUD, pins, hidden, filters, delete confirmation) |
| Agent | ~7 | 6 posts tools + prompt/format |

### Existing tests to update

| Suite | Changes |
|---|---|
| Consumer | Nav segment `announcements` → `news`, page payload now includes `homepage_post` + `info_post` |
| Admin | Sidebar nav includes Posts, dashboard posts count |
| E2E | Any tests that navigate to `/announcements` or check nav labels |

---

## File Manifest

### New files (~15)

```
packages/schemas/src/post.ts                                    # Shared Zod schemas
apps/api/src/lib/server/markdown.ts                             # Shared markdown compiler
apps/api/src/routes/api/v1/masjids/[slug]/posts/+server.ts     # Public posts list
apps/api/src/routes/api/v1/masjids/[slug]/posts/[post_slug]/+server.ts  # Public single post
apps/api/src/routes/api/v1/admin/masjids/[id]/posts/+server.ts  # Admin posts CRUD (GET, POST)
apps/api/src/routes/api/v1/admin/masjids/[id]/posts/[slug]/+server.ts  # Admin post (PUT, DELETE)
apps/api/src/routes/api/v1/admin/masjids/[id]/posts/[slug]/homepage/+server.ts  # Homepage pin toggle
apps/api/src/routes/api/v1/admin/masjids/[id]/posts/[slug]/info/+server.ts      # Info pin toggle
apps/consumer/src/routes/[masjid_slug]/news/+page.svelte         # News tabs page
apps/consumer/src/routes/[masjid_slug]/posts/[post_slug]/+page.svelte  # Post detail page
apps/consumer/src/routes/[masjid_slug]/posts/[post_slug]/+page.ts     # Post detail load function
apps/admin/src/routes/admin/[slug]/settings/posts/+page.svelte   # Admin posts settings page
```

### Modified files (~12)

```
schema.sql                                                       # Add posts table
apps/api/src/lib/server/db/schema.ts                             # Drizzle posts schema
apps/api/src/lib/server/db/index.ts                              # ensureTables() + addColumnIfMissing
packages/schemas/src/index.ts                                    # Export post schemas
apps/api/src/routes/api/v1/masjids/[slug]/+server.ts            # Add homepage_post + info_post to payload
apps/consumer/src/lib/api.ts                                     # Post interfaces + fetch functions
apps/consumer/src/routes/[masjid_slug]/+layout.svelte            # Nav: news segment
apps/consumer/src/routes/[masjid_slug]/+layout.ts                # Load: homepage_post + info_post
apps/consumer/src/routes/[masjid_slug]/+page.svelte              # Homepage: homepage_post card
apps/consumer/src/routes/[masjid_slug]/info/+page.svelte         # Info: info_post card
apps/admin/src/lib/components/AdminShell.svelte                  # Sidebar: Posts nav item
apps/admin/src/lib/api.ts                                        # Posts API methods
apps/admin/src/routes/admin/[slug]/+page.svelte                  # Dashboard: posts count
packages/agent/src/tools.ts                                      # 6 POSTS tools
packages/agent/src/prompt.ts                                     # POSTS domain + examples
packages/agent/src/api-client.ts                                 # 6 post API functions
packages/agent/src/format.ts                                     # POSTS diff rendering
```

---

## Implementation Order

1. **Phase 1**: DB + Markdown utility + Shared schemas (foundation)
2. **Phase 2**: Public + Admin API endpoints (both can be parallel)
3. **Phase 3**: Consumer frontend (pages + nav + pin cards)
4. **Phase 4**: Admin frontend (settings page + sidebar + dashboard)
5. **Phase 5**: Agent tools + prompts + api-client
6. **Phase 6**: Tests — write after all phases to verify the whole stack