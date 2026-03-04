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

      // Skip initial scan (would flood with old events)
      if (lastScannedBlock === 0) {
        lastScannedBlock = currentBlock;
        return;
      }

      await scanLevelUps(syncHandle, scanFrom, currentBlock, broadcaster);
      await scanCombatOutcomes(syncHandle, scanFrom, currentBlock, broadcaster);
      await scanLootDrops(syncHandle, scanFrom, currentBlock, broadcaster);
      await scanMarketplaceSales(syncHandle, scanFrom, currentBlock, broadcaster);

      lastScannedBlock = currentBlock;
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
  const worldEncTable = syncHandle.tableNameMap.get('WorldEncounter');
  const charactersTable = syncHandle.tableNameMap.get('Characters');
  if (!outcomeTable || !worldEncTable || !charactersTable) return;

  try {
    const rows = await sql.unsafe(`
      SELECT co."exp_dropped", co."gold_dropped", co."attackers_win", c."name"
      FROM "${mudSchema}"."${outcomeTable}" co
      JOIN "${mudSchema}"."${worldEncTable}" we
        ON co."__key_bytes" = we."__key_bytes"
      LEFT JOIN "${mudSchema}"."${charactersTable}" c
        ON we."character" = c."__key_bytes"
      WHERE co."__last_updated_block_number" >= $1
        AND co."__last_updated_block_number" <= $2
    `, [fromBlock.toString(), toBlock.toString()]);

    for (const row of rows) {
      const name = decodeCharacterName(row.name);
      if (!name) continue;

      const xpGained = Number(row.exp_dropped || 0);
      const goldGained = Number(row.gold_dropped || 0);
      const won = row.attackers_win;

      let desc: string;
      if (won && xpGained > 0 && goldGained > 0) {
        desc = `${name} won a battle (+${xpGained} XP, +${goldGained} gold)`;
      } else if (won && xpGained > 0) {
        desc = `${name} won a battle (+${xpGained} XP)`;
      } else if (won) {
        desc = `${name} emerged victorious in combat`;
      } else {
        desc = `${name} fell in battle`;
      }

      const event: GameEvent = {
        id: crypto.randomUUID(),
        eventType: won ? 'pvp_kill' : 'death',
        playerName: name,
        description: desc,
        timestamp: Date.now(),
      };
      addEvent(event);
      broadcaster.broadcastGameEvent(event);
    }
  } catch (err) {
    // Table might not exist yet
    console.debug('[eventFeed] Combat scan error:', err);
  }
}

// Item type enum values (must match mud.config ItemType)
const ITEM_TYPE_NAMES = ['Weapon', 'Armor', 'Spell', 'Consumable', 'QuestItem', 'Accessory'];
// Rarity enum values (must match client Rarity enum)
const RARITY_NAMES = ['Worn', 'Common', 'Uncommon', 'Rare', 'Epic', 'Legendary'];

/** Scan for loot drops from CombatOutcome.itemsDropped */
async function scanLootDrops(
  syncHandle: SyncHandle,
  fromBlock: number,
  toBlock: number,
  broadcaster: Broadcaster,
) {
  const outcomeTable = syncHandle.tableNameMap.get('CombatOutcome');
  const worldEncTable = syncHandle.tableNameMap.get('WorldEncounter');
  const charactersTable = syncHandle.tableNameMap.get('Characters');
  const itemsTable = syncHandle.tableNameMap.get('Items');
  if (!outcomeTable || !worldEncTable || !charactersTable) return;

  try {
    // Find combat outcomes with items dropped, joined with character name via WorldEncounter
    const rows = await sql.unsafe(`
      SELECT co."__key_bytes", co."items_dropped", c."name"
      FROM "${mudSchema}"."${outcomeTable}" co
      JOIN "${mudSchema}"."${worldEncTable}" we
        ON co."__key_bytes" = we."__key_bytes"
      LEFT JOIN "${mudSchema}"."${charactersTable}" c
        ON we."character" = c."__key_bytes"
      WHERE co."__last_updated_block_number" >= $1
        AND co."__last_updated_block_number" <= $2
        AND co."items_dropped" IS NOT NULL
        AND array_length(co."items_dropped", 1) > 0
    `, [fromBlock.toString(), toBlock.toString()]);

    for (const row of rows) {
      const name = decodeCharacterName(row.name) || 'An adventurer';
      const itemIds: string[] = Array.isArray(row.items_dropped) ? row.items_dropped : [];
      if (itemIds.length === 0) continue;

      // Try to look up item rarity and type for the first item
      let itemDesc = `${itemIds.length} item${itemIds.length > 1 ? 's' : ''}`;
      let rarity = 0;
      if (itemsTable && itemIds.length > 0) {
        try {
          const itemRow = await sql.unsafe(`
            SELECT "item_type", "rarity"
            FROM "${mudSchema}"."${itemsTable}"
            WHERE "__key_bytes" = $1
            LIMIT 1
          `, [itemIds[0]]);
          if (itemRow.length > 0) {
            const typeName = ITEM_TYPE_NAMES[Number(itemRow[0].item_type)] || 'Item';
            rarity = Number(itemRow[0].rarity || 0);
            const rarityName = RARITY_NAMES[rarity] || '';
            itemDesc = rarityName ? `a ${rarityName} ${typeName}` : `a ${typeName}`;
          }
        } catch {
          // Fall back to generic description
        }
      }

      const eventType = rarity >= 3 ? 'rare_find' : 'loot_drop';

      const event: GameEvent = {
        id: crypto.randomUUID(),
        eventType,
        playerName: name,
        description: `${name} found ${itemDesc}`,
        timestamp: Date.now(),
      };
      addEvent(event);
      broadcaster.broadcastGameEvent(event);
    }
  } catch {
    // Table might not exist yet
  }
}

/** Scan for marketplace sales */
async function scanMarketplaceSales(
  syncHandle: SyncHandle,
  fromBlock: number,
  toBlock: number,
  broadcaster: Broadcaster,
) {
  const saleTable = syncHandle.tableNameMap.get('MarketplaceSale');
  const itemsTable = syncHandle.tableNameMap.get('Items');
  const charactersTable = syncHandle.tableNameMap.get('Characters');
  if (!saleTable) return;

  try {
    const rows = await sql.unsafe(`
      SELECT ms."item_id", ms."price", ms."buyer", ms."seller"
      FROM "${mudSchema}"."${saleTable}" ms
      WHERE ms."__last_updated_block_number" >= $1
        AND ms."__last_updated_block_number" <= $2
    `, [fromBlock.toString(), toBlock.toString()]);

    for (const row of rows) {
      const price = Number(row.price || 0);
      let itemDesc = 'an item';

      // Look up item details
      if (itemsTable) {
        try {
          const itemRow = await sql.unsafe(`
            SELECT "item_type", "rarity"
            FROM "${mudSchema}"."${itemsTable}"
            WHERE "__key_bytes" = $1
            LIMIT 1
          `, [row.item_id]);
          if (itemRow.length > 0) {
            const typeName = ITEM_TYPE_NAMES[Number(itemRow[0].item_type)] || 'Item';
            const rarityName = RARITY_NAMES[Number(itemRow[0].rarity)] || '';
            itemDesc = rarityName ? `a ${rarityName} ${typeName}` : `a ${typeName}`;
          }
        } catch {
          // Fall back to generic description
        }
      }

      const event: GameEvent = {
        id: crypto.randomUUID(),
        eventType: 'marketplace_sale',
        playerName: '',
        description: price > 0
          ? `${itemDesc} was sold for ${price.toLocaleString()} gold`
          : `${itemDesc} was sold on the marketplace`,
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
