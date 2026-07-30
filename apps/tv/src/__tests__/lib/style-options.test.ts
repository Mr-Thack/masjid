import { describe, it, expect } from 'vitest';
import {
  parseStyleOptions,
  resolveStyleOptions,
  metalPalettes,
  MISHKAAT_OPTION_DEFAULTS,
  STOCK_ACCENT_COLOR,
  STOCK_PRIMARY_COLOR,
} from '@masjid/ui-utils';

// ---------------------------------------------------------------------------
// Theme options: parse + resolve (docs/design-language.md §8)
// ---------------------------------------------------------------------------

describe('parseStyleOptions', () => {
  it('returns {} for null/undefined/empty string', () => {
    expect(parseStyleOptions(null)).toEqual({});
    expect(parseStyleOptions(undefined)).toEqual({});
    expect(parseStyleOptions('')).toEqual({});
  });

  it('returns {} for invalid JSON', () => {
    expect(parseStyleOptions('{oops')).toEqual({});
    expect(parseStyleOptions('not json at all')).toEqual({});
  });

  it('returns {} for non-object input', () => {
    expect(parseStyleOptions('[]')).toEqual({});
    expect(parseStyleOptions('"gold"')).toEqual({});
    expect(parseStyleOptions('7')).toEqual({});
    expect(parseStyleOptions([] as unknown as Record<string, unknown>)).toEqual({});
  });

  it('parses from a JSON string (DB column form)', () => {
    expect(parseStyleOptions('{"metal":"copper","arch":false}')).toEqual({
      metal: 'copper',
      arch: false,
    });
  });

  it('parses from an object (API payload form)', () => {
    expect(parseStyleOptions({ metal: 'silver', ambient: true })).toEqual({
      metal: 'silver',
      ambient: true,
    });
  });

  it('drops keys with invalid enum values but keeps valid siblings', () => {
    const parsed = parseStyleOptions({ metal: 'platinum', arch: false, motif: 'girih' });
    expect(parsed.metal).toBeUndefined();
    expect(parsed.arch).toBe(false);
    expect(parsed.motif).toBe('girih');
  });

  it('drops wrong-typed values', () => {
    const parsed = parseStyleOptions({
      arch: 'yes',
      ambient: 1,
      numerals: 3,
      density: null,
      frames: 'hadith',
      emblem: {},
    });
    expect(parsed).toEqual({});
  });

  it('ignores unknown keys (forward compatibility is render-side)', () => {
    const parsed = parseStyleOptions({ metal: 'gold', brandNewOption: true });
    expect(parsed).toEqual({ metal: 'gold' });
    expect('brandNewOption' in parsed).toBe(false);
  });

  it('filters non-string frame entries', () => {
    expect(parseStyleOptions({ frames: ['hadith', 4, null, 'announcements'] })).toEqual({
      frames: ['hadith', 'announcements'],
    });
    expect(parseStyleOptions({ frames: [] })).toEqual({ frames: [] });
  });

  it('parses quietHours and clamps numbers to sane integers', () => {
    const parsed = parseStyleOptions({
      quietHours: { enabled: true, quietMinutes: 25.7, sleepAfterIshaMinutes: -10 },
    });
    expect(parsed.quietHours).toEqual({
      enabled: true,
      quietMinutes: 26,
      sleepAfterIshaMinutes: 0,
    });
  });

  it('drops non-finite quietHours numbers and wrong types', () => {
    const parsed = parseStyleOptions({
      quietHours: { quietMinutes: NaN, wakeBeforeFajrMinutes: '30', enabled: 1 },
    });
    expect(parsed.quietHours).toEqual({});
  });

  it('ignores a non-object quietHours value', () => {
    expect(parseStyleOptions({ quietHours: 'always' })).toEqual({});
    expect(parseStyleOptions({ quietHours: [1, 2] })).toEqual({});
  });

  it('accepts every documented enum value', () => {
    for (const metal of ['gold', 'silver', 'copper', 'rose']) {
      expect(parseStyleOptions({ metal }).metal).toBe(metal);
    }
    for (const motif of ['honeycomb', 'eight-point-star', 'girih', 'arabesque', 'none']) {
      expect(parseStyleOptions({ motif }).motif).toBe(motif);
    }
    for (const numerals of ['western', 'arabic-indic']) {
      expect(parseStyleOptions({ numerals }).numerals).toBe(numerals);
    }
    for (const density of ['standard', 'large-print']) {
      expect(parseStyleOptions({ density }).density).toBe(density);
    }
    for (const emblem of ['engraved', 'medallion']) {
      expect(parseStyleOptions({ emblem }).emblem).toBe(emblem);
    }
  });
});

