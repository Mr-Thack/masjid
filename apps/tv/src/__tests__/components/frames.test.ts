import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import HadithFrame from '$lib/components/HadithFrame.svelte';
import AnnouncementFrame from '$lib/components/AnnouncementFrame.svelte';
import ChangesFrame from '$lib/components/ChangesFrame.svelte';
import DonateFrame from '$lib/components/DonateFrame.svelte';
import QrFrame from '$lib/components/QrFrame.svelte';
import JumuahFrame from '$lib/components/JumuahFrame.svelte';
import SoulColumn from '$lib/components/SoulColumn.svelte';
import { FRAME_DURATION_MS } from '$lib/frames';
import type { Frame } from '$lib/frames';

// ---------------------------------------------------------------------------
// Frame components + SoulColumn rotation host (docs/design-language.md §7.5)
// ---------------------------------------------------------------------------

const hadithFixture = {
  arabic: 'إِنَّمَا الْأَعْمَالُ بِالنِّيَّاتِ',
  english: 'Actions are but by intentions.',
  source: 'Sahih al-Bukhari 1',
};

const soulProps = {
  hadith: hadithFixture,
  jumuahSessions: [
    { id: 'j1', label: 'First khutbah', time: '1:30 PM', khateeb: 'Imam Abdullah', speech_time: '1:00 PM' },
  ],
  jumuahLabel: "Jumu'ah",
  speechLabel: 'Speech',
  announcements: [
    { title: 'Iftar this Saturday', html: '<p>Join us for iftar.</p>' },
    { title: 'Eid prayer at 8 AM', html: null },
  ],
  changes: [{ date: 'Fri, Aug 1', label: 'Fajr', from: '5:55 AM', to: '5:56 AM' }],
  donationUrl: 'https://example.com/donate',
  appeal: 'Every contribution makes a difference',
};

describe('HadithFrame', () => {
  it('renders Arabic (RTL, Amiri), English, and source', () => {
    const { container } = render(HadithFrame, { props: hadithFixture });
    const arabic = container.querySelector('.frame-hadith-arabic');
    expect(arabic?.getAttribute('dir')).toBe('rtl');
    expect(arabic?.getAttribute('lang')).toBe('ar');
    expect(arabic?.textContent).toContain('الْأَعْمَالُ');
    expect(screen.getByText('Actions are but by intentions.')).toBeDefined();
    expect(screen.getByText('Sahih al-Bukhari 1')).toBeDefined();
    expect(screen.getByText('Hadith of the Day')).toBeDefined();
  });
});

describe('AnnouncementFrame', () => {
  it('renders the title and compiled html body', () => {
    const { container } = render(AnnouncementFrame, {
      props: { title: 'Iftar this Saturday', html: '<p>Join us for iftar.</p>' },
    });
    expect(screen.getByText('Iftar this Saturday')).toBeDefined();
    expect(container.querySelector('.frame-announcement-body')?.innerHTML).toContain('Join us');
  });

  it('renders without a body when html is null', () => {
    const { container } = render(AnnouncementFrame, {
      props: { title: 'Eid prayer at 8 AM', html: null },
    });
    expect(screen.getByText('Eid prayer at 8 AM')).toBeDefined();
    expect(container.querySelector('.frame-announcement-body')).toBeNull();
  });
});

describe('ChangesFrame', () => {
  it('renders each schedule change row', () => {
    render(ChangesFrame, {
      props: {
        changes: [
          { date: 'Fri, Aug 1', label: 'Fajr', from: '5:55 AM', to: '5:56 AM' },
          { date: 'Sat, Aug 2', label: 'Isha', from: '9:45 PM', to: '9:40 PM' },
        ],
      },
    });
    expect(screen.getByText('Schedule Changes')).toBeDefined();
    expect(screen.getByText('Fajr')).toBeDefined();
    expect(screen.getByText('Isha')).toBeDefined();
    expect(screen.getByText('5:56 AM')).toBeDefined();
  });
});

describe('DonateFrame', () => {
  it('renders the appeal wording and cleaned URL — no QR (that is QrFrame)', () => {
    render(DonateFrame, {
      props: { url: 'https://example.com/donate', appeal: 'Every contribution makes a difference' },
    });
    expect(screen.getByText('Support Your Masjid')).toBeDefined();
    expect(screen.getByText('Every contribution makes a difference')).toBeDefined();
    expect(screen.getByText('example.com/donate')).toBeDefined();
    expect(screen.queryByTestId('donate-qr')).toBeNull();
  });

  it('honors admin-customized appeal wording (donateAppeal style option)', () => {
    render(DonateFrame, {
      props: { url: 'https://example.com/donate', appeal: 'Keep our doors open' },
    });
    expect(screen.getByText('Keep our doors open')).toBeDefined();
  });
});

