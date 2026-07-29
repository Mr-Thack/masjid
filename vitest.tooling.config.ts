import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    include: ['tooling/__tests__/**/*.test.ts'],
    environment: 'node',
  },
});