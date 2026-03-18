import { sql, mudSchema } from '../db/connection.js';
import type { SyncHandle } from '../sync/startSync.js';
import type { Broadcaster } from '../ws/broadcaster.js';
import type { GameEvent } from '../ws/protocol.js';
import crypto from 'crypto';
import { formatEther } from 'viem';

/** Format a raw wei price to a human-readable gold amount */
function formatGold(rawPrice: unknown): string {
  try {
    const val = BigInt(String(rawPrice));
    if (val === 0n) return '0';
    const formatted = formatEther(val);
    // Strip trailing zeros after decimal: "5.000" → "5", "2.50" → "2.5"
    return formatted.replace(/\.?0+$/, '') || '0';
  } catch {
    return String(rawPrice);
  }
}

/** Per-class emotive flavor for class selection events */
const CLASS_FLAVOR: Record<string, string> = {
  Warrior: 'charges into battle as a Warrior!',
  Paladin: 'takes a holy oath as a Paladin!',
  Ranger: 'walks the wild path of the Ranger!',
  Rogue: 'vanishes into the shadows as a Rogue!',
  Druid: 'embraces the balance as a Druid!',
  Warlock: 'binds dark power as a Warlock!',
  Wizard: 'channels the arcane as a Wizard!',
  Cleric: 'answers a divine calling as a Cleric!',
  Sorcerer: 'unleashes raw magic as a Sorcerer!',
};

/** Event description templates — emotive language for the world feed */
const eventDesc = {
  levelUp: (name: string, level: number) => `${name} reached Level ${level}!`,
  classSelection: (name: string, className: string) =>
    `${name} ${CLASS_FLAVOR[className] || `became a ${className}!`}`,
  fragmentFound: (name: string) => `${name} uncovered a lost fragment...`,
  characterCreated: (name: string) => `${name} awakens in the Dark Cave.`,
  pvpKill: (winner: string, loser: string) => `${winner} defeated ${loser} in PvP!`,
  death: (name: string, mobName: string) => `${name} was slain by ${mobName}.`,
  lootDrop: (name: string, itemDesc: string) => `${name} found ${itemDesc}!`,
  marketplaceSale: (itemDesc: string, gold: string) =>
    gold !== '0' ? `${itemDesc} sold for ${gold} gold!` : `${itemDesc} sold on the marketplace!`,
  shopBuy: (name: string, itemDesc: string, gold: string) =>
    gold !== '0' ? `${name} bought ${itemDesc} for ${gold} gold.` : `${name} bought ${itemDesc}.`,
  shopSell: (name: string, itemDesc: string, gold: string) =>
    gold !== '0' ? `${name} sold ${itemDesc} for ${gold} gold.` : `${name} sold ${itemDesc}.`,
};

/** Ring buffer of recent game events (serves as history for new clients) */
const eventBuffer: GameEvent[] = [];
const MAX_EVENTS = 200;

/** Track last-seen block for incremental scanning */
let lastScannedBlock = 0;

/** Dedup: track already-emitted events to prevent repeats */
const emittedLevelUps = new Set<string>();    // "keyBytes:level"
const emittedCombat = new Set<string>();       // "keyBytes"
const emittedLoot = new Set<string>();         // "keyBytes"
const emittedSales = new Set<string>();        // "keyBytes"
const emittedCharacters = new Set<string>();   // "keyBytes"
const emittedShopSales = new Set<string>();    // "shopId:customerId:itemId:timestamp"
const emittedQuests = new Set<string>();       // "characterId:questId"
const emittedClassSelections = new Set<string>(); // "keyBytes:classValue"
const emittedFragments = new Set<string>();       // "keyBytes"

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
 * Backfill the event buffer with recent history from the database.
 * Runs once on startup so the feed isn't empty after a deploy/restart.
 * Queries ALL event types — the compute happens here on the server.
 */
