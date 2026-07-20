# API Endpoint Reference

Base path: `/api/v1`. Admin endpoints require `Authorization: Bearer <jwt>`. Public endpoints are unauthenticated and served from KV cache.

---

## Auth

| Method | Path | Auth | Body | Response |
|---|---|---|---|---|
| `POST` | `/auth/login` | — | `{ email: string, password: string }` | `{ token: string, admin: { id, email, display_name, masjid_id } }` |
| `GET` | `/auth/me` | JWT | — | `{ admin: { id, email, display_name, masjid_id } }` |

JWT is self-contained (no server-side session store). Contains `{ sub: admin_id, masjid_id }`, signed with a Cloudflare Workers secret.

---

## Masjid Profile

| Method | Path | Auth | Notes |
|---|---|---|---|
| `GET` | `/masjids/:id` | JWT | Returns full profile: masjid row + theme row merged |
| `PUT` | `/masjids/:id` | JWT | Partial update. Accepted fields: `name`, `address_line1`, `address_line2`, `city`, `state`, `postal_code`, `country`, `contact_phone`, `contact_email`, `facebook_url`, `youtube_url`, `instagram_url`, `website_url`, `external_donation_url`, `calculation_method`, `timezone`, and all theme fields (`primary_color`, `accent_color`, `font_heading`, `font_body`, `layout_preset`) |

Admin can only access their own masjid (validated from JWT `masjid_id`).

---

## Prayer Rules

All scoped to the admin's masjid (from JWT).

| Method | Path | Auth | Body / Notes |
|---|---|---|---|
| `GET` | `/masjids/:id/prayer-rules` | JWT | Returns `{ rules: [...] }` ordered by `execution_order ASC` |
| `POST` | `/masjids/:id/prayer-rules` | JWT | `{ prayer_name, rule_name, execution_order, conditions_json, action_json }` |
| `PUT` | `/masjids/:id/prayer-rules/:rule_id` | JWT | Partial update of any rule field |
| `DELETE` | `/masjids/:id/prayer-rules/:rule_id` | JWT | Removes rule, re-numbers execution_order for remaining rules |
| `PUT` | `/masjids/:id/prayer-rules/reorder` | JWT | `{ order: ["id1","id3","id2"] }` — bulk reassigns execution_order sequentially |

### Condition & Action shapes

See [rules-engine.md](rules-engine.md) for the full type reference.

---

## Jumu'ah Sessions

| Method | Path | Auth | Body |
|---|---|---|---|
| `GET` | `/masjids/:id/jumuah-sessions` | JWT | Returns `{ sessions: [...] }` |
| `POST` | `/masjids/:id/jumuah-sessions` | JWT | `{ label, time, khateeb?, language?, location? }` |
| `PUT` | `/masjids/:id/jumuah-sessions/:session_id` | JWT | Partial update |
| `DELETE` | `/masjids/:id/jumuah-sessions/:session_id` | JWT | Hard delete |

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

## Announcements

| Method | Path | Auth | Body / Notes |
|---|---|---|---|
| `GET` | `/masjids/:id/announcements` | JWT | Includes drafts. Returns `{ announcements: [...] }` ordered by `published_at DESC` |
| `POST` | `/masjids/:id/announcements` | JWT | `{ title, content_markdown, status?, is_pinned? }` — auto-generates slug + compiled_html |
| `PUT` | `/masjids/:id/announcements/:slug` | JWT | Partial update. If `content_markdown` changes, recompiles `compiled_html` |
| `DELETE` | `/masjids/:id/announcements/:slug` | JWT | Sets `status = 'archived'` (soft delete) |
| `PUT` | `/masjids/:id/announcements/:slug/pin` | JWT | Toggles `is_pinned`. If setting to `true`, unpins any other pinned announcement first (only one pinned at a time) |

### Announcement object
```json
{
  "id": "abc123",
  "masjid_id": "xyz789",
  "title": "Ramadan Iftar Sponsorship",
  "slug": "ramadan-iftar-sponsorship",
  "content_markdown": "## Join us for Iftar\n\nSign up at the front desk.",
  "compiled_html": "<h2>Join us for Iftar</h2><p>Sign up at the front desk.</p>",
  "is_pinned": true,
  "status": "published",
  "published_at": "2026-07-01T12:00:00Z",
  "expires_at": null,
  "created_at": "2026-07-01T12:00:00Z",
  "updated_at": "2026-07-01T14:30:00Z"
}
```

---

## Custom Domains

