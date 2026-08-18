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

/**
 * Deep-merge an incoming partial style_options block over the stored blob.
 *
 * Nested plain objects (like `quietHours`) are merged recursively so a
 * partial send like `{quietHours: {enabled: false}}` preserves sibling
 * keys (`quietMinutes`, `sleepAfterIshaMinutes`, etc.) that were not
 * included in the update.
 *
 * Arrays (like `frames`, `donateReasons`) are replaced wholesale — that
 * is the correct semantics for list-shaped fields.
 */
export function mergeStyleOptions(
  stored: Record<string, unknown>,
  incoming: Record<string, unknown>,
): Record<string, unknown> {
  const merged: Record<string, unknown> = { ...stored };
  for (const [key, value] of Object.entries(incoming)) {
    const existing = merged[key];
    if (
      existing != null && typeof existing === 'object' && !Array.isArray(existing) &&
      value != null && typeof value === 'object' && !Array.isArray(value)
    ) {
      merged[key] = mergeStyleOptions(existing as Record<string, unknown>, value as Record<string, unknown>);
    } else {
      merged[key] = value;
    }
  }
  return merged;
}
