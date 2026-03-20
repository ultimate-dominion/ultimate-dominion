import { sql, mudSchema } from '../db/connection.js';
import { persistEvent, loadRecentEvents } from '../db/eventStore.js';
import type { SyncHandle } from '../sync/startSync.js';
import type { Broadcaster } from '../ws/broadcaster.js';
import type { GameEvent } from '../ws/protocol.js';
import crypto from 'crypto';

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
  allFragments: (name: string) => `${name} assembled all 8 Lore Fragments! The cave whispers their name...`,
  characterCreated: (name: string) => `${name} awakens in the Dark Cave.`,
  pvpKill: (winner: string, loser: string) => `${winner} defeated ${loser} in PvP!`,
  death: (name: string, mobName: string) => `${name} was slain by ${mobName}.`,
  lootDrop: (name: string, itemName: string) => `${name} found ${itemName}!`,
  marketplaceListing: (name: string, itemName: string, price: string) =>
    `${name} listed ${itemName} for ${price} Gold`,
};

/** Ring buffer of recent game events (serves as history for new clients) */
const eventBuffer: GameEvent[] = [];
const MAX_EVENTS = 200;

/** Track last-seen block for incremental scanning */
let lastScannedBlock = 0;

/** Dedup: track already-emitted events to prevent repeats */
const emittedLevelUps = new Set<string>();    // "keyBytes:level"
const emittedCombat = new Set<string>();       // "keyBytes"
const emittedLoot = new Set<string>();         // "keyBytes:itemIndex"
const emittedCharacters = new Set<string>();   // "keyBytes"
const emittedClassSelections = new Set<string>(); // "keyBytes:classValue"
const emittedListings = new Set<string>();          // "orderHash"
const emittedFragments = new Set<string>();       // "keyBytes"

function addEvent(event: GameEvent, blockNumber: number | null = null, dedupKey?: string) {
  eventBuffer.push(event);
  if (eventBuffer.length > MAX_EVENTS) {
    eventBuffer.shift();
  }

  // Persist to DB (fire-and-forget)
  if (dedupKey) {
    persistEvent(event, blockNumber, dedupKey, event.metadata).catch(err =>
      console.error('[eventFeed] Failed to persist event:', err)
    );
  }
}

/** Get the current event buffer (for initial load) */
export function getRecentEvents(): GameEvent[] {
  return [...eventBuffer];
}

/**
 * Pre-seed dedup sets from current DB state so that cumulative-state events
 * (milestone levels, class selections) are never re-emitted after a restart.
 * Stats rows update on ANY stat change (HP, equip, etc.), so without seeding,
 * the empty dedup sets would let old milestones re-fire.
 */
async function seedDedupSets(syncHandle: SyncHandle) {
  const statsTable = syncHandle.tableNameMap.get('Stats');
  if (!statsTable) return;

  // Seed milestone level-ups
  try {
    const rows = await sql.unsafe(`
      SELECT "__key_bytes", "level"
      FROM "${mudSchema}"."${statsTable}"
      WHERE "level" IN (3, 5, 7)
    `);
    for (const row of rows) {
      const keyHex = Buffer.isBuffer(row.__key_bytes) ? row.__key_bytes.toString('hex') : String(row.__key_bytes);
      emittedLevelUps.add(`${keyHex}:${Number(row.level)}`);
    }
    console.log(`[eventFeed] Seeded ${rows.length} milestone level-ups into dedup set`);
  } catch (err) {
    console.error('[eventFeed] Failed to seed level-up dedup set:', err);
  }

  // Seed advanced class selections
  try {
    const rows = await sql.unsafe(`
      SELECT "__key_bytes", "advanced_class"
      FROM "${mudSchema}"."${statsTable}"
      WHERE "advanced_class" IS NOT NULL AND "advanced_class" > 0
    `);
    for (const row of rows) {
      const keyHex = Buffer.isBuffer(row.__key_bytes) ? row.__key_bytes.toString('hex') : String(row.__key_bytes);
      emittedClassSelections.add(`${keyHex}:${Number(row.advanced_class)}`);
    }
    console.log(`[eventFeed] Seeded ${rows.length} class selections into dedup set`);
  } catch (err) {
    console.error('[eventFeed] Failed to seed class selection dedup set:', err);
  }
}

/**
 * Backfill the event buffer — prefers persistent DB, falls back to MUD state reconstruction.
 */
