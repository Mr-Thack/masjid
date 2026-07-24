import { vi } from 'vitest';

export const goto = vi.fn(() => Promise.resolve());
export const invalidate = vi.fn(() => Promise.resolve());
export const invalidateAll = vi.fn(() => Promise.resolve());
export const beforeNavigate = vi.fn();
export const afterNavigate = vi.fn();
export const preloadData = vi.fn(() => Promise.resolve(null));
export const preloadCode = vi.fn(() => Promise.resolve());
