import '@testing-library/jest-dom/vitest';
import { vi, beforeEach } from 'vitest';

globalThis.fetch = vi.fn();

const store: Record<string, string> = {};
globalThis.localStorage = {
  getItem: vi.fn((key: string) => store[key] ?? null),
  setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
  removeItem: vi.fn((key: string) => { delete store[key]; }),
  clear: vi.fn(() => { for (const k in store) delete store[k]; }),
  length: 0,
  key: vi.fn(() => null),
};

globalThis.matchMedia = vi.fn().mockImplementation((query: string) => ({
  matches: false,
  media: query,
  onchange: null,
  addListener: vi.fn(),
  removeListener: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  dispatchEvent: vi.fn(),
}));

globalThis.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

beforeEach(() => {
  vi.mocked(globalThis.fetch).mockReset();
  vi.mocked(globalThis.localStorage.getItem).mockReset();
  vi.mocked(globalThis.localStorage.setItem).mockReset();
  vi.mocked(globalThis.localStorage.removeItem).mockReset();
  vi.mocked(globalThis.localStorage.clear).mockReset();
  Object.keys(store).forEach(k => delete store[k]);
});

vi.mock('svelte-sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    message: vi.fn(),
    dismiss: vi.fn(),
  },
}));
