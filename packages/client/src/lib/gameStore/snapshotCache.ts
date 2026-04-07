import type { FullSnapshot, TableRow } from './types';

const CACHE_VERSION = 2; // Bumped to clear stale ghost encounter data (2026-04-07)
const CACHE_KEY_PREFIX = 'ud:snapshot';

// ─── Lightweight characters-only cache for fast-path ────────
// The full snapshot is 24MB+ and can't fit in localStorage.
// Cache just the Characters table (~50KB) so the fast-path can
// find the character and redirect before the full snapshot arrives.
const CHAR_CACHE_KEY = 'ud:characters:v1';

function charCacheKey(worldAddress: string): string {
  return `${CHAR_CACHE_KEY}:${worldAddress.toLowerCase()}`;
}

export function readCachedCharacters(worldAddress: string): Record<string, TableRow> | null {
  try {
    if (!worldAddress) return null;
    const raw = localStorage.getItem(charCacheKey(worldAddress));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return null;
    return parsed;
  } catch { return null; }
}

export function writeCachedCharacters(worldAddress: string, characters: Record<string, TableRow>): void {
  try {
    if (!worldAddress) return;
    localStorage.setItem(charCacheKey(worldAddress), JSON.stringify(characters));
  } catch { /* quota or unavailable — non-critical */ }
}

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
  const key = cacheKey(worldAddress);

  // Strip empty tables to reduce size (103 tables → only non-empty ones)
  const trimmedTables: typeof snapshot.tables = {};
  for (const [name, rows] of Object.entries(snapshot.tables)) {
    if (rows && Object.keys(rows).length > 0) {
      trimmedTables[name] = rows;
    }
  }
  const trimmed: FullSnapshot = { block: snapshot.block, tables: trimmedTables };
  const serialized = JSON.stringify(trimmed);

  try {
    // Remove existing entry first to free space for the replacement
    localStorage.removeItem(key);
    localStorage.setItem(key, serialized);
  } catch (err) {
    if (err instanceof DOMException && err.name === 'QuotaExceededError') {
      clearStaleEntries(worldAddress);
      try {
        localStorage.setItem(key, serialized);
      } catch {
        console.warn('[snapshotCache] Write failed — snapshot too large for localStorage (' +
          Math.round(serialized.length / 1024) + 'KB)');
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
