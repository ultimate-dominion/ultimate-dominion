import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { SyncHandle } from './startSync.js';

// ── Hoisted mocks (available inside vi.mock factories) ─────────────────

const { mockStopSync, mockDiscoverTables, mockSetTableNameMap } = vi.hoisted(() => ({
  mockStopSync: vi.fn(),
  mockDiscoverTables: vi.fn<() => Promise<Map<string, string[]>>>(),
  mockSetTableNameMap: vi.fn(),
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
  discoverTables: (...args: unknown[]) => mockDiscoverTables(...(args as [])),
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
