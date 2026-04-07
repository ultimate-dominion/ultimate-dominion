import { afterEach, describe, expect, it, vi } from 'vitest';
import { bootstrapGameStore } from './GameStoreProvider';
import type { FullSnapshot } from './types';

function makeSnapshot(block: number): FullSnapshot {
  return {
    block,
    tables: {
      Characters: {
        '0x01': { name: 'Hero', level: block },
      },
    },
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('bootstrapGameStore', () => {
  it('hydrates the fresh snapshot and connects ws when the network returns in time', async () => {
    const snapshot = makeSnapshot(120);
    const hydrateSnapshot = vi.fn();
    const connectWs = vi.fn();
    const cacheSnapshot = vi.fn();

    await bootstrapGameStore({
      cancelled: () => false,
      idbSnapshot: null,
      fetchSnapshot: async () => snapshot,
      hydrateSnapshot,
      connectWs,
      cacheSnapshot,
      getCurrentBlock: () => 0,
      timeoutMs: 100,
    });

    expect(hydrateSnapshot).toHaveBeenCalledTimes(1);
    expect(hydrateSnapshot).toHaveBeenCalledWith(snapshot);
    expect(connectWs).toHaveBeenCalledTimes(1);
    expect(connectWs).toHaveBeenCalledWith(snapshot);
    expect(cacheSnapshot).toHaveBeenCalledTimes(1);
    expect(cacheSnapshot).toHaveBeenCalledWith(snapshot);
  });

  it('boots from IndexedDB after a timeout, then upgrades and reconnects when the fresh snapshot arrives', async () => {
    vi.useFakeTimers();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});

    const idbSnapshot = makeSnapshot(90);
    const freshSnapshot = makeSnapshot(140);
    const network = deferred<FullSnapshot>();
    const hydrateSnapshot = vi.fn();
    const connectWs = vi.fn();
    const cacheSnapshot = vi.fn();
    let currentBlock = 0;

    const promise = bootstrapGameStore({
      cancelled: () => false,
      idbSnapshot,
      fetchSnapshot: () => network.promise,
      hydrateSnapshot: (snapshot) => {
        currentBlock = snapshot.block;
        hydrateSnapshot(snapshot);
      },
      connectWs,
      cacheSnapshot,
      getCurrentBlock: () => currentBlock,
      timeoutMs: 1000,
    });

    await vi.advanceTimersByTimeAsync(1000);

    expect(hydrateSnapshot).toHaveBeenCalledTimes(1);
    expect(hydrateSnapshot).toHaveBeenCalledWith(idbSnapshot);
    expect(connectWs).toHaveBeenCalledTimes(1);
    expect(connectWs).toHaveBeenCalledWith(idbSnapshot);
    expect(cacheSnapshot).not.toHaveBeenCalled();

    network.resolve(freshSnapshot);
    await promise;

    expect(cacheSnapshot).toHaveBeenCalledTimes(1);
    expect(cacheSnapshot).toHaveBeenCalledWith(freshSnapshot);
    expect(hydrateSnapshot).toHaveBeenCalledTimes(2);
    expect(hydrateSnapshot).toHaveBeenNthCalledWith(2, freshSnapshot);
    expect(connectWs).toHaveBeenCalledTimes(2);
    expect(connectWs).toHaveBeenNthCalledWith(2, freshSnapshot);
  });

  it('skips the eventual snapshot when websocket updates already advanced the local block beyond it', async () => {
    vi.useFakeTimers();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});

    const idbSnapshot = makeSnapshot(90);
    const freshSnapshot = makeSnapshot(140);
    const network = deferred<FullSnapshot>();
    const hydrateSnapshot = vi.fn();
    const connectWs = vi.fn();
    const cacheSnapshot = vi.fn();
    let currentBlock = 141;

    const promise = bootstrapGameStore({
      cancelled: () => false,
      idbSnapshot,
      fetchSnapshot: () => network.promise,
      hydrateSnapshot,
      connectWs,
      cacheSnapshot,
      getCurrentBlock: () => currentBlock,
      timeoutMs: 1000,
    });

    await vi.advanceTimersByTimeAsync(1000);

    network.resolve(freshSnapshot);
    await promise;

    expect(cacheSnapshot).not.toHaveBeenCalled();
    expect(hydrateSnapshot).toHaveBeenCalledTimes(1);
    expect(hydrateSnapshot).toHaveBeenCalledWith(idbSnapshot);
    expect(connectWs).toHaveBeenCalledTimes(1);
    expect(connectWs).toHaveBeenCalledWith(idbSnapshot);
  });

  it('skips the eventual fresh snapshot if it is older than the IndexedDB fallback snapshot', async () => {
    vi.useFakeTimers();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});

    const idbSnapshot = makeSnapshot(120);
    const staleSnapshot = makeSnapshot(110);
    const network = deferred<FullSnapshot>();
    const hydrateSnapshot = vi.fn();
    const connectWs = vi.fn();
    const cacheSnapshot = vi.fn();

    const promise = bootstrapGameStore({
      cancelled: () => false,
      idbSnapshot,
      fetchSnapshot: () => network.promise,
      hydrateSnapshot,
      connectWs,
      cacheSnapshot,
      getCurrentBlock: () => 130,
      timeoutMs: 1000,
    });

    await vi.advanceTimersByTimeAsync(1000);

    network.resolve(staleSnapshot);
    await promise;

    expect(cacheSnapshot).not.toHaveBeenCalled();
    expect(hydrateSnapshot).toHaveBeenCalledTimes(1);
    expect(hydrateSnapshot).toHaveBeenCalledWith(idbSnapshot);
    expect(connectWs).toHaveBeenCalledTimes(1);
    expect(connectWs).toHaveBeenCalledWith(idbSnapshot);
  });

  it('boots from IndexedDB immediately if the fresh snapshot fails', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    const idbSnapshot = makeSnapshot(77);
    const hydrateSnapshot = vi.fn();
    const connectWs = vi.fn();
    const cacheSnapshot = vi.fn();

    await bootstrapGameStore({
      cancelled: () => false,
      idbSnapshot,
      fetchSnapshot: async () => {
        throw new Error('boom');
      },
      hydrateSnapshot,
      connectWs,
      cacheSnapshot,
      getCurrentBlock: () => idbSnapshot.block,
      timeoutMs: 100,
    });

    expect(hydrateSnapshot).toHaveBeenCalledTimes(1);
    expect(hydrateSnapshot).toHaveBeenCalledWith(idbSnapshot);
    expect(connectWs).toHaveBeenCalledTimes(1);
    expect(connectWs).toHaveBeenCalledWith(idbSnapshot);
    expect(cacheSnapshot).not.toHaveBeenCalled();
  });

  it('throws a timeout error when no snapshot source becomes available', async () => {
    vi.useFakeTimers();

    const network = deferred<FullSnapshot>();
    const rejection = expect(bootstrapGameStore({
      cancelled: () => false,
      idbSnapshot: null,
      fetchSnapshot: () => network.promise,
      hydrateSnapshot: vi.fn(),
      connectWs: vi.fn(),
      cacheSnapshot: vi.fn(),
      getCurrentBlock: () => 0,
      timeoutMs: 1000,
    })).rejects.toThrow('Snapshot fetch timed out after 1000ms');

    await vi.advanceTimersByTimeAsync(1000);
    await rejection;
  });
});
