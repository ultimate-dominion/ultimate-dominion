/**
 * IndexedDB cache for RECS component state.
 *
 * Saves all component entities+values so page refreshes can restore state
 * instantly and only sync the delta (blocks since last cache) from the chain.
 */

import {
  getComponentEntities,
  getComponentValue,
  setComponent,
  type Component,
  type Entity,
  type World,
} from '@latticexyz/recs';

const DB_NAME = 'mud-recs-cache';
const STORE_NAME = 'snapshots';
const DB_VERSION = 1;

export interface CachedComponent {
  /** tableId / component.id */
  id: string;
  /** entity → serialized component value */
  entities: Record<string, Record<string, unknown>>;
}

export interface RecsSnapshot {
  blockNumber: bigint;
  components: CachedComponent[];
}

// ---------------------------------------------------------------------------
// IndexedDB helpers
// ---------------------------------------------------------------------------

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// v4: switched to Alchemy RPC + added component ID diagnostics.
function cacheKey(worldAddress: string, chainId: number): string {
  return `v4-${worldAddress.toLowerCase()}-${chainId}`;
}

/**
 * Serialize a component value for IndexedDB storage.
 * Converts BigInt values to tagged strings so they can be restored.
 */
function serializeValue(
  value: Record<string, unknown>,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value)) {
    if (typeof v === 'bigint') {
      result[k] = `__bigint:${v.toString()}`;
    } else {
      result[k] = v;
    }
  }
  return result;
}

/**
 * Deserialize a stored value, restoring BigInt fields.
 */
function deserializeValue(
  value: Record<string, unknown>,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value)) {
    if (typeof v === 'string' && v.startsWith('__bigint:')) {
      result[k] = BigInt(v.slice('__bigint:'.length));
    } else {
      result[k] = v;
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Load a cached RECS snapshot from IndexedDB.
 * Returns null if no cache exists or on any error.
 */
export async function loadRecsCache(
  worldAddress: string,
  chainId: number,
): Promise<RecsSnapshot | null> {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.get(cacheKey(worldAddress, chainId));

      request.onsuccess = () => {
        const raw = request.result;
        if (!raw || !raw.blockNumber || !raw.components) {
          resolve(null);
          return;
        }
        resolve({
          blockNumber: BigInt(raw.blockNumber),
          components: raw.components,
        });
      };

      request.onerror = () => resolve(null);
    });
  } catch {
    // IndexedDB unavailable (e.g. private browsing)
    return null;
  }
}

/**
 * Save all RECS component state to IndexedDB.
 * Best-effort — failures are logged but never thrown.
 */
export async function saveRecsCache(
  world: World,
  blockNumber: bigint,
  worldAddress: string,
  chainId: number,
): Promise<void> {
  try {
    const cachedComponents: CachedComponent[] = [];

    for (const component of world.components) {
      const comp = component as Component;
      const entities: Record<string, Record<string, unknown>> = {};

      for (const entity of getComponentEntities(comp)) {
        const value = getComponentValue(comp, entity);
        if (value) {
          entities[entity as string] = serializeValue(
            value as Record<string, unknown>,
          );
        }
      }

      // Only cache components that have at least one entity
      if (Object.keys(entities).length > 0) {
        cachedComponents.push({ id: comp.id, entities });
      }
    }

    const payload = {
      blockNumber: blockNumber.toString(),
      components: cachedComponents,
      savedAt: Date.now(),
    };

    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.put(payload, cacheKey(worldAddress, chainId));

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (e) {
    console.warn('[CACHE] Failed to save RECS cache:', e);
  }
}

/**
 * Restore cached component values into the live RECS world.
 * Skips entities/components that fail to restore (schema changes, etc).
 * Returns the number of entities restored.
 */
export function restoreRecsCache(
  world: World,
  cache: RecsSnapshot,
): number {
  let restored = 0;

  for (const cached of cache.components) {
    // Find the live component by its id (tableId)
    const component = world.components.find(
      (c: any) => c.id === cached.id,
    ) as Component | undefined;

    if (!component) continue;

    for (const [entityStr, rawValue] of Object.entries(cached.entities)) {
      try {
        const value = deserializeValue(rawValue);
        setComponent(component, entityStr as Entity, value);
        restored++;
      } catch {
        // Schema mismatch or other issue — skip this entity
      }
    }
  }

  return restored;
}

/**
 * Remove the cached snapshot for a given world/chain.
 */
export async function clearRecsCache(
  worldAddress: string,
  chainId: number,
): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.delete(cacheKey(worldAddress, chainId));

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch {
    // Ignore — best effort
  }
}
