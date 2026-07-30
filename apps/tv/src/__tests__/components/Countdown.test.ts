import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import Countdown from '$lib/components/Countdown.svelte';

function makeTimeNearNow(offsetMinutes: number): string {
  const d = new Date();
  d.setMinutes(d.getMinutes() + offsetMinutes);
  const h = d.getHours();
  const m = d.getMinutes();
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

describe('Countdown', () => {
  it('shows MM:SS format when under 1 hour', () => {
    const near = makeTimeNearNow(2);
    render(Countdown, { props: { nextPrayerIqaamah: near } });
    expect(screen.getByText(/^\d{2}:\d{2}$/)).toBeDefined();
  });

  it('shows Xh Ym format for longer durations', () => {
    // Use a relative time so the test is deterministic at any time of day
    // (a hardcoded '01:00' is under an hour away when run between 00:00–01:00).
    const far = makeTimeNearNow(150);
    render(Countdown, { props: { nextPrayerIqaamah: far } });
    expect(screen.getByText(/\d+h \d{2}m/)).toBeDefined();
  });

  it('handles invalid input gracefully', () => {
    render(Countdown, { props: { nextPrayerIqaamah: '--:--' } });
    expect(screen.getByText('--:--')).toBeDefined();
  });

  it('parses 12h formatted times correctly', () => {
    render(Countdown, { props: { nextPrayerIqaamah: '2:00 PM' } });
    expect(screen.getByText(/\d+h \d{2}m|\d{2}:\d{2}/)).toBeDefined();
  });

  it('renders as a span with countdown-time class', () => {
    const { container } = render(Countdown, { props: { nextPrayerIqaamah: '12:00' } });
    expect(container.querySelector('.countdown-time')).toBeTruthy();
  });
});