async function backfillRecentEvents(syncHandle: SyncHandle) {
  const BACKFILL_LIMIT = 50;
  console.log(`[eventFeed] Backfilling last ${BACKFILL_LIMIT} events from DB...`);

  const statsTable = syncHandle.tableNameMap.get('Stats');
  const charactersTable = syncHandle.tableNameMap.get('Characters');
  const fragmentTable = syncHandle.tableNameMap.get('FragmentProgress');
  const mobsTable = syncHandle.tableNameMap.get('Mobs');
  const outcomeTable = syncHandle.tableNameMap.get('CombatOutcome');
  const worldEncTable = syncHandle.tableNameMap.get('WorldEncounter');
  const combatEncTable = syncHandle.tableNameMap.get('CombatEncounter');
  const itemsTable = syncHandle.tableNameMap.get('Items');
  const shopSaleTable = syncHandle.tableNameMap.get('ShopSale');

  if (!statsTable || !charactersTable) {
    console.log('[eventFeed] Backfill skipped — tables not ready');
    return;
  }

  // Collect events from event-oriented tables only.
  // Stats/Characters are cumulative state — they show current level, not level-up history.
  // Level-ups and class selections will appear once the live scanner picks them up.
  const allEvents: { block: number; event: GameEvent; dedupKey?: string }[] = [];

  // 1. Fragment discoveries (discrete event table)
  if (fragmentTable) {
    try {
      const rows = await sql.unsafe(`
        SELECT fp."__last_updated_block_number" as block, c."name"
        FROM "${mudSchema}"."${fragmentTable}" fp
        LEFT JOIN "${mudSchema}"."${charactersTable}" c ON fp."character_id" = c."__key_bytes"
        WHERE fp."triggered" = true
        ORDER BY fp."__last_updated_block_number" DESC
        LIMIT ${BACKFILL_LIMIT}
      `);
      for (const row of rows) {
        const name = decodeCharacterName(row.name) || 'An adventurer';
        allEvents.push({
          block: Number(row.block),
          event: { id: crypto.randomUUID(), eventType: 'fragment_found', playerName: name, description: eventDesc.fragmentFound(name), timestamp: 0 },
        });
      }
    } catch { /* table may not exist */ }
  }

  // 2. Character creations (level=1 is a real discrete event)
  try {
    const query = statsTable
      ? `SELECT c."__last_updated_block_number" as block, c."name"
         FROM "${mudSchema}"."${charactersTable}" c
         JOIN "${mudSchema}"."${statsTable}" s ON c."__key_bytes" = s."__key_bytes"
         WHERE c."name" IS NOT NULL AND s."level" = 1
         ORDER BY c."__last_updated_block_number" DESC
         LIMIT ${BACKFILL_LIMIT}`
      : `SELECT "__last_updated_block_number" as block, "name"
         FROM "${mudSchema}"."${charactersTable}"
         WHERE "name" IS NOT NULL
         ORDER BY "__last_updated_block_number" DESC
         LIMIT ${BACKFILL_LIMIT}`;
    const rows = await sql.unsafe(query);
    for (const row of rows) {
      const name = decodeCharacterName(row.name);
      if (!name) continue;
      allEvents.push({
        block: Number(row.block),
        event: { id: crypto.randomUUID(), eventType: 'character_created', playerName: name, description: eventDesc.characterCreated(name), timestamp: 0 },
      });
    }
  } catch { /* table may not exist */ }

  // 3. Combat outcomes (PvP kills + PvE deaths)
  if (outcomeTable && worldEncTable) {
    try {
      const hasCE = !!combatEncTable;
      const rows = await sql.unsafe(`
        SELECT co."__last_updated_block_number" as block, co."attackers_win",
               c."name" as player_name
               ${hasCE ? `, ce."encounter_type", ce."defenders", ce."attackers"` : ''}
        FROM "${mudSchema}"."${outcomeTable}" co
        JOIN "${mudSchema}"."${worldEncTable}" we ON co."__key_bytes" = we."__key_bytes"
        LEFT JOIN "${mudSchema}"."${charactersTable}" c ON we."character" = c."__key_bytes"
        ${hasCE ? `LEFT JOIN "${mudSchema}"."${combatEncTable}" ce ON co."__key_bytes" = ce."__key_bytes"` : ''}
        ORDER BY co."__last_updated_block_number" DESC
        LIMIT ${BACKFILL_LIMIT * 2}
      `);

      for (const row of rows) {
        const playerName = decodeCharacterName(row.player_name);
        if (!playerName) continue;
        const attackersWin = Boolean(row.attackers_win);
        const isPvP = hasCE && Number(row.encounter_type) === ENCOUNTER_TYPE_PVP;

        if (isPvP) {
          const playerWon = attackersWin;
          const opponentEntities: Buffer[] = playerWon ? (row.defenders || []) : (row.attackers || []);
          let opponentName = 'an opponent';
          if (opponentEntities.length > 0) {
            try {
              const oppRow = await sql.unsafe(`
                SELECT "name" FROM "${mudSchema}"."${charactersTable}" WHERE "__key_bytes" = $1 LIMIT 1
              `, [opponentEntities[0]]);
              if (oppRow.length > 0) opponentName = decodeCharacterName(oppRow[0].name) || 'an opponent';
            } catch { /* fall through */ }
          }
          const winner = playerWon ? playerName : opponentName;
          const loser = playerWon ? opponentName : playerName;
          allEvents.push({
            block: Number(row.block),
            event: { id: crypto.randomUUID(), eventType: 'pvp_kill', playerName: winner, description: eventDesc.pvpKill(winner, loser), timestamp: 0 },
          });
        } else if (!attackersWin) {
          // PvE death — player lost
          let mobName = 'a monster';
          if (hasCE && mobsTable) {
            const defenderEntities: Buffer[] = row.defenders || [];
            if (defenderEntities.length > 0) {
              const mobId = decodeMobIdFromEntity(defenderEntities[0]);
              if (mobId > 0) mobName = await getMobName(mobId, mobsTable);
            }
          }
          allEvents.push({
            block: Number(row.block),
            event: { id: crypto.randomUUID(), eventType: 'death', playerName: playerName, description: eventDesc.death(playerName, mobName), timestamp: 0 },
          });
        }
        // PvE wins are skipped (too noisy)
      }
    } catch (err) {
      console.debug('[eventFeed] Backfill combat error:', err);
    }
  }

  // 4. Loot drops
  if (outcomeTable && worldEncTable) {
    try {
      const rows = await sql.unsafe(`
        SELECT co."__last_updated_block_number" as block, co."items_dropped", c."name"
        FROM "${mudSchema}"."${outcomeTable}" co
        JOIN "${mudSchema}"."${worldEncTable}" we ON co."__key_bytes" = we."__key_bytes"
        LEFT JOIN "${mudSchema}"."${charactersTable}" c ON we."character" = c."__key_bytes"
        WHERE co."items_dropped" IS NOT NULL AND array_length(co."items_dropped", 1) > 0
        ORDER BY co."__last_updated_block_number" DESC
        LIMIT ${BACKFILL_LIMIT}
      `);

      for (const row of rows) {
        const name = decodeCharacterName(row.name) || 'An adventurer';
        const itemIds: string[] = Array.isArray(row.items_dropped) ? row.items_dropped : [];
        if (itemIds.length === 0) continue;

        let itemDesc = `${itemIds.length} item${itemIds.length > 1 ? 's' : ''}`;
        let rarity = 0;
        if (itemsTable && itemIds.length > 0) {
          try {
            const itemRow = await sql.unsafe(`SELECT "item_type", "rarity" FROM "${mudSchema}"."${itemsTable}" WHERE "__key_bytes" = $1 LIMIT 1`, [itemIds[0]]);
            if (itemRow.length > 0) {
              const typeName = ITEM_TYPE_NAMES[Number(itemRow[0].item_type)] || 'Item';
              rarity = Number(itemRow[0].rarity || 0);
              const rarityName = RARITY_NAMES[rarity] || '';
              itemDesc = rarityName ? `a ${rarityName} ${typeName}` : `a ${typeName}`;
            }
          } catch { /* fall back */ }
        }

        const eventType = rarity >= 3 ? 'rare_find' : 'loot_drop';
        allEvents.push({
          block: Number(row.block),
          event: { id: crypto.randomUUID(), eventType, playerName: name, description: eventDesc.lootDrop(name, itemDesc), timestamp: 0 },
        });
      }
    } catch { /* table may not exist */ }
  }

  // Deduplicate by description (same event can appear from overlapping queries)
  const seen = new Set<string>();
  const deduped = allEvents.filter(e => {
    const key = `${e.event.eventType}:${e.event.description}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Sort by block (oldest first), take the most recent BACKFILL_LIMIT
  deduped.sort((a, b) => a.block - b.block);
  const recent = deduped.slice(-BACKFILL_LIMIT);

  // Assign staggered timestamps so they display in correct order
  const now = Date.now();
  for (let i = 0; i < recent.length; i++) {
    recent[i].event.timestamp = now - (recent.length - i) * 1000;
    addEvent(recent[i].event);
  }

  console.log(`[eventFeed] Backfilled ${recent.length} events (from ${allEvents.length} candidates)`);
  // Note: dedup sets are NOT pre-seeded. The live scanner already skips old blocks
  // via the initial `lastScannedBlock = currentBlock` guard. Seeding dedup sets
  // from the full DB was suppressing all live events.
}

/**
 * Start watching MUD table changes for game events.
 * Polls every 10 seconds for new changes.
 */
export function startEventFeed(syncHandle: SyncHandle, broadcaster: Broadcaster) {
  console.log('[eventFeed] Starting game event feed');

  // Backfill recent history from DB on startup
  backfillRecentEvents(syncHandle).catch(err =>
    console.error('[eventFeed] Backfill failed:', err)
  );

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
      await scanNewCharacters(syncHandle, scanFrom, currentBlock, broadcaster);
      await scanQuestCompletions(syncHandle, scanFrom, currentBlock, broadcaster);
      await scanAdvancedClassSelections(syncHandle, scanFrom, currentBlock, broadcaster);
      await scanFragmentDiscoveries(syncHandle, scanFrom, currentBlock, broadcaster);

      loggedMissing = true;
      lastScannedBlock = currentBlock;
    } catch (err) {
      console.error('[eventFeed] Scan error:', err);
    }
  }, 10_000);
}

let loggedMissing = false;
function logMissing(label: string, tables: [string, string | undefined][]) {
  if (loggedMissing) return;
  const missing = tables.filter(([, v]) => !v).map(([k]) => k);
  if (missing.length > 0) {
    console.log(`[eventFeed] ${label}: missing tables: ${missing.join(', ')}`);
  }
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
  logMissing('LevelUps', [['Stats', statsTable], ['Characters', charactersTable]]);
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

      const keyHex = Buffer.isBuffer(row.__key_bytes) ? row.__key_bytes.toString('hex') : String(row.__key_bytes);
      const dedupKey = `${keyHex}:${level}`;
      if (emittedLevelUps.has(dedupKey)) continue;
      emittedLevelUps.add(dedupKey);

      const event: GameEvent = {
        id: crypto.randomUUID(),
        eventType: 'level_up',
        playerName: name,
        description: eventDesc.levelUp(name, level),
        timestamp: Date.now(),
      };
      addEvent(event);
      broadcaster.broadcastGameEvent(event);
    }
  } catch {
    // Table might not exist yet during initial sync
  }
}

// EncounterType enum (must match mud.config): PvP=0, PvE=1, World=2
const ENCOUNTER_TYPE_PVP = 0;

/** Decode mob ID from first 4 bytes of a mob instance entity (bytes32) */
function decodeMobIdFromEntity(entity: Buffer | Uint8Array): number {
  const buf = Buffer.isBuffer(entity) ? entity : Buffer.from(entity);
  if (buf.length < 4) return 0;
  return buf.readUInt32BE(0);
}

/** Look up a mob's display name from the Mobs table */
async function getMobName(mobId: number, mobsTable: string): Promise<string> {
  try {
    const rows = await sql.unsafe(`
      SELECT "mob_metadata" FROM "${mudSchema}"."${mobsTable}"
      WHERE "mob_id" = $1 LIMIT 1
    `, [mobId.toString()]);
    if (rows.length > 0 && rows[0].mob_metadata) {
      const uri = String(rows[0].mob_metadata);
      // Parse text URI like "monster:dire_rat" → "Dire Rat"
      const parts = uri.split(':');
      if (parts.length >= 2) {
        return parts.slice(1).join(':')
          .split('_')
          .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
          .join(' ');
      }
    }
  } catch { /* fall through */ }
  return 'a monster';
}

/** Scan for PvP kills and PvE deaths */
async function scanCombatOutcomes(
  syncHandle: SyncHandle,
  fromBlock: number,
  toBlock: number,
  broadcaster: Broadcaster,
) {
  const outcomeTable = syncHandle.tableNameMap.get('CombatOutcome');
  const combatEncTable = syncHandle.tableNameMap.get('CombatEncounter');
  const worldEncTable = syncHandle.tableNameMap.get('WorldEncounter');
  const charactersTable = syncHandle.tableNameMap.get('Characters');
  const mobsTable = syncHandle.tableNameMap.get('Mobs');
  logMissing('Combat', [['CombatOutcome', outcomeTable], ['WorldEncounter', worldEncTable], ['Characters', charactersTable]]);
  if (!outcomeTable || !worldEncTable || !charactersTable) return;

  try {
    // Join CombatEncounter (if available) for encounter_type and defenders
    const hasCE = !!combatEncTable;
    const rows = await sql.unsafe(`
      SELECT co."__key_bytes", co."attackers_win",
             c."name" as player_name,
             we."character" as player_entity
             ${hasCE ? `, ce."encounter_type", ce."defenders", ce."attackers"` : ''}
      FROM "${mudSchema}"."${outcomeTable}" co
      JOIN "${mudSchema}"."${worldEncTable}" we
        ON co."__key_bytes" = we."__key_bytes"
      LEFT JOIN "${mudSchema}"."${charactersTable}" c
        ON we."character" = c."__key_bytes"
      ${hasCE ? `LEFT JOIN "${mudSchema}"."${combatEncTable}" ce ON co."__key_bytes" = ce."__key_bytes"` : ''}
      WHERE co."__last_updated_block_number" >= $1
        AND co."__last_updated_block_number" <= $2
    `, [fromBlock.toString(), toBlock.toString()]);

    for (const row of rows) {
      const playerName = decodeCharacterName(row.player_name);
      if (!playerName) continue;

      const keyHex = Buffer.isBuffer(row.__key_bytes) ? row.__key_bytes.toString('hex') : String(row.__key_bytes);
      if (emittedCombat.has(keyHex)) continue;
      emittedCombat.add(keyHex);

      const attackersWin = Boolean(row.attackers_win);
      const isPvP = hasCE && Number(row.encounter_type) === ENCOUNTER_TYPE_PVP;

      if (isPvP) {
        // PvP: emit one event per combat — "{Winner} defeated {Loser}"
        // Player is always in attackers (WorldEncounter.character starts the fight)
        const playerWon = attackersWin;
        // The opponent is the first entity in the other side
        const opponentEntities: Buffer[] = playerWon
          ? (row.defenders || [])
          : (row.attackers || []);
        let opponentName = 'an opponent';
        if (opponentEntities.length > 0) {
          const oppEntity = opponentEntities[0];
          try {
            const oppRow = await sql.unsafe(`
              SELECT "name" FROM "${mudSchema}"."${charactersTable}"
              WHERE "__key_bytes" = $1 LIMIT 1
            `, [oppEntity]);
            if (oppRow.length > 0) {
              opponentName = decodeCharacterName(oppRow[0].name) || 'an opponent';
            }
          } catch { /* fall through */ }
        }

        const winner = playerWon ? playerName : opponentName;
        const loser = playerWon ? opponentName : playerName;

        const event: GameEvent = {
          id: crypto.randomUUID(),
          eventType: 'pvp_kill',
          playerName: winner,
          description: eventDesc.pvpKill(winner, loser),
          timestamp: Date.now(),
        };
        addEvent(event);
        broadcaster.broadcastGameEvent(event);
      } else {
        // PvE: only emit deaths (player killed by monster)
        if (attackersWin) continue; // Player won PvE — skip (too noisy)

        // Find the mob that killed the player
        let mobName = 'a monster';
        if (hasCE && mobsTable) {
          const defenderEntities: Buffer[] = row.defenders || [];
          // Mobs are in defenders when attackers_are_mobs is false
          // But player is attacker, so defenders = mobs
          // Actually, player attacks → player is in attackers, mob is in defenders
          // If player lost (attackersWin=false), the mob (defender) won
          // The mob entity is in defenders (or attackers if mob attacked)
          const mobEntities: Buffer[] = row.attackers_are_mobs
            ? (row.attackers || [])
            : defenderEntities;
          if (mobEntities.length > 0) {
            const mobId = decodeMobIdFromEntity(mobEntities[0]);
            if (mobId > 0) {
              mobName = await getMobName(mobId, mobsTable);
            }
          }
        }

        const event: GameEvent = {
          id: crypto.randomUUID(),
          eventType: 'death',
          playerName: playerName,
          description: eventDesc.death(playerName, mobName),
          timestamp: Date.now(),
        };
        addEvent(event);
        broadcaster.broadcastGameEvent(event);
      }
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
      const keyHex = Buffer.isBuffer(row.__key_bytes) ? row.__key_bytes.toString('hex') : String(row.__key_bytes);
      if (emittedLoot.has(keyHex)) continue;
      emittedLoot.add(keyHex);

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
        description: eventDesc.lootDrop(name, itemDesc),
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
      SELECT ms."__key_bytes", ms."item_id", ms."price", ms."buyer", ms."seller"
      FROM "${mudSchema}"."${saleTable}" ms
      WHERE ms."__last_updated_block_number" >= $1
        AND ms."__last_updated_block_number" <= $2
    `, [fromBlock.toString(), toBlock.toString()]);

    for (const row of rows) {
      const keyHex = Buffer.isBuffer(row.__key_bytes) ? row.__key_bytes.toString('hex') : String(row.__key_bytes);
      if (emittedSales.has(keyHex)) continue;
      emittedSales.add(keyHex);

      const goldAmount = formatGold(row.price);
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
        description: eventDesc.marketplaceSale(itemDesc, goldAmount),
        timestamp: Date.now(),
      };
      addEvent(event);
      broadcaster.broadcastGameEvent(event);
    }
  } catch {
    // Table might not exist yet
  }
}

