import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getCachedDelegator, setCachedDelegator, clearCachedDelegator } from './delegatorCache';

describe('delegatorCache', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  const WORLD = '0xAbC123';
  const DELEGATOR = '0x1234567890abcdef1234567890abcdef12345678';

  describe('setCachedDelegator', () => {
    it('stores delegator address keyed by lowercased world address', () => {
      setCachedDelegator(WORLD, DELEGATOR);
      expect(localStorage.getItem('ud:delegator:0xabc123')).toBe(DELEGATOR);
    });

    it('overwrites previous value for same world', () => {
      const newDelegator = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
      setCachedDelegator(WORLD, DELEGATOR);
      setCachedDelegator(WORLD, newDelegator);
      expect(localStorage.getItem('ud:delegator:0xabc123')).toBe(newDelegator);
    });

    it('no-ops when worldAddress is empty', () => {
      setCachedDelegator('', DELEGATOR);
      expect(localStorage.length).toBe(0);
    });

    it('does not throw when localStorage is unavailable', () => {
      const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('QuotaExceededError');
      });
      expect(() => setCachedDelegator(WORLD, DELEGATOR)).not.toThrow();
      spy.mockRestore();
    });
  });

  describe('getCachedDelegator', () => {
    it('returns stored delegator address', () => {
      setCachedDelegator(WORLD, DELEGATOR);
      expect(getCachedDelegator(WORLD)).toBe(DELEGATOR);
    });

    it('returns null when no cache exists', () => {
      expect(getCachedDelegator(WORLD)).toBeNull();
    });

    it('returns null when worldAddress is empty', () => {
      expect(getCachedDelegator('')).toBeNull();
    });

    it('normalizes world address case on read', () => {
      setCachedDelegator('0xABC', DELEGATOR);
      expect(getCachedDelegator('0xabc')).toBe(DELEGATOR);
      expect(getCachedDelegator('0xABC')).toBe(DELEGATOR);
    });

    it('does not throw when localStorage is unavailable', () => {
      const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new Error('SecurityError');
      });
      expect(getCachedDelegator(WORLD)).toBeNull();
      spy.mockRestore();
    });
  });

  describe('clearCachedDelegator', () => {
    it('removes the cached delegator', () => {
      setCachedDelegator(WORLD, DELEGATOR);
      clearCachedDelegator(WORLD);
      expect(getCachedDelegator(WORLD)).toBeNull();
    });

    it('no-ops when worldAddress is empty', () => {
      setCachedDelegator(WORLD, DELEGATOR);
      clearCachedDelegator('');
      expect(getCachedDelegator(WORLD)).toBe(DELEGATOR);
    });

    it('no-ops when key does not exist', () => {
      expect(() => clearCachedDelegator(WORLD)).not.toThrow();
    });

    it('does not throw when localStorage is unavailable', () => {
      const spy = vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
        throw new Error('SecurityError');
      });
      expect(() => clearCachedDelegator(WORLD)).not.toThrow();
      spy.mockRestore();
    });
  });

  describe('edge cases', () => {
    it('different world addresses have independent caches', () => {
      const world2 = '0xDEF456';
      const delegator2 = '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
      setCachedDelegator(WORLD, DELEGATOR);
      setCachedDelegator(world2, delegator2);

      expect(getCachedDelegator(WORLD)).toBe(DELEGATOR);
      expect(getCachedDelegator(world2)).toBe(delegator2);

      clearCachedDelegator(WORLD);
      expect(getCachedDelegator(WORLD)).toBeNull();
      expect(getCachedDelegator(world2)).toBe(delegator2);
    });

    it('wallet switch overwrites cached address for next refresh', () => {
      setCachedDelegator(WORLD, DELEGATOR);
      const newWallet = '0xcccccccccccccccccccccccccccccccccccccccc';
      setCachedDelegator(WORLD, newWallet);
      expect(getCachedDelegator(WORLD)).toBe(newWallet);
    });
  });
});
