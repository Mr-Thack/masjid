# adhan.js Migration Plan

## Why migrate

The current prayer time engine (`apps/api/src/lib/server/prayer/adhaan.ts`) is a hand-rolled
165-line astronomical engine with two bugs and several missing features:

| Issue | Detail |
|-------|--------|
| **Asr bug** | `asrAngle = 90 - atan(...)` — the `90 -` prefix converts altitude to zenith, making Asr 30-80 minutes too early. `sunAngleTime()` expects altitude. |
| **Hanafi Asr missing** | `asrFactor()` is hardcoded to `1` (Shafi). No way to toggle Hanafi. No `asr_madhab` column exists. |
| **Limited methods** | Only 6 calculation methods (1,2,3,4,5,7). No Tehran, Turkey, Singapore, Dubai, Kuwait, Qatar, Moonsighting Committee. Method 6 (Tehran) is mentioned in agent tools but not implemented. |
| **No high-latitude support** | Locations above ~48°N get `--:--` or inverted times. No MiddleOfTheNight / SeventhOfTheNight adjustments. |
| **No polar circle handling** | No AqrabBalad / AqrabYaum fallback for extreme latitudes. |
| **No per-prayer adjustments** | adhan.js has built-in ±minute offsets per prayer. Our workaround requires creating prayer_rules entries for every simple offset. |
| **No Shafaq / moonsighting** | No support for MoonsightingCommittee's seasonal adjustment or Ahmer/Abyad twilight. |

## What adhan.js provides

Package: `adhan` (v4.4.4, MIT, 23k weekly downloads, no dependencies)

| Feature | adhan.js |
|---------|----------|
| Calculation methods | 12 built-in + custom |
| Asr madhab | `Shafi` / `Hanafi` toggle |
| High-latitude rules | MiddleOfTheNight, SeventhOfTheNight, TwilightAngle |
| Polar circle resolution | AqrabBalad, AqrabYaum, Unresolved |
| Per-prayer adjustments | `adjustments.fajr = 2` (minutes) |
| Rounding | Nearest / Up / None |
| Shafaq (Isha twilight type) | General (default), Ahmer, Abyad |
| Output | Native `Date` objects (UTC), timezone formatting left to caller |
| Precision | Jean Meeus "Astronomical Algorithms" equations |

### API overview

```ts
import { Coordinates, CalculationMethod, PrayerTimes, Madhab } from 'adhan';

const coordinates = new Coordinates(41.88, -87.63);
const params = CalculationMethod.NorthAmerica(); // ISNA
params.madhab = Madhab.Hanafi;
params.highLatitudeRule = HighLatitudeRule.SeventhOfTheNight;

const prayerTimes = new PrayerTimes(coordinates, new Date('2026-07-25'), params);
// prayerTimes.fajr    → Date (UTC)
// prayerTimes.dhuhr   → Date (UTC)
// prayerTimes.asr     → Date (UTC)
// prayerTimes.maghrib → Date (UTC)
// prayerTimes.isha    → Date (UTC)
// prayerTimes.sunrise → Date (UTC)
```

## What stays unchanged

- **Iqaamah rules engine** (`engine.ts`) — conditions, actions, chaining. No library does this.
- **Caching** (`cache.ts`) — KV key structure and invalidation logic.
- **Hijri** (`hijri.ts`) — used only by the `hijri_month` condition in the rules engine.
- **Jumu'ah sessions** — stored as fixed times, unrelated to adhaan calculation.
- **Board endpoint aggregation** — still fetches today + 7 days, theme, announcements.
- **`@masjid/ui-utils` theming** — CSS custom properties, `applyTheme()`, vocab labels.

## Schema changes

### `masjids` table — new columns

```sql
ALTER TABLE masjids ADD COLUMN asr_madhab TEXT NOT NULL DEFAULT 'shafi';
ALTER TABLE masjids ADD COLUMN high_latitude_rule TEXT NOT NULL DEFAULT 'seventh_of_night';
```

