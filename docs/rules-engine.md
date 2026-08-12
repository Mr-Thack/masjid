# Prayer Rules Engine

## Two-layer model

| Layer | Source | Configurable? |
|---|---|---|
| **Adhaan** | Astronomical calculation from `calculation_method` + lat/lng + date | Only via `calculation_method` setting on the masjid |
| **Iqaamah** | Adhaan time, then sequentially transformed by matching rules | Fully — admin creates rules in any order |

---

## Rule structure

Each `prayer_rules` row:

| Column | Type | Purpose |
|---|---|---|---|
| `id` | TEXT | UUID |
| `masjid_id` | TEXT | FK to masjids |
| `prayer_name` | TEXT | `fajr` / `dhuhr` / `asr` / `maghrib` / `isha` |
| `execution_order` | INT | Sequential position. Gaps are allowed, resolved by `ORDER BY ASC`. |
| `enabled` | INTEGER | 1 = rule active (default), 0 = skip rule entirely |
| `rule_name` | TEXT | Human-readable label (e.g. "Friday Dhuhr override") |
| `conditions_json` | TEXT | JSON array of condition objects. **All must match** for the rule to fire. |
| `action_json` | TEXT | Single action object applied to the running time when conditions match. |

---

## Condition types

Each condition object has a `type` field plus type-specific payload:

### `always`
Always matches. No payload.

```json
{ "type": "always" }
```

### `day_of_week`
Matches when the Gregorian day of week is in the list. 0=Sunday, 6=Saturday.

```json
{ "type": "day_of_week", "days": [5] }
```

### `month`
Matches when the Gregorian month is in the list. 1=January, 12=December.

```json
{ "type": "month", "months": [7, 8] }
```

### `hijri_month`
Matches when the Hijri month is in the list. 1=Muharram, 9=Ramadan, 12=Dhu al-Hijjah.

```json
{ "type": "hijri_month", "months": [9] }
```

### `date_range`
Matches when the Gregorian date falls within the inclusive range.

```json
{ "type": "date_range", "start": "2026-03-01", "end": "2026-03-30" }
```

### `time_of_day`
Matches when the adhaan falls within a time-of-day window (24h). All prayers across the day see the same adhaan time, so this gates by the prayer's *calculated astronomical time* — not a wall-clock "current time."

```json
{ "type": "time_of_day", "after": "12:00", "before": "20:00" }
```

### `hijri_day_range`
Matches when the Hijri day-of-month is between `start` and `end` (inclusive). Use `days` array for exact day matches.

```json
{ "type": "hijri_day_range", "start": 1, "end": 10 }
```

### `month_day_range`
Matches Gregorian month + inclusive day range. Valid for yearly recurring events (e.g. daylight saving transitions).

```json
{ "type": "month_day_range", "month": 3, "start_day": 10, "end_day": 20 }
```

---

## Action types

### `add_minutes`
Shifts the running time forward by N minutes. Must be positive.

```json
{ "type": "add_minutes", "minutes": 15 }
```

### `round_up`
Rounds the running time up to the nearest N-minute boundary. Valid increments: 1, 5, 10, 15, 20, 30, 60.

```json
{ "type": "round_up", "increment": 5 }
```

Example: 12:17 with `round_up(5)` → 12:20

### `round_down`
Rounds the running time down to the nearest N-minute boundary.

```json
{ "type": "round_down", "increment": 5 }
```

Example: 12:17 with `round_down(5)` → 12:15

### `round_nearest`
Rounds to the nearest N-minute boundary. Midpoint rounds up.

```json
{ "type": "round_nearest", "increment": 5 }
```

Example: 12:17 with `round_nearest(5)` → 12:15. 12:18 → 12:20.

### `set_fixed_time`
Overrides the running time to an exact time. Format: `"HH:MM"` 24-hour. Subsequent rules still apply (chain through).

```json
{ "type": "set_fixed_time", "time": "13:30" }
```

### `right_after_adhaan`
Sets iqaamah to 0 minutes after adhaan (i.e. iqaamah = adhaan time). Only valid when applied to the adhaan row of `maghrib` (where sunset and maghrib adhaan coincide, so iqaamah should be immediate).

```json
{ "type": "right_after_adhaan" }
```

### `set_offset_from_prayer`
Offsets this prayer's iqaamah relative to another prayer's computed iqaamah time. The referenced prayer must already have been processed (appear earlier in the loop order: fajr, dhuhr, asr, maghrib, isha).

```json
{ "type": "set_offset_from_prayer", "prayer": "asr", "minutes": 15 }
```

### `cap_min`
Ensures iqaamah is no earlier than the given HH:MM. If the computed time would be earlier, raises it to the cap.

```json
{ "type": "cap_min", "time": "13:30" }
```

### `cap_max`
Ensures iqaamah is no later than the given HH:MM. If the computed time would be later, lowers it to the cap.

```json
{ "type": "cap_max", "time": "22:30" }
```

---

## Execution algorithm

