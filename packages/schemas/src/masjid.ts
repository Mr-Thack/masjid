import { z } from 'zod';

export const TenantStatus = z.enum(['SHADOW', 'ACTIVE']);
export type TenantStatus = z.infer<typeof TenantStatus>;

export const CalculationMethod = z.number().int().min(1).default(2);

export const AsrMadhab = z.enum(['shafi', 'hanafi']).default('shafi');
export const HighLatitudeRule = z.enum(['seventh_of_night', 'middle_of_night', 'twilight_angle', 'none']).default('seventh_of_night');
export const ShowDualAsr = z.boolean().default(false);

// ---------------------------------------------------------------------------
// Style systems (see docs/design-language.md)
// ---------------------------------------------------------------------------

/** A top-level design family. `sakeenah` = minimal, `mishkaat` = flagship. */
export const StyleSystem = z.enum(['sakeenah', 'mishkaat']).default('sakeenah');
export type StyleSystem = z.infer<typeof StyleSystem>;

export const StyleMetal = z.enum(['gold', 'silver', 'copper', 'rose']);
export type StyleMetal = z.infer<typeof StyleMetal>;
export const StyleMotif = z.enum(['honeycomb', 'eight-point-star', 'girih', 'arabesque', 'none']);
export type StyleMotif = z.infer<typeof StyleMotif>;
export const StyleNumerals = z.enum(['western', 'arabic-indic']);
export type StyleNumerals = z.infer<typeof StyleNumerals>;
export const StyleDensity = z.enum(['standard', 'large-print']);
export type StyleDensity = z.infer<typeof StyleDensity>;
export const StyleEmblem = z.enum(['engraved', 'medallion']);
export type StyleEmblem = z.infer<typeof StyleEmblem>;

/**
 * Theme options for a style system, stored as JSON in `masjid_themes.style_options`.
 * Missing keys fall back to defaults at render time; unknown keys pass through
 * (and are ignored by renderers) so newer clients can write options older
 * clients do not understand yet.
 */
export const StyleOptionsSchema = z
  .object({
    metal: StyleMetal.optional(),
    motif: StyleMotif.optional(),
    arch: z.boolean().optional(),
    numerals: StyleNumerals.optional(),
    density: StyleDensity.optional(),
    ambient: z.boolean().optional(),
    quietHours: z
      .object({
        enabled: z.boolean().optional(),
        quietMinutes: z.number().int().min(0).max(180).optional(),
        sleepAfterIshaMinutes: z.number().int().min(0).max(360).optional(),
        wakeBeforeFajrMinutes: z.number().int().min(0).max(180).optional(),
      })
      .passthrough()
      .optional(),
    frames: z.array(z.string()).optional(),
    emblem: StyleEmblem.optional(),
    donateAppeal: z.string().trim().min(1).max(80).optional(),
  })
  .passthrough();
export type StyleOptions = z.infer<typeof StyleOptionsSchema>;

export const CreateMasjidSchema = z.object({
  slug: z
    .string()
    .min(3)
    .max(50)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be lowercase alphanumeric with hyphens'),
  name: z.string().min(1).max(200),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  timezone: z.string().min(1).default('America/Chicago'),
  calculation_method: CalculationMethod,
  asr_madhab: AsrMadhab,
  high_latitude_rule: HighLatitudeRule,
  show_dual_asr: ShowDualAsr,
  admin_email: z.string().email(),
  admin_password: z.string().min(8).max(128),
  admin_display_name: z.string().min(1).max(100).optional(),
});

export const UpdateMasjidSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  address_line1: z.string().max(200).optional().nullable(),
  address_line2: z.string().max(200).optional().nullable(),
  city: z.string().max(100).optional().nullable(),
  state: z.string().max(100).optional().nullable(),
  postal_code: z.string().max(20).optional().nullable(),
  country: z.string().max(100).optional().nullable(),
  contact_phone: z.string().max(30).optional().nullable(),
  contact_email: z.string().email().max(200).optional().nullable(),
  facebook_url: z.string().url().max(500).optional().nullable(),
  youtube_url: z.string().url().max(500).optional().nullable(),
  instagram_url: z.string().url().max(500).optional().nullable(),
  website_url: z.string().url().max(500).optional().nullable(),
  external_donation_url: z.string().url().max(500).optional().nullable(),
  calculation_method: CalculationMethod.optional(),
  asr_madhab: AsrMadhab.optional(),
  high_latitude_rule: HighLatitudeRule.optional(),
  show_dual_asr: ShowDualAsr.optional(),
  timezone: z.string().min(1).optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
});

export const ThemeSchema = z.object({
  style_system: StyleSystem,
  style_options: StyleOptionsSchema.default({}),
  layout_preset: z.string(),
  primary_color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  accent_color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  font_heading: z.string(),
  font_body: z.string(),

  time_format: z.enum(['12h', '24h']),
  label_adhaan: z.string(),
  label_iqaamah: z.string(),
  label_jumuah: z.string(),
  label_speech: z.string(),
  label_sunrise: z.string(),
  label_fajr: z.string(),
  label_dhuhr: z.string(),
  label_asr: z.string(),
  label_maghrib: z.string(),
  label_isha: z.string(),
});
export type Theme = z.infer<typeof ThemeSchema>;

export const UpdateThemeSchema = ThemeSchema.partial();

export const MasjidProfileSchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  latitude: z.number(),
  longitude: z.number(),
  timezone: z.string(),
  calculation_method: z.number().int(),
  asr_madhab: z.string(),
  high_latitude_rule: z.string(),
  show_dual_asr: z.boolean(),
  tenant_status: TenantStatus,
  address_line1: z.string().nullable(),
  address_line2: z.string().nullable(),
  city: z.string().nullable(),
  state: z.string().nullable(),
  postal_code: z.string().nullable(),
  country: z.string().nullable(),
  contact_phone: z.string().nullable(),
  contact_email: z.string().nullable(),
  facebook_url: z.string().nullable(),
  youtube_url: z.string().nullable(),
  instagram_url: z.string().nullable(),
  website_url: z.string().nullable(),
  external_donation_url: z.string().nullable(),
  created_at: z.string(),
  theme: ThemeSchema.nullable(),
});
export type MasjidProfile = z.infer<typeof MasjidProfileSchema>;

export const MasjidPublicSchema = z.object({
  slug: z.string(),
  name: z.string(),
  address_line1: z.string().nullable(),
  address_line2: z.string().nullable(),
  city: z.string().nullable(),
  state: z.string().nullable(),
  postal_code: z.string().nullable(),
  country: z.string().nullable(),
  contact_phone: z.string().nullable(),
  contact_email: z.string().nullable(),
  facebook_url: z.string().nullable(),
  youtube_url: z.string().nullable(),
  instagram_url: z.string().nullable(),
  website_url: z.string().nullable(),
  external_donation_url: z.string().nullable(),
});
export type MasjidPublic = z.infer<typeof MasjidPublicSchema>;