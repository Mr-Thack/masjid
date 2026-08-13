# API Endpoint Reference

Base path: `/api/v1`. Admin endpoints require `Authorization: Bearer <jwt>`. Public endpoints are unauthenticated.

---

## Auth

| Method | Path | Auth | Body | Response |
|---|---|---|---|---|
| `POST` | `/auth/login` | — | `{ email, password }` | `{ token, admin: { id, email, display_name, masjid_id } }` |
| `POST` | `/auth/register` | — | `{ email, password, display_name, masjid: { slug, name, latitude, longitude, timezone?, ... } }` | `{ token, admin, masjid }` |
| `GET` | `/auth/me` | JWT | — | `{ admin: { id, email, display_name, masjid_id } }` |

JWT is self-contained (no server-side session store). Contains `{ sub: admin_id, masjid_id }`, signed with a Cloudflare Workers secret.

---

## Debug / Status

| Method | Path | Auth | Notes |
|---|---|---|---|
| `GET` | `/debug` | — | Public debug: DB connectivity, bcrypt test, admin info |
| `GET` | `/status` | — | Public status: worker health, env vars presence, D1 connectivity, build_id |

---

## Admin: Masjid Profile

All scoped to the admin's masjid (from JWT `masjid_id`).

| Method | Path | Auth | Notes |
|---|---|---|---|
| `GET` | `/admin/masjids/:id` | JWT | Returns full profile: masjid row + theme row merged |
| `PUT` | `/admin/masjids/:id` | JWT | Partial update. Fields: `name`, `address_line1`, `address_line2`, `city`, `state`, `postal_code`, `country`, `contact_phone`, `contact_email`, `facebook_url`, `youtube_url`, `instagram_url`, `website_url`, `calculation_method`, `timezone`, `latitude`, `longitude`, `fajr_angle`, `isha_angle`, `asr_madhab`, `high_latitude_rule`, `show_dual_asr`, adjust fields, `about_markdown`, `donation_links`, and all theme fields |
| `PUT` | `/admin/masjids/:id/admin` | JWT | Update own admin password |

---

## Admin: Prayer Config

| Method | Path | Auth | Notes |
|---|---|---|---|
| `GET` | `/admin/masjids/:id/prayer` | JWT | Returns current prayer config (calculation method, angles, offsets, etc.) |
| `PATCH` | `/admin/masjids/:id/prayer` | JWT | Partial update of prayer config |
| `GET` | `/admin/masjids/:id/prayer/hijri-today` | JWT | Returns today's Hijri date |
| `GET` | `/admin/masjids/:id/prayer/health` | JWT | Prayer times health check (validation warnings) |
| `POST` | `/admin/masjids/:id/prayer/dry-run` | JWT | `{ adjustments?, overrides? }` — simulate prayer times without saving |

---

## Admin: Prayer Rules

| Method | Path | Auth | Body / Notes |
|---|---|---|---|
| `GET` | `/admin/masjids/:id/prayer/rules` | JWT | Returns `{ rules: [...] }` ordered by `execution_order ASC` |
| `POST` | `/admin/masjids/:id/prayer/rules` | JWT | `{ prayer_name, rule_name, execution_order, conditions_json, action_json }` |
| `PUT` | `/admin/masjids/:id/prayer/rules/:rule_id` | JWT | Partial update of any rule field |
| `DELETE` | `/admin/masjids/:id/prayer/rules/:rule_id` | JWT | Removes rule, re-numbers execution_order for remaining rules |
| `PUT` | `/admin/masjids/:id/prayer/rules/reorder` | JWT | `{ order: ["id1","id3","id2"] }` — bulk reassigns execution_order sequentially |
| `GET` | `/admin/masjids/:id/prayer/rules/preview` | JWT | Preview the effect of the current rules chain |

### Condition & Action shapes

See [rules-engine.md](rules-engine.md) for the full type reference.

---

## Admin: Jumu'ah Sessions

