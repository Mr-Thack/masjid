import { presetTokens } from './presets.js';
import {
  metalPalettes,
  parseStyleOptions,
  resolveStyleOptions,
  STOCK_ACCENT_COLOR,
  STOCK_PRIMARY_COLOR,
  type StyleSystemName,
} from './style-options.js';

export interface ThemeInput {
  primary_color?: string | null;
  accent_color?: string | null;
  font_heading?: string | null;
  font_body?: string | null;
  layout_preset?: string | null;
  style_system?: string | null;
  style_options?: string | Record<string, unknown> | null;
}

/** Presets that belong to the Mishkaat style system (§3: reserved names included). */
const MISHKAAT_PRESETS = new Set(['mishkaat', 'manara', 'mashrabiya', 'qandeel']);

/** Resolve the active style system; anything unknown degrades to Sakeenah. */
export function resolveStyleSystem(theme: ThemeInput | null | undefined): StyleSystemName {
  return theme?.style_system === 'mishkaat' ? 'mishkaat' : 'sakeenah';
}

/**
 * Compute the full CSS-variable set for a theme. Shared by `applyTheme`
 * (writes to the document root) and the TV display (stringifies onto its
 * page element) so both stay in sync.
 */
export function buildThemeVars(theme: ThemeInput | null | undefined): Record<string, string> {
  return resolveStyleSystem(theme) === 'mishkaat'
    ? mishkaatVars(theme)
    : sakeenahVars(theme);
}

function sakeenahVars(theme: ThemeInput | null | undefined): Record<string, string> {
  const vars: Record<string, string> = {
    '--color-primary': theme?.primary_color ?? '#1e3a8a',
    '--color-accent': theme?.accent_color ?? '#10b981',
    '--font-heading': `${theme?.font_heading ?? 'Inter'}, sans-serif`,
    '--font-body': `${theme?.font_body ?? 'Inter'}, sans-serif`,
  };

  const preset = theme?.layout_preset;
  const tokens = presetTokens[preset ?? ''] ?? presetTokens['glass-dark'];
  Object.assign(vars, tokens);

  if (preset === 'minimal-light') {
    vars['--color-primary-light'] = '#3b5cb8';
    vars['--color-primary-dark'] = '#13265e';
    vars['--color-accent-light'] = '#34d399';
  }

  return vars;
}

function mishkaatVars(theme: ThemeInput | null | undefined): Record<string, string> {
  const options = resolveStyleOptions(parseStyleOptions(theme?.style_options));
  const metal = metalPalettes[options.metal];

  // Metal recolors the accent family; explicit (non-stock) stored colors are
  // raw overrides on top of metal (§7.4).
  const storedPrimary = theme?.primary_color?.toLowerCase();
  const storedAccent = theme?.accent_color?.toLowerCase();
  const primary =
    theme?.primary_color && storedPrimary !== STOCK_PRIMARY_COLOR ? theme.primary_color : metal.primary;
  const accent =
    theme?.accent_color && storedAccent !== STOCK_ACCENT_COLOR ? theme.accent_color : metal.accent;

  // Amiri is the Mishkaat display face (§7.2); an explicitly chosen
  // font_heading (Scheherazade New, Noto Naskh, …) substitutes for it.
  const heading = theme?.font_heading && theme.font_heading !== 'Inter' ? theme.font_heading : 'Amiri';

  const vars: Record<string, string> = {
    '--color-primary': primary,
    '--color-accent': accent,
    '--color-accent-light': metal.accentLight,
    '--color-glow': metal.glow,
    '--font-display': `'${heading}', 'Scheherazade New', 'Noto Naskh Arabic', serif`,
    '--font-heading': `'${heading}', serif`,
    '--font-body': `${theme?.font_body ?? 'Inter'}, sans-serif`,
  };

  const presetName = MISHKAAT_PRESETS.has(theme?.layout_preset ?? '') ? theme!.layout_preset! : 'mishkaat';
  const tokens = presetTokens[presetName] ?? presetTokens['mishkaat'];
  Object.assign(vars, tokens);

  return vars;
}

/**
 * Apply a masjid theme to the document root.
 *
 * Safe to call during SSR: it bails out when `document` is not available.
 * Existing CSS variables (e.g. `--color-bg`) are consumed by both the consumer
 * front-end and the TV display so their visual presets stay in sync.
 *
 * Sets `data-style-system` on `<html>` so CSS can branch between style
 * systems (docs/design-language.md §8).
 */
export function applyTheme(theme: ThemeInput | null | undefined): void {
  if (typeof document === 'undefined') return;

  const root = document.documentElement;
  const styleSystem = resolveStyleSystem(theme);
  root.setAttribute('data-style-system', styleSystem);

  const vars = buildThemeVars(theme);
  for (const [key, value] of Object.entries(vars)) {
    root.style.setProperty(key, value);
  }

  document.body.style.fontFamily = `var(--font-body)`;

  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', vars['--color-primary']);
}
