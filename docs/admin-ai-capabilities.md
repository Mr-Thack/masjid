# Admin AI Capabilities: Bot Chat Panel Design

## 0. Philosophy

The AI bot in the admin web UI provides the **same natural language config editing**
as WhatsApp, but with a richer UI. The core reasoning engine (`@masjid/agent`) is
identical in both contexts. The admin UI adds:

- Structured diff receipt rendering (cards, not markdown)
- Visual confirm/cancel buttons (not `/commands`)
- File upload with drag-and-drop (vision)
- Conversation history (persisted per-masjid)
- Streaming responses (SSE — see §6)

---

## 1. Route: `/admin/[slug]/bot`

### Layout

```
┌─────────────────────────────────────────────────────┐
│ ← Back to Dashboard    AI Assistant                 │
├─────────────────────────────────────────────────────┤
│                                                     │
│  [system] Welcome! I can help you configure...      │
│                                                     │
│  [user]  Change Dhuhr iqaamah to 10 minutes         │
│          after adhaan, and on Fridays set            │
│          it to 1:30 PM                               │
│                                                     │
│  [bot]   🔄 Thinking...                             │
│                                                     │
│  [bot]   Here's what I'll do:                       │
│  ┌─────────────────────────────────────────────┐    │
│  │ ✨ 2 changes applied                         │    │
│  │                                              │    │
│  │ PRAYER_RULES                                 │    │
│  │ + Create: "Friday Dhuhr override"             │    │
│  │   Set fixed time: 1:30 PM                    │    │
│  │   When: Fridays                              │    │
│  │                                              │    │
│  │ + Create: "Default Dhuhr offset"              │    │
│  │   Add 10 minutes                             │    │
│  │   When: Always                               │    │
│  │                                              │    │
│  │        [✓ Confirm]    [✕ Cancel]              │    │
│  └─────────────────────────────────────────────┘    │
│                                                     │
│  [bot]   ✓ Changes confirmed! Snapshot created.     │
│                                                     │
├─────────────────────────────────────────────────────┤
│ 📎  [Type your message...]                    [→]   │
│                                                     │
│ Session: web-2026-07-22-a3f2  ·  3 changes pending  │
└─────────────────────────────────────────────────────┘
```

---

## 2. `BotChat` Component Structure

```
BotChat.svelte
├── ChatHeader
│   ├── Back button → dashboard
│   └── "AI Assistant" title
├── MessageList (scrollable, auto-scrolls to bottom)
│   ├── SystemMessage           — grey italic, welcome/help
│   ├── UserMessage              — accent bubble, right-aligned
│   ├── BotThinkingIndicator     — pulsing dots
│   ├── BotTextMessage           — plain text, left-aligned
│   ├── DiffReceiptCard          — structured diff (see §3)
│   │   ├── DiffGroup
│   │   │   └── DiffMutation    — one per mutation
│   │   └── DiffActions          — Confirm / Cancel buttons
│   ├── BotConfirmMessage        — green success bubble
│   └── BotErrorMessage          — red error bubble + retry
├── ChatInput
│   ├── Text input (textarea, auto-growing)
│   ├── File upload button (paperclip icon)
│   ├── Send button (→)
│   └── Drag-and-drop overlay (appears when dragging files)
└── SessionBar
    ├── Branch name (e.g. "web-2026-07-22-a3f2")
    ├── Mutation count ("3 changes pending")
    └── Timer (auto-abandon warning when in grace period)
```

---

## 3. `DiffReceiptCard` — Core Reusable Component

This is the **primary deliverable** of the AI bot UI. It renders the structured
output of `@masjid/agent`'s `getDiffData()` as a styled card with domain grouping
and action buttons. It replaces the WhatsApp markdown receipt.

### Data Contract (from `@masjid/agent`)

```ts
interface DiffData {
  branchName: string;
  count: number;
  mutations: FormattedMutation[];
}

interface FormattedMutation {
  index: number;
  domain: 'THEME' | 'PROFILE' | 'PRAYER_RULES' | 'JUMUAH' | 'ANNOUNCEMENTS';
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'PIN' | 'REORDER';
  summary: string;      // human-readable one-liner (e.g. "Add 10 minutes to Dhuhr")
  details: string[];    // additional detail lines (e.g. ["When: Always", "Prayer: Dhuhr"])
  payload: Record<string, unknown>;  // raw mutation payload
}
```

