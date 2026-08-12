# Bot Abstraction: Separating Core Agent Logic from WhatsApp Transport

## 1. Goal

Extract all transport-agnostic bot logic from `workers/whatsapp/` into a new shared package
`@masjid/agent` (`packages/agent/`). Both the WhatsApp worker and the admin web UI will
import from `@masjid/agent` — neither depends on the other. Each provides only its own
transport layer (Meta webhook vs. HTTP API + browser UI).

---

## 2. Module Classification

Every file in `workers/whatsapp/src/` is classified as one of:

| Category | Meaning | Destination |
|----------|---------|-------------|
| **Pure Bot Logic** | Zero transport references. Deals only with tool definitions, LLM calling, mutation storage, API proxying. | Moves to `@masjid/agent` |
| **WhatsApp Transport** | Binds to Meta APIs, WhatsApp message format, webhook parsing. | Stays in `workers/whatsapp/` |

---

## 3. File-by-File Disposition

### 3.1 `agent/tools.ts` — 100% Pure → `packages/agent/src/tools.ts`

47 MCP-style tool definitions. Each tool has a JSON Schema `parameters` block and a `handler`
function that calls proxy functions. Zero WhatsApp references — not even in strings.

**Changes needed**:
- Replace `import type { Env, ToolContext }` with `import type { BotContext }` (see §5)
- Replace `proxy` import paths with `@masjid/agent/proxy`
- Replace `session` import paths with `@masjid/agent/session`
- The file is otherwise a straight copy.

**47 tools** (as of 2026-08-11): THEME (2), PROFILE (4), PRAYER_RULES (5), JUMUAH (4),
ANNOUNCEMENTS (5), POSTS (6), PAGES (4), NAV (5), MAKTAB (4), ROLLBACK (2),
RULES (2), TIMETABLE (2), WEB (2). See `AGENTS.md` for the full list.

### 3.2 `agent/runner.ts` — 98% Pure → `packages/agent/src/runner.ts`

Core LLM agent loop: `runAgent()`, `runVisionAgent()`, `callLLM()`, `buildFallbackResponse()`.

**WhatsApp leaks** (2 occurrences, both cosmetic):
1. Line 143, 190, 269, 316: `whatsapp-${new Date().toISOString().slice(0, 10)}` —
   the branch name prefix is hardcoded. **Fix**: accept `branchName` as a parameter.
2. The `runVisionAgent()` and `runAgent()` return strings that use WhatsApp markdown
   conventions (`*bold*`, `•` bullets). Rather than refactoring the output format
   (which would break WhatsApp), keep the strings as-is and let the web UI's
   `BotChat` component render or strip the markdown as it sees fit.

**Key change**: Accept `branchName: string` as a parameter to `runAgent()` and
`runVisionAgent()` instead of hardcoding the prefix.

### 3.3 `agent/prompt.ts` — 98% Pure → `packages/agent/src/prompt.ts`

System prompt builders: `buildSystemPrompt()`, `buildVisionPrompt()`.

**WhatsApp leak**: One cosmetic string on lines 92 and 149: "Respond in plain text
formatted for WhatsApp (use *bold* for emphasis, bullet points with •)."

**Fix**: Remove the phrase "for WhatsApp" — just say "formatted as plain text."
The `*bold*` and `•` conventions work in WhatsApp, Telegram, and a plain text
`<pre>` block in the web UI.

### 3.4 `agent/format.ts` — Mixed → Split

| Function | Destination | Reason |
|----------|-------------|--------|
| `DOMAIN_LABELS` | `@masjid/agent` | Pure data |
| `truncate()` | `@masjid/agent` | Pure utility |
| `formatMutation()` | `@masjid/agent` | Returns structured text — usable by any renderer |
| `formatDiffReceipt()` | `@masjid/agent` (refactored) | Split into two parts |
| `buildNoChangesMessage()` | WhatsApp | WhatsApp markdown output |
| `buildConfirmSuccessMessage()` | WhatsApp | WhatsApp markdown output |
| `buildErrorSummary()` | WhatsApp | WhatsApp markdown output |

