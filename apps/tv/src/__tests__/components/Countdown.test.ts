import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import Countdown from '$lib/components/Countdown.svelte';
import { vi } from 'vitest';

describe('Countdown', () => {
  it('renders the countdown label', () => {
    render(Countdown, { props: { nextPrayerIqaamah: '12:30' } });
    expect(screen.getByText('Next Prayer in')).toBeDefined();
  });

  it('renders a time display', () => {
    render(Countdown, { props: { nextPrayerIqaamah: '12:30' } });
    const display = screen.getByText(/^\d{2}:\d{2}:\d{2}$/);
    expect(display).toBeDefined();
  });

  it('handles invalid input gracefully', () => {
    render(Countdown, { props: { nextPrayerIqaamah: '--:--' } });
    expect(screen.getByText('Next Prayer in')).toBeDefined();
  });

  it('renders time in HH:MM:SS format', () => {
    render(Countdown, { props: { nextPrayerIqaamah: '00:00' } });
    const display = screen.getByText(/^\d{2}:\d{2}:\d{2}$/);
    expect(display).toBeDefined();
  });
});