async function backfillRecentEvents(syncHandle: SyncHandle) {
  // Try loading from persistent game_events table first
  try {
    const dbEvents = await loadRecentEvents(MAX_EVENTS);
    if (dbEvents.length > 0) {
      console.log(`[eventFeed] Loaded ${dbEvents.length} events from game_events table`);
      for (const row of dbEvents) {
        const event: GameEvent = {
          id: row.id,
          eventType: row.eventType as GameEvent['eventType'],
          playerName: row.playerName,
          description: row.description,
          timestamp: row.timestamp,
          metadata: row.metadata,
        };
        eventBuffer.push(event);
      }
      if (eventBuffer.length > MAX_EVENTS) {
        eventBuffer.splice(0, eventBuffer.length - MAX_EVENTS);
      }
      return;
    }
  } catch (err) {
    console.error('[eventFeed] Failed to load from game_events, falling back to MUD state:', err);
  }

  // Fallback: reconstruct from MUD table state (one-time migration)
  await backfillFromMudState(syncHandle);
}

/**
 * Reconstruct events from MUD table state.
 * Only runs when game_events table is empty (first deploy with persistence).
 * Results are persisted so this never needs to run again.
 */
async function backfillFromMudState(syncHandle: SyncHandle) {
  const BACKFILL_LIMIT = 50;
  console.log(`[eventFeed] Backfilling last ${BACKFILL_LIMIT} events from MUD state (one-time migration)...`);

  const statsTable = syncHandle.tableNameMap.get('Stats');
  const charactersTable = syncHandle.tableNameMap.get('Characters');
  const fragmentTable = syncHandle.tableNameMap.get('FragmentProgress');
  const mobsTable = syncHandle.tableNameMap.get('Mobs');
  const outcomeTable = syncHandle.tableNameMap.get('CombatOutcome');
  const combatEncTable = syncHandle.tableNameMap.get('CombatEncounter');
  const itemsTable = syncHandle.tableNameMap.get('Items');

  if (!statsTable || !charactersTable) {
    console.log('[eventFeed] Backfill skipped — tables not ready');
    return;
  }

  const allEvents: { block: number; event: GameEvent; dedupKey: string }[] = [];

  // 1. Character creations (level=1 is a real discrete event)
  try {
    const query = statsTable
      ? `SELECT c."__key_bytes", c."__last_updated_block_number" as block, c."name"
         FROM "${mudSchema}"."${charactersTable}" c
         JOIN "${mudSchema}"."${statsTable}" s ON c."__key_bytes" = s."__key_bytes"
         WHERE c."name" IS NOT NULL AND s."level" = 1
         ORDER BY c."__last_updated_block_number" DESC
         LIMIT ${BACKFILL_LIMIT}`
      : `SELECT "__key_bytes", "__last_updated_block_number" as block, "name"
         FROM "${mudSchema}"."${charactersTable}"
         WHERE "name" IS NOT NULL
         ORDER BY "__last_updated_block_number" DESC
         LIMIT ${BACKFILL_LIMIT}`;
    const rows = await sql.unsafe(query);
    for (const row of rows) {
      const name = decodeCharacterName(row.name);
      if (!name) continue;
      const keyHex = Buffer.isBuffer(row.__key_bytes) ? row.__key_bytes.toString('hex') : String(row.__key_bytes);
      allEvents.push({
        block: Number(row.block),
        dedupKey: `character:${keyHex}`,
        event: { id: crypto.randomUUID(), eventType: 'character_created', playerName: name, description: eventDesc.characterCreated(name), timestamp: 0 },
      });
    }
  } catch (err) { console.error('[eventFeed] Backfill char creation error:', err); }

  // 3. Combat outcomes (PvP kills + PvE deaths)
  if (outcomeTable && combatEncTable) {
    try {
      const rows = await sql.unsafe(`
        SELECT co."__key_bytes", co."__last_updated_block_number" as block, co."attackers_win",
               ce."encounter_type", ce."defenders", ce."attackers"
        FROM "${mudSchema}"."${outcomeTable}" co
        LEFT JOIN "${mudSchema}"."${combatEncTable}" ce ON co."__key_bytes" = ce."__key_bytes"
        ORDER BY co."__last_updated_block_number" DESC
        LIMIT ${BACKFILL_LIMIT * 2}
      `);

      for (const row of rows) {
        const playerName = await lookupPlayerName(row.attackers, charactersTable);
        if (!playerName) continue;
        const attackersWin = Boolean(row.attackers_win);
        const isPvP = Number(row.encounter_type) === ENCOUNTER_TYPE_PVP;
        const keyHex = Buffer.isBuffer(row.__key_bytes) ? row.__key_bytes.toString('hex') : String(row.__key_bytes);

        if (isPvP) {
          const playerWon = attackersWin;
          const opponentEntities = parsePackedBytes32(row.defenders);
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
            dedupKey: `combat:${keyHex}`,
            event: {
              id: crypto.randomUUID(), eventType: 'pvp_kill', playerName: winner,
              description: eventDesc.pvpKill(winner, loser), timestamp: 0,
              metadata: { opponentName: loser },
            },
          });
        } else if (!attackersWin) {
          // PvE death — player lost
          let mobName = 'a monster';
          if (mobsTable) {
            const mobEntities = parsePackedBytes32(row.defenders);
            if (mobEntities.length > 0) {
              const mobId = decodeMobIdFromEntity(mobEntities[0]);
              if (mobId > 0) mobName = await getMobName(mobId, mobsTable);
            }
          }
          allEvents.push({
            block: Number(row.block),
            dedupKey: `combat:${keyHex}`,
            event: {
              id: crypto.randomUUID(), eventType: 'death', playerName: playerName,
              description: eventDesc.death(playerName, mobName), timestamp: 0,
              metadata: { mobName },
            },
          });
        }
      }
    } catch (err) {
      console.error('[eventFeed] Backfill combat error:', err);
    }
  }

  // 4. Loot drops — iterate ALL items, emit per Uncommon+ item
  if (outcomeTable && combatEncTable) {
    try {
      const rows = await sql.unsafe(`
        SELECT co."__key_bytes", co."__last_updated_block_number" as block, co."items_dropped",
               ce."attackers"
        FROM "${mudSchema}"."${outcomeTable}" co
        LEFT JOIN "${mudSchema}"."${combatEncTable}" ce ON co."__key_bytes" = ce."__key_bytes"
        WHERE co."items_dropped" IS NOT NULL AND array_length(co."items_dropped", 1) > 0
        ORDER BY co."__last_updated_block_number" DESC
        LIMIT ${BACKFILL_LIMIT}
      `);

      for (const row of rows) {
        const name = await lookupPlayerName(row.attackers, charactersTable) || 'An adventurer';
        const itemIds: string[] = Array.isArray(row.items_dropped) ? row.items_dropped : [];
        if (itemIds.length === 0) continue;
        const keyHex = Buffer.isBuffer(row.__key_bytes) ? row.__key_bytes.toString('hex') : String(row.__key_bytes);

        // Check each item for rarity
        for (let i = 0; i < itemIds.length; i++) {
          if (!itemsTable) continue;
          try {
            const itemRow = await sql.unsafe(
              `SELECT "item_type", "rarity" FROM "${mudSchema}"."${itemsTable}" WHERE "item_id" = $1 LIMIT 1`,
              [itemIds[i]],
            );
            if (itemRow.length === 0) continue;
            const rarity = Number(itemRow[0].rarity || 0);
            if (rarity < 2) continue; // Skip Worn (0) and Common (1)

            const typeName = ITEM_TYPE_NAMES[Number(itemRow[0].item_type)] || 'Item';
            const rarityName = RARITY_NAMES[rarity] || '';
            const itemDesc = rarityName ? `a ${rarityName} ${typeName}` : `a ${typeName}`;
            const eventType = rarity >= 3 ? 'rare_find' : 'loot_drop';

            allEvents.push({
              block: Number(row.block),
              dedupKey: `loot:${keyHex}:${i}`,
              event: {
                id: crypto.randomUUID(), eventType, playerName: name,
                description: eventDesc.lootDrop(name, itemDesc), timestamp: 0,
                metadata: { itemId: itemIds[i], rarity, itemType: typeName, itemName: `${rarityName} ${typeName}`.trim() },
              },
            });
          } catch { /* skip item */ }
        }
      }
    } catch (err) { console.error('[eventFeed] Backfill loot error:', err); }
  }

  // Deduplicate by dedup key
  const seen = new Set<string>();
  const deduped = allEvents.filter(e => {
    if (seen.has(e.dedupKey)) return false;
    seen.add(e.dedupKey);
    return true;
  });

  // Sort by block (oldest first), take the most recent BACKFILL_LIMIT
  deduped.sort((a, b) => a.block - b.block);
  const recent = deduped.slice(-BACKFILL_LIMIT);

  // Assign staggered timestamps so they display in correct order
  const now = Date.now();
  for (let i = 0; i < recent.length; i++) {
    recent[i].event.timestamp = now - (recent.length - i) * 1000;
    // Add to buffer AND persist to DB (migration)
    eventBuffer.push(recent[i].event);
    persistEvent(recent[i].event, recent[i].block, recent[i].dedupKey, recent[i].event.metadata).catch(err =>
      console.error('[eventFeed] Failed to persist backfill event:', err)
    );
  }
  if (eventBuffer.length > MAX_EVENTS) {
    eventBuffer.splice(0, eventBuffer.length - MAX_EVENTS);
  }

  console.log(`[eventFeed] Backfilled ${recent.length} events from MUD state (from ${allEvents.length} candidates)`);
}

