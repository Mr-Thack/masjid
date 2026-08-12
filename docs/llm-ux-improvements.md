# LLM / Bot UX Improvements: Prayer Rules

**Status: IMPLEMENTED** — `rules_explain`, `rules_validate`, `timetable_import` tools shipped; `formatZodError` in `@masjid/schemas`; vision prompt improvements applied. This doc is the original spec — see `packages/agent/src/tools.ts` and `packages/agent/src/rules-engine.ts` for implementations.

## Summary

The agent (used by both WhatsApp bot and admin chat panel) can create, read, update, delete, and reorder prayer rules. These improvements make the LLM more effective at understanding masjid schedules, explaining its reasoning, and self-correcting errors.

---

## 1. `rules_explain` Tool

**Why**: When an admin asks "Why is Dhuhr iqaamah at 1:30 PM today?", the LLM currently has to manually trace through rules. A dedicated explain tool gives a structured trace that the LLM can format as natural language.

**Tool definition**:

```typescript
{
  name: 'rules_explain',
  description: `Explain which prayer rules fired (or didn't) for a given date, producing a human-readable trace of the rule chain for each prayer. Useful when an admin asks why a specific iqaamah time is what it is.`,
  parameters: {
    type: 'object',
    properties: {
      date: { type: 'string', description: 'Date to explain (YYYY-MM-DD). Defaults to today.' },
      prayer: { type: 'string', enum: ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'], description: 'Optional: explain only one prayer. If omitted, explains all five.' },
    },
    required: [],
  },
}
```

**Handler behavior**:
1. Calls the dry-run endpoint for the given date (no overrides — uses current rules)
2. For each prayer, loads the rules and replays them client-side (in the agent, not the API) to get a trace
3. Returns structured trace:

```json
{
  "date": "2026-08-05",
  "hijri_date": { "month": 1, "day": 21, "year": 1448 },
  "prayers": {
    "fajr": {
      "adhaan": "04:23",
      "iqaamah": "04:43",
      "trace": [
        {
          "order": 1,
          "rule_name": "Fajr default offset",
          "matched": true,
          "conditions": [{ "type": "always", "result": true }],
          "action": { "type": "add_minutes", "minutes": 20 },
          "time_before": "04:23",
          "time_after": "04:43"
        }
      ]
    },
    "dhuhr": {
      "adhaan": "12:56",
      "iqaamah": "13:10",
      "trace": [
        {
          "order": 1,
          "rule_name": "Friday override",
          "matched": false,
          "conditions": [{ "type": "day_of_week", "days": [5], "result": false, "reason": "Today is Wednesday (day 3), not Friday (day 5)" }],
          "action": { "type": "set_fixed_time", "time": "13:30" },
          "skipped": true
        },
        {
          "order": 2,
          "rule_name": "Default offset",
          "matched": true,
          "conditions": [{ "type": "always", "result": true }],
          "action": { "type": "add_minutes", "minutes": 10 },
          "time_before": "12:56",
          "time_after": "13:06"
        },
        {
          "order": 3,
          "rule_name": "Round up",
          "matched": true,
          "conditions": [{ "type": "always", "result": true }],
          "action": { "type": "round_up", "increment": 5 },
          "time_before": "13:06",
          "time_after": "13:10"
        }
      ]
    }
  }
}
```

**LLM usage**: The LLM reads this trace and produces a natural-language response:

> "Today (Wednesday), Dhuhr iqaamah is at 1:10 PM. Here's why:
> 1. The Friday override rule was skipped because today is Wednesday, not Friday.
> 2. The default offset added 10 minutes to the adhaan (12:56 → 1:06 PM).
> 3. The rounding rule brought it to the nearest 5 minutes (1:10 PM)."

The `reason` field in each condition's result is key — it gives the LLM the exact language to explain WHY a rule matched or didn't match.

---

## 2. `rules_validate` Tool

**Why**: Admins (and the LLM itself) can create rule sets with subtle issues: orphaned rules, contradictory conditions, missing prayers. A validation tool catches these before they cause confusion.

**Tool definition**:

```typescript
{
  name: 'rules_validate',
  description: `Validate the current prayer rule set for common issues. Returns warnings about dead rules, conflicting rules, missing prayer coverage, and other potential problems. Read-only — does not modify anything.`,
  parameters: {
    type: 'object',
    properties: {},
    required: [],
  },
}
```

**Handler behavior**:
1. Fetches all current rules via `prayer_rules_list`
2. Runs validation checks and returns structured findings:

```json
{
  "valid": true,
  "warnings": [
    {
      "severity": "warn",
      "prayer": "dhuhr",
      "rule_ids": ["rule-1", "rule-2"],
      "message": "Rule 'Friday override' (order 2) always overrides the result of 'Default offset' (order 1) on Fridays. Consider removing order 1's action or adding a condition so it only runs when Friday override doesn't match."
    },
    {
      "severity": "info",
      "prayer": "isha",
      "message": "No rules defined for Isha. Iqaamah will equal adhaan time."
    }
  ],
  "suggestions": [
    "Add a default rule for Isha (e.g., add_minutes: 10) to create a gap between adhaan and iqaamah."
  ]
}
```

**Validation checks**:

| Check | Severity | Description |
|---|---|---|
| Unconditional override waste | `warn` | Rule at order N has `always` condition and `set_fixed_time`. Rule at order N+1+ also has `always` condition. Rule N's result is immediately overwritten — dead code. |
| No rules for prayer | `info` | A prayer has zero rules. Iqaamah = adhaan. |
| `right_after_adhaan` followed by offset | `warn` | `right_after_adhaan` sets a flag, then `add_minutes` adds time. The flag is still set but the time moved — may confuse TV ceremony logic. |
| Unsorted execution_order | `info` | Rule order numbers don't match their position in the sorted list (gaps or non-sequential). Not an error — gaps are valid. But worth noting. |
| Duplicate rule names | `info` | Two rules share the same `rule_name`. |
| `date_range` expired | `info` | A `date_range` condition's `end` date is in the past. Rule will never match again. |

**LLM usage**: After creating rules (e.g., from a vision-parsed timetable), the LLM calls `rules_validate` to check its work. If warnings are found, the LLM can:
- Explain the warnings to the admin
- Offer to fix them (e.g., "Should I remove the unused default offset rule?")
- Self-correct during the creation loop

---

## 3. `timetable_import` Tool

**Why**: The vision agent currently creates rules one at a time through multiple `prayer_rules_create` calls. This is error-prone: if call 3 of 5 fails, you have a half-complete rule set. A single atomic import tool is cleaner and gives the LLM the result in one response.

**Tool definition**:

```typescript
{
  name: 'timetable_import',
  description: `Import a complete prayer timetable as a set of rules. Accepts a structured timetable object (prayer names, times, date ranges, and conditions) and creates all rules in one atomic operation. Use this after extracting times from a timetable photo or when an admin provides a full schedule.`,
  parameters: {
    type: 'object',
    properties: {
      rules: {
        type: 'array',
        description: 'Array of rule objects to create. Each rule follows the same shape as prayer_rules_create (prayer_name, rule_name, execution_order, conditions_json, action_json). Rules are created in array order with auto-incrementing execution_order per prayer.',
        items: {
          type: 'object',
          properties: {
            prayer_name: { type: 'string', enum: ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'] },
            rule_name: { type: 'string' },
            conditions_json: { type: 'array' },
            action_json: { type: 'object' },
          },
          required: ['prayer_name', 'rule_name', 'conditions_json', 'action_json'],
        },
      },
      replace_existing: {
        type: 'boolean',
        description: 'If true, delete ALL existing prayer rules before importing. If false (default), append new rules with execution_order after existing ones.',
      },
    },
    required: ['rules'],
  },
}
```

**Handler behavior**:
1. If `replace_existing: true`: delete all existing prayer rules for the masjid
2. Group rules by `prayer_name`
3. For each prayer group, assign sequential `execution_order` starting from 0 (or from max existing + 1 if appending)
4. Create all rules in a single batch operation
5. Return `{ created: N, deleted: M, rules: [...] }`

**Error handling**: If any rule creation fails, the entire batch is rolled back (atomic). This prevents the half-complete state problem.

**LLM usage**: The vision agent calls this after parsing a timetable photo instead of looping through individual `prayer_rules_create` calls. The admin chat panel can also use it when an admin pastes a schedule in text form.

---

## 4. Better Validation Error Messages from API

**Why**: When the LLM sends a malformed rule (wrong increment, bad date format), the Zod validation error is technical:

```
{"error":{"issues":[{"code":"custom","path":["action_json","increment"],"message":"increment must be one of: 1, 5, 10, 15, 20, 30, 60"}]}}
```

The LLM can parse this but it's brittle. Human-readable messages would improve reliability.

**Solution**: Add an error formatting layer in the API that converts Zod issues to plain-English messages:

```json
{
  "error": {
    "message": "Invalid action: rounding increment must be one of 1, 5, 10, 15, 20, 30, or 60. You provided: 7.",
    "field": "action_json.increment",
    "provided": 7,
    "allowed": [1, 5, 10, 15, 20, 30, 60]
  }
}
```

**Implementation**: A shared `formatZodError(zodError)` utility in `@masjid/schemas` or `@masjid/ui-utils` that both the API and the agent can use. The agent's tool handler wraps API errors with this formatter before returning them to the LLM.

**Format per field**:

| Field | Example message |
|---|---|
| `prayer_name` | "Invalid prayer name 'zohar'. Must be one of: fajr, dhuhr, asr, maghrib, isha." |
| `conditions_json[].type` | "Unknown condition type 'weekday'. Must be one of: always, day_of_week, month, hijri_month, date_range, time_of_day, hijri_day_range, month_day_range." |
| `action_json.type` | "Unknown action type 'delay'. Must be one of: add_minutes, round_up, round_down, round_nearest, set_fixed_time, right_after_adhaan, set_offset_from_prayer, cap_min, cap_max." |
| `action_json.minutes` | "add_minutes requires a positive whole number. You provided: -5." |
| `action_json.increment` | "Rounding increment must be one of 1, 5, 10, 15, 20, 30, or 60. You provided: 7." |
| `action_json.time` | "Invalid time format '1:30'. Use HH:MM 24-hour format (e.g., 13:30)." |
| `day_of_week.days` | "Day of week values must be between 0 (Sunday) and 6 (Saturday). You provided: 7." |
| `month.months` | "Month values must be between 1 (January) and 12 (December). You provided: 13." |
| `date_range.start` | "Invalid date format 'Aug 5'. Use YYYY-MM-DD format (e.g., 2026-08-05)." |

---

## 5. Vision Prompt Improvements

**Why**: The vision agent extracts prayer times from timetable photos. The current prompt is good but could be more systematic — have the LLM first *describe* what it sees before creating rules.

**Prompt additions**:

1. **Two-phase approach**: The vision prompt should instruct the LLM to:
   - Phase 1: Describe the timetable structure (column headers, date ranges, any footnotes or special notes like "Jumu'ah" or "Ramadan times")
   - Phase 2: Create the rules
   - The LLM outputs the description first, then calls tools. The admin can see the description in the chat and confirm understanding before rules are created.

2. **OCR error awareness**: Add a note about common OCR mistakes in timetable photos:
   ```
   Common OCR errors to watch for:
   - '1' (one) vs 'I' (capital i) vs 'l' (lowercase L) in time columns
   - '0' (zero) vs 'O' (capital o) vs '8'
   - '5' vs 'S' vs '6'
   - ':' (colon) vs '.' (period) in time separators
   If a time looks suspicious (e.g., "1:3O PM"), ask the user to confirm before creating rules.
   ```

3. **Jumu'ah detection**: Explicitly call out:
   ```
   Look for columns/lines labeled "Jumu'ah", "Friday", "جمعة", or "Khutbah".
   These are NOT regular Dhuhr times — create a day_of_week[5] rule with set_fixed_time.
   If there are multiple Jumu'ah sessions (e.g., English + Arabic), create Jumu'ah sessions
   AND a Dhuhr rule that applies when NOT Friday.
   ```

4. **Date range vs month detection**:
   ```
   If the timetable has columns labeled by month (e.g., "Jan", "Feb") → use month conditions.
   If the timetable has columns labeled by date range (e.g., "Nov 1 – Mar 31") → use month_day_range conditions.
   If the timetable has columns labeled by Islamic months (e.g., "Ramadan") → use hijri_month conditions.
   ```

---

## 6. System Prompt: New Condition/Action Types

Update `DOMAIN_GUIDE` in `packages/agent/src/prompt.ts` to document the new types added in `docs/new-rules-spec.md`:

```
### PRAYER_RULES (updated)

Condition types (conditions_json array, at least one):
  - {"type":"always"} — always applies
  - {"type":"day_of_week","days":[0-6]} — specific days (0=Sun, 5=Fri)
  - {"type":"month","months":[1-12]} — Gregorian months
  - {"type":"month_day_range","start_month":N,"start_day":N,"end_month":N,"end_day":N} — recurring annual range (year-less)
  - {"type":"hijri_month","months":[1-12]} — Hijri months (9=Ramadan)
  - {"type":"hijri_day_range","month":N,"start_day":N,"end_day":N} — day range within a Hijri month
  - {"type":"date_range","start":"YYYY-MM-DD","end":"YYYY-MM-DD"} — specific date range
  - {"type":"time_of_day","operator":"before|after","threshold":"HH:MM"} — match based on current adhaan time

Action types (action_json object, exactly one):
  - {"type":"add_minutes","minutes":N} — add N minutes after adhaan
  - {"type":"set_fixed_time","time":"HH:MM"} — set exact clock time
  - {"type":"set_offset_from_prayer","prayer":"name","from":"adhaan|iqaamah|sunrise","minutes":N} — set relative to another prayer
  - {"type":"round_up","increment":N} / round_down / round_nearest
  - {"type":"cap_min","time":"HH:MM"} / cap_max — floor/ceiling constraints
  - {"type":"right_after_adhaan"} — iqaamah immediately after adhaan

Multiple conditions are ANDed. Use separate rules for OR.
Round increment must be: 1, 5, 10, 15, 20, 30, or 60.
Higher execution_order runs later. Use lower numbers for overrides (Friday, Ramadan), higher for defaults.

[Existing examples updated to use new types where appropriate]
```

---

## Implementation Order

| Step | What | Dependency |
|---|---|---|
| 1 | `formatZodError` utility in `@masjid/ui-utils` | None |
| 2 | Wire formatted errors into API prayer rules endpoints | Step 1 |
| 3 | `rules_explain` tool in `@masjid/agent` | dry-run endpoint exists |
| 4 | `rules_validate` tool in `@masjid/agent` | None (read-only, uses list endpoint) |
| 5 | `timetable_import` tool in `@masjid/agent` | Batch create support in API or client-side loop |
| 6 | Update agent system prompt with new types | New rules spec implemented |
| 7 | Update vision prompt (two-phase, OCR tips, Jumu'ah detection) | None |
| 8 | Agent tool descriptions updated for new condition/action types | New rules spec implemented |