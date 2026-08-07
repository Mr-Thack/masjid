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
  it('defines the two Sakeenah presets and the Mishkaat default + light presets', () => {
    expect(Object.keys(presetTokens)).toContain('glass-dark');
    expect(Object.keys(presetTokens)).toContain('minimal-light');
    expect(Object.keys(presetTokens)).toContain('mishkaat');
    expect(Object.keys(presetTokens)).toContain('mishkaat-light');
  });

  it.each(['glass-dark', 'minimal-light', 'mishkaat', 'mishkaat-light'])('%s defines all required tokens', (name) => {
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

  describe('mishkaat-light preset', () => {
    const tokens = presetTokens['mishkaat-light'];

    it('uses a warm cream base (light, not dark)', () => {
      expect(tokens['--color-bg']).toMatch(/^#[0-9a-f]{6}$/i);
      const [r, g, b] = [1, 3, 5].map((i) => parseInt(tokens['--color-bg'].slice(i, i + 2), 16));
      expect(r + g + b).toBeGreaterThan(400);
      // Warm: red channel > blue channel.
      expect(r).toBeGreaterThan(b);
    });

    it('uses dark warm brown text (not pure black)', () => {
      expect(tokens['--color-text'].toLowerCase()).not.toBe('#000000');
      expect(tokens['--color-text'].toLowerCase()).not.toBe('#000');
      const [r, g, b] = [1, 3, 5].map((i) => parseInt(tokens['--color-text'].slice(i, i + 2), 16));
      expect(r + g + b).toBeLessThan(200);
    });

    it('uses a light surface (near-white, not pure white)', () => {
      const surface = parseInt(tokens['--color-surface'].match(/[\d.]+/)?.[0] ?? '0');
      expect(surface).toBeGreaterThan(0.7);
      expect(tokens['--color-surface']).not.toBe('#ffffff');
    });

    it('ties borders to the gold family at low alpha for light background legibility', () => {
      expect(tokens['--color-border']).toContain('156, 124, 30');
      const match = tokens['--color-border'].match(/([\d.]+)\)/);
      expect(match).toBeTruthy();
      expect(parseFloat(match![1])).toBeGreaterThanOrEqual(0.1);
    });

    it('has stronger shadows than dark mode for depth on light background', () => {
      const darkShadow = parseFloat(presetTokens['mishkaat']['--shadow-card'].match(/rgba\(0, 0, 0, ([\d.]+)\)/)?.[1] ?? '0');
      const lightShadow = parseFloat(tokens['--shadow-card'].match(/rgba\(0, 0, 0, ([\d.]+)\)/)?.[1] ?? '0');
      expect(lightShadow).toBeLessThan(darkShadow);
    });
  });
});