### Visual Design

```html
<div class="diff-card">
  <!-- Header -->
  <div class="diff-card__header">
    <span class="diff-card__icon">✨</span>
    <span class="diff-card__title">{count} change{plural} applied</span>
  </div>

  <!-- Groups by domain -->
  {#each groupByDomain(mutations) as group}
    <div class="diff-group">
      <div class="diff-group__domain">
        <span class="diff-group__domain-badge" class:domain--theme={...} class:domain--rules={...}>
          {group.domain}
        </span>
      </div>

      {#each group.mutations as mutation}
        <div class="diff-mutation">
          <span class="diff-mutation__action" class:action--create class:action--update class:action--delete>
            {actionIcon} {actionLabel}
          </span>
          <div class="diff-mutation__body">
            <p class="diff-mutation__summary">{mutation.summary}</p>
            {#each mutation.details as detail}
              <p class="diff-mutation__detail">{detail}</p>
            {/each}
          </div>
        </div>
      {/each}
    </div>
  {/each}

  <!-- Actions -->
  <div class="diff-card__actions">
    <button class="btn btn--confirm" on:click={onConfirm}>
      <CheckIcon /> Confirm
    </button>
    <button class="btn btn--cancel" on:click={onCancel}>
      <XIcon /> Cancel
    </button>
  </div>
</div>
```

### Domain Color Coding

| Domain | Badge color | Icon |
|--------|------------|------|
| THEME | Purple | `Palette` |
| PROFILE | Blue | `Building2` |
| PRAYER_RULES | Amber | `Clock` |
| JUMUAH | Green | `Users` |
| ANNOUNCEMENTS | Cyan | `Megaphone` |

### Action Icons

| Action | Icon | Color |
|--------|------|-------|
| CREATE | `+` (Plus) | Green |
| UPDATE | `~` (Pencil) | Blue |
| DELETE | `−` (Minus) | Red |
| PIN | `📌` (Pin) | Amber |
| REORDER | `↕` (ArrowUpDown) | Grey |

---

## 4. Bot Lifecycle (Web UI)

### 4.1 Session Initialization

On first message (or page load if an open branch exists):

```
User opens /admin/[slug]/bot
  → Fetch GET /admin/masjids/[id]/branches?status=OPEN
  → If open branch exists:
      → Use it (resume session)
      → Show existing mutations in a "Previous session" banner
  → If no open branch:
      → Create branch with prefix 'web-{YYYY-MM-DD}-{random4}'
      → POST /admin/masjids/[id]/branches  (new endpoint or reuse createBranch via proxy)
```

The branch prefix `web-` distinguishes web sessions from `whatsapp-` sessions in
the snapshots table.

### 4.2 Message → LLM → Tools → Diff Receipt → Confirm

```
User types message
  → Sent to client-side handler
  → Calls POST /admin/masjids/[id]/agent/chat { message, branch_id }
     (new admin endpoint that wraps @masjid/agent's runAgent())
  → Server runs LLM agent, executes tool calls, stores mutations
  → Returns { text_response, diff_data, mutation_count }
  → Client renders DiffReceiptCard with Confirm/Cancel buttons
  → User clicks Confirm
     → POST /admin/masjids/[id]/agent/confirm { branch_id }
     → Server calls mergeBranch(), creates snapshot
     → Returns { success, snapshot_id }
     → Client shows BotConfirmMessage
  → User clicks Cancel
     → POST /admin/masjids/[id]/agent/cancel { branch_id }
     → Server calls abandonBranch()
     → Returns { success }
     → Client shows "Session cancelled" message
```

### 4.3 Multiple Rounds

The user can continue sending messages in the same session. Each round adds
mutations to the same branch. The `DiffReceiptCard` shows all accumulated mutations,
not just the latest batch. When the user is satisfied, they click Confirm.

### 4.4 Auto-Timeout

Same as WhatsApp: branches auto-abandon after `BRANCH_TIMEOUT_HOURS` (2 hours) +
`BRANCH_GRACE_MINUTES` (30 minutes). The SessionBar shows a countdown when the
branch enters the grace period:

```
Session: web-2026-07-22-a3f2  ·  5 changes  ·  ⏰ Expires in 12m
```

