import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { config } from '../config.js';

/** Raw PostgresJS client for direct SQL queries */
export const sql = postgres(config.database.url, {
  max: 20,
  idle_timeout: 20,
  connect_timeout: 10,
});

/** Drizzle ORM instance (required by MUD's syncToPostgres) */
export const db = drizzle(sql);

/** The Postgres schema where MUD decoded tables live (world address lowercase) */
export const mudSchema = config.world.address.toLowerCase();

/**
 * Query a MUD decoded table. Handles schema + table quoting.
 * Returns all non-deleted rows from the given table name.
 */
export async function queryTable(tableName: string, where?: string, params?: unknown[]) {
  const fullTable = `"${mudSchema}"."${tableName}"`;
  const whereClause = where ? `WHERE ${where}` : '';
  // Use unsafe for dynamic table names — table names come from our own discovery, not user input
  return sql.unsafe(`SELECT * FROM ${fullTable} ${whereClause}`, params as any[]);
}

/**
 * Query rows updated at or after a specific block number.
 */
export async function queryUpdatedRows(tableName: string, blockNumber: bigint) {
  const fullTable = `"${mudSchema}"."${tableName}"`;
  return sql.unsafe(
    `SELECT * FROM ${fullTable} WHERE "__last_updated_block_number" >= $1`,
    [blockNumber.toString()]
  );
}

/**
 * Discover all MUD tables in the world's schema.
 * Returns a map of table_name → column names.
 */
export async function discoverTables(): Promise<Map<string, string[]>> {
  const rows = await sql`
    SELECT table_name, column_name
    FROM information_schema.columns
    WHERE table_schema = ${mudSchema}
    ORDER BY table_name, ordinal_position
  `;

  const tables = new Map<string, string[]>();
  for (const row of rows) {
    const tableName = row.table_name as string;
    const colName = row.column_name as string;
    if (!tables.has(tableName)) {
      tables.set(tableName, []);
    }
    tables.get(tableName)!.push(colName);
  }

  return tables;
}

export async function closeDb() {
  await sql.end();
}