| Column | Type | Default | Values |
|--------|------|---------|--------|
| `asr_madhab` | TEXT | `'shafi'` | `'shafi'`, `'hanafi'` |
| `high_latitude_rule` | TEXT | `'seventh_of_night'` | `'seventh_of_night'`, `'middle_of_night'`, `'twilight_angle'`, `'none'` |

Note: `polar_circle_resolution` is not stored per-masjid. We use `Unresolved` (default)
since no existing masjid is above the Arctic Circle. `shafaq` (Ahmer/Abyad twilight for
MoonsightingCommittee) is not stored per-masjid; if a masjid uses Moonsighting Committee
they can configure it manually.

### `calculation_method` integer mapping

Our existing integers map to adhan.js `CalculationMethod` factory functions:

| Our int | adhan.js method | Fajr angle | Isha angle | Notes |
|---------|-----------------|------------|------------|-------|
| 1 | `NorthAmerica()` | 15° | 15° | Same as ISNA in our code |
| 2 | `NorthAmerica()` | 15° | 15° | ISNA (default) |
| 3 | `MuslimWorldLeague()` | 18° | 17° | MWL |
| 4 | `UmmAlQura()` | 18.5° | 90 min | Makkah |
| 5 | `Egyptian()` | 19.5° | 17.5° | Egyptian |
| 7 | `Karachi()` | 18° | 18° | Karachi |

**Newly available methods** (not mapped to existing integers, added as new options):

| New int | adhan.js method | Fajr | Isha |
|---------|-----------------|------|------|
| 6 | `Tehran()` | 17.7° | 14° |
| 8 | `Turkey()` | 18° | 17° |
| 9 | `Singapore()` | 20° | 18° |
| 10 | `Dubai()` | 18.2° | 18.2° |
| 11 | `Kuwait()` | 18° | 17.5° |
| 12 | `Qatar()` | 18° | 90 min |
| 13 | `MoonsightingCommittee()` | 18° | 18° |

This mapping lives in a new file `apps/api/src/lib/server/prayer/method-map.ts`.

## Files to change

### Core engine (delete + replace)

| File | Action | Description |
|------|--------|-------------|
| `apps/api/src/lib/server/prayer/adhaan.ts` | **Delete** | Replaced by `adhan` package |
| `apps/api/src/lib/server/prayer/method-map.ts` | **New** | Maps our `calculation_method` int → adhan.js `CalculationParameters` |
| `apps/api/src/lib/server/prayer/engine.ts` | **Modify** | Replace `calculateAdhaan()` call with adhan.js `PrayerTimes`, add `asr_madhab` to `MasjidConfig` |

### Schema

| File | Action | Description |
|------|--------|-------------|
| `apps/api/src/lib/server/db/schema.ts` | Modify | Add `asrMadhab`, `highLatitudeRule` to `masjids` table |
| `schema.sql` | Modify | Add `asr_madhab`, `high_latitude_rule` columns |
| `apps/api/src/lib/server/db/index.ts` | Modify | Add columns to `ensureTables()` fallback |

### Zod schemas

| File | Action | Description |
|------|--------|-------------|
| `packages/schemas/src/masjid.ts` | Modify | Add `asr_madhab`, `high_latitude_rule` to `CreateMasjidSchema`, `UpdateMasjidSchema`, `MasjidProfileSchema` |

### admin Prayer Config endpoint

| File | Action | Description |
|------|--------|-------------|
| `apps/api/src/routes/api/v1/admin/masjids/[id]/prayer/+server.ts` | Modify | `PrayerConfigUpdateSchema` adds `asr_madhab`, `high_latitude_rule`; GET/PATCH include them |

### Public prayer endpoints