| Method | Path | Auth | Body |
|---|---|---|---|
| `GET` | `/admin/masjids/:id/jumuah` | JWT | Returns `{ sessions: [...] }` |
| `POST` | `/admin/masjids/:id/jumuah` | JWT | `{ label, time, khateeb?, language?, location? }` |
| `PUT` | `/admin/masjids/:id/jumuah/:session_id` | JWT | Partial update |
| `DELETE` | `/admin/masjids/:id/jumuah/:session_id` | JWT | Hard delete |

### Session object
```json
{
  "id": "abc123",
  "masjid_id": "xyz789",
  "label": "1st Session (English)",
  "time": "13:30",
  "khateeb": "Imam Abdullah",
  "language": "en",
  "location": "Main Hall",
  "is_active": true
}
```

---

## Admin: Announcements

| Method | Path | Auth | Body / Notes |
|---|---|---|---|
| `GET` | `/admin/masjids/:id/announcements` | JWT | Includes drafts. Returns `{ announcements: [...] }` ordered by `published_at DESC` |
| `POST` | `/admin/masjids/:id/announcements` | JWT | `{ title, content_markdown, status?, is_pinned? }` — auto-generates slug + compiled_html |
| `PUT` | `/admin/masjids/:id/announcements/:slug` | JWT | Partial update. If `content_markdown` changes, recompiles `compiled_html` |
| `DELETE` | `/admin/masjids/:id/announcements/:slug` | JWT | Sets `status = 'archived'` (soft delete) |
| `PUT` | `/admin/masjids/:id/announcements/:slug/pin` | JWT | Toggles `is_pinned`. If setting to `true`, unpins any other pinned announcement first (only one pinned at a time) |

---

## Admin: Content (Posts & Pages)

Posts and custom pages are unified in a single `content` table with a `content_type` discriminator (`'post'` or `'page'`).

| Method | Path | Auth | Body / Notes |
|---|---|---|---|
| `GET` | `/admin/masjids/:id/content` | JWT | Returns `{ content: [...] }`. Optional query param `?content_type=post` or `?content_type=page` to filter |
| `POST` | `/admin/masjids/:id/content` | JWT | `{ content_type, title, slug?, content_markdown, show_on_homepage?, show_on_info?, is_hidden? }`. `content_type` must be `'post'` or `'page'` |
| `GET` | `/admin/masjids/:id/content/:slug` | JWT | Single content item detail |
| `PUT` | `/admin/masjids/:id/content/:slug` | JWT | Partial update |
| `DELETE` | `/admin/masjids/:id/content/:slug` | JWT | Hard delete |
| `PUT` | `/admin/masjids/:id/content/:slug/homepage` | JWT | Toggle homepage pin (post only) |
| `PUT` | `/admin/masjids/:id/content/:slug/info` | JWT | Toggle info page pin (post only) |

---

## Admin: Navigation

| Method | Path | Auth | Body / Notes |
|---|---|---|---|
| `GET` | `/admin/masjids/:id/nav` | JWT | Returns `{ nav_items: [...] }` ordered by `sort_order` |
| `POST` | `/admin/masjids/:id/nav` | JWT | `{ kind, label, route?, external_url?, page_slug?, icon?, show_on_desktop_header?, show_on_mobile_bottom?, is_highlighted? }` |
| `PUT` | `/admin/masjids/:id/nav/:itemId` | JWT | Partial update |
| `DELETE` | `/admin/masjids/:id/nav/:itemId` | JWT | Hard delete |
| `PUT` | `/admin/masjids/:id/nav/reorder` | JWT | `{ order: ["id1","id3","id2"] }` |

---

## Admin: Maktab

