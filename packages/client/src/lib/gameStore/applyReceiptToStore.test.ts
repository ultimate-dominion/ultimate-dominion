import { describe, it, expect, vi, beforeEach } from 'vitest';
import { type Hex, type PublicClient, type TransactionReceipt, keccak256, encodeAbiParameters, toHex } from 'viem';

// Track store calls
const mockSetRow = vi.fn();
const mockDeleteRow = vi.fn();
const mockApplyBatch = vi.fn();

// Mutable tables state for splice tests
let mockTables: Record<string, Record<string, Record<string, unknown>>> = {};

vi.mock('./store', () => ({
  useGameStore: {
    getState: () => ({
      setRow: mockSetRow,
      deleteRow: mockDeleteRow,
      applyBatch: mockApplyBatch,
      tables: mockTables,
    }),
  },
}));

// Mock logToRecord — returns a simple decoded record
const mockLogToRecord = vi.fn().mockReturnValue({ name: 'TestHero', level: '5' });
vi.mock('@latticexyz/store/internal', () => ({
  logToRecord: (...args: unknown[]) => mockLogToRecord(...args),
}));

// Mock @latticexyz/store to avoid viem version mismatch during module init.
// Provide the storeEventsAbi inline so decodeEventLog works.
vi.mock('@latticexyz/store', () => ({
  storeEventsAbi: [
    {
      type: 'event',
      name: 'Store_SetRecord',
      inputs: [
        { name: 'tableId', type: 'bytes32', indexed: true, internalType: 'ResourceId' },
        { name: 'keyTuple', type: 'bytes32[]', indexed: false },
        { name: 'staticData', type: 'bytes', indexed: false },
        { name: 'encodedLengths', type: 'bytes32', indexed: false, internalType: 'EncodedLengths' },
        { name: 'dynamicData', type: 'bytes', indexed: false },
      ],
    },
    {
      type: 'event',
      name: 'Store_SpliceStaticData',
      inputs: [
        { name: 'tableId', type: 'bytes32', indexed: true, internalType: 'ResourceId' },
        { name: 'keyTuple', type: 'bytes32[]', indexed: false },
        { name: 'start', type: 'uint48', indexed: false },
        { name: 'data', type: 'bytes', indexed: false },
      ],
    },
    {
      type: 'event',
      name: 'Store_SpliceDynamicData',
      inputs: [
        { name: 'tableId', type: 'bytes32', indexed: true, internalType: 'ResourceId' },
        { name: 'keyTuple', type: 'bytes32[]', indexed: false },
        { name: 'dynamicFieldIndex', type: 'uint8', indexed: false },
        { name: 'start', type: 'uint48', indexed: false },
        { name: 'deleteCount', type: 'uint40', indexed: false },
        { name: 'encodedLengths', type: 'bytes32', indexed: false, internalType: 'EncodedLengths' },
        { name: 'data', type: 'bytes', indexed: false },
      ],
    },
    {
      type: 'event',
      name: 'Store_DeleteRecord',
      inputs: [
        { name: 'tableId', type: 'bytes32', indexed: true, internalType: 'ResourceId' },
        { name: 'keyTuple', type: 'bytes32[]', indexed: false },
      ],
    },
  ],
}));

// Inline test table config — avoids importing mudConfig which triggers the
// @latticexyz/store module init (broken keccak256/viem version mismatch).
// This is the first UD-namespace table: Paused.
const testTableId = '0x7462554400000000000000000000000050617573656400000000000000000000' as Hex;
const testTableLabel = 'Paused';

// Stats table for splice tests
const statsTableId = '0x7462554400000000000000000000000053746174730000000000000000000000' as Hex;