/**
 * Start watching MUD table changes for game events.
 * Polls every 10 seconds for new changes.
 */
export function startEventFeed(syncHandle: SyncHandle, broadcaster: Broadcaster) {
  console.log('[eventFeed] Starting game event feed');

  // Set the scan cursor BEFORE backfill so the live scanner doesn't re-process
  // blocks that backfill already covered
  lastScannedBlock = syncHandle.latestStoredBlockNumber;

  // Seed dedup sets from current DB state so stale cumulative-state events
  // (level-ups, class selections) aren't re-emitted after restart
  seedDedupSets(syncHandle).catch(err =>
    console.error('[eventFeed] Dedup seed failed:', err)
  );

  // Backfill recent history from DB on startup
  backfillRecentEvents(syncHandle).catch(err =>
    console.error('[eventFeed] Backfill failed:', err)
  );

  setInterval(async () => {
    try {
      const currentBlock = syncHandle.latestStoredBlockNumber;
      if (currentBlock <= lastScannedBlock) return;

      const scanFrom = lastScannedBlock + 1;
      console.log(`[eventFeed] Scanning blocks ${scanFrom}-${currentBlock}`);

      await scanLevelUps(syncHandle, scanFrom, currentBlock, broadcaster);
      await scanCombatOutcomes(syncHandle, scanFrom, currentBlock, broadcaster);
      await scanLootDrops(syncHandle, scanFrom, currentBlock, broadcaster);
      await scanNewCharacters(syncHandle, scanFrom, currentBlock, broadcaster);
      await scanAdvancedClassSelections(syncHandle, scanFrom, currentBlock, broadcaster);
      await scanFragmentDiscoveries(syncHandle, scanFrom, currentBlock, broadcaster);
      await scanMarketplaceListings(syncHandle, scanFrom, currentBlock, broadcaster);

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
        AND s."level" IN (3, 5, 7)
    `, [fromBlock, toBlock]);

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
        metadata: { level },
      };
      addEvent(event, toBlock, `level_up:${dedupKey}`);
      broadcaster.broadcastGameEvent(event);
    }
  } catch (err) {
    console.error('[eventFeed] Level-up scan error:', err);
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
  const charactersTable = syncHandle.tableNameMap.get('Characters');
  const mobsTable = syncHandle.tableNameMap.get('Mobs');
  logMissing('Combat', [['CombatOutcome', outcomeTable], ['CombatEncounter', combatEncTable], ['Characters', charactersTable]]);
  if (!outcomeTable || !combatEncTable || !charactersTable) return;

  try {
    const rows = await sql.unsafe(`
      SELECT co."__key_bytes", co."attackers_win",
             ce."encounter_type", ce."defenders", ce."attackers"
      FROM "${mudSchema}"."${outcomeTable}" co
      LEFT JOIN "${mudSchema}"."${combatEncTable}" ce
        ON co."__key_bytes" = ce."__key_bytes"
      WHERE co."__last_updated_block_number" >= $1
        AND co."__last_updated_block_number" <= $2
    `, [fromBlock, toBlock]);

    if (rows.length > 0) {
      console.log(`[eventFeed] Combat scan: ${rows.length} outcome(s) in blocks ${fromBlock}-${toBlock}`);
    }

    for (const row of rows) {
      const playerName = await lookupPlayerName(row.attackers, charactersTable);
      if (!playerName) continue;

      const keyHex = Buffer.isBuffer(row.__key_bytes) ? row.__key_bytes.toString('hex') : String(row.__key_bytes);
      if (emittedCombat.has(keyHex)) continue;
      emittedCombat.add(keyHex);

      const attackersWin = Boolean(row.attackers_win);
      const isPvP = Number(row.encounter_type) === ENCOUNTER_TYPE_PVP;

      if (isPvP) {
        // PvP: emit one event per combat — "{Winner} defeated {Loser}"
        // Player (initiator) is always in attackers, opponent in defenders
        const playerWon = attackersWin;
        const opponentEntities = parsePackedBytes32(row.defenders);
        let opponentName = 'an opponent';
        if (opponentEntities.length > 0) {
          try {
            const oppRow = await sql.unsafe(`
              SELECT "name" FROM "${mudSchema}"."${charactersTable}"
              WHERE "__key_bytes" = $1 LIMIT 1
            `, [opponentEntities[0]]);
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
          metadata: { opponentName: loser },
        };
        addEvent(event, toBlock, `combat:${keyHex}`);
        broadcaster.broadcastGameEvent(event);
      } else {
        // PvE: only emit deaths (player killed by monster)
        if (attackersWin) continue; // Player won PvE — skip

        let mobName = 'a monster';
        if (mobsTable) {
          const mobEntities = parsePackedBytes32(row.defenders);
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
          metadata: { mobName },
        };
        addEvent(event, toBlock, `combat:${keyHex}`);
        broadcaster.broadcastGameEvent(event);
      }
    }
  } catch (err) {
    console.error('[eventFeed] Combat scan error:', err);
  }
}

// Item type enum values (must match mud.config ItemType)
const ITEM_TYPE_NAMES = ['Weapon', 'Armor', 'Spell', 'Consumable', 'QuestItem', 'Accessory'];
// Rarity enum values (must match client Rarity enum)
const RARITY_NAMES = ['Worn', 'Common', 'Uncommon', 'Rare', 'Epic', 'Legendary'];

/** Scan for loot drops from CombatOutcome.itemsDropped — emits per Uncommon+ item */
async function scanLootDrops(
  syncHandle: SyncHandle,
  fromBlock: number,
  toBlock: number,
  broadcaster: Broadcaster,
) {
  const outcomeTable = syncHandle.tableNameMap.get('CombatOutcome');
  const combatEncTable = syncHandle.tableNameMap.get('CombatEncounter');
  const charactersTable = syncHandle.tableNameMap.get('Characters');
  const itemsTable = syncHandle.tableNameMap.get('Items');
  if (!outcomeTable || !combatEncTable || !charactersTable) return;

  try {
    // Find combat outcomes with items dropped, get player entity via CombatEncounter.attackers
    const rows = await sql.unsafe(`
      SELECT co."__key_bytes", co."items_dropped", ce."attackers"
      FROM "${mudSchema}"."${outcomeTable}" co
      LEFT JOIN "${mudSchema}"."${combatEncTable}" ce
        ON co."__key_bytes" = ce."__key_bytes"
      WHERE co."__last_updated_block_number" >= $1
        AND co."__last_updated_block_number" <= $2
        AND co."items_dropped" IS NOT NULL
        AND array_length(co."items_dropped", 1) > 0
    `, [fromBlock, toBlock]);

    if (rows.length > 0) {
      console.log(`[eventFeed] Loot scan: ${rows.length} drop(s) in blocks ${fromBlock}-${toBlock}`);
    }

    for (const row of rows) {
      const keyHex = Buffer.isBuffer(row.__key_bytes) ? row.__key_bytes.toString('hex') : String(row.__key_bytes);
      const name = await lookupPlayerName(row.attackers, charactersTable) || 'An adventurer';
      const rawDropped = row.items_dropped;
      const itemIds: string[] = Array.isArray(rawDropped) ? rawDropped.map(String) : [];
      if (itemIds.length === 0) continue;

      // Iterate ALL items — emit one event per Uncommon+ item
      for (let i = 0; i < itemIds.length; i++) {
        const itemDedupKey = `${keyHex}:${i}`;
        if (emittedLoot.has(itemDedupKey)) continue;

        if (!itemsTable) continue;
        try {
          const itemRow = await sql.unsafe(`
            SELECT "item_type", "rarity"
            FROM "${mudSchema}"."${itemsTable}"
            WHERE "item_id" = $1
            LIMIT 1
          `, [itemIds[i]]);
          if (itemRow.length === 0) continue;

          const rarity = Number(itemRow[0].rarity || 0);
          if (rarity < 2) continue; // Skip Worn (0) and Common (1)

          emittedLoot.add(itemDedupKey);

          const typeName = ITEM_TYPE_NAMES[Number(itemRow[0].item_type)] || 'Item';
          const rarityName = RARITY_NAMES[rarity] || '';
          // Resolve actual item name from on-chain URI metadata
          const resolvedName = await lookupItemName(itemIds[i], syncHandle);
          const displayName = resolvedName || `${typeName}`;
          const fullItemName = rarityName ? `${rarityName} ${displayName}` : displayName;
          const eventType = rarity >= 3 ? 'rare_find' : 'loot_drop';

          const event: GameEvent = {
            id: crypto.randomUUID(),
            eventType,
            playerName: name,
            description: eventDesc.lootDrop(name, fullItemName),
            timestamp: Date.now(),
            metadata: { itemId: itemIds[i], rarity, itemType: typeName, itemName: fullItemName },
          };
          addEvent(event, toBlock, `loot:${itemDedupKey}`);
          broadcaster.broadcastGameEvent(event);
        } catch {
          // Fall back — skip this item
        }
      }
    }
  } catch (err) {
    console.error('[eventFeed] Loot scan error:', err);
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
    const rows = await sql.unsafe(query, [fromBlock, toBlock]);

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
      addEvent(event, toBlock, `character:${keyHex}`);
      broadcaster.broadcastGameEvent(event);
    }
  } catch (err) {
    console.error('[eventFeed] New character scan error:', err);
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
    `, [fromBlock, toBlock]);

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
        metadata: { className },
      };
      addEvent(event, toBlock, `class:${dedupKey}`);
      broadcaster.broadcastGameEvent(event);
    }
  } catch (err) {
    console.error('[eventFeed] Class selection scan error:', err);
  }
}

