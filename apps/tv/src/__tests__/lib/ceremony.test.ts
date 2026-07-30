import { describe, it, expect } from 'vitest';
import {
  ADHAAN_MOMENT_SECONDS,
  PRAYER_DURATION_MINUTES,
  computeCeremony,
  getAmbientPhase,
  getHijriParts,
  getHijriPartsCached,
  inWindowSeconds,
  type CeremonyInput,
  type PrayerKey,
} from '$lib/ceremony';

// ---------------------------------------------------------------------------
// Ceremony state machine (docs/design-language.md §7.6)
// ---------------------------------------------------------------------------

// Typical summer board (minutes since midnight):
// Fajr 04:21/04:41, sunrise 05:42, Dhuhr 12:58/13:10, Asr 16:53/17:03,
// Maghrib 20:11/20:16, Isha 21:33/21:45
const prayers: Record<PrayerKey, { adhaan: number; iqaamah: number }> = {
  fajr: { adhaan: 261, iqaamah: 281 },
  dhuhr: { adhaan: 778, iqaamah: 790 },
  asr: { adhaan: 1013, iqaamah: 1023 },
  maghrib: { adhaan: 1211, iqaamah: 1216 },
  isha: { adhaan: 1293, iqaamah: 1305 },
};

const defaultQuietHours = {
  enabled: true,
  quietMinutes: 25,
  sleepAfterIshaMinutes: 90,
  wakeBeforeFajrMinutes: 30,
};

function inputAt(seconds: number, overrides: Partial<CeremonyInput> = {}): CeremonyInput {
  return {
    nowSeconds: seconds,
    dayOfWeek: 3, // Wednesday
    prayers,
    sunriseMinutes: 342,
    hijri: { month: 2, day: 15, year: 1448 }, // Safar — no Ramadan/Eid
    quietHours: defaultQuietHours,
    ambientEnabled: true,
    ...overrides,
  };
}

const at = (hours: number, minutes: number, seconds = 0) => hours * 3600 + minutes * 60 + seconds;

describe('computeCeremony — adhaan moment (§7.6.1)', () => {
  it('is in the adhaan state exactly at adhaan', () => {
    const result = computeCeremony(inputAt(at(12, 58)));
    expect(result.state).toBe('adhaan');
    expect(result.prayer).toBe('dhuhr');
  });

  it('stays in the adhaan state for the brief window only', () => {
    expect(computeCeremony(inputAt(at(12, 58, ADHAAN_MOMENT_SECONDS - 1))).state).toBe('adhaan');
    expect(computeCeremony(inputAt(at(12, 58, ADHAAN_MOMENT_SECONDS))).state).toBe(
      'iqaamah-countdown',
    );
  });

  it('never triggers outside a prayer window', () => {
    expect(computeCeremony(inputAt(at(11, 0))).state).toBe('normal');
  });
});

describe('computeCeremony — iqaamah countdown (§7.6.2)', () => {
  it('counts down between adhaan and iqaamah', () => {
    const result = computeCeremony(inputAt(at(20, 12)));
    expect(result.state).toBe('iqaamah-countdown');
    expect(result.prayer).toBe('maghrib');
    expect(result.countdownEndsAtSeconds).toBe(1216 * 60);
  });

  it('ends the countdown exactly at iqaamah', () => {
    const result = computeCeremony(inputAt(at(20, 16)));
    expect(result.state).toBe('prayer-in-progress');
    expect(result.countdownEndsAtSeconds).toBeNull();
  });
});

describe('computeCeremony — prayer in progress (§7.6.3)', () => {
  it('covers the expected salah duration', () => {
    expect(computeCeremony(inputAt(at(13, 10))).state).toBe('prayer-in-progress');
    expect(
      computeCeremony(inputAt(at(13, 10 + PRAYER_DURATION_MINUTES) - 1)).state,
    ).toBe('prayer-in-progress');
  });

  it('transitions to quiet mode afterwards', () => {
    expect(computeCeremony(inputAt(at(13, 10 + PRAYER_DURATION_MINUTES))).state).toBe('quiet');
  });
});

describe('computeCeremony — quiet mode (§7.6.4)', () => {
  it('lasts quietMinutes after prayer-in-progress', () => {
    // Dhuhr iqaamah 13:10 + 15 min in-progress = 13:25 quiet starts; +25 min = 13:50 ends.
    expect(computeCeremony(inputAt(at(13, 49))).state).toBe('quiet');
    expect(computeCeremony(inputAt(at(13, 50))).state).toBe('normal');
    expect(computeCeremony(inputAt(at(13, 25))).prayer).toBe('dhuhr');
  });

  it('is skipped entirely when quiet hours are disabled', () => {
    const quietHours = { ...defaultQuietHours, enabled: false };
    expect(computeCeremony(inputAt(at(13, 30), { quietHours })).state).toBe('normal');
  });

  it('honors custom quietMinutes', () => {
    const quietHours = { ...defaultQuietHours, quietMinutes: 5 };
    expect(computeCeremony(inputAt(at(13, 29), { quietHours })).state).toBe('quiet');
    expect(computeCeremony(inputAt(at(13, 31), { quietHours })).state).toBe('normal');
  });
});

