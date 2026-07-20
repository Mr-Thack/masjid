import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import AnnouncementCard from '$lib/components/AnnouncementCard.svelte';

const mockAnnouncement = {
  id: '1',
  masjid_id: 'm1',
  title: 'Eid Prayer',
  slug: 'eid-prayer',
  compiled_html: '<p>Join us for Eid prayer at 8am</p>',
  status: 'published' as const,
  is_pinned: false,
  published_at: '2026-03-15T10:00:00Z',
  expires_at: null,
  created_at: '2026-03-15T10:00:00Z',
  updated_at: '2026-03-15T10:00:00Z',
};

describe('AnnouncementCard', () => {
  it('renders the announcement title', () => {
    render(AnnouncementCard, { props: { announcement: mockAnnouncement } });
    expect(screen.getByText('Eid Prayer')).toBeDefined();
  });

  it('renders the published date', () => {
    render(AnnouncementCard, { props: { announcement: mockAnnouncement } });
    expect(screen.getByText('Mar 15, 2026')).toBeDefined();
  });

  it('shows "Pinned" badge when is_pinned is true', () => {
    render(AnnouncementCard, {
      props: {
        announcement: { ...mockAnnouncement, is_pinned: true },
      },
    });
    expect(screen.getByText('Pinned')).toBeDefined();
  });

  it('hides content by default', () => {
    const { container } = render(AnnouncementCard, { props: { announcement: mockAnnouncement } });
    const content = container.querySelector('.hidden');
    expect(content).toBeTruthy();
    expect(content?.classList.contains('hidden')).toBe(true);
  });

  it('shows content on click', async () => {
    render(AnnouncementCard, { props: { announcement: mockAnnouncement } });
    const card = screen.getByRole('button');
    await fireEvent.click(card);
    expect(screen.getByText('Join us for Eid prayer at 8am')).toBeDefined();
  });

  it('toggles content on click', async () => {
    const { container } = render(AnnouncementCard, { props: { announcement: mockAnnouncement } });
    const card = screen.getByRole('button');

    await fireEvent.click(card);
    let content = container.querySelector('.hidden');
    expect(content).toBeNull();

    await fireEvent.click(card);
    content = container.querySelector('.hidden');
    expect(content).toBeTruthy();
  });

  it('expands on Enter key', async () => {
    render(AnnouncementCard, { props: { announcement: mockAnnouncement } });
    const card = screen.getByRole('button');
    await fireEvent.keyDown(card, { key: 'Enter' });
    expect(screen.getByText('Join us for Eid prayer at 8am')).toBeDefined();
  });

  it('expands on Space key', async () => {
    render(AnnouncementCard, { props: { announcement: mockAnnouncement } });
    const card = screen.getByRole('button');
    await fireEvent.keyDown(card, { key: ' ' });
    expect(screen.getByText('Join us for Eid prayer at 8am')).toBeDefined();
  });
});