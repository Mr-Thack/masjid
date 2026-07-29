import { execSync } from 'node:child_process';

const ALL_WORKERS = [
  { name: 'api', dir: 'apps/api', workspace: '@masjid/api' },
  { name: 'whatsapp', dir: 'workers/whatsapp', workspace: '@masjid/worker-whatsapp' },
  { name: 'push', dir: 'workers/push', workspace: '@masjid/worker-push' },
];

const PAGE_DIRS = ['apps/consumer', 'apps/tv', 'apps/admin'];
const PAGE_DEPS = ['packages/schemas', 'packages/ui-utils'];

const DEPLOYABLE = {
  'apps/api': {
    name: 'api', dir: 'apps/api', workspace: '@masjid/api', type: 'worker', deps: ['packages/schemas'],
  },
  'apps/tv': {
    name: 'tv', dir: 'apps/tv', workspace: '@masjid/tv', type: 'page', deps: PAGE_DEPS,
  },
  'apps/consumer': {
    name: 'consumer', dir: 'apps/consumer', workspace: '@masjid/consumer', type: 'page', deps: PAGE_DEPS,
  },
  'apps/admin': {
    name: 'admin', dir: 'apps/admin', workspace: '@masjid/admin', type: 'page', deps: PAGE_DEPS,
  },
  'workers/whatsapp': {
    name: 'whatsapp', dir: 'workers/whatsapp', workspace: '@masjid/worker-whatsapp', type: 'worker',
    deps: ['packages/schemas', 'packages/agent'],
  },
  'workers/push': {
    name: 'push', dir: 'workers/push', workspace: '@masjid/worker-push', type: 'worker',
    deps: ['packages/schemas'],
  },
  // Gateway is deployed by the deploy-gateway job (it needs .merged built first),
  // not the per-worker matrix. Mark it 'page' so changes trigger that job.
  'workers/gateway': {
    name: 'gateway', dir: 'workers/gateway', workspace: '@masjid/gateway', type: 'page',
    deps: [],
  },
};

const LIBS = ['packages/schemas', 'packages/ui-utils', 'packages/agent'];

function getChangedFiles() {
  if (process.env.CI || process.argv.includes('--all')) {
    return null;
  }

  try {
    const head = execSync('git rev-parse HEAD', {
      encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'],
    }).trim();
    let base;
    try {
      base = execSync('git rev-parse HEAD~1', {
        encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'],
      }).trim();
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
    console.log(JSON.stringify({ workers: ALL_WORKERS, pages_changed: true, changed: true }));
    return;
  }

  const libChanged = changedFiles.some((f) =>
    LIBS.some((l) => f.startsWith(l + '/')),
  );
  const rootChanged = changedFiles.some(
    (f) =>
      !f.includes('/') ||
      f.startsWith('tooling/') ||
      f.startsWith('.github/') ||
      f.startsWith('.env'),
  );

  if (rootChanged) {
    console.log('Root/tooling config changed — deploying everything.');
    console.log(JSON.stringify({ workers: ALL_WORKERS, pages_changed: true, changed: true }));
    return;
  }

  const affectedWorkers = [];
  let pagesChanged = false;

  for (const [dir, pkg] of Object.entries(DEPLOYABLE)) {
    const direct = changedFiles.some((f) => f.startsWith(dir + '/'));
    const dep = pkg.deps.some((d) => libChanged);
    if (direct || dep) {
      if (pkg.type === 'worker') {
        affectedWorkers.push(pkg);
      } else {
        pagesChanged = true;
      }
    }
  }

  if (affectedWorkers.length === 0 && !pagesChanged) {
    console.log('No deployable packages changed.');
    console.log(JSON.stringify({ workers: [], pages_changed: false, changed: false }));
    return;
  }

  console.log(
    `Affected: workers=[${affectedWorkers.map((w) => w.name).join(',')}] pages=${pagesChanged}`,
  );
  console.log(
    JSON.stringify({ workers: affectedWorkers, pages_changed: pagesChanged, changed: true }),
  );
}

main();