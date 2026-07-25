import { describe, it, expect } from 'vitest';
import { formatCents, monthlyPriceCents } from '../lib/money';

describe('formatCents', () => {
  it('formats 0 as $0.00', () => {
    expect(formatCents(0)).toBe('$0.00');
  });

  it('formats whole dollars', () => {
    expect(formatCents(500)).toBe('$5.00');
    expect(formatCents(1000)).toBe('$10.00');
    expect(formatCents(10000)).toBe('$100.00');
  });

  it('formats dollars and cents', () => {
    expect(formatCents(1250)).toBe('$12.50');
    expect(formatCents(99)).toBe('$0.99');
    expect(formatCents(1)).toBe('$0.01');
  });

  it('formats large amounts', () => {
    expect(formatCents(100000)).toBe('$1000.00');
    expect(formatCents(1234567)).toBe('$12345.67');
  });
});

describe('monthlyPriceCents', () => {
  const term = { prices: { '1': 10000, '2': 16000, '3plus': 20000 } };

  it('returns 0 for 0 children', () => {
    expect(monthlyPriceCents(term, 0)).toBe(0);
  });

  it('returns 0 for negative count', () => {
    expect(monthlyPriceCents(term, -1)).toBe(0);
  });

  it('returns 1-child tier for count 1', () => {
    expect(monthlyPriceCents(term, 1)).toBe(10000);
  });

  it('returns 2-child tier for count 2', () => {
    expect(monthlyPriceCents(term, 2)).toBe(16000);
  });

  it('returns 3plus tier for count 3', () => {
    expect(monthlyPriceCents(term, 3)).toBe(20000);
  });

  it('returns 3plus tier for count 4', () => {
    expect(monthlyPriceCents(term, 4)).toBe(20000);
  });

  it('returns 3plus tier for count 10', () => {
    expect(monthlyPriceCents(term, 10)).toBe(20000);
  });
});