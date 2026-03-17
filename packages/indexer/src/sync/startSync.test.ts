import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { SyncHandle } from './startSync.js';

// ── Hoisted mocks (available inside vi.mock factories) ─────────────────

const { mockStopSync, mockDiscoverTables, mockSetTableNameMap, mockGetCheckpoint, mockSaveCheckpoint, mockBootstrapCheckpoint } = vi.hoisted(() => ({
  mockStopSync: vi.fn(),
  mockDiscoverTables: vi.fn<() => Promise<Map<string, string[]>>>(),
  mockSetTableNameMap: vi.fn(),
  mockGetCheckpoint: vi.fn<() => Promise<bigint | null>>(),
  mockSaveCheckpoint: vi.fn<(blockNumber: bigint) => Promise<void>>(),
  mockBootstrapCheckpoint: vi.fn<(schema: string) => Promise<bigint | null>>(),
}));

// Mock MUD syncToPostgres — resolved value is set fresh in beforeEach
vi.mock('@latticexyz/store-sync/postgres-decoded', () => ({
  syncToPostgres: vi.fn(),
}));

// Mock viem — createPublicClient needs getBlockNumber for the catchup check
vi.mock('viem', () => ({
  createPublicClient: vi.fn(() => ({
    getBlockNumber: vi.fn().mockResolvedValue(0n),
  })),
  http: vi.fn(),
  webSocket: vi.fn(),
  fallback: vi.fn(),
}));

vi.mock('viem/chains', () => ({ base: { id: 8453 } }));

vi.mock('../config.js', () => ({
  config: {
    database: { url: 'postgres://test' },
    chain: { rpcHttpUrl: 'http://test', rpcWsUrl: '' },
    world: { address: '0xtest', startBlock: 0n },
  },
}));

vi.mock('../db/connection.js', () => ({
  db: {},
  mudSchema: '0xtest',
  discoverTables: (...args: unknown[]) => mockDiscoverTables(...(args as [])),
}));

vi.mock('../db/checkpoint.js', () => ({
  getCheckpoint: (...args: unknown[]) => mockGetCheckpoint(...(args as [])),
  saveCheckpoint: (...args: unknown[]) => mockSaveCheckpoint(...(args as [bigint])),
  bootstrapCheckpoint: (...args: unknown[]) => mockBootstrapCheckpoint(...(args as [string])),
}));

vi.mock('../naming.js', () => ({
  pgNameToMudName: (s: string) => s.charAt(0).toUpperCase() + s.slice(1),
  snakeToPascal: (s: string) => s.charAt(0).toUpperCase() + s.slice(1),
  fixAbbreviations: (s: string) => s,
}));

// Static imports — vi.mock is hoisted before these
import { startSync } from './startSync.js';
import { syncToPostgres } from '@latticexyz/store-sync/postgres-decoded';

// ── Helpers ─────────────────────────────────────────────────────────────

function makeBroadcaster() {
  return {
    setTableNameMap: mockSetTableNameMap,
    onBlockProcessed: vi.fn(),
  } as any;
}

function makeTables(...names: string[]): Map<string, string[]> {
  const m = new Map<string, string[]>();
  for (const n of names) m.set(n, ['col1']);
  return m;
}

// ── Tests ───────────────────────────────────────────────────────────────

