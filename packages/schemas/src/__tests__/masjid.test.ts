import { describe, it, expect } from 'vitest';
import {
  UpdateMasjidSchema,
  ThemeSchema,
  UpdateThemeSchema,
} from '../masjid';

describe('UpdateMasjidSchema', () => {
  it('parses latitude and longitude', () => {
    const result = UpdateMasjidSchema.parse({
      latitude: 41.8827,
      longitude: -87.6233,
    });
    expect(result.latitude).toBe(41.8827);
    expect(result.longitude).toBe(-87.6233);
  });

  it('rejects latitude > 90', () => {
    expect(() =>
      UpdateMasjidSchema.parse({ latitude: 91 }),
    ).toThrow();
  });

  it('rejects latitude < -90', () => {
    expect(() =>
      UpdateMasjidSchema.parse({ latitude: -91 }),
    ).toThrow();
  });

  it('rejects longitude > 180', () => {
    expect(() =>
      UpdateMasjidSchema.parse({ longitude: 181 }),
    ).toThrow();
  });

  it('rejects longitude < -180', () => {
    expect(() =>
      UpdateMasjidSchema.parse({ longitude: -181 }),
    ).toThrow();
  });

  it('latitude and longitude are optional (omitted body is fine)', () => {
    const result = UpdateMasjidSchema.parse({ name: 'Test' });
    expect(result.name).toBe('Test');
    expect(result.latitude).toBeUndefined();
    expect(result.longitude).toBeUndefined();
  });
});

describe('ThemeSchema', () => {
  it('accepts empty strings for label fields (no .min(1))', () => {
    const result = ThemeSchema.parse({
      layout_preset: 'glass-dark',
      primary_color: '#1e3a8a',
      accent_color: '#10b981',
      font_heading: 'Inter',
      font_body: 'Roboto',
      time_format: '24h',
      label_adhaan: '',
      label_iqaamah: '',
      label_jumuah: '',
      label_speech: '',
      label_sunrise: '',
      label_fajr: '',
      label_dhuhr: '',
      label_asr: '',
      label_maghrib: '',
      label_isha: '',
    });
    expect(result.label_adhaan).toBe('');
    expect(result.label_dhuhr).toBe('');
    expect(result.label_isha).toBe('');
  });

  it('accepts any string for labels', () => {
    const result = ThemeSchema.parse({
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
    expect(result.label_adhaan).toBe('Azaan');
    expect(result.label_dhuhr).toBe('Zuhr');
  });

  it('rejects missing required fields (no .default() fallback)', () => {
    expect(() =>
      ThemeSchema.parse({}),
    ).toThrow();
  });

  it('rejects missing time_format (required, no default)', () => {
    expect(() =>
      ThemeSchema.parse({
        layout_preset: 'modern_minimal',
        primary_color: '#111111',
        accent_color: '#222222',
        font_heading: 'Inter',
        font_body: 'Roboto',
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
      }),
    ).toThrow();
  });

  it('rejects invalid time_format', () => {
    expect(() =>
      ThemeSchema.parse({
        layout_preset: 'glass-dark',
        primary_color: '#111111',
        accent_color: '#222222',
        font_heading: 'Inter',
        font_body: 'Roboto',
        time_format: '48h',
        label_adhaan: 'A',
        label_iqaamah: 'I',
        label_jumuah: 'J',
        label_speech: 'S',
        label_sunrise: 'R',
        label_fajr: 'F',
        label_dhuhr: 'D',
        label_asr: 'A',
        label_maghrib: 'M',
        label_isha: 'I',
      }),
    ).toThrow();
  });

  it('rejects invalid hex color', () => {
    expect(() =>
      ThemeSchema.parse({
        layout_preset: 'glass-dark',
        primary_color: 'not-a-color',
        accent_color: '#10b981',
        font_heading: 'Inter',
        font_body: 'Roboto',
        time_format: '24h',
        label_adhaan: 'A',
        label_iqaamah: 'I',
        label_jumuah: 'J',
        label_speech: 'S',
        label_sunrise: 'R',
        label_fajr: 'F',
        label_dhuhr: 'D',
        label_asr: 'A',
        label_maghrib: 'M',
        label_isha: 'I',
      }),
    ).toThrow();
  });
});

describe('UpdateThemeSchema', () => {
  it('partial schema — empty object parses without defaults', () => {
    const result = UpdateThemeSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(Object.keys(result.data).length).toBe(0);
    }
  });

  it('partial schema — only provided fields appear in data', () => {
    const result = UpdateThemeSchema.safeParse({
      primary_color: '#ff0000',
      label_fajr: 'Fajr',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.primary_color).toBe('#ff0000');
      expect(result.data.label_fajr).toBe('Fajr');
      expect(result.data.layout_preset).toBeUndefined();
      expect(result.data.label_dhuhr).toBeUndefined();
    }
  });

  it('partial schema — accepts empty strings for labels (no .min(1))', () => {
    const result = UpdateThemeSchema.safeParse({
      label_adhaan: '',
      label_dhuhr: '',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.label_adhaan).toBe('');
      expect(result.data.label_dhuhr).toBe('');
    }
  });

  it('partial schema — profile-only body produces empty theme data (no defaults injected)', () => {
    const result = UpdateThemeSchema.safeParse({
      name: 'Masjid Name',
      city: 'Chicago',
      latitude: 41.88,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(Object.keys(result.data).length).toBe(0);
    }
  });

  it('partial schema — full theme body keeps all fields', () => {
    const result = UpdateThemeSchema.safeParse({
      layout_preset: 'minimal-light',
      primary_color: '#333333',
      accent_color: '#00ff00',
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
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.layout_preset).toBe('minimal-light');
      expect(result.data.label_dhuhr).toBe('Zuhr');
    }
  });

  it('partial schema — rejects invalid time_format even in partial', () => {
    const result = UpdateThemeSchema.safeParse({ time_format: '48h' });
    expect(result.success).toBe(false);
  });

  it('partial schema — rejects invalid hex color even in partial', () => {
    const result = UpdateThemeSchema.safeParse({ primary_color: 'bad' });
    expect(result.success).toBe(false);
  });
});