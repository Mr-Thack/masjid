/**
 * Shared schema.sql parser — used by both drift checkers:
 *   tooling/check-schema-drift.ts  (schema.sql vs Drizzle schema.ts)
 *   tooling/check-d1-drift.ts      (schema.sql vs the live D1 database)
 *
 * Map iteration order = column declaration order (used by the D1 checker for
 * the lesson-31 column-order guard).
 */

export interface SqlCol {
  name: string;
  type: string;
  nullable: boolean;
}

/** Normalize SQLite type affinities: BOOLEAN/INT/TINYINT → INTEGER, TIMESTAMP → TEXT */
export function normalizeSqlType(t: string): string {
  const map: Record<string, string> = { INT: 'INTEGER', TINYINT: 'INTEGER', BOOLEAN: 'INTEGER', TIMESTAMP: 'TEXT' };
  return map[t] || t;
}

/** Parse schema.sql → Map<table_name, Map<column_name, SqlCol>> (order-preserving). */
export function parseSchemaSql(content: string): Map<string, Map<string, SqlCol>> {
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
