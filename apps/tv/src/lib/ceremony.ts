/**
 * Ceremony state machine (docs/design-language.md §7.6) — shared logic lives
 * in `@masjid/ui-utils/ceremony` so the consumer app (§7.11) computes the
 * same states; this shim keeps existing TV import paths stable.
 */
export * from '@masjid/ui-utils/ceremony';
