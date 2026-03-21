import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { createLeaderboardRouter } from './leaderboard.js';
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
  serializeValue: (v: unknown) => {
    if (Buffer.isBuffer(v) || v instanceof Uint8Array) {
      return '0x' + Buffer.from(v as any).toString('hex');
    }
    return v;
  },
}));

import { sql } from '../db/connection.js';

const mockSql = sql.unsafe as ReturnType<typeof vi.fn>;

function createApp(syncHandle: SyncHandle) {
  const app = express();
  app.use('/leaderboard', createLeaderboardRouter(syncHandle));
  return app;
}

function makeSyncHandle(overrides?: Partial<SyncHandle>): SyncHandle {
  return {
    stopSync: vi.fn(),
    latestBlockNumber: 100,
    latestStoredBlockNumber: 100,
    tables: new Map(),
    tableNameMap: new Map([
      ['Characters', 'ud__characters'],
      ['Stats', 'ud__stats'],
      ['GoldBalances', 'gold__balances'],
    ]),
    ...overrides,
  };
}

function makeRow(
  charId: string,
  name: string,
  level: number,
  stats: { agi: number; str: number; int: number },
  gold: number,
  ranks: { statsRank: number; goldRank: number },
  totalPlayers: number,
) {
  // name stored as Buffer (MUD stores strings as bytes)
  const nameBuffer = Buffer.from(name, 'utf8');
  return {
    character_id: Buffer.from(charId.replace('0x', ''), 'hex'),
    name: nameBuffer,
    owner: Buffer.from('aa'.repeat(20), 'hex'),
    level,
    agility: stats.agi,
    strength: stats.str,
    intelligence: stats.int,
    total_stats: stats.agi + stats.str + stats.int,
    total_gold: gold,
    stats_rank: ranks.statsRank,
    gold_rank: ranks.goldRank,
    total_players: totalPlayers,
  };
}

