import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { createDeltaRouter } from './delta.js';
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
  app.use('/delta', createDeltaRouter(syncHandle));
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
      ['GoldBalances', 'gold__balances'],
      // Reverse mappings (should be skipped)
      ['ud__characters', 'ud__characters'],
      ['gold__balances', 'gold__balances'],
    ]),
    ...overrides,
  };
}

describe('GET /delta', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 400 when block param is missing', async () => {
    const app = createApp(makeSyncHandle());
    const res = await request(app).get('/delta');
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Missing required query parameter/);
  });

  it('returns 400 for invalid block number', async () => {
    const app = createApp(makeSyncHandle());
    const res = await request(app).get('/delta?block=abc');
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Invalid block number/);
  });

  it('returns 400 for negative block number', async () => {
    const app = createApp(makeSyncHandle());
    const res = await request(app).get('/delta?block=-1');
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Invalid block number/);
  });

  it('returns delta for rows updated since given block', async () => {
    const mockSql = vi.mocked(sql.unsafe);
    // Characters table has updated rows
    mockSql.mockResolvedValueOnce([
      { __key_bytes: '0xabc', __last_updated_block_number: 99, name: 'Hero', level: 5 },
    ] as any);
    // GoldBalances table has updated rows
    mockSql.mockResolvedValueOnce([
      { __key_bytes: '0xdef', __last_updated_block_number: 100, value: '1000' },
    ] as any);

    const app = createApp(makeSyncHandle());
    const res = await request(app).get('/delta?block=99');

    expect(res.status).toBe(200);
    expect(res.body.block).toBe(100);
    expect(res.body.tables.Characters).toEqual({
      '0xabc': { name: 'Hero', level: 5 },
    });
    expect(res.body.tables.GoldBalances).toEqual({
      '0xdef': { value: '1000' },
    });
  });

  it('returns empty tables object when no rows updated', async () => {
    const mockSql = vi.mocked(sql.unsafe);
    // Both tables return no rows
    mockSql.mockResolvedValueOnce([] as any);
    mockSql.mockResolvedValueOnce([] as any);

    const app = createApp(makeSyncHandle());
    const res = await request(app).get('/delta?block=101');

    expect(res.status).toBe(200);
    expect(res.body.block).toBe(100);
    expect(res.body.tables).toEqual({});
  });

  it('skips tables that error and returns the rest', async () => {
    const mockSql = vi.mocked(sql.unsafe);
    // Characters table errors
    mockSql.mockRejectedValueOnce(new Error('relation does not exist'));
    // GoldBalances table returns rows
    mockSql.mockResolvedValueOnce([
      { __key_bytes: '0xdef', __last_updated_block_number: 100, value: '500' },
    ] as any);

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const app = createApp(makeSyncHandle());
    const res = await request(app).get('/delta?block=99');

    expect(res.status).toBe(200);
    expect(res.body.tables.Characters).toBeUndefined();
    expect(res.body.tables.GoldBalances).toEqual({
      '0xdef': { value: '500' },
    });

    consoleSpy.mockRestore();
  });

  it('skips reverse mappings (pg name → pg name)', async () => {
    const mockSql = vi.mocked(sql.unsafe);
    // Only 2 calls (Characters + GoldBalances), not 4 (skips reverse mappings)
    mockSql.mockResolvedValue([] as any);

    const app = createApp(makeSyncHandle());
    await request(app).get('/delta?block=99');

    expect(mockSql).toHaveBeenCalledTimes(2);
  });

  it('uses latestStoredBlockNumber (not latestBlockNumber) in response', async () => {
    const mockSql = vi.mocked(sql.unsafe);
    mockSql.mockResolvedValue([] as any);

    // Simulate the race: chain is at block 200 but Postgres only has up to 150
    const app = createApp(makeSyncHandle({
      latestBlockNumber: 200,
      latestStoredBlockNumber: 150,
    }));
    const res = await request(app).get('/delta?block=100');

    expect(res.status).toBe(200);
    // Must return the stored block number so the client knows whether to retry
    expect(res.body.block).toBe(150);
  });

  it('passes sinceBlock parameter to SQL query', async () => {
    const mockSql = vi.mocked(sql.unsafe);
    mockSql.mockResolvedValue([] as any);

    const app = createApp(makeSyncHandle());
    await request(app).get('/delta?block=42');

    for (const call of mockSql.mock.calls) {
      expect(call[0]).toContain('__last_updated_block_number');
      expect(call[1]).toEqual([42]);
    }
  });
});