/** Scan for new character creations (level 1 characters that just appeared) */
async function scanNewCharacters(
  syncHandle: SyncHandle,
  fromBlock: number,
  toBlock: number,
  broadcaster: Broadcaster,
) {
  const charactersTable = syncHandle.tableNameMap.get('Characters');
  const statsTable = syncHandle.tableNameMap.get('Stats');
  if (!charactersTable) return;

  try {
    // Find characters updated in this block range that are level 1 (just created)
    const query = statsTable
      ? `SELECT c."__key_bytes", c."name"
         FROM "${mudSchema}"."${charactersTable}" c
         JOIN "${mudSchema}"."${statsTable}" s ON c."__key_bytes" = s."__key_bytes"
         WHERE c."__last_updated_block_number" >= $1
           AND c."__last_updated_block_number" <= $2
           AND c."name" IS NOT NULL
           AND s."level" = 1`
      : `SELECT "__key_bytes", "name"
         FROM "${mudSchema}"."${charactersTable}"
         WHERE "__last_updated_block_number" >= $1
           AND "__last_updated_block_number" <= $2
           AND "name" IS NOT NULL`;
    const rows = await sql.unsafe(query, [fromBlock.toString(), toBlock.toString()]);

    for (const row of rows) {
      const keyHex = Buffer.isBuffer(row.__key_bytes) ? row.__key_bytes.toString('hex') : String(row.__key_bytes);
      if (emittedCharacters.has(keyHex)) continue;
      emittedCharacters.add(keyHex);

      const name = decodeCharacterName(row.name);
      if (!name) continue;

      const event: GameEvent = {
        id: crypto.randomUUID(),
        eventType: 'character_created',
        playerName: name,
        description: eventDesc.characterCreated(name),
        timestamp: Date.now(),
      };
      addEvent(event);
      broadcaster.broadcastGameEvent(event);
    }
  } catch {
    // Table might not exist yet
  }
}

