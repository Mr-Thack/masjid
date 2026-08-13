/**
 * Theme options for style systems (docs/design-language.md §2, §8).
 *
 * `masjid_themes.style_options` is a JSON column interpreted per style system.
 * Unknown keys are ignored and missing keys fall back to the defaults defined
 * here, so older clients render sanely regardless of what a newer admin wrote.
 */

export type StyleSystemName = 'sakeenah' | 'mishkaat';
export type MetalName = 'gold' | 'silver' | 'copper' | 'rose';
export type MotifName = 'honeycomb' | 'eight-point-star' | 'girih' | 'arabesque' | 'none';
export type NumeralsOption = 'western' | 'arabic-indic';
export type DensityOption = 'standard' | 'large-print';
export type EmblemOption = 'engraved' | 'medallion';
export type ThemeMode = 'dark' | 'light';

export interface QuietHoursOptions {
  enabled?: boolean;
  /** Minutes the screen stays in quiet mode after prayer-in-progress ends. */
  quietMinutes?: number;
  /** Minutes after Isha iqaamah before night calm begins. */
  sleepAfterIshaMinutes?: number;
  /** Minutes before Fajr adhaan when the veil lifts and night calm ends. */
  wakeBeforeFajrMinutes?: number;
}

export interface DonateReason {
  icon: string;
  title: string;
  desc: string;
}

export interface MishkaatStyleOptions {
  metal?: MetalName;
  motif?: MotifName;
  arch?: boolean;
  numerals?: NumeralsOption;
  density?: DensityOption;
  ambient?: boolean;
  themeMode?: ThemeMode;
  quietHours?: QuietHoursOptions;
  /** Enabled frame list for the soul column; undefined/null = all frames. */
  frames?: string[];
  emblem?: EmblemOption;
  /** Wording of the donate appeal slide (admin-customizable). */
  donateAppeal?: string;
  /** URL to the masjid photo for the homepage hero. */
  photoUrl?: string;
  /** URL to the masjid logo image for the header. */
  logoUrl?: string;
  /** WhatsApp group invite link shown on the About/Info page. */
  whatsappGroupUrl?: string;
  /** Cards shown in the "Why Give?" section on the Donate page. */
  donateReasons?: DonateReason[];
}

export interface ResolvedMishkaatOptions {
  metal: MetalName;
  motif: MotifName;
  arch: boolean;
  numerals: NumeralsOption;
  density: DensityOption;
  ambient: boolean;
  themeMode: ThemeMode;
  quietHours: Required<QuietHoursOptions>;
  /** null = every frame enabled (default). */
  frames: string[] | null;
  emblem: EmblemOption;
  donateAppeal: string;
  photoUrl: string;
  logoUrl: string;
  whatsappGroupUrl: string;
  donateReasons: DonateReason[];
}

export const DONATE_REASON_DEFAULTS: DonateReason[] = [
  { icon: '🕌', title: 'Maintain the House of Allah', desc: 'Keep our masjid clean, safe, and welcoming' },
  { icon: '📚', title: 'Support Education', desc: 'Fund classes, lectures, and youth programs' },
  { icon: '🤝', title: 'Serve the Community', desc: 'Help those in need through outreach programs' },
];

export const MISHKAAT_OPTION_DEFAULTS: ResolvedMishkaatOptions = {
  metal: 'gold',
  motif: 'eight-point-star',
  arch: true,
  numerals: 'western',
  density: 'standard',
  ambient: true,
  themeMode: 'dark',
  quietHours: {
    enabled: true,
    quietMinutes: 25,
    sleepAfterIshaMinutes: 90,
    wakeBeforeFajrMinutes: 30,
  },
  frames: null,
  emblem: 'medallion',
  donateAppeal: 'Every contribution makes a difference',
  photoUrl: '',
  logoUrl: '',
  whatsappGroupUrl: '',
  donateReasons: [...DONATE_REASON_DEFAULTS],
};

