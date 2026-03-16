import type { FullSnapshot } from './types';

const CACHE_VERSION = 1;
const CACHE_KEY_PREFIX = 'ud:snapshot';

export function cacheKey(worldAddress: string): string {
  return `${CACHE_KEY_PREFIX}:v${CACHE_VERSION}:${worldAddress.toLowerCase()}`;
}

export function isValidSnapshot(data: unknown): data is FullSnapshot {
  if (typeof data !== 'object' || data === null || Array.isArray(data)) return false;
  const obj = data as Record<string, unknown>;
  if (typeof obj.block !== 'number' || obj.block <= 0) return false;
  if (typeof obj.tables !== 'object' || obj.tables === null || Array.isArray(obj.tables)) return false;
  return true;
}

export function readCachedSnapshot(worldAddress: string): FullSnapshot | null {
  try {
    const raw = localStorage.getItem(cacheKey(worldAddress));
    if (raw == null) return null;
    const parsed: unknown = JSON.parse(raw);
    if (isValidSnapshot(parsed)) return parsed;
    return null;
  } catch {
    return null;
  }
}

export function writeCachedSnapshot(worldAddress: string, snapshot: FullSnapshot): void {
  try {
    localStorage.setItem(cacheKey(worldAddress), JSON.stringify(snapshot));
  } catch (err) {
    if (err instanceof DOMException && err.name === 'QuotaExceededError') {
      clearStaleEntries(worldAddress);
      try {
        localStorage.setItem(cacheKey(worldAddress), JSON.stringify(snapshot));
      } catch {
        console.warn('[snapshotCache] Write failed after clearing stale entries');
      }
    } else {
      console.warn('[snapshotCache] Write failed:', err);
    }
  }
}

export function clearStaleEntries(currentWorldAddress: string): void {
  const currentKey = cacheKey(currentWorldAddress);
  for (let i = localStorage.length - 1; i >= 0; i--) {
    const key = localStorage.key(i);
    if (key && key.startsWith(CACHE_KEY_PREFIX) && key !== currentKey) {
      localStorage.removeItem(key);
    }
  }
}
