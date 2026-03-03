/**
 * Receipt Log Injection — parse MUD Store events from a transaction receipt
 * and inject decoded rows directly into the Zustand store.
 *
 * This gives ~0ms state updates after receipt (vs 5-15s waiting for
 * indexer → Postgres → WebSocket). The WebSocket update arrives later
 * as an idempotent overwrite.
 *
 * Only handles Store_SetRecord and Store_DeleteRecord. Splice events
 * (partial field updates) are rare and fall back to WebSocket delivery.
 */
import { storeEventsAbi } from '@latticexyz/store';
import { logToRecord } from '@latticexyz/store/internal';
import mudConfig from 'contracts/mud.config';
import { type Hex, type TransactionReceipt, decodeEventLog } from 'viem';

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
// Main entry point
// ---------------------------------------------------------------------------
export function applyReceiptToStore(receipt: TransactionReceipt): void {
  let applied = 0;

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

        const keyBytes = ('0x' + keyTuple.map((k: Hex) => k.slice(2)).join('')) as string;
        const serialized = serializeRecord(record as Record<string, unknown>);

        useGameStore.getState().setRow(table.label, keyBytes, serialized);
        applied++;
      } catch {
        // Schema decode failure — fall back to WebSocket delivery
        continue;
      }
    }

    if (decoded.eventName === 'Store_DeleteRecord') {
      const { tableId, keyTuple } = decoded.args;
      const table = tableRegistry.get(tableId as Hex);
      if (!table) continue;

      const keyBytes = ('0x' + keyTuple.map((k: Hex) => k.slice(2)).join('')) as string;
      useGameStore.getState().deleteRow(table.label, keyBytes);
      applied++;
    }
  }

  if (applied > 0) {
    console.info(`[TX][RECEIPT] Injected ${applied} store update(s) from receipt logs`);
  }
}