const METALS: readonly MetalName[] = ['gold', 'silver', 'copper', 'rose'];
const MOTIFS: readonly MotifName[] = ['honeycomb', 'eight-point-star', 'girih', 'arabesque', 'none'];
const NUMERALS: readonly NumeralsOption[] = ['western', 'arabic-indic'];
const DENSITIES: readonly DensityOption[] = ['standard', 'large-print'];
const EMBLEMS: readonly EmblemOption[] = ['engraved', 'medallion'];

/**
 * Parse raw `style_options` input (JSON text from the DB, or an already-parsed
 * object from an API payload). Invalid input degrades to `{}` — never throws.
 * Keys with invalid values are dropped so defaults apply.
 */
export function parseStyleOptions(
  raw: string | Record<string, unknown> | null | undefined,
): MishkaatStyleOptions {
  let value: unknown = raw;
  if (typeof raw === 'string') {
    if (!raw) return {};
    try {
      value = JSON.parse(raw);
    } catch {
      return {};
    }
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};

  const input = value as Record<string, unknown>;
  const out: MishkaatStyleOptions = {};

  if (typeof input.metal === 'string' && (METALS as readonly string[]).includes(input.metal)) {
    out.metal = input.metal as MetalName;
  }
  if (typeof input.motif === 'string' && (MOTIFS as readonly string[]).includes(input.motif)) {
    out.motif = input.motif as MotifName;
  }
  if (typeof input.arch === 'boolean') out.arch = input.arch;
  if (typeof input.numerals === 'string' && (NUMERALS as readonly string[]).includes(input.numerals)) {
    out.numerals = input.numerals as NumeralsOption;
  }
  if (typeof input.density === 'string' && (DENSITIES as readonly string[]).includes(input.density)) {
    out.density = input.density as DensityOption;
  }
  if (typeof input.ambient === 'boolean') out.ambient = input.ambient;
  if (Array.isArray(input.frames)) {
    out.frames = input.frames.filter((f): f is string => typeof f === 'string');
  }
  if (typeof input.emblem === 'string' && (EMBLEMS as readonly string[]).includes(input.emblem)) {
    out.emblem = input.emblem as EmblemOption;
  }
  if (typeof input.themeMode === 'string' && (input.themeMode === 'dark' || input.themeMode === 'light')) {
    out.themeMode = input.themeMode as ThemeMode;
  }
  if (typeof input.donateAppeal === 'string') {
    const appeal = input.donateAppeal.trim();
    if (appeal.length >= 1 && appeal.length <= 80) out.donateAppeal = appeal;
  }
  if (typeof input.photoUrl === 'string') {
    const v = input.photoUrl.trim();
    if (v.length >= 1) out.photoUrl = v;
  }
  if (typeof input.logoUrl === 'string') {
    const v = input.logoUrl.trim();
    if (v.length >= 1) out.logoUrl = v;
  }
  if (typeof input.whatsappGroupUrl === 'string') {
    const v = input.whatsappGroupUrl.trim();
    if (v.length >= 1) out.whatsappGroupUrl = v;
  }
  if (Array.isArray(input.donateReasons)) {
    out.donateReasons = input.donateReasons
      .filter((r: unknown): r is Record<string, unknown> => r != null && typeof r === 'object')
      .map((r) => ({
        icon: typeof r.icon === 'string' ? r.icon.trim() : '',
        title: typeof r.title === 'string' ? r.title.trim() : '',
        desc: typeof r.desc === 'string' ? r.desc.trim() : '',
      }))
      .filter(
        (r) =>
          r.icon.length >= 1 && r.icon.length <= 10 &&
          r.title.length >= 1 && r.title.length <= 100 &&
          r.desc.length >= 1 && r.desc.length <= 200,
      )
      .slice(0, 8) as DonateReason[];
  }
  if (input.quietHours && typeof input.quietHours === 'object' && !Array.isArray(input.quietHours)) {
    const qh = input.quietHours as Record<string, unknown>;
    const quietHours: QuietHoursOptions = {};
    if (typeof qh.enabled === 'boolean') quietHours.enabled = qh.enabled;
    if (typeof qh.quietMinutes === 'number' && Number.isFinite(qh.quietMinutes)) {
      quietHours.quietMinutes = Math.max(0, Math.round(qh.quietMinutes));
    }
    if (typeof qh.sleepAfterIshaMinutes === 'number' && Number.isFinite(qh.sleepAfterIshaMinutes)) {
      quietHours.sleepAfterIshaMinutes = Math.max(0, Math.round(qh.sleepAfterIshaMinutes));
    }
    if (typeof qh.wakeBeforeFajrMinutes === 'number' && Number.isFinite(qh.wakeBeforeFajrMinutes)) {
      quietHours.wakeBeforeFajrMinutes = Math.max(0, Math.round(qh.wakeBeforeFajrMinutes));
    }
    out.quietHours = quietHours;
  }

  return out;
}

