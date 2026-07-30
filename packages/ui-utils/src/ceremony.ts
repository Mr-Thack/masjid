import type { ResolvedMishkaatOptions } from './style-options.js';

/**
 * Ceremony states (docs/design-language.md §7.6): the screen participates
 * in the salah. A pure state machine driven by server-synchronized time
 * (§7.7) — no side effects, fully unit-testable.
 *
 * Shared between the TV display (full-screen ceremony overlays) and the
 * consumer app (hero "moment" states + ambient background, §7.11).
 */

export type PrayerKey = 'fajr' | 'dhuhr' | 'asr' | 'maghrib' | 'isha';

export type CeremonyStateKind =
  | 'normal'
  | 'adhaan'
  | 'iqaamah-countdown'
  | 'prayer-in-progress'
  | 'quiet'
  /** §7.6.5: late-night calm — board stays readable under a light veil. */
  | 'night-calm';

export type AmbientPhase = 'predawn' | 'sunrise' | 'midday' | 'amber' | 'night';

/** §7.6.1: the adhaan moment is a brief full-screen state. */
export const ADHAAN_MOMENT_SECONDS = 30;
/** §7.6.3: "prayer in progress" covers the expected salah duration. */
export const PRAYER_DURATION_MINUTES = 15;

export interface PrayerWindow {
  /** Minutes since local midnight. */
  adhaan: number;
  iqaamah: number;
}

export interface HijriParts {
  month: number;
  day: number;
  year: number;
}

export interface CeremonyInput {
  /** Seconds since local midnight (server-corrected). */
  nowSeconds: number;
  /** Local weekday: 0 = Sunday … 5 = Friday. */
  dayOfWeek: number;
  prayers: Record<PrayerKey, PrayerWindow>;
  /** Minutes since local midnight. */
  sunriseMinutes: number;
  /** Hijri date parts, when the runtime supports an Islamic calendar. */
  hijri: HijriParts | null;
  quietHours: ResolvedMishkaatOptions['quietHours'];
  ambientEnabled: boolean;
}

export interface CeremonyModifiers {
  /** §7.6.6: khutbah times hero + quiet Surah al-Kahf reminder. */
  friday: boolean;
  /** §7.6.7: iftar countdown emphasis, suhoor-ends at Fajr. */
  ramadan: boolean;
  /** §7.6.8: Eid Mubarak + Eid salah hero, deterministic from the Hijri date. */
  eid: boolean;
  eidName: 'fitr' | 'adha' | null;
}

export interface CeremonyResult {
  state: CeremonyStateKind;
  /** Prayer associated with the current ceremony state. */
  prayer: PrayerKey | null;
  /** For iqaamah-countdown: absolute seconds-since-midnight the countdown ends. */
  countdownEndsAtSeconds: number | null;
  modifiers: CeremonyModifiers;
  /** null when the ambient palette option is off. */
  ambientPhase: AmbientPhase | null;
}

const SECONDS_PER_DAY = 86_400;

function wrapSeconds(value: number): number {
  return ((value % SECONDS_PER_DAY) + SECONDS_PER_DAY) % SECONDS_PER_DAY;
}

function wrapMinutes(value: number): number {
  return ((value % 1440) + 1440) % 1440;
}

/** Half-open interval [start, end) that may wrap past midnight. Empty when start === end. */
export function inWindowSeconds(now: number, start: number, end: number): boolean {
  const n = wrapSeconds(now);
  const s = wrapSeconds(start);
  const e = wrapSeconds(end);
  return s <= e ? n >= s && n < e : n >= s || n < e;
}

function inWindowMinutes(now: number, start: number, end: number): boolean {
  const n = wrapMinutes(now);
  const s = wrapMinutes(start);
  const e = wrapMinutes(end);
  return s <= e ? n >= s && n < e : n >= s || n < e;
}

const PRAYER_ORDER: PrayerKey[] = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];

interface StateCandidate {
  state: CeremonyStateKind;
  prayer: PrayerKey | null;
  /** Raw (unwrapped) window start — later starts win overlaps. */
  start: number;
  endsAtSeconds: number | null;
}

