import { create } from 'zustand';
import type { TableRow, TableData, FullSnapshot } from './types';
import { readCachedCharacters, readCachedSnapshot } from './snapshotCache';
import { readSnapshotFromIDB } from './idbSnapshotCache';

// Pre-hydrate from localStorage cache at module load time (before any React render).
// Full snapshot (24MB+) usually can't fit in localStorage, so we fall back to
// loading just the Characters table (~50KB) which is all the fast-path needs.
// The full snapshot is also read from IndexedDB (async, ~10-50ms) for complete data.
const WORLD_ADDRESS = (import.meta.env.VITE_WORLD_ADDRESS || '') as string;
const cachedSnapshot = WORLD_ADDRESS ? readCachedSnapshot(WORLD_ADDRESS) : null;
const cachedCharacters = !cachedSnapshot && WORLD_ADDRESS
  ? readCachedCharacters(WORLD_ADDRESS)
  : null;

/** True if the store has enough pre-loaded data for the fast-path redirect. */
export const wasPreHydrated = !!(cachedSnapshot || cachedCharacters);

/** IndexedDB read kicked off at module load time — resolves in ~10-50ms. */
export const idbSnapshotPromise: Promise<FullSnapshot | null> =
  !cachedSnapshot && WORLD_ADDRESS
    ? readSnapshotFromIDB(WORLD_ADDRESS)
    : Promise.resolve(null);

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
  /** Whether the store has been hydrated with fresh data from the network */
  hydrated: boolean;

  // Actions
  setRow: (table: string, keyBytes: string, data: TableRow) => void;
  deleteRow: (table: string, keyBytes: string) => void;
  applyBatch: (updates: BatchUpdate[]) => void;
  /** Load cached data into tables without setting hydrated (for cache pre-loading) */
  preloadTables: (snapshot: FullSnapshot) => void;
  /** Hydrate with fresh network data — sets hydrated: true, enabling redirect logic */
  hydrate: (snapshot: FullSnapshot) => void;
  setConnected: (connected: boolean) => void;
  setCurrentBlock: (block: number) => void;
};

// ---------------------------------------------------------------------------
// Shallow equality for table rows — prevents duplicate WS/delta/splice
// updates from creating new object references and triggering React re-renders.
// ---------------------------------------------------------------------------
function shallowEqual(a: TableRow, b: TableRow): boolean {
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;
  for (const key of keysA) {
    if (a[key] !== b[key]) return false;
  }
  return true;
}

// Initial tables: full snapshot > characters-only > empty
const initialTables = cachedSnapshot?.tables
  ?? (cachedCharacters ? { Characters: cachedCharacters } : {});

export const useGameStore = create<GameStore>((set, get) => ({
  tables: initialTables,
  connected: false,
  currentBlock: cachedSnapshot?.block ?? 0,
  hydrated: false, // only network fetch sets this — cache data is for rendering, not redirect decisions

  setRow: (table, keyBytes, data) => {
    const state = get();
    const existing = state.tables[table]?.[keyBytes];
    if (existing && shallowEqual(existing, data)) return;
    set({
      tables: {
        ...state.tables,
        [table]: {
          ...state.tables[table],
          [keyBytes]: data,
        },
      },
    });
  },

  deleteRow: (table, keyBytes) =>
    set((state) => {
      if (!state.tables[table]?.[keyBytes]) return state;
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
      let anyChanged = false;
      // Track which tables have been cloned to avoid double-spreading
      const cloned = new Set<string>();

      for (const update of updates) {
        if (update.type === 'set') {
          const existing = newTables[update.table]?.[update.keyBytes];
          if (existing && shallowEqual(existing, update.data!)) continue;

          if (!cloned.has(update.table)) {
            newTables[update.table] = { ...(newTables[update.table] || {}) };
            cloned.add(update.table);
          }
          newTables[update.table][update.keyBytes] = update.data!;
          anyChanged = true;
        } else {
          if (!newTables[update.table]?.[update.keyBytes]) continue;

          if (!cloned.has(update.table)) {
            newTables[update.table] = { ...(newTables[update.table] || {}) };
            cloned.add(update.table);
          }
          delete newTables[update.table][update.keyBytes];
          anyChanged = true;
        }
      }

      if (!anyChanged) return state;
      return { tables: newTables };
    }),

  preloadTables: (snapshot) =>
    set({
      tables: snapshot.tables,
      currentBlock: snapshot.block,
      // hydrated stays false — cache data drives rendering, not redirects
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
