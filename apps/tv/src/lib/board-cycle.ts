/**
 * Prayer-board roll cycle (Mishkaat, docs/design-language.md §7.5).
 *
 * The prayer board spends most of its time on today's times, then briefly
 * rolls the rows with upcoming iqaamah changes into a "changes" reading
 * (old iqaamah slides into the adhaan column, new iqaamah rises in the
 * iqaamah column), then rolls back. The cycle is wall-clock anchored so a
 * TV that reloads mid-cycle lands in the right phase.
 *
 * The roll never happens around a prayer moment: from each adhaan until
 * IQAAMAH_HOLDOFF_MINUTES after the iqaamah, the board stays on today's
 * times (the congregation is watching the clock, not schedule trivia).
 */

export const BOARD_TIMES_SECONDS = 45;
export const BOARD_CHANGES_SECONDS = 15;
export const BOARD_CYCLE_SECONDS = BOARD_TIMES_SECONDS + BOARD_CHANGES_SECONDS;

/** Roll animation length — matches the soul-column frame transition (§4). */
export const BOARD_ROLL_MS = 750;

/** Minutes after an iqaamah during which the board still does not roll. */
export const IQAAMAH_HOLDOFF_MINUTES = 5;

export type BoardPhase = 'times' | 'changes';

export interface BoardCycleOptions {
  /** No upcoming changes → nothing to roll to, ever. */
  hasChanges: boolean;
  /** Inside an adhaan→iqaamah+holdoff window. */
  holdoff: boolean;
  /** Motion budget (§4): reduced motion pins the board to today's times. */
  reducedMotion?: boolean;
}

export function getBoardPhase(nowMs: number, opts: BoardCycleOptions): BoardPhase {
  if (!opts.hasChanges || opts.holdoff || opts.reducedMotion) return 'times';
  const seconds = Math.floor(nowMs / 1000);
  const position =
    ((seconds % BOARD_CYCLE_SECONDS) + BOARD_CYCLE_SECONDS) % BOARD_CYCLE_SECONDS;
  return position < BOARD_TIMES_SECONDS ? 'times' : 'changes';
}

/**
 * True while `nowMinutes` sits inside any prayer's protected window:
 * [adhaan, iqaamah + holdoffMinutes). Windows are local minutes since
 * midnight (same shape as the ceremony prayer windows).
 */
export function boardCycleHoldoff(
  nowMinutes: number,
  windows: Array<{ adhaan: number; iqaamah: number }>,
  holdoffMinutes: number = IQAAMAH_HOLDOFF_MINUTES,
): boolean {
  return windows.some((w) => nowMinutes >= w.adhaan && nowMinutes < w.iqaamah + holdoffMinutes);
}