export function computeCeremony(input: CeremonyInput): CeremonyResult {
  const modifiers = computeModifiers(input.dayOfWeek, input.hijri);
  const candidates: StateCandidate[] = [];

  for (const prayer of PRAYER_ORDER) {
    const { adhaan, iqaamah } = input.prayers[prayer];
    const adhaanS = adhaan * 60;
    const iqaamahS = iqaamah * 60;

    const windows: Array<Omit<StateCandidate, 'prayer'>> = [
      { state: 'adhaan', start: adhaanS, endsAtSeconds: null },
      { state: 'iqaamah-countdown', start: adhaanS + ADHAAN_MOMENT_SECONDS, endsAtSeconds: iqaamahS },
      { state: 'prayer-in-progress', start: iqaamahS, endsAtSeconds: null },
    ];
    if (input.quietHours.enabled) {
      windows.push({
        state: 'quiet',
        start: iqaamahS + PRAYER_DURATION_MINUTES * 60,
        endsAtSeconds: null,
      });
    }

    const ends = [
      adhaanS + ADHAAN_MOMENT_SECONDS,
      iqaamahS,
      iqaamahS + PRAYER_DURATION_MINUTES * 60,
      iqaamahS + (PRAYER_DURATION_MINUTES + input.quietHours.quietMinutes) * 60,
    ];

    windows.forEach((window, i) => {
      if (inWindowSeconds(input.nowSeconds, window.start, ends[i]!)) {
        candidates.push({ ...window, prayer });
      }
    });
  }

  if (input.quietHours.enabled) {
    const sleepStart =
      input.prayers.isha.iqaamah * 60 + input.quietHours.sleepAfterIshaMinutes * 60;
    const sleepEnd =
      input.prayers.fajr.adhaan * 60 - input.quietHours.wakeBeforeFajrMinutes * 60;
    if (inWindowSeconds(input.nowSeconds, sleepStart, sleepEnd)) {
      candidates.push({ state: 'night-calm', prayer: null, start: sleepStart, endsAtSeconds: null });
    }
  }

  // Overlaps resolve to the most recently triggered state (§7.6 ordering).
  candidates.sort((a, b) => b.start - a.start);
  const top = candidates[0];

  return {
    state: top?.state ?? 'normal',
    prayer: top?.prayer ?? null,
    countdownEndsAtSeconds: top?.endsAtSeconds ?? null,
    modifiers,
    ambientPhase: input.ambientEnabled
      ? getAmbientPhase(
          input.nowSeconds / 60,
          input.prayers.fajr.adhaan,
          input.sunriseMinutes,
          input.prayers.asr.adhaan,
          input.prayers.maghrib.iqaamah,
        )
      : null,
  };
}

function computeModifiers(dayOfWeek: number, hijri: HijriParts | null): CeremonyModifiers {
  const eidFitr = hijri?.month === 10 && hijri?.day === 1;
  const eidAdha = hijri?.month === 12 && hijri?.day === 10;
  return {
    friday: dayOfWeek === 5,
    ramadan: hijri?.month === 9,
    eid: eidFitr || eidAdha,
    eidName: eidFitr ? 'fitr' : eidAdha ? 'adha' : null,
  };
}

/**
 * Ambient palette (§7.4): the background tint breathes with prayer-linked
 * solar phases. Tints shift surface hues a few percent — never content
 * colors. Side effect: the screen is dimmest at Fajr exactly when the hall
 * is darkest.
 */
export function getAmbientPhase(
  nowMinutes: number,
  fajrAdhaanMinutes: number,
  sunriseMinutes: number,
  asrAdhaanMinutes: number,
  maghribIqaamahMinutes: number,
): AmbientPhase {
  const predawnStart = fajrAdhaanMinutes - 60;
  const sunriseEnd = sunriseMinutes + 45;
  if (inWindowMinutes(nowMinutes, predawnStart, sunriseMinutes)) return 'predawn';
  if (inWindowMinutes(nowMinutes, sunriseMinutes, sunriseEnd)) return 'sunrise';
  if (inWindowMinutes(nowMinutes, sunriseEnd, asrAdhaanMinutes)) return 'midday';
  if (inWindowMinutes(nowMinutes, asrAdhaanMinutes, maghribIqaamahMinutes)) return 'amber';
  return 'night';
}

// ---------------------------------------------------------------------------
// Hijri date helpers (Ramadan/Eid modes are deterministic from the Hijri
// date, §7.6.7/§7.6.8). The formatter is injectable so tests do not depend
// on ICU calendar data.
// ---------------------------------------------------------------------------

let defaultFormatter: Intl.DateTimeFormat | null = null;

function getDefaultHijriFormatter(): Intl.DateTimeFormat {
  if (!defaultFormatter) {
    defaultFormatter = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura', {
      day: 'numeric',
      month: 'numeric',
      year: 'numeric',
    });
  }
  return defaultFormatter;
}

export function getHijriParts(date: Date, formatter?: Intl.DateTimeFormat): HijriParts | null {
  try {
    const parts = (formatter ?? getDefaultHijriFormatter()).formatToParts(date);
    const read = (type: string): number => {
      const raw = parts.find((p) => p.type === type)?.value ?? '';
      const value = parseInt(raw, 10);
      return Number.isFinite(value) ? value : 0;
    };
    const month = read('month');
    const day = read('day');
    const year = read('year') || read('relatedYear');
    if (!month || !day) return null;
    return { month, day, year };
  } catch {
    return null;
  }
}

// Formatting is expensive on weak TVs; the Hijri date changes once a day.
let hijriCache: { key: string; value: HijriParts | null } | null = null;

export function getHijriPartsCached(date: Date): HijriParts | null {
  const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
  if (hijriCache?.key === key) return hijriCache.value;
  const value = getHijriParts(date);
  hijriCache = { key, value };
  return value;
}