describe('resolveStyleOptions', () => {
  it('fills every default from empty input', () => {
    expect(resolveStyleOptions({})).toEqual(MISHKAAT_OPTION_DEFAULTS);
    expect(resolveStyleOptions(null)).toEqual(MISHKAAT_OPTION_DEFAULTS);
    expect(resolveStyleOptions(undefined)).toEqual(MISHKAAT_OPTION_DEFAULTS);
  });

  it('has gold metal, eight-point-star motif, arch, western numerals, standard density, ambient, medallion by default', () => {
    const resolved = resolveStyleOptions({});
    expect(resolved.metal).toBe('gold');
    expect(resolved.motif).toBe('eight-point-star');
    expect(resolved.arch).toBe(true);
    expect(resolved.numerals).toBe('western');
    expect(resolved.density).toBe('standard');
    expect(resolved.ambient).toBe(true);
    expect(resolved.emblem).toBe('medallion');
    expect(resolved.frames).toBeNull();
    expect(resolved.donateAppeal).toBe('Every contribution makes a difference');
  });

  it('enables quiet hours with documented defaults (§7.6: ~90 min after Isha, wake before Fajr)', () => {
    const { quietHours } = resolveStyleOptions({});
    expect(quietHours.enabled).toBe(true);
    expect(quietHours.quietMinutes).toBe(25);
    expect(quietHours.sleepAfterIshaMinutes).toBe(90);
    expect(quietHours.wakeBeforeFajrMinutes).toBe(30);
  });

  it('preserves explicit values and merges quietHours partially', () => {
    const resolved = resolveStyleOptions({
      metal: 'copper',
      arch: false,
      quietHours: { quietMinutes: 40 },
    });
    expect(resolved.metal).toBe('copper');
    expect(resolved.arch).toBe(false);
    expect(resolved.quietHours.quietMinutes).toBe(40);
    expect(resolved.quietHours.enabled).toBe(true);
    expect(resolved.quietHours.sleepAfterIshaMinutes).toBe(90);
  });

  it('distinguishes an empty frames list (no frames) from null (all frames)', () => {
    expect(resolveStyleOptions({ frames: [] }).frames).toEqual([]);
    expect(resolveStyleOptions({ frames: ['hadith'] }).frames).toEqual(['hadith']);
    expect(resolveStyleOptions({}).frames).toBeNull();
  });

  it('parses a custom donateAppeal (trimmed, 1–80 chars) and drops invalid ones', () => {
    expect(parseStyleOptions({ donateAppeal: '  Give generously  ' }).donateAppeal).toBe('Give generously');
    expect(parseStyleOptions({ donateAppeal: '' }).donateAppeal).toBeUndefined();
    expect(parseStyleOptions({ donateAppeal: '   ' }).donateAppeal).toBeUndefined();
    expect(parseStyleOptions({ donateAppeal: 'x'.repeat(81) }).donateAppeal).toBeUndefined();
    expect(parseStyleOptions({ donateAppeal: 42 }).donateAppeal).toBeUndefined();
    expect(resolveStyleOptions({ donateAppeal: 'Barakah in giving' }).donateAppeal).toBe('Barakah in giving');
  });
});

describe('metalPalettes', () => {
  it('has exactly the four documented metals (§7.4)', () => {
    expect(Object.keys(metalPalettes).sort()).toEqual(['copper', 'gold', 'rose', 'silver']);
  });

  it('every metal defines primary/accent/accentLight/glow', () => {
    for (const palette of Object.values(metalPalettes)) {
      expect(palette.primary).toMatch(/^#[0-9a-f]{6}$/i);
      expect(palette.accent).toMatch(/^#[0-9a-f]{6}$/i);
      expect(palette.accentLight).toMatch(/^#[0-9a-f]{6}$/i);
      expect(palette.glow).toMatch(/^rgba\(/);
    }
  });

  it('gold uses the documented #d4af37 family', () => {
    expect(metalPalettes.gold.accent).toBe('#d4af37');
  });
});

describe('stock color constants', () => {
  it('match the Sakeenah registration defaults', () => {
    expect(STOCK_PRIMARY_COLOR).toBe('#1e3a8a');
    expect(STOCK_ACCENT_COLOR).toBe('#10b981');
  });
});
