#!/usr/bin/env npx tsx
/**
 * Live D1 drift checker — compares schema.sql against the ACTUAL target D1
 * database and fails the deploy when the database can't serve the code.
 *
 * The file-based checker (check-schema-drift.ts) only proves schema.sql and
 * the Drizzle schema agree with each other; it says nothing about the real
 * databases, which only change when someone manually runs wrangler d1 execute.
 * This script closes that gap (the "no such table: posts" staging incident,
 * 2026-08-06).
 *
 * FAIL (exit 1) — deploy-breakers:
 *   - table in schema.sql missing from D1
 *   - column in schema.sql missing from D1
 *   - column type mismatch
 *
 * WARN (exit 0) — informational:
 *   - table/column present in D1 but not in schema.sql (undocumented drift;
 *     appended columns are runtime-safe but should be backfilled into
 *     schema.sql)
 *   - column ORDER divergence (lesson 31's original hazard). Safe today:
 *     Drizzle generates explicit column lists in its SELECTs (so physical
 *     order can't scramble results) and masjid_themes queries go through the
 *     raw-D1 named-row bypass. Prod legitimately diverges here — legacy
 *     ALTER TABLE appends vs schema.sql's logical order. Kept visible
 *     because schema.sql is the canonical DDL for fresh database creates.
 *
 * Usage:
 *   npx tsx tooling/check-d1-drift.ts <database-id-or-name> [--schema=path/to/schema.sql]
 *
 * Required env: CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_API_TOKEN
 * Exit codes: 0 = clean (warnings ok), 1 = drift, 2 = could not check.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseSchemaSql, normalizeSqlType, type SqlCol } from './schema-parse.ts';

const ROOT = path.resolve(import.meta.dirname!, '..');

// ---------------------------------------------------------------------------
// Types + comparison (exported for unit tests)
// ---------------------------------------------------------------------------

/** A live D1 column; array order = cid order (position in the table). */
export interface D1Col {
  name: string;
  type: string;
}

export interface DriftIssue {
  level: 'fail' | 'warn';
  table: string;
  column?: string;
  issue:
    | 'missing_table'
    | 'missing_column'
    | 'type_mismatch'
    | 'order_mismatch'
    | 'extra_table'
    | 'extra_column';
  detail: string;
}

/** Internal D1/sqlite bookkeeping tables — never drift. */
function isInternalTable(name: string): boolean {
  return name.startsWith('sqlite_') || name.startsWith('_cf_') || name.startsWith('d1_');
}

export function compareD1Drift(
  schemaTables: Map<string, Map<string, SqlCol>>,
  d1Tables: Map<string, D1Col[]>,
): DriftIssue[] {
  const issues: DriftIssue[] = [];

  for (const [table, schemaCols] of schemaTables) {
    const d1Cols = d1Tables.get(table);

    if (!d1Cols) {
      issues.push({
        level: 'fail',
        table,
        issue: 'missing_table',
        detail: `table ${table} exists in schema.sql but NOT in the target database`,
      });
      continue;
    }

    const d1ByName = new Map(d1Cols.map((c) => [c.name, c]));

    for (const [colName, schemaCol] of schemaCols) {
      const d1Col = d1ByName.get(colName);
      if (!d1Col) {
        issues.push({
          level: 'fail',
          table,
          column: colName,
          issue: 'missing_column',
          detail: 'exists in schema.sql but NOT in the target database',
        });
      } else {
        const d1Type = normalizeSqlType(d1Col.type.toUpperCase());
        if (d1Type !== schemaCol.type) {
          issues.push({
            level: 'fail',
            table,
            column: colName,
            issue: 'type_mismatch',
            detail: `schema.sql=${schemaCol.type}, D1=${d1Type}`,
          });
        }
      }
    }

    // Lesson-31 note: physical column order diverges on legacy databases
    // (ALTER TABLE only appends) vs schema.sql's logical order. This is a
    // WARNING, not a failure — verified safe on prod 2026-08-06: Drizzle
    // lists columns explicitly in SELECTs and masjid_themes reads go through
    // the raw-D1 named-row bypass, so physical order cannot scramble data.
    const common = [...schemaCols.keys()].filter((c) => d1ByName.has(c));
    const d1Order = d1Cols.map((c) => c.name).filter((c) => schemaCols.has(c));
    if (common.length > 0 && common.join('') !== d1Order.join('')) {
      issues.push({
        level: 'warn',
        table,
        issue: 'order_mismatch',
        detail: `physical column order differs from schema.sql (safe — see lesson 31; informational only)\n      schema.sql: ${common.join(', ')}\n      D1:         ${d1Order.join(', ')}`,
      });
    }

    for (const d1Col of d1Cols) {
      if (!schemaCols.has(d1Col.name)) {
        issues.push({
          level: 'warn',
          table,
          column: d1Col.name,
          issue: 'extra_column',
          detail: 'exists in the database but NOT in schema.sql — backfill schema.sql',
        });
      }
    }
  }

  for (const table of d1Tables.keys()) {
    if (!schemaTables.has(table) && !isInternalTable(table)) {
      issues.push({
        level: 'warn',
        table,
        issue: 'extra_table',
        detail: 'exists in the database but NOT in schema.sql',
      });
    }
  }

  return issues;
}

// ---------------------------------------------------------------------------
// Cloudflare D1 REST API
// ---------------------------------------------------------------------------

