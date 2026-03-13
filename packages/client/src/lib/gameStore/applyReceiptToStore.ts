/**
 * Hybrid receipt-based store injection:
 *
 * 1. Decode Store_SetRecord + Store_DeleteRecord from receipt logs for
 *    UD-namespace tables (mudConfig) → instant (~0ms) store updates.
 * 2. Resolve Store_SpliceStaticData/SpliceDynamicData by reading the full
 *    record from the chain via getRecord RPC (~100-300ms).
 * 3. Fire-and-forget delta fetch from the indexer to catch non-UD namespace
 *    tables (gold, items, characters ERC modules). Not awaited — WS is the
 *    backup if delta fails.
 *
 * This gives instant UI updates for all critical game state (position,
 * encounters, combat, stats) while still covering ERC module tables via
 * the indexer. WebSocket delivers all updates as idempotent overwrites.
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

import { useGameStore } from './store';
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
// Async splice resolution: read full records from chain
// ---------------------------------------------------------------------------
async function resolveSpliceEvents(
  spliceReads: { table: TableEntry; keyTuple: readonly Hex[]; keyBytes: string }[],
  publicClient: PublicClient,
  worldAddress: Hex,
): Promise<void> {
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
    useGameStore.getState().setRow(table.label, keyBytes, serialized);
    return table.label;
  };

  const entries = [...unique.values()];
  const results = await Promise.allSettled(entries.map(readRecord));

  const resolved = results.filter(r => r.status === 'fulfilled');
  if (resolved.length > 0) {
    console.info(
      `[TX][RECEIPT] Resolved ${resolved.length} splice(s): ${resolved.map(r => (r as PromiseFulfilledResult<string>).value).join(', ')}`,
    );
  }

  for (const f of results.filter(r => r.status === 'rejected')) {
    console.warn('[TX][RECEIPT] Splice read failed:', (f as PromiseRejectedResult).reason);
  }
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

      // Apply non-UD tables only — UD tables already injected from receipt
      const store = useGameStore.getState();
      let count = 0;
      for (const [tableName, rows] of Object.entries(delta.tables)) {
        for (const [keyBytes, rowData] of Object.entries(rows)) {
          store.setRow(tableName, keyBytes, rowData as Record<string, unknown>);
          count++;
        }
      }
      if (count > 0) {
        console.info(`[TX][DELTA] Applied ${count} update(s) from indexer delta at block ${delta.block}`);
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

  // Step 1: Decode SetRecord + DeleteRecord from receipt logs (instant)
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
        useGameStore.getState().setRow(table.label, keyBytes, serialized);
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
      useGameStore.getState().deleteRow(table.label, keyBytes);
      applied++;
    }
  }

  if (applied > 0 || skippedSplice > 0) {
    console.info(
      `[TX][RECEIPT] Injected ${applied} update(s) from receipt logs (${skippedSplice} splice(s) resolving...)`,
    );
  }

  // Step 2: Resolve splice events from chain (~100-300ms, awaited)
  if (spliceReads.length > 0 && publicClient && worldAddress) {
    await resolveSpliceEvents(spliceReads, publicClient, worldAddress).catch(err => {
      console.warn('[TX][RECEIPT] Splice resolution failed:', err);
    });
  }

  // Step 3: Background delta fetch for non-UD namespace tables (fire-and-forget).
  // Gold, items, characters ERC modules, etc. — not critical for immediate UI.
  // WS delivers these as well, so delta is a faster-than-WS supplement.
  fetchDeltaBackground(Number(receipt.blockNumber));
}
