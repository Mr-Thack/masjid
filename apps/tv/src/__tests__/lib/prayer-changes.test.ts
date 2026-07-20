import { describe, it, expect } from 'vitest';
import { findNearestIqaamahChanges } from '@masjid/ui-utils';

const prayerNames = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'] as const;

function makeDay(date: string, overrides: Record<string, string> = {}) {
  const times: Record<string, { iqaamah: string }> = {};
  for (const name of prayerNames) {
    times[name] = { iqaamah: overrides[name] ?? '12:00' };
  }
  return { date, times };
}

describe('findNearestIqaamahChanges', () => {
  it('returns an empty array when nothing changes', () => {
    const base = { fajr: { iqaamah: '05:00' }, dhuhr: { iqaamah: '12:00' } };
    const days = [
      makeDay('2026-07-21', { fajr: '05:00', dhuhr: '12:00' }),
      makeDay('2026-07-22', { fajr: '05:00', dhuhr: '12:00' }),
    ];
    expect(findNearestIqaamahChanges(base, days, ['fajr', 'dhuhr'])).toEqual([]);
  });

  it('returns at most one entry per prayer (the nearest change)', () => {
    const base = {
      fajr: { iqaamah: '05:00' },
      dhuhr: { iqaamah: '12:00' },
      asr: { iqaamah: '15:00' },
      maghrib: { iqaamah: '18:00' },
      isha: { iqaamah: '19:00' },
    };
    const days = [
      makeDay('2026-07-21', { fajr: '05:05', asr: '15:10' }),
      makeDay('2026-07-22', { fajr: '05:10', dhuhr: '12:10', asr: '15:15' }),
      makeDay('2026-07-23', { maghrib: '18:10', isha: '19:10' }),
    ];

    const changes = findNearestIqaamahChanges(base, days, [...prayerNames]);
    const prayers = changes.map((c) => c.prayer);

    expect(prayers).toHaveLength(5);
    expect(new Set(prayers).size).toBe(5);
    expect(changes.find((c) => c.prayer === 'fajr')?.to).toBe('05:05');
    expect(changes.find((c) => c.prayer === 'dhuhr')?.to).toBe('12:10');
    expect(changes.find((c) => c.prayer === 'asr')?.to).toBe('15:10');
  });

  it('omits prayers that never change within the window', () => {
    const base = {
      fajr: { iqaamah: '05:00' },
      dhuhr: { iqaamah: '12:00' },
    };
    const days = [makeDay('2026-07-21', { fajr: '05:05' })];
    const changes = findNearestIqaamahChanges(base, days, ['fajr', 'dhuhr']);
    expect(changes.map((c) => c.prayer)).toEqual(['fajr']);
  });
});
