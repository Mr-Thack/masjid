import { describe, it, expect } from 'vitest';
import {
  HADITH_COLLECTION,
  dayOfYear,
  getHadithOfTheDay,
  type HadithTag,
} from '@masjid/ui-utils';

// ---------------------------------------------------------------------------
// Curated hadith collection + date-seeded rotation (docs/design-language.md
// §4 content rules, §7.5)
// ---------------------------------------------------------------------------

const VALID_TAGS: HadithTag[] = [
  'general',
  'prayer',
  'fajr',
  'jumuah',
  'ramadan',
  'knowledge',
  'character',
  'community',
];

describe('HADITH_COLLECTION integrity', () => {
  it('has enough entries for varied daily rotation', () => {
    expect(HADITH_COLLECTION.length).toBeGreaterThanOrEqual(20);
  });

  it('every entry has Arabic, English, and a source (§4)', () => {
    for (const entry of HADITH_COLLECTION) {
      expect(entry.arabic.length, entry.source).toBeGreaterThan(0);
      expect(entry.english.length, entry.source).toBeGreaterThan(0);
      expect(entry.source.length).toBeGreaterThan(0);
    }
  });

  it('every Arabic text contains Arabic script', () => {
    const arabicScript = /[؀-ۿ]/;
    for (const entry of HADITH_COLLECTION) {
      expect(arabicScript.test(entry.arabic), entry.source).toBe(true);
    }
  });

  it('every source cites a canonical collection', () => {
    const collections = /Bukhari|Muslim|Tirmidhi|Nasa’i|Ibn Majah|Bayhaqi|Abu Dawud|Muwatta|Ahmad/;
    for (const entry of HADITH_COLLECTION) {
      expect(entry.source, entry.source).toMatch(collections);
    }
  });

  it('every tag is a known occasion tag', () => {
    for (const entry of HADITH_COLLECTION) {
      expect(entry.tags.length).toBeGreaterThan(0);
      for (const tag of entry.tags) {
        expect(VALID_TAGS).toContain(tag);
      }
    }
  });

  it('has occasion coverage: jumuah, ramadan, fajr, prayer', () => {
    const allTags = new Set(HADITH_COLLECTION.flatMap((h) => h.tags));
    expect(allTags.has('jumuah')).toBe(true);
    expect(allTags.has('ramadan')).toBe(true);
    expect(allTags.has('fajr')).toBe(true);
    expect(allTags.has('prayer')).toBe(true);
  });
});

describe('dayOfYear', () => {
  it('returns 1 for January 1st', () => {
    expect(dayOfYear(new Date(2026, 0, 1))).toBe(1);
  });

  it('returns 365 for December 31st in a non-leap year', () => {
    expect(dayOfYear(new Date(2026, 11, 31))).toBe(365);
  });

  it('returns 366 for December 31st in a leap year', () => {
    expect(dayOfYear(new Date(2024, 11, 31))).toBe(366);
  });

  it('counts Feb 29 correctly in leap years', () => {
    expect(dayOfYear(new Date(2024, 1, 29))).toBe(60);
    expect(dayOfYear(new Date(2026, 1, 28))).toBe(59);
    expect(dayOfYear(new Date(2026, 2, 1))).toBe(60);
  });
});

describe('getHadithOfTheDay', () => {
  it('is deterministic for the same date', () => {
    const date = new Date(2026, 6, 29);
    expect(getHadithOfTheDay(date)).toBe(getHadithOfTheDay(date));
  });

  it('always returns a collection entry', () => {
    for (let day = 0; day < 365; day += 17) {
      const entry = getHadithOfTheDay(new Date(2026, 0, 1 + day));
      expect(HADITH_COLLECTION).toContain(entry);
    }
  });

  it('rotates through the whole collection over time', () => {
    const seen = new Set();
    for (let day = 0; day < 365; day++) {
      seen.add(getHadithOfTheDay(new Date(2026, 0, 1 + day)));
    }
    // Every entry is reachable within a year of days.
    expect(seen.size).toBe(HADITH_COLLECTION.length);
  });

  it('gives different picks on most consecutive days', () => {
    let different = 0;
    for (let day = 0; day < 60; day++) {
      const a = getHadithOfTheDay(new Date(2026, 0, 1 + day));
      const b = getHadithOfTheDay(new Date(2026, 0, 2 + day));
      if (a !== b) different++;
    }
    expect(different).toBeGreaterThan(50);
  });

  it('context-seeds within the occasion pool when tags match (§4)', () => {
    const friday = new Date(2026, 6, 31); // a Friday
    const entry = getHadithOfTheDay(friday, ['jumuah']);
    expect(entry.tags).toContain('jumuah');
  });

  it('keeps the occasion pick deterministic', () => {
    const friday = new Date(2026, 6, 31);
    expect(getHadithOfTheDay(friday, ['jumuah'])).toBe(getHadithOfTheDay(friday, ['jumuah']));
  });

  it('falls back to the full collection when no entry matches the tags', () => {
    const entry = getHadithOfTheDay(new Date(2026, 6, 29), ['eid' as HadithTag]);
    expect(HADITH_COLLECTION).toContain(entry);
  });

  it('seeds Fajr-context picks from the fajr/prayer pool', () => {
    const entry = getHadithOfTheDay(new Date(2026, 6, 29), ['fajr', 'prayer']);
    expect(entry.tags.some((t) => t === 'fajr' || t === 'prayer')).toBe(true);
  });
});