| File | Action | Description |
|------|--------|-------------|
| `apps/api/src/routes/api/v1/masjids/[slug]/prayer/+server.ts` | Modify | Response adds `asr_madhab` field |
| `apps/api/src/routes/api/v1/masjids/[slug]/board/+server.ts` | Modify | Internal `masjidConfig` includes `asr_madhab`, `high_latitude_rule` |

### Dry-run endpoint

| File | Action | Description |
|------|--------|-------------|
| `apps/api/src/routes/api/v1/admin/masjids/[id]/prayer/dry-run/+server.ts` | Modify | `DryRunSchema` adds optional `asr_madhab` override |

### Tests

| File | Action | Description |
|------|--------|-------------|
| `apps/api/src/__tests__/prayer/adhaan.test.ts` | **Rewrite** | Test adhan.js integration instead of custom engine |
| `apps/api/src/__tests__/prayer/engine.test.ts` | Modify | Update for new `MasjidConfig` shape |

### Agent / WhatsApp worker

| File | Action | Description |
|------|--------|-------------|
| `packages/agent/src/tools.ts` | Modify | `prayer_config_update` adds `asr_madhab`, `high_latitude_rule` params; update method descriptions |
| `packages/agent/src/prompt.ts` | Modify | Update PROFILE domain guide with madhab option; add high_latitude_rule explanation |

### Admin app UI

| File | Action | Description |
|------|--------|-------------|
| `apps/admin/src/routes/admin/[slug]/settings/profile/+page.svelte` | Modify | Add Asr madhab dropdown (Shafi / Hanafi), add high latitude rule dropdown, expand calculation method options (add 6, 8-13) |
| `apps/admin/src/routes/register/+page.svelte` | Modify | Add `asr_madhab` to registration form |
| `apps/admin/src/lib/auth.svelte.ts` | Modify | `register()` accepts `asr_madhab`, `high_latitude_rule` |
| `apps/admin/src/lib/api.ts` | Modify | `getPrayerConfig()` / `updatePrayerConfig()` include new fields |

### Seed data

| File | Action | Description |
|------|--------|-------------|
| `tooling/seed.ts` | Modify | Add `asrMadhab: 'shafi'` and `highLatitudeRule: 'seventh_of_night'` to both masjid inserts |

### General profile update endpoint

| File | Action | Description |
|------|--------|-------------|
| `apps/api/src/routes/api/v1/admin/masjids/[id]/+server.ts` | Modify | PUT handler maps new fields |

## Admin UI changes (profile settings page)

### Before (current)

```
Calculation method:  [dropdown: 1-5, 7]
Timezone:             [dropdown: common IANA zones]
```

### After (migrated)

```
Calculation method:  [dropdown: 1-7, 8-13]  ← expanded
Asr madhab:           [dropdown: Shafi / Hanafi]  ← new
High latitude rule:   [dropdown: Seventh of Night / Middle of Night / Twilight Angle / None]  ← new
Timezone:             [dropdown: common IANA zones]
```

The `methods` constant in `profile/+page.svelte` (lines 23-30) expands from 6 entries to 13.

## How adhaan computation works after migration

