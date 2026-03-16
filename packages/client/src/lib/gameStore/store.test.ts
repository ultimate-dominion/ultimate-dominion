import { describe, it, expect, beforeEach } from 'vitest';
import { useGameStore } from './store';
import type { FullSnapshot } from './types';

function makeSnapshot(block: number, overrides?: Record<string, Record<string, Record<string, unknown>>>): FullSnapshot {
  return {
    block,
    tables: {
      Characters: { '0x01': { name: 'Hero', level: 5 } },
      ...overrides,
    },
  };
}

beforeEach(() => {
  // Reset store to initial state between tests
  useGameStore.setState({
    tables: {},
    connected: false,
    currentBlock: 0,
    hydrated: false,
  });
});

// ─── preloadTables ───────────────────────────────────────────

describe('preloadTables', () => {
  it('loads tables into the store', () => {
    const snap = makeSnapshot(100);
    useGameStore.getState().preloadTables(snap);

    const state = useGameStore.getState();
    expect(state.tables).toEqual(snap.tables);
    expect(state.currentBlock).toBe(100);
  });

  it('does NOT set hydrated to true', () => {
    const snap = makeSnapshot(100);
    useGameStore.getState().preloadTables(snap);

    expect(useGameStore.getState().hydrated).toBe(false);
  });

  it('replaces existing tables entirely', () => {
    useGameStore.setState({ tables: { Old: { '0x01': { foo: 'bar' } } } });
    const snap = makeSnapshot(200);
    useGameStore.getState().preloadTables(snap);

    expect(useGameStore.getState().tables.Old).toBeUndefined();
    expect(useGameStore.getState().tables.Characters).toBeDefined();
  });
});

// ─── hydrate ─────────────────────────────────────────────────

describe('hydrate', () => {
  it('loads tables and sets hydrated to true', () => {
    const snap = makeSnapshot(300);
    useGameStore.getState().hydrate(snap);

    const state = useGameStore.getState();
    expect(state.tables).toEqual(snap.tables);
    expect(state.currentBlock).toBe(300);
    expect(state.hydrated).toBe(true);
  });

  it('sets hydrated even after preloadTables left it false', () => {
    const cached = makeSnapshot(100);
    const fresh = makeSnapshot(200, { Battles: { '0x02': { id: 'b1' } } });

    useGameStore.getState().preloadTables(cached);
    expect(useGameStore.getState().hydrated).toBe(false);

    useGameStore.getState().hydrate(fresh);
    expect(useGameStore.getState().hydrated).toBe(true);
    expect(useGameStore.getState().tables.Battles).toBeDefined();
  });
});

// ─── hydration sequence (simulates refresh flow) ─────────────

describe('hydration sequence', () => {
  it('preloadTables then hydrate: hydrated only true after hydrate', () => {
    // Simulates: IDB cache loads first, then network fetch arrives
    const staleCache = makeSnapshot(50, {
      Characters: { '0x01': { name: 'Hero', level: 3, worldEncounter: 'shop-1' } },
    });
    const freshNetwork = makeSnapshot(100, {
      Characters: { '0x01': { name: 'Hero', level: 5 } },
    });

    // Step 1: IDB cache pre-loads
    useGameStore.getState().preloadTables(staleCache);
    expect(useGameStore.getState().hydrated).toBe(false);
    expect(useGameStore.getState().tables.Characters['0x01'].worldEncounter).toBe('shop-1');

    // Step 2: Network fetch hydrates
    useGameStore.getState().hydrate(freshNetwork);
    expect(useGameStore.getState().hydrated).toBe(true);
    expect(useGameStore.getState().tables.Characters['0x01'].worldEncounter).toBeUndefined();
    expect(useGameStore.getState().tables.Characters['0x01'].level).toBe(5);
  });

  it('multiple preloadTables calls never set hydrated', () => {
    useGameStore.getState().preloadTables(makeSnapshot(10));
    useGameStore.getState().preloadTables(makeSnapshot(20));
    useGameStore.getState().preloadTables(makeSnapshot(30));

    expect(useGameStore.getState().hydrated).toBe(false);
    expect(useGameStore.getState().currentBlock).toBe(30);
  });

  it('WS updates after hydrate preserve hydrated flag', () => {
    useGameStore.getState().hydrate(makeSnapshot(100));
    expect(useGameStore.getState().hydrated).toBe(true);

    // Simulate WS update via setRow
    useGameStore.getState().setRow('Characters', '0x01', { name: 'Hero', level: 6 });
    expect(useGameStore.getState().hydrated).toBe(true);
    expect(useGameStore.getState().tables.Characters['0x01'].level).toBe(6);
  });

  it('second hydrate (tab-wake re-hydration) replaces all tables', () => {
    useGameStore.getState().hydrate(makeSnapshot(100));
    useGameStore.getState().hydrate(makeSnapshot(200, {
      Characters: { '0x01': { name: 'Hero', level: 10 } },
    }));

    expect(useGameStore.getState().hydrated).toBe(true);
    expect(useGameStore.getState().currentBlock).toBe(200);
    expect(useGameStore.getState().tables.Characters['0x01'].level).toBe(10);
  });
});
