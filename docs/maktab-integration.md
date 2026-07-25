# Maktab Registration Integration Plan

## 1. Goal

Add a per-masjid Maktab program enrollment flow to the current multi-tenant platform, isolated in its own Cloudflare Worker so payment/email failures cannot affect the core prayer-time API.

**Non-goals:**

- Preserving the old `suffah-old` API shape.
- Migrating old Supabase registrations or terms.
- Dynamic program marketing copy (static for now).

## 2. Module: `apps/api/src/lib/server/maktab/`

Maktab enrollment now lives inside the main `@masjid/api` monolith, using the same D1/SQLite database and JWT auth as the rest of the platform.

### Structure

```
apps/api/src/
├── lib/server/maktab/
│   ├── types.ts              # Env + PaymentRefs types
│   ├── square.ts             # Square customer/card/subscription helpers
│   └── email.ts              # Brevo confirmation email
├── lib/server/db/schema.ts   # mkt_terms, mkt_settings, mkt_registrations, mkt_outbox
└── routes/api/v1/
    ├── masjids/[slug]/maktab/+server.ts            # Public info
    ├── masjids/[slug]/maktab/enroll/+server.ts     # Public enrollment
    └── admin/masjids/[id]/maktab/
        ├── settings/+server.ts
        ├── terms/+server.ts
        ├── terms/[termId]/activate/+server.ts
        └── registrations/+server.ts
```

### How it connects

```text
┌─────────────────┐      ┌─────────────────────────────┐
│ @masjid/admin   │──────│ /api/v1/admin/masjids/:id/  │
│ @masjid/consumer│──────│ /api/v1/masjids/:slug/...   │────── D1 / SQLite
└─────────────────┘      │   apps/api/src/routes       │        mkt_* tables
                         └──────────────┬──────────────┘
                                        │
                                        ▼
                                   Square API
```

All Maktab routes share the same JWT middleware (`hooks.server.ts`) and `getDb()` helper as the rest of `@masjid/api`.

## 3. D1 Schema

Replaces the current `mkt_registrations` stub.

```sql
CREATE TABLE mkt_terms (
    id TEXT PRIMARY KEY,
    masjid_id TEXT NOT NULL REFERENCES masjids(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    length_months INTEGER NOT NULL,
    price_cents_1 INTEGER NOT NULL,
    price_cents_2 INTEGER NOT NULL,
    price_cents_3plus INTEGER NOT NULL,
    payment_refs_json TEXT NOT NULL DEFAULT '{}',
        -- Square: { "plan_id": "...", "var_1": "...", "var_2": "...", "var_3plus": "..." }
    is_active BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX idx_mkt_terms_masjid ON mkt_terms(masjid_id);

CREATE TABLE mkt_settings (
    masjid_id TEXT PRIMARY KEY REFERENCES masjids(id) ON DELETE CASCADE,
    active_term_id TEXT REFERENCES mkt_terms(id) ON DELETE SET NULL,
    enrollment_open BOOLEAN NOT NULL DEFAULT FALSE,
    status_message TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE mkt_registrations (
    id TEXT PRIMARY KEY,
    masjid_id TEXT NOT NULL REFERENCES masjids(id) ON DELETE CASCADE,
    term_id TEXT NOT NULL REFERENCES mkt_terms(id),
    status TEXT NOT NULL DEFAULT 'checkout_created',
        -- checkout_created | payment_succeeded | payment_failed | confirmed | cancelled
    payment_provider TEXT NOT NULL, -- 'stripe' | 'square'
    payment_customer_id TEXT,
    payment_subscription_id TEXT,
    payment_session_id TEXT UNIQUE,
    monthly_amount_cents INTEGER NOT NULL,

    father_name TEXT,
    father_phone TEXT,
    father_email TEXT,
    mother_name TEXT,
    mother_phone TEXT,
    mother_email TEXT,

    address_line1 TEXT NOT NULL,
    city TEXT NOT NULL,
    state TEXT NOT NULL DEFAULT 'GA', -- hardcoded for now
    postal_code TEXT NOT NULL,
    country TEXT NOT NULL DEFAULT 'US',

    children_json TEXT NOT NULL, -- [{ name, dob: 'YYYY-MM-DD', sex: 'male'|'female' }]

    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX idx_mkt_registrations_lookup ON mkt_registrations(masjid_id, term_id, status);
CREATE INDEX idx_mkt_registrations_session ON mkt_registrations(payment_session_id);

CREATE TABLE mkt_outbox (
    id TEXT PRIMARY KEY,
    registration_id TEXT NOT NULL REFERENCES mkt_registrations(id) ON DELETE CASCADE,
    type TEXT NOT NULL, -- 'parent_confirmation' | 'admin_notification'
    status TEXT NOT NULL DEFAULT 'pending', -- pending | sent | failed
    attempts INTEGER NOT NULL DEFAULT 0,
    last_error TEXT,
    scheduled_at TEXT DEFAULT (datetime('now')),
    created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX idx_mkt_outbox_poll ON mkt_outbox(status, scheduled_at);
```

