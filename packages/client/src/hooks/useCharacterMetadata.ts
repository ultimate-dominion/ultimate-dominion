import { useEffect, useState } from 'react';

import {
  fetchMetadataFromUri,
  isTextOnlyUri,
  uriToHttp,
} from '../utils/helpers';
import type { Metadata } from '../utils/types';

// Module-level cache — survives re-renders, shared across all components
const metadataCache = new Map<string, Metadata>();
const pendingFetches = new Set<string>();
const subscribers = new Set<() => void>();

function notifySubscribers() {
  subscribers.forEach(cb => cb());
}

function resolveUri(tokenURI: string): string {
  if (isTextOnlyUri(tokenURI)) return tokenURI;
  if (tokenURI.startsWith('ipfs://')) return uriToHttp(tokenURI)[0] ?? '';
  return uriToHttp(`ipfs://${tokenURI}`)[0] ?? '';
}

async function fetchAndCache(tokenURI: string): Promise<void> {
  if (pendingFetches.has(tokenURI) || metadataCache.has(tokenURI)) return;

  const resolved = resolveUri(tokenURI);
  if (!resolved) return;

  pendingFetches.add(tokenURI);
  try {
    const metadata = await fetchMetadataFromUri(resolved);
    metadataCache.set(tokenURI, metadata);
    notifySubscribers();
  } catch (error) {
    console.warn('[useCharacterMetadata] Failed to fetch metadata:', error);
  } finally {
    pendingFetches.delete(tokenURI);
  }
}

/** Synchronous read for useMemo consumers. Returns null if not cached yet. */
export function getCachedMetadata(tokenURI: string | undefined): Metadata | null {
  if (!tokenURI || tokenURI.startsWith('test') || tokenURI.length <= 10) return null;

  const cached = metadataCache.get(tokenURI);
  if (cached) return cached;

  // Trigger a background fetch if not already in-flight
  fetchAndCache(tokenURI);
  return null;
}

/** Hook for components that want to trigger a fetch + re-render on arrival. */
export function useCharacterMetadata(tokenURI: string | undefined): Metadata | null {
  const [, setVersion] = useState(0);

  useEffect(() => {
    const cb = () => setVersion(v => v + 1);
    subscribers.add(cb);
    return () => { subscribers.delete(cb); };
  }, []);

  if (!tokenURI || tokenURI.startsWith('test') || tokenURI.length <= 10) return null;

  const cached = metadataCache.get(tokenURI);
  if (cached) return cached;

  // Trigger fetch on first access
  fetchAndCache(tokenURI);
  return null;
}

/** Clear the metadata cache (for testing). */
export function clearMetadataCache(): void {
  metadataCache.clear();
  pendingFetches.clear();
}
