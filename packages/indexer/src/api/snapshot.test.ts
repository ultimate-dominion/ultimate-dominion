import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { createSnapshotRouter, _resetSnapshotCache } from './snapshot.js';
import type { SyncHandle } from '../sync/startSync.js';

// Mock db connection
vi.mock('../db/connection.js', () => ({
  sql: {
    unsafe: vi.fn(),
  },
  mudSchema: '0xtest',
}));

// Mock naming helpers
vi.mock('../naming.js', () => ({
  extractKeyBytes: (row: Record<string, unknown>) => row.__key_bytes as string,
  serializeRow: (row: Record<string, unknown>) => {
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(row)) {
      if (k.startsWith('__')) continue;
      result[k] = v;
    }
    return result;
  },
}));

import { sql } from '../db/connection.js';

function createApp(syncHandle: SyncHandle) {
  const app = express();
  app.use('/snapshot', createSnapshotRouter(syncHandle));
  return app;
}

function makeSyncHandle(overrides?: Partial<SyncHandle>): SyncHandle {
  return {
    stopSync: vi.fn(),
    latestBlockNumber: 100,
    latestStoredBlockNumber: 100,
    tables: new Map(),
    tableNameMap: new Map([
      ['Position', 'ud__position'],
      ['Spawned', 'ud__spawned'],
      ['Characters', 'ud__characters'],
      ['Stats', 'ud__stats'],
      ['MobStats', 'ud__mob_stats'],
      ['WorldStatusEffects', 'ud__world_status_effects'],
      ['GoldBalances', 'gold__balances'],
      // Reverse mappings (should be skipped)
      ['ud__position', 'ud__position'],
      ['ud__spawned', 'ud__spawned'],
      ['ud__characters', 'ud__characters'],
      ['ud__stats', 'ud__stats'],
      ['ud__mob_stats', 'ud__mob_stats'],
      ['ud__world_status_effects', 'ud__world_status_effects'],
      ['gold__balances', 'gold__balances'],
    ]),
    ...overrides,
  };
}

// Helper to set up sql.unsafe mock responses in the expected query order:
// 1. Characters table (for character key set — queried first now)
// 2. Position table
// 3. Spawned table
// 4+ Remaining tables in tableNameMap iteration order
type MockRows = Record<string, unknown>[];

function mockDbQueries(opts: {
  position?: MockRows;
  spawned?: MockRows;
  characters?: MockRows;
  stats?: MockRows;
  mobStats?: MockRows;
  worldStatusEffects?: MockRows;
  goldBalances?: MockRows;
}) {
  const mockSql = vi.mocked(sql.unsafe);

  // Step 1a: Characters (for key set — queried first)
  mockSql.mockResolvedValueOnce((opts.characters ?? []) as any);
  // Step 1b: Position
  mockSql.mockResolvedValueOnce((opts.position ?? []) as any);
  // Step 1c: Spawned
  mockSql.mockResolvedValueOnce((opts.spawned ?? []) as any);

  // Step 2: remaining tables in iteration order (Characters, Stats, MobStats, WorldStatusEffects, GoldBalances)
  // Characters is NOT in FIRST_PASS_TABLES, so it gets queried again in step 2
  mockSql.mockResolvedValueOnce((opts.characters ?? []) as any);
  mockSql.mockResolvedValueOnce((opts.stats ?? []) as any);
  mockSql.mockResolvedValueOnce((opts.mobStats ?? []) as any);
  mockSql.mockResolvedValueOnce((opts.worldStatusEffects ?? []) as any);
  mockSql.mockResolvedValueOnce((opts.goldBalances ?? []) as any);
}

