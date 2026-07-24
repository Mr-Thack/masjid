import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    include: ['packages/agent/src/__tests__/**/*.test.ts'],
    environment: 'node',
  },
});