---

## 5. File Upload (Vision)

### Upload Flow

1. User drags an image onto the chat area, or clicks the paperclip icon and
   selects a file.
2. The image appears as a user message (thumbnail, 200px wide, with mask overlay
   showing "Analyzing...").
3. Client sends the image to a new endpoint:
   `POST /admin/masjids/[id]/agent/vision { image_data_uri, branch_id }`
4. Server calls `@masjid/agent`'s `runVisionAgent()`, which:
   - Calls vision LLM with the image
   - LLM extracts prayer times and creates rules via tool calls
   - Returns `{ text_response, diff_data }`
5. Client renders the diff receipt with confirm/cancel (same as text chat).

### Supported Formats
- PNG, JPEG, WebP
- Max 10 MB (enforced client-side and server-side)

### Upload UI

```
┌──────────────────────────────────────────┐
│                                          │
│    [user]  📷 timetable-2026.jpg         │
│           ┌────────────────────┐         │
│           │                    │         │
│           │  [image preview]   │         │
│           │                    │         │
│           │  🔍 Analyzing...   │         │
│           └────────────────────┘         │
│                                          │
│    [bot]   Extracted 15 prayer rules     │
│           from the timetable.            │
│           ┌─────────────────────────┐    │
│           │ ✨ 15 changes applied    │    │
│           │ PRAYER_RULES             │    │
│           │ + Fajr: 4:45 AM ...      │    │
│           │ + Dhuhr: 1:30 PM ...     │    │
│           │ ...                      │    │
│           │  [✓ Confirm] [✕ Cancel]  │    │
│           └─────────────────────────┘    │
└──────────────────────────────────────────┘
```

---

## 6. Server-Sent Events (SSE) for Streaming

Since LLM calls take 2-10 seconds, the bot should stream responses.

### Architecture

1. Client sends `POST /admin/masjids/[id]/agent/chat` with `Accept: text/event-stream`
2. Server runs the agent loop and emits SSE events:
   ```
   event: status
   data: {"type": "thinking"}

   event: status
   data: {"type": "tool_call", "name": "prayer_rules_list"}

   event: status
   data: {"type": "tool_call", "name": "prayer_rules_create", "args": {"prayer_name": "dhuhr", ...}}

   ...

   event: result
   data: {"text": "Here's what I've done...", "diff_data": {...}}

   event: done
   data: {}
   ```
3. Client uses `EventSource` or `fetch()` with `ReadableStream` to process events.
4. UI shows incremental progress: "Checking current rules..." → "Creating rule..." →
   "Done."

### Fallback (no SSE)

If the server doesn't support SSE (e.g., behind a proxy that buffers), fall back
to the standard request-response pattern. The UI shows a "Thinking..." indicator
for the full duration.

### Polling Alternative

If SSE is difficult to implement in the static SPA context, polling is acceptable:
1. `POST /chat` returns immediately with a `job_id`
2. `GET /chat/{job_id}/status` returns `{ status: "thinking" | "running" | "done", progress: {...} }`
3. Client polls every 1 second until status is "done"

The initial implementation can just be request-response with a loading indicator.
SSE is a nice-to-have upgrade.

---

## 7. Features Checklist

### Core (Phase 4 implementation)

- [x] Chat UI with message list + input
- [x] `DiffReceiptCard` rendering mutation diffs
- [x] Branch auto-creation on first message (prefix `web-`)
- [x] Multi-round conversations (accumulated mutations)
- [x] Confirm / Cancel via UI buttons (not `/commands`)
- [x] Vision file upload with drag-and-drop
- [x] Session bar showing branch name + mutation count
- [x] Auto-timeout warning in grace period
- [x] Default "help" response when LLM not configured

### Nice-to-Have (Phase 5)

- [ ] SSE streaming responses
- [ ] Conversation history (load past sessions)
- [ ] "Undo last change" button in DiffReceiptCard (undo a single mutation)
- [ ] `/` slash command auto-complete (`/confirm`, `/cancel`, `/status`, `/help`)
- [ ] Markdown rendering in bot text messages (bold, italic, links)
- [ ] Code block rendering in messages
- [ ] Keyboard shortcuts (Enter to send, Shift+Enter for newline, Ctrl+K for commands)

