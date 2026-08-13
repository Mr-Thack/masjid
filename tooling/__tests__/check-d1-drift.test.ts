/**
 * Unit tests for the live D1 drift checker comparison logic (no network).
 * The script itself is exercised against real databases manually / in CI.
 */
import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import { resolve } from 'node:path';
import { compareD1Drift, type D1Col } from '../check-d1-drift.ts';
import { parseSchemaSql, type SqlCol } from '../schema-parse.ts';

const ROOT = resolve(import.meta.dirname!, '..', '..');

function schemaTable(cols: [string, string][]): Map<string, SqlCol> {
  return new Map(cols.map(([name, type]) => [name, { name, type, nullable: true }]));
}

function d1Cols(cols: [string, string][]): D1Col[] {
  return cols.map(([name, type]) => ({ name, type }));
}

describe('compareD1Drift', () => {
  it('returns nothing when schema and database match', () => {
    const schema = new Map([['t', schemaTable([['a', 'TEXT'], ['b', 'INTEGER']])]]);
    const d1 = new Map([['t', d1Cols([['a', 'TEXT'], ['b', 'INTEGER']])]]);
    expect(compareD1Drift(schema, d1)).toEqual([]);
  });

  it('fails on a missing table', () => {
    const schema = new Map([['t', schemaTable([['a', 'TEXT']])]]);
    const d1 = new Map<string, D1Col[]>();
    const issues = compareD1Drift(schema, d1);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ level: 'fail', issue: 'missing_table', table: 't' });
  });

  it('fails on a missing column', () => {
    const schema = new Map([['t', schemaTable([['a', 'TEXT'], ['b', 'TEXT']])]]);
    const d1 = new Map([['t', d1Cols([['a', 'TEXT']])]]);
    const issues = compareD1Drift(schema, d1);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ level: 'fail', issue: 'missing_column', table: 't', column: 'b' });
  });

  it('fails on a type mismatch, with affinity normalization', () => {
    const schema = new Map([['t', schemaTable([['a', 'TEXT'], ['b', 'INTEGER']])]]);
    // a: TEXT vs INTEGER → fail. b: INTEGER vs INT → normalized, no issue.
    const d1 = new Map([['t', d1Cols([['a', 'INTEGER'], ['b', 'INT']])]]);
    const issues = compareD1Drift(schema, d1);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ level: 'fail', issue: 'type_mismatch', column: 'a' });
  });

  it('normalizes TIMESTAMP (schema.sql) to TEXT (D1 declared type)', () => {
    const schema = new Map([['t', schemaTable([['created_at', 'TEXT']])]]);
    const d1 = new Map([['t', d1Cols([['created_at', 'TIMESTAMP']])]]);
    expect(compareD1Drift(schema, d1)).toEqual([]);
  });

  it('warns (not fails) on column order divergence', () => {
    const schema = new Map([['t', schemaTable([['a', 'TEXT'], ['b', 'TEXT'], ['c', 'TEXT']])]]);
    const d1 = new Map([['t', d1Cols([['a', 'TEXT'], ['c', 'TEXT'], ['b', 'TEXT']])]]);
    const issues = compareD1Drift(schema, d1);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ level: 'warn', issue: 'order_mismatch', table: 't' });
  });

  it('warns on extra columns and extra tables but ignores internal tables', () => {
    const schema = new Map([['t', schemaTable([['a', 'TEXT']])]]);
    const d1 = new Map([
      ['t', d1Cols([['a', 'TEXT'], ['extra_col', 'TEXT']])],
      ['extra_table', d1Cols([['x', 'TEXT']])],
      ['sqlite_sequence', d1Cols([['name', 'TEXT']])],
      ['_cf_metadata', d1Cols([['x', 'TEXT']])],
    ]);
    const issues = compareD1Drift(schema, d1);
    expect(issues).toHaveLength(2);
    expect(issues.map((i) => i.issue).sort()).toEqual(['extra_column', 'extra_table']);
    expect(issues.every((i) => i.level === 'warn')).toBe(true);
  });
});

describe('parseSchemaSql (against the real schema.sql)', () => {
  it('parses the content table with columns in declaration order', () => {
    const tables = parseSchemaSql(fs.readFileSync(resolve(ROOT, 'schema.sql'), 'utf-8'));
    const contentTable = tables.get('content');
    expect(contentTable).toBeDefined();
    expect([...contentTable!.keys()]).toEqual([
      'id', 'masjid_id', 'slug', 'title', 'content_markdown', 'compiled_html',
      'content_type', 'show_on_homepage', 'show_on_info', 'is_hidden', 'created_at', 'updated_at',
    ]);
    expect(contentTable!.get('title')!.type).toBe('TEXT');
    expect(contentTable!.get('created_at')!.type).toBe('TEXT'); // TIMESTAMP normalized
  });
});
