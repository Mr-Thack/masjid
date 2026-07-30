import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  syncServerTime,
  serverNow,
  getServerOffsetMs,
  resetServerClock,
} from '$lib/server-clock';

// ---------------------------------------------------------------------------
// Server-synchronized clock (docs/design-language.md §7.7)
// ---------------------------------------------------------------------------

describe('server-clock', () => {
  beforeEach(() => {
    resetServerClock();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-29T12:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
    resetServerClock();
  });

  it('starts with zero offset (uncorrected local time)', () => {
    expect(getServerOffsetMs()).toBe(0);
    expect(serverNow().getTime()).toBe(Date.now());
  });

  it('computes a positive offset when the server is ahead', () => {
    // Server 3 minutes ahead of the TV clock.
    const serverIso = new Date(Date.now() + 3 * 60_000).toISOString();
    const offset = syncServerTime(serverIso);
    expect(offset).toBe(3 * 60_000);
    expect(getServerOffsetMs()).toBe(3 * 60_000);
    expect(serverNow().getTime()).toBe(Date.now() + 3 * 60_000);
  });

  it('computes a negative offset when the server is behind', () => {
    const serverIso = new Date(Date.now() - 90_000).toISOString();
    syncServerTime(serverIso);
    expect(getServerOffsetMs()).toBe(-90_000);
    expect(serverNow().getTime()).toBe(Date.now() - 90_000);
  });

  it('honors an explicit client timestamp (deterministic sync)', () => {
    const client = Date.parse('2026-07-29T12:00:00Z');
    const server = Date.parse('2026-07-29T12:05:30Z');
    expect(syncServerTime(new Date(server).toISOString(), client)).toBe(330_000);
  });

  it('keeps the previous offset for invalid input', () => {
    syncServerTime(new Date(Date.now() + 60_000).toISOString());
    expect(syncServerTime('not-a-date')).toBe(60_000);
    expect(syncServerTime(undefined)).toBe(60_000);
    expect(syncServerTime(null)).toBe(60_000);
    expect(syncServerTime(42)).toBe(60_000);
    expect(getServerOffsetMs()).toBe(60_000);
  });

  it('re-syncs replace the offset (each board refresh re-corrects)', () => {
    syncServerTime(new Date(Date.now() + 60_000).toISOString());
    syncServerTime(new Date(Date.now() - 30_000).toISOString());
    expect(getServerOffsetMs()).toBe(-30_000);
  });

  it('tracks time passing after a sync', () => {
    syncServerTime(new Date(Date.now() + 120_000).toISOString());
    vi.advanceTimersByTime(5_000);
    expect(serverNow().getTime()).toBe(Date.now() + 120_000);
  });

  it('resetServerClock returns to uncorrected time', () => {
    syncServerTime(new Date(Date.now() + 600_000).toISOString());
    resetServerClock();
    expect(getServerOffsetMs()).toBe(0);
    expect(serverNow().getTime()).toBe(Date.now());
  });
});
