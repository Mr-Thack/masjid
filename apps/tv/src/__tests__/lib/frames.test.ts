import { describe, it, expect } from 'vitest';
import {
  buildFrames,
  getActiveFrameIndex,
  hadithTagsForContext,
  FRAME_DURATION_MS,
  FRAME_TRANSITION_MS,
  MAX_ANNOUNCEMENT_FRAMES,
} from '$lib/frames';

// ---------------------------------------------------------------------------
// Soul-column frame choreography (docs/design-language.md §7.5)
// ---------------------------------------------------------------------------

const fullInput = {
  jumuahSessionCount: 2,
  announcementCount: 3,
  changeCount: 2,
  donationUrl: 'https://example.com/donate',
  dayOfWeek: 3, // Wednesday
  enabledFrames: null,
};

describe('buildFrames', () => {
  it('builds the full inventory in priority order (§7.5)', () => {
    const frames = buildFrames(fullInput);
    expect(frames.map((f) => f.kind)).toEqual([
      'jumuah',
      'hadith',
      'announcements',
      'announcements',
      'announcements',
      'changes',
      'donate',
      'donate-qr',
    ]);
  });

  it('pins Jumu\'ah on Thursday and Friday', () => {
    const thursday = buildFrames({ ...fullInput, dayOfWeek: 4 });
    expect(thursday[0]).toMatchObject({ kind: 'jumuah', pinned: true });

    const friday = buildFrames({ ...fullInput, dayOfWeek: 5 });
    expect(friday[0]).toMatchObject({ kind: 'jumuah', pinned: true });
  });

  it('does not pin Jumu\'ah on other days (rotates normally)', () => {
    for (const dayOfWeek of [0, 1, 2, 3, 6]) {
      const frames = buildFrames({ ...fullInput, dayOfWeek });
      const jumuah = frames.find((f) => f.kind === 'jumuah');
      expect(jumuah?.pinned, `day ${dayOfWeek}`).toBe(false);
    }
  });

  it('suppresses empty frames (rule 4: no empty headers)', () => {
    const frames = buildFrames({
      jumuahSessionCount: 0,
      announcementCount: 0,
      changeCount: 0,
      donationUrl: null,
      dayOfWeek: 3,
      enabledFrames: null,
    });
    expect(frames.map((f) => f.kind)).toEqual(['hadith']);
  });

  it('suppresses the donate frames without a donation URL', () => {
    const frames = buildFrames({ ...fullInput, donationUrl: null });
    expect(frames.some((f) => f.kind === 'donate' || f.kind === 'donate-qr')).toBe(false);
  });

  it('suppresses the donate frames for an empty-string URL', () => {
    const frames = buildFrames({ ...fullInput, donationUrl: '' });
    expect(frames.some((f) => f.kind === 'donate' || f.kind === 'donate-qr')).toBe(false);
  });

  it('expands announcements one at a time with slot indexes', () => {
    const frames = buildFrames({ ...fullInput, announcementCount: 3 });
    const announcements = frames.filter((f) => f.kind === 'announcements');
    expect(announcements.map((f) => f.index)).toEqual([0, 1, 2]);
  });

  it('caps announcement frames at MAX_ANNOUNCEMENT_FRAMES', () => {
    const frames = buildFrames({ ...fullInput, announcementCount: 20 });
    expect(frames.filter((f) => f.kind === 'announcements').length).toBe(MAX_ANNOUNCEMENT_FRAMES);
  });

  it('honors the enabledFrames whitelist (style option)', () => {
    const frames = buildFrames({ ...fullInput, enabledFrames: ['hadith', 'donate'] });
    expect(frames.map((f) => f.kind)).toEqual(['hadith', 'donate', 'donate-qr']);
  });

  it('an empty enabledFrames list renders no frames at all', () => {
    expect(buildFrames({ ...fullInput, enabledFrames: [] })).toEqual([]);
  });

  it('keeps pinned frames first even when the whitelist reorders kinds', () => {
    const frames = buildFrames({
      ...fullInput,
      dayOfWeek: 5,
      enabledFrames: ['hadith', 'jumuah'],
    });
    expect(frames[0]).toMatchObject({ kind: 'jumuah', pinned: true });
  });
});

describe('getActiveFrameIndex', () => {
  it('returns -1 with no frames', () => {
    expect(getActiveFrameIndex(0, 0)).toBe(-1);
    expect(getActiveFrameIndex(0, 999_999)).toBe(-1);
  });

  it('starts at frame 0', () => {
    expect(getActiveFrameIndex(4, 0)).toBe(0);
  });

  it('advances one frame per duration', () => {
    expect(getActiveFrameIndex(4, FRAME_DURATION_MS - 1)).toBe(0);
    expect(getActiveFrameIndex(4, FRAME_DURATION_MS)).toBe(1);
    expect(getActiveFrameIndex(4, FRAME_DURATION_MS * 2)).toBe(2);
  });

  it('wraps around after the last frame', () => {
    expect(getActiveFrameIndex(3, FRAME_DURATION_MS * 3)).toBe(0);
    expect(getActiveFrameIndex(3, FRAME_DURATION_MS * 4)).toBe(1);
  });

  it('treats negative elapsed as the start', () => {
    expect(getActiveFrameIndex(3, -1000)).toBe(0);
  });
});

describe('motion budget constants (§4)', () => {
  it('frame cadence is within 15–30s', () => {
    expect(FRAME_DURATION_MS).toBeGreaterThanOrEqual(15_000);
    expect(FRAME_DURATION_MS).toBeLessThanOrEqual(30_000);
  });

  it('transition is within 600–900ms', () => {
    expect(FRAME_TRANSITION_MS).toBeGreaterThanOrEqual(600);
    expect(FRAME_TRANSITION_MS).toBeLessThanOrEqual(900);
  });
});

describe('hadithTagsForContext', () => {
  it('seeds jumuah hadith on Friday (§4)', () => {
    expect(hadithTagsForContext({ dayOfWeek: 5 })).toContain('jumuah');
    expect(hadithTagsForContext({ dayOfWeek: 4 })).not.toContain('jumuah');
  });

  it('seeds ramadan hadith in Ramadan', () => {
    expect(hadithTagsForContext({ dayOfWeek: 2, ramadan: true })).toContain('ramadan');
  });

  it('seeds fajr + prayer context at Fajr', () => {
    const tags = hadithTagsForContext({ dayOfWeek: 1, currentPrayer: 'fajr' });
    expect(tags).toContain('fajr');
    expect(tags).toContain('prayer');
  });

  it('seeds prayer context at other prayers', () => {
    const tags = hadithTagsForContext({ dayOfWeek: 1, currentPrayer: 'maghrib' });
    expect(tags).toContain('prayer');
    expect(tags).not.toContain('fajr');
  });

  it('returns empty tags for an ordinary mid-day', () => {
    expect(hadithTagsForContext({ dayOfWeek: 2, currentPrayer: null })).toEqual([]);
  });
});
