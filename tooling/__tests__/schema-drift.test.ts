/**
 * Integration test: schema.sql MUST stay in sync with Drizzle schema.ts.
 * This catches drift BEFORE it reaches production.
 */
import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname!, '..', '..');
const SCRIPT = resolve(ROOT, 'tooling/check-schema-drift.ts');

describe('schema drift check (schema.sql vs schema.ts)', () => {
  it('has zero drift', () => {
    try {
      execFileSync('npx', ['tsx', SCRIPT], {
        cwd: ROOT,
        stdio: 'pipe',
        timeout: 15000,
      });
    } catch (e: unknown) {
      const err = e as { stdout?: Buffer; stderr?: Buffer; status?: number };
      const msg = err.stderr?.toString() || err.stdout?.toString() || String(e);
      expect.fail(`Schema drift detected:\n${msg}`);
    }
  });
});