/** Scan for players who collected all 8 lore fragments */
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
    // Find characters who just triggered a fragment in this block range,
    // then check if they now have all 8 fragments
    const rows = await sql.unsafe(`
      SELECT fp."character_id", c."name",
             (SELECT COUNT(*) FROM "${mudSchema}"."${fragmentTable}" fp2
              WHERE fp2."character_id" = fp."character_id" AND fp2."triggered" = true) as total_fragments
      FROM "${mudSchema}"."${fragmentTable}" fp
      LEFT JOIN "${mudSchema}"."${charactersTable}" c
        ON fp."character_id" = c."__key_bytes"
      WHERE fp."__last_updated_block_number" >= $1
        AND fp."__last_updated_block_number" <= $2
        AND fp."triggered" = true
      GROUP BY fp."character_id", c."name"
    `, [fromBlock, toBlock]);

    for (const row of rows) {
      const totalFragments = Number(row.total_fragments);
      if (totalFragments < 8) continue; // Only celebrate the full collection

      const charKeyHex = Buffer.isBuffer(row.character_id) ? row.character_id.toString('hex') : String(row.character_id);
      const dedupKey = `all_fragments:${charKeyHex}`;
      if (emittedFragments.has(dedupKey)) continue;
      emittedFragments.add(dedupKey);

      const name = decodeCharacterName(row.name) || 'An adventurer';

      const event: GameEvent = {
        id: crypto.randomUUID(),
        eventType: 'fragment_found',
        playerName: name,
        description: eventDesc.allFragments(name),
        timestamp: Date.now(),
        metadata: { totalFragments },
      };
      addEvent(event, toBlock, dedupKey);
      broadcaster.broadcastGameEvent(event);
    }
  } catch (err) {
    console.error('[eventFeed] Fragment scan error:', err);
  }
}

