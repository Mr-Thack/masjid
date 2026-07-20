import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import DonateButton from '$lib/components/DonateButton.svelte';

describe('DonateButton', () => {
  it('renders nothing when url is null', () => {
    const { container } = render(DonateButton, {
      props: { url: null },
    });
    expect(container.textContent).toBe('');
  });

  it('renders a link with the correct href', () => {
    render(DonateButton, {
      props: { url: 'https://donate.example.org', accentColor: '#10b981' },
    });
    const link = screen.getByRole('link');
    expect(link).toBeDefined();
    expect(link.getAttribute('href')).toBe('https://donate.example.org');
  });

  it('renders the support text', () => {
    render(DonateButton, {
      props: { url: 'https://donate.example.org', accentColor: '#10b981' },
    });
    expect(screen.getByText('Support This Masjid')).toBeDefined();
  });

  it('has target=_blank and rel=noopener', () => {
    render(DonateButton, {
      props: { url: 'https://donate.example.org', accentColor: '#10b981' },
    });
    const link = screen.getByRole('link');
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toBe('noopener noreferrer');
  });
});