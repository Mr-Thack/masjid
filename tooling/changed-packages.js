import { execSync } from 'node:child_process';

const PACKAGES = {
  api: { dir: 'apps/api', type: 'worker', workspace: '@masjid/api', deps: ['packages/schemas'] },
  tv: { dir: 'apps/tv', type: 'page', workspace: '@masjid/tv', deps: ['packages/schemas', 'packages/ui-utils'] },
  consumer: { dir: 'apps/consumer', type: 'page', workspace: '@masjid/consumer', deps: ['packages/schemas', 'packages/ui-utils'] },
  admin: { dir: 'apps/admin', type: 'page', workspace: '@masjid/admin', deps: ['packages/schemas', 'packages/ui-utils'] },
  whatsapp: { dir: 'workers/whatsapp', type: 'worker', workspace: '@masjid/worker-whatsapp', deps: ['packages/schemas', 'packages/agent'] },
  push: { dir: 'workers/push', type: 'worker', workspace: '@masjid/worker-push', deps: ['packages/schemas'] },
  agent: { dir: 'packages/agent', type: 'lib', deps: ['packages/schemas'] },
  schemas: { dir: 'packages/schemas', type: 'lib', deps: [] },
  'ui-utils': { dir: 'packages/ui-utils', type: 'lib', deps: ['packages/schemas'] },
};

function getChangedFiles(base = 'HEAD^') {
  try {
    return execSync(`git diff --name-only ${base} HEAD`, { encoding: 'utf8' })
      .trim()
      .split('\n')
      .filter(Boolean);
  } catch {
    return execSync('git diff --name-only HEAD~1 HEAD', { encoding: 'utf8' })
      .trim()
      .split('\n')
      .filter(Boolean);
  }
}

function resolveAffected(changedFiles) {
  const affected = new Set();

  for (const pkgName of Object.keys(PACKAGES)) {
    const pkg = PACKAGES[pkgName];
    if (changedFiles.some((f) => f.startsWith(pkg.dir + '/'))) {
      affected.add(pkgName);
    }
  }

  let expanded = new Set(affected);
  let changed = true;
  while (changed) {
    changed = false;
    for (const pkgName of Object.keys(PACKAGES)) {
      if (expanded.has(pkgName)) continue;
      const pkg = PACKAGES[pkgName];
      for (const dep of pkg.deps) {
        const depName = Object.keys(PACKAGES).find((k) => PACKAGES[k].dir === dep);
        if (depName && expanded.has(depName)) {
          expanded.add(pkgName);
          changed = true;
          break;
        }
      }
    }
  }

  const libsChanged = [...expanded].some((p) => PACKAGES[p].type === 'lib');
  if (libsChanged) {
    for (const pkgName of Object.keys(PACKAGES)) {
      if (PACKAGES[pkgName].type !== 'lib') {
        expanded.add(pkgName);
      }
    }
  }

  return [...expanded].filter((p) => PACKAGES[p].type !== 'lib');
}

function main() {
  const base = process.argv[2] || 'HEAD^';
  const changedFiles = getChangedFiles(base);

  if (changedFiles.length === 0) {
    console.log('No changes detected. Nothing to deploy.');
    console.log(JSON.stringify({ workers: [], pages: [], changed: false }));
    return;
  }

  const affected = resolveAffected(changedFiles);

  if (affected.length === 0) {
    console.log('Only library changes, nothing deployable.');
    console.log(JSON.stringify({ workers: [], pages: [], changed: false }));
    return;
  }

  const workers = affected
    .filter((p) => PACKAGES[p].type === 'worker')
    .map((p) => ({ name: p, dir: PACKAGES[p].dir, workspace: PACKAGES[p].workspace }));

  const pages = affected
    .filter((p) => PACKAGES[p].type === 'page')
    .map((p) => ({ name: p, dir: PACKAGES[p].dir, workspace: PACKAGES[p].workspace }));

  console.log(`Affected: workers=[${workers.map((w) => w.name).join(',')}] pages=[${pages.map((p) => p.name).join(',')}]`);

  console.log(JSON.stringify({ workers, pages, changed: true }));
}

main();