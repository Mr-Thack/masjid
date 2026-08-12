# Rule Engine: New Conditions & Actions

**Status: SHIPPED (2026-08)** — all conditions, actions, and the `enabled` column are implemented. See `docs/rules-engine.md` for the complete reference.

## Summary

Two new conditions and two new action types + a rule toggle column. All backwards-compatible (no existing rules break).

---

## New Conditions

### 1. `time_of_day`

**Why**: The engine can condition on *what date it is* but not *what time the adhaan itself falls at*. This is the #1 real-world gap — summer/winter iqaamah offsets differ because the adhaan time shifts with the seasons.

**Schema**:

```json
{ "type": "time_of_day", "operator": "before", "threshold": "12:30" }
```

| Field | Type | Description |
|---|---|---|
| `operator` | `"before"` \| `"after"` | Comparison direction |
| `threshold` | `"HH:MM"` (24h) | The boundary time |

**Behavior**:
- Compares the **current running time** (the time value at this point in the rule chain) against `threshold`
- `before`: matches when running time < threshold
- `after`: matches when running time >= threshold
- Time wraps across midnight correctly: `after "23:00"` matches 23:30 but not 01:00; `before "02:00"` matches 01:00 but not 22:00

**Example**: "If Dhuhr adhaan is before 12:30, add 15 min; otherwise add 5 min"

| Order | conditions_json | action_json |
|---|---|---|
| 1 | `[{"type":"time_of_day","operator":"before","threshold":"12:30"}]` | `{"type":"add_minutes","minutes":15}` |
| 2 | `[{"type":"always"}]` | `{"type":"add_minutes","minutes":5}` |

**Combines with other conditions**: `time_of_day` ANDs with other conditions in the same rule like any other condition. E.g., `[{"type":"day_of_week","days":[5]}, {"type":"time_of_day","operator":"before","threshold":"12:30"}]` = "only on Fridays AND only when adhaan is before 12:30."

---

### 2. `hijri_day_range`

**Why**: `hijri_month` is too coarse. Real masjids change schedules mid-month: last 10 nights of Ramadan, first 10 days of Dhu al-Hijjah, day of Arafah, days of Eid.

**Schema**:

```json
{ "type": "hijri_day_range", "month": 9, "start_day": 21, "end_day": 30 }
```

| Field | Type | Description |
|---|---|---|
| `month` | number (1-12) | Hijri month. 1=Muharram, 9=Ramadan, 12=Dhu al-Hijjah |
| `start_day` | number (1-30) | First day of the range (inclusive) |
| `end_day` | number (1-30) | Last day of the range (inclusive) |

**Behavior**: Matches when the current Hijri date falls within `[month/start_day, month/end_day]` inclusive. If `end_day < start_day`, wraps within the same month (not across months — use two rules for cross-month ranges).

**Examples**:

| Rule | Use case |
|---|---|
| `month:9, start_day:21, end_day:30` | Last 10 nights of Ramadan |
| `month:12, start_day:1, end_day:10` | First 10 days of Dhu al-Hijjah |
| `month:12, start_day:9, end_day:9` | Day of Arafah (single day) |
| `month:1, start_day:10, end_day:10` | Ashura |
| `month:10, start_day:1, end_day:3` | Eid al-Fitr |

---

### 3. `month_day_range` (yearless date range)

**Why**: `date_range` requires full `YYYY-MM-DD` dates — rules must be updated annually. Many schedules repeat every year on the same calendar dates.

**Schema**:

```json
{ "type": "month_day_range", "start_month": 11, "start_day": 1, "end_month": 3, "end_day": 31 }
```

| Field | Type | Description |
|---|---|---|
| `start_month` | number (1-12) | Start month |
| `start_day` | number (1-31) | Start day |
| `end_month` | number (1-12) | End month |
| `end_day` | number (1-31) | End day |

**Behavior**: Matches when the Gregorian date falls within `[start_month/start_day, end_month/end_day]` in ANY year. Handles year-wrapping: Nov 1 → Mar 31 is a valid range (it means "every winter").

**Example**: "Winter schedule (Nov 1 – Mar 31): add 15 min to Dhuhr"

| Order | conditions_json | action_json |
|---|---|---|
| 1 | `[{"type":"month_day_range","start_month":11,"start_day":1,"end_month":3,"end_day":31}]` | `{"type":"add_minutes","minutes":15}` |
| 2 | `[{"type":"always"}]` | `{"type":"add_minutes","minutes":5}` |

---

## New Actions

### 4. `set_offset_from_prayer`

**Why**: Cross-prayer references are the most common scheduling pattern the current engine cannot express. "Isha = Maghrib + 90 min" and "Fajr = sunrise - 30 min" are real-world defaults at many masjids.

**Schema**:

```json
{ "type": "set_offset_from_prayer", "prayer": "maghrib", "from": "adhaan", "minutes": 90 }
```

| Field | Type | Description |
|---|---|---|
| `prayer` | PrayerName | The reference prayer |
| `from` | `"adhaan"` \| `"iqaamah"` \| `"sunrise"` | Which time of the reference prayer to use |
| `minutes` | number (int, positive) | Minutes offset from the reference time |

