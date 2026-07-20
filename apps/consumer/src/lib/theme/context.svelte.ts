import { onMount } from 'svelte';

export const presetTokens: Record<string, Record<string, string>> = {
  'glass-dark': {
    '--color-bg': '#030712',
    '--color-surface': 'rgba(17, 24, 39, 0.6)',
    '--color-text': '#f9fafb',
    '--color-text-muted': '#9ca3af',
    '--color-text-dim': '#6b7280',
    '--color-border': 'rgba(255, 255, 255, 0.06)',
    '--color-border-hover': 'rgba(255, 255, 255, 0.12)',
  },
  'minimal-light': {
    '--color-bg': '#f8fafc',
    '--color-surface': 'rgba(255, 255, 255, 0.9)',
    '--color-text': '#0f172a',
    '--color-text-muted': '#64748b',
    '--color-text-dim': '#94a3b8',
    '--color-border': 'rgba(0, 0, 0, 0.08)',
    '--color-border-hover': 'rgba(0, 0, 0, 0.16)',
  },
};

export function applyTheme(
  theme: {
    primary_color?: string | null;
    accent_color?: string | null;
    font_heading?: string | null;
    font_body?: string | null;
    layout_preset?: string | null;
  } | null | undefined,
) {
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