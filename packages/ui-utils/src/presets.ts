export const presetTokens: Record<string, Record<string, string>> = {
  'glass-dark': {
    '--color-bg': '#030712',
    '--color-surface': 'rgba(17, 24, 39, 0.6)',
    '--color-text': '#f9fafb',
    '--color-text-muted': '#d1d5db',
    '--color-text-dim': '#9ca3af',
    '--color-border': 'rgba(255, 255, 255, 0.06)',
    '--color-border-hover': 'rgba(255, 255, 255, 0.12)',
    '--color-current-highlight': 'rgba(255, 255, 255, 0.08)',
    '--glass-shine': 'rgba(255, 255, 255, 0.06)',
    '--shadow-card': '0 4px 24px rgba(0, 0, 0, 0.28), inset 0 1px 0 var(--glass-shine)',
    '--shadow-card-hover': '0 8px 32px rgba(0, 0, 0, 0.34), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
  },
  'minimal-light': {
    '--color-bg': '#f8fafc',
    '--color-surface': '#ffffff',
    '--color-text': '#0f172a',
    '--color-text-muted': '#64748b',
    '--color-text-dim': '#94a3b8',
    '--color-border': 'rgba(0, 0, 0, 0.1)',
    '--color-border-hover': 'rgba(0, 0, 0, 0.18)',
    '--color-current-highlight': 'rgba(0, 0, 0, 0.06)',
    '--glass-shine': 'rgba(255, 255, 255, 0.6)',
    '--shadow-card': '0 4px 20px rgba(0, 0, 0, 0.06), inset 0 1px 0 var(--glass-shine)',
    '--shadow-card-hover': '0 8px 28px rgba(0, 0, 0, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.8)',
  },
  // Mishkaat flagship preset (docs/design-language.md §7.4): dark-warm espresso
  // base, warm ivory text, gold hairline ornament. Accent/primary colors come
  // from the metal palette (gold default), not from this token block.
  'mishkaat': {
    '--color-bg': '#17100a',
    '--color-surface': 'rgba(43, 32, 19, 0.55)',
    '--color-text': '#f3e9d2',
    '--color-text-muted': '#d8c8a5',
    '--color-text-dim': '#9c8b6e',
    '--color-border': 'rgba(212, 175, 55, 0.14)',
    '--color-border-hover': 'rgba(212, 175, 55, 0.3)',
    '--color-current-highlight': 'rgba(212, 175, 55, 0.1)',
    '--glass-shine': 'rgba(243, 233, 210, 0.05)',
    '--shadow-card': '0 4px 24px rgba(0, 0, 0, 0.45), inset 0 1px 0 var(--glass-shine)',
    '--shadow-card-hover': '0 8px 32px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(243, 233, 210, 0.08)',
  },
};
