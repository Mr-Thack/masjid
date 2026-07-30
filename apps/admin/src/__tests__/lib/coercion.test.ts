import { describe, it, expect } from 'vitest';
import {
  coerceAsrMadhab,
  coerceHighLatitudeRule,
  coerceAngle,
  coerceBoolean,
} from '$lib/coercion';

describe('coerceAsrMadhab', () => {
  it('passes through valid shafi', () => {
    expect(coerceAsrMadhab('shafi')).toBe('shafi');
  });

  it('passes through valid hanafi', () => {
    expect(coerceAsrMadhab('hanafi')).toBe('hanafi');
  });

  it('falls back to shafi for property-name value', () => {
    expect(coerceAsrMadhab('asr_madhab')).toBe('shafi');
  });

  it('falls back to shafi for undefined', () => {
    expect(coerceAsrMadhab(undefined)).toBe('shafi');
  });

  it('falls back to shafi for null', () => {
    expect(coerceAsrMadhab(null)).toBe('shafi');
  });

  it('falls back to shafi for empty string', () => {
    expect(coerceAsrMadhab('')).toBe('shafi');
  });

  it('falls back to shafi for arbitrary string', () => {
    expect(coerceAsrMadhab('garbage')).toBe('shafi');
  });
});

describe('coerceHighLatitudeRule', () => {
  const valid = ['seventh_of_night', 'middle_of_night', 'twilight_angle', 'none'];

  for (const v of valid) {
    it(`passes through valid ${v}`, () => {
      expect(coerceHighLatitudeRule(v)).toBe(v);
    });
  }

  it('falls back for property-name value', () => {
    expect(coerceHighLatitudeRule('high_latitude_rule')).toBe('seventh_of_night');
  });

  it('falls back for undefined', () => {
    expect(coerceHighLatitudeRule(undefined)).toBe('seventh_of_night');
  });

  it('falls back for null', () => {
    expect(coerceHighLatitudeRule(null)).toBe('seventh_of_night');
  });

  it('falls back for arbitrary string', () => {
    expect(coerceHighLatitudeRule('something')).toBe('seventh_of_night');
  });
});

describe('coerceAngle', () => {
  it('passes through a valid number', () => {
    expect(coerceAngle(15.0)).toBe(15.0);
  });

  it('passes through another valid number', () => {
    expect(coerceAngle(18.5)).toBe(18.5);
  });

  it('converts empty string to null', () => {
    expect(coerceAngle('')).toBeNull();
  });

  it('converts null to null', () => {
    expect(coerceAngle(null)).toBeNull();
  });

  it('converts undefined to null', () => {
    expect(coerceAngle(undefined)).toBeNull();
  });

  it('converts property-name string to null', () => {
    expect(coerceAngle('fajr_angle')).toBeNull();
  });

  it('converts numeric string to number', () => {
    expect(coerceAngle('15.5')).toBe(15.5);
  });

  it('converts non-numeric string to null', () => {
    expect(coerceAngle('garbage')).toBeNull();
  });
});

describe('coerceBoolean', () => {
  it('returns true for true', () => {
    expect(coerceBoolean(true)).toBe(true);
  });

  it('returns false for false', () => {
    expect(coerceBoolean(false)).toBe(false);
  });

  it('returns false for undefined', () => {
    expect(coerceBoolean(undefined)).toBe(false);
  });

  it('returns false for null', () => {
    expect(coerceBoolean(null)).toBe(false);
  });

  it('returns true for non-empty string', () => {
    expect(coerceBoolean('show_dual_asr')).toBe(true);
  });

  it('returns false for empty string', () => {
    expect(coerceBoolean('')).toBe(false);
  });
});