describe('startSync periodic table rediscovery', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    // Re-set syncToPostgres resolved value after clearAllMocks
    vi.mocked(syncToPostgres).mockResolvedValue({
      stopSync: mockStopSync,
      latestBlockNumber$: { subscribe: vi.fn() },
      storedBlockLogs$: { subscribe: vi.fn() },
    } as any);
    // Default: no checkpoint
    mockBootstrapCheckpoint.mockResolvedValue(null);
    mockGetCheckpoint.mockResolvedValue(null);
    mockSaveCheckpoint.mockResolvedValue(undefined);
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  async function startAndGetHandle(): Promise<SyncHandle> {
    // Initial discovery returns 2 tables
    mockDiscoverTables.mockResolvedValueOnce(makeTables('ud__characters', 'ud__zones'));

    // Start sync without awaiting — it has a 5s setTimeout we need to advance past
    const promise = startSync(makeBroadcaster());
    await vi.advanceTimersByTimeAsync(5000);
    const handle = await promise;

    // Clear mocks from startup calls
    mockDiscoverTables.mockClear();
    mockSetTableNameMap.mockClear();
    vi.mocked(console.log).mockClear();
    return handle;
  }

  it('discovers new tables after interval fires', async () => {
    const handle = await startAndGetHandle();

    // Next discovery returns 3 tables (one new)
    mockDiscoverTables.mockResolvedValueOnce(
      makeTables('ud__characters', 'ud__zones', 'ud__character_zone_completion'),
    );

    await vi.advanceTimersByTimeAsync(60_000);

    expect(mockDiscoverTables).toHaveBeenCalledTimes(1);
    expect(handle.tables.size).toBe(3);

    handle.stopSync();
  });

  it('logs "Table count changed" only when count changes', async () => {
    const handle = await startAndGetHandle();

    // Same count — no log
    mockDiscoverTables.mockResolvedValueOnce(makeTables('ud__characters', 'ud__zones'));
    await vi.advanceTimersByTimeAsync(60_000);
    expect(vi.mocked(console.log)).not.toHaveBeenCalledWith(
      expect.stringContaining('Table count changed'),
    );

    // Different count — logs
    mockDiscoverTables.mockResolvedValueOnce(
      makeTables('ud__characters', 'ud__zones', 'ud__zone_completions'),
    );
    await vi.advanceTimersByTimeAsync(60_000);
    expect(vi.mocked(console.log)).toHaveBeenCalledWith(
      expect.stringContaining('Table count changed: 2 → 3'),
    );

    handle.stopSync();
  });

  it('does NOT log verbose per-table list on periodic runs', async () => {
    const handle = await startAndGetHandle();

    mockDiscoverTables.mockResolvedValueOnce(
      makeTables('ud__characters', 'ud__zones', 'ud__new_table'),
    );
    await vi.advanceTimersByTimeAsync(60_000);

    // Verbose logging includes arrow separator for each table mapping
    const logCalls = vi.mocked(console.log).mock.calls.map(c => c[0]);
    const perTableLogs = logCalls.filter(
      (msg: string) => typeof msg === 'string' && msg.includes('→') && !msg.includes('Table count changed'),
    );
    expect(perTableLogs).toHaveLength(0);

    handle.stopSync();
  });

  it('stopSync clears the interval — no further discovery calls', async () => {
    const handle = await startAndGetHandle();

    handle.stopSync();

    mockDiscoverTables.mockResolvedValueOnce(makeTables('ud__characters'));
    await vi.advanceTimersByTimeAsync(60_000);

    expect(mockDiscoverTables).not.toHaveBeenCalled();
  });

  it('stopSync calls the original stopSync from MUD', async () => {
    const handle = await startAndGetHandle();
    handle.stopSync();
    expect(mockStopSync).toHaveBeenCalledTimes(1);
  });

  it('catches errors in discoverTables without crashing the loop', async () => {
    const handle = await startAndGetHandle();

    // First tick: error
    mockDiscoverTables.mockRejectedValueOnce(new Error('connection lost'));
    await vi.advanceTimersByTimeAsync(60_000);

    expect(vi.mocked(console.error)).toHaveBeenCalledWith(
      '[sync] Periodic table rediscovery failed:',
      expect.any(Error),
    );

    // Second tick: recovers fine
    mockDiscoverTables.mockResolvedValueOnce(makeTables('ud__characters', 'ud__zones'));
    await vi.advanceTimersByTimeAsync(60_000);

    expect(mockDiscoverTables).toHaveBeenCalledTimes(2);

    handle.stopSync();
  });

  it('calls broadcaster.setTableNameMap on each rediscovery tick', async () => {
    const handle = await startAndGetHandle();

    mockDiscoverTables.mockResolvedValueOnce(makeTables('ud__characters', 'ud__zones'));
    await vi.advanceTimersByTimeAsync(60_000);

    expect(mockSetTableNameMap).toHaveBeenCalledTimes(1);
    expect(mockSetTableNameMap).toHaveBeenCalledWith(expect.any(Map));

    handle.stopSync();
  });
});