/** Scan for NPC shop purchases */
async function scanShopPurchases(
  syncHandle: SyncHandle,
  fromBlock: number,
  toBlock: number,
  broadcaster: Broadcaster,
) {
  const shopSaleTable = syncHandle.tableNameMap.get('ShopSale');
  const charactersTable = syncHandle.tableNameMap.get('Characters');
  const itemsTable = syncHandle.tableNameMap.get('Items');
  logMissing('ShopSale', [['ShopSale', shopSaleTable], ['Characters', charactersTable]]);
  if (!shopSaleTable || !charactersTable) return;

  try {
    const rows = await sql.unsafe(`
      SELECT ss."__key_bytes", ss."customer_id", ss."item_id", ss."buying", ss."price", c."name"
      FROM "${mudSchema}"."${shopSaleTable}" ss
      LEFT JOIN "${mudSchema}"."${charactersTable}" c
        ON ss."customer_id" = c."__key_bytes"
      WHERE ss."__last_updated_block_number" >= $1
        AND ss."__last_updated_block_number" <= $2
    `, [fromBlock.toString(), toBlock.toString()]);

    for (const row of rows) {
      const keyHex = Buffer.isBuffer(row.__key_bytes) ? row.__key_bytes.toString('hex') : String(row.__key_bytes);
      if (emittedShopSales.has(keyHex)) continue;
      emittedShopSales.add(keyHex);

      const name = decodeCharacterName(row.name) || 'An adventurer';
      const goldAmount = formatGold(row.price);
      const buying = row.buying;
      let itemDesc = 'an item';

      if (itemsTable) {
        try {
          const itemRow = await sql.unsafe(`
            SELECT "item_type", "rarity"
            FROM "${mudSchema}"."${itemsTable}"
            WHERE "item_id" = $1::numeric
            LIMIT 1
          `, [row.item_id]);
          if (itemRow.length > 0) {
            const typeName = ITEM_TYPE_NAMES[Number(itemRow[0].item_type)] || 'Item';
            const rarityName = RARITY_NAMES[Number(itemRow[0].rarity)] || '';
            itemDesc = rarityName ? `a ${rarityName} ${typeName}` : `a ${typeName}`;
          }
        } catch {
          // Fall back to generic
        }
      }

      const desc = buying
        ? (goldAmount !== '0' ? `${name} purchased ${itemDesc} for ${goldAmount} gold` : `${name} purchased ${itemDesc}`)
        : (goldAmount !== '0' ? `${name} sold ${itemDesc} for ${goldAmount} gold` : `${name} sold ${itemDesc}`);

      const event: GameEvent = {
        id: crypto.randomUUID(),
        eventType: 'shop_purchase',
        playerName: name,
        description: desc,
        timestamp: Date.now(),
      };
      addEvent(event);
      broadcaster.broadcastGameEvent(event);
    }
  } catch {
    // Table might not exist yet
  }
}

