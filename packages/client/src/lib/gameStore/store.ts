import { create } from 'zustand';
import type { TableRow, TableData, FullSnapshot } from './types';

export type BatchUpdate = {
  type: 'set' | 'delete';
  table: string;
  keyBytes: string;
  data?: TableRow;
};

export type GameStore = {
  /** Table data: tableName → entityKeyBytes → row data */
  tables: TableData;
  /** WebSocket connection state */
  connected: boolean;
  /** Latest indexed block number */
  currentBlock: number;
  /** Whether the store has been hydrated with initial data */
  hydrated: boolean;

  // Actions
  setRow: (table: string, keyBytes: string, data: TableRow) => void;
  deleteRow: (table: string, keyBytes: string) => void;
  applyBatch: (updates: BatchUpdate[]) => void;
  hydrate: (snapshot: FullSnapshot) => void;
  setConnected: (connected: boolean) => void;
  setCurrentBlock: (block: number) => void;
};

export const useGameStore = create<GameStore>((set, get) => ({
  tables: {},
  connected: false,
  currentBlock: 0,
  hydrated: false,

  setRow: (table, keyBytes, data) =>
    set((state) => ({
      tables: {
        ...state.tables,
        [table]: {
          ...state.tables[table],
          [keyBytes]: data,
        },
      },
    })),

  deleteRow: (table, keyBytes) =>
    set((state) => {
      const tableData = { ...state.tables[table] };
      delete tableData[keyBytes];
      return {
        tables: {
          ...state.tables,
          [table]: tableData,
        },
      };
    }),

  applyBatch: (updates) =>
    set((state) => {
      const newTables = { ...state.tables };
      for (const update of updates) {
        if (update.type === 'set') {
          newTables[update.table] = {
            ...(newTables[update.table] || {}),
            [update.keyBytes]: update.data!,
          };
        } else {
          const copy = { ...(newTables[update.table] || {}) };
          delete copy[update.keyBytes];
          newTables[update.table] = copy;
        }
      }
      return { tables: newTables };
    }),

  hydrate: (snapshot) =>
    set({
      tables: snapshot.tables,
      currentBlock: snapshot.block,
      hydrated: true,
    }),

  setConnected: (connected) => set({ connected }),
  setCurrentBlock: (block) => set({ currentBlock: block }),
}));

/**
 * Get a single entity's row from a table (non-reactive).
 * Use this in callbacks and system calls — not in render.
 */
export function getTableValue(table: string, keyBytes: string): TableRow | undefined {
  return useGameStore.getState().tables[table]?.[keyBytes];
}

/**
 * Get all entities in a table (non-reactive).
 */
export function getTableEntries(table: string): Record<string, TableRow> {
  return useGameStore.getState().tables[table] || {};
}
