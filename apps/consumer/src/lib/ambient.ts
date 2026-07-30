/**
 * Ambient palette for the consumer shell (docs/design-language.md §7.11,
 * mild mobile version of §7.4): one background tint per prayer-linked solar
 * phase. Pure and unit-testable — the layout applies the result as
 * `data-ambient-phase` on the app root.
 */
import {
  getAmbientPhase,
  parseStyleOptions,
  resolveStyleOptions,
  resolveStyleSystem,
  type AmbientPhase,
} from '@masjid/ui-utils';

export interface AmbientPrayerTimes {
  fajr?: { adhaan?: string } | null;
  sunrise?: string | null;
  asr?: { adhaan?: string } | null;
  maghrib?: { iqaamah?: string } | null;
}

export interface AmbientTheme {
  style_system?: string;
  style_options?: Record<string, unknown> | string | null;
}

function toMinutes(t: string | null | undefined): number | null {
  if (!t) return null;
  const [h, m] = t.split(':').map(Number);
  return h != null && m != null && Number.isFinite(h) && Number.isFinite(m) ? h * 60 + m : null;
}

/**
 * The ambient phase for the current moment, or null when the ambient
 * background should not apply (Sakeenah, ambient option off, or today's
 * times incomplete).
 */
export function ambientPhaseFor(
  theme: AmbientTheme | null | undefined,
  prayerTimes: AmbientPrayerTimes | null | undefined,
  now: Date,
): AmbientPhase | null {
  if (resolveStyleSystem(theme) !== 'mishkaat') return null;
  const options = resolveStyleOptions(parseStyleOptions(theme?.style_options ?? null));
  if (!options.ambient) return null;

  const fajr = toMinutes(prayerTimes?.fajr?.adhaan);
  const sunrise = toMinutes(prayerTimes?.sunrise);
  const asr = toMinutes(prayerTimes?.asr?.adhaan);
  const maghrib = toMinutes(prayerTimes?.maghrib?.iqaamah);
  if (fajr == null || sunrise == null || asr == null || maghrib == null) return null;

  return getAmbientPhase(now.getHours() * 60 + now.getMinutes(), fajr, sunrise, asr, maghrib);
}
