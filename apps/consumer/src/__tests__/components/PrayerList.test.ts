import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import PrayerList from '$lib/components/PrayerList.svelte';

const mockTimes = [
  { name: 'Fajr', adhaan: '05:00', iqaamah: '05:15' },
  { name: 'Dhuhr', adhaan: '12:00', iqaamah: '12:15' },
  { name: 'Asr', adhaan: '15:00', iqaamah: '15:15' },
];

const mockLabels = { adhaan: 'Adhaan', iqaamah: 'Iqaamah', sunrise: 'Sunrise' };

describe('PrayerList', () => {
  it('renders a card for each prayer time', () => {
    render(PrayerList, { props: { times: mockTimes, labels: mockLabels } });

    expect(screen.getByText('Fajr')).toBeDefined();
    expect(screen.getByText('Dhuhr')).toBeDefined();
    expect(screen.getByText('Asr')).toBeDefined();
  });

  it('marks the next prayer when nextPrayerIndex is set', () => {
    render(PrayerList, { props: { times: mockTimes, labels: mockLabels, nextPrayerIndex: 1 } });

    expect(screen.getByText('Next')).toBeDefined();
  });

  it('does not show Next badge when nextPrayerIndex is -1', () => {
    render(PrayerList, { props: { times: mockTimes, labels: mockLabels, nextPrayerIndex: -1 } });

    expect(screen.queryByText('Next')).toBeNull();
  });
});