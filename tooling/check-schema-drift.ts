#!/usr/bin/env npx tsx
/**
 * Schema drift checker — compares Drizzle ORM schema (schema.ts) against the
 * canonical D1 schema (schema.sql) and reports columns that exist in only one.
 *
 * Run:  npx tsx tooling/check-schema-drift.ts
 *
 * Exit code 0 = no drift, 1 = drift found.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

const ROOT = path.resolve(import.meta.dirname!, '..');
const SCHEMA_SQL_PATH = path.join(ROOT, 'schema.sql');
const SCHEMA_TS_PATH = path.join(ROOT, 'apps/api/src/lib/server/db/schema.ts');

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface SqlCol {
  name: string;
  type: string;
  nullable: boolean;
}

/** Normalize SQLite type affinities: BOOLEAN/INT/TINYINT → INTEGER, TIMESTAMP → TEXT */
function normalizeSqlType(t: string): string {
  const map: Record<string, string> = { INT: 'INTEGER', TINYINT: 'INTEGER', BOOLEAN: 'INTEGER', TIMESTAMP: 'TEXT' };
  return map[t] || t;
}

// ---------------------------------------------------------------------------
// Parse schema.sql → Map<table_name, Map<column_name, SqlCol>>
// ---------------------------------------------------------------------------
function parseSchemaSql(content: string): Map<string, Map<string, SqlCol>> {
  const tables = new Map<string, Map<string, SqlCol>>();

  const tableRe = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(\w+)\s*\(([\s\S]*?)\);/gi;
  let match;

  while ((match = tableRe.exec(content)) !== null) {
    const tableName = match[1];
    const body = match[2];
    const cols = new Map<string, SqlCol>();

    for (const line of body.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('--')) continue;
      if (/^\s*(?:FOREIGN\s+KEY|PRIMARY\s+KEY|UNIQUE|CHECK|CONSTRAINT|CREATE|INDEX)\b/i.test(trimmed)) continue;

      const colMatch = trimmed.match(/^(\w+)\s+(TEXT|INTEGER|INT|REAL|BLOB|BOOLEAN|TIMESTAMP|TINYINT)\b/i);
      if (!colMatch) continue;

      const colName = colMatch[1];
      const rawType = colMatch[2].toUpperCase();
      const colType = normalizeSqlType(rawType);
      const nullable = !/\bNOT\s+NULL\b/i.test(trimmed);

      cols.set(colName, { name: colName, type: colType, nullable });
    }

    tables.set(tableName, cols);
  }

  return tables;
}

// ---------------------------------------------------------------------------
// Parse Drizzle schema.ts → Map<table_name, Map<db_column_name, SqlCol>>
// ---------------------------------------------------------------------------

