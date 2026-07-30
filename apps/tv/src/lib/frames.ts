import type { HadithTag } from '@masjid/ui-utils';

/**
 * Soul-column frames (docs/design-language.md §7.5).
 *
 * The soul column hosts exactly one visible frame at a time; the prayer
 * board and clock never move. Frames with no content do not render — an
 * empty "JUMU'AH SESSIONS" header must be impossible.
 *
 * Upcoming iqaamah changes are NOT a frame: they roll through the prayer
 * board itself (see board-cycle.ts).
 */

export type FrameKind = 'jumuah' | 'hadith' | 'announcements' | 'donate' | 'donate-qr';

export interface Frame {
  kind: FrameKind;
  /** Pinned frames lead the rotation (Jumu'ah on Thursday–Friday). */
  pinned: boolean;
  /** Slot index for multi-instance kinds (one announcement per frame). */
  index?: number;
}

export interface FrameInput {
  jumuahSessionCount: number;
  announcementCount: number;
  donationUrl: string | null;
  /** Local weekday: 0 = Sunday … 4 = Thursday, 5 = Friday. */
  dayOfWeek: number;
  /** Style option whitelist of enabled frame kinds; null/undefined = all. */
  enabledFrames?: string[] | null;
}

/** Announcements rotate one at a time; cap keeps the full cycle watchable. */
export const MAX_ANNOUNCEMENT_FRAMES = 5;

/** Motion budget (§4): 15–30s cadence, 600–900ms transitions. */
export const FRAME_DURATION_MS = 20_000;
export const FRAME_TRANSITION_MS = 750;

export function buildFrames(input: FrameInput): Frame[] {
  const enabled = (kind: FrameKind): boolean =>
    !input.enabledFrames || input.enabledFrames.includes(kind);

  const frames: Frame[] = [];

  if (input.jumuahSessionCount > 0 && enabled('jumuah')) {
    frames.push({ kind: 'jumuah', pinned: input.dayOfWeek === 4 || input.dayOfWeek === 5 });
  }
  // The hadith frame is never empty (built-in curated collection).
  if (enabled('hadith')) {
    frames.push({ kind: 'hadith', pinned: false });
  }
  if (input.announcementCount > 0 && enabled('announcements')) {
    const count = Math.min(input.announcementCount, MAX_ANNOUNCEMENT_FRAMES);
    for (let i = 0; i < count; i++) {
      frames.push({ kind: 'announcements', pinned: false, index: i });
    }
  }
  // Donate is two separate slides: the appeal text, then the QR code.
  // Together in one frame was visually too much (§4 ornament budget).
  if (input.donationUrl && enabled('donate')) {
    frames.push({ kind: 'donate', pinned: false }, { kind: 'donate-qr', pinned: false });
  }

  // Pinned frames lead the rotation; relative order otherwise preserved.
  return frames.sort((a, b) => Number(b.pinned) - Number(a.pinned));
}

/** Rotating frame index; -1 when there is nothing to show. */
export function getActiveFrameIndex(
  frameCount: number,
  elapsedMs: number,
  frameDurationMs: number = FRAME_DURATION_MS,
): number {
  if (frameCount <= 0) return -1;
  if (elapsedMs < 0) return 0;
  return Math.floor(elapsedMs / frameDurationMs) % frameCount;
}

/**
 * Occasion tags for context-seeded hadith (§4: Fajr virtues at Fajr,
 * Jumu'ah hadith on Friday, Ramadan hadith in Ramadan).
 */
export function hadithTagsForContext(ctx: {
  dayOfWeek: number;
  ramadan?: boolean;
  currentPrayer?: string | null;
}): HadithTag[] {
  const tags: HadithTag[] = [];
  if (ctx.dayOfWeek === 5) tags.push('jumuah');
  if (ctx.ramadan) tags.push('ramadan');
  if (ctx.currentPrayer === 'fajr') tags.push('fajr');
  if (ctx.currentPrayer) tags.push('prayer');
  return tags;
}
