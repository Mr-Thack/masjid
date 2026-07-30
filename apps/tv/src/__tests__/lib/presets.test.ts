import { describe, it, expect } from 'vitest';
import { presetTokens } from '@masjid/ui-utils';

// ---------------------------------------------------------------------------
// Preset token blocks (docs/design-language.md §3, §7.4)
// ---------------------------------------------------------------------------

const REQUIRED_TOKENS = [
  '--color-bg',
  '--color-surface',
  '--color-text',
  '--color-text-muted',
  '--color-text-dim',
  '--color-border',
  '--color-border-hover',
  '--color-current-highlight',
  '--glass-shine',
  '--shadow-card',
  '--shadow-card-hover',
];

describe('presetTokens', () => {
  it('defines the two Sakeenah presets and the Mishkaat default preset', () => {
    expect(Object.keys(presetTokens)).toContain('glass-dark');
    expect(Object.keys(presetTokens)).toContain('minimal-light');
    expect(Object.keys(presetTokens)).toContain('mishkaat');
  });

  it.each(['glass-dark', 'minimal-light', 'mishkaat'])('%s defines all required tokens', (name) => {
    for (const token of REQUIRED_TOKENS) {
      expect(presetTokens[name], `missing ${token}`).toHaveProperty(token);
      expect(typeof presetTokens[name][token]).toBe('string');
      expect(presetTokens[name][token].length).toBeGreaterThan(0);
    }
  });

  describe('mishkaat preset (§7.4)', () => {
    const tokens = presetTokens['mishkaat'];

    it('uses a dark-warm espresso base (no pure black, no light background)', () => {
      expect(tokens['--color-bg']).toMatch(/^#[0-9a-f]{6}$/i);
      // Warm: red channel above blue channel; dark: low luminance.
      const [r, g, b] = [1, 3, 5].map((i) => parseInt(tokens['--color-bg'].slice(i, i + 2), 16));
      expect(r).toBeGreaterThan(b);
      expect(r + g + b).toBeLessThan(200);
    });

    it('uses warm ivory text (not pure white — §7.4 glare rule)', () => {
      expect(tokens['--color-text'].toLowerCase()).not.toBe('#ffffff');
      expect(tokens['--color-text'].toLowerCase()).not.toBe('#fff');
      // Still bright enough for 20-foot legibility.
      const [r, g, b] = [1, 3, 5].map((i) => parseInt(tokens['--color-text'].slice(i, i + 2), 16));
      expect(r + g + b).toBeGreaterThan(450);
    });

    it('has no large pure-white surface anywhere', () => {
      for (const [key, value] of Object.entries(tokens)) {
        expect(value.toLowerCase(), `${key} is pure white`).not.toBe('#ffffff');
      }
    });

    it('ties borders and current-prayer highlight to the gold family', () => {
      // Gold #d4af37 = rgb(212, 175, 55) — hairlines reuse it at low alpha.
      expect(tokens['--color-border']).toContain('212, 175, 55');
      expect(tokens['--color-border-hover']).toContain('212, 175, 55');
      expect(tokens['--color-current-highlight']).toContain('212, 175, 55');
    });

    it('keeps hairline ornament at low contrast (ornament budget §4)', () => {
      const match = tokens['--color-border'].match(/([\d.]+)\)$/);
      expect(match).toBeTruthy();
      expect(parseFloat(match![1])).toBeLessThanOrEqual(0.2);
    });
  });

  describe('Sakeenah presets unchanged', () => {
    it('glass-dark keeps its documented tokens', () => {
      expect(presetTokens['glass-dark']['--color-bg']).toBe('#030712');
      expect(presetTokens['glass-dark']['--color-text']).toBe('#f9fafb');
    });

    it('minimal-light keeps its documented tokens', () => {
      expect(presetTokens['minimal-light']['--color-bg']).toBe('#f8fafc');
      expect(presetTokens['minimal-light']['--color-surface']).toBe('#ffffff');
    });
  });
});
