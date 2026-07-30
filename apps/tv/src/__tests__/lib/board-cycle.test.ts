import { describe, it, expect } from 'vitest';
import {
  getBoardPhase,
  boardCycleHoldoff,
  BOARD_TIMES_SECONDS,
  BOARD_CHANGES_SECONDS,
  BOARD_CYCLE_SECONDS,
  BOARD_ROLL_MS,
  IQAAMAH_HOLDOFF_MINUTES,
} from '$lib/board-cycle';

// ---------------------------------------------------------------------------
// Board roll cycle (Mishkaat, docs/design-language.md §7.5)
// ---------------------------------------------------------------------------

const roll = { hasChanges: true, holdoff: false };

describe('getBoardPhase', () => {
  it('spends the first 45s of each minute cycle on today\'s times', () => {
    expect(getBoardPhase(0, roll)).toBe('times');
    expect(getBoardPhase((BOARD_TIMES_SECONDS - 1) * 1000, roll)).toBe('times');
  });

  it('rolls to changes for the last 15s of each cycle', () => {
    expect(getBoardPhase(BOARD_TIMES_SECONDS * 1000, roll)).toBe('changes');
    expect(getBoardPhase((BOARD_CYCLE_SECONDS - 1) * 1000, roll)).toBe('changes');
  });

  it('wraps around every 60 seconds', () => {
    expect(getBoardPhase(BOARD_CYCLE_SECONDS * 1000, roll)).toBe('times');
    expect(getBoardPhase((BOARD_CYCLE_SECONDS + BOARD_TIMES_SECONDS) * 1000, roll)).toBe('changes');
    expect(getBoardPhase((BOARD_CYCLE_SECONDS * 10 + 5) * 1000, roll)).toBe('times');
  });

  it('never rolls when there are no upcoming changes', () => {
    expect(getBoardPhase(BOARD_TIMES_SECONDS * 1000, { ...roll, hasChanges: false })).toBe('times');
  });

  it('never rolls during the adhaan/iqaamah holdoff', () => {
    expect(getBoardPhase(BOARD_TIMES_SECONDS * 1000, { ...roll, holdoff: true })).toBe('times');
  });

  it('never rolls with reduced motion (§4 motion budget)', () => {
    expect(getBoardPhase(BOARD_TIMES_SECONDS * 1000, { ...roll, reducedMotion: true })).toBe(
      'times',
    );
  });
});

describe('boardCycleHoldoff', () => {
  const windows = [
    { adhaan: 4 * 60 + 21, iqaamah: 4 * 60 + 41 }, // Fajr
    { adhaan: 12 * 60 + 58, iqaamah: 13 * 60 + 10 }, // Dhuhr
    { adhaan: 21 * 60 + 33, iqaamah: 21 * 60 + 45 }, // Isha
  ];

  it('is clear before the adhaan', () => {
    expect(boardCycleHoldoff(12 * 60 + 30, windows)).toBe(false);
  });

  it('holds from the adhaan minute onward', () => {
    expect(boardCycleHoldoff(12 * 60 + 58, windows)).toBe(true);
    expect(boardCycleHoldoff(12 * 60 + 59, windows)).toBe(true);
  });

  it('holds between adhaan and iqaamah (the countdown window)', () => {
    expect(boardCycleHoldoff(13 * 60 + 5, windows)).toBe(true);
  });

  it('holds for 5 minutes after the iqaamah, then releases', () => {
    expect(boardCycleHoldoff(13 * 60 + 10, windows)).toBe(true);
    expect(boardCycleHoldoff(13 * 60 + 14, windows)).toBe(true);
    expect(boardCycleHoldoff(13 * 60 + 15, windows)).toBe(false);
  });

  it('is clear between prayers', () => {
    expect(boardCycleHoldoff(15 * 60, windows)).toBe(false);
  });

  it('respects a custom holdoff length', () => {
    expect(boardCycleHoldoff(13 * 60 + 11, windows, 1)).toBe(false);
    expect(boardCycleHoldoff(13 * 60 + 11, windows, 10)).toBe(true);
  });

  it('handles an empty window list', () => {
    expect(boardCycleHoldoff(12 * 60 + 58, [])).toBe(false);
  });
});

describe('cycle constants', () => {
  it('45s times + 15s changes = one minute', () => {
    expect(BOARD_TIMES_SECONDS).toBe(45);
    expect(BOARD_CHANGES_SECONDS).toBe(15);
    expect(BOARD_CYCLE_SECONDS).toBe(60);
  });

  it('roll transition stays inside the §4 motion budget (600–900ms)', () => {
    expect(BOARD_ROLL_MS).toBeGreaterThanOrEqual(600);
    expect(BOARD_ROLL_MS).toBeLessThanOrEqual(900);
  });

  it('iqaamah holdoff is 5 minutes', () => {
    expect(IQAAMAH_HOLDOFF_MINUTES).toBe(5);
  });
});
