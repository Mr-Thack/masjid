import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      $lib: path.resolve(__dirname, 'apps/api/src/lib'),
    },
  },
  test: {
    globals: true,
    include: ['apps/api/src/__tests__/integration/**/*.test.ts'],
    environment: 'node',
  },
});