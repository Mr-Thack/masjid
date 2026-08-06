// ---------------------------------------------------------------------------
// E2E runner — executes suites sequentially, aggregates exit codes.
//
//   node tests/e2e/run.js                          all suites that exist
//   node tests/e2e/run.js --suite=api              one suite
//   node tests/e2e/run.js --suite=api --suite=worker   several suites
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

// ALL --suite=<name> flags are honored (order above is preserved).
const requested = process.argv.filter((a) => a.startsWith('--suite=')).map((a) => a.slice('--suite='.length));
const unknown = requested.filter((r) => !SUITES.includes(r));
if (unknown.length) console.warn(`WARNING: unknown suite(s) ignored: ${unknown.join(', ')} (known: ${SUITES.join(', ')})`);
const selected = requested.length ? SUITES.filter((s) => requested.includes(s)) : SUITES;

console.log(`E2E_ENV=${process.env.E2E_ENV || 'local'} — suites: ${selected.join(', ')}`);

let anyFailed = false;
const timings = [];
const runStart = Date.now();
for (const name of selected) {
  const file = path.join(HERE, `${name}.test.js`);
  if (!existsSync(file)) {
    console.log(`\n--- ${name}: no tests/e2e/${name}.test.js yet (pending) — skipping`);
    continue;
  }
  console.log(`\n--- running ${name} ---`);
  const start = Date.now();
  const r = spawnSync(process.execPath, [file], { stdio: 'inherit', env: process.env });
  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  timings.push(`${name} ${elapsed}s${r.status === 0 ? '' : ' (FAILED)'}`);
  if (r.status !== 0) anyFailed = true;
}

console.log(`\n--- suite timings: ${timings.join(' | ')} (total ${((Date.now() - runStart) / 1000).toFixed(1)}s)`);
console.log(anyFailed ? '\nE2E: FAILURES present\n' : '\nE2E: all suites green\n');
process.exit(anyFailed ? 1 : 0);
