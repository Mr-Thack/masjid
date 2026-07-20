import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      $lib: path.resolve(__dirname, 'workers/whatsapp/src'),
    },
  },
  test: {
    globals: true,
    include: ['workers/whatsapp/src/__tests__/**/*.test.ts'],
    environment: 'node',
  },
});
