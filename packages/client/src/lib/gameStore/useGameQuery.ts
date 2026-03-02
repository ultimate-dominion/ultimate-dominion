import { useCallback, useMemo } from 'react';
import { useGameStore } from './store';
import type { TableRow } from './types';

/** Stable empty object to avoid infinite re-render loops in Zustand selectors */
const EMPTY_TABLE: Record<string, TableRow> = {};

type QueryResult = { keyBytes: string; data: TableRow };

/**
 * Reactive hook that filters entities in a table by a predicate.
 * Re-renders when the table data changes.
 *
 * Replaces: useEntityQuery([Has(Component), HasValue(Component, {...})])
 *
 * @param table - The primary table to query
 * @param predicate - Filter function (return true to include)
 * @returns Array of matching { keyBytes, data } pairs
 */
export function useGameQuery(
  table: string,
  predicate?: (keyBytes: string, data: TableRow) => boolean
): QueryResult[] {
  const tableData = useGameStore(
    useCallback(
      (state) => state.tables[table] ?? EMPTY_TABLE,
      [table]
    )
  );

  return useMemo(() => {
    const results: QueryResult[] = [];
    for (const [keyBytes, data] of Object.entries(tableData)) {
      if (!predicate || predicate(keyBytes, data)) {
        results.push({ keyBytes, data });
      }
    }
    return results;
  }, [tableData, predicate]);
}

/**
 * Reactive hook that finds a single entity matching a predicate.
 *
 * Replaces: runQuery([HasValue(Component, {owner: address})])[0]
 */
export function useGameFind(
  table: string,
  predicate: (keyBytes: string, data: TableRow) => boolean
): QueryResult | undefined {
  const tableData = useGameStore(
    useCallback(
      (state) => state.tables[table] ?? EMPTY_TABLE,
      [table]
    )
  );

  return useMemo(() => {
    for (const [keyBytes, data] of Object.entries(tableData)) {
      if (predicate(keyBytes, data)) {
        return { keyBytes, data };
      }
    }
    return undefined;
  }, [tableData, predicate]);
}

/**
 * Non-reactive utility to check if an entity exists in a table.
 * Use in predicates passed to useGameQuery.
 */
export function hasEntity(table: string, keyBytes: string): boolean {
  return !!useGameStore.getState().tables[table]?.[keyBytes];
}
