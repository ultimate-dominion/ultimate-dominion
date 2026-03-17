import { describe, it, expect, beforeEach } from 'vitest';
import { useGameStore, markReceiptRows, isStaleForRow, isProtectedByNewerBlock } from './store';
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

// ─── dedup (shallowEqual) ──────────────────────────────────

describe('dedup — setRow and applyBatch skip identical data', () => {
  it('setRow with identical data does not create a new table reference', () => {
    useGameStore.getState().setRow('Position', '0xA', { x: 3, y: 4 });
    const ref1 = useGameStore.getState().tables.Position;

    useGameStore.getState().setRow('Position', '0xA', { x: 3, y: 4 });
    const ref2 = useGameStore.getState().tables.Position;

    // Same reference — no Zustand set() was called
    expect(ref1).toBe(ref2);
  });

  it('setRow with different data creates a new table reference', () => {
    useGameStore.getState().setRow('Position', '0xA', { x: 3, y: 4 });
    const ref1 = useGameStore.getState().tables.Position;

    useGameStore.getState().setRow('Position', '0xA', { x: 5, y: 4 });
    const ref2 = useGameStore.getState().tables.Position;

    expect(ref1).not.toBe(ref2);
    expect(useGameStore.getState().tables.Position['0xA']).toEqual({ x: 5, y: 4 });
  });

  it('applyBatch with all-identical data returns same state', () => {
    useGameStore.getState().setRow('Stats', '0xB', { hp: 100, str: 10 });
    const stateBefore = useGameStore.getState();

    useGameStore.getState().applyBatch([
      { type: 'set', table: 'Stats', keyBytes: '0xB', data: { hp: 100, str: 10 } },
    ]);
    const stateAfter = useGameStore.getState();

    // tables reference unchanged — React won't re-render
    expect(stateBefore.tables).toBe(stateAfter.tables);
  });

  it('applyBatch with mixed identical/new data only clones changed tables', () => {
    useGameStore.getState().setRow('Position', '0xA', { x: 1, y: 2 });
    useGameStore.getState().setRow('Stats', '0xA', { hp: 50 });
    const posRef = useGameStore.getState().tables.Position;

    // Position identical, Stats changed
    useGameStore.getState().applyBatch([
      { type: 'set', table: 'Position', keyBytes: '0xA', data: { x: 1, y: 2 } },
      { type: 'set', table: 'Stats', keyBytes: '0xA', data: { hp: 75 } },
    ]);

    // Position table reference preserved (data unchanged)
    expect(useGameStore.getState().tables.Position).toBe(posRef);
    // Stats table reference is new (data changed)
    expect(useGameStore.getState().tables.Stats['0xA']).toEqual({ hp: 75 });
  });

  it('deleteRow on non-existent row is a no-op', () => {
    useGameStore.getState().setRow('Position', '0xA', { x: 1, y: 2 });
    const stateBefore = useGameStore.getState();

    useGameStore.getState().deleteRow('Position', '0xNonExistent');
    const stateAfter = useGameStore.getState();

    expect(stateBefore.tables).toBe(stateAfter.tables);
  });

  it('applyBatch delete on non-existent row is a no-op', () => {
    useGameStore.getState().setRow('Position', '0xA', { x: 1, y: 2 });
    const stateBefore = useGameStore.getState();

    useGameStore.getState().applyBatch([
      { type: 'delete', table: 'Position', keyBytes: '0xNonExistent' },
    ]);
    const stateAfter = useGameStore.getState();

    expect(stateBefore.tables).toBe(stateAfter.tables);
  });
});

// ─── receipt protection ──────────────────────────────────────

