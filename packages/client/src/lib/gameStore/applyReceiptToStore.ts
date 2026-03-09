/**
 * Receipt Log Injection — parse MUD Store events from a transaction receipt
 * and inject decoded rows directly into the Zustand store.
 *
 * This gives ~0ms state updates after receipt (vs 5-15s waiting for
 * indexer → Postgres → WebSocket). The WebSocket update arrives later
 * as an idempotent overwrite.
 *
 * SetRecord/DeleteRecord events are handled synchronously.
 * SpliceStaticData/SpliceDynamicData events trigger an async on-chain
 * read of the full record, then inject the result into the store.
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

// ---------------------------------------------------------------------------
// Table registry: tableId (bytes32 hex) → table config
// ---------------------------------------------------------------------------
type TableEntry = (typeof mudConfig.tables)[keyof typeof mudConfig.tables];

const tableRegistry = new Map<Hex, TableEntry>();
for (const table of Object.values(mudConfig.tables)) {
  tableRegistry.set(table.tableId as Hex, table as TableEntry);
}

// ---------------------------------------------------------------------------
// ABI for reading full records from the World contract
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
// Async splice resolution: read full records from chain for splice events
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
    console.debug(`[TX][RECEIPT] splice setRow: ${table.label} key=${keyBytes}`, serialized);
    useGameStore.getState().setRow(table.label, keyBytes, serialized);
    return table.label;
  };

  const entries = [...unique.values()];
  const results = await Promise.allSettled(entries.map(readRecord));

  const resolved = results.filter(r => r.status === 'fulfilled');
  if (resolved.length > 0) {
    console.info(
      `[TX][RECEIPT] Resolved ${resolved.length} splice record(s) from chain: ${resolved.map(r => (r as PromiseFulfilledResult<string>).value).join(', ')}`,
    );
  }

  const failed = results.filter(r => r.status === 'rejected');
  for (const f of failed) {
    console.warn(
      '[TX][RECEIPT] Splice read failed:',
      (f as PromiseRejectedResult).reason,
    );
  }
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

  for (const log of receipt.logs) {
    let decoded;
    try {
      decoded = decodeEventLog({
        abi: storeEventsAbi,
        data: log.data,
        topics: log.topics as [Hex, ...Hex[]],
      });
    } catch {
      // Not a MUD Store event — skip
      continue;
    }

    if (decoded.eventName === 'Store_SetRecord') {
      const { tableId, keyTuple } = decoded.args;
      const table = tableRegistry.get(tableId as Hex);
      if (!table) continue;

      try {
        const record = logToRecord({
          table: table as { schema: typeof table.schema; key: typeof table.key },
          log: { args: decoded.args },
        });

        const keyBytes = ('0x' +
          keyTuple.map((k: Hex) => k.slice(2)).join('')) as string;
        const serialized = serializeRecord(
          record as Record<string, unknown>,
        );

        useGameStore.getState().setRow(table.label, keyBytes, serialized);
        applied++;
      } catch (err) {
        console.warn(
          `[TX][RECEIPT] Failed to decode record for ${table.label}:`,
          err,
        );
      }
    }

    if (
      decoded.eventName === 'Store_SpliceStaticData' ||
      decoded.eventName === 'Store_SpliceDynamicData'
    ) {
      const { tableId, keyTuple } = decoded.args;
      const table = tableRegistry.get(tableId as Hex);
      if (table) {
        const keyBytes = ('0x' +
          keyTuple.map((k: Hex) => k.slice(2)).join('')) as string;
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

      const keyBytes = ('0x' +
        keyTuple.map((k: Hex) => k.slice(2)).join('')) as string;
      useGameStore.getState().deleteRow(table.label, keyBytes);
      applied++;
    }
  }

  if (applied > 0 || skippedSplice > 0) {
    console.info(
      `[TX][RECEIPT] Injected ${applied} store update(s) from receipt logs (${skippedSplice} splice event(s) resolving from chain...)`,
    );
  }

  // Await splice resolution so the store is fully up-to-date when the caller
  // gets the receipt back. Adds ~100-300ms (parallel getRecord RPCs) but
  // prevents stale-data bugs (HP not updating, double-attack, etc).
  if (spliceReads.length > 0 && publicClient && worldAddress) {
    await resolveSpliceEvents(spliceReads, publicClient, worldAddress).catch(err => {
      console.warn('[TX][RECEIPT] Splice resolution failed:', err);
    });
  }
}