The worker is responsible for ensuring these tables exist in D1. In local API dev the tables live in `.masjid/local.db`; in worker dev/tests they live in the bound D1 database.

## 4. Endpoint Contracts

### Public endpoints (all under `/api/v1`)

#### `GET /api/v1/masjids/:slug/maktab`

Returns active term + open status.

```json
{
  "open": true,
  "term": {
    "id": "term_...",
    "name": "AY 2025–2026",
    "length_months": 6,
    "prices": { "1": 10000, "2": 16000, "3plus": 20000 }
  },
  "status_message": null,
  "square_config": {
    "app_id": "sq0id-...",
    "location_id": "L...",
    "environment": "sandbox"
  }
}
```

#### `POST /api/v1/masjids/:slug/maktab/enroll`

The API is configured for **Square only**. The consumer page tokenizes the card with the Square Web Payments SDK and sends the resulting `source_id`.

Request:

```json
{
  "father": { "name": "...", "phone": "+1...", "email": "..." },
  "mother": { "name": "...", "phone": "+1...", "email": "..." },
  "address_line1": "...",
  "city": "...",
  "postal_code": "...",
  "country": "US",
  "children": [
    { "name": "Ahmad", "dob": "2015-03-10", "sex": "male" }
  ],
  "source_id": "cnon:...",
  "card_holder_name": "..."
}
```

Response:

```json
{
  "registration_id": "...",
  "subscription_id": "sq_sub_...",
  "status": "payment_succeeded"
}
```

The registration row is created with `status = 'payment_succeeded'`, a Square customer/card/subscription are created, and the parent confirmation email is sent.

### Admin endpoints (JWT required)

All under `/api/v1/admin/masjids/:id/maktab/*`. They reuse the same Bearer JWT middleware as the rest of `@masjid/api`.

| Method | Path | Body / Notes |
|---|---|---|
| `GET` | `/settings` | Returns `mkt_settings` + active term |
| `PUT` | `/settings` | `{ active_term_id, enrollment_open, status_message }` |
| `GET` | `/terms` | List all terms |
| `POST` | `/terms` | `{ name, length_months, price_cents_1, price_cents_2, price_cents_3plus }`. Creates Square subscription plan and stores IDs. |
| `POST` | `/terms/:termId/activate` | Sets this term active and enrollment open |
| `GET` | `/registrations` | Query params: `term_id`, `status` |

## 5. Failure Handling & Email

1. **Validate request** with Zod.
2. **Payment first**: create Square customer, store card, and create subscription.
   - If this fails → return 4xx/5xx, **no DB write**.
3. **Record payment**: insert `mkt_registrations`.
4. **Send confirmation email** via Brevo directly.
   - If Brevo fails, log but don't fail the enrollment.
5. **Return immediately** to the browser.

`mkt_outbox` is reserved for future retry-able email queue work but is not used today.

**Rollback rule**: if the Square subscription succeeds but the DB write fails, cancel the Square subscription so the family is not charged for an unrecorded enrollment.

## 6. Provider Abstraction (Square only)

Stripe support was removed because account verification could not be completed in time. The API now uses the Square REST API directly.

Env validation:

```ts
if (!env.SQUARE_ACCESS_TOKEN || !env.SQUARE_APP_ID || !env.SQUARE_LOCATION_ID) {
  throw new Error('Square not configured');
}
```

Term creation calls `POST /v2/catalog/object` to create a `SUBSCRIPTION_PLAN` with 3 monthly plan variations, then stores `plan_id` + `var_1/2/3plus`.

Enrollment:

```ts
const customer = await squarePost('/customers', { ... });
const card = await squarePost('/cards', { sourceId: sourceId, card: { cardHolderName, ... } });
const subscription = await squarePost('/subscriptions', {
  locationId: env.SQUARE_LOCATION_ID,
  planVariationId: refs.var_1, // or 2, 3plus
  customerId: customer.id,
  cardId: card.id,
  startDate: new Date().toISOString().slice(0, 10),
});
```

## 7. UI Plan

### Consumer (`apps/consumer`)

New routes under `[masjid_slug]/`:

- `maktab/+page.svelte` — minimal term/pricing card and **Enroll Now** CTA (full marketing landing page is out of scope for now).
- `maktab/enroll/+page.svelte` — enrollment form with Square Web Payments SDK card tokenization.
- Add **Maktab** to the top/bottom nav in `[masjid_slug]/+layout.svelte`.

