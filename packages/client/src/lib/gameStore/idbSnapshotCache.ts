/**
 * IndexedDB cache for the full game snapshot (~24MB).
 * localStorage can't hold this (5MB limit), but IDB supports 50MB+.
 * Reads complete in ~10-50ms from local disk — fast enough for seamless refresh.
 */
import type { FullSnapshot } from './types';
import { isValidSnapshot } from './snapshotCache';

const DB_NAME = 'ud-game-cache';
const STORE_NAME = 'snapshots';
const DB_VERSION = 2; // Bumped to clear stale ghost encounter data (2026-04-07)

/** Max age for cached snapshots — stale IDB data causes ghost battle spinners */
const MAX_CACHE_AGE_MS = 2 * 60 * 60 * 1000; // 2 hours

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      // Clear old stores on version bump to discard stale data
      if (db.objectStoreNames.contains(STORE_NAME)) {
        db.deleteObjectStore(STORE_NAME);
      }
      db.createObjectStore(STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function readSnapshotFromIDB(worldAddress: string): Promise<FullSnapshot | null> {
  try {
    if (!worldAddress) return null;
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.get(worldAddress.toLowerCase());
      request.onsuccess = () => {
        const result = request.result;
        if (!result || !isValidSnapshot(result)) { resolve(null); return; }
        // Skip stale caches — ghost battle data can persist indefinitely
        const cachedAt = (result as Record<string, unknown>).__cachedAt;
        if (typeof cachedAt === 'number' && Date.now() - cachedAt > MAX_CACHE_AGE_MS) {
          console.log('[idb] Skipping stale snapshot cache (age:', Math.round((Date.now() - cachedAt) / 60000), 'min)');
          resolve(null);
          return;
        }
        resolve(result);
      };
      request.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

export async function writeSnapshotToIDB(worldAddress: string, snapshot: FullSnapshot): Promise<void> {
  try {
    if (!worldAddress) return;
    const db = await openDB();
    // Attach timestamp for TTL checks on read
    const withTimestamp = { ...snapshot, __cachedAt: Date.now() };
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.put(withTimestamp, worldAddress.toLowerCase());
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {
    // non-critical
  }
}

export async function clearSnapshotFromIDB(worldAddress: string): Promise<void> {
  try {
    if (!worldAddress) return;
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.delete(worldAddress.toLowerCase());
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {
    // non-critical
  }
}