/** Scan for new marketplace listings of Uncommon+ items */
async function scanMarketplaceListings(
  syncHandle: SyncHandle,
  fromBlock: number,
  toBlock: number,
  broadcaster: Broadcaster,
) {
  const ordersTable = syncHandle.tableNameMap.get('Orders');
  const offersTable = syncHandle.tableNameMap.get('Offers');
  const considerationsTable = syncHandle.tableNameMap.get('Considerations');
  const itemsTable = syncHandle.tableNameMap.get('Items');
  const charactersTable = syncHandle.tableNameMap.get('Characters');
  if (!ordersTable || !offersTable || !itemsTable || !charactersTable) return;

  try {
    // Find newly active orders offering ERC1155 items (tokenType 3 = ERC1155)
    const query = considerationsTable
      ? `SELECT o."__key_bytes", o."offerer",
                f."identifier" as item_id,
                con."amount" as price
         FROM "${mudSchema}"."${ordersTable}" o
         JOIN "${mudSchema}"."${offersTable}" f ON o."__key_bytes" = f."__key_bytes"
         LEFT JOIN "${mudSchema}"."${considerationsTable}" con ON o."__key_bytes" = con."__key_bytes"
         WHERE o."__last_updated_block_number" >= $1
           AND o."__last_updated_block_number" <= $2
           AND o."order_status" = 1
           AND f."token_type" = 3`
      : `SELECT o."__key_bytes", o."offerer",
                f."identifier" as item_id
         FROM "${mudSchema}"."${ordersTable}" o
         JOIN "${mudSchema}"."${offersTable}" f ON o."__key_bytes" = f."__key_bytes"
         WHERE o."__last_updated_block_number" >= $1
           AND o."__last_updated_block_number" <= $2
           AND o."order_status" = 1
           AND f."token_type" = 3`;

    const rows = await sql.unsafe(query, [fromBlock, toBlock]);

    for (const row of rows) {
      const keyHex = Buffer.isBuffer(row.__key_bytes)
        ? row.__key_bytes.toString('hex')
        : String(row.__key_bytes);
      if (emittedListings.has(keyHex)) continue;

      // Look up item rarity
      const itemRow = await sql.unsafe(`
        SELECT "item_type", "rarity"
        FROM "${mudSchema}"."${itemsTable}"
        WHERE "item_id" = $1 LIMIT 1
      `, [row.item_id]);
      if (itemRow.length === 0) continue;

      const rarity = Number(itemRow[0].rarity || 0);
      if (rarity < 2) continue; // Skip Worn and Common

      emittedListings.add(keyHex);

      // Look up seller character name from wallet address
      let sellerName = 'A player';
      if (row.offerer) {
        try {
          const charRow = await sql.unsafe(`
            SELECT "name" FROM "${mudSchema}"."${charactersTable}"
            WHERE substring("__key_bytes" from 1 for 20) = $1
            LIMIT 1
          `, [row.offerer]);
          if (charRow.length > 0) {
            sellerName = decodeCharacterName(charRow[0].name) || 'A player';
          }
        } catch { /* fall through */ }
      }

      const typeName = ITEM_TYPE_NAMES[Number(itemRow[0].item_type)] || 'Item';
      const rarityName = RARITY_NAMES[rarity] || '';
      const resolvedName = await lookupItemName(row.item_id, syncHandle);
      const displayName = resolvedName || typeName;
      const fullItemName = rarityName ? `${rarityName} ${displayName}` : displayName;

      // Format gold price (18 decimals)
      let priceStr = '?';
      if (row.price) {
        try {
          const goldWei = BigInt(row.price);
          const gold = Number(goldWei / BigInt(10 ** 18));
          const frac = Number(goldWei % BigInt(10 ** 18)) / 1e18;
          priceStr = (gold + frac) > 0 ? String(Math.round((gold + frac) * 10) / 10) : '0';
        } catch {
          priceStr = '?';
        }
      }

      const event: GameEvent = {
        id: crypto.randomUUID(),
        eventType: 'marketplace_listing',
        playerName: sellerName,
        description: eventDesc.marketplaceListing(sellerName, fullItemName, priceStr),
        timestamp: Date.now(),
        metadata: {
          itemId: String(row.item_id),
          rarity,
          itemType: typeName,
          itemName: fullItemName,
          price: row.price ? String(row.price) : undefined,
          orderHash: '0x' + keyHex,
        },
      };
      addEvent(event, toBlock, `listing:${keyHex}`);
      broadcaster.broadcastGameEvent(event);
    }
  } catch (err) {
    console.error('[eventFeed] Marketplace scan error:', err);
  }
}

