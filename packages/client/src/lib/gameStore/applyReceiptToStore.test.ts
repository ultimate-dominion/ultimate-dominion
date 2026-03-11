import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { type Hex, type TransactionReceipt, keccak256, encodeAbiParameters, toHex } from 'viem';
import mudConfig from 'contracts/mud.config';

// Track store calls
const mockSetRow = vi.fn();
const mockDeleteRow = vi.fn();

vi.mock('./store', () => ({
  useGameStore: {
    getState: () => ({
      setRow: mockSetRow,
      deleteRow: mockDeleteRow,
    }),
  },
}));

// Mock fetch for delta endpoint
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

import { applyReceiptToStore } from './applyReceiptToStore';

// Helper: pick a known UD-namespace table from mudConfig for delete tests
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
// tableId is indexed → goes in topics[1], keyTuple → ABI-encoded in data
const DELETE_EVENT_SIG = keccak256(toHex('Store_DeleteRecord(bytes32,bytes32[])'));

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

// Helper: make a delta response
function makeDeltaResponse(block: number, tables: Record<string, Record<string, Record<string, unknown>>>) {
  return {
    ok: true,
    json: () => Promise.resolve({ block, tables }),
  };
}

describe('applyReceiptToStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('applies delete events from receipt logs for known tables', async () => {
    const keyTuple: Hex[] = ['0x000000000000000000000000000000000000000000000000000000000000002a'];
    const log = encodeDeleteLog(testTableId, keyTuple);
    const receipt = makeReceipt([log]);

    // Delta returns no updates
    mockFetch.mockResolvedValueOnce(makeDeltaResponse(100, {}));

    await applyReceiptToStore(receipt);

    const expectedKeyBytes = '0x' + keyTuple[0].slice(2);
    expect(mockDeleteRow).toHaveBeenCalledWith(testTableLabel, expectedKeyBytes);
  });

  it('ignores delete events for unknown tables', async () => {
    const unknownTableId = '0x0000000000000000000000000000000000000000000000000000000000000001' as Hex;
    const keyTuple: Hex[] = ['0x000000000000000000000000000000000000000000000000000000000000002a'];
    const log = encodeDeleteLog(unknownTableId, keyTuple);
    const receipt = makeReceipt([log]);

    mockFetch.mockResolvedValueOnce(makeDeltaResponse(100, {}));

    await applyReceiptToStore(receipt);

    expect(mockDeleteRow).not.toHaveBeenCalled();
  });

  it('fetches delta from indexer and applies updates to store', async () => {
    const receipt = makeReceipt([], 100n);

    mockFetch.mockResolvedValueOnce(makeDeltaResponse(100, {
      Characters: {
        '0xabc': { name: 'Hero', level: 5 },
      },
      GoldBalances: {
        '0xdef': { value: '1000' },
      },
    }));

    await applyReceiptToStore(receipt);

    expect(mockSetRow).toHaveBeenCalledWith('Characters', '0xabc', { name: 'Hero', level: 5 });
    expect(mockSetRow).toHaveBeenCalledWith('GoldBalances', '0xdef', { value: '1000' });
    expect(mockSetRow).toHaveBeenCalledTimes(2);
  });

  it('retries delta fetch when indexer has not caught up', async () => {
    const receipt = makeReceipt([], 100n);

    // First attempt: indexer at block 99 (not caught up)
    mockFetch.mockResolvedValueOnce(makeDeltaResponse(99, {}));
    // Second attempt: indexer at block 100 (caught up)
    mockFetch.mockResolvedValueOnce(makeDeltaResponse(100, {
      Characters: { '0xabc': { name: 'Hero' } },
    }));

    await applyReceiptToStore(receipt);

    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(mockSetRow).toHaveBeenCalledWith('Characters', '0xabc', { name: 'Hero' });
  });

  it('handles delta fetch failure gracefully', async () => {
    const receipt = makeReceipt([], 100n);

    // All attempts fail
    mockFetch.mockRejectedValue(new Error('Network error'));

    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    await applyReceiptToStore(receipt);

    // Should not throw, should not set any rows
    expect(mockSetRow).not.toHaveBeenCalled();

    consoleSpy.mockRestore();
  });

  it('processes both deletes and delta updates in one receipt', async () => {
    const keyTuple: Hex[] = ['0x000000000000000000000000000000000000000000000000000000000000002a'];
    const deleteLog = encodeDeleteLog(testTableId, keyTuple);
    const receipt = makeReceipt([deleteLog], 100n);

    mockFetch.mockResolvedValueOnce(makeDeltaResponse(100, {
      GoldBalances: { '0xdef': { value: '500' } },
    }));

    await applyReceiptToStore(receipt);

    // Delete was applied
    expect(mockDeleteRow).toHaveBeenCalledTimes(1);
    // Delta update was applied
    expect(mockSetRow).toHaveBeenCalledWith('GoldBalances', '0xdef', { value: '500' });
  });

  it('calls delta endpoint with correct block number', async () => {
    const receipt = makeReceipt([], 42069n);

    mockFetch.mockResolvedValueOnce(makeDeltaResponse(42069, {}));

    await applyReceiptToStore(receipt);

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/delta?block=42069')
    );
  });
});
