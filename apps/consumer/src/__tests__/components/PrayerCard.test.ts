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
});