| Method | Path | Auth | Body / Notes |
|---|---|---|---|
| `GET` | `/admin/masjids/:id/maktab/settings` | JWT | Returns `{ settings: { enrollment_open, active_term_id } }` |
| `PUT` | `/admin/masjids/:id/maktab/settings` | JWT | `{ enrollment_open?, active_term_id? }` |
| `GET` | `/admin/masjids/:id/maktab/terms` | JWT | Returns `{ terms: [...] }` |
| `POST` | `/admin/masjids/:id/maktab/terms` | JWT | `{ name, start_date, end_date, billing_months, price_1_child, price_2_children, price_3_plus_children, description?, enrollment_goal?, registration_fee? }` — creates Square subscription plan |
| `POST` | `/admin/masjids/:id/maktab/terms/:termId/activate` | JWT | Make term active |
| `GET` | `/admin/masjids/:id/maktab/registrations` | JWT | List registrations |
| `POST` | `/admin/masjids/:id/maktab/registrations` | JWT | Create manual (offline-payment) registration |

---

## Admin: Domains

| Method | Path | Auth | Body / Notes |
|---|---|---|---|
| `GET` | `/admin/masjids/:id/domains` | JWT | Returns `{ domains: [...] }` |
| `POST` | `/admin/masjids/:id/domains` | JWT | `{ domain: "localmasjid.org" }` — provisions CF custom hostname |
| `DELETE` | `/admin/masjids/:id/domains/:domain_id` | JWT | Deletes domain row and calls CF API to remove hostname |

---

## Admin: Agent Chat

| Method | Path | Auth | Body / Notes |
|---|---|---|---|
| `POST` | `/admin/masjids/:id/agent/chat` | JWT | `{ message, images?: [...] }` — returns SSE stream with agent response + diff receipt |
| `POST` | `/admin/masjids/:id/agent/confirm` | JWT | Confirms pending config branch → creates snapshot |
| `POST` | `/admin/masjids/:id/agent/cancel` | JWT | Cancels pending config branch |

---

## Admin: Branches & Rollback

| Method | Path | Auth | Body / Notes |
|---|---|---|---|
| `GET` | `/admin/masjids/:id/branches` | JWT | List config branches |
| `POST` | `/admin/masjids/:id/rollback` | JWT | `{ snapshot_id }` — restore configuration from snapshot |

---

## Public Endpoints (no auth)

| Method | Path | Description |
|---|---|---|
| `GET` | `/masjids/:slug` | Full page payload (profile + theme + prayer_times + jumuah + announcements + homepage_post + info_post) |
| `GET` | `/masjids/:slug/board` | TV display board (today + 7 upcoming days, theme, jumuah, announcements) |
| `GET` | `/masjids/:slug/prayer` | Today's prayer times |
| `GET` | `/masjids/:slug/prayer/weekly` | Weekly prayer times |
| `GET` | `/masjids/:slug/jumuah` | Upcoming jumu'ah sessions |
| `GET` | `/masjids/:slug/announcements` | Published announcements feed |
| `GET` | `/masjids/:slug/announcements/:ann_slug` | Single announcement detail |
| `GET` | `/masjids/:slug/content` | Published content feed; optional `?content_type=post` filter |
| `GET` | `/masjids/:slug/content/:item_slug` | Single content item (post or page) detail |
| `GET` | `/masjids/:slug/nav` | Navigation items (ordered, with visibility toggles) |
| `GET` | `/masjids/:slug/maktab` | Active term, prices, open/closed status, Square app/location IDs |
| `POST` | `/masjids/:slug/maktab/enroll` | Create Square customer/card/subscription and register enrollment |
| `POST` | `/masjids/:slug/maktab/verify-code` | Verify promo/discount code |

---

## Error responses

All errors follow this shape:
```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Masjid not found"
  }
}
```

| Code | HTTP Status | Meaning |
|---|---|---|
| `VALIDATION_ERROR` | 400 | Zod schema rejection |
| `UNAUTHORIZED` | 401 | Missing or invalid JWT |
| `FORBIDDEN` | 403 | JWT valid but wrong masjid |
| `NOT_FOUND` | 404 | Resource doesn't exist |
| `CONFLICT` | 409 | Unique constraint violation (slug, domain, etc.) |
| `INTERNAL_ERROR` | 500 | Unexpected failure |