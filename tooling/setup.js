#!/usr/bin/env node
import { execSync } from 'node:child_process';
import { copyFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

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

// ── 1. Install ──────────────────────────────────────────────
console.log('  1/4  npm install');
run('npm install', 'Installing dependencies');

// ── 2. Sync SvelteKit types ─────────────────────────────────
console.log('  2/4  svelte-kit sync (generates .svelte-kit for all workspaces)');
for (const ws of workspaces) {
  run(`npx --workspace=${ws} svelte-kit sync`, `  ${ws}`);
}

// ── 3. Dev secrets (copy .env.dev → .dev.vars if needed) ────
console.log('  3/4  dev secrets');
const envDev = resolve(ROOT, '.env.dev');
const devVars = resolve(ROOT, 'apps/api/.dev.vars');
if (!existsSync(devVars) && existsSync(envDev)) {
  copyFileSync(envDev, devVars);
  console.log('  Copied .env.dev → apps/api/.dev.vars');
} else if (existsSync(devVars)) {
  console.log('  apps/api/.dev.vars already exists');
} else {
  console.log('  .env.dev not found — skipping secrets setup');
}

// ── 4. Seed DB ───────────────────────────────────────────────
console.log('  4/4  seed DB');
run('npx tsx tooling/seed.ts', 'Seeding local.db');

console.log('\nDone. Run `npm run dev:all` to start everything.\n');
