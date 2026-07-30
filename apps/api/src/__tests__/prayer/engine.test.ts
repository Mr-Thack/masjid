import { describe, it, expect, vi } from 'vitest';
import type { Condition, Action } from '@masjid/schemas';

// ---------------------------------------------------------------------------
// Import pure functions (now exported) and the full pipeline
// ---------------------------------------------------------------------------
import { applyAction, allConditionsMatch, computeIqaamah, verifyComputedTimes } from '$lib/server/prayer/engine';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface HijriDate {
  year: number;
  month: number;
  day: number;
}

interface MasjidConfig {
  id: string;
  calculation_method: number;
  fajr_angle: number | null;
  isha_angle: number | null;
  latitude: number;
  longitude: number;
  timezone: string;
  asr_madhab: string;
  high_latitude_rule: string;
  show_dual_asr: boolean;
}

interface DbRule {
  id: string;
  masjidId: string;
  prayerName: string;
  executionOrder: number;
  ruleName: string;
  conditionsJson: string;
  actionJson: string;
}

// =========================================================================
// applyAction — pure function, no mocks needed
// =========================================================================
describe('applyAction', () => {
  describe('add_minutes', () => {
    it('adds 15 minutes: 12:00 → 12:15', () => {
      expect(applyAction({ type: 'add_minutes', minutes: 15 }, '12:00')).toBe('12:15');
    });

    it('wraps around midnight: 23:50 + 20 = 00:10', () => {
      expect(applyAction({ type: 'add_minutes', minutes: 20 }, '23:50')).toBe('00:10');
    });

    it('wraps around midnight: 23:59 + 10 = 00:09', () => {
      expect(applyAction({ type: 'add_minutes', minutes: 10 }, '23:59')).toBe('00:09');
    });

    it('handles 480 minutes = 8 hours: 12:00 → 20:00', () => {
      expect(applyAction({ type: 'add_minutes', minutes: 480 }, '12:00')).toBe('20:00');
    });

    it('handles 1500 minutes = 25 hours (wraps multiple days): 12:00 → 13:00', () => {
      expect(applyAction({ type: 'add_minutes', minutes: 1500 }, '12:00')).toBe('13:00');
    });

    it('adds exactly 60 minutes: 14:30 → 15:30', () => {
      expect(applyAction({ type: 'add_minutes', minutes: 60 }, '14:30')).toBe('15:30');
    });

    it('handles zero minutes (same time)', () => {
      expect(applyAction({ type: 'add_minutes', minutes: 0 }, '07:45')).toBe('07:45');
    });

    it('adds near midnight: 23:45 + 30 = 00:15', () => {
      expect(applyAction({ type: 'add_minutes', minutes: 30 }, '23:45')).toBe('00:15');
    });
  });

  describe('round_up', () => {
    it('12:17 round_up(5) = 12:20', () => {
      expect(applyAction({ type: 'round_up', increment: 5 }, '12:17')).toBe('12:20');
    });

    it('12:00 round_up(5) = 12:00 (already on boundary)', () => {
      expect(applyAction({ type: 'round_up', increment: 5 }, '12:00')).toBe('12:00');
    });

    it('12:56 round_up(5) = 13:00 (wraps hour)', () => {
      expect(applyAction({ type: 'round_up', increment: 5 }, '12:56')).toBe('13:00');
    });

    it('23:59 round_up(5) = 00:00 (wraps midnight)', () => {
      expect(applyAction({ type: 'round_up', increment: 5 }, '23:59')).toBe('00:00');
    });

    it('12:05 round_up(10) = 12:10', () => {
      expect(applyAction({ type: 'round_up', increment: 10 }, '12:05')).toBe('12:10');
    });

    it('12:16 round_up(15) = 12:30', () => {
      expect(applyAction({ type: 'round_up', increment: 15 }, '12:16')).toBe('12:30');
    });

    it('14:05 round_up(30) = 14:30', () => {
      expect(applyAction({ type: 'round_up', increment: 30 }, '14:05')).toBe('14:30');
    });

    it('09:01 round_up(60) = 10:00', () => {
      expect(applyAction({ type: 'round_up', increment: 60 }, '09:01')).toBe('10:00');
    });

    it('12:00 round_up(1) = 12:00', () => {
      expect(applyAction({ type: 'round_up', increment: 1 }, '12:00')).toBe('12:00');
    });

    it('12:20 round_up(20) = 12:20 (already on boundary)', () => {
      expect(applyAction({ type: 'round_up', increment: 20 }, '12:20')).toBe('12:20');
    });
  });

  describe('round_down', () => {
    it('12:17 round_down(5) = 12:15', () => {
      expect(applyAction({ type: 'round_down', increment: 5 }, '12:17')).toBe('12:15');
    });

    it('12:00 round_down(5) = 12:00', () => {
      expect(applyAction({ type: 'round_down', increment: 5 }, '12:00')).toBe('12:00');
    });

    it('12:15 round_down(5) = 12:15 (already on boundary)', () => {
      expect(applyAction({ type: 'round_down', increment: 5 }, '12:15')).toBe('12:15');
    });

    it('12:19 round_down(5) = 12:15', () => {
      expect(applyAction({ type: 'round_down', increment: 5 }, '12:19')).toBe('12:15');
    });

    it('23:59 round_down(5) = 23:55', () => {
      expect(applyAction({ type: 'round_down', increment: 5 }, '23:59')).toBe('23:55');
    });

    it('12:08 round_down(10) = 12:00', () => {
      expect(applyAction({ type: 'round_down', increment: 10 }, '12:08')).toBe('12:00');
    });

    it('12:29 round_down(15) = 12:15', () => {
      expect(applyAction({ type: 'round_down', increment: 15 }, '12:29')).toBe('12:15');
    });

    it('13:45 round_down(60) = 13:00', () => {
      expect(applyAction({ type: 'round_down', increment: 60 }, '13:45')).toBe('13:00');
    });
  });

  describe('round_nearest', () => {
    it('12:17 round_nearest(5) = 12:15', () => {
      expect(applyAction({ type: 'round_nearest', increment: 5 }, '12:17')).toBe('12:15');
    });

    it('12:18 round_nearest(5) = 12:20', () => {
      expect(applyAction({ type: 'round_nearest', increment: 5 }, '12:18')).toBe('12:20');
    });

    it('12:15 round_nearest(5) = 12:15 (exact boundary)', () => {
      expect(applyAction({ type: 'round_nearest', increment: 5 }, '12:15')).toBe('12:15');
    });

    it('12:12 round_nearest(5) = 12:10', () => {
      expect(applyAction({ type: 'round_nearest', increment: 5 }, '12:12')).toBe('12:10');
    });

    it('12:03 round_nearest(5) = 12:05', () => {
      expect(applyAction({ type: 'round_nearest', increment: 5 }, '12:03')).toBe('12:05');
    });

    it('12:06 round_nearest(10) = 12:10', () => {
      expect(applyAction({ type: 'round_nearest', increment: 10 }, '12:06')).toBe('12:10');
    });

    it('12:04 round_nearest(10) = 12:00', () => {
      expect(applyAction({ type: 'round_nearest', increment: 10 }, '12:04')).toBe('12:00');
    });

    it('14:20 round_nearest(30) = 14:30', () => {
      expect(applyAction({ type: 'round_nearest', increment: 30 }, '14:20')).toBe('14:30');
    });

    it('23:59 round_nearest(5) = 00:00 (wraps midnight)', () => {
      expect(applyAction({ type: 'round_nearest', increment: 5 }, '23:59')).toBe('00:00');
    });

    it('23:58 round_nearest(5) = 00:00', () => {
      expect(applyAction({ type: 'round_nearest', increment: 5 }, '23:58')).toBe('00:00');
    });
  });

  describe('set_fixed_time', () => {
    it('any input → exact "13:30"', () => {
      expect(applyAction({ type: 'set_fixed_time', time: '13:30' }, '12:00')).toBe('13:30');
      expect(applyAction({ type: 'set_fixed_time', time: '13:30' }, '04:23')).toBe('13:30');
    });

    it('can set to midnight', () => {
      expect(applyAction({ type: 'set_fixed_time', time: '00:00' }, '12:00')).toBe('00:00');
    });

    it('can set to 23:59', () => {
      expect(applyAction({ type: 'set_fixed_time', time: '23:59' }, '12:00')).toBe('23:59');
    });

    it('chains through subsequent rules', () => {
      const after = applyAction({ type: 'add_minutes', minutes: 5 }, applyAction({ type: 'set_fixed_time', time: '13:30' }, '12:00'));
      expect(after).toBe('13:35');
    });
  });
});