| Method | Path | Auth | Body / Notes |
|---|---|---|---|
| `GET` | `/masjids/:id/custom-domain` | JWT | Returns `{ domain: { ... } }` or `{ domain: null }` |
| `POST` | `/masjids/:id/custom-domain` | JWT | `{ domain: "localmasjid.org" }` — provisions CF custom hostname, returns `{ domain: { domain, ssl_status } }` |
| `DELETE` | `/masjids/:id/custom-domain` | JWT | Deletes domain row and calls CF API to remove hostname |

### Domain object
```json
{
  "id": "abc123",
  "masjid_id": "xyz789",
  "domain": "localmasjid.org",
  "cf_hostname_id": "hostname_abc",
  "ssl_status": "active",
  "verified_at": "2026-07-01T12:00:00Z",
  "created_at": "2026-07-01T10:00:00Z"
}
```

---

## Public Endpoints (cached, no auth)

| Method | Path | Description |
|---|---|---|
| `GET` | `/masjids/:slug/prayer-times` | Today's prayer times |
| `GET` | `/masjids/:slug/prayer-times?date=YYYY-MM-DD` | Specific date's times |
| `GET` | `/masjids/:slug/announcements` | Published announcements feed (last 20) |
| `GET` | `/masjids/:slug/announcements/:ann_slug` | Single announcement detail |
| `GET` | `/masjids/:slug` | Full page payload (profile + times + jumuah + pinned announcement + feed) |
| `GET` | `/masjids/:slug/board` | TV display board (today + 7 upcoming days, theme, jumuah, announcements) — see [TV Display docs](./tv-display.md) |

### Prayer times response
```json
{
  "date": "2026-07-19",
  "masjid": { "slug": "masjid-al-noor", "name": "Masjid Al Noor" },
  "calculation_method": "ISNA",
  "times": {
    "fajr":    { "adhaan": "04:23", "iqaamah": "04:43" },
    "sunrise": "05:47",
    "dhuhr":   { "adhaan": "13:15", "iqaamah": "13:25" },
    "asr":     { "adhaan": "17:05", "iqaamah": "17:15" },
    "maghrib": { "adhaan": "20:32", "iqaamah": "20:37" },
    "isha":    { "adhaan": "22:10", "iqaamah": "22:20" }
  }
}
```

### Full page payload response
```json
{
  "masjid": { "slug": "masjid-al-noor", "name": "Masjid Al Noor", "address_line1": "...", "city": "...", ... },
  "theme": { "primary_color": "#1e3a8a", "accent_color": "#10b981", ... },
  "prayer_times": { ... },
  "jumuah": [ { "label": "1st Session", "time": "13:30", "khateeb": "..." } ],
  "pinned_announcement": { "title": "...", "compiled_html": "..." },
  "recent_announcements": [ ... ]
}
```

### Board endpoint response

`GET /masjids/:slug/board` — Returns everything the TV display needs in one request, including 8 days of computed prayer times (today + 7 upcoming). Used by the kiosk/TV frontend.

```json
{
  "masjid": { "slug": "masjid-al-noor", "name": "Masjid Al-Noor", "city": "Chicago", "external_donation_url": "..." },
  "theme": {
    "primary_color": "#1e3a8a", "accent_color": "#10b981",
    "font_heading": "Inter", "font_body": "Roboto",
    "layout_preset": "modern_minimal", "time_format": "24h",
    "label_adhaan": "Adhaan", "label_iqaamah": "Iqaamah",
    "label_jumuah": "Jumu'ah", "label_sunrise": "Sunrise",
    "label_fajr": "Fajr", "label_dhuhr": "Dhuhr",
    "label_asr": "Asr", "label_maghrib": "Maghrib", "label_isha": "Isha"
  },
  "today": {
    "date": "2026-07-20",
    "times": {
      "fajr": { "adhaan": "03:57", "iqaamah": "04:17" },
      "sunrise": "05:33",
      "dhuhr": { "adhaan": "12:57", "iqaamah": "13:10" },
      "asr": { "adhaan": "15:14", "iqaamah": "15:24" },
      "maghrib": { "adhaan": "20:21", "iqaamah": "20:26" },
      "isha": { "adhaan": "21:57", "iqaamah": "22:10" }
    }
  },
  "upcoming_days": [
    {
      "date": "2026-07-21",
      "times": { "fajr": {...}, "sunrise": "05:34", "dhuhr": {...}, ... }
    }
  ],
  "jumuah": [ { "id": "jum-01", "label": "1st Session (English)", "time": "13:30", "khateeb": "Imam Abdullah", "language": "en" } ],
  "pinned_announcement": { "title": "Welcome to Masjid Al-Noor", "compiled_html": "..." },
  "recent_announcements": [ { "id": "...", "title": "...", "compiled_html": "...", "status": "published", "published_at": "2026-07-20T12:00:00.000Z", "expires_at": null } ]
}
```

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