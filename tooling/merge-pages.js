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

writeFileSync(
  path.join(MERGED, '_redirects'),
  `/display/* /__tv_spa.html 200
/admin/* /__admin_spa.html 200
/login /__admin_spa.html 200
/register /__admin_spa.html 200
/* /__consumer_spa.html 200
`,
);
console.log('Wrote _redirects (edge rewrite rules for SPA routing)');

writeFileSync(
  path.join(MERGED, '_headers'),
  `/*
  X-Frame-Options: DENY
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=()

/_app/immutable/*
  Cache-Control: public, max-age=31536000, immutable

/*.js
  Cache-Control: public, max-age=31536000, immutable

/*.css
  Cache-Control: public, max-age=31536000, immutable

/*.png
  Cache-Control: public, max-age=31536000, immutable

/*.svg
  Cache-Control: public, max-age=31536000, immutable

/*.ico
  Cache-Control: public, max-age=31536000, immutable

/*.woff2
  Cache-Control: public, max-age=31536000, immutable

/*.webmanifest
  Cache-Control: public, max-age=31536000, immutable

/*.json
  Cache-Control: public, max-age=31536000, immutable

/sw.js
  Cache-Control: no-cache, no-store, must-revalidate

/*
  Cache-Control: no-cache, no-store, must-revalidate
  Access-Control-Allow-Origin: *
`,
);
console.log('Wrote merged _headers');

const fileCount = execSync(`find ${MERGED} -type f | wc -l`, { encoding: 'utf8' }).trim();
console.log(`\nMerge complete. ${fileCount} files in ${MERGED}`);
console.log('Fallback files:', fallbackFiles.join(', ') || 'none');
console.log(`\nTo deploy: npx wrangler pages deploy ${MERGED} --project-name=masjid-live --branch=master`);