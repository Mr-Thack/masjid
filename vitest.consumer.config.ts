import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import path from 'path';

export default defineConfig({
  plugins: [
    svelte({
      compilerOptions: { runes: true },
    }),
  ],
  resolve: {
    alias: {
      $lib: path.resolve(__dirname, 'apps/consumer/src/lib'),
    },
    conditions: ['browser'],
  },
  test: {
    globals: true,
    include: ['apps/consumer/src/__tests__/**/*.test.ts'],
    environment: 'jsdom',
    setupFiles: ['apps/consumer/src/__tests__/setup.ts'],
  },
});