interface QueryResult {
  results: Record<string, unknown>[];
}

async function d1Query(account: string, token: string, dbId: string, sql: string): Promise<Record<string, unknown>[]> {
  const resp = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${account}/d1/database/${dbId}/query`,
    {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ sql }),
      signal: AbortSignal.timeout(20000),
    },
  );

  const body = (await resp.json()) as {
    success?: boolean;
    errors?: { message?: string }[];
    result?: ({ results?: Record<string, unknown>[] } & Record<string, unknown>)[];
  };

  if (!resp.ok || !body.success) {
    const errs = (body.errors ?? []).map((e) => e.message).filter(Boolean).join('; ');
    throw new Error(`D1 query failed (HTTP ${resp.status})${errs ? `: ${errs}` : ''} — SQL: ${sql}`);
  }

  const first = body.result?.[0] as QueryResult | undefined;
  return first?.results ?? [];
}

/**
 * Resolve the argument to a database UUID. Database IDs go stale when a DB is
 * recreated (the staging DB was recreated 2026-08-05, orphaning the old ID in
 * local .env files), so a plain name like "masjid-db-staging" is accepted and
 * resolved via the list endpoint.
 */
async function resolveDbId(account: string, token: string, arg: string): Promise<string> {
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(arg)) return arg;

  const resp = await fetch(`https://api.cloudflare.com/client/v4/accounts/${account}/d1/database?per_page=100`, {
    headers: { authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(20000),
  });
  const body = (await resp.json()) as {
    success?: boolean;
    result?: { uuid: string; name: string }[];
  };
  if (!resp.ok || !body.success) {
    throw new Error(`could not list D1 databases (HTTP ${resp.status}) to resolve "${arg}"`);
  }
  const match = (body.result ?? []).find((d) => d.name === arg);
  if (!match) {
    const known = (body.result ?? []).map((d) => d.name).join(', ');
    throw new Error(`no D1 database named "${arg}" on this account (found: ${known})`);
  }
  return match.uuid;
}

async function fetchD1Schema(account: string, token: string, dbId: string, wanted: string[]): Promise<Map<string, D1Col[]>> {
  const tables = new Map<string, D1Col[]>();

  const rows = await d1Query(account, token, dbId, "SELECT name FROM sqlite_master WHERE type='table'");
  const existing = new Set(rows.map((r) => String(r.name)));

  // One PRAGMA per wanted table that actually exists (parallel; ~15 tables).
  const present = wanted.filter((t) => existing.has(t));
  const pragmas = await Promise.all(
    present.map((t) =>
      d1Query(account, token, dbId, `SELECT name, type FROM pragma_table_info('${t.replace(/'/g, "''")}') ORDER BY cid`),
    ),
  );
  for (let i = 0; i < present.length; i++) {
    tables.set(
      present[i],
      pragmas[i].map((r) => ({ name: String(r.name), type: String(r.type) })),
    );
  }

  // Record existence of every table (so extra-table warnings work).
  for (const name of existing) {
    if (!tables.has(name)) tables.set(name, []);
  }

  return tables;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  const args = process.argv.slice(2);
  const dbId = args.find((a) => !a.startsWith('--'));
  const schemaArg = args.find((a) => a.startsWith('--schema='));
  const schemaPath = schemaArg ? path.resolve(schemaArg.slice('--schema='.length)) : path.join(ROOT, 'schema.sql');

  const account = process.env.CLOUDFLARE_ACCOUNT_ID;
  const token = process.env.CLOUDFLARE_API_TOKEN;

  if (!dbId || !account || !token) {
    console.error('Usage: npx tsx tooling/check-d1-drift.ts <database-id-or-name> [--schema=path]');
    console.error('Required env: CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_API_TOKEN');
    process.exit(2);
  }

  const schemaTables = parseSchemaSql(fs.readFileSync(schemaPath, 'utf-8'));

  resolveDbId(account, token, dbId)
    .then((id) => fetchD1Schema(account, token, id, [...schemaTables.keys()]))
    .then((d1Tables) => {
      const issues = compareD1Drift(schemaTables, d1Tables);
      const fails = issues.filter((i) => i.level === 'fail');
      const warns = issues.filter((i) => i.level === 'warn');

      for (const w of warns) {
        console.warn(`  WARN  ${w.table}${w.column ? '.' + w.column : ''}  (${w.detail})`);
      }

      if (fails.length === 0) {
        console.log(
          `No live D1 drift — schema.sql matches the target database (${schemaTables.size} tables checked${warns.length ? `, ${warns.length} warning(s)` : ''}).`,
        );
        process.exit(0);
      }

      console.error(`\nLive D1 drift detected: ${fails.length} deploy-breaking issue(s)\n`);
      for (const f of fails) {
        console.error(`  FAIL  ${f.table}${f.column ? '.' + f.column : ''}  [${f.issue}]`);
        console.error(`        ${f.detail}`);
      }
      console.error('\nThe database cannot serve the code being deployed. Apply the missing');
      console.error('schema first, e.g.:');
      console.error('  wrangler d1 execute <db-name> --remote --file=migration.sql');
      console.error('Then re-run this check. Do NOT deploy past a failing gate.\n');
      process.exit(1);
    })
    .catch((err) => {
      console.error(`Could not check live D1 drift: ${err instanceof Error ? err.message : err}`);
      process.exit(2);
    });
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (isMain) main();
