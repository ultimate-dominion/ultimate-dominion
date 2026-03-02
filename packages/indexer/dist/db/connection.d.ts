import postgres from 'postgres';
/** Raw PostgresJS client for direct SQL queries */
export declare const sql: postgres.Sql<{}>;
/** Drizzle ORM instance (required by MUD's syncToPostgres) */
export declare const db: import("drizzle-orm/postgres-js").PostgresJsDatabase<Record<string, never>>;
/** The Postgres schema where MUD decoded tables live (world address lowercase) */
export declare const mudSchema: string;
/**
 * Query a MUD decoded table. Handles schema + table quoting.
 * Returns all non-deleted rows from the given table name.
 */
export declare function queryTable(tableName: string, where?: string, params?: unknown[]): Promise<postgres.RowList<(postgres.Row & Iterable<postgres.Row>)[]>>;
/**
 * Query rows updated at or after a specific block number.
 */
export declare function queryUpdatedRows(tableName: string, blockNumber: bigint): Promise<postgres.RowList<(postgres.Row & Iterable<postgres.Row>)[]>>;
/**
 * Discover all MUD tables in the world's schema.
 * Returns a map of table_name → column names.
 */
export declare function discoverTables(): Promise<Map<string, string[]>>;
export declare function closeDb(): Promise<void>;