---

## 8. API Endpoints (New)

These are additional endpoints the admin app needs that don't currently exist.
They all live under `/api/v1/admin/masjids/[id]/`.

### 8.1 Agent Chat

```
POST /api/v1/admin/masjids/[id]/agent/chat
Body: { message: string, branch_id?: string }
Response: {
  text_response: string,
  diff_data: DiffData | null,
  mutation_count: number,
  branch: { id, name, status }
}
```

### 8.2 Agent Vision

```
POST /api/v1/admin/masjids/[id]/agent/vision
Body: { image_data_uri: string, branch_id?: string }
Response: same as agent/chat
```

### 8.3 Agent Confirm

```
POST /api/v1/admin/masjids/[id]/agent/confirm
Body: { branch_id: string }
Response: { success: true, snapshot_id: string }
```

### 8.4 Agent Cancel

```
POST /api/v1/admin/masjids/[id]/agent/cancel
Body: { branch_id: string }
Response: { success: true }
```

### 8.5 List Branches

```
GET /api/v1/admin/masjids/[id]/branches?status=OPEN
Response: [{ id, branch_name, status, mutation_count, created_at, updated_at }]
```

### 8.6 List Snapshots (enriched)

```
GET /api/v1/admin/masjids/[id]/snapshots?limit=20
Response: [{
  id, summary, mutation_count, created_at,
  source: 'whatsapp' | 'web',
  auto: boolean,
  domains_affected: string[],
  mutations_preview: FormattedMutation[]  // top 5, for expandable row
}]
```

---

## 9. Error States

| Scenario | UI |
|----------|-----|
| LLM not configured (no API key) | System message: "AI assistant is not configured. Add LLM_API_KEY to enable." Chat input is still visible but disabled. |
| LLM returns error | BotErrorMessage: "I encountered an error. [Retry]" — retry resends the last user message. |
| LLM returns no tool calls + no text | System message: "I couldn't determine what changes to make. Try rephrasing." |
| LLM returns tool calls but all fail | DiffReceiptCard with error section: "2 changes failed: ..." + Cancel button. |
| Server returns 500 | BotErrorMessage with retry. |
| Network timeout | BotErrorMessage: "Request timed out. The server may still be processing your changes. Check Dashboard for active sessions." |
| User navigates away while bot is thinking | The session remains open. On return, the page loads existing mutations and shows them in the chat. |
| User has two tabs open with same session | Both tabs see the same branch. Mutations from either tab accumulate. Confirm in either tab merges the branch. |

---

## 10. Integration with `@masjid/agent`

The admin UI does **not** call `@masjid/agent` directly from the browser. It calls
the admin API (`/api/v1/admin/masjids/[id]/agent/*`), which internally imports and
calls `@masjid/agent`. This keeps the LLM API key server-side and avoids exposing it.

### Server-Side Flow (in admin API route handler)

```ts
// apps/api/src/routes/api/v1/admin/masjids/[id]/agent/chat/+server.ts
import { runAgent } from '@masjid/agent';

export async function POST({ params, request, locals, platform }) {
  const { message, branch_id } = await request.json();

  // Resolve or create branch
  let branch = await getOpenBranch(locals.admin.id, params.id, platform.env.DB);
  if (!branch) {
    branch = await createBranch(locals.admin.id, params.id, platform.env.DB, 'web');
  }

  const botCtx: BotContext = {
    adminId: locals.admin.id,
    masjidId: params.id,
    branchId: branch.id,
    db: platform.env.DB,
    apiUrl: '', // internal, not needed
    jwtSecret: platform.env.JWT_SECRET,
    llmApiKey: platform.env.LLM_API_KEY,
    llmApiUrl: platform.env.LLM_API_URL,
    llmModel: platform.env.LLM_MODEL,
  };

  const response = await runAgent(message, adminRecord, branch.id, botCtx);

  const diffData = await getDiffData(branch.id, platform.env.DB);
  const mutationCount = await getMutationCount(branch.id, platform.env.DB);

  return json({
    text_response: response,
    diff_data: diffData,
    mutation_count: mutationCount,
    branch: { id: branch.id, name: branch.name, status: branch.status },
  });
}
```

### No Client-Side LLM Calls

