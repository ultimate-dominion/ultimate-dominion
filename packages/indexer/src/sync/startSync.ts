import { syncToPostgres } from '@latticexyz/store-sync/postgres-decoded';
import { createPublicClient, http, webSocket, fallback, type Hex } from 'viem';
import { base } from 'viem/chains';
import { config } from '../config.js';
import { db, discoverTables } from '../db/connection.js';
import { pgNameToMudName, snakeToPascal, fixAbbreviations } from '../naming.js';
import type { Broadcaster } from '../ws/broadcaster.js';

export type SyncHandle = {
  stopSync: () => void;
  /** Latest block number seen from the chain RPC (may be ahead of Postgres) */
  latestBlockNumber: number;
  /** Latest block number actually committed to Postgres (safe for queries) */
  latestStoredBlockNumber: number;
  /** Map of discovered Postgres table names → column names */
  tables: Map<string, string[]>;
  /** Logical table name → Postgres table name mapping */
  tableNameMap: Map<string, string>;
};

/**
 * Start syncing MUD Store events to Postgres using the decoded mode.
 * Returns the sync handle with observables and table metadata.
 */
export async function startSync(broadcaster: Broadcaster): Promise<SyncHandle> {
  // Build transport with WS primary, HTTP fallback
  const transports = [];
  if (config.chain.rpcWsUrl) {
    transports.push(webSocket(config.chain.rpcWsUrl, { retryCount: 5 }));
  }
  transports.push(http(config.chain.rpcHttpUrl, { retryCount: 3 }));

  const publicClient = createPublicClient({
    chain: base,
    transport: transports.length > 1 ? fallback(transports) : transports[0],
    pollingInterval: 250,
  });

  console.log(`[sync] Starting sync from block ${config.world.startBlock} for world ${config.world.address}`);
  console.log(`[sync] RPC: ${config.chain.rpcWsUrl || config.chain.rpcHttpUrl}`);

  const sync = await syncToPostgres({
    database: db,
    publicClient,
    address: config.world.address,
    startBlock: config.world.startBlock,
    maxBlockRange: 10000n,
  });

  const handle: SyncHandle = {
    stopSync: sync.stopSync,
    latestBlockNumber: 0,
    latestStoredBlockNumber: 0,
    tables: new Map(),
    tableNameMap: new Map(),
  };

  // Subscribe to block progress
  sync.latestBlockNumber$.subscribe({
    next: (blockNumber) => {
      handle.latestBlockNumber = Number(blockNumber);
    },
    error: (err) => {
      console.error('[sync] latestBlockNumber$ error:', err);
    },
  });

  // Subscribe to stored block logs for WS broadcasting.
  // This fires AFTER data is committed to Postgres, so latestStoredBlockNumber
  // is safe to use for delta queries (unlike latestBlockNumber$ which can race ahead).
  sync.storedBlockLogs$.subscribe({
    next: async ({ blockNumber, logs }) => {
      handle.latestBlockNumber = Number(blockNumber);
      handle.latestStoredBlockNumber = Number(blockNumber);

      if (logs.length === 0) return;

      // Extract unique table IDs from the logs to know which tables changed
      const changedTableIds = new Set<Hex>();
      for (const log of logs) {
        if (log.args.tableId) {
          changedTableIds.add(log.args.tableId);
        }
      }

      // Broadcast changes to WebSocket clients
      try {
        await broadcaster.onBlockProcessed(Number(blockNumber), changedTableIds);
      } catch (err) {
        console.error('[sync] broadcast error:', err);
      }
    },
    error: (err) => {
      console.error('[sync] storedBlockLogs$ error:', err);
    },
  });

  // Initial table discovery — wait for sync to populate some tables
  console.log('[sync] Waiting for initial table discovery...');
  await new Promise((resolve) => setTimeout(resolve, 5000));

  const refreshTableMap = async (label: string) => {
    handle.tables = await discoverTables();
    handle.tableNameMap = buildTableNameMap(handle.tables);
    broadcaster.setTableNameMap(handle.tableNameMap);
    console.log(`[sync] ${label}: discovered ${handle.tables.size} tables`);
    for (const [logical, physical] of handle.tableNameMap) {
      console.log(`  ${logical} → ${physical}`);
    }
  };

  await refreshTableMap('Initial discovery');

  // Re-discover tables once sync catches up to chain head.
  // On fresh deploys the initial 5s may not be enough to sync all table
  // creation events, causing tables like items__owners to be missed.
  const chainHead = await publicClient.getBlockNumber();
  if (BigInt(handle.latestBlockNumber) < chainHead) {
    console.log(`[sync] Sync at block ${handle.latestBlockNumber}, chain head ${chainHead} — scheduling rediscovery`);
    const checkInterval = setInterval(async () => {
      if (BigInt(handle.latestBlockNumber) >= chainHead) {
        clearInterval(checkInterval);
        const prevCount = handle.tables.size;
        await refreshTableMap('Post-catchup rediscovery');
        if (handle.tables.size > prevCount) {
          console.log(`[sync] Found ${handle.tables.size - prevCount} new tables after catchup`);
        }
      }
    }, 2000);
    // Safety: don't poll forever if something goes wrong
    setTimeout(() => clearInterval(checkInterval), 120_000);
  }

  return handle;
}

/** The main game namespace — tables here get simple names (e.g., "Characters") */
export const GAME_NAMESPACE = 'ud';

/**
 * Build a mapping from logical table names (e.g., "Characters") to
 * physical Postgres table names (e.g., "ud__characters").
 *
 * MUD decoded mode creates tables as "{snakeCase(namespace)}__{snakeCase(name)}".
 *
 * For the main game namespace ("ud"), we strip the prefix:
 *   ud__characters → Characters
 *
 * For all other namespaces, we include the namespace to avoid collisions:
 *   gold__balances → GoldBalances
 *   items__owners → ItemsOwners
 *   characters__token_uri → CharactersTokenUri
 */
function buildTableNameMap(tables: Map<string, string[]>): Map<string, string> {
  const map = new Map<string, string>();

  for (const pgTableName of tables.keys()) {
    const parts = pgTableName.split('__');
    if (parts.length >= 2) {
      const snakeNamespace = parts[0];
      const snakeName = parts.slice(1).join('__');

      let mudName: string;
      if (snakeNamespace === GAME_NAMESPACE) {
        // Main game namespace: strip prefix, resolve truncation
        mudName = pgNameToMudName(snakeName);
      } else {
        // Other namespaces: include namespace prefix to avoid collisions
        // e.g., "gold__balances" → "GoldBalances"
        // Fix abbreviations: "characters__token_uri" → "CharactersTokenURI"
        mudName = fixAbbreviations(snakeToPascal(snakeNamespace) + snakeToPascal(snakeName));
      }

      map.set(mudName, pgTableName);
    }
    // Also store the full pg name for direct lookups
    map.set(pgTableName, pgTableName);
  }

  return map;
}
