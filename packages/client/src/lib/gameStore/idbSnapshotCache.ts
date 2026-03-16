/**
 * IndexedDB cache for the full game snapshot (~24MB).
 * localStorage can't hold this (5MB limit), but IDB supports 50MB+.
 * Reads complete in ~10-50ms from local disk — fast enough for seamless refresh.
 */
import type { FullSnapshot } from './types';
import { isValidSnapshot } from './snapshotCache';

const DB_NAME = 'ud-game-cache';
const STORE_NAME = 'snapshots';
const DB_VERSION = 1;

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE_NAME);
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
        resolve(isValidSnapshot(result) ? result : null);
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
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.put(snapshot, worldAddress.toLowerCase());
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
