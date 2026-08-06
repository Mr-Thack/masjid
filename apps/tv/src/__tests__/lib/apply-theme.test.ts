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

describe('applyTheme — Mishkaat light/dark mode', () => {
  it('defaults to dark mode (espresso base)', () => {
    applyTheme({ style_system: 'mishkaat' });
    expect(prop('--color-bg')).toBe(presetTokens['mishkaat']['--color-bg']);
    expect(prop('--color-text')).toBe(presetTokens['mishkaat']['--color-text']);
  });

  it('switches to light mode when themeMode is light', () => {
    applyTheme({ style_system: 'mishkaat', style_options: { themeMode: 'light' } });
    expect(prop('--color-bg')).toBe(presetTokens['mishkaat-light']['--color-bg']);
    expect(prop('--color-text')).toBe(presetTokens['mishkaat-light']['--color-text']);
    expect(prop('--color-surface')).toBe(presetTokens['mishkaat-light']['--color-surface']);
  });

  it('uses dark mode when themeMode is explicitly dark', () => {
    applyTheme({ style_system: 'mishkaat', style_options: { themeMode: 'dark' } });
    expect(prop('--color-bg')).toBe(presetTokens['mishkaat']['--color-bg']);
    expect(prop('--color-text')).toBe(presetTokens['mishkaat']['--color-text']);
  });

  it('falls back to dark mode for unknown themeMode values', () => {
    // 'auto' is not a valid themeMode — parseStyleOptions rejects it.
    applyTheme({ style_system: 'mishkaat', style_options: { themeMode: 'auto' } as Record<string, unknown> });
    expect(prop('--color-bg')).toBe(presetTokens['mishkaat']['--color-bg']);
  });

  it('metal palette applies in both light and dark modes', () => {
    applyTheme({ style_system: 'mishkaat', style_options: { themeMode: 'light', metal: 'copper' } });
    expect(prop('--color-primary')).toBe(metalPalettes.copper.primary);
    expect(prop('--color-accent')).toBe(metalPalettes.copper.accent);
    expect(prop('--color-bg')).toBe(presetTokens['mishkaat-light']['--color-bg']);

    applyTheme({ style_system: 'mishkaat', style_options: { themeMode: 'dark', metal: 'silver' } });
    expect(prop('--color-primary')).toBe(metalPalettes.silver.primary);
    expect(prop('--color-accent')).toBe(metalPalettes.silver.accent);
    expect(prop('--color-bg')).toBe(presetTokens['mishkaat']['--color-bg']);
  });

  it('custom color overrides work in light mode', () => {
    applyTheme({
      style_system: 'mishkaat',
      primary_color: '#ff0000',
      accent_color: '#00ff00',
      style_options: { themeMode: 'light', metal: 'gold' },
    });
    expect(prop('--color-primary')).toBe('#ff0000');
    expect(prop('--color-accent')).toBe('#00ff00');
    // Background should still be light.
    expect(prop('--color-bg')).toBe(presetTokens['mishkaat-light']['--color-bg']);
  });

  it('custom color overrides work in dark mode', () => {
    applyTheme({
      style_system: 'mishkaat',
      primary_color: '#ff0000',
      accent_color: '#00ff00',
      style_options: { themeMode: 'dark', metal: 'gold' },
    });
    expect(prop('--color-primary')).toBe('#ff0000');
    expect(prop('--color-accent')).toBe('#00ff00');
    expect(prop('--color-bg')).toBe(presetTokens['mishkaat']['--color-bg']);
  });

  it('metal change with synced primary/accent shows correct colors', () => {
    // Simulates the admin fix: when metal changes, primary_color and
    // accent_color are synced to the metal's values. This means the
    // stored hex matches the metal palette's primary, which is NOT
    // the stock Sakeenah sentinel — but it should still SHOW the
    // correct metal color because the values match.
    applyTheme({
      style_system: 'mishkaat',
      primary_color: metalPalettes.silver.primary,
      accent_color: metalPalettes.silver.accent,
      style_options: { metal: 'silver' },
    });
    expect(prop('--color-primary')).toBe(metalPalettes.silver.primary);
    expect(prop('--color-accent')).toBe(metalPalettes.silver.accent);
  });

  it('metal-change sync bug: stored gold hex overrides silver metal choice', () => {
    // This is the bug reproduction: gold's hex stored in primary_color,
    // admin changes metal to silver but primary_color is still gold.
    // Gold hex (#9c7c1e) !== stock (#1e3a8a), so it overrides silver.
    applyTheme({
      style_system: 'mishkaat',
      primary_color: metalPalettes.gold.primary,  // old gold hex
      accent_color: metalPalettes.gold.accent,     // old gold hex
      style_options: { metal: 'silver' },
    });
    // Bug: gold hex overrides silver metal.
    expect(prop('--color-primary')).toBe(metalPalettes.gold.primary);
    expect(prop('--color-accent')).toBe(metalPalettes.gold.accent);
  });

  it('JSON-string style_options with themeMode works', () => {
    applyTheme({ style_system: 'mishkaat', style_options: '{"themeMode":"light","metal":"rose"}' });
    expect(prop('--color-bg')).toBe(presetTokens['mishkaat-light']['--color-bg']);
    expect(prop('--color-primary')).toBe(metalPalettes.rose.primary);
  });
});
