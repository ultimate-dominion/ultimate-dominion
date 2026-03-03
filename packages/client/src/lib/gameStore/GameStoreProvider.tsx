import React, { useEffect, useRef, useState, type ReactNode } from 'react';
import { useGameStore } from './store';
import { WSClient } from './wsClient';
import type { FullSnapshot } from './types';

const INDEXER_API_URL = import.meta.env.VITE_INDEXER_API_URL || 'http://localhost:3001/api';
const INDEXER_WS_URL = import.meta.env.VITE_INDEXER_WS_URL || 'ws://localhost:3001/ws';

type Props = {
  children: ReactNode;
};

/**
 * Provides the game store with data from the indexer.
 * 1. Fetches full snapshot via REST (replaces RECS event replay)
 * 2. Connects WebSocket for real-time updates
 * 3. Children render once store is hydrated
 */
export function GameStoreProvider({ children }: Props) {
  const hydrated = useGameStore((s) => s.hydrated);
  const [error, setError] = useState<string | null>(null);
  const wsRef = useRef<WSClient | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        // 1. Fetch snapshot
        console.log('[gameStore] Fetching snapshot from', INDEXER_API_URL);
        const response = await fetch(`${INDEXER_API_URL}/snapshot`);
        if (!response.ok) {
          throw new Error(`Snapshot fetch failed: ${response.status}`);
        }
        const snapshot: FullSnapshot = await response.json();
        if (cancelled) return;

        console.log(`[gameStore] Hydrating with ${Object.keys(snapshot.tables).length} tables at block ${snapshot.block}`);
        useGameStore.getState().hydrate(snapshot);

        // 2. Connect WebSocket
        const store = useGameStore.getState();
        const ws = new WSClient(INDEXER_WS_URL, store, snapshot.block);
        wsRef.current = ws;
        ws.connect();
      } catch (err) {
        if (!cancelled) {
          console.error('[gameStore] Init error:', err);
          setError((err as Error).message);
        }
      }
    }

    init();

    return () => {
      cancelled = true;
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

  if (!hydrated) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: '#888' }}>
        Loading game state...
      </div>
    );
  }

  return <>{children}</>;
}