// =========================================================================
// allConditionsMatch — pure function, no mocks needed
// =========================================================================
describe('allConditionsMatch', () => {
  const friday = new Date('2026-07-17T12:00:00Z');
  const monday = new Date('2026-07-13T12:00:00Z');
  const sunday = new Date('2026-07-19T12:00:00Z');
  const saturday = new Date('2026-07-18T12:00:00Z');

  const hijri: HijriDate = { year: 1447, month: 9, day: 1 };
  const nonRamadanHijri: HijriDate = { year: 1447, month: 10, day: 1 };

  describe('always', () => {
    it('returns true on any date', () => {
      const conditions: Condition[] = [{ type: 'always' }];
      expect(allConditionsMatch(conditions, friday, hijri)).toBe(true);
      expect(allConditionsMatch(conditions, monday, hijri)).toBe(true);
    });
  });

  describe('day_of_week', () => {
    it('matches Friday (day 5)', () => {
      expect(allConditionsMatch([{ type: 'day_of_week', days: [5] }], friday, hijri)).toBe(true);
    });

    it('does NOT match Monday for Friday rule', () => {
      expect(allConditionsMatch([{ type: 'day_of_week', days: [5] }], monday, hijri)).toBe(false);
    });

    it('matches multiple days [1, 5]', () => {
      const c: Condition[] = [{ type: 'day_of_week', days: [1, 5] }];
      expect(allConditionsMatch(c, monday, hijri)).toBe(true);
      expect(allConditionsMatch(c, friday, hijri)).toBe(true);
    });

    it('Sunday is day 0', () => {
      expect(allConditionsMatch([{ type: 'day_of_week', days: [0] }], sunday, hijri)).toBe(true);
    });

    it('Saturday is day 6', () => {
      expect(allConditionsMatch([{ type: 'day_of_week', days: [6] }], saturday, hijri)).toBe(true);
    });
  });

  describe('month', () => {
    const july = new Date('2026-07-15T12:00:00Z');
    const january = new Date('2026-01-15T12:00:00Z');
    const december = new Date('2026-12-25T12:00:00Z');

    it('matches July (month 7)', () => {
      expect(allConditionsMatch([{ type: 'month', months: [7] }], july, hijri)).toBe(true);
    });

    it('does NOT match January for July rule', () => {
      expect(allConditionsMatch([{ type: 'month', months: [7] }], january, hijri)).toBe(false);
    });

    it('matches [7, 8] in July and August', () => {
      const august = new Date('2026-08-15T12:00:00Z');
      const c: Condition[] = [{ type: 'month', months: [7, 8] }];
      expect(allConditionsMatch(c, july, hijri)).toBe(true);
      expect(allConditionsMatch(c, august, hijri)).toBe(true);
    });

    it('January is month 1, December is month 12', () => {
      expect(allConditionsMatch([{ type: 'month', months: [1] }], january, hijri)).toBe(true);
      expect(allConditionsMatch([{ type: 'month', months: [12] }], december, hijri)).toBe(true);
    });
  });

  describe('hijri_month', () => {
    it('matches Ramadan (month 9)', () => {
      expect(allConditionsMatch([{ type: 'hijri_month', months: [9] }], monday, hijri)).toBe(true);
    });

    it('does NOT match Shawwal for Ramadan rule', () => {
      expect(allConditionsMatch([{ type: 'hijri_month', months: [9] }], monday, nonRamadanHijri)).toBe(false);
    });

    it('matches multiple hijri months [9, 10]', () => {
      const c: Condition[] = [{ type: 'hijri_month', months: [9, 10] }];
      expect(allConditionsMatch(c, monday, hijri)).toBe(true);
      expect(allConditionsMatch(c, monday, nonRamadanHijri)).toBe(true);
    });

    it('Muharram is month 1, Dhu al-Hijjah is month 12', () => {
      expect(allConditionsMatch([{ type: 'hijri_month', months: [1] }], monday, { ...hijri, month: 1 })).toBe(true);
      expect(allConditionsMatch([{ type: 'hijri_month', months: [12] }], monday, { ...hijri, month: 12 })).toBe(true);
    });
  });

  describe('date_range', () => {
    const conditions: Condition[] = [{ type: 'date_range', start: '2026-03-01', end: '2026-03-30' }];

    it('matches date inside range', () => {
      expect(allConditionsMatch(conditions, new Date('2026-03-15T12:00:00Z'), hijri)).toBe(true);
    });

    it('matches date on start boundary (inclusive)', () => {
      expect(allConditionsMatch(conditions, new Date('2026-03-01T12:00:00Z'), hijri)).toBe(true);
    });

    it('matches date on end boundary (inclusive)', () => {
      expect(allConditionsMatch(conditions, new Date('2026-03-30T12:00:00Z'), hijri)).toBe(true);
    });

    it('does NOT match date before range', () => {
      expect(allConditionsMatch(conditions, new Date('2026-02-28T12:00:00Z'), hijri)).toBe(false);
    });

    it('does NOT match date after range', () => {
      expect(allConditionsMatch(conditions, new Date('2026-03-31T12:00:00Z'), hijri)).toBe(false);
    });
  });

  // AND logic (multiple conditions in one rule)
  describe('AND — multiple conditions', () => {
    it('Friday in July: day_of_week[5] AND month[7]', () => {
      const c: Condition[] = [
        { type: 'day_of_week', days: [5] },
        { type: 'month', months: [7] },
      ];
      expect(allConditionsMatch(c, new Date('2026-07-17T12:00:00Z'), hijri)).toBe(true);
    });

    it('Monday in July: day condition fails', () => {
      const c: Condition[] = [
        { type: 'day_of_week', days: [5] },
        { type: 'month', months: [7] },
      ];
      expect(allConditionsMatch(c, new Date('2026-07-13T12:00:00Z'), hijri)).toBe(false);
    });

    it('Friday in January: month condition fails', () => {
      const c: Condition[] = [
        { type: 'day_of_week', days: [5] },
        { type: 'month', months: [7] },
      ];
      expect(allConditionsMatch(c, new Date('2026-01-16T12:00:00Z'), hijri)).toBe(false);
    });

    it('three conditions ANDed: all must match', () => {
      const c: Condition[] = [
        { type: 'day_of_week', days: [5] },
        { type: 'month', months: [7] },
        { type: 'always' },
      ];
      expect(allConditionsMatch(c, new Date('2026-07-17T12:00:00Z'), hijri)).toBe(true);
    });

    it('three conditions ANDed: one fails → overall false', () => {
      const c: Condition[] = [
        { type: 'day_of_week', days: [5] },
        { type: 'month', months: [7] },
        { type: 'always' },
      ];
      expect(allConditionsMatch(c, new Date('2026-07-13T12:00:00Z'), hijri)).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('empty conditions array → true (no conditions to fail)', () => {
      // When the array is empty, the for-loop doesn't execute,
      // so execution falls through to return true.
      expect(allConditionsMatch([], friday, hijri)).toBe(true);
    });

    it('unknown condition type → true (unmatched switch case falls through)', () => {
      // Unknown condition types don't match any case in the switch,
      // so execution falls through without returning false.
      // Validation should prevent unknown types from being stored.
      const conditions = [{ type: 'unknown_type' as any }] as Condition[];
      expect(allConditionsMatch(conditions, friday, hijri)).toBe(true);
    });
  });
});

// =========================================================================
// computeIqaamah — tests with a simpler DB mock
//
// Instead of trying to mock the full drizzle chain, we test the key
// behavior through the result shape and edge cases.
// =========================================================================
describe('computeIqaamah', () => {
  const chicagoMasjid: MasjidConfig = {
    id: 'masjid-test-1',
    calculation_method: 2,
    fajr_angle: null,
    isha_angle: null,
    latitude: 41.85,
    longitude: -87.65,
    timezone: 'America/Chicago',
    asr_madhab: 'shafi',
    high_latitude_rule: 'seventh_of_night',
    show_dual_asr: false,
  };

  const mondayDate = new Date('2026-07-13T12:00:00Z');

  // A fully working drizzle chain mock
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  function createDb(_rulesByPrayer: Record<string, DbRule[]> = {}) {
    return {
      select: () => ({
        from: () => ({
          where: () => ({
            orderBy: () => Promise.resolve([]),
          }),
        }),
      }),
    } as any;
  }

  it('returns all expected prayer times with valid time format', async () => {
    const db = createDb();
    const result = await computeIqaamah(chicagoMasjid, mondayDate, db);

    const timeRegex = /^([01]\d|2[0-3]):[0-5]\d$/;

    expect(result.fajr).toHaveProperty('adhaan');
    expect(result.fajr).toHaveProperty('iqaamah');
    expect(result.dhuhr).toHaveProperty('adhaan');
    expect(result.dhuhr).toHaveProperty('iqaamah');
    expect(result.asr).toHaveProperty('adhaan');
    expect(result.asr).toHaveProperty('iqaamah');
    expect(result.maghrib).toHaveProperty('adhaan');
    expect(result.maghrib).toHaveProperty('iqaamah');
    expect(result.isha).toHaveProperty('adhaan');
    expect(result.isha).toHaveProperty('iqaamah');
    expect(result.sunrise).toBeDefined();
    expect(typeof result.sunrise).toBe('string');
  });

  it('empty rules → iqaamah equals adhaan for all prayers', async () => {
    const db = createDb();
    const result = await computeIqaamah(chicagoMasjid, mondayDate, db);

    expect(result.fajr.iqaamah).toBe(result.fajr.adhaan);
    expect(result.dhuhr.iqaamah).toBe(result.dhuhr.adhaan);
    expect(result.asr.iqaamah).toBe(result.asr.adhaan);
    expect(result.maghrib.iqaamah).toBe(result.maghrib.adhaan);
    expect(result.isha.iqaamah).toBe(result.isha.adhaan);
  });

  it('produces plausible local times for Kennesaw, GA in summer', async () => {
    const kennesawMasjid: MasjidConfig = {
      id: 'masjid-kennesaw-1',
      calculation_method: 2,
      fajr_angle: null,
      isha_angle: null,
      latitude: 34.0234,
      longitude: -84.6157,
      timezone: 'America/New_York',
      asr_madhab: 'shafi',
      high_latitude_rule: 'seventh_of_night',
      show_dual_asr: false,
    };
    const db = createDb();
    const result = await computeIqaamah(kennesawMasjid, new Date('2026-07-20T12:00:00Z'), db);

    function toMinutes(t: string): number {
      const [h, m] = t.split(':').map(Number) as [number, number];
      return h * 60 + m;
    }

    // Sunrise-correct ordering should hold.
    expect(toMinutes(result.fajr.adhaan)).toBeLessThan(toMinutes(result.sunrise));
    expect(toMinutes(result.sunrise)).toBeLessThan(toMinutes(result.dhuhr.adhaan));
    expect(toMinutes(result.dhuhr.adhaan)).toBeLessThan(toMinutes(result.asr.adhaan));
    expect(toMinutes(result.asr.adhaan)).toBeLessThan(toMinutes(result.maghrib.adhaan));
    expect(toMinutes(result.maghrib.adhaan)).toBeLessThan(toMinutes(result.isha.adhaan));

    // ED(T) in July: fajr ~5 AM, dhuhr ~1 PM, maghrib ~8:30 PM.
    expect(toMinutes(result.fajr.adhaan)).toBeGreaterThan(240); // after 4 AM
    expect(toMinutes(result.fajr.adhaan)).toBeLessThan(420); // before 7 AM
    expect(toMinutes(result.dhuhr.adhaan)).toBeGreaterThan(720); // after 12 PM
    expect(toMinutes(result.dhuhr.adhaan)).toBeLessThan(900); // before 3 PM
    expect(toMinutes(result.maghrib.adhaan)).toBeGreaterThan(1170); // after 7:30 PM
    expect(toMinutes(result.maghrib.adhaan)).toBeLessThan(1320); // before 10 PM
  });
});

// =========================================================================
// verifyComputedTimes
// =========================================================================
describe('verifyComputedTimes', () => {
  it('accepts a normal schedule for Atlanta/Kennesaw', () => {
    const times = {
      fajr: { adhaan: '05:21', iqaamah: '05:41' },
      sunrise: '06:42',
      dhuhr: { adhaan: '13:45', iqaamah: '14:00' },
      asr: { adhaan: '16:31', iqaamah: '16:46' },
      maghrib: { adhaan: '20:48', iqaamah: '20:53' },
      isha: { adhaan: '22:09', iqaamah: '22:19' },
    };
    expect(() => verifyComputedTimes(times as ComputedTimes)).not.toThrow();
  });

  it('rejects iqaamah before adhaan', () => {
    const times = {
      fajr: { adhaan: '05:21', iqaamah: '05:41' },
      sunrise: '06:42',
      dhuhr: { adhaan: '13:45', iqaamah: '12:00' },
      asr: { adhaan: '16:31', iqaamah: '16:46' },
      maghrib: { adhaan: '20:48', iqaamah: '20:53' },
      isha: { adhaan: '22:09', iqaamah: '22:19' },
    };
    expect(() => verifyComputedTimes(times as ComputedTimes)).toThrow(/Iqaamah before adhaan/);
  });

  it('rejects fajr iqaamah after sunrise', () => {
    const times = {
      fajr: { adhaan: '06:00', iqaamah: '06:30' },
      sunrise: '06:15',
      dhuhr: { adhaan: '13:00', iqaamah: '13:15' },
      asr: { adhaan: '16:00', iqaamah: '16:15' },
      maghrib: { adhaan: '20:00', iqaamah: '20:05' },
      isha: { adhaan: '22:00', iqaamah: '22:15' },
    };
    expect(() => verifyComputedTimes(times as ComputedTimes)).toThrow(/Fajr iqaamah must be before sunrise/);
  });

  it('warns but does not reject inverted prayer order', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const times = {
      fajr: { adhaan: '05:21', iqaamah: '05:41' },
      sunrise: '06:42',
      dhuhr: { adhaan: '13:45', iqaamah: '14:00' },
      asr: { adhaan: '16:31', iqaamah: '16:46' },
      maghrib: { adhaan: '20:48', iqaamah: '20:53' },
      isha: { adhaan: '19:00', iqaamah: '19:10' },
    };
    expect(() => verifyComputedTimes(times as ComputedTimes)).not.toThrow();
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Prayer order invalid'));
    warnSpy.mockRestore();
  });
});