describe('computeCeremony — overlapping windows resolve to the latest event', () => {
  it('an adhaan moment outranks the previous prayer\'s quiet mode', () => {
    // Compress the day: Maghrib adhaan falls inside Asr's quiet window.
    const tight = {
      ...prayers,
      asr: { adhaan: 1013, iqaamah: 1023 }, // in-progress ends 17:38, quiet 17:38–18:03
      maghrib: { adhaan: 1080, iqaamah: 1085 }, // adhaan 18:00 — inside Asr quiet
    };
    const result = computeCeremony(inputAt(at(18, 0), { prayers: tight }));
    expect(result.state).toBe('adhaan');
    expect(result.prayer).toBe('maghrib');
  });
});

describe('computeCeremony — night calm (§7.6.5)', () => {
  it('calms after Isha + ~90 minutes', () => {
    // Isha iqaamah 21:45 + 90 min = 23:15.
    expect(computeCeremony(inputAt(at(23, 14))).state).not.toBe('night-calm');
    expect(computeCeremony(inputAt(at(23, 15))).state).toBe('night-calm');
  });

  it('stays calm past midnight', () => {
    expect(computeCeremony(inputAt(at(0, 30))).state).toBe('night-calm');
    expect(computeCeremony(inputAt(at(2, 0))).state).toBe('night-calm');
  });

  it('brightens before Fajr', () => {
    // Fajr adhaan 04:21 − 30 min = 03:51.
    expect(computeCeremony(inputAt(at(3, 50))).state).toBe('night-calm');
    expect(computeCeremony(inputAt(at(3, 51))).state).not.toBe('night-calm');
  });

  it('is skipped when quiet hours are disabled', () => {
    const quietHours = { ...defaultQuietHours, enabled: false };
    expect(computeCeremony(inputAt(at(23, 30), { quietHours })).state).toBe('normal');
  });

  it('honors custom calm/wake windows', () => {
    const quietHours = { ...defaultQuietHours, sleepAfterIshaMinutes: 30, wakeBeforeFajrMinutes: 10 };
    expect(computeCeremony(inputAt(at(22, 15), { quietHours })).state).toBe('night-calm');
    expect(computeCeremony(inputAt(at(4, 10), { quietHours })).state).toBe('night-calm');
    expect(computeCeremony(inputAt(at(4, 11), { quietHours })).state).not.toBe('night-calm');
  });
});

describe('computeCeremony — modifiers', () => {
  it('friday is true on Fridays only (§7.6.6)', () => {
    expect(computeCeremony(inputAt(at(10, 0), { dayOfWeek: 5 })).modifiers.friday).toBe(true);
    expect(computeCeremony(inputAt(at(10, 0), { dayOfWeek: 4 })).modifiers.friday).toBe(false);
  });

  it('ramadan is true in Hijri month 9 (§7.6.7)', () => {
    const ramadan = computeCeremony(inputAt(at(10, 0), { hijri: { month: 9, day: 12, year: 1447 } }));
    expect(ramadan.modifiers.ramadan).toBe(true);
    expect(ramadan.modifiers.eid).toBe(false);
  });

  it('eid al-fitr on 1 Shawwal (§7.6.8)', () => {
    const result = computeCeremony(inputAt(at(8, 0), { hijri: { month: 10, day: 1, year: 1447 } }));
    expect(result.modifiers.eid).toBe(true);
    expect(result.modifiers.eidName).toBe('fitr');
  });

  it('eid al-adha on 10 Dhul-Hijjah', () => {
    const result = computeCeremony(inputAt(at(8, 0), { hijri: { month: 12, day: 10, year: 1447 } }));
    expect(result.modifiers.eid).toBe(true);
    expect(result.modifiers.eidName).toBe('adha');
  });

  it('no eid on neighboring days', () => {
    expect(
      computeCeremony(inputAt(at(8, 0), { hijri: { month: 10, day: 2, year: 1447 } })).modifiers.eid,
    ).toBe(false);
    expect(
      computeCeremony(inputAt(at(8, 0), { hijri: { month: 12, day: 9, year: 1447 } })).modifiers.eid,
    ).toBe(false);
  });

  it('degrades gracefully without Hijri data', () => {
    const result = computeCeremony(inputAt(at(10, 0), { hijri: null }));
    expect(result.modifiers.ramadan).toBe(false);
    expect(result.modifiers.eid).toBe(false);
  });
});

