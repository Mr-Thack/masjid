/**
 * Parse the `style_options` JSON column from `masjid_themes`.
 *
 * The column is TEXT holding a JSON object (see docs/design-language.md §8).
 * Anything unexpected (null, invalid JSON, arrays, primitives) degrades to
 * an empty object so renderers fall back to style-system defaults.
 */
export function parseStyleOptionsJson(raw: string | null | undefined): Record<string, unknown> {
  if (!raw) return {};
  try {
    const value: unknown = JSON.parse(raw);
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }
    return {};
  } catch {
    return {};
  }
}
