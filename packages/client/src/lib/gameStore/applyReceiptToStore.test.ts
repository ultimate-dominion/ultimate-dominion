import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { type Hex, type TransactionReceipt, keccak256, encodeAbiParameters, toHex } from 'viem';
import mudConfig from 'contracts/mud.config';

// Track store calls
const mockSetRow = vi.fn();
const mockDeleteRow = vi.fn();
const mockApplyBatch = vi.fn();

vi.mock('./store', () => ({
  useGameStore: {
    getState: () => ({
      setRow: mockSetRow,
      deleteRow: mockDeleteRow,
      applyBatch: mockApplyBatch,
    }),
  },
}));

// Mock logToRecord — returns a simple decoded record
const mockLogToRecord = vi.fn().mockReturnValue({ name: 'TestHero', level: '5' });
vi.mock('@latticexyz/store/internal', () => ({
  logToRecord: (...args: unknown[]) => mockLogToRecord(...args),
}));

// Mock fetch for background delta
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

import { applyReceiptToStore } from './applyReceiptToStore';

// Helper: pick a known UD-namespace table from mudConfig
const testTable = Object.values(mudConfig.tables)[0];
const testTableId = testTable.tableId as Hex;
const testTableLabel = testTable.label;

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

// Store_DeleteRecord(bytes32 indexed tableId, bytes32[] keyTuple)
const DELETE_EVENT_SIG = keccak256(toHex('Store_DeleteRecord(bytes32,bytes32[])'));

// Store_SetRecord(bytes32 indexed tableId, bytes32[] keyTuple, bytes staticData, bytes32 encodedLengths, bytes dynamicData)
const SET_RECORD_EVENT_SIG = keccak256(toHex('Store_SetRecord(bytes32,bytes32[],bytes,bytes32,bytes)'));

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

describe('applyReceiptToStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset logToRecord mock to return a decodable record
    mockLogToRecord.mockReturnValue({ name: 'TestHero', level: '5' });
    // Default: delta fetch succeeds but returns empty (fire-and-forget, not awaited)
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

    // logToRecord was called to decode the record
    expect(mockLogToRecord).toHaveBeenCalled();
    // applyBatch was called with the serialized result
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

    // Delta fetch was initiated
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/delta?block=42069')
    );
  });

  it('does not throw when delta fetch fails', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'));
    const receipt = makeReceipt([], 100n);

    // Should not throw — delta is fire-and-forget
    await expect(applyReceiptToStore(receipt)).resolves.not.toThrow();
  });

  it('batches both SetRecord and DeleteRecord from same receipt into a single applyBatch call', async () => {
    const setKeyTuple: Hex[] = ['0x0000000000000000000000000000000000000000000000000000000000000001'];
    const deleteKeyTuple: Hex[] = ['0x0000000000000000000000000000000000000000000000000000000000000002'];

    const setLog = encodeSetRecordLog(testTableId, setKeyTuple);
    const deleteLog = encodeDeleteLog(testTableId, deleteKeyTuple);
    const receipt = makeReceipt([setLog, deleteLog]);

    await applyReceiptToStore(receipt);

    // Both updates in a single applyBatch call — no intermediate states
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

    // Should not throw, batch should be empty (no valid updates)
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

    // Individual setRow/deleteRow should never be called from receipt processing
    expect(mockSetRow).not.toHaveBeenCalled();
    expect(mockDeleteRow).not.toHaveBeenCalled();
    // Only applyBatch should be used
    expect(mockApplyBatch).toHaveBeenCalledTimes(1);
  });

  it('handles multiple SetRecord logs atomically', async () => {
    // Simulate a move TX with multiple table updates (Position, Spawned, Stats)
    const key1: Hex[] = ['0x0000000000000000000000000000000000000000000000000000000000000001'];
    const key2: Hex[] = ['0x0000000000000000000000000000000000000000000000000000000000000002'];
    const key3: Hex[] = ['0x0000000000000000000000000000000000000000000000000000000000000003'];

    const log1 = encodeSetRecordLog(testTableId, key1);
    const log2 = encodeSetRecordLog(testTableId, key2);
    const log3 = encodeSetRecordLog(testTableId, key3);
    const receipt = makeReceipt([log1, log2, log3]);

    await applyReceiptToStore(receipt);

    // All 3 updates in a single batch — no intermediate renders
    expect(mockApplyBatch).toHaveBeenCalledTimes(1);
    const batchArg = mockApplyBatch.mock.calls[0][0];
    expect(batchArg).toHaveLength(3);
    expect(batchArg.every((u: { type: string }) => u.type === 'set')).toBe(true);
  });
});
