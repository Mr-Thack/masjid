import { describe, it, expect } from 'vitest';
import {
  ThemeSchema,
  UpdateThemeSchema,
  StyleSystem,
  StyleOptionsSchema,
} from '@masjid/schemas';

// ---------------------------------------------------------------------------
// Style system schemas (docs/design-language.md §8)
// ---------------------------------------------------------------------------

describe('StyleSystem', () => {
  it('defaults to sakeenah', () => {
    expect(StyleSystem.parse(undefined)).toBe('sakeenah');
  });

  it('accepts sakeenah and mishkaat', () => {
    expect(StyleSystem.parse('sakeenah')).toBe('sakeenah');
    expect(StyleSystem.parse('mishkaat')).toBe('mishkaat');
  });

  it('rejects unknown style systems', () => {
    expect(() => StyleSystem.parse('sakina')).toThrow();
    expect(() => StyleSystem.parse('mihrab')).toThrow();
    expect(() => StyleSystem.parse('')).toThrow();
    expect(() => StyleSystem.parse('MISHKAAT')).toThrow();
  });
});

describe('StyleOptionsSchema', () => {
  it('accepts an empty object', () => {
    expect(StyleOptionsSchema.parse({})).toEqual({});
  });

  it('accepts a full Mishkaat option set', () => {
    const parsed = StyleOptionsSchema.parse({
      metal: 'copper',
      motif: 'girih',
      arch: false,
      numerals: 'arabic-indic',
      density: 'large-print',
      ambient: false,
      quietHours: { enabled: false, quietMinutes: 30 },
      frames: ['hadith', 'announcements'],
      emblem: 'engraved',
      donateAppeal: 'Keep our doors open',
    });
    expect(parsed.metal).toBe('copper');
    expect(parsed.motif).toBe('girih');
    expect(parsed.arch).toBe(false);
    expect(parsed.numerals).toBe('arabic-indic');
    expect(parsed.density).toBe('large-print');
    expect(parsed.ambient).toBe(false);
    expect(parsed.quietHours?.quietMinutes).toBe(30);
    expect(parsed.frames).toEqual(['hadith', 'announcements']);
    expect(parsed.emblem).toBe('engraved');
    expect(parsed.donateAppeal).toBe('Keep our doors open');
  });

  it('validates donateAppeal (trimmed, 1–80 chars)', () => {
    expect(StyleOptionsSchema.parse({ donateAppeal: '  Give well  ' }).donateAppeal).toBe('Give well');
    expect(() => StyleOptionsSchema.parse({ donateAppeal: '' })).toThrow();
    expect(() => StyleOptionsSchema.parse({ donateAppeal: 'x'.repeat(81) })).toThrow();
    expect(() => StyleOptionsSchema.parse({ donateAppeal: 42 })).toThrow();
  });

  it('rejects invalid enum values', () => {
    expect(() => StyleOptionsSchema.parse({ metal: 'platinum' })).toThrow();
    expect(() => StyleOptionsSchema.parse({ motif: 'paisley' })).toThrow();
    expect(() => StyleOptionsSchema.parse({ numerals: 'roman' })).toThrow();
    expect(() => StyleOptionsSchema.parse({ density: 'huge' })).toThrow();
    expect(() => StyleOptionsSchema.parse({ emblem: 'photo' })).toThrow();
  });

  it('rejects wrong types for boolean options', () => {
    expect(() => StyleOptionsSchema.parse({ arch: 'yes' })).toThrow();
    expect(() => StyleOptionsSchema.parse({ ambient: 1 })).toThrow();
  });

  it('lets unknown keys pass through (forward compatibility)', () => {
    const parsed = StyleOptionsSchema.parse({ metal: 'gold', futureOption: { x: 1 } }) as Record<
      string,
      unknown
    >;
    expect(parsed.metal).toBe('gold');
    expect(parsed.futureOption).toEqual({ x: 1 });
  });

  it('validates quietHours bounds', () => {
    expect(() => StyleOptionsSchema.parse({ quietHours: { quietMinutes: -5 } })).toThrow();
    expect(() => StyleOptionsSchema.parse({ quietHours: { quietMinutes: 500 } })).toThrow();
    expect(() =>
      StyleOptionsSchema.parse({ quietHours: { sleepAfterIshaMinutes: 90 } }),
    ).not.toThrow();
  });

  it('rejects non-string frame entries', () => {
    expect(() => StyleOptionsSchema.parse({ frames: ['hadith', 42] })).toThrow();
    expect(() => StyleOptionsSchema.parse({ frames: 'hadith' })).toThrow();
  });
});

