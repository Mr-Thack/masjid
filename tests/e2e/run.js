// ---------------------------------------------------------------------------
// E2E runner — executes suites sequentially, aggregates exit codes.
//
//   node tests/e2e/run.js                  all suites that exist
//   node tests/e2e/run.js --suite=api      one suite
//
// Suite order: api → worker → deploy → consumer → tv → admin. Suites that
// don't exist yet (pending swarm work) are skipped with a note.
// deploy.test.js self-skips on local unless .merged/ exists.
// ---------------------------------------------------------------------------

import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SUITES = ['api', 'worker', 'deploy', 'consumer', 'tv', 'admin'];

const flag = process.argv.find((a) => a.startsWith('--suite='));
const selected = flag ? [flag.slice('--suite='.length)] : SUITES;

console.log(`E2E_ENV=${process.env.E2E_ENV || 'local'}`);

let anyFailed = false;
for (const name of selected) {
  const file = path.join(HERE, `${name}.test.js`);
  if (!existsSync(file)) {
    console.log(`\n--- ${name}: no tests/e2e/${name}.test.js yet (pending) — skipping`);
    continue;
  }
  console.log(`\n--- running ${name} ---`);
  const r = spawnSync(process.execPath, [file], { stdio: 'inherit', env: process.env });
  if (r.status !== 0) anyFailed = true;
}

console.log(anyFailed ? '\nE2E: FAILURES present\n' : '\nE2E: all suites green\n');
process.exit(anyFailed ? 1 : 0);
