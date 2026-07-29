import { execSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const MERGED = path.join(ROOT, '.merged');

const APPS = [
  { name: 'consumer', dir: 'apps/consumer', workspace: '@masjid/consumer' },
  { name: 'tv', dir: 'apps/tv', workspace: '@masjid/tv' },
  { name: 'admin', dir: 'apps/admin', workspace: '@masjid/admin' },
];

const results = {};

if (!process.env.VITE_API_URL) {
  console.warn(
    '\nWARNING: VITE_API_URL is not set. Consumer/admin apps will fall back\n' +
      'to relative API paths and break when deployed. For deploys, run:\n' +
      '  VITE_API_URL=https://mapi.mr-thack.workers.dev node tooling/merge-pages.js\n',
  );
}

for (const app of APPS) {
  const buildDir = path.join(ROOT, app.dir, 'build');
  console.log(`\n[${app.name}] Building...`);
  try {
    execSync(`npm run build --workspace=${app.workspace}`, {
      cwd: ROOT,
      stdio: 'inherit',
    });
    if (!existsSync(buildDir)) {
      throw new Error(`Build succeeded but build/ directory not found at ${buildDir}`);
    }
    results[app.name] = true;
    console.log(`[${app.name}] OK`);
  } catch (err) {
    results[app.name] = false;
    console.error(`[${app.name}] FAILED — ${err.message}`);
  }
}

const succeeded = APPS.filter((a) => results[a.name]).length;
if (succeeded === 0) {
  console.error('\nNo apps built successfully. Nothing to deploy.');
  process.exit(1);
}

console.log(`\n${succeeded}/${APPS.length} apps built. Merging into ${MERGED}...`);

rmSync(MERGED, { recursive: true, force: true });
mkdirSync(MERGED, { recursive: true });

const fallbackFiles = [];

for (const app of APPS) {
  if (!results[app.name]) {
    console.warn(`[${app.name}] Skipped — build failed`);
    continue;
  }
  const buildDir = path.join(ROOT, app.dir, 'build');

  if (app.name === 'consumer') {
    const src = path.join(buildDir, 'index.html');
    const dst = path.join(buildDir, '__consumer_spa.html');
    if (existsSync(src)) { cpSync(src, dst); rmSync(src); fallbackFiles.push('consumer'); }
  }
  if (app.name === 'tv') {
    const src = path.join(buildDir, '404.html');
    const dst = path.join(buildDir, '__tv_spa.html');
    if (existsSync(src)) { cpSync(src, dst); rmSync(src); fallbackFiles.push('tv'); }
  }
  if (app.name === 'admin') {
    const src = path.join(buildDir, 'index.html');
    const dst = path.join(buildDir, '__admin_spa.html');
    if (existsSync(src)) { cpSync(src, dst); rmSync(src); fallbackFiles.push('admin'); }
  }

  cpSync(buildDir, MERGED, {
    recursive: true,
    force: false,
    errorOnExist: false,
  });
  console.log(`[${app.name}] Copied build → merged`);
}

// NOTE: no `_redirects` — SPA routing is handled by the gateway Worker
// (workers/gateway). `_redirects` 200-rewrites and Pages Functions were both
// tried and failed in production (trapped fallback / fetch(self) loop).
// `_headers` below IS honored by Workers Static Assets.

// _headers is honored by Workers Static Assets, but ALL matching rules are
// combined (values comma-appended). So never put Cache-Control on a broad
// pattern like `/*` or `/*.js` — it would poison the immutable rule below
// (this exact bug shipped once: `no-store` + `immutable` on every chunk).
// SPA fallbacks (__*_spa.html) get their no-store header from the gateway
// Worker instead.
writeFileSync(
  path.join(MERGED, '_headers'),
  `/*
  X-Frame-Options: DENY
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=()
  Access-Control-Allow-Origin: *

/_app/immutable/*
  Cache-Control: public, max-age=31536000, immutable

/sw.js
  Cache-Control: no-cache, no-store, must-revalidate
`,
);
console.log('Wrote merged _headers');

const fileCount = execSync(`find ${MERGED} -type f | wc -l`, { encoding: 'utf8' }).trim();
console.log(`\nMerge complete. ${fileCount} files in ${MERGED}`);
console.log('Fallback files:', fallbackFiles.join(', ') || 'none');
console.log(`\nTo deploy: npx wrangler deploy --cwd workers/gateway`);