**Behavior**: Sets the running time to `reference_time + minutes`. The reference time is the *computed* adhaan/iqaamah of the referenced prayer (after its own rules have run). This means prayer computation order matters: if Isha references Maghrib's iqaamah, Maghrib must be computed first. The engine already processes prayers in order (fajr → dhuhr → asr → maghrib → isha), so forward references (Isha→Maghrib) are fine, but backward references (Fajr→Dhuhr) need the engine to hold the earlier prayer's value. For now, **only forward references are supported** (a prayer can reference an earlier-computed prayer or sunrise).

The engine must track `computedTimes` during the loop so later prayers can read earlier ones.

**Special value `sunrise`**: `from: "sunrise"` references the computed sunrise time (which is not a "prayer" but is always computed). E.g., `{ "prayer": "fajr", "from": "sunrise", "minutes": -30 }` → Fajr iqaamah = sunrise - 30 min. The `minutes` field is still positive in the schema; the engine negates it for sunrise references.

**Examples**:

| Rule | What it does |
|---|---|
| `prayer: "maghrib", from: "adhaan", minutes: 90` | Isha iqaamah = Maghrib adhaan + 90 min |
| `prayer: "maghrib", from: "iqaamah", minutes: 75` | Isha iqaamah = Maghrib iqaamah + 75 min |
| `prayer: "fajr", from: "sunrise", minutes: 30` | Fajr iqaamah = sunrise - 30 min |
| `prayer: "dhuhr", from: "adhaan", minutes: 0` | Asr iqaamah = Dhuhr adhaan (equal) — edge case, valid |

---

### 5. `cap_min` and `cap_max`

**Why**: "No matter what the chain computes, never let iqaamah go before 1:00 PM or after 10:00 PM." Currently impossible without splitting into multiple rules with `time_of_day` conditions. Caps are constraints that apply at the end of the chain.

**Schema**:

```json
{ "type": "cap_min", "time": "13:00" }
{ "type": "cap_max", "time": "22:00" }
```

| Field | Type | Description |
|---|---|---|
| `time` | `"HH:MM"` (24h) | The boundary |

**Behavior**:
- `cap_min`: If running time < `time`, set it to `time`. Otherwise no-op.
- `cap_max`: If running time > `time`, set it to `time`. Otherwise no-op.
- Both respect midnight wrapping: `cap_max` of "02:00" applied to "01:00" is a no-op (01:00 < 02:00). Applied to "23:00" it would be tricky — for simplicity, caps don't wrap. A max of "02:00" means "not after 2 AM the same day."
- Typically placed as the **last rule** in a chain (after all offsets and rounding).

**Example**: "Dhuhr iqaamah = adhaan + 10 min, but never before 1:00 PM"

| Order | conditions_json | action_json |
|---|---|---|
| 1 | `[{"type":"always"}]` | `{"type":"add_minutes","minutes":10}` |
| 2 | `[{"type":"always"}]` | `{"type":"cap_min","time":"13:00"}` |

December: Adhaan 12:01 → +10 → 12:11 → cap_min(13:00) → 13:00
July: Adhaan 13:05 → +10 → 13:15 → cap_min(13:00) → 13:15 (no-op)

---

## Schema Change: `enabled` column

**New column on `prayer_rules`**:

```sql
ALTER TABLE prayer_rules ADD COLUMN enabled INTEGER NOT NULL DEFAULT 1;
```

| Column | Type | Default | Description |
|---|---|---|---|
| `enabled` | INTEGER (boolean) | 1 (true) | When 0, the rule is skipped during computation |

