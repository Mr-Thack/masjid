// PrayerTable — the classic timetable pattern that replaced the prayer card
// grid on the homepage: one row per prayer, adhaan/iqaamah in scannable
// columns. Covers labels/custom vocabulary, sunrise row, right-after-adhaan,
// dual Asr, current/next chips, and the Mishkaat rosette marker.

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import PrayerTable from '$lib/components/PrayerTable.svelte';

const mockLabels = { adhaan: 'Adhaan', iqaamah: 'Iqaamah', sunrise: 'Sunrise' };

const mockTimes = [
  { name: 'Fajr', adhaan: '05:00', iqaamah: '05:15', sunrise: '06:00' },
  { name: 'Dhuhr', adhaan: '12:00', iqaamah: '12:15' },
  { name: 'Asr', adhaan: '15:00', iqaamah: '15:15', asrSecondary: '16:45', asrSecondaryLabel: 'Asr (Shafi)' },
  { name: 'Maghrib', adhaan: '18:00', iqaamah: '18:05' },
  { name: 'Isha', adhaan: '19:00', iqaamah: '19:15' },
];

describe('PrayerTable', () => {
  it('renders a real table with a row per prayer', () => {
    const { container } = render(PrayerTable, { props: { times: mockTimes, labels: mockLabels } });

    expect(container.querySelector('table')).not.toBeNull();
    for (const name of ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha']) {
      const rowHeader = screen.getByRole('rowheader', { name });
      expect(rowHeader).toBeDefined();
      expect(rowHeader.tagName).toBe('TH');
    }
  });

  it('labels the time columns from the labels prop', () => {
    render(PrayerTable, { props: { times: mockTimes, labels: mockLabels } });
    expect(screen.getByRole('columnheader', { name: 'Adhaan' })).toBeDefined();
    expect(screen.getByRole('columnheader', { name: 'Iqaamah' })).toBeDefined();
  });

  it('honors custom display vocabulary (Indo-Pak labels)', () => {
    render(PrayerTable, {
      props: { times: mockTimes, labels: { adhaan: 'Azaan', iqaamah: 'Iqamah', sunrise: 'Sunrise' } },
    });
    expect(screen.getByRole('columnheader', { name: 'Azaan' })).toBeDefined();
    expect(screen.getByRole('columnheader', { name: 'Iqamah' })).toBeDefined();
  });

  it('renders adhaan and iqaamah times', () => {
    render(PrayerTable, { props: { times: mockTimes, labels: mockLabels } });
    expect(screen.getByText('05:00')).toBeDefined();
    expect(screen.getByText('05:15')).toBeDefined();
  });

  it('formats times in 12h when timeFormat is 12h', () => {
    render(PrayerTable, { props: { times: mockTimes, labels: mockLabels, timeFormat: '12h' } });
    expect(screen.getByText('5:00 AM')).toBeDefined();
    expect(screen.getByText('7:15 PM')).toBeDefined();
  });

  it('renders a dimmed sunrise row when a sunrise time is provided', () => {
    render(PrayerTable, { props: { times: mockTimes, labels: mockLabels } });
    const rowHeader = screen.getByRole('rowheader', { name: 'Sunrise' });
    expect(rowHeader).toBeDefined();
    expect(screen.getByText('06:00')).toBeDefined();
    expect(rowHeader.closest('tr')!.classList.contains('c-pt-sunrise')).toBe(true);
  });

  it('omits the sunrise row when no sunrise time is provided', () => {
    render(PrayerTable, {
      props: { times: mockTimes.map(({ sunrise: _sunrise, ...rest }) => rest), labels: mockLabels },
    });
    expect(screen.queryByRole('rowheader', { name: 'Sunrise' })).toBeNull();
  });

  it('collapses right-after-adhaan iqaamah into a note instead of a time', () => {
    render(PrayerTable, {
      props: {
        times: [{ name: 'Maghrib', adhaan: '18:00', iqaamah: '18:00', rightAfterAdhaan: true }],
        labels: mockLabels,
      },
    });
    expect(screen.getByText('After Adhaan')).toBeDefined();
  });

  it('renders the secondary Asr time under the adhaan cell', () => {
    render(PrayerTable, { props: { times: mockTimes, labels: mockLabels } });
    expect(screen.getByText('Asr (Shafi): 16:45')).toBeDefined();
  });

  it('falls back to a plain Asr label when asrSecondaryLabel is missing', () => {
    render(PrayerTable, {
      props: { times: [{ name: 'Asr', adhaan: '15:00', iqaamah: '15:15', asrSecondary: '16:45' }], labels: mockLabels },
    });
    expect(screen.getByText('Asr: 16:45')).toBeDefined();
  });

  it('marks the current and next prayers with chips', () => {
    render(PrayerTable, {
      props: { times: mockTimes, labels: mockLabels, currentPrayerIndex: 1, nextPrayerIndex: 2 },
    });
    expect(screen.getByText('Current')).toBeDefined();
    expect(screen.getByText('Next')).toBeDefined();
    expect(
      screen.getByRole('rowheader', { name: /Dhuhr/ }).closest('tr')!.classList.contains('c-pt-current'),
    ).toBe(true);
  });

  it('shows no chips when indexes are -1', () => {
    render(PrayerTable, { props: { times: mockTimes, labels: mockLabels } });
    expect(screen.queryByText('Current')).toBeNull();
    expect(screen.queryByText('Next')).toBeNull();
  });

  describe('rosetteMarker (Mishkaat)', () => {
    it('renders the rosette on the current prayer row when enabled', () => {
      const { container } = render(PrayerTable, {
        props: { times: mockTimes, labels: mockLabels, currentPrayerIndex: 1, rosetteMarker: true },
      });
      expect(container.querySelector('.c-prayer-rosette svg.rosette')).not.toBeNull();
    });

    it('does not render the rosette when the row is not current', () => {
      const { container } = render(PrayerTable, {
        props: { times: mockTimes, labels: mockLabels, nextPrayerIndex: 1, rosetteMarker: true },
      });
      expect(container.querySelector('.c-prayer-rosette')).toBeNull();
    });

    it('does not render the rosette when rosetteMarker is off (Sakeenah)', () => {
      const { container } = render(PrayerTable, {
        props: { times: mockTimes, labels: mockLabels, currentPrayerIndex: 1 },
      });
      expect(container.querySelector('.c-prayer-rosette')).toBeNull();
    });
  });
});
