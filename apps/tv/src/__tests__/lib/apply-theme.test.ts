import { describe, it, expect, beforeEach } from 'vitest';
import { applyTheme, metalPalettes, presetTokens } from '@masjid/ui-utils';

// ---------------------------------------------------------------------------
// applyTheme — style-system branching (docs/design-language.md §8)
// ---------------------------------------------------------------------------

function prop(name: string): string {
  return document.documentElement.style.getPropertyValue(name);
}

beforeEach(() => {
  document.documentElement.removeAttribute('data-style-system');
  document.documentElement.style.cssText = '';
});

describe('applyTheme — Sakeenah (existing behavior)', () => {
  it('sets data-style-system="sakeenah" by default', () => {
    applyTheme(null);
    expect(document.documentElement.getAttribute('data-style-system')).toBe('sakeenah');
  });

  it('sets data-style-system="sakeenah" for an explicit sakeenah theme', () => {
    applyTheme({ style_system: 'sakeenah' });
    expect(document.documentElement.getAttribute('data-style-system')).toBe('sakeenah');
  });

  it('treats an unknown style_system as sakeenah', () => {
    applyTheme({ style_system: 'future-system' });
    expect(document.documentElement.getAttribute('data-style-system')).toBe('sakeenah');
  });

  it('applies stock colors and glass-dark tokens for an empty theme', () => {
    applyTheme({});
    expect(prop('--color-primary')).toBe('#1e3a8a');
    expect(prop('--color-accent')).toBe('#10b981');
    expect(prop('--color-bg')).toBe('#030712');
    expect(prop('--font-heading')).toContain('Inter');
  });

  it('honors stored colors, fonts, and preset', () => {
    applyTheme({
      primary_color: '#7c3aed',
      accent_color: '#d97706',
      font_heading: 'Amiri',
      font_body: 'Noto Naskh Arabic',
      layout_preset: 'minimal-light',
    });
    expect(prop('--color-primary')).toBe('#7c3aed');
    expect(prop('--color-accent')).toBe('#d97706');
    expect(prop('--color-bg')).toBe('#f8fafc');
    expect(prop('--font-heading')).toContain('Amiri');
    expect(prop('--font-body')).toContain('Noto Naskh Arabic');
  });

  it('does not set Mishkaat-only variables', () => {
    applyTheme({});
    expect(prop('--color-glow')).toBe('');
    expect(prop('--font-display')).toBe('');
  });
});

describe('applyTheme — Mishkaat', () => {
  it('sets data-style-system="mishkaat"', () => {
    applyTheme({ style_system: 'mishkaat' });
    expect(document.documentElement.getAttribute('data-style-system')).toBe('mishkaat');
  });

  it('applies mishkaat preset tokens (espresso base, ivory text)', () => {
    applyTheme({ style_system: 'mishkaat' });
    expect(prop('--color-bg')).toBe(presetTokens['mishkaat']['--color-bg']);
    expect(prop('--color-text')).toBe(presetTokens['mishkaat']['--color-text']);
    expect(prop('--color-border')).toBe(presetTokens['mishkaat']['--color-border']);
  });

  it('defaults to the gold metal palette', () => {
    applyTheme({ style_system: 'mishkaat' });
    expect(prop('--color-accent')).toBe(metalPalettes.gold.accent);
    expect(prop('--color-primary')).toBe(metalPalettes.gold.primary);
    expect(prop('--color-accent-light')).toBe(metalPalettes.gold.accentLight);
    expect(prop('--color-glow')).toBe(metalPalettes.gold.glow);
  });

  it('recolors accents when a different metal is chosen (§7.4 vanity knob)', () => {
    applyTheme({ style_system: 'mishkaat', style_options: { metal: 'copper' } });
    expect(prop('--color-accent')).toBe(metalPalettes.copper.accent);
    expect(prop('--color-primary')).toBe(metalPalettes.copper.primary);

    applyTheme({ style_system: 'mishkaat', style_options: '{"metal":"rose"}' });
    expect(prop('--color-accent')).toBe(metalPalettes.rose.accent);
  });

  it('lets stock Sakeenah colors fall through to metal (treated as unset)', () => {
    applyTheme({
      style_system: 'mishkaat',
      primary_color: '#1e3a8a',
      accent_color: '#10b981',
    });
    expect(prop('--color-primary')).toBe(metalPalettes.gold.primary);
    expect(prop('--color-accent')).toBe(metalPalettes.gold.accent);
  });

  it('honors explicit custom colors as raw overrides on top of metal (§7.4)', () => {
    applyTheme({
      style_system: 'mishkaat',
      primary_color: '#123456',
      accent_color: '#fedcba',
    });
    expect(prop('--color-primary')).toBe('#123456');
    expect(prop('--color-accent')).toBe('#fedcba');
    // Metal still supplies the supporting tokens.
    expect(prop('--color-glow')).toBe(metalPalettes.gold.glow);
  });

  it('is case-insensitive when detecting stock colors', () => {
    applyTheme({
      style_system: 'mishkaat',
      primary_color: '#1E3A8A',
      accent_color: '#10B981',
    });
    expect(prop('--color-primary')).toBe(metalPalettes.gold.primary);
    expect(prop('--color-accent')).toBe(metalPalettes.gold.accent);
  });

  it('defaults headings to Amiri (§7.2)', () => {
    applyTheme({ style_system: 'mishkaat' });
    expect(prop('--font-heading')).toContain('Amiri');
    expect(prop('--font-display')).toContain('Amiri');
  });

  it('treats the stock Inter heading as unset and upgrades to Amiri', () => {
    applyTheme({ style_system: 'mishkaat', font_heading: 'Inter' });
    expect(prop('--font-heading')).toContain('Amiri');
  });

  it('lets font_heading substitute another display face (§7.2)', () => {
    applyTheme({ style_system: 'mishkaat', font_heading: 'Scheherazade New' });
    expect(prop('--font-heading')).toContain('Scheherazade New');
    expect(prop('--font-heading')).not.toContain('Amiri');
  });

  it('keeps font_body as the text face', () => {
    applyTheme({ style_system: 'mishkaat', font_body: 'Roboto' });
    expect(prop('--font-body')).toContain('Roboto');
  });

  it('falls back to the mishkaat preset for Sakeenah-era layout_preset values', () => {
    applyTheme({ style_system: 'mishkaat', layout_preset: 'glass-dark' });
    expect(prop('--color-bg')).toBe(presetTokens['mishkaat']['--color-bg']);

    applyTheme({ style_system: 'mishkaat', layout_preset: 'modern_minimal' });
    expect(prop('--color-bg')).toBe(presetTokens['mishkaat']['--color-bg']);
  });

  it('accepts reserved Mishkaat preset names', () => {
    // Reserved presets have no token block yet — they fall back to mishkaat.
    applyTheme({ style_system: 'mishkaat', layout_preset: 'manara' });
    expect(prop('--color-bg')).toBe(presetTokens['mishkaat']['--color-bg']);
  });

  it('updates the theme-color meta tag with the resolved primary', () => {
    const meta = document.createElement('meta');
    meta.setAttribute('name', 'theme-color');
    document.head.appendChild(meta);
    applyTheme({ style_system: 'mishkaat' });
    expect(meta.getAttribute('content')).toBe(metalPalettes.gold.primary);
    meta.remove();
  });
});
