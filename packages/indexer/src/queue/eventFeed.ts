import { sql, mudSchema } from '../db/connection.js';
import type { SyncHandle } from '../sync/startSync.js';
import type { Broadcaster } from '../ws/broadcaster.js';
import type { GameEvent } from '../ws/protocol.js';
import crypto from 'crypto';

/** Ring buffer of recent game events */
const eventBuffer: GameEvent[] = [];
const MAX_EVENTS = 50;

/** Track last-seen block for incremental scanning */
let lastScannedBlock = 0;

function addEvent(event: GameEvent) {
  eventBuffer.push(event);
  if (eventBuffer.length > MAX_EVENTS) {
    eventBuffer.shift();
  }
}

/** Get the current event buffer (for initial load) */
export function getRecentEvents(): GameEvent[] {
  return [...eventBuffer];
}

/**
 * Start watching MUD table changes for game events.
 * Polls every 10 seconds for new changes.
 */
export function startEventFeed(syncHandle: SyncHandle, broadcaster: Broadcaster) {
  console.log('[eventFeed] Starting game event feed');

  setInterval(async () => {
    try {
      const currentBlock = syncHandle.latestBlockNumber;
      if (currentBlock <= lastScannedBlock) return;

      const scanFrom = lastScannedBlock > 0 ? lastScannedBlock + 1 : currentBlock;
      lastScannedBlock = currentBlock;

      // Skip initial scan (would flood with old events)
      if (scanFrom === currentBlock && lastScannedBlock === currentBlock) return;

      await scanLevelUps(syncHandle, scanFrom, currentBlock, broadcaster);
      await scanCombatOutcomes(syncHandle, scanFrom, currentBlock, broadcaster);
    } catch (err) {
      console.error('[eventFeed] Scan error:', err);
    }
  }, 10_000);
}

/** Scan for level-ups */
async function scanLevelUps(
  syncHandle: SyncHandle,
  fromBlock: number,
  toBlock: number,
  broadcaster: Broadcaster,
) {
  const statsTable = syncHandle.tableNameMap.get('Stats');
  const charactersTable = syncHandle.tableNameMap.get('Characters');
  if (!statsTable || !charactersTable) return;

  try {
    const rows = await sql.unsafe(`
      SELECT s."__key_bytes", s."level", c."name"
      FROM "${mudSchema}"."${statsTable}" s
      JOIN "${mudSchema}"."${charactersTable}" c
        ON s."__key_bytes" = c."__key_bytes"
      WHERE s."__last_updated_block_number" >= $1
        AND s."__last_updated_block_number" <= $2
        AND s."level" IS NOT NULL
        AND s."level" >= 2
    `, [fromBlock.toString(), toBlock.toString()]);

    for (const row of rows) {
      const name = decodeCharacterName(row.name);
      const level = Number(row.level);
      if (!name || level <= 1) continue;

      const event: GameEvent = {
        id: crypto.randomUUID(),
        eventType: 'level_up',
        playerName: name,
        description: `${name} reached Level ${level}`,
        timestamp: Date.now(),
      };
      addEvent(event);
      broadcaster.broadcastGameEvent(event);
    }
  } catch {
    // Table might not exist yet during initial sync
  }
}

/** Scan for PvP/PvE combat outcomes */
async function scanCombatOutcomes(
  syncHandle: SyncHandle,
  fromBlock: number,
  toBlock: number,
  broadcaster: Broadcaster,
) {
  const outcomeTable = syncHandle.tableNameMap.get('CombatOutcome');
  const charactersTable = syncHandle.tableNameMap.get('Characters');
  if (!outcomeTable || !charactersTable) return;

  try {
    const rows = await sql.unsafe(`
      SELECT co.*, c."name" as attacker_name
      FROM "${mudSchema}"."${outcomeTable}" co
      LEFT JOIN "${mudSchema}"."${charactersTable}" c
        ON co."attacker_id" = c."__key_bytes"
      WHERE co."__last_updated_block_number" >= $1
        AND co."__last_updated_block_number" <= $2
    `, [fromBlock.toString(), toBlock.toString()]);

    for (const row of rows) {
      const name = decodeCharacterName(row.attacker_name);
      if (!name) continue;

      const xpGained = Number(row.xp_gained || 0);
      const event: GameEvent = {
        id: crypto.randomUUID(),
        eventType: 'pvp_kill',
        playerName: name,
        description: xpGained > 0
          ? `${name} won a battle (+${xpGained} XP)`
          : `${name} emerged victorious in combat`,
        timestamp: Date.now(),
      };
      addEvent(event);
      broadcaster.broadcastGameEvent(event);
    }
  } catch {
    // Table might not exist yet
  }
}

/** Decode a bytes32-encoded character name to string */
function decodeCharacterName(raw: unknown): string | null {
  if (!raw) return null;
  try {
    let hex: string;
    if (Buffer.isBuffer(raw) || raw instanceof Uint8Array) {
      hex = Buffer.from(raw).toString('hex');
    } else if (typeof raw === 'string') {
      hex = raw.startsWith('0x') ? raw.slice(2) : raw;
    } else {
      return null;
    }
    // Remove trailing zeros and decode as UTF-8
    const trimmed = hex.replace(/0+$/, '');
    if (trimmed.length === 0) return null;
    return Buffer.from(trimmed, 'hex').toString('utf8');
  } catch {
    return null;
  }
}