describe('GET /leaderboard/nearby', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns nearby players for middle rank character with decoded names', async () => {
    const charId = '0x' + 'aa'.repeat(32);
    const syncHandle = makeSyncHandle();
    const app = createApp(syncHandle);

    const rows = [
      makeRow('0x' + 'bb'.repeat(32), 'Player1', 8, { agi: 20, str: 20, int: 20 }, 150, { statsRank: 1, goldRank: 1 }, 5),
      makeRow('0x' + 'cc'.repeat(32), 'Player2', 7, { agi: 15, str: 15, int: 15 }, 110, { statsRank: 2, goldRank: 2 }, 5),
      makeRow(charId, 'Self', 6, { agi: 10, str: 10, int: 10 }, 70, { statsRank: 3, goldRank: 3 }, 5),
      makeRow('0x' + 'dd'.repeat(32), 'Player4', 5, { agi: 8, str: 8, int: 8 }, 40, { statsRank: 4, goldRank: 4 }, 5),
      makeRow('0x' + 'ee'.repeat(32), 'Player5', 4, { agi: 5, str: 5, int: 5 }, 15, { statsRank: 5, goldRank: 5 }, 5),
    ];

    mockSql.mockResolvedValueOnce(rows);

    const res = await request(app)
      .get(`/leaderboard/nearby?characterId=${charId}&rankBy=stats`)
      .expect(200);

    expect(res.body.nearby).toHaveLength(5);
    expect(res.body.totalPlayers).toBe(5);
    expect(res.body.selfStatsRank).toBe(3);
    expect(res.body.selfGoldRank).toBe(3);

    const selfEntry = res.body.nearby.find((p: any) => p.isSelf);
    expect(selfEntry).toBeDefined();
    expect(selfEntry.name).toBe('Self');
    expect(selfEntry.isSelf).toBe(true);

    // Verify names are decoded strings, not Buffer objects
    const otherEntry = res.body.nearby.find((p: any) => p.name === 'Player1');
    expect(otherEntry).toBeDefined();
    expect(typeof otherEntry.name).toBe('string');
    expect(otherEntry.isSelf).toBe(false);
  });

  it('returns nearby players for top rank character', async () => {
    const charId = '0x' + 'aa'.repeat(32);
    const syncHandle = makeSyncHandle();
    const app = createApp(syncHandle);

    const rows = [
      makeRow(charId, 'TopPlayer', 10, { agi: 30, str: 30, int: 30 }, 300, { statsRank: 1, goldRank: 1 }, 10),
      makeRow('0x' + 'bb'.repeat(32), 'Player2', 8, { agi: 20, str: 20, int: 20 }, 150, { statsRank: 2, goldRank: 2 }, 10),
      makeRow('0x' + 'cc'.repeat(32), 'Player3', 7, { agi: 15, str: 15, int: 15 }, 110, { statsRank: 3, goldRank: 3 }, 10),
    ];

    mockSql.mockResolvedValueOnce(rows);

    const res = await request(app)
      .get(`/leaderboard/nearby?characterId=${charId}&rankBy=stats`)
      .expect(200);

    expect(res.body.selfStatsRank).toBe(1);
    expect(res.body.nearby[0].isSelf).toBe(true);
    expect(res.body.nearby[0].name).toBe('TopPlayer');
  });

  it('returns nearby players for bottom rank character', async () => {
    const charId = '0x' + 'aa'.repeat(32);
    const syncHandle = makeSyncHandle();
    const app = createApp(syncHandle);

    const rows = [
      makeRow('0x' + 'bb'.repeat(32), 'Player8', 3, { agi: 5, str: 5, int: 5 }, 30, { statsRank: 8, goldRank: 8 }, 10),
      makeRow('0x' + 'cc'.repeat(32), 'Player9', 2, { agi: 3, str: 3, int: 3 }, 15, { statsRank: 9, goldRank: 9 }, 10),
      makeRow(charId, 'BottomPlayer', 1, { agi: 1, str: 1, int: 1 }, 1, { statsRank: 10, goldRank: 10 }, 10),
    ];

    mockSql.mockResolvedValueOnce(rows);

    const res = await request(app)
      .get(`/leaderboard/nearby?characterId=${charId}&rankBy=stats`)
      .expect(200);

    expect(res.body.selfStatsRank).toBe(10);
    const self = res.body.nearby.find((p: any) => p.isSelf);
    expect(self.statsRank).toBe(10);
  });

  it('returns 404 when character not found', async () => {
    const syncHandle = makeSyncHandle();
    const app = createApp(syncHandle);

    mockSql.mockResolvedValueOnce([]);

    const res = await request(app)
      .get(`/leaderboard/nearby?characterId=0x${'ff'.repeat(32)}&rankBy=stats`)
      .expect(404);

    expect(res.body.error).toContain('not found');
  });

  it('returns 503 when tables not yet synced', async () => {
    const syncHandle = makeSyncHandle({
      tableNameMap: new Map(),
    });
    const app = createApp(syncHandle);

    const res = await request(app)
      .get(`/leaderboard/nearby?characterId=0x${'aa'.repeat(32)}&rankBy=stats`)
      .expect(503);

    expect(res.body.error).toContain('not yet synced');
  });

  it('returns 400 when characterId is missing', async () => {
    const syncHandle = makeSyncHandle();
    const app = createApp(syncHandle);

    const res = await request(app)
      .get('/leaderboard/nearby?rankBy=stats')
      .expect(400);

    expect(res.body.error).toContain('characterId');
  });

  it('returns 400 for invalid rankBy value', async () => {
    const syncHandle = makeSyncHandle();
    const app = createApp(syncHandle);

    const res = await request(app)
      .get(`/leaderboard/nearby?characterId=0x${'aa'.repeat(32)}&rankBy=invalid`)
      .expect(400);

    expect(res.body.error).toContain('rankBy');
  });

  it('works with gold ranking', async () => {
    const charId = '0x' + 'aa'.repeat(32);
    const syncHandle = makeSyncHandle();
    const app = createApp(syncHandle);

    const rows = [
      makeRow(charId, 'Self', 5, { agi: 5, str: 5, int: 5 }, 150, { statsRank: 5, goldRank: 2 }, 10),
      makeRow('0x' + 'bb'.repeat(32), 'RichPlayer', 3, { agi: 3, str: 3, int: 3 }, 300, { statsRank: 8, goldRank: 1 }, 10),
      makeRow('0x' + 'cc'.repeat(32), 'Player3', 4, { agi: 4, str: 4, int: 4 }, 80, { statsRank: 6, goldRank: 3 }, 10),
    ];

    mockSql.mockResolvedValueOnce(rows);

    const res = await request(app)
      .get(`/leaderboard/nearby?characterId=${charId}&rankBy=gold`)
      .expect(200);

    expect(res.body.selfGoldRank).toBe(2);
    expect(res.body.nearby).toHaveLength(3);
  });

  it('handles missing GoldBalances table gracefully', async () => {
    const charId = '0x' + 'aa'.repeat(32);
    const syncHandle = makeSyncHandle({
      tableNameMap: new Map([
        ['Characters', 'ud__characters'],
        ['Stats', 'ud__stats'],
      ]),
    });
    const app = createApp(syncHandle);

    const rows = [
      makeRow(charId, 'Self', 5, { agi: 10, str: 10, int: 10 }, 0, { statsRank: 1, goldRank: 1 }, 1),
    ];

    mockSql.mockResolvedValueOnce(rows);

    const res = await request(app)
      .get(`/leaderboard/nearby?characterId=${charId}&rankBy=stats`)
      .expect(200);

    expect(res.body.nearby).toHaveLength(1);
    expect(res.body.selfStatsRank).toBe(1);
  });
});
