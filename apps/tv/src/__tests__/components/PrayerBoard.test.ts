import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import PrayerBoard from '$lib/components/PrayerBoard.svelte';

const mockTimes = [
  { name: 'Fajr', adhaan: '05:00', iqaamah: '05:15' },
  { name: 'Dhuhr', adhaan: '12:00', iqaamah: '12:15' },
  { name: 'Asr', adhaan: '15:00', iqaamah: '15:15' },
  { name: 'Maghrib', adhaan: '18:00', iqaamah: '18:05' },
  { name: 'Isha', adhaan: '19:00', iqaamah: '19:15' },
];

describe('PrayerBoard', () => {
  it('renders all prayer names', () => {
    render(PrayerBoard, {
      props: { times: mockTimes, nextPrayerIndex: 0, accentColor: '#10b981', key: 0 },
    });
    expect(screen.getByText('Fajr')).toBeDefined();
    expect(screen.getByText('Dhuhr')).toBeDefined();
    expect(screen.getByText('Asr')).toBeDefined();
    expect(screen.getByText('Maghrib')).toBeDefined();
    expect(screen.getByText('Isha')).toBeDefined();
  });

  it('renders all adhaan times', () => {
    render(PrayerBoard, {
      props: { times: mockTimes, nextPrayerIndex: 0, accentColor: '#10b981', key: 0 },
    });
    expect(screen.getByText('05:00')).toBeDefined();
    expect(screen.getByText('12:00')).toBeDefined();
    expect(screen.getByText('15:00')).toBeDefined();
    expect(screen.getByText('18:00')).toBeDefined();
    expect(screen.getByText('19:00')).toBeDefined();
  });

  it('renders all iqaamah times', () => {
    render(PrayerBoard, {
      props: { times: mockTimes, nextPrayerIndex: 0, accentColor: '#10b981', key: 0 },
    });
    expect(screen.getByText('05:15')).toBeDefined();
    expect(screen.getByText('12:15')).toBeDefined();
    expect(screen.getByText('15:15')).toBeDefined();
    expect(screen.getByText('18:05')).toBeDefined();
    expect(screen.getByText('19:15')).toBeDefined();
  });

  it('renders empty board with no times', () => {
    const { container } = render(PrayerBoard, {
      props: { times: [], nextPrayerIndex: 0, accentColor: '#10b981', key: 0 },
    });
    expect(container.querySelector('.prayer-board')).toBeTruthy();
  });
});