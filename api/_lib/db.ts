import { neon, types } from '@neondatabase/serverless';

// Match the JSON shapes the frontend got from Supabase/PostgREST:
// BIGINT and NUMERIC as numbers, DATE as 'YYYY-MM-DD' strings.
types.setTypeParser(20, (v) => Number(v)); // int8
types.setTypeParser(1700, (v) => Number(v)); // numeric
types.setTypeParser(1082, (v) => v); // date

/**
 * Get a Neon SQL client (HTTP driver) using the owner connection string.
 * The owner role bypasses RLS, so this replaces the Supabase service_role client.
 */
export function getSql() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error('Missing DATABASE_URL in environment');
  }
  return neon(url);
}

const quoteIdent = (name: string) => `"${name.replace(/"/g, '""')}"`;

/**
 * Bulk upsert rows, equivalent to supabase `.upsert(rows, { onConflict })`:
 * only the columns present in the rows are inserted/updated, others keep their defaults.
 */
export async function upsertRows(
  table: string,
  rows: Record<string, unknown>[],
  conflictColumns: string[],
): Promise<void> {
  if (rows.length === 0) return;

  const columns = Object.keys(rows[0]);
  const cols = columns.map(quoteIdent).join(', ');
  const updates = columns
    .filter((c) => !conflictColumns.includes(c))
    .map((c) => `${quoteIdent(c)} = EXCLUDED.${quoteIdent(c)}`)
    .join(', ');

  const text =
    `INSERT INTO ${quoteIdent(table)} (${cols}) ` +
    `SELECT ${cols} FROM jsonb_populate_recordset(NULL::${quoteIdent(table)}, $1::jsonb) ` +
    `ON CONFLICT (${conflictColumns.map(quoteIdent).join(', ')}) ` +
    (updates ? `DO UPDATE SET ${updates}` : 'DO NOTHING');

  await getSql().query(text, [JSON.stringify(rows)]);
}
