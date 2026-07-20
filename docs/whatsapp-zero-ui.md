# WhatsApp Zero-UI Implementation Plan

**Status:** Stages 1-2 in progress (2026-07-20)

## Architecture overview

```
WhatsApp User ──► Meta WA Business API ──► Cloudflare Worker (workers/whatsapp/)
                                                  │
                                                  ├── Phone → tenant resolution (admins.whatsapp_phone)
                                                  ├── Branch lifecycle management (config_branches)
                                                  ├── LLM agent (future Stage 3 — tool-based mutations)
                                                  ├── Diff receipt presentation
                                                  ├── Confirmation → atomic commit
                                                  └── API proxy → existing SvelteKit admin API ──► D1
```

The worker does NOT duplicate business logic. It authenticates as the admin (JWT) and calls existing API endpoints. All validation stays in the SvelteKit API routes.

---

## Stage 1 (completed): Database Foundation

### New tables

All tables live in D1 alongside the existing 9 tables. Drizzle schema defs in `apps/api/src/lib/server/db/schema.ts`.

#### config_branches
Git-style staging branches. One branch per admin session.
| Column | Type | Notes |
|--------|------|-------|
| id | TEXT PK (UUID) | |
| masjid_id | TEXT FK → masjids | |
| admin_id | TEXT | FK into admins |
| branch_name | TEXT | e.g. 'onboarding', 'ramadan_prep' |
| status | TEXT | 'OPEN', 'MERGED', 'ABANDONED' |
| created_at | TEXT | |
| updated_at | TEXT | |

Index: `idx_branches_state ON config_branches(masjid_id, status)`

#### config_mutations
Granular intent entries accumulated per branch.
| Column | Type | Notes |
|--------|------|-------|
| id | TEXT PK (UUID) | |
| branch_id | TEXT FK → config_branches | CASCADE delete |
| domain | TEXT | 'THEME', 'PROFILE', 'PRAYER_RULES', 'ANNOUNCEMENTS', 'JUMUAH' |
| action_type | TEXT | 'UPSERT', 'DELETE', 'PATCH' |
| target_key | TEXT | e.g. 'theme.primary_color', 'prayer_rule.abc123' |
| payload_json | TEXT | JSON delta |
| sequence_order | INTEGER | Execution order within branch |
| created_at | TEXT | |

Index: `idx_mutations_sequence ON config_mutations(branch_id, sequence_order ASC)`

#### config_snapshots
Point-in-time frozen state after each merge. Enables time-travel rollback.
| Column | Type | Notes |
|--------|------|-------|
| id | TEXT PK (UUID) | |
| masjid_id | TEXT FK → masjids | |
| summary | TEXT | AI-generated description |
| full_state_json | TEXT | Complete serialized state blob |
| created_at | TEXT | |

Index: `idx_snapshots_chronology ON config_snapshots(masjid_id, created_at DESC)`

#### masjid_assets
Multimodal file map for media uploaded via WhatsApp.
| Column | Type | Notes |
|--------|------|-------|
| id | TEXT PK (UUID) | |
| masjid_id | TEXT FK → masjids | |
| associated_domain | TEXT | 'ANNOUNCEMENTS', 'TIMETABLE_PARSER', 'THEME' |
| associated_id | TEXT | Maps to specific domain entry UUID |
| r2_key | TEXT UNIQUE | Internal R2 storage key |
| public_url | TEXT UNIQUE | Public URL for PWA/TV |
| content_type | TEXT | MIME type |
| file_size | INTEGER | Byte count |
| created_at | TEXT | |

Index: `idx_assets_routing ON masjid_assets(masjid_id, associated_domain)`

#### announcement_attachments
Polymorphic join between announcements and assets.
| Column | Type | Notes |
|--------|------|-------|
| id | TEXT PK (UUID) | |
| announcement_id | TEXT FK → announcements | |
| asset_id | TEXT FK → masjid_assets | |
| created_at | TEXT | |

### Schema change to existing tables

**admins table:**
- Added `whatsapp_phone TEXT` column — maps authenticated WhatsApp number to admin. Format: E.164 (e.g. `+15551234567`).

### Zod schemas (packages/schemas/)

New file: `packages/schemas/src/zero-ui.ts`
- `BranchStatusSchema` — `z.enum(['OPEN', 'MERGED', 'ABANDONED'])`
- `MutationDomainSchema` — `z.enum(['THEME', 'PROFILE', 'PRAYER_RULES', 'ANNOUNCEMENTS', 'JUMUAH'])`
- `MutationActionTypeSchema` — `z.enum(['UPSERT', 'DELETE', 'PATCH'])`
- `CreateBranchSchema`, `CreateMutationSchema`, `MutationSchema`, `BranchSchema`, `SnapshotSchema` — full CRUD types
- `WhatsAppWebhookSchema` — Meta webhook payload shape

---

## Stage 2 (in progress): WhatsApp Worker

### Package: `workers/whatsapp/`

Cloudflare Worker handling WhatsApp Business API webhooks.

### Dependencies
- `@masjid/schemas` — Zod types for webhook payloads
- `jose` — JWT signing for API proxy (workers reuse the admin JWT pattern)
- No LLM SDK yet (Stage 3)

### wrangler.toml bindings
| Binding | Type | Purpose |
|---------|------|---------|
| DB | D1 | Session/branch/mutation storage |
| API_URL | var | URL of the SvelteKit API (e.g., `https://api.example.com`) |
| JWT_SECRET | var | For signing admin JWT tokens (same key as API) |
| WHATSAPP_TOKEN | var | Meta WhatsApp Cloud API access token |
| WHATSAPP_PHONE_ID | var | WhatsApp Business phone number ID |
| WHATSAPP_VERIFY_TOKEN | var | Webhook verification token |
| ASSETS | R2 | Media file storage (images, etc.) |