/** Find matching closing delimiter starting from `openPos` (inclusive). */
function findMatchingClose(content: string, openPos: number, open: string, close: string): number {
  let depth = 0;
  for (let i = openPos; i < content.length; i++) {
    const ch = content[i];
    if (ch === open) depth++;
    else if (ch === close) {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function parseDrizzleSchema(content: string): Map<string, Map<string, SqlCol>> {
  const tables = new Map<string, Map<string, SqlCol>>();

  // Find each sqliteTable('name', ...)
  const tableStartRe = /sqliteTable\s*\(\s*'(\w+)'/g;
  let m;

  while ((m = tableStartRe.exec(content)) !== null) {
    const tableName = m[1];
    const openBrace = content.indexOf('{', m.index);
    if (openBrace === -1) continue;

    const closeBrace = findMatchingClose(content, openBrace, '{', '}');
    if (closeBrace === -1) continue;

    const body = content.slice(openBrace + 1, closeBrace);
    const cols = new Map<string, SqlCol>();

    // Match each column: tsName: colType('db_name')...
    const colRe = /^\s*(\w+)\s*:\s*(text|integer|real)\s*\(\s*'(\w+)'/gm;
    let cm;

    while ((cm = colRe.exec(body)) !== null) {
      const dbColName = cm[3];
      const drizzleType = cm[2];

      // Check if .notNull() appears before the next comma or closing brace
      const afterCol = body.slice(cm.index);
      const endOfCol = afterCol.indexOf(',');
      const endBrace = afterCol.indexOf('}');
      const scanEnd = Math.min(
        endOfCol === -1 ? Infinity : endOfCol,
        endBrace === -1 ? Infinity : endBrace,
      );
      const scan = afterCol.slice(0, scanEnd === Infinity ? undefined : scanEnd);
      const notNull = scan.includes('.notNull()');

      const typeMap: Record<string, string> = {
        text: 'TEXT',
        integer: 'INTEGER',
        real: 'REAL',
      };

      cols.set(dbColName, {
        name: dbColName,
        type: typeMap[drizzleType] || 'TEXT',
        nullable: !notNull,
      });
    }

    tables.set(tableName, cols);
  }

  return tables;
}

// ---------------------------------------------------------------------------
// Compare & report
// ---------------------------------------------------------------------------
interface Drift {
  table: string;
  column: string;
  issue: 'missing_in_sql' | 'missing_in_drizzle' | 'type_mismatch';
  detail: string;
}

function compare(
  sqlTables: Map<string, Map<string, SqlCol>>,
  drizzleTables: Map<string, Map<string, SqlCol>>,
): Drift[] {
  const drift: Drift[] = [];
  const allTables = new Set([...sqlTables.keys(), ...drizzleTables.keys()]);

  for (const table of allTables) {
    const sqlCols = sqlTables.get(table);
    const dzCols = drizzleTables.get(table);

    if (!sqlCols && dzCols) {
      for (const [col] of dzCols) {
        drift.push({ table, column: col, issue: 'missing_in_sql', detail: `table ${table} not found in schema.sql` });
      }
      continue;
    }
    if (sqlCols && !dzCols) {
      for (const [col] of sqlCols) {
        drift.push({ table, column: col, issue: 'missing_in_drizzle', detail: `table ${table} not found in schema.ts` });
      }
      continue;
    }
    if (!sqlCols || !dzCols) continue;

    const allCols = new Set([...sqlCols.keys(), ...dzCols.keys()]);

    for (const col of allCols) {
      const sql = sqlCols.get(col);
      const dz = dzCols.get(col);

      if (!sql && dz) {
        drift.push({ table, column: col, issue: 'missing_in_sql', detail: 'exists in Drizzle but NOT in schema.sql' });
      } else if (sql && !dz) {
        drift.push({ table, column: col, issue: 'missing_in_drizzle', detail: 'exists in schema.sql but NOT in Drizzle' });
      } else if (sql && dz) {
        if (sql.type !== dz.type) {
          drift.push({
            table, column: col, issue: 'type_mismatch',
            detail: `schema.sql=${sql.type}, Drizzle=${dz.type}`,
          });
        }
      }
    }
  }

  return drift;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
function main() {
  const sqlContent = fs.readFileSync(SCHEMA_SQL_PATH, 'utf-8');
  const dzContent = fs.readFileSync(SCHEMA_TS_PATH, 'utf-8');

  const sqlTables = parseSchemaSql(sqlContent);
  const drizzleTables = parseDrizzleSchema(dzContent);

  const drift = compare(sqlTables, drizzleTables);

  if (drift.length === 0) {
    console.log('No schema drift detected — schema.sql and schema.ts are in sync.');
    process.exit(0);
  }

  console.error(`Schema drift detected: ${drift.length} issue(s)\n`);

  const byIssue: Record<string, Drift[]> = {};
  for (const d of drift) {
    (byIssue[d.issue] ??= []).push(d);
  }

  for (const [issue, items] of Object.entries(byIssue)) {
    const label: Record<string, string> = {
      missing_in_sql: 'In Drizzle but MISSING from schema.sql',
      missing_in_drizzle: 'In schema.sql but MISSING from Drizzle',
      type_mismatch: 'Type mismatch',
    };
    console.error(`  ${label[issue] || issue}:`);
    for (const item of items) {
      console.error(`    ${item.table}.${item.column}  (${item.detail})`);
    }
  }

  console.error('\nRun: wrangler d1 execute DB --command "ALTER TABLE ... ADD COLUMN ..."');
  console.error('And/or update schema.sql / schema.ts to match.\n');
  process.exit(1);
}

main();