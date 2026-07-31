import { execSync } from 'node:child_process';

const argv = process.argv.slice(2);
const dryRun = argv.includes('--dry-run');

console.log('Deploying everything...');

console.log('\n=== Deploying workers ===');
execSync(`node tooling/deploy-workers.js ${dryRun ? '--dry-run' : ''}`, { stdio: 'inherit' });

console.log('\n=== Deploying pages ===');
execSync('node tooling/deploy-pages.js', { stdio: 'inherit' });

console.log('\n=== All deployments complete ===');