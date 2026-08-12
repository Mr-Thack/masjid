# Testing Guide

## Quick reference

| Command | What it runs | Needs servers? | Count |
|---|---|---|---|
| `npm run test` | API unit tests (node) | No | 673 |
| `npm run test:tv` | TV frontend (jsdom) | No | 266 |
| `npm run test:consumer` | Consumer frontend (jsdom) | No | 165 |
| `npm run test:whatsapp` | WhatsApp worker (node) | No | 231 |
| `npm run test:agent` | Agent package (node) | No | 40 |
| `npm run test:admin` | Admin app (jsdom) | No | 230 |
| `npm run test:tooling` | Tooling scripts (node) | No | 23 |
| `npm run test:integration` | API integration (node) | **Yes** — API on 5173 | 7 |
| `npm run test:sw` | Service worker removal (Playwright) | **Yes** — all dev servers | 12 |
| `npm run test:e2e` | Browser E2E smoke (Playwright) | **Yes** — all dev servers | ~140 |
| `npm run check-schema` | Schema drift check | No | — |
| `npm run test:all:ci` | **All vitest suites + schema** | No | ~1,628 |
| `npm run test:all` | **Everything including SW + integration** | **Yes** | ~1,647 |

## When to run what

### Before every commit
```bash
npm run test:all:ci     # 7 vitest suites + schema check — ~30 seconds
```

### When API code changed
```bash
npm run test             # API unit tests
npm run test:integration # API integration tests (needs API server on 5173)
```

### When frontend code changed
```bash
npm run test:tv          # or test:consumer or test:admin
```

### When agent/tools changed
```bash
npm run test:agent       # Agent package tests
npm run test:whatsapp    # WhatsApp worker (tests tool counts, should be 47)
```

### Before deploying
```bash
npm run test:all         # Everything (needs servers on 5173-5176)
npm run test:e2e         # Browser smoke (needs servers on 5173-5176)
```

### Before merging to staging
```bash
npm run test:e2e:staging # Browser smoke against staging.masjid-live.pages.dev
```

## What each suite covers

### API unit tests (`vitest.config.ts`)
- **Runner**: Node (no browser)
- **Scope**: Schema validation, auth (JWT, bcrypt), prayer engine, rules evaluation, Maktab (Square, enrollment, email), admin CRUD, board endpoint
- **Mocks**: D1 database, KV cache, Square API, external fetches
- **Does NOT test**: Real HTTP requests, browser rendering, worker runtime behavior

### TV frontend tests (`vitest.tv.config.ts`)
- **Runner**: jsdom + testing-library + svelte plugin
- **Scope**: Component rendering (PrayerBoard, AnalogClock, SoulColumn, frames, ceremony overlay), board-cycle math, ceremony state machine, server-clock sync, frame rotation, style options parsing
- **Mocks**: API calls
- **Polyfills**: `Element.prototype.animate` (Svelte 5 transitions need it in jsdom)

### Consumer frontend tests (`vitest.consumer.config.ts`)
- **Runner**: jsdom + testing-library + svelte plugin
- **Scope**: Component rendering (PrayerTable, WeeklyPrayerTable, HeroNiche, HadithCard, etc.), navigation, maktab validation, load functions, theme application
- **Mocks**: API calls, fetch

### WhatsApp worker tests (`vitest.whatsapp.config.ts`)
- **Runner**: Node
- **Scope**: Webhook parsing, phone-to-tenant resolution, branch lifecycle, tool handler dispatch, LLM response parsing, diff receipt formatting, RTL handling
- **Mocks**: D1, fetch (Meta API + LLM API)

### Agent package tests (`vitest.agent.config.ts`)
- **Runner**: Node
- **Scope**: Tool definitions (47 tools), API client proxy functions, session management, media utilities, prompt builders
- **Mocks**: fetch, D1

### Admin app tests (`vitest.admin.config.ts`)
- **Runner**: jsdom + testing-library + svelte plugin
- **Scope**: Component rendering (AdminShell, BotChat, DiffReceiptCard, 11 settings pages), auth store, API client, navigation
- **Mocks**: API calls, localStorage

### Tooling tests (`vitest.tooling.config.ts`)
- **Runner**: Node
- **Scope**: merge-pages.js (build output merging), build integrity checks, schema drift comparison

### API integration tests (`vitest.integration.config.ts`)
- **Runner**: Node
- **Scope**: Real HTTP requests to the running API server on port 5173
- **Does NOT mock**: D1, KV — hits the real local dev database

### Service worker tests (`test:sw`)
- **Runner**: Playwright (real Chromium)
- **Scope**: Verifies the suicide worker unregisters itself, purges caches, and `/sw-kill` works
- **Requires**: All dev servers running (5173-5176)

### Browser E2E tests (`test:e2e`)
- **Runner**: Playwright (real Chromium)
- **Scope**: API smoke (API-01..19), deploy verification (DEP-01..09), consumer pages (CON-01..48), TV display (TV-01..11), admin workflow (ADM-01..25)
- **Requires**: All dev servers running locally; or staging/prod deployed
- **Documentation**: `docs/integration-testing.md`, `docs/integration-test-cases.md`

## Test patterns

### Frontend component tests
```ts
import { render } from '@testing-library/svelte';
import MyComponent from './MyComponent.svelte';

const { container } = render(MyComponent, { props: { ... } });
expect(container.textContent).toContain('expected text');
```

### API route tests
```ts
// Create a mock Request and test the handler directly
import { GET, POST } from './+server';
const req = new Request('http://localhost/api/v1/...', { method: 'GET' });
const res = await GET({ request: req, params: { id: '...' }, ... });
expect(res.status).toBe(200);
```

## Common issues

| Symptom | Fix |
|---|---|
| `Cannot find module './.svelte-kit/tsconfig.json'` | Run `npm run setup` or `svelte-kit sync` in that workspace |
| DB tables missing | `npx tsx tooling/seed.ts` |
| Consumer page returns 500 | API server might be down — `curl http://localhost:5173/api/v1/masjids/masjid-al-noor` |
| Frontend tests fail with `document is not defined` | Ensure `conditions: ['browser']` is in the vitest config |
| Integration tests all fail with `ECONNREFUSED` | Start the API server: `npm run dev --workspace=@masjid/api` |
| E2E tests timeout | Run `npm run dev:all` first; pre-warm helps on slow machines |
| WhatsApp tests fail on tool count | Tools may have been added — check actual count matches test assertion