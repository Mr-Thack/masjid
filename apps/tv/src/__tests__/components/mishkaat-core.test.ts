import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import AnalogClock from '$lib/components/AnalogClock.svelte';
import PrayerBoard from '$lib/components/PrayerBoard.svelte';

// ---------------------------------------------------------------------------
// Mishkaat core: classic clock face (§7.7) + rosette current-prayer marker
// (§7.3)
// ---------------------------------------------------------------------------

const sampleTime = new Date('2026-07-29T15:37:42');

describe('AnalogClock — classic variant (Mishkaat)', () => {
  it('renders the classic face class when classic=true', () => {
    const { container } = render(AnalogClock, { props: { now: sampleTime, classic: true } });
    expect(container.querySelector('svg.analog-clock--classic')).toBeTruthy();
  });

  it('renders 48 minute ticks plus 12 hour ticks (clean ticks, §7.7)', () => {
    const { container } = render(AnalogClock, { props: { now: sampleTime, classic: true } });
    expect(container.querySelectorAll('.clock-tick--minute').length).toBe(48);
    expect(container.querySelectorAll('.clock-tick').length).toBe(60);
  });

  it('renders the inner ring only in classic mode', () => {
    const classic = render(AnalogClock, { props: { now: sampleTime, classic: true } });
    expect(classic.container.querySelector('.clock-inner-ring')).toBeTruthy();

    const plain = render(AnalogClock, { props: { now: sampleTime } });
    expect(plain.container.querySelector('.clock-inner-ring')).toBeNull();
  });

  it('keeps correct hand angles in classic mode', () => {
    const { container } = render(AnalogClock, { props: { now: sampleTime, classic: true } });
    const angleOf = (selector: string): number => {
      const transform = container.querySelector(selector)?.getAttribute('transform') ?? '';
      const match = transform.match(/^rotate\(([-\d.]+) 100 100\)$/);
      expect(match, `${selector} transform`).toBeTruthy();
      return parseFloat(match![1]);
    };
    // 15:37:42 → hour = 3*30 + 37*0.5 = 108.5; minute = 37*6 + 42*0.1 = 226.2; second = 42*6 = 252
    expect(angleOf('.clock-hand--hour')).toBeCloseTo(108.5, 6);
    expect(angleOf('.clock-hand--minute')).toBeCloseTo(226.2, 6);
    expect(angleOf('.clock-hand--second')).toBeCloseTo(252, 6);
  });
});

describe('AnalogClock — default variant (Sakeenah unchanged)', () => {
  it('has no minute ticks and no classic class', () => {
    const { container } = render(AnalogClock, { props: { now: sampleTime } });
    expect(container.querySelector('svg.analog-clock--classic')).toBeNull();
    expect(container.querySelectorAll('.clock-tick--minute').length).toBe(0);
    expect(container.querySelectorAll('.clock-tick').length).toBe(12);
  });
});

describe('PrayerBoard — rosette current-prayer marker (§7.3)', () => {
  const mockTimes = [
    { key: 'fajr', label: 'Fajr', adhaan: '05:00', iqaamah: '05:15' },
    { key: 'dhuhr', label: 'Dhuhr', adhaan: '12:00', iqaamah: '12:15' },
    { key: 'asr', label: 'Asr', adhaan: '15:00', iqaamah: '15:15' },
    { key: 'maghrib', label: 'Maghrib', adhaan: '18:00', iqaamah: '18:05' },
    { key: 'isha', label: 'Isha', adhaan: '19:00', iqaamah: '19:15' },
  ];
  const baseProps = {
    times: mockTimes,
    currentPrayerIndex: null,
    flashAdhaan: null,
    flashIqaamah: null,
    adhaanLabel: 'Adhaan',
    iqaamahLabel: 'Iqaamah',
  };

  it('shows a rosette on the current prayer row only', () => {
    const { container } = render(PrayerBoard, {
      props: { ...baseProps, currentPrayerIndex: 2, rosetteMarker: true },
    });
    const rosettes = container.querySelectorAll('.prayer-name-rosette svg.rosette');
    expect(rosettes.length).toBe(1);
    const currentName = container.querySelector('.prayer-name--current');
    expect(currentName?.querySelector('.prayer-name-rosette')).toBeTruthy();
  });

  it('shows no rosette when there is no current prayer', () => {
    const { container } = render(PrayerBoard, {
      props: { ...baseProps, currentPrayerIndex: null, rosetteMarker: true },
    });
    expect(container.querySelectorAll('.prayer-name-rosette').length).toBe(0);
  });

  it('never shows rosettes without the rosetteMarker prop (Sakeenah unchanged)', () => {
    const { container } = render(PrayerBoard, {
      props: { ...baseProps, currentPrayerIndex: 1 },
    });
    expect(container.querySelectorAll('.prayer-name-rosette').length).toBe(0);
  });
});
