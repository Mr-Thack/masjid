import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import PrayerCard from '$lib/components/PrayerCard.svelte';

describe('PrayerCard', () => {
  const defaultProps = {
    name: 'Fajr',
    adhaan: '05:00',
    iqaamah: '05:15',
  };

  it('renders the prayer name', () => {
    render(PrayerCard, { props: defaultProps });
    expect(screen.getByText('Fajr')).toBeDefined();
  });

  it('renders the adhaan time', () => {
    render(PrayerCard, { props: defaultProps });
    expect(screen.getByText('05:00')).toBeDefined();
  });

  it('renders the iqaamah time', () => {
    render(PrayerCard, { props: defaultProps });
    expect(screen.getByText('05:15')).toBeDefined();
  });

  it('shows "Next" badge when isNext is true', () => {
    render(PrayerCard, { props: { ...defaultProps, isNext: true } });
    expect(screen.getByText('Next')).toBeDefined();
  });

  it('hides "Next" badge when isNext is false', () => {
    render(PrayerCard, { props: { ...defaultProps, isNext: false } });
    expect(screen.queryByText('Next')).toBeNull();
  });

  it('has reduced opacity when isPast is true', () => {
    render(PrayerCard, { props: { ...defaultProps, isPast: true } });
    const card = screen.getByText('Fajr').closest('.glass-card');
    expect(card?.classList.contains('opacity-40')).toBe(true);
  });

  it('has full opacity when isPast is false', () => {
    render(PrayerCard, { props: { ...defaultProps, isPast: false } });
    const card = screen.getByText('Fajr').closest('.glass-card');
    expect(card?.classList.contains('opacity-100')).toBe(true);
  });

  it('renders secondary Asr time when asrSecondary and asrSecondaryLabel are provided', () => {
    render(PrayerCard, {
      props: {
        name: 'Asr',
        adhaan: '17:00',
        iqaamah: '17:30',
        asrSecondary: '16:45',
        asrSecondaryLabel: 'Asr (Shafi)',
      },
    });
    expect(screen.getByText('Asr (Shafi): 16:45')).toBeDefined();
  });

  it('does not render secondary Asr time when asrSecondary is not provided', () => {
    render(PrayerCard, {
      props: { name: 'Asr', adhaan: '17:00', iqaamah: '17:30' },
    });
    expect(screen.queryByText(/Asr \(Shafi\)/)).toBeNull();
    expect(screen.queryByText(/Asr \(Hanafi\)/)).toBeNull();
  });

  it('renders secondary Asr with fallback label when asrSecondaryLabel is not provided', () => {
    render(PrayerCard, {
      props: {
        name: 'Asr',
        adhaan: '17:00',
        iqaamah: '17:30',
        asrSecondary: '16:45',
      },
    });
    expect(screen.getByText('Asr: 16:45')).toBeDefined();
  });

  describe('rosetteMarker (Mishkaat)', () => {
    it('renders the rosette marker on the current prayer when enabled', () => {
      const { container } = render(PrayerCard, {
        props: { ...defaultProps, isCurrent: true, rosetteMarker: true },
      });
      expect(container.querySelector('.c-prayer-rosette svg.rosette')).not.toBeNull();
    });

    it('does not render the rosette when the card is not current', () => {
      const { container } = render(PrayerCard, {
        props: { ...defaultProps, isNext: true, rosetteMarker: true },
      });
      expect(container.querySelector('.c-prayer-rosette')).toBeNull();
    });

    it('does not render the rosette when rosetteMarker is off (Sakeenah)', () => {
      const { container } = render(PrayerCard, {
        props: { ...defaultProps, isCurrent: true },
      });
      expect(container.querySelector('.c-prayer-rosette')).toBeNull();
    });
  });
});