// WeeklyPrayerTable — the Times tab's classic week timetable: days as rows,
// prayers as columns, iqaamah bold over adhaan in each cell. Covers custom
// vocabulary, today highlighting, cross-week change detection (changed times
// pop in accent, unchanged dim), missing data, and dual Asr.

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import WeeklyPrayerTable, { type WeekDay } from '$lib/components/WeeklyPrayerTable.svelte';

const prayerLabels = { fajr: 'Fajr', dhuhr: 'Dhuhr', asr: 'Asr', maghrib: 'Maghrib', isha: 'Isha' };

function makeTimes(iqaamahFajr = '05:15') {
  return {
    fajr: { adhaan: '05:00', iqaamah: iqaamahFajr },
    dhuhr: { adhaan: '12:00', iqaamah: '12:15' },
    asr: { adhaan: '15:00', iqaamah: '15:15' },
    maghrib: { adhaan: '18:00', iqaamah: '18:05' },
    isha: { adhaan: '19:00', iqaamah: '19:15' },
  };
}

// Mon Jul 27 2026 – Sun Aug 2 2026
const week: WeekDay[] = [
  { date: new Date('2026-07-27T12:00:00'), times: makeTimes() },
  { date: new Date('2026-07-28T12:00:00'), times: makeTimes() },
  { date: new Date('2026-07-29T12:00:00'), times: makeTimes('05:20') }, // Fajr iqaamah drifts
  { date: new Date('2026-07-30T12:00:00'), times: makeTimes('05:20') },
  { date: new Date('2026-07-31T12:00:00'), times: makeTimes('05:20') },
  { date: new Date('2026-08-01T12:00:00'), times: makeTimes('05:20') },
  { date: new Date('2026-08-02T12:00:00'), times: makeTimes('05:20') },
];

const defaultProps = {
  days: week,
  prayerLabels,
  today: new Date('2026-07-30T10:00:00'), // Thursday
};

describe('WeeklyPrayerTable', () => {
  it('renders a column header per prayer and a row per day', () => {
    render(WeeklyPrayerTable, { props: defaultProps });

    for (const label of ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha']) {
      expect(screen.getByRole('columnheader', { name: label })).toBeDefined();
    }
    for (const day of ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']) {
      expect(screen.getByRole('rowheader', { name: new RegExp(day) })).toBeDefined();
    }
  });

  it('honors custom display vocabulary (Indo-Pak labels)', () => {
    render(WeeklyPrayerTable, {
      props: {
        ...defaultProps,
        prayerLabels: { fajr: 'Fajr', dhuhr: 'Zuhr', asr: 'Asr', maghrib: 'Maghrib', isha: 'Isha' },
        adhaanLabel: 'Azaan',
        iqaamahLabel: 'Iqamah',
      },
    });
    expect(screen.getByRole('columnheader', { name: 'Zuhr' })).toBeDefined();
    // Legend carries the custom adhaan/iqaamah vocabulary
    const legend = document.querySelector('.c-wt-legend')!;
    expect(legend.textContent).toContain('Iqamah');
    expect(legend.textContent).toContain('Azaan');
  });

  it('renders the legend styling each word like its cell counterpart', () => {
    render(WeeklyPrayerTable, { props: defaultProps });
    const legend = document.querySelector('.c-wt-legend')!;
    expect(legend.querySelector('.c-wt-legend-iqaamah')!.textContent).toBe('Iqaamah');
    expect(legend.querySelector('.c-wt-legend-adhaan')!.textContent).toBe('Adhaan');
  });

  it('shows iqaamah over adhaan in each cell', () => {
    render(WeeklyPrayerTable, { props: { ...defaultProps, days: [week[0]!] } });
    expect(screen.getByText('05:15')).toBeDefined();
    expect(screen.getByText('05:00')).toBeDefined();
  });

  it('formats times in 12h when timeFormat is 12h', () => {
    render(WeeklyPrayerTable, { props: { ...defaultProps, days: [week[0]!], timeFormat: '12h' } });
    expect(screen.getByText('5:15 AM')).toBeDefined();
    expect(screen.getByText('5:00 AM')).toBeDefined();
    expect(screen.getByText('7:15 PM')).toBeDefined();
  });

  it('highlights the today row and shows the Today chip', () => {
    const { container } = render(WeeklyPrayerTable, { props: defaultProps });
    expect(screen.getByText('Today')).toBeDefined();
    const todayHeader = screen.getByRole('rowheader', { name: /Thu/ });
    expect(todayHeader.closest('tr')!.classList.contains('c-wt-today')).toBe(true);
    expect(container.querySelectorAll('.c-wt-today')).toHaveLength(1);
  });

  it('accents times that changed versus the previous day', () => {
    render(WeeklyPrayerTable, { props: defaultProps });
    // Wednesday Fajr iqaamah drifts 05:15 → 05:20
    const drifted = screen.getAllByText('05:20')[0]!;
    expect(drifted.style.color).toBe('var(--color-accent)');
    expect(drifted.style.opacity).toBe('1');
  });

  it('dims unchanged times after the first day', () => {
    render(WeeklyPrayerTable, { props: { ...defaultProps, days: [week[0]!, week[1]!] } });
    // Tuesday Dhuhr iqaamah unchanged vs Monday → dimmed
    const tuesdayDhuhr = screen.getAllByText('12:15')[1]!;
    expect(tuesdayDhuhr.style.opacity).toBe('0.3');
    // Monday (first day) always full strength
    const mondayDhuhr = screen.getAllByText('12:15')[0]!;
    expect(mondayDhuhr.style.opacity).toBe('1');
  });

  it('renders a dash for days with no data', () => {
    const { container } = render(WeeklyPrayerTable, {
      props: { ...defaultProps, days: [{ date: new Date('2026-07-27T12:00:00'), times: null }] },
    });
    expect(container.querySelectorAll('.c-wt-empty')).toHaveLength(5);
  });

  it('shows the secondary Asr time under the Asr cell', () => {
    render(WeeklyPrayerTable, {
      props: {
        ...defaultProps,
        days: [{ date: new Date('2026-07-27T12:00:00'), times: makeTimes(), asrSecondary: '16:45' }],
        asrSecondaryLabel: 'Asr (Shafi)',
      },
    });
    expect(screen.getByText('Asr (Shafi): 16:45')).toBeDefined();
  });
});
