/**
 * Naming convention conversions between MUD Postgres (snake_case)
 * and MUD client (PascalCase tables, camelCase fields).
 *
 * MUD's syncToPostgres uses `snakeCase()` from change-case for both
 * table names and column names. We need to reverse this for the client.
 */
/** Convert snake_case to camelCase: "agi_modifier" → "agiModifier" */
export declare function snakeToCamel(str: string): string;
/** Convert camelCase to snake_case: "agiModifier" → "agi_modifier" */
export declare function camelToSnake(str: string): string;
/** Convert snake_case to PascalCase: "armor_stats" → "ArmorStats" */
export declare function snakeToPascal(str: string): string;
/**
 * Convert a Postgres row's keys from snake_case to camelCase,
 * strip internal metadata columns, and serialize values.
 */
export declare function serializeRow(row: Record<string, unknown>): Record<string, unknown>;
/** Extract __key_bytes from a row and convert to hex string */
export declare function extractKeyBytes(row: Record<string, unknown>): string;
/** Serialize a single value for JSON transport */
export declare function serializeValue(v: unknown): unknown;
/** Convert a Postgres table logical name (snake_case) to the full PascalCase MUD name */
export declare function pgNameToMudName(pgLogical: string): string;
/**
 * Resolve a resource ID name (PascalCase, possibly truncated to 16 chars)
 * to the full PascalCase MUD table name.
 */
export declare function resolveResourceName(resourceName: string): string;
/** Apply known abbreviation fixes to a PascalCase name */
export declare function fixAbbreviations(name: string): string;
