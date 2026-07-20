import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import AnnouncementBanner from '$lib/components/AnnouncementBanner.svelte';

describe('AnnouncementBanner', () => {
  it('renders nothing when announcement is null', () => {
    const { container } = render(AnnouncementBanner, {
      props: { announcement: null },
    });
    expect(container.textContent).toBe('');
  });

  it('renders the announcement title when present', () => {
    const { container } = render(AnnouncementBanner, {
      props: {
        announcement: { title: 'Eid Mubarak!', compiled_html: '<p>Eid Mubarak!</p>' },
      },
    });
    expect(container.textContent).toContain('Eid Mubarak!');
  });

  it('duplicates title for a continuous marquee track', () => {
    const { container } = render(AnnouncementBanner, {
      props: {
        announcement: { title: 'Important Notice', compiled_html: '<p>Notice</p>' },
      },
    });
    const track = container.querySelector('.announcement-track');
    expect(track).toBeTruthy();
    const matches = container.textContent?.match(/Important Notice/g);
    expect(matches).toHaveLength(2);
  });
});