vi.mock('contracts/mud.config', () => {
  const tables = {
    UD__Paused: {
      label: 'Paused',
      tableId: '0x7462554400000000000000000000000050617573656400000000000000000000',
      key: ['id'],
      schema: {
        id: { type: 'bytes32', internalType: 'bytes32' },
        paused: { type: 'bool', internalType: 'bool' },
      },
    },
    UD__Stats: {
      label: 'Stats',
      tableId: '0x7462554400000000000000000000000053746174730000000000000000000000',
      key: ['entityId'],
      schema: {
        entityId: { type: 'bytes32', internalType: 'bytes32' },
        strength: { type: 'int256', internalType: 'int256' },
        agility: { type: 'int256', internalType: 'int256' },
        class: { type: 'uint8', internalType: 'Classes' },
        intelligence: { type: 'int256', internalType: 'int256' },
        maxHp: { type: 'int256', internalType: 'int256' },
        currentHp: { type: 'int256', internalType: 'int256' },
        experience: { type: 'uint256', internalType: 'uint256' },
        level: { type: 'uint256', internalType: 'uint256' },
        powerSource: { type: 'uint8', internalType: 'PowerSource' },
        race: { type: 'uint8', internalType: 'Race' },
        startingArmor: { type: 'uint8', internalType: 'ArmorType' },
        advancedClass: { type: 'uint8', internalType: 'AdvancedClass' },
        hasSelectedAdvancedClass: { type: 'bool', internalType: 'bool' },
      },
    },
  };
  return { default: { tables } };
});

// Mock fetch for background delta
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

import { applyReceiptToStore } from './applyReceiptToStore';

// Helper: build a mock receipt with specific logs
function makeReceipt(
  logs: { data: Hex; topics: [Hex, ...Hex[]] }[],
  blockNumber = 100n,
): TransactionReceipt {
  return {
    blockNumber,
    logs: logs.map((log, i) => ({
      ...log,
      address: '0x0000000000000000000000000000000000000000' as Hex,
      blockHash: '0x0' as Hex,
      blockNumber,
      transactionHash: '0x0' as Hex,
      transactionIndex: 0,
      logIndex: i,
      removed: false,
    })),
    status: 'success',
    blockHash: '0x0' as Hex,
    contractAddress: null,
    cumulativeGasUsed: 0n,
    effectiveGasPrice: 0n,
    from: '0x0' as Hex,
    gasUsed: 0n,
    logsBloom: '0x0' as Hex,
    to: '0x0' as Hex,
    transactionHash: '0x0' as Hex,
    transactionIndex: 0,
    type: 'eip1559',
  };
}

// Event signatures
const DELETE_EVENT_SIG = keccak256(toHex('Store_DeleteRecord(bytes32,bytes32[])'));
const SET_RECORD_EVENT_SIG = keccak256(toHex('Store_SetRecord(bytes32,bytes32[],bytes,bytes32,bytes)'));
const SPLICE_STATIC_EVENT_SIG = keccak256(toHex('Store_SpliceStaticData(bytes32,bytes32[],uint48,bytes)'));
const SPLICE_DYNAMIC_EVENT_SIG = keccak256(toHex('Store_SpliceDynamicData(bytes32,bytes32[],uint8,uint48,uint40,bytes32,bytes)'));

function encodeDeleteLog(tableId: Hex, keyTuple: Hex[]) {
  const data = encodeAbiParameters(
    [{ name: 'keyTuple', type: 'bytes32[]' }],
    [keyTuple],
  );
  return {
    data,
    topics: [DELETE_EVENT_SIG, tableId] as [Hex, ...Hex[]],
  };
}

function encodeSetRecordLog(tableId: Hex, keyTuple: Hex[]) {
  const data = encodeAbiParameters(
    [
      { name: 'keyTuple', type: 'bytes32[]' },
      { name: 'staticData', type: 'bytes' },
      { name: 'encodedLengths', type: 'bytes32' },
      { name: 'dynamicData', type: 'bytes' },
    ],
    [
      keyTuple,
      '0x00' as Hex,
      '0x0000000000000000000000000000000000000000000000000000000000000000' as Hex,
      '0x00' as Hex,
    ],
  );
  return {
    data,
    topics: [SET_RECORD_EVENT_SIG, tableId] as [Hex, ...Hex[]],
  };
}

