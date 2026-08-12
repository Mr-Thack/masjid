#!/usr/bin/env node
import { execSync } from 'node:child_process';

const ROOT = process.cwd();
const workspaces = [
  '@masjid/api',
  '@masjid/consumer',
  '@masjid/tv',
  '@masjid/admin',
];

function run(cmd, label) {
  console.log(`\n  ${label}...`);
  execSync(cmd, { stdio: 'inherit', cwd: ROOT });
}

console.log('First-time setup\n');
console.log('  1/3  npm install');
run('npm install', 'Installing dependencies');
console.log('  2/3  svelte-kit sync (generates .svelte-kit for all workspaces)');
for (const ws of workspaces) {
  run(`npx --workspace=${ws} svelte-kit sync`, `  ${ws}`);
}
console.log('  3/3  seed DB');
run('npx tsx tooling/seed.ts', 'Seeding local.db');
console.log('\nDone. Run `npm run dev:all` to start everything.\n');

