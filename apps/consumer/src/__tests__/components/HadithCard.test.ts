import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import HadithCard from '$lib/components/HadithCard.svelte';
import { HADITH_COLLECTION } from '@masjid/ui-utils';

const entry = HADITH_COLLECTION[0]!;

describe('HadithCard', () => {
  it('renders the Arabic text right-to-left with the display font hook', () => {
    render(HadithCard, { props: { entry } });
    const arabic = screen.getByText(entry.arabic);
    expect(arabic).toHaveAttribute('dir', 'rtl');
    expect(arabic).toHaveAttribute('lang', 'ar');
    expect(arabic.className).toContain('c-hadith-arabic');
  });

  it('renders the English translation and source', () => {
    render(HadithCard, { props: { entry } });
    expect(screen.getByText(entry.english)).toBeInTheDocument();
    expect(screen.getByText(entry.source)).toBeInTheDocument();
  });

  it('defaults to the "Hadith of the Day" label flanked by rosettes', () => {
    const { container } = render(HadithCard, { props: { entry } });
    const heading = screen.getByText('Hadith of the Day').closest('h2');
    expect(heading).not.toBeNull();
    expect(heading!.querySelectorAll('svg.rosette')).toHaveLength(2);
    expect(container.querySelector('.c-hadith-card')).not.toBeNull();
  });

  it('accepts a custom label', () => {
    render(HadithCard, { props: { entry, label: 'Daily Reminder' } });
    expect(screen.getByText('Daily Reminder')).toBeInTheDocument();
  });
});
