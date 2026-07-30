import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import CeremonyOverlay from '$lib/components/CeremonyOverlay.svelte';

// ---------------------------------------------------------------------------
// Ceremony overlay (docs/design-language.md §7.6)
// ---------------------------------------------------------------------------

const baseProps = {
  prayer: 'dhuhr' as const,
  prayerLabel: 'Dhuhr',
  countdownEndsAtSeconds: null,
  now: new Date('2026-07-29T13:05:00'),
  adhaanLabel: 'Adhaan',
  iqaamahLabel: 'Iqaamah',
};

describe('CeremonyOverlay', () => {
  it('adhaan state: prayer name large + "Adhaan now" (§7.6.1)', () => {
    const { container } = render(CeremonyOverlay, { props: { ...baseProps, state: 'adhaan' as const } });
    expect(container.querySelector('[data-ceremony="adhaan"]')).toBeTruthy();
    expect(screen.getByText('Dhuhr')).toBeDefined();
    expect(screen.getByText('Adhaan now')).toBeDefined();
  });

  it('adhaan state localizes the label (Azaan now)', () => {
    render(CeremonyOverlay, {
      props: { ...baseProps, state: 'adhaan' as const, adhaanLabel: 'Azaan' },
    });
    expect(screen.getByText('Azaan now')).toBeDefined();
  });

  it('iqaamah-countdown state: serene full-screen countdown (§7.6.2)', () => {
    // now 13:05:00 → countdown ends 13:10:00 → 05:00 remaining.
    const { container } = render(CeremonyOverlay, {
      props: {
        ...baseProps,
        state: 'iqaamah-countdown' as const,
        countdownEndsAtSeconds: 13 * 3600 + 10 * 60,
      },
    });
    expect(container.querySelector('[data-ceremony="iqaamah-countdown"]')).toBeTruthy();
    expect(screen.getByText('Iqaamah in')).toBeDefined();
    expect(screen.getByText('05:00')).toBeDefined();
  });

  it('countdown pads and clamps correctly', () => {
    render(CeremonyOverlay, {
      props: {
        ...baseProps,
        state: 'iqaamah-countdown' as const,
        // 13:05:00 now → ends 13:05:07 → 00:07
        countdownEndsAtSeconds: 13 * 3600 + 5 * 60 + 7,
      },
    });
    expect(screen.getByText('00:07')).toBeDefined();
  });

  it('prayer-in-progress state tells latecomers (§7.6.3)', () => {
    const { container } = render(CeremonyOverlay, {
      props: { ...baseProps, state: 'prayer-in-progress' as const },
    });
    expect(container.querySelector('[data-ceremony="prayer-in-progress"]')).toBeTruthy();
    expect(screen.getByText('Prayer in progress')).toBeDefined();
    expect(screen.getByText('Dhuhr')).toBeDefined();
  });

  it('quiet state: near-black, prayer name + one line of dhikr (§7.6.4)', () => {
    const { container } = render(CeremonyOverlay, { props: { ...baseProps, state: 'quiet' as const } });
    const overlay = container.querySelector('[data-ceremony="quiet"]');
    expect(overlay).toBeTruthy();
    expect(overlay?.classList.contains('ceremony-overlay--dark')).toBe(true);
    expect(screen.getByText('Dhuhr')).toBeDefined();
    const dhikr = container.querySelector('.ceremony-dhikr');
    expect(dhikr?.getAttribute('dir')).toBe('rtl');
    expect(dhikr?.textContent).toContain('سُبْحَانَ');
  });

  it('night calm renders no overlay — the board stays readable under the page veil (§7.6.5)', () => {
    const { container } = render(CeremonyOverlay, {
      props: { ...baseProps, state: 'night-calm' as const },
    });
    expect(container.querySelector('.ceremony-overlay')).toBeNull();
  });

  it('renders nothing for the normal state', () => {
    const { container } = render(CeremonyOverlay, { props: { ...baseProps, state: 'normal' as const } });
    expect(container.querySelector('.ceremony-overlay')).toBeNull();
  });
});
