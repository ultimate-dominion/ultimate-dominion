import React, { useEffect, useRef, useState, type ReactNode } from 'react';
import { useGameStore, wasPreHydrated } from './store';
import { WSClient } from './wsClient';
import type { FullSnapshot } from './types';
import { writeCachedCharacters, writeCachedSnapshot } from './snapshotCache';
import { writeSnapshotToIDB } from './idbSnapshotCache';
import { idbSnapshotPromise } from './store';

const INDEXER_API_URL = import.meta.env.VITE_INDEXER_API_URL || 'http://localhost:3001/api';
const INDEXER_WS_URL = import.meta.env.VITE_INDEXER_WS_URL || 'ws://localhost:3001/ws';
const WORLD_ADDRESS = import.meta.env.VITE_WORLD_ADDRESS || '';
const SNAPSHOT_BOOT_TIMEOUT_MS = 5000;

/** Re-hydrate if tab was hidden longer than this (ms) */
const STALE_THRESHOLD = 2 * 60 * 1000; // 2 minutes

type Props = {
  children: ReactNode;
};

type BootstrapGameStoreOptions = {
  cancelled: () => boolean;
  idbSnapshot: FullSnapshot | null;
  fetchSnapshot: () => Promise<FullSnapshot>;
  hydrateSnapshot: (snapshot: FullSnapshot) => void;
  connectWs: (snapshot: FullSnapshot) => void;
  cacheSnapshot: (snapshot: FullSnapshot) => void;
  getCurrentBlock: () => number;
  timeoutMs?: number;
};

type BootstrapResult =
  | { type: 'snapshot'; snapshot: FullSnapshot }
  | { type: 'error'; error: Error }
  | { type: 'timeout' };

type NetworkBootstrapResult =
  | { type: 'snapshot'; snapshot: FullSnapshot }
  | { type: 'error'; error: Error };

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

export async function bootstrapGameStore({
  cancelled,
  idbSnapshot,
  fetchSnapshot,
  hydrateSnapshot,
  connectWs,
  cacheSnapshot,
  getCurrentBlock,
  timeoutMs = SNAPSHOT_BOOT_TIMEOUT_MS,
}: BootstrapGameStoreOptions): Promise<void> {
  const networkPromise: Promise<NetworkBootstrapResult> = fetchSnapshot()
    .then((snapshot): NetworkBootstrapResult => ({ type: 'snapshot', snapshot }))
    .catch((error): NetworkBootstrapResult => ({ type: 'error', error: toError(error) }));

  const firstResult: BootstrapResult = await Promise.race([
    networkPromise,
    new Promise<BootstrapResult>((resolve) => {
      setTimeout(() => resolve({ type: 'timeout' }), timeoutMs);
    }),
  ]);

  if (firstResult.type === 'snapshot') {
    if (cancelled()) return;
    hydrateSnapshot(firstResult.snapshot);
    cacheSnapshot(firstResult.snapshot);
    connectWs(firstResult.snapshot);
    return;
  }

  if (firstResult.type === 'error') {
    if (!idbSnapshot) throw firstResult.error;
    if (cancelled()) return;
    console.warn('[gameStore] Fresh snapshot failed — booting from IndexedDB:', firstResult.error.message);
    hydrateSnapshot(idbSnapshot);
    connectWs(idbSnapshot);
    return;
  }

  if (!idbSnapshot) {
    throw new Error(`Snapshot fetch timed out after ${timeoutMs}ms`);
  }

  if (cancelled()) return;
  console.warn(`[gameStore] Snapshot fetch stalled — booting from IndexedDB block ${idbSnapshot.block}`);
  hydrateSnapshot(idbSnapshot);
  connectWs(idbSnapshot);

  const eventualResult: NetworkBootstrapResult = await networkPromise;
  if (eventualResult.type === 'error') {
    console.warn('[gameStore] Fresh snapshot failed after IndexedDB fallback:', eventualResult.error.message);
    return;
  }
  if (cancelled()) return;

  if (eventualResult.snapshot.block < idbSnapshot.block) {
    console.log(
      `[gameStore] Skipping older fresh snapshot block ${eventualResult.snapshot.block} after IndexedDB fallback block ${idbSnapshot.block}`,
    );
    return;
  }

  cacheSnapshot(eventualResult.snapshot);
  const currentBlock = getCurrentBlock();
  console.log(
    `[gameStore] Applying authoritative snapshot block ${eventualResult.snapshot.block} after IndexedDB fallback (store block ${currentBlock})`,
  );
  hydrateSnapshot(eventualResult.snapshot);
  connectWs(eventualResult.snapshot);
}

async function fetchSnapshot(): Promise<FullSnapshot> {
  const response = await fetch(`${INDEXER_API_URL}/snapshot`);
  if (!response.ok) {
    throw new Error(`Snapshot fetch failed: ${response.status}`);
  }
  return response.json();
}

/**
 * Provides the game store with data from the indexer.
 * 1. Fetches full snapshot via REST (replaces RECS event replay)
 * 2. Connects WebSocket for real-time updates
 * 3. Re-hydrates on tab wake after idle to prevent stale state
 * 4. Children render immediately (consumers check `hydrated` flag as needed)
 */
