import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig, type Plugin } from 'vite';
import { execSync } from 'child_process';

const BUILD_ID = execSync('git rev-parse --short HEAD').toString().trim();
const BUILD_TIME = new Date().toISOString();
const PORT = parseInt(process.env.PORT || '5173', 10);

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
  define: {
    '__BUILD_ID__': JSON.stringify(BUILD_ID),
    '__BUILD_TIME__': JSON.stringify(BUILD_TIME),
  },
  plugins: [stubNativeModules(), sveltekit()],
  server: {
    port: PORT,
  },
});