function encodeSpliceStaticLog(tableId: Hex, keyTuple: Hex[], start: number, spliceData: Hex) {
  const data = encodeAbiParameters(
    [
      { name: 'keyTuple', type: 'bytes32[]' },
      { name: 'start', type: 'uint48' },
      { name: 'data', type: 'bytes' },
    ],
    [keyTuple, start, spliceData],
  );
  return {
    data,
    topics: [SPLICE_STATIC_EVENT_SIG, tableId] as [Hex, ...Hex[]],
  };
}

function encodeSpliceDynamicLog(tableId: Hex, keyTuple: Hex[]) {
  const data = encodeAbiParameters(
    [
      { name: 'keyTuple', type: 'bytes32[]' },
      { name: 'dynamicFieldIndex', type: 'uint8' },
      { name: 'start', type: 'uint48' },
      { name: 'deleteCount', type: 'uint40' },
      { name: 'encodedLengths', type: 'bytes32' },
      { name: 'data', type: 'bytes' },
    ],
    [
      keyTuple,
      0,
      0,
      0,
      '0x0000000000000000000000000000000000000000000000000000000000000000' as Hex,
      '0x00' as Hex,
    ],
  );
  return {
    data,
    topics: [SPLICE_DYNAMIC_EVENT_SIG, tableId] as [Hex, ...Hex[]],
  };
}

