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
  sunrise: '06:00',
  sunriseLabel: 'Sunrise',
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

  it('shows sunrise in the Fajr column', () => {
    render(PrayerBoard, { props: defaultProps });
    expect(screen.getByText('06:00')).toBeDefined();
  });

  it('highlights current prayer column', () => {
    const { container } = render(PrayerBoard, {
      props: { ...defaultProps, currentPrayerIndex: 2 },
    });
    expect(container.querySelector('.prayer-col-header--current')).toBeTruthy();
    expect(container.querySelectorAll('.prayer-cell--current').length).toBeGreaterThan(0);
  });

  it('flashes adhaan cells', () => {
    const { container } = render(PrayerBoard, {
      props: { ...defaultProps, flashAdhaan: 'fajr' },
    });
    const cells = container.querySelectorAll('.prayer-cell--flash');
    expect(cells.length).toBeGreaterThan(0);
  });
});