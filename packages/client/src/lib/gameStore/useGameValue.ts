import { useCallback } from 'react';
import { useGameStore } from './store';
import type { TableRow } from './types';

/**
 * Reactive hook that returns a single entity's row from a table.
 * Re-renders only when this specific entity's data changes.
 *
 * Replaces: useComponentValue(components.TableName, entity)
 *
 * @param table - The MUD table name (e.g., "Stats", "Characters")
 * @param keyBytes - The entity's key bytes (hex string)
 * @returns The row data, or undefined if not found
 */
export function useGameValue(table: string, keyBytes: string | undefined): TableRow | undefined {
  return useGameStore(
    useCallback(
      (state) => {
        if (!keyBytes) return undefined;
        return state.tables[table]?.[keyBytes];
      },
      [table, keyBytes]
    )
  );
}

/**
 * Reactive hook that returns all rows from a table.
 * Re-renders when any entity in the table changes.
 *
 * @param table - The MUD table name
 * @returns Map of keyBytes → row data
 */
export function useGameTable(table: string): Record<string, TableRow> {
  return useGameStore(
    useCallback(
      (state) => state.tables[table] || {},
      [table]
    )
  );
}