```ts
// method-map.ts
import { CalculationMethod, Madhab, HighLatitudeRule } from 'adhan';

export function buildParams(
  calculationMethod: number,
  asrMadhab: string,
  highLatitudeRule: string,
) {
  const factory = METHOD_MAP[calculationMethod] ?? METHOD_MAP[2];
  const params = factory();
  params.madhab = asrMadhab === 'hanafi' ? Madhab.Hanafi : Madhab.Shafi;
  params.highLatitudeRule = HIGH_LAT_MAP[highLatitudeRule] ?? HighLatitudeRule.SeventhOfTheNight;
  return params;
}

// engine.ts — simplified computeIqaamah
import { Coordinates, PrayerTimes } from 'adhan';
import { buildParams } from './method-map';

function computeIqaamah(config: MasjidConfig, dateStr: string, db) {
  const coordinates = new Coordinates(config.latitude, config.longitude);
  const date = new Date(dateStr + 'T12:00:00Z');
  const params = buildParams(config.calculation_method, config.asr_madhab, config.high_latitude_rule);

  const pt = new PrayerTimes(coordinates, date, params);

  const adhaan = {
    fajr:    utcDateToLocalHM(pt.fajr,    config.timezone),
    sunrise: utcDateToLocalHM(pt.sunrise, config.timezone),
    dhuhr:   utcDateToLocalHM(pt.dhuhr,   config.timezone),
    asr:     utcDateToLocalHM(pt.asr,     config.timezone),
    maghrib: utcDateToLocalHM(pt.maghrib, config.timezone),
    isha:    utcDateToLocalHM(pt.isha,    config.timezone),
  };

  // iqaamah rule chaining — unchanged from current code
  for (const prayer of PRAYERS) {
    let time = adhaan[prayer];
    for (const rule of rules[prayer]) {
      if (allConditionsMatch(rule, date, hijri)) {
        time = applyAction(rule.action, time);
      }
    }
    // ...
  }
}
```

The `utcDateToLocalHM()` helper replaces the current `utcFractionToLocalHM()`,
converting a UTC `Date` to `HH:MM` in the masjid's timezone:

```ts
function utcDateToLocalHM(utcDate: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric', minute: '2-digit', hour12: false, timeZone,
  }).formatToParts(utcDate);
  const h = parts.find(p => p.type === 'hour')?.value ?? '00';
  const m = parts.find(p => p.type === 'minute')?.value ?? '00';
  return `${String(Number(h) % 24).padStart(2, '0')}:${m}`;
}
```

## Things adhan.js does NOT handle (still our responsibility)

| Feature | Why we keep it |
|---------|---------------|
| Iqaamah time computation from rules | Application logic, not astronomical |
| Rule condition evaluation (day_of_week, month, hijri_month, date_range) | Custom domain logic |
| Rule action application (add_minutes, round_up, set_fixed_time, etc.) | Custom domain logic |
| `right_after_adhaan` action | Specific to our iqaamah model |
| Timezone formatting to HH:MM | adhan.js returns raw UTC Dates |
| Jumu'ah session times | Stored as fixed times, unrelated to adhaan |
| Board endpoint aggregation | Our custom multi-day + theme + jumu'ah aggregation |
| Caching (KV) | Our infrastructure |
| Verification guard (iqaamah ≥ adhaan, Fajr ≤ sunrise) | Application logic |

## Asr dual-time support (Shafi + Hanafi in the public API)

If a masjid wants to show both Asr times (like masjid-suffah does), the public API
should compute both. Options:

**Option A: Always compute both, let frontend decide**
The prayer endpoint returns `asr_shafi` and `asr_hanafi` (or a nested `asr: { shafi, hanafi }`).
The theme could have a `show_dual_asr` flag.

**Option B: Compute primary + derive second via API parameter**
A `?asr_madhab=both` query param on the prayer endpoint.

**Option C: Let frontend compute the difference**
Return the configured madhab's Asr, and the frontend adds a label showing both if configured.

This is not required for the initial migration — it can be a follow-up. The initial
migration just makes Asr calculation correct for the configured madhab.

## Step-by-step migration procedure

### 1. Install adhan.js
```bash
npm install adhan --workspace=@masjid/api
```

### 2. Apply DB migration
```sql
ALTER TABLE masjids ADD COLUMN asr_madhab TEXT NOT NULL DEFAULT 'shafi';
ALTER TABLE masjids ADD COLUMN high_latitude_rule TEXT NOT NULL DEFAULT 'seventh_of_night';
```

### 3. Update Drizzle schema (`schema.ts`)
Add columns:
```ts
asrMadhab: text('asr_madhab').notNull().default('shafi'),
highLatitudeRule: text('high_latitude_rule').notNull().default('seventh_of_night'),
```