/** Look up a character name from a MUD packed attackers column */
async function lookupPlayerName(attackersRaw: unknown, charactersTable: string): Promise<string | null> {
  const entities = parsePackedBytes32(attackersRaw);
  if (entities.length === 0) {
    console.log(`[eventFeed] lookupPlayerName: parsePackedBytes32 returned empty. raw type=${typeof attackersRaw}, value=${JSON.stringify(attackersRaw)?.slice(0, 100)}`);
    return null;
  }
  try {
    // characterId is 32 bytes: first 20 = wallet address, last 12 = token index
    // Match on wallet address (first 20 bytes) since that's unique per player
    const walletBytes = entities[0].subarray(0, 20);
    const row = await sql.unsafe(`
      SELECT "name" FROM "${mudSchema}"."${charactersTable}"
      WHERE substring("__key_bytes" from 1 for 20) = $1 LIMIT 1
    `, [walletBytes]);
    if (row.length > 0) return decodeCharacterName(row[0].name);
    console.log(`[eventFeed] lookupPlayerName: no character found for wallet 0x${walletBytes.toString('hex')}`);
  } catch (err) {
    console.error('[eventFeed] lookupPlayerName error:', err);
  }
  return null;
}

/** Look up an item's display name from ItemsURIStorage */
async function lookupItemName(itemId: string | number, syncHandle: SyncHandle): Promise<string | null> {
  const uriTable = syncHandle.tableNameMap.get('ItemsURIStorage');
  if (!uriTable) {
    console.log(`[eventFeed] lookupItemName: ItemsURIStorage not in tableNameMap. Available: ${[...syncHandle.tableNameMap.keys()].filter(k => k.toLowerCase().includes('uri')).join(', ')}`);
    return null;
  }
  try {
    const row = await sql.unsafe(`
      SELECT "uri" FROM "${mudSchema}"."${uriTable}"
      WHERE "token_id" = $1 LIMIT 1
    `, [String(itemId)]);
    if (row.length > 0 && row[0].uri) {
      // URIs are "type:snake_case_name" e.g. "weapon:dire_rat_fang" → "Dire Rat Fang"
      const uri = String(row[0].uri);
      const parts = uri.split(':');
      if (parts.length >= 2) {
        return parts.slice(1).join(':')
          .split('_')
          .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
          .join(' ');
      }
    }
    console.log(`[eventFeed] lookupItemName: no URI found for item ${itemId} in ${uriTable}`);
  } catch (err) {
    console.error('[eventFeed] lookupItemName error:', err);
  }
  return null;
}

