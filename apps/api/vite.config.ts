import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig, type Plugin } from 'vite';

function stubNativeModules(): Plugin {
  let isBuild = false;
  const MODULES = ['better-sqlite3', 'drizzle-orm/better-sqlite3'];
  return {
    name: 'stub-native-modules',
    enforce: 'pre',
    configResolved(config) {
      isBuild = config.command === 'build';
    },
    resolveId(id) {
      if (isBuild && MODULES.includes(id)) return '\0virtual:' + id;
    },
    load(id) {
      if (id === '\0virtual:better-sqlite3') return 'export default class Database {}';
      if (id === '\0virtual:drizzle-orm/better-sqlite3') return 'export const drizzle = () => null;';
    },
  };
}

export default defineConfig({
  plugins: [stubNativeModules(), sveltekit()],
  server: {
    port: 5173,
  },
});