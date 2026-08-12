# MCP Integration Strategy

## Architecture

```
LLM ──► MCP Server ──► HTTP ──► SvelteKit API ──► D1 / KV / Square
                                (same origin)
```

The MCP server is a thin bridge. It authenticates via JWT, then forwards structured tool calls to the platform API. The API is the canonical interface — the web dashboard and the MCP server both call the same routes.

---

## Shared contract via Zod schemas

A `packages/schemas` package exports typed schemas for every endpoint. Both the SvelteKit API and the MCP server import from it.

```
packages/schemas/
  prayer.ts          # PrayerRules, Condition, Action, PrayerTimesResponse
  masjid.ts          # Masjid, MasjidProfile, Theme, CreateMasjidInput
  announcements.ts   # Announcement, CreateAnnouncementInput, UpdateAnnouncementInput
  jumuah.ts          # JumuahSession, CreateJumuahInput
  auth.ts            # LoginInput, LoginResponse
  domain.ts          # CustomDomain, CreateDomainInput
  common.ts          # Pagination, ErrorResponse, timestamp helpers
```

### Schema example

```typescript
// packages/schemas/prayer.ts
import { z } from "zod";

export const PrayerNameEnum = z.enum([
  "fajr", "dhuhr", "asr", "maghrib", "isha",
]);

export const ConditionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("always") }),
  z.object({ type: z.literal("day_of_week"), days: z.array(z.number().min(0).max(6)) }),
  z.object({ type: z.literal("month"), months: z.array(z.number().min(1).max(12)) }),
  z.object({ type: z.literal("hijri_month"), months: z.array(z.number().min(1).max(12)) }),
  z.object({ type: z.literal("date_range"), start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }),
]);

export const ActionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("add_minutes"), minutes: z.number().int().positive() }),
  z.object({ type: z.literal("round_up"), increment: z.number().int().refine(n => [1,5,10,15,20,30,60].includes(n)) }),
  z.object({ type: z.literal("round_down"), increment: z.number().int().refine(n => [1,5,10,15,20,30,60].includes(n)) }),
  z.object({ type: z.literal("round_nearest"), increment: z.number().int().refine(n => [1,5,10,15,20,30,60].includes(n)) }),
  z.object({ type: z.literal("set_fixed_time"), time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/) }),
]);

export const CreatePrayerRuleSchema = z.object({
  masjid_id: z.string().uuid(),
  prayer_name: PrayerNameEnum,
  rule_name: z.string().min(1),
  execution_order: z.number().int().min(0),
  conditions_json: z.array(ConditionSchema).min(1),
  action_json: ActionSchema,
});

export type PrayerRule = z.infer<typeof CreatePrayerRuleSchema> & { id: string };
```

### Dual usage

```typescript
// In SvelteKit API route — validates request body
export async function POST({ request, params }) {
  const body = CreatePrayerRuleSchema.parse(await request.json());
  // ... insert into D1
}

// In MCP server — validates LLM-generated input before calling the API
async function handleToolCall(name: string, args: unknown) {
  if (name === "prayer_rules_create") {
    const validated = CreatePrayerRuleSchema.parse(args);
    const res = await fetch(`${API_BASE}/masjids/${validated.masjid_id}/prayer-rules`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(validated),
    });
    return res.json();
  }
}
```

The schemas are the single source of truth — no drift between documentation, API validation, and MCP tool definitions.

---

## MCP tool generation

The MCP server walks the schema package and exposes each endpoint as a typed tool:

```typescript
// MCP server tool registration (auto-generated from schemas)
const tools = [
  {
    name: "prayer_rules_list",
    description: "List all prayer rules for a masjid, ordered by execution_order.",
    inputSchema: z.object({ masjid_id: z.string().uuid() }),
    handler: (input) => apiCall("GET", `/masjids/${input.masjid_id}/prayer-rules`),
  },
  {
    name: "prayer_rules_create",
    description: "Create a new Iqaamah rule for a prayer. Conditions are ANDed; use separate rules for OR logic.",
    inputSchema: CreatePrayerRuleSchema,
    handler: (input) => apiCall("POST", `/masjids/${input.masjid_id}/prayer-rules`, input),
  },
  {
    name: "prayer_rules_update",
    description: "Update an existing prayer rule. Send only the fields you want to change.",
    inputSchema: UpdatePrayerRuleSchema,
    handler: (input) => {
      const { rule_id, ...body } = input;
      return apiCall("PUT", `/masjids/${input.masjid_id}/prayer-rules/${rule_id}`, body);
    },
  },
  {
    name: "prayer_rules_delete",
    description: "Delete a prayer rule. Remaining rules are re-ordered automatically.",
    inputSchema: z.object({ masjid_id: z.string().uuid(), rule_id: z.string().uuid() }),
    handler: (input) => apiCall("DELETE", `/masjids/${input.masjid_id}/prayer-rules/${input.rule_id}`),
  },
  {
    name: "prayer_rules_reorder",
    description: "Bulk reorder prayer rules. Send the full list of rule IDs in the desired order.",
    inputSchema: z.object({
      masjid_id: z.string().uuid(),
      order: z.array(z.string().uuid()),
    }),
    handler: (input) => apiCall("PUT", `/masjids/${input.masjid_id}/prayer-rules/reorder`, { order: input.order }),
  },
  // ... announcements, jumuah, masjid profile, etc.
];
```

### Tool naming convention

`{resource}_{action}` — maps 1:1 to `METHOD + PATH`:

| Tool name | Method | Path |
|---|---|---|
| `announcements_list` | GET | `/masjids/:id/announcements` |
| `announcements_create` | POST | `/masjids/:id/announcements` |
| `announcements_update` | PUT | `/masjids/:id/announcements/:slug` |
| `announcements_delete` | DELETE | `/masjids/:id/announcements/:slug` |
| `announcements_pin` | PUT | `/masjids/:id/announcements/:slug/pin` |

---

## Agent workflow example

```
Imam emails:
  "Dhuhr Iqaamah should be 10 minutes after Adhaan.
   On Fridays, make it exactly 1:30 PM.
   Round up to the nearest 5 minutes."

LLM (via MCP):
  1. Calls prayers_rules_create with:
     {
       masjid_id: "abc123",
       prayer_name: "dhuhr",
       rule_name: "Friday Dhuhr override",
       execution_order: 1,
       conditions_json: [{ type: "day_of_week", days: [5] }],
       action_json: { type: "set_fixed_time", time: "13:30" }
     }
  2. Calls prayers_rules_create with:
     {
       masjid_id: "abc123",
       prayer_name: "dhuhr",
       rule_name: "Default Dhuhr offset",
       execution_order: 2,
       conditions_json: [{ type: "always" }],
       action_json: { type: "add_minutes", minutes: 10 }
     }
  3. Calls prayers_rules_create with:
     {
       masjid_id: "abc123",
       prayer_name: "dhuhr",
       rule_name: "Round up for display",
       execution_order: 3,
       conditions_json: [{ type: "always" }],
       action_json: { type: "round_up", increment: 5 }
     }

Verification layer (in the API):
  - Validates all conditions/actions against Zod schemas
  - Checks that Iqaamah times don't violate ordering (Isha before Maghrib, etc.)
  - On success: writes to D1, flushes KV cache, returns confirmation

Response back to LLM:
  → LLM generates email: "Walaykum Assalam. Your prayer timings have been updated..."
```

---

## Authentication for MCP

The MCP server stores a JWT obtained via `/auth/login`. The token is passed as `Authorization: Bearer <token>` on every API call. The API validates the JWT and extracts the `masjid_id` — the MCP server can only operate on the masjid it's authenticated for.

No separate API key system for the MVP. The MCP server uses the same JWT auth as the web dashboard.

---

## OpenAPI generation (future)

Once the SvelteKit routes + Zod schemas are in place, an OpenAPI spec can be generated from them. This enables:

- Auto-generated MCP tool definitions from the OpenAPI JSON (no manual tool registration)
- Swagger UI for developer debugging
- Client SDK generation

This is a nice-to-have, not required for the MVP. The MCP server can start by directly importing the Zod schemas.