The `BotChat` component never calls an LLM API directly. It only calls
`/api/v1/admin/masjids/[id]/agent/*` endpoints. This means:
- The LLM API key stays server-side.
- Multiple masjids can share one LLM key (the API route adds the masjid-specific
  system prompt).
- Admin users can't exhaust the LLM rate limit through client-side abuse.

---

## 11. Agent Capabilities & Limitations

This section documents what the AI agent can and cannot do, mapped against the
manual admin settings UI. It is the **canonical reference** for agent scope.

### 11.1 Available Agent Tools (32 total)

| Domain | Tools | Description |
|--------|-------|-------------|
| THEME | `theme_get`, `theme_update` | Colors (6-digit hex), fonts, time format (12h/24h), and 10 prayer/session labels |
| PROFILE | `profile_get`, `profile_update` | Name, address, contact info, social links, donation URL, about markdown |
| PRAYER_CONFIG | `prayer_config_get`, `prayer_config_update` | Calculation method (1–13), asr_madhab, high_latitude_rule, timezone, dual-Asr, angle/manual offsets |
| PRAYER_RULES | `prayer_rules_{list,create,update,delete,reorder}` | Iqaamah timing rules with 8 condition types and 9 action types |
| JUMUAH | `jumuah_{list,create,update,delete}` | Friday session label, time, khateeb, location, speech_time, is_active |
| ANNOUNCEMENTS | `announcements_{list,create,update,delete,pin}` | Content with markdown, status (draft/published/archived), pin, expiry |
| POSTS | `posts_{list,create,update,delete,pin_homepage,pin_info}` | Rich permanent content, homepage/Info page pins, hidden toggle |
| DIAGNOSTICS | `timetable_preview`, `rules_explain`, `rules_validate` | Dry-run preview, rule traces per-prayer, rule-set validation |
| ROLLBACK | `rollback_list_snapshots`, `rollback_restore` | Point-in-time snapshot restore |
| TIMETABLE | `timetable_import` | Batch import rules from vision-extracted timetables (atomic) |

### 11.2 What the Agent CAN Do (Agent + Manual UI parity)

| Setting domain | Agent | Manual UI | Notes |
|---------------|:-----:|:---------:|-------|
| Theme colors, fonts, labels, time format | ✓ | ✓ | Agent also knows transliteration presets (Indo-Pak, Arabic, Turkish, Malay, Bosnian) |
| Layout preset (Mishkaat / Sakeenah) | ✓ | ✓ | Values: `mishkaat` or `minimal-light` |
| Masjid profile (name, address, contact) | ✓ | ✓ | |
| Social media links | ✓ | ✓ | Facebook, YouTube, Instagram, website |
| Geographic coordinates (lat/lng) | ✓ | ✓ | |
| Donation links (JSON array of {label, url}) | ✓ | ✓ | |
| Show donate QR card | ✓ | ✓ | |
| About markdown | ✓ | ✓ | |
| Prayer calculation method (1–13) | ✓ | ✓ | Both support all 13 methods |
| Asr madhab (shafi/hanafi) | ✓ | ✓ | |
| High latitude rule | ✓ | ✓ | |
| Dual Asr display | ✓ | ✓ | |
| Fajr/Isha custom angles | ✓ | ✓ | |
| Manual prayer offsets (7 prayers) | ✓ | ✓ | Fajr, Sunrise, Dhuhr, Asr, Maghrib, Isha |
| Prayer rules CRUD | ✓ | ✓ | |
| Jumu'ah sessions CRUD | ✓ | ✓ | |
| Announcements CRUD + pin | ✓ | ✓ | |
| Posts CRUD + pin | ✓ | ✓ | |
| Snapshots and rollback | ✓ | ✓ | |
| Dry-run timetable preview | ✓ | ✓ | |
| Rule traces (`rules_explain`) | ✓ | — | Agent-only diagnostic |
| Rule validation (`rules_validate`) | ✓ | — | Agent-only diagnostic |
| Timetable bulk import | ✓ | — | Agent-only (vision extraction) |
| Maktab settings & program info | ✓ | ✓ | Enrollment controls, program info (goal, schedule, curriculum, FAQs) |
| Maktab term activation | ✓ | ✓ | Activate existing terms (term creation with Square plans is UI-only) |

### 11.3 What the Agent CANNOT Do (Manual UI Only)