The form tokenizes the card in the browser, then `POST`s the Square `source_id` to the worker. There is no Stripe Checkout redirect.

### Admin (`apps/admin`)

New routes under `admin/[slug]/`:

- `settings/maktab/+page.svelte` — create terms, set active term, open/close enrollment.
- `maktab/registrations/+page.svelte` — student table, CSV/HTML export.

Add to `apps/admin/src/lib/api.ts`:

```ts
getMaktabSettings: (id: string) => request('GET', `/api/v1/admin/masjids/${id}/maktab/settings`),
updateMaktabSettings: (id, data) => request('PUT', `/api/v1/admin/masjids/${id}/maktab/settings`, data),
listMaktabTerms: (id) => request('GET', `/api/v1/admin/masjids/${id}/maktab/terms`),
createMaktabTerm: (id, data) => request('POST', `/api/v1/admin/masjids/${id}/maktab/terms`, data),
activateMaktabTerm: (id, termId) => request('POST', `/api/v1/admin/masjids/${id}/maktab/terms/${termId}/activate`),
getMaktabRegistrations: (id) => request('GET', `/api/v1/admin/masjids/${id}/maktab/registrations`),
```

## 8. Shared Schemas

Add `packages/schemas/src/maktab.ts`:

```ts
export const ParentSchema = z.object({
  name: z.string().trim().min(1),
  phone: z.string().refine(isValidPhoneNumber),
  email: z.string().email(),
}).partial(); // at least one parent must be complete

export const ChildSchema = z.object({
  name: z.string().min(2),
  dob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  sex: z.enum(['male', 'female']),
});

export const EnrollmentSchema = z.object({
  father: ParentSchema.optional(),
  mother: ParentSchema.optional(),
  address_line1: z.string().min(5),
  city: z.string().min(2),
  postal_code: z.string().regex(/^\d{5}(-\d{4})?$/),
  country: z.string().default('US'),
  children: z.array(ChildSchema).min(1),
}).refine((d) => !!(d.father && d.father.name) || !!(d.mother && d.mother.name), {
  message: 'At least one complete parent is required',
});

export const TermCreateSchema = z.object({
  name: z.string().min(1),
  length_months: z.number().int().min(1).max(12),
  price_cents_1: z.number().int().positive(),
  price_cents_2: z.number().int().positive(),
  price_cents_3plus: z.number().int().positive(),
});
```

## 9. Environment Variables

`apps/api` environment variables (set in Cloudflare Pages settings, `.dev.vars`, or your platform equivalent):

```env
SQUARE_ACCESS_TOKEN=...
SQUARE_APP_ID=...
SQUARE_LOCATION_ID=...
BREVO_API_KEY=...
SENDER_EMAIL=automated@masjid.com
SENDER_NAME=Masjid Receipts
FORWARD_TO_EMAIL=...
LOGGING_EMAIL=...
BOT_NAME=masjid-api/1.0
```

If Square is not configured, `POST /api/v1/masjids/:slug/maktab/enroll` returns a 5xx error.

## 10. Implementation Phases

A safe order given that Stripe keys may arrive asynchronously and there is no active term:

| Phase | Work | Tests |
|---|---|---|
| **1. Scaffold** | Add `mkt_*` tables to `@masjid/api` schema, `maktab/` lib + routes | DB tables exist, API boots |
| **2. Schemas** | Add `@masjid/schemas/maktab.ts`, update barrel export | Zod tests |
| **3. Terms admin** | Admin settings UI + API routes, Square plan creation | Admin settings tests |
| **4. Public pages** | Consumer `maktab/`, `maktab/enroll/`, pricing fetch | Consumer page tests |
| **5. Square enrollment** | Square Web Payments SDK + one-step subscription + Brevo email | Mocked Square happy path + failure path |
| **6. Registrations UI** | Admin registration list | Admin registration table tests |
| **8. Hardening** | Idempotency, rollback on DB failure, retry limits, CORS, cleanup old `mkt_registrations` stub | Integration tests |
| **9. Docs** | Update `AGENTS.md` with new worker/routes, add deployment notes | — |

## 11. Risks & Notes

- **One database**: all Maktab tables live in the same D1/SQLite database as the rest of the app, so the same seed/migrations apply.
- **Email is synchronous**: Brevo failures log to console but do not fail enrollment. A future outbox/queue can be added if needed.
- **Secret leakage**: `suffah-old/.env.local` contains live keys. Rotate Square/Brevo/Supabase credentials before production deployment.
- **Price source of truth**: keep price logic in the API. The browser only derives the tier from the number of children and the displayed prices.
- **Static copy**: Program marketing copy is out of scope; only term/pricing is dynamic for now.
