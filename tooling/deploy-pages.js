import { execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

console.log('Building & merging all page apps, then deploying to masjid-live.pages.dev...');
execSync('node tooling/merge-pages.js', { cwd: ROOT, stdio: 'inherit' });
execSync('npx wrangler pages deploy .merged --project-name=masjid-live --branch=master', {
  cwd: ROOT,
  stdio: 'inherit',
});
console.log('Done.');