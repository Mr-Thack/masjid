import { describe, it, expect } from 'vitest';
import { ambientPhaseFor } from '$lib/ambient';

const mishkaatTheme = { style_system: 'mishkaat' };
const times = {
  fajr: { adhaan: '05:00' },
  sunrise: '06:00',
  asr: { adhaan: '15:00' },
  maghrib: { iqaamah: '18:05' },
};

describe('ambientPhaseFor', () => {
  it('returns a phase under Mishkaat with the ambient option on (default)', () => {
    // 10:00 is between sunrise+45m and asr adhaan → midday
    expect(ambientPhaseFor(mishkaatTheme, times, new Date('2026-07-30T10:00:00'))).toBe('midday');
  });

  it('follows the solar phases', () => {
    expect(ambientPhaseFor(mishkaatTheme, times, new Date('2026-07-30T04:30:00'))).toBe('predawn');
    expect(ambientPhaseFor(mishkaatTheme, times, new Date('2026-07-30T06:15:00'))).toBe('sunrise');
    expect(ambientPhaseFor(mishkaatTheme, times, new Date('2026-07-30T16:00:00'))).toBe('amber');
    expect(ambientPhaseFor(mishkaatTheme, times, new Date('2026-07-30T22:00:00'))).toBe('night');
  });

  it('returns null under Sakeenah', () => {
    expect(ambientPhaseFor({ style_system: 'sakeenah' }, times, new Date('2026-07-30T10:00:00'))).toBeNull();
    expect(ambientPhaseFor(undefined, times, new Date('2026-07-30T10:00:00'))).toBeNull();
  });

  it('returns null when the ambient option is off', () => {
    const theme = { style_system: 'mishkaat', style_options: { ambient: false } };
    expect(ambientPhaseFor(theme, times, new Date('2026-07-30T10:00:00'))).toBeNull();
  });

  it('returns null when today\u2019s times are incomplete', () => {
    expect(ambientPhaseFor(mishkaatTheme, null, new Date('2026-07-30T10:00:00'))).toBeNull();
    expect(ambientPhaseFor(mishkaatTheme, {}, new Date('2026-07-30T10:00:00'))).toBeNull();
    expect(
      ambientPhaseFor(mishkaatTheme, { ...times, sunrise: null }, new Date('2026-07-30T10:00:00')),
    ).toBeNull();
  });
});
