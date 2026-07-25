export function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export function monthlyPriceCents(term: { prices: { '1': number; '2': number; '3plus': number } }, count: number): number {
  if (count <= 0) return 0;
  if (count === 1) return term.prices['1'];
  if (count === 2) return term.prices['2'];
  return term.prices['3plus'];
}