### Route handlers

#### GET `/` — Webhook verification
Meta sends `hub.mode=subscribe&hub.verify_token=...&hub.challenge=...`
→ validate token → return challenge string.

#### POST `/` — Inbound messages
1. Parse webhook body (WhatsApp Business API format via Zod)
2. Skip non-message entries (delivery receipts, read receipts)
3. Extract `from` phone number (E.164)
4. Lookup `admins` by `whatsapp_phone` → resolve masjid_id + admin_id
5. If no match: reply with "This number is not registered." (friendly)
6. Lookup or create OPEN `config_branch` for this admin
7. Route message:
   - `/help` → list available commands
   - `/status` → show current branch state
   - `/cancel` → abandon current branch
   - `/confirm` → trigger merge (future — Stage 3 handles this)
   - Any other text → store as context, echo acknowledgment
8. For media messages: download from Meta URL, stream to R2, record in `masjid_assets`

### Branch lifecycle
- **Creation:** First message from admin after no OPEN branch → create branch with `branch_name = current date`
- **Resume:** If OPEN branch exists → resume (messages are reply context)
- **Abandonment:** Explicit `/cancel` or auto-timeout (2h silence → warning message, +30m silence → ABANDONED)
- **Timeout check:** Poll `updated_at` on each message; no Durable Object alarms for MVP
- **Merge:** Stage 3 — LLM agent commits mutations, creates snapshot, transitions to MERGED

### JWT-based API proxy
The worker needs to call existing admin API endpoints. It does this by:
1. Looking up admin's ID and masjid_id from DB
2. Signing a JWT with `{ sub: admin_id, masjid_id }` using the same `JWT_SECRET` as the API
3. Calling `{API_URL}/api/v1/admin/masjids/{masjid_id}/...` with `Authorization: Bearer <jwt>`
4. The API validates the JWT exactly as it does for browser-based admin requests

This means zero duplication of auth logic, validation, or business rules.

### Reply sending
POST to `https://graph.facebook.com/v18.0/{PHONE_ID}/messages` with:
```json
{
  "messaging_product": "whatsapp",
  "to": "{user_phone}",
  "text": { "body": "{message}" }
}
```
Authenticated via `Authorization: Bearer {WHATSAPP_TOKEN}`.

### Media handling (Stage 2 MVP)
- When a message has `type: "image"` or `type: "document"`, extract the media ID
- Call `GET /{media_id}` on the WhatsApp API to get the download URL
- Stream download → R2 using `{ASSETS}` binding
- Record in `masjid_assets` table
- For MVP: acknowledge receipt, store for future vision LLM processing (Stage 4)

### Security considerations
- WhatsApp verification token must match exactly (prevents unauthorized webhook registration)
- Phone numbers are E.164 format, stored normalized
- JWT signing uses same secret as API — keep this in env vars, never in code
- WhatsApp API token should be scoped to `whatsapp_business_messaging` and `whatsapp_business_media`
- Rate limiting: Meta enforces 80 msgs/sec per phone number — the worker won't exceed this for MVP
- No sensitive data returned to WhatsApp users beyond diff receipts and confirmations

### Error handling
- Meta webhook timeout: 20s — worker must respond quickly
- 5xx from API: present friendly error to user, log internally
- DB query failures: catch, return generic error, never expose schema in replies
- WhatsApp API rate limits: queue/reject gracefully with backoff

### File structure
```
workers/whatsapp/
├── package.json           # @masjid/worker-whatsapp
├── tsconfig.json
├── wrangler.toml
└── src/
    ├── index.ts           # Main worker entry (fetch handler)
    ├── webhook.ts         # Webhook verification + message parsing
    ├── session.ts         # Branch lifecycle (create, resume, abandon, timeout)
    ├── messaging.ts       # WhatsApp Cloud API send/reply helpers
    ├── media.ts           # Media download → R2 streaming
    ├── proxy.ts           # JWT-based API proxy calls
    └── types.ts           # Env bindings, internal types
```

---

## Stage 3 (future): LLM Agent + MCP Tools

### How it works
1. User sends WhatsApp message with intent (e.g., "Make Dhuhr iqaamah 10 min after adhaan, and on Fridays set it to 1:30 PM")
2. Worker constructs system prompt with tenant context + available tools
3. LLM receives message + conversation history → calls appropriate MCP tools
4. Worker executes tool calls via JWT proxy to admin API
5. Worker computes diff receipt from staged mutations
6. Worker sends diff receipt to user via WhatsApp
7. User confirms → worker commits all mutations, creates snapshot, transitions branch to MERGED

### MCP tool definitions
Auto-generated from `packages/schemas/`. Tool naming: `{resource}_{action}`.
See `docs/mcp-integration.md` for the full strategy.

### LLM model
Cloudflare Workers AI (e.g., Llama 3 or similar) running at the edge. No external API dependency.
Alternatively: OpenAI/Anthropic API for better quality (configurable).

---

## Stage 4 (future): Advanced Features

- Vision LLM: parse timetable photos → structured rules
- Dry-run simulation: run staged mutations through prayer engine before commit
- Time-travel rollback: query snapshots, rewrite production rows
- RTL detection: auto-wrap Arabic/Urdu in `dir="rtl"` spans
- Media-to-markdown pipeline: uploaded images → compiled HTML announcements
