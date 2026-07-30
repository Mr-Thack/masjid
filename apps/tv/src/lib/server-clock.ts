/**
 * Server-synchronized clock (docs/design-language.md §7.7).
 *
 * Smart-TV hardware clocks drift by minutes, and every ceremony state depends
 * on honest time. The board payload carries `server_time`; we keep an offset
 * between the server epoch and the local epoch and correct every reading.
 *
 * Note: one-way network latency makes the offset slightly stale (typically
 * <1s on a LAN), which is immaterial for minute-level drift correction.
 */

let offsetMs = 0;

/**
 * Record the server time from a board payload. Returns the new offset in ms
 * (server − client). Invalid input keeps the previous offset.
 */
export function syncServerTime(serverTimeIso: unknown, clientNowMs?: number): number {
  if (typeof serverTimeIso !== 'string') return offsetMs;
  const serverMs = Date.parse(serverTimeIso);
  if (!Number.isFinite(serverMs)) return offsetMs;
  const clientMs = clientNowMs ?? Date.now();
  offsetMs = serverMs - clientMs;
  return offsetMs;
}

/** Current time corrected against the server clock. */
export function serverNow(): Date {
  return new Date(Date.now() + offsetMs);
}

/** Current offset in ms (server − client). Exposed for diagnostics/tests. */
export function getServerOffsetMs(): number {
  return offsetMs;
}

/** Reset to uncorrected local time (used by tests). */
export function resetServerClock(): void {
  offsetMs = 0;
}