export function GameStoreProvider({ children }: Props) {
  const [error, setError] = useState<string | null>(null);
  const wsRef = useRef<WSClient | null>(null);
  const hiddenAtRef = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        const hydrateSnapshot = (snapshot: FullSnapshot) => {
          console.log(`[gameStore] Hydrating with ${Object.keys(snapshot.tables).length} tables at block ${snapshot.block}`);
          useGameStore.getState().hydrate(snapshot);
        };

        const cacheSnapshot = (snapshot: FullSnapshot) => {
          if (!WORLD_ADDRESS) return;
          // IndexedDB: full snapshot (24MB+ is fine, no size limit issues)
          writeSnapshotToIDB(WORLD_ADDRESS, snapshot);
          // localStorage: Characters table only (~50KB) for synchronous fast-path
          if (snapshot.tables.Characters) {
            writeCachedCharacters(WORLD_ADDRESS, snapshot.tables.Characters);
          }
          // localStorage: full snapshot (will fail silently if too large)
          writeCachedSnapshot(WORLD_ADDRESS, snapshot);
        };

        const connectWs = (snapshot: FullSnapshot) => {
          if (wsRef.current) {
            wsRef.current.dispose();
          }
          const store = useGameStore.getState();
          const ws = new WSClient(INDEXER_WS_URL, store, snapshot.block, {
            onRequestSnapshot: () => {
              console.log('[gameStore] WS requested snapshot re-fetch after repeated failures');
              fetchSnapshot()
                .then((snap) => {
                  if (cancelled) return;
                  hydrateSnapshot(snap);
                  cacheSnapshot(snap);
                })
                .catch((err) => console.error('[gameStore] Snapshot re-fetch failed:', err));
            },
          });
          wsRef.current = ws;
          ws.connect();
        };

        if (wasPreHydrated) {
          console.log('[gameStore] Pre-loaded from cache at block', useGameStore.getState().currentBlock);
        }

        // Try IndexedDB cache (~10-50ms) — holds the full 24MB snapshot
        // that localStorage can't. Pre-loads tables for rendering but does NOT
        // set hydrated — only the network fetch should flip that flag to prevent
        // stale cache data from driving redirect decisions (shop/battle redirects).
        const idbSnapshot = await idbSnapshotPromise;
        if (idbSnapshot && !cancelled) {
          useGameStore.getState().preloadTables(idbSnapshot);
          console.log('[gameStore] Pre-loaded from IndexedDB at block', idbSnapshot.block);
        }

        // Fetch fresh snapshot from indexer
        console.log('[gameStore] Fetching snapshot from', INDEXER_API_URL);
        await bootstrapGameStore({
          cancelled: () => cancelled,
          idbSnapshot,
          fetchSnapshot,
          hydrateSnapshot,
          connectWs,
          cacheSnapshot,
          getCurrentBlock: () => useGameStore.getState().currentBlock,
        });
      } catch (err) {
        if (!cancelled) {
          console.error('[gameStore] Init error:', err);
          setError((err as Error).message);
        }
      }
    }

    init();

    // 3. Re-hydrate when tab wakes from long idle
    const onVisibility = () => {
      if (document.hidden) {
        hiddenAtRef.current = Date.now();
      } else {
        const hiddenAt = hiddenAtRef.current;
        hiddenAtRef.current = null;
        if (hiddenAt && Date.now() - hiddenAt > STALE_THRESHOLD) {
          console.log('[gameStore] Tab was idle, re-hydrating...');
          useGameStore.getState().setReconnecting(true);
          // Safety: force-clear reconnecting after 10s in case the fetch hangs
          const reconnectTimeout = setTimeout(() => {
            if (useGameStore.getState().isReconnecting) {
              console.warn('[gameStore] Reconnect timeout — force-clearing overlay');
              useGameStore.getState().setReconnecting(false);
            }
          }, 10000);
          fetchSnapshot()
            .then((snapshot) => {
              clearTimeout(reconnectTimeout);
              if (cancelled) {
                // Still clear reconnecting even if cancelled — the Zustand store
                // is global, so a stale isReconnecting=true would block the UI
                // on remount with the "Reconnecting..." overlay.
                useGameStore.getState().setReconnecting(false);
                return;
              }
              useGameStore.getState().hydrate(snapshot);
              useGameStore.getState().setReconnecting(false);
              if (WORLD_ADDRESS) {
                writeSnapshotToIDB(WORLD_ADDRESS, snapshot);
                writeCachedSnapshot(WORLD_ADDRESS, snapshot);
              }
              // Reconnect WS from new block so we don't replay old updates
              if (wsRef.current) {
                wsRef.current.dispose();
              }
              const store = useGameStore.getState();
              const ws = new WSClient(INDEXER_WS_URL, store, snapshot.block, {
                onRequestSnapshot: () => {
                  console.log('[gameStore] WS requested snapshot re-fetch after repeated failures');
                  fetchSnapshot()
                    .then((snap) => {
                      if (cancelled) return;
                      useGameStore.getState().hydrate(snap);
                      if (WORLD_ADDRESS) {
                        writeSnapshotToIDB(WORLD_ADDRESS, snap);
                        writeCachedSnapshot(WORLD_ADDRESS, snap);
                      }
                    })
                    .catch((err) => console.error('[gameStore] Snapshot re-fetch failed:', err));
                },
              });
              wsRef.current = ws;
              ws.connect();
            })
            .catch((err) => {
              clearTimeout(reconnectTimeout);
              console.error('[gameStore] Re-hydration failed:', err);
              useGameStore.getState().setReconnecting(false);
            });
        }
      }
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisibility);
      wsRef.current?.dispose();
      wsRef.current = null;
    };
  }, []);

  if (error) {
    return (
      <div style={{ padding: '2rem', color: '#ff6b6b', textAlign: 'center' }}>
        <h2>Connection Error</h2>
        <p>Failed to connect to game server: {error}</p>
        <button onClick={() => window.location.reload()} style={{ marginTop: '1rem', padding: '0.5rem 1rem' }}>
          Retry
        </button>
      </div>
    );
  }

  return <>{children}</>;
}
