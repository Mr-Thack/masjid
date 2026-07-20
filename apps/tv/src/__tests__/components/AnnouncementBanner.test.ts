import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import AnnouncementBanner from '$lib/components/AnnouncementBanner.svelte';

describe('AnnouncementBanner', () => {
  it('renders nothing when announcement is null', () => {
    const { container } = render(AnnouncementBanner, {
      props: { announcement: null, accentColor: '#10b981' },
    });
    expect(container.textContent).toBe('');
  });

  it('renders the announcement title when present', () => {
    const { container } = render(AnnouncementBanner, {
      props: {
        announcement: { title: 'Eid Mubarak!', compiled_html: '<p>Eid Mubarak!</p>' },
        accentColor: '#10b981',
      },
    });
    expect(container.textContent).toContain('Eid Mubarak!');
  });

  it('renders title twice (marquee technique)', () => {
    const { container } = render(AnnouncementBanner, {
      props: {
        announcement: { title: 'Important Notice', compiled_html: '<p>Notice</p>' },
        accentColor: '#10b981',
      },
    });
    const matches = container.textContent?.match(/Important Notice/g);
    expect(matches).toHaveLength(2);
  });
});