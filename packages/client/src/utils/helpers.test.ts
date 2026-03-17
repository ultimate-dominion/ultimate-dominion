/* eslint-disable no-console */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchMetadataFromUri, METADATA_FETCH_TIMEOUT_MS } from './helpers';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
  };
})();
Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock });

// Mock import.meta.env
vi.stubGlobal('import', { meta: { env: { DEV: false } } });

describe('fetchMetadataFromUri', () => {
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    localStorageMock.clear();
    fetchSpy = vi.fn();
    globalThis.fetch = fetchSpy;
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('returns empty metadata for empty URI', async () => {
    const result = await fetchMetadataFromUri('');
    expect(result).toEqual({ name: '', description: '', image: '' });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('returns metadata for text-only URIs without fetching', async () => {
    const result = await fetchMetadataFromUri('armor:tattered_cloth');
    expect(result.name).toBe('Tattered Cloth');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('returns valid metadata on successful fetch', async () => {
    const metadata = { name: 'Iron Sword', description: 'A sturdy blade', image: 'ipfs://QmTest' };
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(metadata),
    });

    const promise = fetchMetadataFromUri('https://example.com/metadata.json');
    // No timers to advance — fetch resolves immediately
    const result = await promise;

    expect(result.name).toBe('Iron Sword');
    expect(result.description).toBe('A sturdy blade');
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    // Verify signal was passed
    expect(fetchSpy.mock.calls[0][1]).toHaveProperty('signal');
  });

  it('aborts fetch after timeout and tries next gateway', async () => {
    // Create a fetch that never resolves (simulates hang)
    // When abort is called, the fetch should reject with AbortError
    fetchSpy.mockImplementation((_url: string, options?: RequestInit) => {
      return new Promise((_resolve, reject) => {
        if (options?.signal) {
          options.signal.addEventListener('abort', () => {
            reject(new DOMException('The operation was aborted.', 'AbortError'));
          });
        }
      });
    });

    const promise = fetchMetadataFromUri('ipfs://QmTestHash123');

    // Advance past the timeout for each gateway (3 max attempts × 5s each)
    for (let i = 0; i < 3; i++) {
      await vi.advanceTimersByTimeAsync(METADATA_FETCH_TIMEOUT_MS + 100);
    }

    const result = await promise;

    // All gateways failed — should return default empty metadata
    expect(result).toEqual({ name: '', description: '', image: '' });
    // Should have tried max 3 IPFS gateways (capped from 6)
    expect(fetchSpy).toHaveBeenCalledTimes(3);
  });

  it('falls back to next gateway when first times out, second succeeds', async () => {
    const metadata = { name: 'Shield', description: 'Blocks attacks', image: '' };
    let callCount = 0;

    fetchSpy.mockImplementation((_url: string, options?: RequestInit) => {
      callCount++;
      if (callCount === 1) {
        // First gateway hangs
        return new Promise((_resolve, reject) => {
          if (options?.signal) {
            options.signal.addEventListener('abort', () => {
              reject(new DOMException('The operation was aborted.', 'AbortError'));
            });
          }
        });
      }
      // Second gateway succeeds
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(metadata),
      });
    });

    const promise = fetchMetadataFromUri('ipfs://QmFallbackTest');

    // Advance past timeout for first gateway
    await vi.advanceTimersByTimeAsync(METADATA_FETCH_TIMEOUT_MS + 100);

    const result = await promise;
    expect(result.name).toBe('Shield');
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it('returns default metadata when all gateways fail (non-timeout)', async () => {
    fetchSpy.mockRejectedValue(new Error('Network error'));

    const result = await fetchMetadataFromUri('ipfs://QmAllFail');

    expect(result).toEqual({ name: '', description: '', image: '' });
    expect(fetchSpy).toHaveBeenCalledTimes(3);
  });

  it('returns default metadata when all gateways return non-ok', async () => {
    fetchSpy.mockResolvedValue({ ok: false, status: 500 });

    const result = await fetchMetadataFromUri('ipfs://QmServerError');

    expect(result).toEqual({ name: '', description: '', image: '' });
    expect(fetchSpy).toHaveBeenCalledTimes(3);
  });

  it('uses cache for repeated calls', async () => {
    const metadata = { name: 'Cached Item', description: 'From cache', image: '' };
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(metadata),
    });

    const uri = 'https://example.com/cached.json';
    const first = await fetchMetadataFromUri(uri);
    const second = await fetchMetadataFromUri(uri);

    expect(first.name).toBe('Cached Item');
    expect(second.name).toBe('Cached Item');
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });
});
