/**
 * Synchronous receipt-based store injection:
 *
 * 1. Decode Store_SetRecord + Store_DeleteRecord from receipt logs for
 *    UD-namespace tables (mudConfig).
 * 2. Apply sync-decodable data (SetRecord, sync SpliceStaticData, DeleteRecord)
 *    immediately — no reason to block on RPC.
 * 3. Fire-and-forget resolution for deferred splices (SpliceDynamicData,
 *    SpliceStaticData that can't be sync-decoded). Applied when RPC resolves.
 * 4. Fire-and-forget delta fetch from the indexer to catch non-UD namespace
 *    tables (gold, items, characters ERC modules). WS is the backup.
 *
 * The store's applyBatch uses shallowEqual dedup, so when WS or delta
 * delivers the same data later, it's a no-op (no React re-render).
 */
import { storeEventsAbi } from '@latticexyz/store';
import { logToRecord } from '@latticexyz/store/internal';
import mudConfig from 'contracts/mud.config';
import {
  type Hex,
  type PublicClient,
  type TransactionReceipt,
  decodeEventLog,
} from 'viem';

import { useGameStore, markReceiptRows, isProtectedByNewerBlock, type BatchUpdate } from './store';
import type { TableRow } from './types';
import { buildStaticFieldLayout, applySplice } from './decodeSplice';

const INDEXER_API_URL = import.meta.env.VITE_INDEXER_API_URL || 'http://localhost:3001/api';

// ---------------------------------------------------------------------------
// Table registry: tableId (bytes32 hex) → table config (UD-namespace only)
// ---------------------------------------------------------------------------
type TableEntry = (typeof mudConfig.tables)[keyof typeof mudConfig.tables];

const tableRegistry = new Map<Hex, TableEntry>();
const udTableLabels = new Set<string>();
for (const table of Object.values(mudConfig.tables)) {
  tableRegistry.set(table.tableId as Hex, table as TableEntry);
  udTableLabels.add(table.label);
}

// ---------------------------------------------------------------------------
// ABI for reading full records from the World contract (splice resolution)
// ---------------------------------------------------------------------------
const getRecordAbi = [
  {
    type: 'function' as const,
    name: 'getRecord' as const,
    stateMutability: 'view' as const,
    inputs: [
      { name: 'tableId', type: 'bytes32' as const },
      { name: 'keyTuple', type: 'bytes32[]' as const },
    ],
    outputs: [
      { name: 'staticData', type: 'bytes' as const },
      { name: 'encodedLengths', type: 'bytes32' as const },
      { name: 'dynamicData', type: 'bytes' as const },
    ],
  },
] as const;

// ---------------------------------------------------------------------------
// Value serialization (match indexer's Postgres → JSON format)
// ---------------------------------------------------------------------------
function serializeValue(v: unknown): unknown {
  if (typeof v === 'bigint') return v.toString();
  if (Array.isArray(v)) return v.map(serializeValue);
  return v;
}

function serializeRecord(record: Record<string, unknown>): TableRow {
  const result: TableRow = {};
  for (const [key, value] of Object.entries(record)) {
    result[key] = serializeValue(value);
  }
  return result;
}

// ---------------------------------------------------------------------------
// Async splice resolution: read full records from chain → returns updates
// ---------------------------------------------------------------------------
async function resolveSpliceEvents(
  spliceReads: { table: TableEntry; keyTuple: readonly Hex[]; keyBytes: string }[],
  publicClient: PublicClient,
  worldAddress: Hex,
  blockNumber: bigint,
): Promise<BatchUpdate[]> {
  // Deduplicate by table+keyBytes (a single tx can splice the same row multiple times)
  const unique = new Map<string, (typeof spliceReads)[0]>();
  for (const r of spliceReads) {
    unique.set(`${r.table.label}:${r.keyBytes}`, r);
  }

  const readRecord = async ({ table, keyTuple, keyBytes }: (typeof spliceReads)[0]) => {
    let staticData: Hex, encodedLengths: Hex, dynamicData: Hex;
    try {
      // Pin to receipt block to get post-tx state, not stale RPC `latest`
      [staticData, encodedLengths, dynamicData] =
        await publicClient.readContract({
          address: worldAddress,
          abi: getRecordAbi,
          functionName: 'getRecord',
          args: [table.tableId as Hex, [...keyTuple]],
          blockNumber,
        });
    } catch {
      // Fallback to `latest` if RPC doesn't support eth_call at specific block
      [staticData, encodedLengths, dynamicData] =
        await publicClient.readContract({
          address: worldAddress,
          abi: getRecordAbi,
          functionName: 'getRecord',
          args: [table.tableId as Hex, [...keyTuple]],
        });
    }

    const record = logToRecord({
      table: table as { schema: typeof table.schema; key: typeof table.key },
      log: {
        args: {
          tableId: table.tableId as Hex,
          keyTuple: [...keyTuple],
          staticData,
          encodedLengths,
          dynamicData,
        },
      },
    });

    const serialized = serializeRecord(record as Record<string, unknown>);
    return { table: table.label, keyBytes, data: serialized };
  };

  const entries = [...unique.values()];
  const results = await Promise.allSettled(entries.map(readRecord));

  const batch: BatchUpdate[] = [];
  for (const r of results) {
    if (r.status === 'fulfilled') {
      batch.push({ type: 'set', table: r.value.table, keyBytes: r.value.keyBytes, data: r.value.data });
    } else {
      console.warn('[TX][RECEIPT] Splice read failed:', r.reason);
    }
  }
  return batch;
}

