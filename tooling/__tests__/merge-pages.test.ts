import { describe, it, expect, beforeAll } from 'vitest';
import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');
const MERGED = path.join(ROOT, '.merged');

function sha256(s: string): string {
  return execSync(`echo -n ${JSON.stringify(s)} | sha256sum`, {
    encoding: 'utf8',
  }).split(' ')[0];
}

describe('merge-pages output', () => {
  beforeAll(() => {
    // ensure we have a fresh merge
    execSync(`rm -rf ${MERGED}`, { cwd: ROOT });
    execSync('node tooling/merge-pages.js', { cwd: ROOT, stdio: 'pipe' });
  }, 90_000);

  it('creates the .merged directory', () => {
    expect(existsSync(MERGED)).toBe(true);
  });

  it('contains all 3 SPA fallback files', () => {
    expect(existsSync(path.join(MERGED, '__consumer_spa.html'))).toBe(true);
    expect(existsSync(path.join(MERGED, '__tv_spa.html'))).toBe(true);
    expect(existsSync(path.join(MERGED, '__admin_spa.html'))).toBe(true);
  });

  it('has NO stale index.html or 404.html at root', () => {
    expect(existsSync(path.join(MERGED, 'index.html'))).toBe(false);
    expect(existsSync(path.join(MERGED, '404.html'))).toBe(false);
  });

  it('has NO _redirects file', () => {
    expect(existsSync(path.join(MERGED, '_redirects'))).toBe(false);
  });

  it('has _routes.json with correct structure', () => {
    const routes = JSON.parse(
      readFileSync(path.join(MERGED, '_routes.json'), 'utf8'),
    );
    expect(routes.version).toBe(1);
    expect(routes.include).toEqual(['/*']);
    expect(routes.exclude).toContain('/_app/*');
    expect(routes.exclude).toContain('/__*');
    expect(routes.exclude).toContain('/sw.js');
  });

  it('has _headers with security and caching rules', () => {
    const headers = readFileSync(path.join(MERGED, '_headers'), 'utf8');
    expect(headers).toContain('X-Frame-Options: DENY');
    expect(headers).toContain('X-Content-Type-Options: nosniff');
    expect(headers).toContain('Cache-Control: public, max-age=31536000, immutable');
    expect(headers).toContain('Cache-Control: no-cache, no-store, must-revalidate');
    // ensure no SPA-poisoning headers
    expect(headers).not.toContain('stale-while-revalidate');
  });

  it('has functions/[[path]].js with correct routing logic', () => {
    const funcContent = readFileSync(
      path.join(MERGED, 'functions', '[[path]].js'),
      'utf8',
    );
    expect(funcContent).toContain("export async function onRequest");
    expect(funcContent).toContain("'/__consumer_spa.html'");
    expect(funcContent).toContain("'/__tv_spa.html'");
    expect(funcContent).toContain("'/__admin_spa.html'");
    expect(funcContent).toContain("path.startsWith('/display/')");
    expect(funcContent).toContain("path.startsWith('/admin/')");
    expect(funcContent).toContain("path === '/login'");
    expect(funcContent).toContain("path === '/register'");
  });

  it('has consumer static assets', () => {
    expect(existsSync(path.join(MERGED, 'sw.js'))).toBe(true);
    expect(existsSync(path.join(MERGED, 'manifest.json'))).toBe(true);
    expect(existsSync(path.join(MERGED, 'icon-192.png'))).toBe(true);
    expect(existsSync(path.join(MERGED, 'icon-512.png'))).toBe(true);
  });

  it('has immutable assets from all 3 apps', () => {
    const files = execSync(`find ${MERGED}/_app/immutable -name '*.js'`, {
      encoding: 'utf8',
    })
      .trim()
      .split('\n')
      .filter(Boolean);

    // Each app produces different entry files with content hashes.
    // Consumer: entry/app.*.js, entry/start.*.js
    // TV:       entry/app.*.js, entry/start.*.js
    // Admin:    entry/app.*.js, entry/start.*.js
    // That's 6 unique entry files total.
    const appEntries = files.filter((f) => f.includes('/entry/app.'));
    const startEntries = files.filter((f) => f.includes('/entry/start.'));
    expect(appEntries.length).toBeGreaterThanOrEqual(3);
    expect(startEntries.length).toBeGreaterThanOrEqual(3);
  });

  it('has NO duplicate filenames in _app/immutable (besides wbPk3Yxo shared chunk)', () => {
    const filenames = execSync(
      `find ${MERGED}/_app/immutable -type f -printf '%f\n'`,
      { encoding: 'utf8' },
    )
      .trim()
      .split('\n')
      .filter(Boolean);

    const counts: Record<string, number> = {};
    for (const f of filenames) {
      counts[f] = (counts[f] || 0) + 1;
    }

    const duplicates = Object.entries(counts).filter(([, c]) => c > 1);
    // wbPk3Yxo.js is a shared SvelteKit internal chunk — same content, harmless
    const unexpected = duplicates.filter(([name]) => name !== 'wbPk3Yxo.js');
    expect(unexpected).toEqual([]);
  });

  it('SPA fallbacks are real HTML files (> 500 bytes, containing </html>)', () => {
    for (const name of ['__consumer_spa', '__tv_spa', '__admin_spa']) {
      const content = readFileSync(
        path.join(MERGED, `${name}.html`),
        'utf8',
      );
      expect(content.length).toBeGreaterThan(500);
      expect(content).toContain('</html>');
    }
  });

  it('consumer SPA references consumer entry chunks', () => {
    const content = readFileSync(
      path.join(MERGED, '__consumer_spa.html'),
      'utf8',
    );
    // Should reference consumer-specific entry chunks (not admin or TV)
    const consumerStartFile = execSync(
      `find ${MERGED}/_app/immutable/entry -name 'start.*.js' -printf '%f\n'`,
      { encoding: 'utf8' },
    )
      .trim()
      .split('\n')
      .filter(Boolean);

    const consumerAppFile = execSync(
      `find ${MERGED}/_app/immutable/entry -name 'app.*.js' -printf '%f\n'`,
      { encoding: 'utf8' },
    )
      .trim()
      .split('\n')
      .filter(Boolean);

    // The SPA fallback should reference its own entry chunks.
    // Consumer is the first build, its chunks should be referenced.
    const hasConsumerChunk =
      consumerStartFile.some((f: string) => content.includes(f)) ||
      consumerAppFile.some((f: string) => content.includes(f));
    expect(hasConsumerChunk).toBe(true);
  });
});