/** Fill every missing key with the Mishkaat defaults. */
export function resolveStyleOptions(
  input: MishkaatStyleOptions | null | undefined,
): ResolvedMishkaatOptions {
  const defaults = MISHKAAT_OPTION_DEFAULTS;
  return {
    metal: input?.metal ?? defaults.metal,
    motif: input?.motif ?? defaults.motif,
    arch: input?.arch ?? defaults.arch,
    numerals: input?.numerals ?? defaults.numerals,
    density: input?.density ?? defaults.density,
    ambient: input?.ambient ?? defaults.ambient,
    themeMode: input?.themeMode === 'light' ? 'light' : input?.themeMode === 'dark' ? 'dark' : defaults.themeMode,
    quietHours: {
      enabled: input?.quietHours?.enabled ?? defaults.quietHours.enabled,
      quietMinutes: input?.quietHours?.quietMinutes ?? defaults.quietHours.quietMinutes,
      sleepAfterIshaMinutes:
        input?.quietHours?.sleepAfterIshaMinutes ?? defaults.quietHours.sleepAfterIshaMinutes,
      wakeBeforeFajrMinutes:
        input?.quietHours?.wakeBeforeFajrMinutes ?? defaults.quietHours.wakeBeforeFajrMinutes,
    },
    frames: input?.frames ?? defaults.frames,
    emblem: input?.emblem ?? defaults.emblem,
    donateAppeal: input?.donateAppeal ?? defaults.donateAppeal,
    photoUrl: input?.photoUrl ?? defaults.photoUrl,
    logoUrl: input?.logoUrl ?? defaults.logoUrl,
    whatsappGroupUrl: input?.whatsappGroupUrl ?? defaults.whatsappGroupUrl,
    donateReasons: (input?.donateReasons && input.donateReasons.length > 0)
      ? input.donateReasons
      : [...defaults.donateReasons],
  };
}

export interface MetalPalette {
  /** Deep shade of the metal — brand/primary usages. */
  primary: string;
  /** Bright shade of the metal — accent/highlight usages. */
  accent: string;
  /** Light tint for gradients and fine ornament. */
  accentLight: string;
  /** Translucent glow for pulses and halo effects. */
  glow: string;
}

/**
 * Metal recolors the accent family (docs/design-language.md §7.4):
 * "Same soul, different jewelry — this is the primary vanity knob."
 */
export const metalPalettes: Record<MetalName, MetalPalette> = {
  gold: { primary: '#9c7c1e', accent: '#d4af37', accentLight: '#e9cf7a', glow: 'rgba(212, 175, 55, 0.45)' },
  silver: { primary: '#7d8590', accent: '#c9ced6', accentLight: '#e4e8ee', glow: 'rgba(201, 206, 214, 0.4)' },
  copper: { primary: '#8f5527', accent: '#c77b45', accentLight: '#dfa06f', glow: 'rgba(199, 123, 69, 0.42)' },
  rose: { primary: '#a86a6a', accent: '#d99a9a', accentLight: '#ecc0c0', glow: 'rgba(217, 154, 154, 0.4)' },
};

/**
 * Stock Sakeenah colors written by older registration/seed flows. Under
 * Mishkaat these are treated as "unset" so the metal palette shows through;
 * any other stored color is an explicit admin choice and wins (§7.4:
 * "`primary_color` / `accent_color` remain as raw overrides on top of metal").
 */
export const STOCK_PRIMARY_COLOR = '#1e3a8a';
export const STOCK_ACCENT_COLOR = '#10b981';