// QuestStatus enum values (must match mud.config QuestStatus)
const QUEST_STATUS_COMPLETED = 3;

/** Scan for quest completions */
async function scanQuestCompletions(
  syncHandle: SyncHandle,
  fromBlock: number,
  toBlock: number,
  broadcaster: Broadcaster,
) {
  const questTable = syncHandle.tableNameMap.get('QuestProgress');
  const charactersTable = syncHandle.tableNameMap.get('Characters');
  logMissing('Quest', [['QuestProgress', questTable], ['Characters', charactersTable]]);
  if (!questTable || !charactersTable) return;

  try {
    const rows = await sql.unsafe(`
      SELECT qp."__key_bytes", qp."character_id", qp."quest_id", c."name"
      FROM "${mudSchema}"."${questTable}" qp
      LEFT JOIN "${mudSchema}"."${charactersTable}" c
        ON qp."character_id" = c."__key_bytes"
      WHERE qp."__last_updated_block_number" >= $1
        AND qp."__last_updated_block_number" <= $2
        AND qp."status" = $3
    `, [fromBlock.toString(), toBlock.toString(), QUEST_STATUS_COMPLETED.toString()]);

    for (const row of rows) {
      const keyHex = Buffer.isBuffer(row.__key_bytes) ? row.__key_bytes.toString('hex') : String(row.__key_bytes);
      if (emittedQuests.has(keyHex)) continue;
      emittedQuests.add(keyHex);

      const name = decodeCharacterName(row.name) || 'An adventurer';

      const event: GameEvent = {
        id: crypto.randomUUID(),
        eventType: 'quest_complete',
        playerName: name,
        description: `${name} completed a quest!`,
        timestamp: Date.now(),
      };
      addEvent(event);
      broadcaster.broadcastGameEvent(event);
    }
  } catch {
    // Table might not exist yet
  }
}

