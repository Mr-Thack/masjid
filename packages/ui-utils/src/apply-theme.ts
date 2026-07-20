import { presetTokens } from './presets.js';

export interface ThemeInput {
  primary_color?: string | null;
  accent_color?: string | null;
  font_heading?: string | null;
  font_body?: string | null;
  layout_preset?: string | null;
}

/**
 * Apply a masjid theme to the document root.
 *
 * Safe to call during SSR: it bails out when `document` is not available.
 * Existing CSS variables (e.g. `--color-bg`) are consumed by both the consumer
 * front-end and the TV display so their visual presets stay in sync.
 */
export function applyTheme(theme: ThemeInput | null | undefined): void {
  if (typeof document === 'undefined') return;

  const root = document.documentElement;

  root.style.setProperty('--color-primary', theme?.primary_color ?? '#1e3a8a');
  root.style.setProperty('--color-accent', theme?.accent_color ?? '#10b981');
  root.style.setProperty('--font-heading', `${theme?.font_heading ?? 'Inter'}, sans-serif`);
  root.style.setProperty('--font-body', `${theme?.font_body ?? 'Inter'}, sans-serif`);

  const preset = theme?.layout_preset;
  const tokens = presetTokens[preset ?? ''] ?? presetTokens['glass-dark'];
  for (const [key, value] of Object.entries(tokens)) {
    root.style.setProperty(key, value);
  }

  if (preset === 'minimal-light') {
    root.style.setProperty('--color-primary-light', '#3b5cb8');
    root.style.setProperty('--color-primary-dark', '#13265e');
    root.style.setProperty('--color-accent-light', '#34d399');
  }

  document.body.style.fontFamily = `var(--font-body)`;

  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', theme?.primary_color ?? '#1e3a8a');
}
