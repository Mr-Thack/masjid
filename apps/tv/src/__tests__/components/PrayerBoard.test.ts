import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import PrayerBoard from '$lib/components/PrayerBoard.svelte';

const mockTimes = [
  { key: 'fajr', label: 'Fajr', adhaan: '05:00', iqaamah: '05:15' },
  { key: 'dhuhr', label: 'Dhuhr', adhaan: '12:00', iqaamah: '12:15' },
  { key: 'asr', label: 'Asr', adhaan: '15:00', iqaamah: '15:15' },
  { key: 'maghrib', label: 'Maghrib', adhaan: '18:00', iqaamah: '18:05' },
  { key: 'isha', label: 'Isha', adhaan: '19:00', iqaamah: '19:15' },
];

const defaultProps = {
  times: mockTimes,
  currentPrayerIndex: null,
  flashAdhaan: null,
  flashIqaamah: null,
  adhaanLabel: 'Adhaan',
  iqaamahLabel: 'Iqaamah',
};

describe('PrayerBoard', () => {
  it('renders all prayer labels', () => {
    render(PrayerBoard, { props: defaultProps });
    expect(screen.getByText('Fajr')).toBeDefined();
    expect(screen.getByText('Dhuhr')).toBeDefined();
    expect(screen.getByText('Asr')).toBeDefined();
    expect(screen.getByText('Maghrib')).toBeDefined();
    expect(screen.getByText('Isha')).toBeDefined();
  });

  it('renders all adhaan times', () => {
    render(PrayerBoard, { props: defaultProps });
    expect(screen.getByText('05:00')).toBeDefined();
    expect(screen.getByText('12:00')).toBeDefined();
    expect(screen.getByText('15:00')).toBeDefined();
    expect(screen.getByText('18:00')).toBeDefined();
    expect(screen.getByText('19:00')).toBeDefined();
  });

  it('renders all iqaamah times', () => {
    render(PrayerBoard, { props: defaultProps });
    expect(screen.getByText('05:15')).toBeDefined();
    expect(screen.getByText('12:15')).toBeDefined();
    expect(screen.getByText('15:15')).toBeDefined();
    expect(screen.getByText('18:05')).toBeDefined();
    expect(screen.getByText('19:15')).toBeDefined();
  });

  it('renders the grid container', () => {
    const { container } = render(PrayerBoard, {
      props: { ...defaultProps, times: [] },
    });
    expect(container.querySelector('.prayer-grid')).toBeTruthy();
  });

  it('is fully visible on first render (no SSR opacity flash)', () => {
    const { container } = render(PrayerBoard, { props: defaultProps });
    const grid = container.querySelector('.prayer-grid');
    expect(grid).toBeTruthy();
    const style = (grid as HTMLElement)?.style;
    expect(style?.opacity).not.toBe('0');
  });

  it('does not render a sunrise row inside the board', () => {
    render(PrayerBoard, { props: defaultProps });
    expect(screen.queryByText('Sunrise')).toBeNull();
  });

  it('highlights the current prayer row', () => {
    const { container } = render(PrayerBoard, {
      props: { ...defaultProps, currentPrayerIndex: 2 },
    });
    const currentCells = container.querySelectorAll('.prayer-cell--current');
    expect(container.querySelector('.prayer-name--current')).toBeTruthy();
    expect(currentCells.length).toBe(2);
  });

  it('flashes adhaan cells', () => {
    const { container } = render(PrayerBoard, {
      props: { ...defaultProps, flashAdhaan: 'fajr' },
    });
    const cells = container.querySelectorAll('.prayer-cell--flash');
    expect(cells.length).toBeGreaterThan(0);
  });

  it('renders secondary Asr label and time on Asr row when provided', () => {
    const dualTimes = [
      { key: 'fajr', label: 'Fajr', adhaan: '05:00', iqaamah: '05:15' },
      { key: 'dhuhr', label: 'Dhuhr', adhaan: '12:00', iqaamah: '12:15' },
      { key: 'asr', label: 'Asr', adhaan: '18:00', iqaamah: '18:15', asrSecondary: '17:00', asrSecondaryLabel: 'Asr (Shafi)' },
      { key: 'maghrib', label: 'Maghrib', adhaan: '20:00', iqaamah: '20:05' },
      { key: 'isha', label: 'Isha', adhaan: '21:00', iqaamah: '21:15' },
    ];
    render(PrayerBoard, { props: { ...defaultProps, times: dualTimes } });
    expect(screen.getByText('Asr (Shafi) 17:00')).toBeDefined();
  });

  it('has no prayer-asr-secondary element when asrSecondary is not provided', () => {
    render(PrayerBoard, { props: defaultProps });
    // Text "Asr (Shafi)" or "Asr (Hanafi)" should not appear
    expect(screen.queryByText(/Asr \(/)).toBeNull();
  });
});

describe('PrayerBoard roll (Mishkaat changes cycle, §7.5)', () => {
  const changes = {
    fajr: { date: 'Fri, Aug 1', to: '05:20' },
    isha: { date: 'Sat, Aug 2', to: '19:10' },
  };

  it('stays on today\'s times during the times phase (tracks unshifted)', () => {
    const { container } = render(PrayerBoard, {
      props: { ...defaultProps, changes, phase: 'times' },
    });
    expect(container.querySelectorAll('.prayer-roll--shifted').length).toBe(0);
    expect(container.querySelector('.prayer-change-date')).toBeNull();
    // Two changed rows × two tracks + two header tracks; unchanged rows plain.
    expect(container.querySelectorAll('.prayer-roll').length).toBe(6);
  });

  it('shifts the tracks of changed rows during the changes phase', () => {
    const { container } = render(PrayerBoard, {
      props: { ...defaultProps, changes, phase: 'changes' },
    });
    // Two changed rows × two tracks + two header tracks.
    expect(container.querySelectorAll('.prayer-roll--shifted').length).toBe(6);
  });

  it('slides today\'s iqaamah into the adhaan column and raises the new iqaamah', () => {
    const { container } = render(PrayerBoard, {
      props: { ...defaultProps, changes, phase: 'changes' },
    });
    const rolls = container.querySelectorAll('.prayer-roll');
    // rolls[0..1] are the header tracks; Fajr's tracks come next.
    const fajrAdhaanTrack = rolls[2]!;
    expect(fajrAdhaanTrack.children[0]?.textContent).toBe('05:00');
    expect(fajrAdhaanTrack.children[1]?.textContent).toBe('05:15');
    // Fajr iqaamah track: [05:15] → [05:20 (new)]
    const fajrIqaamahTrack = rolls[3]!;
    expect(fajrIqaamahTrack.children[0]?.textContent).toContain('05:15');
    const newItem = fajrIqaamahTrack.children[1];
    expect(newItem?.textContent).toBe('05:20');
    expect(newItem?.classList.contains('prayer-roll-item--new')).toBe(true);
  });

  it('rolls the column headers with their columns', () => {
    const { container } = render(PrayerBoard, {
      props: { ...defaultProps, changes, phase: 'changes' },
    });
    const rolls = container.querySelectorAll('.prayer-roll');
    // Adhaan header track: [Adhaan] → [Iqaamah] (the column now holds iqaamahs).
    expect(rolls[0]?.children[0]?.textContent).toBe('Adhaan');
    expect(rolls[0]?.children[1]?.textContent).toBe('Iqaamah');
    // Iqaamah header track: [Iqaamah] → [New Iqaamah].
    expect(rolls[1]?.children[0]?.textContent).toBe('Iqaamah');
    const newHeader = rolls[1]?.children[1];
    expect(newHeader?.textContent).toBe('New Iqaamah');
    expect(newHeader?.classList.contains('prayer-roll-item--new')).toBe(true);
    expect(rolls[0]?.classList.contains('prayer-roll--shifted')).toBe(true);
    expect(rolls[1]?.classList.contains('prayer-roll--shifted')).toBe(true);
  });

  it('keeps the plain headers during the times phase', () => {
    const { container } = render(PrayerBoard, {
      props: { ...defaultProps, changes, phase: 'times' },
    });
    const rolls = container.querySelectorAll('.prayer-roll');
    expect(rolls[0]?.classList.contains('prayer-roll--shifted')).toBe(false);
    expect(rolls[1]?.classList.contains('prayer-roll--shifted')).toBe(false);
  });

  it('honors custom labels when rolling the headers', () => {
    render(PrayerBoard, {
      props: {
        ...defaultProps,
        adhaanLabel: 'Azaan',
        iqaamahLabel: 'Iqamah',
        changes,
        phase: 'changes',
      },
    });
    expect(screen.getByText('New Iqamah')).toBeDefined();
    expect(screen.getByText('Azaan')).toBeDefined();
  });

  it('shows the effective date under the prayer name only while rolling', () => {
    const { unmount } = render(PrayerBoard, {
      props: { ...defaultProps, changes, phase: 'changes' },
    });
    expect(screen.getByText('Fri, Aug 1')).toBeDefined();
    expect(screen.getByText('Sat, Aug 2')).toBeDefined();
    unmount();

    const { container } = render(PrayerBoard, {
      props: { ...defaultProps, changes, phase: 'times' },
    });
    expect(container.querySelector('.prayer-change-date')).toBeNull();
  });

  it('leaves unchanged rows as plain cells (no roll track)', () => {
    const { container } = render(PrayerBoard, {
      props: { ...defaultProps, changes, phase: 'changes' },
    });
    const names = Array.from(container.querySelectorAll('.prayer-name')).map((n) =>
      n.textContent?.trim(),
    );
    const dhuhrRow = names.findIndex((n) => n === 'Dhuhr');
    expect(dhuhrRow).toBeGreaterThan(-1);
    // Dhuhr (unchanged) contributes no roll tracks: 4 row tracks (Fajr+Isha) + 2 header tracks.
    expect(container.querySelectorAll('.prayer-roll').length).toBe(6);
  });

  it('renders no roll machinery at all without a changes map (Sakeenah path)', () => {
    const { container } = render(PrayerBoard, {
      props: { ...defaultProps, phase: 'changes' },
    });
    expect(container.querySelector('.prayer-roll')).toBeNull();
    expect(container.querySelector('.prayer-cell--roll')).toBeNull();
  });

  it('keeps the secondary Asr time inside the rolling iqaamah item', () => {
    const dualTimes = [
      { key: 'fajr', label: 'Fajr', adhaan: '05:00', iqaamah: '05:15' },
      { key: 'dhuhr', label: 'Dhuhr', adhaan: '12:00', iqaamah: '12:15' },
      { key: 'asr', label: 'Asr', adhaan: '18:00', iqaamah: '18:15', asrSecondary: '17:00', asrSecondaryLabel: 'Asr (Shafi)' },
      { key: 'maghrib', label: 'Maghrib', adhaan: '20:00', iqaamah: '20:05' },
      { key: 'isha', label: 'Isha', adhaan: '21:00', iqaamah: '21:15' },
    ];
    const { container } = render(PrayerBoard, {
      props: {
        ...defaultProps,
        times: dualTimes,
        changes: { asr: { date: 'Mon, Aug 4', to: '18:20' } },
        phase: 'changes',
      },
    });
    const rollItems = container.querySelectorAll('.prayer-roll-item');
    const firstIqaamahItem = Array.from(rollItems).find((el) =>
      el.textContent?.includes('Asr (Shafi)'),
    );
    expect(firstIqaamahItem).toBeTruthy();
    expect(firstIqaamahItem?.textContent).toContain('18:15');
  });
});