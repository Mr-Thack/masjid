import { describe, it, expect } from 'vitest';

// ---------------------------------------------------------------------------
// Dual Asr integration tests — hits the running API server
//
// Requires: `npm run dev --workspace=@masjid/api` on port 5173
// Requires: seeded DB (run `npx tsx tooling/seed.ts` first)
//
// Verifies:
//   - Masjid Al-Jabal (show_dual_asr=true, asr_madhab=hanafi)
//     returns asr_secondary in all three public endpoints
//   - Masjid Al-Noor (show_dual_asr=false, asr_madhab=shafi)
//     returns null asr_secondary in all three public endpoints
// ---------------------------------------------------------------------------

const BASE = 'http://localhost:5173/api/v1/masjids';
const NOOR_SLUG = 'masjid-al-noor';
const JABAL_SLUG = 'masjid-al-jabal';

async function json(url: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.json();
}

// ---------------------------------------------------------------------------
describe('Dual Asr — public page endpoint', () => {
  it('Al-Jabal (dual Asr enabled) returns non-null asr_secondary', async () => {
    const data = await json(`${BASE}/${JABAL_SLUG}`);
    expect(data.prayer_times.asr_secondary).toBeTruthy();
    expect(data.prayer_times.asr_secondary).toMatch(/^\d{2}:\d{2}$/);
    expect(data.masjid.asr_madhab).toBe('hanafi');
  });

  it('Al-Noor (dual Asr disabled) returns null asr_secondary', async () => {
    const data = await json(`${BASE}/${NOOR_SLUG}`);
    expect(data.prayer_times.asr_secondary).toBeNull();
    expect(data.masjid.asr_madhab).toBe('shafi');
  });
});

// ---------------------------------------------------------------------------
describe('Dual Asr — prayer times endpoint', () => {
  it('Al-Jabal returns non-null asr_secondary', async () => {
    const data = await json(`${BASE}/${JABAL_SLUG}/prayer`);
    expect(data.times.asr_secondary).toBeTruthy();
    expect(data.times.asr_secondary).toMatch(/^\d{2}:\d{2}$/);
  });

  it('Al-Noor returns null asr_secondary', async () => {
    const data = await json(`${BASE}/${NOOR_SLUG}/prayer`);
    expect(data.times.asr_secondary).toBeNull();
  });
});

// ---------------------------------------------------------------------------
describe('Dual Asr — board endpoint (TV)', () => {
  it('Al-Jabal returns non-null asr_secondary on today.times', async () => {
    const data = await json(`${BASE}/${JABAL_SLUG}/board`);
    expect(data.today.times.asr_secondary).toBeTruthy();
    expect(data.today.times.asr_secondary).toMatch(/^\d{2}:\d{2}$/);
    expect(data.masjid.asr_madhab).toBe('hanafi');
  });

  it('Al-Noor returns undefined/null for asr_secondary on today.times', async () => {
    const data = await json(`${BASE}/${NOOR_SLUG}/board`);
    expect(data.today.times.asr_secondary).toBeFalsy();
    expect(data.masjid.asr_madhab).toBe('shafi');
  });
});

// ---------------------------------------------------------------------------
describe('Dual Asr — hanafi vs shafi time difference', () => {
  it('Al-Jabal secondary Asr (Shafi) is earlier than primary Asr (Hanafi)', async () => {
    const data = await json(`${BASE}/${JABAL_SLUG}`);
    const primary = data.prayer_times.asr.iqaamah;
    const secondary = data.prayer_times.asr_secondary;
    // Hanafi Asr is always later than Shafi Asr
    expect(primary > secondary).toBe(true);
  });
});