/**
 * Parse a MUD dynamic bytes32[] column into Buffer array.
 * MUD decoded mode stores these as text containing JSON: '{"json":["0x...","0x..."]}'
 * postgres.js may also return them as {json: [...]} objects.
 */
function parsePackedBytes32(raw: unknown): Buffer[] {
  if (!raw) return [];

  // Unwrap postgres.js {json: [...]} wrapper
  if (typeof raw === 'object' && raw !== null && !Array.isArray(raw) && 'json' in raw) {
    raw = (raw as Record<string, unknown>).json;
  }
  // Unwrap string-serialized jsonb: '{"json":[...]}'
  if (typeof raw === 'string' && raw.startsWith('{"json":')) {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && 'json' in parsed) raw = parsed.json;
    } catch { /* fall through */ }
  }
  // Handle array of hex strings (most common after unwrapping)
  if (Array.isArray(raw)) {
    return raw
      .map(v => {
        const h = String(v);
        if (h.startsWith('0x') && h.length === 66) return Buffer.from(h.slice(2), 'hex');
        return null;
      })
      .filter((b): b is Buffer => b !== null);
  }
  // Handle raw Buffer/Uint8Array
  if (Buffer.isBuffer(raw) || raw instanceof Uint8Array) {
    const buf = Buffer.from(raw);
    const elements: Buffer[] = [];
    for (let i = 0; i < buf.length; i += 32) {
      if (i + 32 <= buf.length) elements.push(buf.subarray(i, i + 32));
    }
    return elements;
  }
  // Handle packed hex string
  const hex = String(raw);
  if (!hex.startsWith('0x') || hex.length < 66) return [];
  const packed = hex.slice(2);
  const elements: Buffer[] = [];
  for (let i = 0; i < packed.length; i += 64) {
    if (i + 64 <= packed.length) {
      elements.push(Buffer.from(packed.slice(i, i + 64), 'hex'));
    }
  }
  return elements;
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