**`formatDiffReceipt()` refactoring**: Split into:
- `getDiffData(branchId, db)` → `{ branchName, count, mutations: FormattedMutation[] }`
  (pure data, goes in `@masjid/agent`)
- `renderDiffWhatsApp(data)` → string (WhatsApp markdown, stays in worker)
- `renderDiffText(data)` → string (plain text, in `@masjid/agent` — used by web UI rendered inside `<pre>` or ignored in favor of the web-native `DiffReceiptCard` component)

### 3.5 `proxy.ts` — 100% Pure → `packages/agent/src/api-client.ts`

JWT-authenticated HTTP client for the admin API. 18 functions covering profile, theme,
prayer rules, jumu'ah, announcements, dry-run, and rollback. Zero WhatsApp references.

**Changes needed**:
- Replace `import type { Env }` with a narrower interface:
  ```ts
  interface ApiClientConfig {
    apiUrl: string;
    jwtSecret: string;
  }
  ```
- The `apiCall()` function reads `env.API_URL` and `env.JWT_SECRET` — change to accept
  these explicitly.
- Rename file to `api-client.ts` (more descriptive than `proxy.ts`).

### 3.6 `session.ts` — 95% Pure → `packages/agent/src/session.ts`

Branch/mutation/snapshot lifecycle. 15 functions for the config staging system.

**WhatsApp leaks** (2 occurrences):
1. `resolveTenant(phone)` — looks up admin by `whatsapp_phone` column.
   **Fix**: Add a generic `getAdminById(adminId, db)` function in `@masjid/agent`.
   Keep `resolveTenant(phone)` in the WhatsApp worker (it just calls `getAdminById`
   after the phone lookup).
2. `createBranch()` — branch name hardcoded as `whatsapp-${date}`.
   **Fix**: Accept `branchPrefix: string` parameter. WhatsApp worker passes `'whatsapp'`,
   admin web UI passes `'web'`.

### 3.7 `media.ts` — Mixed → Split

| Function | Destination | Reason |
|----------|-------------|--------|
| `bufferToDataUri()` | `@masjid/agent` | Generic utility |
| `uploadToR2()` | `@masjid/agent` | Generic R2 upload (not WhatsApp-specific) |
| `registerAsset()` | `@masjid/agent` | Generic DB insert |
| `downloadWhatsAppMedia()` | WhatsApp worker | Uses WhatsApp Graph API |

### 3.8 `messaging.ts` — WhatsApp Transport → Stays

`sendReply()`, `sendMediaReply()`, `buildHelpMessage()`, `buildSessionSummary()`.
All WhatsApp Cloud API or WhatsApp-formatted output.

### 3.9 `webhook.ts` — WhatsApp Transport → Stays

Meta webhook verification + payload parsing. 100% WhatsApp-specific.

### 3.10 `index.ts` — WhatsApp Orchestrator → Stays (shrinks)

The Cloudflare Worker entry point. Webhook routing, command dispatch (`/help`,
`/status`, `/confirm`, `/cancel`), media processing dispatch. It shrinks because
it no longer contains the agent logic — it just imports and calls `@masjid/agent`.

### 3.11 `types.ts` — Mixed → Split

| Type | Destination |
|------|-------------|
| `Env` | Stays in WhatsApp worker (contains WhatsApp bindings) |
| `AdminRecord` | `@masjid/agent` (includes `whatsapp_phone` — nullable, fine) |
| `BranchRecord` | `@masjid/agent` |
| `MutationRecord` | `@masjid/agent` |
| `ToolContext` | **Replaced** by `BotContext` in `@masjid/agent` |
| `ToolDefinition` | `@masjid/agent` |
| `ToolResult` | `@masjid/agent` |
| `LLM*` types (7) | `@masjid/agent` |
| `MutationSummary` | `@masjid/agent` |
| `ParsedWhatsAppMessage` | WhatsApp worker |
| `BRANCH_TIMEOUT_HOURS` | `@masjid/agent` |
| `BRANCH_GRACE_MINUTES` | `@masjid/agent` |

---

## 4. New Package Structure