```
function computeDailyTimes(masjid, date):
    gregorianDate = parse(date)
    hijriDate = computeHijri(gregorianDate)

    for prayer in [fajr, dhuhr, asr, maghrib, isha]:
        adhaan = astronomicalCalculate(
            method: masjid.calculation_method,
            lat: masjid.latitude,
            lng: masjid.longitude,
            date: gregorianDate,
            prayer: prayer
        )
        time = adhaan

        rules = SELECT * FROM prayer_rules
                WHERE masjid_id = masjid.id
                  AND prayer_name = prayer
                ORDER BY execution_order ASC

        for rule in rules:
            if allConditionsMatch(rule.conditions_json, gregorianDate, hijriDate):
                time = applyAction(rule.action_json, time)

        yield { prayer: { adhaan, iqaamah: time } }
```

### `allConditionsMatch(conditions[], gregorianDate, hijriDate)`

```
for each condition:
    switch condition.type:
        case "always"     → continue (always true)
        case "day_of_week" → gregorianDate.dayOfWeek() in condition.days
        case "month"       → gregorianDate.month() in condition.months
        case "hijri_month" → hijriDate.month() in condition.months
        case "date_range"  → gregorianDate >= condition.start AND gregorianDate <= condition.end
    if NOT matched: return false
return true
```

### OR logic

AND within a rule (all conditions must match), OR across rules (separate rules are independent). To express "on Friday OR in Ramadan, do X", create two separate rules with the same action.

---

## Examples

### Basic Dhuhr schedule

| Order | conditions_json | action_json | Effect |
|---|---|---|---|
| 1 | `[{"type":"always"}]` | `{"type":"add_minutes","minutes":10}` | Always adds 10 min |
| 2 | `[{"type":"day_of_week","days":[5]}]` | `{"type":"set_fixed_time","time":"13:30"}` | Friday overrides to 1:30 PM |
| 3 | `[{"type":"always"}]` | `{"type":"round_up","increment":5}` | Round up to nearest 5 |

**Monday:** Adhaan 12:15 → +10 → 12:25 → (no Friday match) → round_up(5) → 12:25
**Friday:** Adhaan 12:15 → +10 → 12:25 → set 13:30 → round_up(5) → 13:30

### Ramadan Isha delay

| Order | conditions_json | action_json | Effect |
|---|---|---|---|
| 1 | `[{"type":"hijri_month","months":[9]}]` | `{"type":"add_minutes","minutes":20}` | Ramadan: +20 min |
| 2 | `[{"type":"always"}]` | `{"type":"add_minutes","minutes":10}` | Default: +10 min |

**Non-Ramadan:** Adhaan 20:15 → (Ramadan doesn't match) → +10 → 20:25
**Ramadan:** Adhaan 20:15 → +20 → 20:35 → (always matches) → +10 → 20:45

### Summer Fajr adjustment (June-July)

| Order | conditions_json | action_json | Effect |
|---|---|---|---|
| 1 | `[{"type":"month","months":[6,7]}]` | `{"type":"add_minutes","minutes":30}` | Summer: +30 min |
| 2 | `[{"type":"always"}]` | `{"type":"round_up","increment":5}` | Always round up |

**January:** Adhaan 06:30 → (month doesn't match) → round_up(5) → 06:30
**July:** Adhaan 03:45 → +30 → 04:15 → round_up(5) → 04:15

---

## Validation rules

| Rule | Field | Constraint |
|---|---|---|
| Prayer name enum | `prayer_name` | Must be: `fajr`, `dhuhr`, `asr`, `maghrib`, `isha` |
| Condition type enum | `conditions_json[].type` | Must be: `always`, `day_of_week`, `month`, `hijri_month`, `date_range` |
| Action type enum | `action_json.type` | Must be: `add_minutes`, `round_up`, `round_down`, `round_nearest`, `set_fixed_time` |
| Time format | `set_fixed_time.time` | `HH:MM` 24h format (00:00-23:59) |
| Minutes positive | `add_minutes.minutes` | Positive integer |
| Valid increment | `round_*.increment` | Must be: 1, 5, 10, 15, 20, 30, 60 |
| Day range | `day_of_week.days` | Each element 0-6 |
| Month range | `month.months` | Each element 1-12 |
| Date format | `date_range.start` / `.end` | `YYYY-MM-DD` |
| Empty conditions | `conditions_json` | Array with at least 1 element |

---

## Caching

Prayer times are computed daily and cached:

- **Trigger:** Cloudflare Workers Cron at midnight per masjid timezone (batched by timezone offset)
- **Compute:** For each active masjid, run `computeDailyTimes` for today
- **Store:** KV key `{masjid_id}:{YYYY-MM-DD}`, TTL 25 hours
- **Invalidate:** On any `prayer_rules` write or `masjids.calculation_method` update, recompute and flush

Public endpoints read from KV only. If cache miss, fall back to live compute (rare cold start path).

---

## Hijri date resolution

Hijri dates are computed from the Gregorian date at midnight using an astronomical lookup (Umm al-Qura or similar). The engine treats both dates as civil midnight-boundary dates. The Hijri day in Islamic tradition begins at Maghrib, but for scheduling purposes the civil convention is used — the midnight Hijri date is the one that corresponds to the midnight Gregorian date.

This avoids ambiguity on date boundaries: if you're computing the times for July 19, the Hijri date is also a single, deterministic value.