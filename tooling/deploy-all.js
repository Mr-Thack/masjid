import { execSync } from 'node:child_process';

const argv = process.argv.slice(2);
const dryRun = argv.includes('--dry-run');
const forceAll = argv.includes('--all');

const changes = execSync('node tooling/changed-packages.js', { encoding: 'utf8' });
const outputLines = changes.trim().split('\n');
const json = JSON.parse(outputLines[outputLines.length - 1]);

if (!json.changed && !forceAll) {
  console.log('No changes detected. Use --all to force deploy everything.');
  process.exit(0);
}

if (forceAll) {
  json.workers = [
    { name: 'api', workspace: '@masjid/api' },
    { name: 'whatsapp', workspace: '@masjid/worker-whatsapp' },
    { name: 'push', workspace: '@masjid/worker-push' },
  ];
  json.pages = [
    { name: 'consumer', workspace: '@masjid/consumer' },
    { name: 'tv', workspace: '@masjid/tv' },
    { name: 'admin', workspace: '@masjid/admin' },
  ];
  console.log('Force-deploying all packages.');
}

if (json.workers.length > 0) {
  const names = json.workers.map((w) => w.name).join(',');
  console.log(`\n=== Deploying workers: ${names} ===`);
  execSync(`node tooling/deploy-workers.js --only=${names} ${dryRun ? '--dry-run' : ''}`, { stdio: 'inherit' });
}

if (json.pages.length > 0) {
  const names = json.pages.map((p) => p.name).join(',');
  console.log(`\n=== Deploying pages: ${names} ===`);
  execSync(`node tooling/deploy-pages.js --only=${names}`, { stdio: 'inherit' });
}

console.log('\n=== All deployments complete ===');