```
packages/agent/
  package.json               ← { "name": "@masjid/agent", "private": true }
  tsconfig.json
  src/
    index.ts                 ← barrel export
    context.ts               ← BotContext interface, BotEnv minimal config
    tools.ts                 ← 23 MCP tool definitions (from agent/tools.ts)
    runner.ts                ← runAgent(), runVisionAgent(), callLLM() (from agent/runner.ts)
    prompt.ts                ← buildSystemPrompt(), buildVisionPrompt() (from agent/prompt.ts)
    format.ts                ← formatMutation(), getDiffData(), renderDiffText() (from agent/format.ts)
    api-client.ts             ← 18 proxy functions (from proxy.ts)
    session.ts               ← 15 branch/mutation/snapshot functions (from session.ts)
    media-utils.ts            ← bufferToDataUri(), uploadToR2(), registerAsset() (from media.ts)
    types.ts                  ← all types except ParsedWhatsAppMessage + WhatsApp env vars
```

---

## 5. The `BotContext` Interface (replaces `ToolContext` + `Env`)

```ts
// packages/agent/src/context.ts

export interface BotContext {
  adminId: string;
  masjidId: string;
  branchId: string;
  db: D1Database;
  apiUrl: string;
  jwtSecret: string;
  assets?: R2Bucket;           // optional — only for vision/file upload
  llmApiKey?: string;
  llmApiUrl?: string;
  llmModel?: string;
}

export interface BotEnv {
  API_URL: string;
  JWT_SECRET: string;
  LLM_API_URL?: string;
  LLM_API_KEY?: string;
  LLM_MODEL?: string;
  CDN_BASE_URL?: string;
}
```

The WhatsApp worker's `Env` is a superset of `BotEnv` (adds `DB`, `ASSETS`, `WHATSAPP_*`).
The tool handlers, runner, and api-client only ever access `BotContext`/`BotEnv` fields,
so the abstraction is zero-overhead — no data copying needed.

---

## 6. How Each Consumer Uses the Agent

### 6.1 WhatsApp Worker (after refactor)

```ts
import { runAgent, runVisionAgent } from '@masjid/agent';
import { sendReply } from './messaging';

async function processMessage(msg, admin, env) {
  const branch = await getOrCreateBranch(admin, env.DB, 'whatsapp');

  // BotContext is a subset of Env — pass env directly
  const response = await runAgent(msg.body, admin, branch.id, env);

  await sendReply(response, msg.from, env);
}
```

### 6.2 Admin Web UI

```ts
import { runAgent, runVisionAgent } from '@masjid/agent';

async function handleBotMessage(userMessage: string) {
  const ctx: BotContext = {
    adminId: currentAdmin.id,
    masjidId: currentAdmin.masjid_id,
    branchId: currentBranch.id,
    db: {}, // the admin UI does NOT use D1 directly — mutations go through the API
    apiUrl: '/api',
    jwtSecret: '', // not needed — browser uses cookie/session auth
    llmApiKey: config.llmApiKey,
    llmApiUrl: 'https://openrouter.ai/api/v1',
    llmModel: 'google/gemma-4-31b-it',
  };

  // The admin UI does not use storeMutation() — tool handlers write
  // directly to the admin API and the API routes mutations through
  // the server-side session layer.
  //
  // For the admin UI, we'll provide an alternative tool handler
  // registration that uses fetch() with Authorization header instead
  // of the JWT proxy. See §7.
  const response = await runAgent(userMessage, admin, branch.id, ctx);
  return response;
}
```

### 6.3 Shared Tool Handler Resolution

The tool definitions in `@masjid/agent` call the proxy functions (from
`api-client.ts`). Both the WhatsApp worker and admin UI use the same proxy —
the only difference is how the `fetch` base URL and auth header are configured:

- **WhatsApp worker**: sends `Authorization: Bearer <internal JWT>` to `${API_URL}/api/v1/...`
- **Admin web UI**: sends `Authorization: Bearer <browser login JWT>` to `/api/v1/...`
  (proxied through Vite in dev, same-origin in prod)

Both can use the same `api-client.ts` because the `BotContext.llmApiKey`/
`jwtSecret`/`apiUrl` values are all that distinguish them.

---

## 7. Test Boundary

### 7.1 Tests that Belong in `@masjid/agent`