**Behavior in engine**: Before evaluating conditions, check `rule.enabled`. If `false`, skip the rule entirely (as if it doesn't exist). No cascade effects — the chain just omits that step.

**Admin UI**: A toggle switch per rule row. No delete confirmation needed to disable.

**API**: The `enabled` field is included in create/update payloads and returned in list responses. It's an optional field in `UpdatePrayerRuleSchema` (partial schema already handles optional).

---

## Zod Schema Changes

New condition variants to add to `ConditionSchema` discriminated union:

```typescript
// time_of_day
z.object({
  type: z.literal('time_of_day'),
  operator: z.enum(['before', 'after']),
  threshold: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
}),

// hijri_day_range
z.object({
  type: z.literal('hijri_day_range'),
  month: z.number().int().min(1).max(12),
  start_day: z.number().int().min(1).max(30),
  end_day: z.number().int().min(1).max(30),
}),

// month_day_range
z.object({
  type: z.literal('month_day_range'),
  start_month: z.number().int().min(1).max(12),
  start_day: z.number().int().min(1).max(31),
  end_month: z.number().int().min(1).max(12),
  end_day: z.number().int().min(1).max(31),
}),
```

New action variants to add to `ActionSchema`:

```typescript
// set_offset_from_prayer
z.object({
  type: z.literal('set_offset_from_prayer'),
  prayer: z.enum(['fajr', 'dhuhr', 'asr', 'maghrib', 'isha']),
  from: z.enum(['adhaan', 'iqaamah', 'sunrise']),
  minutes: z.number().int().positive(),
}),

// cap_min
z.object({
  type: z.literal('cap_min'),
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
}),

// cap_max
z.object({
  type: z.literal('cap_max'),
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
}),
```

---

## Engine Changes

### `allConditionsMatch` additions

```typescript
case 'time_of_day': {
  const [rh, rm] = runningTime.split(':').map(Number); // runningTime must be passed in
  const [th, tm] = condition.threshold.split(':').map(Number);
  const runningMinutes = rh * 60 + rm;
  const thresholdMinutes = th * 60 + tm;
  if (condition.operator === 'before') return runningMinutes < thresholdMinutes;
  return runningMinutes >= thresholdMinutes;
}
case 'hijri_day_range': {
  if (hijriDate.month !== condition.month) return false;
  return hijriDate.day >= condition.start_day && hijriDate.day <= condition.end_day;
}
case 'month_day_range': {
  const m = gregorianDate.getUTCMonth() + 1;
  const d = gregorianDate.getUTCDate();
  const start = condition.start_month * 100 + condition.start_day;
  const end = condition.end_month * 100 + condition.end_day;
  const current = m * 100 + d;
  if (start <= end) return current >= start && current <= end;
  // year-wrapping range (e.g., Nov 1 → Mar 31)
  return current >= start || current <= end;
}
```

**Note**: `time_of_day` needs access to the **current running time** (the intermediate value mid-chain). Currently `allConditionsMatch` only receives dates. This means the function signature changes:

```
allConditionsMatch(conditions, gregorianDate, hijriDate)  // before
allConditionsMatch(conditions, gregorianDate, hijriDate, runningTime)  // after
```

`runningTime` is optional — only `time_of_day` conditions use it. Backwards compatible: existing condition types ignore it.

### `applyAction` additions

```typescript
case 'set_offset_from_prayer': {
  // computedTimes is the full object built so far (fajr, sunrise, dhuhr, ...)
  // Must check that the referenced prayer has already been computed
  let refTime: string;
  if (action.from === 'sunrise') {
    refTime = computedTimes.sunrise;
  } else {
    const refPrayer = computedTimes[action.prayer];
    if (!refPrayer) throw new Error(`Cannot reference ${action.prayer} before it is computed`);
    refTime = action.from === 'adhaan' ? refPrayer.adhaan : refPrayer.iqaamah;
  }
  const [h, m] = refTime.split(':').map(Number);
  let total = h * 60 + m;
  if (action.from === 'sunrise') {
    total -= action.minutes; // sunrise references subtract
  } else {
    total += action.minutes;
  }
  return formatTime(total);
}
case 'cap_min': {
  const [ch, cm] = time.split(':').map(Number);
  const [th, tm] = action.time.split(':').map(Number);
  const currentMinutes = ch * 60 + cm;
  const capMinutes = th * 60 + tm;
  if (currentMinutes < capMinutes) return action.time;
  return time;
}
case 'cap_max': {
  const [ch, cm] = time.split(':').map(Number);
  const [th, tm] = action.time.split(':').map(Number);
  const currentMinutes = ch * 60 + cm;
  const capMinutes = th * 60 + tm;
  if (currentMinutes > capMinutes) return action.time;
  return time;
}
```

### `computeIqaamah` changes

The function must:
1. Process prayers in the existing order (fajr → dhuhr → asr → maghrib → isha)
2. Build `computedTimes` incrementally so `set_offset_from_prayer` can reference earlier prayers
3. Pass `runningTime` to `allConditionsMatch` for `time_of_day` conditions
4. Skip rules where `enabled === false`

### `verifyComputedTimes` additions

New checks for `set_offset_from_prayer`:
- Referenced prayer must exist (caught by the action handler)
- Cannot create circular references (enforced by prayer processing order — forward-only)
- If `from: "iqaamah"` is used, the referenced prayer's iqaamah must be valid (not `--:--`)

---

## Implementation Order

| Step | Scope |
|---|---|
| 1 | `enabled` column — `schema.sql` + Drizzle schema + engine filter |
| 2 | Zod schemas — new condition + action variants in `packages/schemas/src/prayer.ts` |
| 3 | `time_of_day` condition — `allConditionsMatch` with `runningTime` parameter |
| 4 | `hijri_day_range` + `month_day_range` conditions — `allConditionsMatch` additions |
| 5 | `set_offset_from_prayer` action — `applyAction` with `computedTimes` parameter |
| 6 | `cap_min` / `cap_max` actions — `applyAction` additions |
| 7 | Engine plumbing — update `computeIqaamah` to thread new parameters through |
| 8 | Engine unit tests — one test per new condition/action + edge cases |
| 9 | Seed data — add example rules using new features to Al-Noor or Al-Jabal |
| 10 | API validation — update `CreatePrayerRuleSchema` / `UpdatePrayerRuleSchema` |
| 11 | Admin UI — new condition/action form fields + `enabled` toggle |
| 12 | Agent tools — update tool descriptions + system prompt for new types |