// Advanced class enum names (must match mud.config AdvancedClass)
const ADVANCED_CLASS_NAMES = ['', 'Paladin', 'Sorcerer', 'Warrior', 'Druid', 'Warlock', 'Ranger', 'Cleric', 'Wizard', 'Rogue'];

/** Scan for advanced class selections (level 10 class picks) */
async function scanAdvancedClassSelections(
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
      SELECT s."__key_bytes", s."advanced_class", c."name"
      FROM "${mudSchema}"."${statsTable}" s
      JOIN "${mudSchema}"."${charactersTable}" c
        ON s."__key_bytes" = c."__key_bytes"
      WHERE s."__last_updated_block_number" >= $1
        AND s."__last_updated_block_number" <= $2
        AND s."advanced_class" IS NOT NULL
        AND s."advanced_class" > 0
    `, [fromBlock.toString(), toBlock.toString()]);

    for (const row of rows) {
      const name = decodeCharacterName(row.name);
      const classValue = Number(row.advanced_class);
      if (!name || classValue <= 0) continue;

      const keyHex = Buffer.isBuffer(row.__key_bytes) ? row.__key_bytes.toString('hex') : String(row.__key_bytes);
      const dedupKey = `${keyHex}:${classValue}`;
      if (emittedClassSelections.has(dedupKey)) continue;
      emittedClassSelections.add(dedupKey);

      const className = ADVANCED_CLASS_NAMES[classValue] || `Class ${classValue}`;

      const event: GameEvent = {
        id: crypto.randomUUID(),
        eventType: 'class_selection',
        playerName: name,
        description: eventDesc.classSelection(name, className),
        timestamp: Date.now(),
      };
      addEvent(event);
      broadcaster.broadcastGameEvent(event);
    }
  } catch {
    // Table might not exist yet
  }
}

/** Scan for fragment discoveries (triggered = true) */
async function scanFragmentDiscoveries(
  syncHandle: SyncHandle,
  fromBlock: number,
  toBlock: number,
  broadcaster: Broadcaster,
) {
  const fragmentTable = syncHandle.tableNameMap.get('FragmentProgress');
  const charactersTable = syncHandle.tableNameMap.get('Characters');
  if (!fragmentTable || !charactersTable) return;

  try {
    const rows = await sql.unsafe(`
      SELECT fp."__key_bytes", fp."character_id", c."name"
      FROM "${mudSchema}"."${fragmentTable}" fp
      LEFT JOIN "${mudSchema}"."${charactersTable}" c
        ON fp."character_id" = c."__key_bytes"
      WHERE fp."__last_updated_block_number" >= $1
        AND fp."__last_updated_block_number" <= $2
        AND fp."triggered" = true
    `, [fromBlock.toString(), toBlock.toString()]);

    for (const row of rows) {
      const keyHex = Buffer.isBuffer(row.__key_bytes) ? row.__key_bytes.toString('hex') : String(row.__key_bytes);
      if (emittedFragments.has(keyHex)) continue;
      emittedFragments.add(keyHex);

      const name = decodeCharacterName(row.name) || 'An adventurer';

      const event: GameEvent = {
        id: crypto.randomUUID(),
        eventType: 'fragment_found',
        playerName: name,
        description: eventDesc.fragmentFound(name),
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