All tests of **pure bot logic** — these verify that the bot behaves correctly
regardless of transport. They are the majority of the current 215 WhatsApp tests.

| Test file (in `@masjid/agent`) | What it covers | Source (in worker) |
|-----|-----|-----|
| `tools.test.ts` | All 23 tool definitions — JSON schema shape, handler logic, mutation storage | `tools.test.ts` lines 57-574 |
| `runner.test.ts` | Agent loop behavior — LLM call flow, tool execution ordering, error handling, fallback response | `runner.test.ts` |
| `prompt.test.ts` | System prompt structure — includes current masjid state, domain guides, examples | `prompt.test.ts` |
| `format.test.ts` | Mutation formatting — `formatMutation()`, `getDiffData()` structured output | `format.test.ts` (new, extracted from WhatsApp formatting tests) |
| `session.test.ts` | Branch lifecycle — create/open/merge/abandon, mutation CRUD, snapshot list/get | `session.test.ts` (modified) |
| `api-client.test.ts` | Proxy functions — JWT signing, API call construction, all 18 CRUD functions | `proxy.test.ts` |
| `media-utils.test.ts` | `bufferToDataUri()`, `uploadToR2()`, `registerAsset()` | `media.test.ts` (partial) |

**Expected test count**: ~40 tests (implemented; the 231 WhatsApp tests include agent-covered logic too)

### 7.2 Tests that Stay in WhatsApp Worker

| Test file | What it covers |
|-----|-----|
| `webhook.test.ts` | Meta webhook verification, payload parsing, message extraction |
| `messaging.test.ts` | `sendReply()`, `sendMediaReply()`, WhatsApp markdown formatting |
| `index.test.ts` | End-to-end webhook to agent response pipeline (integration tests using mocked `@masjid/agent`) |
| `media.test.ts` (WhatsApp part) | `downloadWhatsAppMedia()` — WhatsApp Graph API call |

**Expected test count**: ~40 tests

### 7.3 New Tests for `@masjid/agent` (web UI path)

Additional tests proving the agent works through the HTTP/browser path:

| Test file | What it covers |
|-----|-----|
| `agent-http.test.ts` | Tool handlers calling proxy with browser-style auth (same-origin, cookie header instead of JWT) |
| `runner-http.test.ts` | `runAgent()` with `BotContext` from browser (no `Env`, no WhatsApp bindings) |

**Expected new test count**: ~30 tests

### 7.4 Tests that Belong in the Admin App (see `docs/admin-tests.md`)

The admin app has its own tests for UI components, BotChat, and integration.
The `@masjid/agent` package is tested in isolation — the admin app tests verify
that the UI correctly consumes the agent's output, not that the agent works
(that's the agent package's job).

---

## 8. Implementation Steps

1. **Create `packages/agent/`** — `package.json`, `tsconfig.json`, directory structure
2. **Copy files in** — `tools.ts`, `runner.ts`, `prompt.ts`, `format.ts`, `api-client.ts`, `session.ts`, `media-utils.ts`, `types.ts`, `context.ts`
3. **Refactor interfaces** — `ToolContext` → `BotContext`, `Env` → `BotEnv`, parameterize `branchName` and `branchPrefix`
4. **Write `@masjid/agent` tests** — copy the existing tests, update imports, fix any broken references
5. **Refactor WhatsApp worker** — delete moved files, import from `@masjid/agent`, keep only transport files
6. **Verify** — `npm run test:whatsapp` and `npm run test:agent` both pass (231 + 40 tests)
7. **Wire admin UI** — `apps/admin/` imports `@masjid/agent` for `BotChat` component

---

## 9. Risk Assessment

| Risk | Mitigation |
|------|-----------|
| Breaking WhatsApp worker during extraction | Do step 5 only after step 4 passes. Maintain the same import names. |
| `BotContext` missing fields needed by one consumer | Both consumers already use the same 24 API endpoints. The context is identical. |
| Web UI needs cookie auth vs JWT auth | The proxy already supports an `Authorization` header. Both consumers set it — just with different key material. |
| Double test counting | The agent package tests ~40, the WhatsApp worker tests ~231, the admin app tests ~230. Total ~501+. No double counting — each test verifies a different layer. |