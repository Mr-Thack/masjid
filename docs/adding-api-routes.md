# How to Add a New API Route

All 56+ API routes follow the same patterns. This guide covers the recipe for adding any new endpoint.

## The three route categories

| Category | Path prefix | Auth | Files go in |
|---|---|---|---|
| Public | `/api/v1/masjids/[slug]/...` | None | `apps/api/src/routes/api/v1/masjids/[slug]/` |
| Admin | `/api/v1/admin/masjids/[id]/...` | JWT | `apps/api/src/routes/api/v1/admin/masjids/[id]/` |
| Top-level | `/api/v1/auth/...`, `/api/v1/status`, etc. | Varies | `apps/api/src/routes/api/v1/.../` |

## Recipe: Add a public endpoint

### 1. Create the route file

Create `apps/api/src/routes/api/v1/masjids/[slug]/my-feature/+server.ts`:

```ts
import { db, getMasjidBySlug } from '$lib/server/db';
import { JsonResponse, ErrorJsonResponse } from '@masjid/schemas';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params }) => {
  try {
    const masjid = await getMasjidBySlug(db, params.slug);
    if (!masjid) {
      return ErrorJsonResponse('NOT_FOUND', 'Masjid not found');
    }

    // Your data lookup here
    const result = await db.select().from(...).where(...).all();

    return JsonResponse({ data: result });
  } catch (err) {
    console.error('my-feature GET error:', err);
    return ErrorJsonResponse('INTERNAL_ERROR', 'Something went wrong');
  }
};
```

### 2. Add a Zod schema (if accepting input)

In `packages/schemas/src/my-feature.ts`:

```ts
import { z } from 'zod';

export const MyFeatureSchema = z.object({
  title: z.string().min(1).max(200),
  is_active: z.boolean().optional().default(true),
});

export type MyFeatureInput = z.infer<typeof MyFeatureSchema>;
```

Re-export from `packages/schemas/src/index.ts`:
```ts
export * from './my-feature.js';
```

### 3. Wire up the POST/PUT handler (admin routes)

```ts
import { MyFeatureSchema } from '@masjid/schemas';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, params, locals }) => {
  try {
    const body = await request.json();
    const parsed = MyFeatureSchema.safeParse(body);
    if (!parsed.success) {
      return ErrorJsonResponse('VALIDATION_ERROR', parsed.error.issues[0].message);
    }

    // Insert/update logic
    await db.insert(...).values({
      masjid_id: params.id,
      ...parsed.data,
    });

    return JsonResponse({ success: true }, 201);
  } catch (err) {
    console.error('my-feature POST error:', err);
    return ErrorJsonResponse('INTERNAL_ERROR', 'Something went wrong');
  }
};
```

## Recipe: Add an admin endpoint (JWT-gated)

### 1. Create the route file

Create `apps/api/src/routes/api/v1/admin/masjids/[id]/my-feature/+server.ts`:

```ts
import { db } from '$lib/server/db';
import { requireAdmin } from '$lib/server/auth/middleware';
import { JsonResponse, ErrorJsonResponse } from '@masjid/schemas';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async (event) => {
  try {
    const { masjidId } = requireAdmin(event);

    // Your data lookup here
    const items = await db.select().from(...)
      .where(eq(someTable.masjid_id, masjidId))
      .all();

    return JsonResponse({ items });
  } catch (err) {
    console.error('admin my-feature GET error:', err);
    return ErrorJsonResponse('INTERNAL_ERROR', 'Something went wrong');
  }
};
```

### 2. JWT is automatic

The `hooks.server.ts` middleware calls `validateJWT()` for any path under `/api/v1/admin/`. The `requireAdmin()` helper extracts the masjid ID and handles auth errors. You don't need to decode the token yourself.

```ts
// requireAdmin returns { adminId, masjidId }
// Throws with appropriate ErrorJsonResponse on failure
const { masjidId } = requireAdmin(event);
```

## Error response shape

Always use the standard shape. Don't return raw objects or untyped errors:

```ts
// ✅ Correct
return ErrorJsonResponse('NOT_FOUND', 'Masjid not found');
return ErrorJsonResponse('VALIDATION_ERROR', 'Title is required');
return JsonResponse({ items: [...] });

// ❌ Wrong — no standard shape
return new Response(JSON.stringify({ error: 'bad' }), { status: 400 });
throw new Error('something broke'); // no catch → 500 with no body
```

Available error codes: `VALIDATION_ERROR`, `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `CONFLICT`, `INTERNAL_ERROR`.

## Adding to the Drizzle schema

When adding a new table or column:

1. **Add to Drizzle schema** (`apps/api/src/lib/server/db/schema.ts`) — appends new columns at the end of the table definition
2. **Add to `schema.sql`** — the canonical D1 schema, also appends new columns
3. **Run schema drift checks**: `npm run check-schema` and `npx tsx tooling/check-d1-drift.ts masjid-db`
4. **Both must match** — CI gates deploys on both checks

**Never insert columns in the middle** of a Drizzle table definition. D1's `ALTER TABLE ADD COLUMN` appends to the end, and Drizzle maps results by position. Inserting in the middle scrambles every SELECT.

## Adding agent tools for the new endpoint

If the new endpoint should be usable via the AI agent or WhatsApp bot:

1. **Add an API proxy function** in `packages/agent/src/api-client.ts`
2. **Add a tool definition** in `packages/agent/src/tools.ts`
3. **Update the system prompt** in `packages/agent/src/prompt.ts` if needed
4. **Update the tool count** in WhatsApp worker tests (currently 47 tools expected)

The api-client functions use the `apiJson()` helper which checks `res.ok` and reads text first — never call `.json()` on a fetch response without checking.

## Testing the new route

```bash
# Unit test the route handler (mocked D1)
npm run test

# Integration test (real HTTP, needs server on 5173)
npm run test:integration

# Validate the schema won't drift in CI
npm run check-schema
```

Route unit tests follow this pattern:
```ts
import { GET, POST } from './+server';
import { vi } from 'vitest';

// Mock D1/KV/whatever the route depends on
vi.mock('$lib/server/db', () => ({
  db: { select: vi.fn(), insert: vi.fn() },
  getMasjidBySlug: vi.fn(),
}));

it('returns 404 for unknown slug', async () => {
  vi.mocked(getMasjidBySlug).mockResolvedValue(null);
  const res = await GET({ params: { slug: 'nope' } });
  expect(res.status).toBe(404);
});
```

## Checklist

- [ ] Route file created in correct directory
- [ ] HTTP methods exported (GET/POST/PUT/DELETE)
- [ ] Zod schema in `@masjid/schemas` and re-exported from `index.ts`
- [ ] Admin routes use `requireAdmin(event)` for JWT
- [ ] All errors use `ErrorJsonResponse(code, message)`
- [ ] All success responses use `JsonResponse(data, status?)`
- [ ] Drizzle schema updated (columns appended at end)
- [ ] `schema.sql` updated (columns appended at end)
- [ ] `npm run check-schema` passes
- [ ] Tests written in `apps/api/src/__tests__/`
- [ ] If adding agent tools: api-client function + tool definition + prompt + tool count test