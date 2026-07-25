import { execSync } from 'node:child_process';

const pages = [
  { name: 'consumer', pkg: '@masjid/consumer', project: 'masjid-live' },
  { name: 'tv', pkg: '@masjid/tv', project: 'masjid-live-tv' },
  { name: 'admin', pkg: '@masjid/admin', project: 'masjid-live-admin' },
];

const argv = process.argv.slice(2);
const filter = argv.find((a) => a.startsWith('--only='))?.replace('--only=', '');

async function deploy() {
  for (const page of pages) {
    if (filter && page.name !== filter) continue;

    console.log(`\n=== Building ${page.pkg} ===`);
    execSync(`npm run build --workspace=${page.pkg}`, { stdio: 'inherit' });

    console.log(`\n=== Deploying ${page.pkg} to Cloudflare Pages (${page.project}) ===`);
    execSync(`npm run deploy --workspace=${page.pkg}`, { stdio: 'inherit' });
  }
}

deploy().catch((err) => {
  console.error('Deploy failed:', err.message);
  process.exit(1);
});