describe('startSync checkpoint', () => {
  let storedBlockLogsSubscriber: any;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    // Capture the storedBlockLogs$ subscriber
    storedBlockLogsSubscriber = null;
    vi.mocked(syncToPostgres).mockResolvedValue({
      stopSync: mockStopSync,
      latestBlockNumber$: { subscribe: vi.fn() },
      storedBlockLogs$: {
        subscribe: (handlers: any) => {
          storedBlockLogsSubscriber = handlers;
        },
      },
    } as any);
    mockBootstrapCheckpoint.mockResolvedValue(null);
    mockGetCheckpoint.mockResolvedValue(null);
    mockSaveCheckpoint.mockResolvedValue(undefined);
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  async function startWithCheckpoint(checkpoint: bigint | null): Promise<SyncHandle> {
    mockBootstrapCheckpoint.mockResolvedValueOnce(checkpoint);
    if (checkpoint === null) {
      mockGetCheckpoint.mockResolvedValueOnce(null);
    }
    mockDiscoverTables.mockResolvedValueOnce(makeTables('ud__characters'));

    const promise = startSync(makeBroadcaster());
    await vi.advanceTimersByTimeAsync(5000);
    return promise;
  }

  it('uses checkpoint - 100 as effective start block', async () => {
    const handle = await startWithCheckpoint(500000n);

    expect(vi.mocked(syncToPostgres)).toHaveBeenCalledWith(
      expect.objectContaining({
        startBlock: 499900n, // 500000 - 100
      }),
    );

    handle.stopSync();
  });

  it('falls back to env START_BLOCK when no checkpoint exists', async () => {
    const handle = await startWithCheckpoint(null);

    expect(vi.mocked(syncToPostgres)).toHaveBeenCalledWith(
      expect.objectContaining({
        startBlock: 0n, // config.world.startBlock from mock
      }),
    );

    handle.stopSync();
  });

  it('clamps effective start block to env START_BLOCK when checkpoint is too small', async () => {
    // checkpoint 50 - 100 = -50, should clamp to START_BLOCK (0)
    const handle = await startWithCheckpoint(50n);

    expect(vi.mocked(syncToPostgres)).toHaveBeenCalledWith(
      expect.objectContaining({
        startBlock: 0n,
      }),
    );

    handle.stopSync();
  });

  it('saves checkpoint periodically in storedBlockLogs$ subscriber', async () => {
    const handle = await startWithCheckpoint(null);

    expect(storedBlockLogsSubscriber).not.toBeNull();

    // First call — should not save yet (interval not elapsed)
    await storedBlockLogsSubscriber.next({ blockNumber: 100n, logs: [] });
    expect(mockSaveCheckpoint).not.toHaveBeenCalled();

    // Advance 30s and fire another block
    await vi.advanceTimersByTimeAsync(30_000);
    await storedBlockLogsSubscriber.next({ blockNumber: 200n, logs: [] });
    expect(mockSaveCheckpoint).toHaveBeenCalledWith(200n);

    handle.stopSync();
  });

  it('logs error but does not throw when checkpoint save fails', async () => {
    const handle = await startWithCheckpoint(null);

    mockSaveCheckpoint.mockRejectedValueOnce(new Error('db down'));

    // Advance past the checkpoint interval
    await vi.advanceTimersByTimeAsync(30_000);
    await storedBlockLogsSubscriber.next({ blockNumber: 300n, logs: [] });

    expect(vi.mocked(console.error)).toHaveBeenCalledWith(
      '[sync] Checkpoint save failed:',
      expect.any(Error),
    );

    handle.stopSync();
  });
});