// ---------------------------------------------------------------------------
// Original tests
// ---------------------------------------------------------------------------
describe('applyReceiptToStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTables = {};
    mockLogToRecord.mockReturnValue({ name: 'TestHero', level: '5' });
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ block: 100, tables: {} }),
    });
  });

  it('applies delete events via applyBatch for known tables', async () => {
    const keyTuple: Hex[] = ['0x000000000000000000000000000000000000000000000000000000000000002a'];
    const log = encodeDeleteLog(testTableId, keyTuple);
    const receipt = makeReceipt([log]);

    await applyReceiptToStore(receipt);

    const expectedKeyBytes = '0x' + keyTuple[0].slice(2);
    expect(mockApplyBatch).toHaveBeenCalledTimes(1);
    expect(mockApplyBatch).toHaveBeenCalledWith([
      { type: 'delete', table: testTableLabel, keyBytes: expectedKeyBytes },
    ]);
  });

  it('ignores delete events for unknown tables', async () => {
    const unknownTableId = '0x0000000000000000000000000000000000000000000000000000000000000001' as Hex;
    const keyTuple: Hex[] = ['0x000000000000000000000000000000000000000000000000000000000000002a'];
    const log = encodeDeleteLog(unknownTableId, keyTuple);
    const receipt = makeReceipt([log]);

    await applyReceiptToStore(receipt);

    expect(mockApplyBatch).not.toHaveBeenCalled();
  });

  it('decodes SetRecord events via applyBatch for UD-namespace tables', async () => {
    const keyTuple: Hex[] = ['0x000000000000000000000000000000000000000000000000000000000000002a'];
    const log = encodeSetRecordLog(testTableId, keyTuple);
    const receipt = makeReceipt([log]);

    await applyReceiptToStore(receipt);

    expect(mockLogToRecord).toHaveBeenCalled();
    const expectedKeyBytes = '0x' + keyTuple[0].slice(2);
    expect(mockApplyBatch).toHaveBeenCalledTimes(1);
    expect(mockApplyBatch).toHaveBeenCalledWith([
      { type: 'set', table: testTableLabel, keyBytes: expectedKeyBytes, data: { name: 'TestHero', level: '5' } },
    ]);
  });

  it('ignores SetRecord events for non-UD tables (handled by delta)', async () => {
    const unknownTableId = '0x0000000000000000000000000000000000000000000000000000000000000001' as Hex;
    const keyTuple: Hex[] = ['0x000000000000000000000000000000000000000000000000000000000000002a'];
    const log = encodeSetRecordLog(unknownTableId, keyTuple);
    const receipt = makeReceipt([log]);

    await applyReceiptToStore(receipt);

    expect(mockLogToRecord).not.toHaveBeenCalled();
    expect(mockApplyBatch).not.toHaveBeenCalled();
  });

  it('fires background delta fetch without blocking', async () => {
    const receipt = makeReceipt([], 42069n);

    await applyReceiptToStore(receipt);

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/delta?block=42069')
    );
  });

  it('does not throw when delta fetch fails', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'));
    const receipt = makeReceipt([], 100n);

    await expect(applyReceiptToStore(receipt)).resolves.not.toThrow();
  });

  it('batches both SetRecord and DeleteRecord from same receipt into a single applyBatch call', async () => {
    const setKeyTuple: Hex[] = ['0x0000000000000000000000000000000000000000000000000000000000000001'];
    const deleteKeyTuple: Hex[] = ['0x0000000000000000000000000000000000000000000000000000000000000002'];

    const setLog = encodeSetRecordLog(testTableId, setKeyTuple);
    const deleteLog = encodeDeleteLog(testTableId, deleteKeyTuple);
    const receipt = makeReceipt([setLog, deleteLog]);

    await applyReceiptToStore(receipt);

    expect(mockApplyBatch).toHaveBeenCalledTimes(1);
    const batchArg = mockApplyBatch.mock.calls[0][0];
    expect(batchArg).toHaveLength(2);
    expect(batchArg[0].type).toBe('set');
    expect(batchArg[1].type).toBe('delete');
  });

  it('handles logToRecord decode failure gracefully', async () => {
    mockLogToRecord.mockImplementationOnce(() => {
      throw new Error('Schema mismatch');
    });

    const keyTuple: Hex[] = ['0x000000000000000000000000000000000000000000000000000000000000002a'];
    const log = encodeSetRecordLog(testTableId, keyTuple);
    const receipt = makeReceipt([log]);

    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    await applyReceiptToStore(receipt);

    expect(mockApplyBatch).not.toHaveBeenCalled();
    expect(consoleSpy).toHaveBeenCalled();

    consoleSpy.mockRestore();
  });

  it('does not call setRow or deleteRow individually (all updates go through applyBatch)', async () => {
    const setKeyTuple: Hex[] = ['0x0000000000000000000000000000000000000000000000000000000000000001'];
    const deleteKeyTuple: Hex[] = ['0x0000000000000000000000000000000000000000000000000000000000000002'];

    const setLog = encodeSetRecordLog(testTableId, setKeyTuple);
    const deleteLog = encodeDeleteLog(testTableId, deleteKeyTuple);
    const receipt = makeReceipt([setLog, deleteLog]);

    await applyReceiptToStore(receipt);

    expect(mockSetRow).not.toHaveBeenCalled();
    expect(mockDeleteRow).not.toHaveBeenCalled();
    expect(mockApplyBatch).toHaveBeenCalledTimes(1);
  });

  it('handles multiple SetRecord logs atomically', async () => {
    const key1: Hex[] = ['0x0000000000000000000000000000000000000000000000000000000000000001'];
    const key2: Hex[] = ['0x0000000000000000000000000000000000000000000000000000000000000002'];
    const key3: Hex[] = ['0x0000000000000000000000000000000000000000000000000000000000000003'];

    const log1 = encodeSetRecordLog(testTableId, key1);
    const log2 = encodeSetRecordLog(testTableId, key2);
    const log3 = encodeSetRecordLog(testTableId, key3);
    const receipt = makeReceipt([log1, log2, log3]);

    await applyReceiptToStore(receipt);

    expect(mockApplyBatch).toHaveBeenCalledTimes(1);
    const batchArg = mockApplyBatch.mock.calls[0][0];
    expect(batchArg).toHaveLength(3);
    expect(batchArg.every((u: { type: string }) => u.type === 'set')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Splice integration tests
// ---------------------------------------------------------------------------
describe('applyReceiptToStore — splice integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTables = {};
    mockLogToRecord.mockReturnValue({ name: 'TestHero', level: '5' });
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ block: 100, tables: {} }),
    });
  });

  it('decodes SpliceStaticData synchronously when row exists in store (no RPC)', async () => {
    const keyTuple: Hex[] = ['0x000000000000000000000000000000000000000000000000000000000000002a'];
    const keyBytes = '0x' + keyTuple[0].slice(2);

    // Pre-populate store with existing row
    mockTables.Stats = {
      [keyBytes]: {
        strength: '10',
        agility: '8',
        class: 1,
        intelligence: '12',
        maxHp: '100',
        currentHp: '100',
        experience: '500',
        level: '5',
        powerSource: 2,
        race: 1,
        startingArmor: 3,
        advancedClass: 0,
        hasSelectedAdvancedClass: false,
      },
    };

    // Splice currentHp (offset 129, 32 bytes) to 75
    const newHpHex = '0x' + (75n).toString(16).padStart(64, '0');
    const log = encodeSpliceStaticLog(statsTableId, keyTuple, 129, newHpHex as Hex);
    const receipt = makeReceipt([log]);

    await applyReceiptToStore(receipt);

    // Should have applied synchronously via applyBatch
    expect(mockApplyBatch).toHaveBeenCalledTimes(1);
    const batchArg = mockApplyBatch.mock.calls[0][0];
    expect(batchArg).toHaveLength(1);
    expect(batchArg[0].type).toBe('set');
    expect(batchArg[0].table).toBe('Stats');
    expect(batchArg[0].data.currentHp).toBe('75');
    // Other fields preserved
    expect(batchArg[0].data.strength).toBe('10');
    expect(batchArg[0].data.maxHp).toBe('100');
  });

  it('falls back to RPC when row not in store', async () => {
    const keyTuple: Hex[] = ['0x000000000000000000000000000000000000000000000000000000000000002a'];

    const newHpHex = '0x' + (75n).toString(16).padStart(64, '0');
    const log = encodeSpliceStaticLog(statsTableId, keyTuple, 129, newHpHex as Hex);
    const receipt = makeReceipt([log]);

    // No publicClient provided, so RPC path won't execute but splice should be queued
    await applyReceiptToStore(receipt);

    // No sync decode happened, no batch (no RPC client to resolve)
    expect(mockApplyBatch).not.toHaveBeenCalled();
  });

  it('batches SetRecord + SpliceStaticData from same receipt into single batch', async () => {
    const keyTuple: Hex[] = ['0x000000000000000000000000000000000000000000000000000000000000002a'];
    const spliceKeyTuple: Hex[] = ['0x0000000000000000000000000000000000000000000000000000000000000099'];
    const spliceKeyBytes = '0x' + spliceKeyTuple[0].slice(2);

    // Pre-populate store for the splice target
    mockTables.Stats = {
      [spliceKeyBytes]: {
        strength: '10',
        agility: '8',
        class: 1,
        intelligence: '12',
        maxHp: '100',
        currentHp: '100',
        experience: '500',
        level: '5',
        powerSource: 2,
        race: 1,
        startingArmor: 3,
        advancedClass: 0,
        hasSelectedAdvancedClass: false,
      },
    };

    const setLog = encodeSetRecordLog(testTableId, keyTuple);
    const newHpHex = '0x' + (50n).toString(16).padStart(64, '0');
    const spliceLog = encodeSpliceStaticLog(statsTableId, spliceKeyTuple, 129, newHpHex as Hex);
    const receipt = makeReceipt([setLog, spliceLog]);

    await applyReceiptToStore(receipt);

    // Both updates in single batch
    expect(mockApplyBatch).toHaveBeenCalledTimes(1);
    const batchArg = mockApplyBatch.mock.calls[0][0];
    expect(batchArg).toHaveLength(2);
    expect(batchArg[0].type).toBe('set');
    expect(batchArg[0].table).toBe(testTableLabel);
    expect(batchArg[1].type).toBe('set');
    expect(batchArg[1].table).toBe('Stats');
    expect(batchArg[1].data.currentHp).toBe('50');
  });

  it('applies SetRecord immediately even when SpliceDynamic events are pending', async () => {
    const setKeyTuple: Hex[] = ['0x0000000000000000000000000000000000000000000000000000000000000001'];
    const spliceKeyTuple: Hex[] = ['0x0000000000000000000000000000000000000000000000000000000000000002'];

    const setLog = encodeSetRecordLog(testTableId, setKeyTuple);
    const spliceLog = encodeSpliceDynamicLog(statsTableId, spliceKeyTuple);
    const receipt = makeReceipt([setLog, spliceLog]);

    // Mock publicClient with delayed readContract
    let resolveRpc!: (value: [Hex, Hex, Hex]) => void;
    const rpcPromise = new Promise<[Hex, Hex, Hex]>((resolve) => { resolveRpc = resolve; });

    const mockPublicClient = {
      readContract: vi.fn().mockReturnValue(rpcPromise),
    } as unknown as PublicClient;

    const worldAddress = '0x0000000000000000000000000000000000000001' as Hex;

    await applyReceiptToStore(receipt, mockPublicClient, worldAddress);

    // Immediate batch applied with SetRecord only — not blocked by pending RPC
    expect(mockApplyBatch).toHaveBeenCalledTimes(1);
    const immediateBatch = mockApplyBatch.mock.calls[0][0];
    expect(immediateBatch).toHaveLength(1);
    expect(immediateBatch[0].type).toBe('set');
    expect(immediateBatch[0].table).toBe(testTableLabel);

    // Now resolve the RPC
    resolveRpc([
      '0x00' as Hex,
      '0x0000000000000000000000000000000000000000000000000000000000000000' as Hex,
      '0x00' as Hex,
    ]);

    // Flush promise chain
    await new Promise((resolve) => setTimeout(resolve, 0));

    // Second batch with deferred splice data
    expect(mockApplyBatch).toHaveBeenCalledTimes(2);
    const deferredBatch = mockApplyBatch.mock.calls[1][0];
    expect(deferredBatch).toHaveLength(1);
    expect(deferredBatch[0].type).toBe('set');
    expect(deferredBatch[0].table).toBe('Stats');
  });

  it('delta fetch skips UD-namespace tables to prevent stale overwrites', async () => {
    // Delta returns both a UD table (Paused) and a non-UD table (Gold)
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        block: 100,
        tables: {
          Paused: { '0xaa': { paused: false } },
          Gold: { '0xbb': { amount: '500' } },
        },
      }),
    });

    const receipt = makeReceipt([], 100n);
    await applyReceiptToStore(receipt);

    // Wait for delta fetch to resolve
    await new Promise((resolve) => setTimeout(resolve, 0));

    // applyBatch called once (delta), with only non-UD table
    expect(mockApplyBatch).toHaveBeenCalledTimes(1);
    const deltaArgs = mockApplyBatch.mock.calls[0][0];
    expect(deltaArgs).toHaveLength(1);
    expect(deltaArgs[0].table).toBe('Gold');
  });

  it('SpliceDynamicData still uses RPC fallback', async () => {
    const keyTuple: Hex[] = ['0x000000000000000000000000000000000000000000000000000000000000002a'];
    const keyBytes = '0x' + keyTuple[0].slice(2);

    // Even with row in store, dynamic splices go to RPC
    mockTables.Stats = {
      [keyBytes]: { strength: '10', currentHp: '100' },
    };

    const log = encodeSpliceDynamicLog(statsTableId, keyTuple);
    const receipt = makeReceipt([log]);

    // No publicClient → RPC won't execute, but it should NOT sync-decode
    await applyReceiptToStore(receipt);

    // No batch applied (dynamic splice with no RPC client)
    expect(mockApplyBatch).not.toHaveBeenCalled();
  });
});