describe('getAmbientPhase (§7.4)', () => {
  // Fajr adhaan 261 (04:21) → predawn starts 03:21; sunrise 05:42 (+45 = 06:27);
  // Asr adhaan 16:53; Maghrib iqaamah 20:16.
  const bounds = { fajr: 261, sunrise: 342, asr: 1013, maghrib: 1216 };
  const phase = (minutes: number) =>
    getAmbientPhase(minutes, bounds.fajr, bounds.sunrise, bounds.asr, bounds.maghrib);

  it('is deep pre-dawn blue before Fajr', () => {
    expect(phase(3 * 60 + 21)).toBe('predawn');
    expect(phase(4 * 60 + 30)).toBe('predawn');
    expect(phase(5 * 60 + 41)).toBe('predawn');
  });

  it('washes gold at sunrise', () => {
    expect(phase(5 * 60 + 42)).toBe('sunrise');
    expect(phase(6 * 60 + 26)).toBe('sunrise');
  });

  it('is neutral midday', () => {
    expect(phase(6 * 60 + 27)).toBe('midday');
    expect(phase(12 * 60)).toBe('midday');
    expect(phase(16 * 60 + 52)).toBe('midday');
  });

  it('turns amber approaching Maghrib', () => {
    expect(phase(16 * 60 + 53)).toBe('amber');
    expect(phase(19 * 60)).toBe('amber');
    expect(phase(20 * 60 + 15)).toBe('amber');
  });

  it('is deep night after Isha and before the pre-dawn window', () => {
    expect(phase(20 * 60 + 16)).toBe('night');
    expect(phase(23 * 60)).toBe('night');
    expect(phase(0)).toBe('night');
    expect(phase(3 * 60 + 20)).toBe('night');
  });

  it('is null when the ambient option is off', () => {
    const result = computeCeremony(inputAt(at(12, 0), { ambientEnabled: false }));
    expect(result.ambientPhase).toBeNull();
  });

  it('is dimmest at Fajr — predawn covers the Fajr window (§7.4)', () => {
    const result = computeCeremony(inputAt(at(4, 21)));
    expect(result.ambientPhase).toBe('predawn');
    expect(result.state).toBe('adhaan');
  });
});

describe('inWindowSeconds', () => {
  it('handles ordinary windows', () => {
    expect(inWindowSeconds(100, 50, 150)).toBe(true);
    expect(inWindowSeconds(49, 50, 150)).toBe(false);
    expect(inWindowSeconds(150, 50, 150)).toBe(false);
  });

  it('handles windows wrapping past midnight', () => {
    // 23:00 → 01:00
    const start = 23 * 3600;
    const end = 25 * 3600;
    expect(inWindowSeconds(23 * 3600 + 1, start, end)).toBe(true);
    expect(inWindowSeconds(30 * 60, start, end)).toBe(true); // 00:30
    expect(inWindowSeconds(2 * 3600, start, end)).toBe(false);
  });

  it('is empty when start equals end', () => {
    expect(inWindowSeconds(100, 100, 100)).toBe(false);
    expect(inWindowSeconds(0, 86400, 86400)).toBe(false);
  });
});

describe('getHijriParts', () => {
  it('parses month/day/year from an islamic calendar formatter', () => {
    // Real ICU formatter — smoke check that parsing works at all.
    const parts = getHijriParts(new Date(2026, 6, 29));
    expect(parts).not.toBeNull();
    expect(parts!.month).toBeGreaterThanOrEqual(1);
    expect(parts!.month).toBeLessThanOrEqual(12);
    expect(parts!.day).toBeGreaterThanOrEqual(1);
    expect(parts!.day).toBeLessThanOrEqual(30);
    expect(parts!.year).toBeGreaterThan(1400);
  });

  it('accepts an injected formatter (deterministic Ramadan detection)', () => {
    const fake = {
      formatToParts: () => [
        { type: 'month', value: '9' },
        { type: 'day', value: '1' },
        { type: 'year', value: '1447' },
      ],
    } as unknown as Intl.DateTimeFormat;
    const parts = getHijriParts(new Date(), fake);
    expect(parts).toEqual({ month: 9, day: 1, year: 1447 });
  });

  it('returns null when parts are missing or invalid', () => {
    const broken = { formatToParts: () => [{ type: 'month', value: 'x' }] } as unknown as Intl.DateTimeFormat;
    expect(getHijriParts(new Date(), broken)).toBeNull();

    const throwing = {
      formatToParts: () => {
        throw new Error('no ICU');
      },
    } as unknown as Intl.DateTimeFormat;
    expect(getHijriParts(new Date(), throwing)).toBeNull();
  });
});

describe('getHijriPartsCached', () => {
  it('returns consistent values for consecutive days', () => {
    const a = getHijriPartsCached(new Date(2026, 6, 29, 10, 0));
    const b = getHijriPartsCached(new Date(2026, 6, 29, 22, 0));
    const c = getHijriPartsCached(new Date(2026, 6, 30, 1, 0));
    expect(a).toEqual(b); // same civil day, cached
    expect(c).not.toBeNull();
    // The next civil day is either the same or the following Hijri day.
    expect(c!.day === a!.day || c!.day === a!.day + 1 || c!.month !== a!.month).toBe(true);
  });
});
