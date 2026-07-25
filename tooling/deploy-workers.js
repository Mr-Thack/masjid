import { execSync } from 'node:child_process';

const workers = [
  { name: 'api', pkg: '@masjid/api' },
  { name: 'whatsapp', pkg: '@masjid/worker-whatsapp' },
  { name: 'push', pkg: '@masjid/worker-push' },
];

const argv = process.argv.slice(2);
const dryRun = argv.includes('--dry-run');
const filter = argv.find((a) => a.startsWith('--only='))?.replace('--only=', '');

async function deploy() {
  for (const worker of workers) {
    if (filter && worker.name !== filter) continue;

    console.log(`\n=== Building ${worker.pkg} ===`);
    execSync(`npm run build --workspace=${worker.pkg}`, { stdio: 'inherit' });

    const cmd = dryRun
      ? `npm run deploy:dry --workspace=${worker.pkg}`
      : `npm run deploy --workspace=${worker.pkg}`;

    console.log(`\n=== Deploying ${worker.pkg} (${dryRun ? 'dry run' : 'production'}) ===`);
    execSync(cmd, { stdio: 'inherit' });
  }
}

deploy().catch((err) => {
  console.error('Deploy failed:', err.message);
  process.exit(1);
});