describe('ThemeSchema style fields', () => {
  it('defaults style_system to sakeenah and style_options to {}', () => {
    const parsed = ThemeSchema.parse({
      layout_preset: 'glass-dark',
      primary_color: '#1e3a8a',
      accent_color: '#10b981',
      font_heading: 'Inter',
      font_body: 'Roboto',
      time_format: '24h',
      label_adhaan: 'Adhaan',
      label_iqaamah: 'Iqaamah',
      label_jumuah: "Jumu'ah",
      label_speech: 'Speech',
      label_sunrise: 'Sunrise',
      label_fajr: 'Fajr',
      label_dhuhr: 'Dhuhr',
      label_asr: 'Asr',
      label_maghrib: 'Maghrib',
      label_isha: 'Isha',
    });
    expect(parsed.style_system).toBe('sakeenah');
    expect(parsed.style_options).toEqual({});
  });

  it('accepts mishkaat with options', () => {
    const parsed = ThemeSchema.parse({
      style_system: 'mishkaat',
      style_options: { metal: 'silver' },
      layout_preset: 'glass-dark',
      primary_color: '#1e3a8a',
      accent_color: '#10b981',
      font_heading: 'Inter',
      font_body: 'Roboto',
      time_format: '24h',
      label_adhaan: 'Adhaan',
      label_iqaamah: 'Iqaamah',
      label_jumuah: "Jumu'ah",
      label_speech: 'Speech',
      label_sunrise: 'Sunrise',
      label_fajr: 'Fajr',
      label_dhuhr: 'Dhuhr',
      label_asr: 'Asr',
      label_maghrib: 'Maghrib',
      label_isha: 'Isha',
    });
    expect(parsed.style_system).toBe('mishkaat');
    expect(parsed.style_options.metal).toBe('silver');
  });

  it('keeps all 15 pre-existing theme fields working', () => {
    const parsed = ThemeSchema.parse({
      layout_preset: 'minimal-light',
      primary_color: '#7c3aed',
      accent_color: '#d97706',
      font_heading: 'Amiri',
      font_body: 'Noto Naskh Arabic',
      time_format: '12h',
      label_adhaan: 'Azaan',
      label_iqaamah: 'Iqamah',
      label_jumuah: 'Jummah',
      label_speech: 'Bayaan',
      label_sunrise: 'Sunrise',
      label_fajr: 'Fajr',
      label_dhuhr: 'Zuhr',
      label_asr: 'Asr',
      label_maghrib: 'Maghrib',
      label_isha: 'Isha',
    });
    expect(parsed.layout_preset).toBe('minimal-light');
    expect(parsed.label_dhuhr).toBe('Zuhr');
    expect(parsed.style_system).toBe('sakeenah');
  });
});

describe('UpdateThemeSchema style fields', () => {
  it('accepts a style-system-only update', () => {
    const parsed = UpdateThemeSchema.parse({ style_system: 'mishkaat' });
    expect(parsed.style_system).toBe('mishkaat');
    expect(parsed.layout_preset).toBeUndefined();
  });

  it('accepts a style-options-only update', () => {
    const parsed = UpdateThemeSchema.parse({ style_options: { ambient: false } });
    expect(parsed.style_options?.ambient).toBe(false);
    expect(parsed.style_system).toBeUndefined();
  });

  it('rejects an invalid style_system in updates', () => {
    expect(() => UpdateThemeSchema.parse({ style_system: 'fancy' })).toThrow();
  });
});