### 4. Create `method-map.ts`
Map integers → adhan.js `CalculationParameters` factory functions.

### 5. Rewrite `adhaan.ts` → thin wrapper
Replace the 165-line custom engine with a thin adhan.js wrapper:
- `calculateAdhaan()` calls `buildParams()` + `new PrayerTimes()` + format to HH:MM
- Keep the `MasjidLocation` interface (add `asr_madhab`, `high_latitude_rule`)
- Delete `julianDate()`, `sunDeclination()`, `equationOfTime()`, `sunAngleTime()`, `getAngle()`, `asrFactor()`
- Keep `utcFractionToLocalHM()` → renamed to `utcDateToLocalHM()`, simplified

### 6. Update `engine.ts`
Add `asr_madhab`, `high_latitude_rule` to the `MasjidConfig` type. Pass them through to the adhaan call.

### 7. Update Zod schemas (`packages/schemas/src/masjid.ts`)
```ts
export const AsrMadhab = z.enum(['shafi', 'hanafi']).default('shafi');
export const HighLatitudeRule = z.enum(['seventh_of_night', 'middle_of_night', 'twilight_angle', 'none']).default('seventh_of_night');
```
Add to `CreateMasjidSchema`, `UpdateMasjidSchema`, `MasjidProfileSchema`.

### 8. Update admin prayer config endpoint
- `PrayerConfigUpdateSchema` adds `asr_madhab`, `high_latitude_rule`
- GET returns both new fields
- PATCH accepts and persists both new fields

### 9. Update admin profile update endpoint
Map `asr_madhab` → `asrMadhab`, `high_latitude_rule` → `highLatitudeRule` in the PUT handler.

### 10. Update admin UI
- Profile page: add Asr madhab dropdown, high latitude rule dropdown, expand method list
- Registration page: add `asr_madhab` field, `high_latitude_rule` field
- API client: include new fields in `getPrayerConfig()` / `updatePrayerConfig()`

### 11. Update agent tools
- `prayer_config_get` returns `asr_madhab`, `high_latitude_rule`
- `prayer_config_update` accepts `asr_madhab` (enum: shafi/hanafi), `high_latitude_rule`
- Update method descriptions in tool JSON schema

### 12. Update agent prompt
Add to PROFILE domain guide:
```
asr_madhab: 'shafi' (earlier Asr) or 'hanafi' (later Asr, common in Indo-Pak communities).
high_latitude_rule: 'seventh_of_night' (recommended >48°N), 'middle_of_night', 'twilight_angle', 'none'.
```

### 13. Update seed data
Both masjids get `asrMadhab: 'shafi'`, `highLatitudeRule: 'seventh_of_night'`.

### 14. Rewrite tests
- `apps/api/src/__tests__/prayer/adhaan.test.ts`: replace custom engine tests with adhan.js integration tests (verify correct method mapping, madhab toggle, timezone formatting)
- `apps/api/src/__tests__/prayer/engine.test.ts`: update MasjidConfig fixtures to include new fields

### 15. Verify against reference times
Compare adhan.js output for masjid-suffah's coordinates against their timetable (5:07, 1:45, 5:30/6:40, 8:45, 10:04) to confirm the fix.

## Risks and mitigations

| Risk | Mitigation |
|------|------------|
| Slight time differences from algorithm change | adhan.js uses Meeus equations vs our simplified formulas. Differences should be ≤1-2 minutes for Dhuhr/Maghrib. Verify against known reference data before deploying. |
| Asr times shift significantly (bug fix) | Intentional — the current Asr is wrong. Communicate to masjid admins. |
| Quran/Sunnah times API shape change | adhan.js doesn't compute these (qiyam, tahajjud). If needed, compute from Isha/Fajr manually. |
| Umm al-Qura Isha sentinel | adhan.js handles this natively via `ishaInterval` — no more -1 sentinel bug. |