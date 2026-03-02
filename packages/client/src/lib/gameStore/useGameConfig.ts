import { useCallback } from 'react';
import { useGameStore } from './store';
import type { TableRow } from './types';

/**
 * Reads a singleton (key=[]) MUD table.
 * These tables have exactly one row. The keyBytes for singletons
 * is typically an empty or fixed value.
 *
 * Replaces: useComponentValue(components.UltimateDominionConfig, singletonEntity)
 */
export function useGameConfig(table: string): TableRow | undefined {
  return useGameStore(
    useCallback(
      (state) => {
        const tableData = state.tables[table];
        if (!tableData) return undefined;
        // Singleton tables have exactly one entry — return the first (only) row
        const keys = Object.keys(tableData);
        if (keys.length === 0) return undefined;
        return tableData[keys[0]];
      },
      [table]
    )
  );
}

/**
 * Non-reactive getter for singleton config.
 */
export function getGameConfig(table: string): TableRow | undefined {
  const tableData = useGameStore.getState().tables[table];
  if (!tableData) return undefined;
  const keys = Object.keys(tableData);
  if (keys.length === 0) return undefined;
  return tableData[keys[0]];
}
