import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Hoisted mocks ──────────────────────────────────────────────────────

const { mockSql } = vi.hoisted(() => {
  const mockSql: any = vi.fn();
  mockSql.unsafe = vi.fn();
  return { mockSql };
});

vi.mock('./connection.js', () => ({
  sql: mockSql,
  mudSchema: '0xtest',
}));

import {
  initCheckpointTable,
  getCheckpoint,
  saveCheckpoint,
  bootstrapCheckpoint,
} from './checkpoint.js';

// ── Helpers ────────────────────────────────────────────────────────────

/**
 * mockSql is called as a tagged template literal: sql`...`
 * The first arg is the template strings array. We match on the joined string.
 */
function sqlCalledWith(fragment: string): boolean {
  return mockSql.mock.calls.some(
    (call: any[]) => {
      const tpl = call[0];
      const joined = Array.isArray(tpl) ? tpl.join('?') : String(tpl);
      return joined.includes(fragment);
    },
  );
}

// ── Tests ──────────────────────────────────────────────────────────────

describe('checkpoint', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    // Default: return empty array for any sql call
    mockSql.mockResolvedValue([]);
  });

  describe('initCheckpointTable', () => {
    it('creates the queue schema and checkpoint table', async () => {
      await initCheckpointTable();

      expect(sqlCalledWith('CREATE SCHEMA IF NOT EXISTS queue')).toBe(true);
      expect(sqlCalledWith('sync_checkpoint')).toBe(true);
    });
  });

  describe('getCheckpoint', () => {
    it('returns null when no checkpoint exists', async () => {
      mockSql.mockResolvedValueOnce([]);

      const result = await getCheckpoint();

      expect(result).toBeNull();
    });

    it('returns the stored block number as bigint', async () => {
      mockSql.mockResolvedValueOnce([{ block_number: '12345678' }]);

      const result = await getCheckpoint();

      expect(result).toBe(12345678n);
    });
  });

  describe('saveCheckpoint', () => {
    it('upserts the checkpoint with the given block number', async () => {
      mockSql.mockResolvedValueOnce([]);

      await saveCheckpoint(99999n);

      expect(mockSql).toHaveBeenCalled();
      expect(sqlCalledWith('sync_checkpoint')).toBe(true);
    });
  });

  describe('bootstrapCheckpoint', () => {
    it('returns existing checkpoint without querying MUD tables', async () => {
      // getCheckpoint returns a value
      mockSql.mockResolvedValueOnce([{ block_number: '500000' }]);

      const result = await bootstrapCheckpoint('0xtest');

      expect(result).toBe(500000n);
      // Should NOT call sql.unsafe (no MUD table query needed)
      expect(mockSql.unsafe).not.toHaveBeenCalled();
    });

    it('returns null when no checkpoint and no MUD table exists', async () => {
      // getCheckpoint: no rows
      mockSql.mockResolvedValueOnce([]);
      // information_schema check: table doesn't exist
      mockSql.mockResolvedValueOnce([]);

      const result = await bootstrapCheckpoint('0xtest');

      expect(result).toBeNull();
    });

    it('seeds from ud__characters max block when table exists but no checkpoint', async () => {
      // getCheckpoint: no rows
      mockSql.mockResolvedValueOnce([]);
      // information_schema check: table exists
      mockSql.mockResolvedValueOnce([{ '?column?': 1 }]);
      // MAX query
      mockSql.unsafe.mockResolvedValueOnce([{ max_block: '450000' }]);
      // saveCheckpoint upsert
      mockSql.mockResolvedValueOnce([]);

      const result = await bootstrapCheckpoint('0xtest');

      expect(result).toBe(450000n);
      expect(mockSql.unsafe).toHaveBeenCalledWith(
        expect.stringContaining('MAX'),
      );
    });

    it('returns null when ud__characters exists but has no rows', async () => {
      // getCheckpoint: no rows
      mockSql.mockResolvedValueOnce([]);
      // information_schema check: table exists
      mockSql.mockResolvedValueOnce([{ '?column?': 1 }]);
      // MAX query returns null (empty table)
      mockSql.unsafe.mockResolvedValueOnce([{ max_block: null }]);

      const result = await bootstrapCheckpoint('0xtest');

      expect(result).toBeNull();
    });
  });
});
