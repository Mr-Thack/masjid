import { execSync } from 'node:child_process';

const ALL_WORKERS = [
  { name: 'api', dir: 'apps/api', workspace: '@masjid/api' },
  { name: 'whatsapp', dir: 'workers/whatsapp', workspace: '@masjid/worker-whatsapp' },
  { name: 'push', dir: 'workers/push', workspace: '@masjid/worker-push' },
];

const ALL_PAGES = [
  { name: 'consumer', dir: 'apps/consumer', workspace: '@masjid/consumer' },
  { name: 'tv', dir: 'apps/tv', workspace: '@masjid/tv' },
  { name: 'admin', dir: 'apps/admin', workspace: '@masjid/admin' },
];

const DEPLOYABLE = {
  'apps/api': { name: 'api', dir: 'apps/api', workspace: '@masjid/api', type: 'worker', deps: ['packages/schemas'] },
  'apps/tv': { name: 'tv', dir: 'apps/tv', workspace: '@masjid/tv', type: 'page', deps: ['packages/schemas', 'packages/ui-utils'] },
  'apps/consumer': { name: 'consumer', dir: 'apps/consumer', workspace: '@masjid/consumer', type: 'page', deps: ['packages/schemas', 'packages/ui-utils'] },
  'apps/admin': { name: 'admin', dir: 'apps/admin', workspace: '@masjid/admin', type: 'page', deps: ['packages/schemas', 'packages/ui-utils'] },
  'workers/whatsapp': { name: 'whatsapp', dir: 'workers/whatsapp', workspace: '@masjid/worker-whatsapp', type: 'worker', deps: ['packages/schemas', 'packages/agent'] },
  'workers/push': { name: 'push', dir: 'workers/push', workspace: '@masjid/worker-push', type: 'worker', deps: ['packages/schemas'] },
};

const LIBS = ['packages/schemas', 'packages/ui-utils', 'packages/agent'];

function getChangedFiles() {
  if (process.env.CI || process.argv.includes('--all')) {
    return null;
  }

  try {
    const head = execSync('git rev-parse HEAD', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }).trim();
    let base;
    try {
      base = execSync('git rev-parse HEAD~1', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }).trim();
    } catch {
      return null;
    }
    return execSync(`git diff --name-only ${base} ${head}`, { encoding: 'utf8' })
      .trim()
      .split('\n')
      .filter(Boolean);
  } catch {
    return null;
  }
}

function main() {
  const changedFiles = getChangedFiles();

  if (changedFiles === null) {
    console.log('CI or first push — deploying everything.');
    console.log(JSON.stringify({ workers: ALL_WORKERS, pages: ALL_PAGES, changed: true }));
    return;
  }

  const libChanged = changedFiles.some((f) => LIBS.some((l) => f.startsWith(l + '/')));
  const rootChanged = changedFiles.some((f) => !f.includes('/') || f.startsWith('tooling/') || f.startsWith('.github/') || f.startsWith('.env'));

  if (rootChanged) {
    console.log('Root/tooling config changed — deploying everything.');
    console.log(JSON.stringify({ workers: ALL_WORKERS, pages: ALL_PAGES, changed: true }));
    return;
  }

  const affectedWorkers = [];
  const affectedPages = [];

  for (const [dir, pkg] of Object.entries(DEPLOYABLE)) {
    const direct = changedFiles.some((f) => f.startsWith(dir + '/'));
    const dep = pkg.deps.some((d) => libChanged);
    if (direct || dep) {
      if (pkg.type === 'worker') affectedWorkers.push(pkg);
      else affectedPages.push(pkg);
    }
  }

  if (affectedWorkers.length === 0 && affectedPages.length === 0) {
    console.log('No deployable packages changed.');
    console.log(JSON.stringify({ workers: [], pages: [], changed: false }));
    return;
  }

  console.log(`Affected: workers=[${affectedWorkers.map((w) => w.name).join(',')}] pages=[${affectedPages.map((p) => p.name).join(',')}]`);
  console.log(JSON.stringify({ workers: affectedWorkers, pages: affectedPages, changed: true }));
}

main();