describe('GET /snapshot', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _resetSnapshotCache();
  });

  it('returns snapshot with block number', async () => {
    mockDbQueries({});
    const app = createApp(makeSyncHandle());
    const res = await request(app).get('/snapshot');

    expect(res.status).toBe(200);
    expect(res.body.block).toBe(100);
    expect(res.body.tables).toBeDefined();
  });

  it('filters dead mob Stats but keeps offline character Stats', async () => {
    const charKey = '0xplayer_abc123';
    const deadMobKey = '0x00000001_dead_mob';
    const aliveMobKey = '0x00000001_alive_mob';

    mockDbQueries({
      position: [
        // Character at (0,0) — offline
        { __key_bytes: charKey, x: 0, y: 0 },
        // Dead mob at (0,0)
        { __key_bytes: deadMobKey, x: 0, y: 0 },
        // Alive mob at real position
        { __key_bytes: aliveMobKey, x: 5, y: 3 },
      ],
      spawned: [
        // Character not spawned — offline
        { __key_bytes: charKey, spawned: false },
        // Dead mob not spawned
        { __key_bytes: deadMobKey, spawned: false },
        // Alive mob spawned
        { __key_bytes: aliveMobKey, spawned: true },
      ],
      characters: [
        // Only the player is a character
        { __key_bytes: charKey, name: 'Hero', locked: true },
      ],
      stats: [
        // Character stats — should NOT be filtered (offline player)
        { __key_bytes: charKey, level: 10, strength: 20, agility: 15, intelligence: 10 },
        // Dead mob stats — SHOULD be filtered
        { __key_bytes: deadMobKey, level: 3, strength: 5, agility: 5, intelligence: 5 },
        // Alive mob stats — should NOT be filtered (alive)
        { __key_bytes: aliveMobKey, level: 5, strength: 10, agility: 8, intelligence: 6 },
      ],
    });

    const app = createApp(makeSyncHandle());
    const res = await request(app).get('/snapshot');

    expect(res.status).toBe(200);

    // Character stats preserved despite being at (0,0) and spawned=false
    expect(res.body.tables.Stats[charKey]).toEqual({
      level: 10, strength: 20, agility: 15, intelligence: 10,
    });

    // Dead mob stats excluded
    expect(res.body.tables.Stats[deadMobKey]).toBeUndefined();

    // Alive mob stats preserved
    expect(res.body.tables.Stats[aliveMobKey]).toEqual({
      level: 5, strength: 10, agility: 8, intelligence: 6,
    });
  });

  it('filters dead mob MobStats and WorldStatusEffects but keeps character entries', async () => {
    const charKey = '0xplayer_xyz';
    const deadMobKey = '0x00000001_mob_dead';

    mockDbQueries({
      position: [
        { __key_bytes: charKey, x: 0, y: 0 },
        { __key_bytes: deadMobKey, x: 0, y: 0 },
      ],
      spawned: [
        { __key_bytes: charKey, spawned: false },
        { __key_bytes: deadMobKey, spawned: false },
      ],
      characters: [
        { __key_bytes: charKey, name: 'Mage', locked: true },
      ],
      stats: [],
      mobStats: [
        // Dead mob — should be filtered
        { __key_bytes: deadMobKey, isElite: false },
      ],
      worldStatusEffects: [
        // Character effect — should NOT be filtered
        { __key_bytes: charKey, appliedStatusEffects: ['0xeff1'] },
        // Dead mob effect — should be filtered
        { __key_bytes: deadMobKey, appliedStatusEffects: ['0xeff2'] },
      ],
    });

    const app = createApp(makeSyncHandle());
    const res = await request(app).get('/snapshot');

    expect(res.status).toBe(200);

    // Dead mob MobStats excluded
    expect(res.body.tables.MobStats).toBeUndefined();

    // Character WorldStatusEffects preserved
    expect(res.body.tables.WorldStatusEffects[charKey]).toEqual({
      appliedStatusEffects: ['0xeff1'],
    });

    // Dead mob WorldStatusEffects excluded
    expect(res.body.tables.WorldStatusEffects[deadMobKey]).toBeUndefined();
  });

  it('excludes zeroed EncounterEntity rows', async () => {
    const ZERO_BYTES32 = '0x' + '0'.repeat(64);

    // Add EncounterEntity to the table map
    const handle = makeSyncHandle({
      tableNameMap: new Map([
        ['Position', 'ud__position'],
        ['Spawned', 'ud__spawned'],
        ['Characters', 'ud__characters'],
        ['EncounterEntity', 'ud__encounter_entity'],
        // Reverse
        ['ud__position', 'ud__position'],
        ['ud__spawned', 'ud__spawned'],
        ['ud__characters', 'ud__characters'],
        ['ud__encounter_entity', 'ud__encounter_entity'],
      ]),
    });

    const mockSql = vi.mocked(sql.unsafe);
    // Characters (key set)
    mockSql.mockResolvedValueOnce([] as any);
    // Position
    mockSql.mockResolvedValueOnce([] as any);
    // Spawned
    mockSql.mockResolvedValueOnce([] as any);
    // Characters (main loop)
    mockSql.mockResolvedValueOnce([] as any);
    // EncounterEntity
    mockSql.mockResolvedValueOnce([
      { __key_bytes: '0xactive', encounterId: '0xabc123' + '0'.repeat(52) },
      { __key_bytes: '0xended', encounterId: ZERO_BYTES32 },
    ] as any);

    const app = createApp(handle);
    const res = await request(app).get('/snapshot');

    expect(res.status).toBe(200);
    expect(res.body.tables.EncounterEntity['0xactive']).toBeDefined();
    expect(res.body.tables.EncounterEntity['0xended']).toBeUndefined();
  });

  it('excludes completed CombatEncounter rows', async () => {
    const handle = makeSyncHandle({
      tableNameMap: new Map([
        ['Position', 'ud__position'],
        ['Spawned', 'ud__spawned'],
        ['Characters', 'ud__characters'],
        ['CombatEncounter', 'ud__combat_encounter'],
        ['ud__position', 'ud__position'],
        ['ud__spawned', 'ud__spawned'],
        ['ud__characters', 'ud__characters'],
        ['ud__combat_encounter', 'ud__combat_encounter'],
      ]),
    });

    const mockSql = vi.mocked(sql.unsafe);
    mockSql.mockResolvedValueOnce([] as any); // Characters key set
    mockSql.mockResolvedValueOnce([] as any); // Position
    mockSql.mockResolvedValueOnce([] as any); // Spawned
    mockSql.mockResolvedValueOnce([] as any); // Characters main
    mockSql.mockResolvedValueOnce([
      { __key_bytes: '0xactive_enc', end: '0', start: '100' },
      { __key_bytes: '0xcompleted_enc', end: '200', start: '100' },
    ] as any); // CombatEncounter

    const app = createApp(handle);
    const res = await request(app).get('/snapshot');

    expect(res.status).toBe(200);
    expect(res.body.tables.CombatEncounter['0xactive_enc']).toBeDefined();
    expect(res.body.tables.CombatEncounter['0xcompleted_enc']).toBeUndefined();
  });

  it('excludes snapshot-excluded tables (ActionOutcome, CombatOutcome, etc.)', async () => {
    const handle = makeSyncHandle({
      tableNameMap: new Map([
        ['Position', 'ud__position'],
        ['Spawned', 'ud__spawned'],
        ['Characters', 'ud__characters'],
        ['ActionOutcome', 'ud__action_outcome'],
        ['CombatOutcome', 'ud__combat_outcome'],
        ['ud__position', 'ud__position'],
        ['ud__spawned', 'ud__spawned'],
        ['ud__characters', 'ud__characters'],
        ['ud__action_outcome', 'ud__action_outcome'],
        ['ud__combat_outcome', 'ud__combat_outcome'],
      ]),
    });

    const mockSql = vi.mocked(sql.unsafe);
    mockSql.mockResolvedValueOnce([] as any); // Characters key set
    mockSql.mockResolvedValueOnce([] as any); // Position
    mockSql.mockResolvedValueOnce([] as any); // Spawned
    mockSql.mockResolvedValueOnce([] as any); // Characters main

    // ActionOutcome and CombatOutcome should never be queried
    const app = createApp(handle);
    const res = await request(app).get('/snapshot');

    expect(res.status).toBe(200);
    // Only 4 sql calls: Characters key set, Position, Spawned, Characters main
    expect(mockSql).toHaveBeenCalledTimes(4);
  });

  it('filters Position (0,0) and Spawned false from their own tables', async () => {
    mockDbQueries({
      position: [
        { __key_bytes: '0xactive', x: 5, y: 3 },
        { __key_bytes: '0xdead', x: 0, y: 0 },
      ],
      spawned: [
        { __key_bytes: '0xactive', spawned: true },
        { __key_bytes: '0xdead', spawned: false },
      ],
    });

    const app = createApp(makeSyncHandle());
    const res = await request(app).get('/snapshot');

    expect(res.status).toBe(200);
    // Active entity included in Position and Spawned
    expect(res.body.tables.Position['0xactive']).toEqual({ x: 5, y: 3 });
    expect(res.body.tables.Spawned['0xactive']).toEqual({ spawned: true });
    // Dead entity excluded from Position and Spawned
    expect(res.body.tables.Position?.['0xdead']).toBeUndefined();
    expect(res.body.tables.Spawned?.['0xdead']).toBeUndefined();
  });

  it('preserves character Position at (0,0) — spawn point is valid', async () => {
    const charKey = '0xplayer_at_spawn';
    const deadMobKey = '0x00000001_dead_mob';

    mockDbQueries({
      position: [
        // Character at spawn point (0,0) — should be KEPT
        { __key_bytes: charKey, x: 0, y: 0 },
        // Dead mob at (0,0) — should be filtered
        { __key_bytes: deadMobKey, x: 0, y: 0 },
      ],
      spawned: [
        // Character is spawned
        { __key_bytes: charKey, spawned: true },
        // Dead mob not spawned
        { __key_bytes: deadMobKey, spawned: false },
      ],
      characters: [
        { __key_bytes: charKey, name: 'Hero', locked: true },
      ],
    });

    const app = createApp(makeSyncHandle());
    const res = await request(app).get('/snapshot');

    expect(res.status).toBe(200);

    // Character at (0,0) should have Position preserved
    expect(res.body.tables.Position[charKey]).toEqual({ x: 0, y: 0 });
    // Character should be in Spawned
    expect(res.body.tables.Spawned[charKey]).toEqual({ spawned: true });

    // Dead mob at (0,0) should be filtered from both
    expect(res.body.tables.Position?.[deadMobKey]).toBeUndefined();
    expect(res.body.tables.Spawned?.[deadMobKey]).toBeUndefined();
  });

  it('handles query errors gracefully', async () => {
    const mockSql = vi.mocked(sql.unsafe);
    // Characters key set errors
    mockSql.mockRejectedValueOnce(new Error('connection refused'));
    // Position errors
    mockSql.mockRejectedValueOnce(new Error('connection refused'));
    // Spawned errors
    mockSql.mockRejectedValueOnce(new Error('connection refused'));
    // Rest return empty
    mockSql.mockResolvedValue([] as any);

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const app = createApp(makeSyncHandle());
    const res = await request(app).get('/snapshot');

    expect(res.status).toBe(200);
    expect(res.body.block).toBe(100);

    consoleSpy.mockRestore();
  });

  it('serves cached snapshot on second request at same block', async () => {
    const mockSql = vi.mocked(sql.unsafe);

    // First request — builds snapshot
    mockDbQueries({
      position: [{ __key_bytes: '0xactive', x: 5, y: 3 }],
      spawned: [{ __key_bytes: '0xactive', spawned: true }],
    });
    const handle = makeSyncHandle();
    const app = createApp(handle);

    const res1 = await request(app).get('/snapshot');
    expect(res1.status).toBe(200);
    expect(res1.headers['x-snapshot-cache']).toBe('MISS');
    const callCountAfterFirst = mockSql.mock.calls.length;

    // Second request at same block — should serve from cache, no new DB queries
    const res2 = await request(app).get('/snapshot');
    expect(res2.status).toBe(200);
    expect(res2.headers['x-snapshot-cache']).toBe('HIT');
    expect(res2.body).toEqual(res1.body);
    expect(mockSql.mock.calls.length).toBe(callCountAfterFirst); // no new queries
  });

  it('rebuilds snapshot when block advances', async () => {
    const mockSql = vi.mocked(sql.unsafe);

    // First request at block 100
    mockDbQueries({});
    const handle = makeSyncHandle({ latestStoredBlockNumber: 100 });
    const app = createApp(handle);

    const res1 = await request(app).get('/snapshot');
    expect(res1.status).toBe(200);
    expect(res1.body.block).toBe(100);
    expect(res1.headers['x-snapshot-cache']).toBe('MISS');

    // Advance block
    (handle as any).latestStoredBlockNumber = 101;
    mockDbQueries({});

    const res2 = await request(app).get('/snapshot');
    expect(res2.status).toBe(200);
    expect(res2.body.block).toBe(101);
    expect(res2.headers['x-snapshot-cache']).toBe('MISS');
  });

  it('sets Cache-Control header for CDN caching', async () => {
    mockDbQueries({});
    const app = createApp(makeSyncHandle());
    const res = await request(app).get('/snapshot');

    expect(res.status).toBe(200);
    expect(res.headers['cache-control']).toBe('public, max-age=2');
  });
});