// ---------------------------------------------------------------------------
// Background delta fetch for non-UD namespace tables
// ---------------------------------------------------------------------------
const DELTA_MAX_ATTEMPTS = 4;
const DELTA_POLL_INTERVAL = 500; // ms

type DeltaResponse = {
  block: number;
  tables: Record<string, Record<string, Record<string, unknown>>>;
};

function fetchDeltaBackground(blockNumber: number): void {
  const url = `${INDEXER_API_URL}/delta?block=${blockNumber}`;

  const attempt = async (n: number) => {
    try {
      const response = await fetch(url);
      if (!response.ok) return;

      const delta: DeltaResponse = await response.json();
      if (delta.block < blockNumber) {
        if (n < DELTA_MAX_ATTEMPTS - 1) {
          setTimeout(() => attempt(n + 1), DELTA_POLL_INTERVAL);
        }
        return;
      }

      // Apply non-UD tables only — UD tables already injected from receipt.
      // Previous move deltas can resolve after newer receipts, so applying
      // UD tables here would overwrite fresh Position data with stale values.
      const updates: BatchUpdate[] = [];
      for (const [tableName, rows] of Object.entries(delta.tables)) {
        if (udTableLabels.has(tableName)) continue;
        for (const [keyBytes, rowData] of Object.entries(rows)) {
          updates.push({ type: 'set', table: tableName, keyBytes, data: rowData as Record<string, unknown> });
        }
      }
      if (updates.length > 0) {
        useGameStore.getState().applyBatch(updates);
        console.info(`[TX][DELTA] Applied ${updates.length} update(s) from indexer delta at block ${delta.block}`);
      }
    } catch {
      if (n < DELTA_MAX_ATTEMPTS - 1) {
        setTimeout(() => attempt(n + 1), DELTA_POLL_INTERVAL);
      }
    }
  };

  attempt(0);
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------
export async function applyReceiptToStore(
  receipt: TransactionReceipt,
  publicClient?: PublicClient,
  worldAddress?: Hex,
): Promise<void> {
  let applied = 0;
  let skippedSplice = 0;
  let spliceSyncCount = 0;

  // Collect splice events for async on-chain reads
  const spliceReads: {
    table: TableEntry;
    keyTuple: readonly Hex[];
    keyBytes: string;
  }[] = [];

  // Step 1: Decode SetRecord + DeleteRecord + collect splice reads from receipt logs.
  // pendingRecords tracks SetRecord data from this receipt so that SpliceStaticData
  // events for newly-created rows can be decoded synchronously instead of falling
  // back to an async RPC read (which races with subsequent transactions).
  const batch: BatchUpdate[] = [];
  const pendingRecords = new Map<string, TableRow>(); // `table:keyBytes` → row data

  for (const log of receipt.logs) {
    let decoded;
    try {
      decoded = decodeEventLog({
        abi: storeEventsAbi,
        data: log.data,
        topics: log.topics as [Hex, ...Hex[]],
      });
    } catch {
      continue;
    }

    if (decoded.eventName === 'Store_SetRecord') {
      const { tableId, keyTuple } = decoded.args;
      const table = tableRegistry.get(tableId as Hex);
      if (!table) continue; // Non-UD table — handled by delta

      try {
        const record = logToRecord({
          table: table as { schema: typeof table.schema; key: typeof table.key },
          log: { args: decoded.args },
        });

        const keyBytes = '0x' + keyTuple.map((k: Hex) => k.slice(2)).join('');
        const serialized = serializeRecord(record as Record<string, unknown>);
        batch.push({ type: 'set', table: table.label, keyBytes, data: serialized });
        pendingRecords.set(`${table.label}:${keyBytes}`, serialized);
        applied++;
      } catch (err) {
        console.warn(`[TX][RECEIPT] Failed to decode ${table.label}:`, err);
      }
    }

    if (decoded.eventName === 'Store_SpliceStaticData') {
      const { tableId, keyTuple, start, data } = decoded.args as {
        tableId: Hex;
        keyTuple: readonly Hex[];
        start: number | bigint;
        data: Hex;
      };
      const table = tableRegistry.get(tableId);
      if (table) {
        const keyBytes = '0x' + keyTuple.map((k: Hex) => k.slice(2)).join('');
        // Check store first, then pending SetRecord data from this receipt
        const existingRow = useGameStore.getState().tables[table.label]?.[keyBytes]
          ?? pendingRecords.get(`${table.label}:${keyBytes}`);

        if (existingRow) {
          const layout = buildStaticFieldLayout(
            table as { tableId: string; key: readonly string[]; schema: Record<string, { type: string; internalType: string }> },
          );
          const merged = applySplice(layout, existingRow, Number(start), data);

          if (merged) {
            batch.push({ type: 'set', table: table.label, keyBytes, data: merged });
            // Update pending so subsequent splices on the same row build on this result
            pendingRecords.set(`${table.label}:${keyBytes}`, merged);
            spliceSyncCount++;
          } else {
            // Partial field coverage — fall back to RPC
            spliceReads.push({ table, keyTuple, keyBytes });
            skippedSplice++;
          }
        } else {
          // Row not in store yet and no pending SetRecord — fall back to RPC
          spliceReads.push({ table, keyTuple, keyBytes });
          skippedSplice++;
        }
      }
    }

    if (decoded.eventName === 'Store_SpliceDynamicData') {
      const { tableId, keyTuple } = decoded.args;
      const table = tableRegistry.get(tableId as Hex);
      if (table) {
        const keyBytes = '0x' + keyTuple.map((k: Hex) => k.slice(2)).join('');
        spliceReads.push({
          table,
          keyTuple: keyTuple as readonly Hex[],
          keyBytes,
        });
        skippedSplice++;
      }
    }

    if (decoded.eventName === 'Store_DeleteRecord') {
      const { tableId, keyTuple } = decoded.args;
      const table = tableRegistry.get(tableId as Hex);
      if (!table) continue;

      const keyBytes = '0x' + keyTuple.map((k: Hex) => k.slice(2)).join('');
      batch.push({ type: 'delete', table: table.label, keyBytes });
      applied++;
    }
  }

  // Step 2: Apply immediate batch (SetRecord, sync SpliceStaticData, DeleteRecord).
  // These are decodable in <1ms — no reason to block on RPC.
  if (batch.length > 0) {
    useGameStore.getState().applyBatch(batch);
    // Protect these rows from stale WS overwrites — WS lags behind receipts
    // and can deliver intermediate Position values that snap the UI back.
    markReceiptRows(
      batch.filter(u => u.type === 'set').map(u => ({ table: u.table, keyBytes: u.keyBytes })),
      Number(receipt.blockNumber),
    );
  }

  // Step 3: Fire-and-forget splice resolution for deferred events (SpliceDynamicData,
  // SpliceStaticData that couldn't be sync-decoded). Applied when RPC resolves.
  //
  // getRecord is pinned to the receipt's block number, so it returns post-tx state.
  // The only guard needed is cross-receipt races: skip rows protected by a newer receipt.
  // Same-row overlap with the immediate batch is safe — the block-pinned read returns
  // the full post-tx state (including dynamic fields the immediate batch couldn't decode).
  if (spliceReads.length > 0 && publicClient && worldAddress) {
    const receiptBlock = Number(receipt.blockNumber);
    resolveSpliceEvents(spliceReads, publicClient, worldAddress, receipt.blockNumber)
      .then((spliceUpdates) => {
        const freshUpdates = spliceUpdates.filter(u => {
          if (isProtectedByNewerBlock(u.table, u.keyBytes, receiptBlock)) return false;
          return true;
        });
        const skipped = spliceUpdates.length - freshUpdates.length;

        if (freshUpdates.length > 0) {
          useGameStore.getState().applyBatch(freshUpdates);
          markReceiptRows(
            freshUpdates.map(u => ({ table: u.table, keyBytes: u.keyBytes })),
            receiptBlock,
          );
          console.info(`[TX][RECEIPT] Deferred splice batch: ${freshUpdates.length} update(s)`);
        }
        if (skipped > 0) {
          console.info(`[TX][RECEIPT] Deferred splice: skipped ${skipped} update(s) (superseded by newer receipt)`);
        }
      })
      .catch((err) => {
        console.warn('[TX][RECEIPT] Splice resolution failed:', err);
      });
  }

  if (applied > 0 || skippedSplice > 0 || spliceSyncCount > 0) {
    console.info(
      `[TX][RECEIPT] Immediate batch: ${batch.length} update(s) (${applied} from logs, ${spliceSyncCount} splice-sync), deferred: ${skippedSplice} splice-async`,
    );
  }

  // Step 4: Background delta fetch for non-UD namespace tables (fire-and-forget).
  // Gold, items, characters ERC modules, etc. — not critical for immediate UI.
  // WS delivers these as well, so delta is a faster-than-WS supplement.
  // The store's shallowEqual dedup prevents re-renders for duplicate data.
  fetchDeltaBackground(Number(receipt.blockNumber));
}