These settings are **not available** through the AI agent. Admins must use the
manual settings pages.

| Setting | Why not available |
|---------|-------------------|
| **Navigation items** (add/remove/reorder links, desktop/mobile visibility, highlight) | No navigation tools exist in `@masjid/agent` |
| **Custom domains** (add/delete domain, SSL status) | Security-sensitive; DNS + SSL management out of scope |
| **Account password** (change password) | Security boundary — agent should never handle credentials |
| **Maktab term creation** (Square plan creation) | Payment integration; terms must be created in the admin UI |
| **Maktab registrations** (student list) | Read-only PII; view in the admin UI |
| **Style options** (`style_system`, `style_options` JSON: metal, motif, arch, ambient phases, frames, emblem) | These are advanced visual options not yet exposed in any interface (UI or agent) |

### 11.4 Condition & Action Types for Prayer Rules

The agent's `prayer_rules_create` tool accepts these types. Both the system prompt
and the tool JSON schema agree on the full set:

**Condition types** (`conditions_json` array; multiple are ANDed):
- `always` — always applies
- `day_of_week` — `{"days":[0-6]}` (0=Sun)
- `month` — `{"months":[1-12]}` Gregorian
- `month_day_range` — `{"start_month":N,"start_day":N,"end_month":N,"end_day":N}` (wraps across years)
- `hijri_month` — `{"months":[1-12]}` (9=Ramadan)
- `hijri_day_range` — `{"month":N,"start_day":N,"end_day":N}`
- `date_range` — `{"start":"YYYY-MM-DD","end":"YYYY-MM-DD"}`
- `time_of_day` — `{"operator":"before|after","threshold":"HH:MM"}`

**Action types** (`action_json` object; exactly one):
- `add_minutes` — `{"minutes":N}` add N minutes after adhaan
- `set_fixed_time` — `{"time":"HH:MM"}` exact clock time
- `set_offset_from_prayer` — `{"prayer":"name","from":"adhaan|iqaamah|sunrise","minutes":N}`
- `round_up` / `round_down` / `round_nearest` — `{"increment":N}` (N ∈ {1,5,10,15,20,30,60})
- `cap_min` / `cap_max` — `{"time":"HH:MM"}` floor/ceiling
- `right_after_adhaan` — iqaamah immediately after adhaan

### 11.5 Calculation Methods Reference

The agent supports all 13 calculation methods. The manual UI only lists 1–7.

| # | Method | asr_madhab |
|---|--------|-----------|
| 1 | Shia Ithna-Ashari | — |
| 2 | ISNA (North America) | Shafi |
| 3 | Muslim World League | Shafi |
| 4 | Umm al-Qura (Makkah) | Shafi |
| 5 | Egyptian General Authority | Shafi |
| 6 | University of Tehran | Shafi |
| 7 | University of Karachi | Hanafi |
| 8 | Turkey (Diyanet) | — |
| 9 | Singapore (MUIS) | — |
| 10 | Dubai | — |
| 11 | Kuwait | — |
| 12 | Qatar | — |
| 13 | Moonsighting Committee | — |

### 11.6 Transliteration Presets

The agent knows these language presets for customizing prayer/session labels.
Tell the agent "use Turkish/Arabic/Indo-Pak labels" and it will set all 10 labels.

| Label | Indo-Pak | Arabic | Turkish | Malay | Bosnian |
|-------|----------|--------|---------|-------|---------|
| Adhaan | Azaan | Adhan | Ezan | Azan | Ezan |
| Iqaamah | Iqamah | Iqama | Kamet | Iqamat | Ikamet |
| Dhuhr | Zuhr | Dhuhr | Öğle | Zohor | Podne |
| Jumu'ah | Jummah | Jumu'ah | Cuma | Jumaat | Džuma |
| Speech | Bayaan | Khutbah | Hutbe | Khutbah | Hutba |
| Sunrise | Sunrise | Sunrise | Güneş | Sunrise | Sunrise |
| Fajr | Fajr | Fajr | Sabah | Fajr | Fajr |
| Asr | Asr | Asr | İkindi | Asar | Ikindija |
| Maghrib | Maghrib | Maghrib | Akşam | Maghrib | Akšam |
| Isha | Isha | Isha | Yatsı | Isha | Jacija |