describe('QrFrame', () => {
  it('renders the scan-to-give QR code SVG as its own slide', async () => {
    render(QrFrame, { props: { url: 'https://example.com/donate' } });
    expect(screen.getByText('Scan to Give')).toBeDefined();
    const qr = await screen.findByTestId('donate-qr');
    expect(qr.innerHTML).toContain('<svg');
  });
});

describe('JumuahFrame', () => {
  it('renders the session list via JumuahNotice', () => {
    render(JumuahFrame, {
      props: {
        sessions: soulProps.jumuahSessions,
        label: "Jumu'ah",
        speechLabel: 'Speech',
      },
    });
    expect(screen.getByText('1:30 PM')).toBeDefined();
    expect(screen.getByText(/Imam Abdullah/)).toBeDefined();
  });
});

describe('SoulColumn', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  const frames: Frame[] = [
    { kind: 'jumuah', pinned: false },
    { kind: 'hadith', pinned: false },
    { kind: 'announcements', pinned: false, index: 0 },
    { kind: 'announcements', pinned: false, index: 1 },
    { kind: 'changes', pinned: false },
    { kind: 'donate', pinned: false },
    { kind: 'donate-qr', pinned: false },
  ];

  it('renders the highest-priority frame first', () => {
    const { container } = render(SoulColumn, { props: { frames, ...soulProps } });
    expect(container.querySelector('[data-frame-kind="jumuah"]')).toBeTruthy();
  });

  it('rotates to the next frame after the frame duration', async () => {
    const { container } = render(SoulColumn, { props: { frames, ...soulProps } });
    expect(container.querySelector('[data-frame-kind="jumuah"]')).toBeTruthy();

    await vi.advanceTimersByTimeAsync(FRAME_DURATION_MS + 100);
    expect(container.querySelector('[data-frame-kind="hadith"]')).toBeTruthy();
  });

  it('shows announcements one at a time by slot index', async () => {
    const { container } = render(SoulColumn, { props: { frames, ...soulProps } });
    await vi.advanceTimersByTimeAsync(FRAME_DURATION_MS * 2 + 100);
    const first = container.querySelector('[data-frame-kind="announcements"]');
    expect(first?.getAttribute('data-frame-index')).toBe('0');
    expect(screen.getByText('Iftar this Saturday')).toBeDefined();

    await vi.advanceTimersByTimeAsync(FRAME_DURATION_MS + 100);
    const second = container.querySelector('[data-frame-kind="announcements"]');
    expect(second?.getAttribute('data-frame-index')).toBe('1');
    expect(screen.getByText('Eid prayer at 8 AM')).toBeDefined();
  });

  it('wraps back to the first frame after the last', async () => {
    const { container } = render(SoulColumn, { props: { frames, ...soulProps } });
    await vi.advanceTimersByTimeAsync(FRAME_DURATION_MS * frames.length + 100);
    expect(container.querySelector('[data-frame-kind="jumuah"]')).toBeTruthy();
  });

  it('does not rotate with reduced motion (§7.5 rule 6)', async () => {
    const { container } = render(SoulColumn, {
      props: { frames, reducedMotion: true, ...soulProps },
    });
    expect(container.querySelector('[data-frame-kind="jumuah"]')).toBeTruthy();
    await vi.advanceTimersByTimeAsync(FRAME_DURATION_MS * 3 + 100);
    // Still the single highest-priority frame, statically.
    expect(container.querySelector('[data-frame-kind="jumuah"]')).toBeTruthy();
    expect(container.querySelectorAll('.soul-frame').length).toBe(1);
  });

  it('renders nothing when there are no frames', () => {
    const { container } = render(SoulColumn, { props: { frames: [], ...soulProps } });
    expect(container.querySelector('.soul-frames')).toBeNull();
  });

  it('renders a single frame statically without rotating', async () => {
    const { container } = render(SoulColumn, {
      props: { frames: [{ kind: 'hadith', pinned: false }], ...soulProps },
    });
    expect(container.querySelector('[data-frame-kind="hadith"]')).toBeTruthy();
    await vi.advanceTimersByTimeAsync(FRAME_DURATION_MS * 2 + 100);
    expect(container.querySelectorAll('.soul-frame').length).toBe(1);
    expect(container.querySelector('[data-frame-kind="hadith"]')).toBeTruthy();
  });
});