describe('receipt protection — markReceiptRows / isStaleForRow', () => {
  it('unprotected rows are never stale', () => {
    expect(isStaleForRow('Position', '0xA', 50)).toBe(false);
  });

  it('WS update at block <= receipt block is stale', () => {
    markReceiptRows([{ table: 'Position', keyBytes: '0xA' }], 100);
    expect(isStaleForRow('Position', '0xA', 99)).toBe(true);
    expect(isStaleForRow('Position', '0xA', 100)).toBe(true);
  });

  it('WS update at block > receipt block is NOT stale and clears protection', () => {
    markReceiptRows([{ table: 'Position', keyBytes: '0xA' }], 100);
    expect(isStaleForRow('Position', '0xA', 101)).toBe(false);
    // Protection removed — subsequent check at old block is also not stale
    expect(isStaleForRow('Position', '0xA', 99)).toBe(false);
  });

  it('different rows are independent', () => {
    markReceiptRows([{ table: 'Position', keyBytes: '0xA' }], 100);
    expect(isStaleForRow('Position', '0xA', 50)).toBe(true);
    expect(isStaleForRow('Position', '0xB', 50)).toBe(false);
    expect(isStaleForRow('Stats', '0xA', 50)).toBe(false);
  });

  it('newer receipt overwrites older protection', () => {
    markReceiptRows([{ table: 'Position', keyBytes: '0xA' }], 100);
    markReceiptRows([{ table: 'Position', keyBytes: '0xA' }], 200);
    expect(isStaleForRow('Position', '0xA', 150)).toBe(true);
    expect(isStaleForRow('Position', '0xA', 200)).toBe(true);
    expect(isStaleForRow('Position', '0xA', 201)).toBe(false);
  });

  it('marks multiple rows in a single call', () => {
    markReceiptRows([
      { table: 'Position', keyBytes: '0xA' },
      { table: 'Stats', keyBytes: '0xA' },
      { table: 'Spawned', keyBytes: '0xA' },
    ], 100);
    expect(isStaleForRow('Position', '0xA', 100)).toBe(true);
    expect(isStaleForRow('Stats', '0xA', 100)).toBe(true);
    expect(isStaleForRow('Spawned', '0xA', 100)).toBe(true);
  });
});

// ─── isProtectedByNewerBlock (deferred splice guard) ──────────

describe('isProtectedByNewerBlock — guards deferred splices against newer receipts', () => {
  it('returns false when no protection exists', () => {
    expect(isProtectedByNewerBlock('EncounterEntity', '0xA', 100)).toBe(false);
  });

  it('returns false when protection is at the same block', () => {
    markReceiptRows([{ table: 'EncounterEntity', keyBytes: '0xA' }], 100);
    expect(isProtectedByNewerBlock('EncounterEntity', '0xA', 100)).toBe(false);
  });

  it('returns false when protection is at an earlier block', () => {
    markReceiptRows([{ table: 'EncounterEntity', keyBytes: '0xA' }], 50);
    expect(isProtectedByNewerBlock('EncounterEntity', '0xA', 100)).toBe(false);
  });

  it('returns true when protection is at a newer block (deferred splice is stale)', () => {
    // Tx at block 200 already processed and protected this row.
    // Deferred splice from block 100 should be skipped.
    markReceiptRows([{ table: 'EncounterEntity', keyBytes: '0xA' }], 200);
    expect(isProtectedByNewerBlock('EncounterEntity', '0xA', 100)).toBe(true);
  });

  it('does not clear protection (unlike isStaleForRow)', () => {
    markReceiptRows([{ table: 'EncounterEntity', keyBytes: '0xA' }], 200);
    // Call multiple times — protection should persist
    expect(isProtectedByNewerBlock('EncounterEntity', '0xA', 100)).toBe(true);
    expect(isProtectedByNewerBlock('EncounterEntity', '0xA', 150)).toBe(true);
    // isStaleForRow still sees the protection
    expect(isStaleForRow('EncounterEntity', '0xA', 200)).toBe(true);
  });

  it('works with multiple rows independently', () => {
    markReceiptRows([{ table: 'EncounterEntity', keyBytes: '0xA' }], 200);
    markReceiptRows([{ table: 'CombatEncounter', keyBytes: '0xB' }], 100);
    // EncounterEntity protected at 200, deferred splice from 100 is stale
    expect(isProtectedByNewerBlock('EncounterEntity', '0xA', 100)).toBe(true);
    // CombatEncounter protected at 100, deferred splice from 100 is NOT stale (same block)
    expect(isProtectedByNewerBlock('CombatEncounter', '0xB', 100)).toBe(false);
  });
});
