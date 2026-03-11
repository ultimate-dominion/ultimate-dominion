/**
 * Receipt-based store injection: handles deletes from receipt logs,
 * then fetches all updates (SetRecord + Splice, ALL namespaces) from
 * the indexer's /api/delta endpoint.
 *
 * This replaces the old local log decoding which only covered UD-namespace
 * tables (mudConfig.tables). The delta approach covers all namespaces
 * (gold, items, characters, fragments, badges) without maintaining a
 * client-side table registry.
 */
import { storeEventsAbi } from '@latticexyz/store';
import mudConfig from 'contracts/mud.config';
import {
  type Hex,
  type TransactionReceipt,
  decodeEventLog,
} from 'viem';

import { useGameStore } from './store';

const INDEXER_API_URL = import.meta.env.VITE_INDEXER_API_URL || 'http://localhost:3001/api';

// ---------------------------------------------------------------------------
// Table registry for delete handling only (UD-namespace tables from mudConfig)
// ---------------------------------------------------------------------------
type TableEntry = (typeof mudConfig.tables)[keyof typeof mudConfig.tables];

const tableRegistry = new Map<Hex, TableEntry>();
for (const table of Object.values(mudConfig.tables)) {
  tableRegistry.set(table.tableId as Hex, table as TableEntry);
}

// ---------------------------------------------------------------------------
// Delta fetch with polling for indexer catchup
// ---------------------------------------------------------------------------
const DELTA_MAX_ATTEMPTS = 6;
const DELTA_POLL_INTERVAL = 500; // ms

type DeltaResponse = {
  block: number;
  tables: Record<string, Record<string, Record<string, unknown>>>;
};

async function fetchDelta(sinceBlock: number): Promise<DeltaResponse> {
  const response = await fetch(`${INDEXER_API_URL}/delta?block=${sinceBlock}`);
  if (!response.ok) {
    throw new Error(`Delta fetch failed: ${response.status}`);
  }
  return response.json();
}

/**
 * Poll the delta endpoint until the indexer has processed at least `targetBlock`.
 * Returns all rows updated since `sinceBlock`.
 */
async function fetchDeltaWithRetry(
  sinceBlock: number,
  targetBlock: number,
): Promise<DeltaResponse | null> {
  for (let attempt = 0; attempt < DELTA_MAX_ATTEMPTS; attempt++) {
    try {
      const delta = await fetchDelta(sinceBlock);

      if (delta.block >= targetBlock) {
        return delta;
      }

      // Indexer hasn't caught up yet — wait and retry
      if (attempt < DELTA_MAX_ATTEMPTS - 1) {
        await new Promise(r => setTimeout(r, DELTA_POLL_INTERVAL));
      }
    } catch (err) {
      console.warn(`[TX][DELTA] Fetch attempt ${attempt + 1} failed:`, err);
      if (attempt < DELTA_MAX_ATTEMPTS - 1) {
        await new Promise(r => setTimeout(r, DELTA_POLL_INTERVAL));
      }
    }
  }

  console.warn(
    `[TX][DELTA] Indexer did not reach block ${targetBlock} after ${DELTA_MAX_ATTEMPTS} attempts`
  );
  return null;
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------
export async function applyReceiptToStore(
  receipt: TransactionReceipt,
): Promise<void> {
  const store = useGameStore.getState();

  // Step 1: Process deletes from receipt logs immediately.
  // Delete events are fast to decode and only need the UD-namespace registry.
  // Non-UD deletes are rare (ERC token burns) and handled by WS.
  let deleteCount = 0;
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

    if (decoded.eventName === 'Store_DeleteRecord') {
      const { tableId, keyTuple } = decoded.args;
      const table = tableRegistry.get(tableId as Hex);
      if (!table) continue;

      const keyBytes = '0x' + keyTuple.map((k: Hex) => k.slice(2)).join('');
      store.deleteRow(table.label, keyBytes);
      deleteCount++;
    }
  }

  if (deleteCount > 0) {
    console.info(`[TX][RECEIPT] Applied ${deleteCount} delete(s) from receipt logs`);
  }

  // Step 2: Fetch all updated rows from indexer (covers ALL namespaces).
  const blockNumber = Number(receipt.blockNumber);
  const delta = await fetchDeltaWithRetry(blockNumber, blockNumber);

  if (!delta) {
    console.warn('[TX][DELTA] No delta received — updates will arrive via WebSocket');
    return;
  }

  let updateCount = 0;
  for (const [tableName, rows] of Object.entries(delta.tables)) {
    for (const [keyBytes, rowData] of Object.entries(rows)) {
      store.setRow(tableName, keyBytes, rowData as Record<string, unknown>);
      updateCount++;
    }
  }

  if (updateCount > 0) {
    console.info(
      `[TX][DELTA] Applied ${updateCount} update(s) from indexer delta at block ${delta.block}`
    );
  }
}
