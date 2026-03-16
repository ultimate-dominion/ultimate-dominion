/**
 * Synchronous receipt-based store injection:
 *
 * 1. Decode Store_SetRecord + Store_DeleteRecord from receipt logs for
 *    UD-namespace tables (mudConfig).
 * 2. Resolve Store_SpliceStaticData/SpliceDynamicData by reading the full
 *    record from the chain via getRecord RPC (~100-300ms).
 * 3. Apply ALL decoded + splice-resolved data in a SINGLE atomic batch.
 *    This prevents multi-render jitter during movement.
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

import { useGameStore, type BatchUpdate } from './store';
import type { TableRow } from './types';

const INDEXER_API_URL = import.meta.env.VITE_INDEXER_API_URL || 'http://localhost:3001/api';

// ---------------------------------------------------------------------------
// Table registry: tableId (bytes32 hex) → table config (UD-namespace only)
// ---------------------------------------------------------------------------
type TableEntry = (typeof mudConfig.tables)[keyof typeof mudConfig.tables];

const tableRegistry = new Map<Hex, TableEntry>();
for (const table of Object.values(mudConfig.tables)) {
  tableRegistry.set(table.tableId as Hex, table as TableEntry);
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
): Promise<BatchUpdate[]> {
  // Deduplicate by table+keyBytes (a single tx can splice the same row multiple times)
  const unique = new Map<string, (typeof spliceReads)[0]>();
  for (const r of spliceReads) {
    unique.set(`${r.table.label}:${r.keyBytes}`, r);
  }

  const readRecord = async ({ table, keyTuple, keyBytes }: (typeof spliceReads)[0]) => {
    const [staticData, encodedLengths, dynamicData] =
      await publicClient.readContract({
        address: worldAddress,
        abi: getRecordAbi,
        functionName: 'getRecord',
        args: [table.tableId as Hex, [...keyTuple]],
      });

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
      // Batch all updates to avoid intermediate-state re-renders.
      const updates: BatchUpdate[] = [];
      for (const [tableName, rows] of Object.entries(delta.tables)) {
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

  // Collect splice events for async on-chain reads
  const spliceReads: {
    table: TableEntry;
    keyTuple: readonly Hex[];
    keyBytes: string;
  }[] = [];

  // Step 1: Decode SetRecord + DeleteRecord + collect splice reads from receipt logs.
  const batch: BatchUpdate[] = [];

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
        applied++;
      } catch (err) {
        console.warn(`[TX][RECEIPT] Failed to decode ${table.label}:`, err);
      }
    }

    if (
      decoded.eventName === 'Store_SpliceStaticData' ||
      decoded.eventName === 'Store_SpliceDynamicData'
    ) {
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

  // Step 2: Resolve splice events from chain (~100-300ms, awaited).
  // Collect into the same batch so everything applies in ONE store update.
  if (spliceReads.length > 0 && publicClient && worldAddress) {
    try {
      const spliceUpdates = await resolveSpliceEvents(spliceReads, publicClient, worldAddress);
      batch.push(...spliceUpdates);
    } catch (err) {
      console.warn('[TX][RECEIPT] Splice resolution failed:', err);
    }
  }

  // Step 3: Apply ALL updates (receipt + splices) in a single atomic batch.
  // One store update → one React render → no jitter.
  if (batch.length > 0) {
    useGameStore.getState().applyBatch(batch);
  }

  if (applied > 0 || skippedSplice > 0) {
    console.info(
      `[TX][RECEIPT] Applied ${batch.length} update(s) in single batch (${applied} from logs, ${skippedSplice} splice(s))`,
    );
  }

  // Step 4: Background delta fetch for non-UD namespace tables (fire-and-forget).
  // Gold, items, characters ERC modules, etc. — not critical for immediate UI.
  // WS delivers these as well, so delta is a faster-than-WS supplement.
  // The store's shallowEqual dedup prevents re-renders for duplicate data.
  fetchDeltaBackground(Number(receipt.blockNumber));
}
