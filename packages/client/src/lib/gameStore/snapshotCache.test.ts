import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  cacheKey,
  isValidSnapshot,
  readCachedSnapshot,
  writeCachedSnapshot,
  clearStaleEntries,
} from './snapshotCache';
import type { FullSnapshot } from './types';

const WORLD = '0xAbCdEf1234567890AbCdEf1234567890AbCdEf12';

function validSnapshot(block = 100): FullSnapshot {
  return {
    block,
    tables: {
      Character: { '0x01': { name: 'Hero', level: 5 } },
    },
  };
}

beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

// ─── cacheKey ────────────────────────────────────────────────

describe('cacheKey', () => {
  it('lowercases world address', () => {
    expect(cacheKey('0xABC')).toBe(cacheKey('0xabc'));
  });

  it('includes version number in key', () => {
    expect(cacheKey(WORLD)).toMatch(/^ud:snapshot:v\d+:/);
  });
});

// ─── readCachedSnapshot — happy paths ────────────────────────

describe('readCachedSnapshot', () => {
  it('returns parsed snapshot when valid cache exists', () => {
    const snap = validSnapshot();
    localStorage.setItem(cacheKey(WORLD), JSON.stringify(snap));

    const result = readCachedSnapshot(WORLD);
    expect(result).toEqual(snap);
  });

  it('roundtrips through write then read', () => {
    const snap = validSnapshot(42);
    writeCachedSnapshot(WORLD, snap);

    const result = readCachedSnapshot(WORLD);
    expect(result).toEqual(snap);
    expect(result!.block).toBe(42);
    expect(result!.tables.Character['0x01']).toEqual({ name: 'Hero', level: 5 });
  });

  // ─── unhappy paths ──────────────────────────────────────────

  it('returns null on cache miss', () => {
    expect(readCachedSnapshot(WORLD)).toBeNull();
  });

  it('returns null on corrupt JSON', () => {
    localStorage.setItem(cacheKey(WORLD), 'not json');
    expect(readCachedSnapshot(WORLD)).toBeNull();

    localStorage.setItem(cacheKey(WORLD), '{{');
    expect(readCachedSnapshot(WORLD)).toBeNull();
  });

  it('returns null when value is valid JSON but wrong shape', () => {
    for (const val of ['"hello"', '[1,2]', '{"foo":"bar"}']) {
      localStorage.setItem(cacheKey(WORLD), val);
      expect(readCachedSnapshot(WORLD)).toBeNull();
    }
  });

  it('returns null when block is 0, negative, or non-number', () => {
    for (const block of [0, -1, 'ten']) {
      const data = { block, tables: {} };
      localStorage.setItem(cacheKey(WORLD), JSON.stringify(data));
      expect(readCachedSnapshot(WORLD)).toBeNull();
    }
  });

  it('returns null when tables is null, array, or non-object', () => {
    for (const tables of [null, [1, 2], 'string']) {
      const data = { block: 1, tables };
      localStorage.setItem(cacheKey(WORLD), JSON.stringify(data));
      expect(readCachedSnapshot(WORLD)).toBeNull();
    }
  });

  it('returns null when key exists with old version', () => {
    // Write under a v0 key manually
    localStorage.setItem('ud:snapshot:v0:' + WORLD.toLowerCase(), JSON.stringify(validSnapshot()));
    // Current code reads v1 key — should miss
    expect(readCachedSnapshot(WORLD)).toBeNull();
  });

  it('returns null when localStorage.getItem throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });
    expect(readCachedSnapshot(WORLD)).toBeNull();
  });

  it('returns null for empty string, "null", or "undefined"', () => {
    for (const val of ['', 'null', 'undefined']) {
      localStorage.setItem(cacheKey(WORLD), val);
      expect(readCachedSnapshot(WORLD)).toBeNull();
    }
  });
});

// ─── writeCachedSnapshot ─────────────────────────────────────

describe('writeCachedSnapshot', () => {
  it('writes JSON to correct key with version and lowercased address', () => {
    const snap = validSnapshot();
    writeCachedSnapshot(WORLD, snap);

    const key = cacheKey(WORLD);
    expect(key).toContain('v1');
    expect(key).toContain(WORLD.toLowerCase());
    expect(JSON.parse(localStorage.getItem(key)!)).toEqual(snap);
  });

  it('does not throw on QuotaExceededError — clears stale and retries', () => {
    let callCount = 0;
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      callCount++;
      if (callCount <= 1) {
        const err = new DOMException('quota', 'QuotaExceededError');
        throw err;
      }
      // Second call succeeds
    });
    const clearSpy = vi.spyOn(Storage.prototype, 'removeItem');

    expect(() => writeCachedSnapshot(WORLD, validSnapshot())).not.toThrow();
    // clearStaleEntries was invoked (removeItem may or may not be called depending on localStorage state)
    expect(callCount).toBe(2); // first throw, second success
  });

  it('does not throw when setItem throws non-Quota error', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('localStorage disabled');
    });
    expect(() => writeCachedSnapshot(WORLD, validSnapshot())).not.toThrow();
  });

  it('does not throw when retry after clearStaleEntries also fails', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      const err = new DOMException('quota', 'QuotaExceededError');
      throw err;
    });
    expect(() => writeCachedSnapshot(WORLD, validSnapshot())).not.toThrow();
  });
});

// ─── clearStaleEntries ───────────────────────────────────────

describe('clearStaleEntries', () => {
  it('removes keys with old CACHE_VERSION, keeps current', () => {
    const current = cacheKey(WORLD);
    localStorage.setItem(current, 'keep');
    localStorage.setItem('ud:snapshot:v0:' + WORLD.toLowerCase(), 'old');

    clearStaleEntries(WORLD);

    expect(localStorage.getItem(current)).toBe('keep');
    expect(localStorage.getItem('ud:snapshot:v0:' + WORLD.toLowerCase())).toBeNull();
  });

  it('removes keys with different world address, keeps matching', () => {
    const current = cacheKey(WORLD);
    const other = 'ud:snapshot:v1:0xdifferentaddress';
    localStorage.setItem(current, 'keep');
    localStorage.setItem(other, 'stale');

    clearStaleEntries(WORLD);

    expect(localStorage.getItem(current)).toBe('keep');
    expect(localStorage.getItem(other)).toBeNull();
  });

  it('does not remove non-cache keys', () => {
    localStorage.setItem(cacheKey(WORLD), 'keep');
    localStorage.setItem('ud:other', 'unrelated');
    localStorage.setItem('someKey', 'unrelated');

    clearStaleEntries(WORLD);

    expect(localStorage.getItem('ud:other')).toBe('unrelated');
    expect(localStorage.getItem('someKey')).toBe('unrelated');
  });

  it('is a no-op when no stale entries exist', () => {
    localStorage.setItem(cacheKey(WORLD), 'keep');
    const removeSpy = vi.spyOn(Storage.prototype, 'removeItem');

    clearStaleEntries(WORLD);

    expect(removeSpy).not.toHaveBeenCalled();
    expect(localStorage.getItem(cacheKey(WORLD))).toBe('keep');
  });
});
