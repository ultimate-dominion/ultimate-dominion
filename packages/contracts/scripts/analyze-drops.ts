/**
 * Analyze last hour of on-chain combat data for drop rate tuning.
 *
 * Queries the indexer PostgreSQL (which mirrors on-chain state) for:
 * - All combat outcomes in the last hour
 * - Item drops by rarity tier
 * - Elite vs normal mob breakdown
 * - Fight frequency per player
 * - Health potion drop rates
 * - Projected daily rates at 10 concurrent players
 *
 * Usage:
 *   npx tsx scripts/analyze-drops.ts
 */

import postgres from 'postgres';

const DB_URL = process.env.DATABASE_PUBLIC_URL
  || 'postgresql://postgres:LyiHVtbzDZzJWgcTDdeNpuJnkYbukpXl@mainline.proxy.rlwy.net:24965/railway';
const DECODED_SCHEMA = '0x99d01939f58b965e6e84a1d167e710abdf5764b0';

// Item ID → name/rarity mapping from items.json + game-balance.md
const ITEM_INFO: Record<number, { name: string; rarity: number; type: string }> = {
  // Armor R0
  1: { name: 'Tattered Cloth', rarity: 0, type: 'armor' },
  2: { name: 'Worn Leather Vest', rarity: 0, type: 'armor' },
  3: { name: 'Rusty Chainmail', rarity: 0, type: 'armor' },
  // Armor R1
  4: { name: 'Padded Armor', rarity: 1, type: 'armor' },
  5: { name: 'Leather Jerkin', rarity: 1, type: 'armor' },
  6: { name: 'Apprentice Robes', rarity: 1, type: 'armor' },
  7: { name: 'Studded Leather', rarity: 1, type: 'armor' },
  8: { name: 'Scout Armor', rarity: 1, type: 'armor' },
  9: { name: 'Acolyte Vestments', rarity: 1, type: 'armor' },
  10: { name: 'Chainmail Shirt', rarity: 1, type: 'armor' },
  11: { name: 'Ranger Leathers', rarity: 1, type: 'armor' },
  12: { name: 'Mage Robes', rarity: 1, type: 'armor' },
  // Weapons R0
  13: { name: 'Broken Sword', rarity: 0, type: 'weapon' },
  14: { name: 'Worn Shortbow', rarity: 0, type: 'weapon' },
  15: { name: 'Cracked Wand', rarity: 0, type: 'weapon' },
  // Weapons R1
  16: { name: 'Iron Axe', rarity: 1, type: 'weapon' },
  17: { name: 'Hunting Bow', rarity: 1, type: 'weapon' },
  18: { name: 'Apprentice Staff', rarity: 1, type: 'weapon' },
  19: { name: 'Steel Mace', rarity: 1, type: 'weapon' },
  20: { name: 'Recurve Bow', rarity: 1, type: 'weapon' },
  21: { name: 'Channeling Rod', rarity: 1, type: 'weapon' },
  // Weapons R2
  22: { name: 'Runesword', rarity: 2, type: 'weapon' },
  23: { name: 'Warhammer', rarity: 2, type: 'weapon' },
  24: { name: 'Longbow', rarity: 2, type: 'weapon' },
  25: { name: 'Mage Staff', rarity: 2, type: 'weapon' },
  // Monster weapons (0% drop)
  26: { name: 'Venomous Bite', rarity: 99, type: 'monster_weapon' },
  27: { name: 'Crushing Slam', rarity: 99, type: 'monster_weapon' },
  28: { name: 'Razor Claws', rarity: 99, type: 'monster_weapon' },
  29: { name: 'Dark Magic', rarity: 99, type: 'monster_weapon' },
  30: { name: 'Elemental Burst', rarity: 99, type: 'monster_weapon' },
  31: { name: 'Stone Fist', rarity: 99, type: 'monster_weapon' },
  32: { name: 'Shadow Strike', rarity: 99, type: 'monster_weapon' },
  // Consumables
  33: { name: 'Minor Health Potion', rarity: 0, type: 'consumable_hp' },
  34: { name: 'Health Potion', rarity: 1, type: 'consumable_hp' },
  35: { name: 'Greater Health Potion', rarity: 2, type: 'consumable_hp' },
  36: { name: 'Fortifying Stew', rarity: 1, type: 'consumable_buff' },
  37: { name: 'Quickening Berries', rarity: 1, type: 'consumable_buff' },
  38: { name: 'Focusing Tea', rarity: 1, type: 'consumable_buff' },
  39: { name: 'Antidote', rarity: 1, type: 'consumable_utility' },
  40: { name: 'Smoke Bomb', rarity: 2, type: 'consumable_utility' },
  74: { name: 'Flashpowder', rarity: 2, type: 'consumable_utility' },
  75: { name: 'Antidote', rarity: 1, type: 'consumable_utility' },
};

// Rarity tier names
const RARITY_NAMES: Record<number, string> = {
  0: 'R0 Worn/Junk',
  1: 'R1 Common',
  2: 'R2 Uncommon',
  3: 'R3 Rare',
  4: 'R4 Epic',
  5: 'R5 Legendary',
  99: 'Monster Weapon (no drop)',
};

async function main() {
  const sql = postgres(DB_URL, { max: 5 });

  console.log('=== DROP RATE ANALYSIS — Last Hour On-Chain Data ===\n');

  // 1. Get all characters
  console.log('Loading characters...');
  const characters = await sql.unsafe(
    `SELECT __key_bytes, name, owner FROM "${DECODED_SCHEMA}"."ud__characters"`,
  );
  const charMap = new Map<string, { name: string; owner: string }>();
  for (const c of characters) {
    const keyHex = '0x' + (c.__key_bytes as Buffer).toString('hex');
    // bytes32 name → string (strip trailing null bytes)
    const nameBytes = c.name as Buffer;
    let name: string;
    if (Buffer.isBuffer(nameBytes)) {
      name = nameBytes.toString('utf8').replace(/\0/g, '');
    } else if (typeof c.name === 'string') {
      // May already be decoded
      if (c.name.startsWith('0x')) {
        name = Buffer.from(c.name.slice(2), 'hex').toString('utf8').replace(/\0/g, '');
      } else {
        name = c.name;
      }
    } else {
      name = String(c.name);
    }
    charMap.set(keyHex, { name, owner: c.owner });
  }
  console.log(`  Found ${charMap.size} characters`);

  // 2. Get current time and calculate 1 hour ago
  const now = Math.floor(Date.now() / 1000);
  const oneHourAgo = now - 3600;

  // 3. Get all combat outcomes from the last hour
  console.log('\nQuerying combat outcomes (last hour)...');
  const outcomes = await sql.unsafe(
    `SELECT co.*, ce.attackers, ce.defenders, ce.attackers_are_mobs
     FROM "${DECODED_SCHEMA}"."ud__combat_outcome" co
     JOIN "${DECODED_SCHEMA}"."ud__combat_encounter" ce
       ON co.__key_bytes = ce.__key_bytes
     WHERE co.end_time > $1
     ORDER BY co.end_time ASC`,
    [oneHourAgo.toString()],
  );
  console.log(`  Found ${outcomes.length} completed encounters in last hour`);

  if (outcomes.length === 0) {
    console.log('\nNo combat data in the last hour. Trying last 2 hours...');
    const twoHoursAgo = now - 7200;
    const outcomes2 = await sql.unsafe(
      `SELECT co.*, ce.attackers, ce.defenders, ce.attackers_are_mobs
       FROM "${DECODED_SCHEMA}"."ud__combat_outcome" co
       JOIN "${DECODED_SCHEMA}"."ud__combat_encounter" ce
         ON co.__key_bytes = ce.__key_bytes
       WHERE co.end_time > $1
       ORDER BY co.end_time ASC`,
      [twoHoursAgo.toString()],
    );
    console.log(`  Found ${outcomes2.length} encounters in last 2 hours`);

    if (outcomes2.length === 0) {
      // Try to see what the most recent data is
      const latest = await sql.unsafe(
        `SELECT end_time FROM "${DECODED_SCHEMA}"."ud__combat_outcome" ORDER BY end_time DESC LIMIT 5`,
      );
      if (latest.length > 0) {
        for (const r of latest) {
          const t = Number(r.end_time);
          const ago = now - t;
          console.log(`  Latest encounter: ${new Date(t * 1000).toISOString()} (${Math.round(ago / 60)} min ago)`);
        }
      }
      await sql.end();
      return;
    }
  }

  // If we didn't find data in 1 hour, let's widen the window
  // Actually, let's just query ALL recent data and figure out the time window
  console.log('\nQuerying all recent combat outcomes...');
  const allOutcomes = await sql.unsafe(
    `SELECT co.end_time, co.attackers_win, co.player_fled, co.exp_dropped, co.gold_dropped, co.items_dropped,
            ce.attackers, ce.defenders, ce.attackers_are_mobs
     FROM "${DECODED_SCHEMA}"."ud__combat_outcome" co
     JOIN "${DECODED_SCHEMA}"."ud__combat_encounter" ce
       ON co.__key_bytes = ce.__key_bytes
     ORDER BY co.end_time DESC
     LIMIT 1000`,
  );

  // Find time range of data
  const times = allOutcomes.map((o: any) => Number(o.end_time)).filter((t: number) => t > 0);
  const maxTime = Math.max(...times);
  const minTime = Math.min(...times);
  console.log(`  Data range: ${new Date(minTime * 1000).toISOString()} to ${new Date(maxTime * 1000).toISOString()}`);
  console.log(`  Latest fight: ${Math.round((now - maxTime) / 60)} min ago`);
  console.log(`  Total encounters loaded: ${allOutcomes.length}`);

  // Filter to a reasonable analysis window — use last 2 hours or the natural cluster
  const analysisWindowStart = maxTime - 7200; // 2 hours back from latest fight
  const recentOutcomes = allOutcomes.filter((o: any) => Number(o.end_time) >= analysisWindowStart);
  const windowMinutes = (maxTime - Math.max(analysisWindowStart, Number(recentOutcomes[recentOutcomes.length - 1]?.end_time || 0))) / 60;

  console.log(`\n--- Analysis Window: last ${Math.round(windowMinutes)} minutes (${recentOutcomes.length} fights) ---\n`);

  // 4. Parse encounters — identify players, mobs, drops
  let totalFights = 0;
  let playerWins = 0;
  let playerDeaths = 0;
  let playerFlees = 0;
  const playerFightCounts = new Map<string, number>();
  const allDrops: number[] = [];
  const dropsByRarity = new Map<number, number>();
  const dropsByItem = new Map<number, number>();
  const hpPotionDrops: number[] = []; // item IDs of HP potions dropped
  let fightsWithDrops = 0;
  let fightsWithNoDrops = 0;

  // Track monster levels killed
  const monsterLevelKills = new Map<number, number>();

  for (const outcome of recentOutcomes) {
    const endTime = Number(outcome.end_time);
    if (endTime === 0) continue;

    totalFights++;

    // Parse attackers/defenders arrays
    let attackers: string[] = [];
    let defenders: string[] = [];
    try {
      const atkRaw = outcome.attackers;
      const defRaw = outcome.defenders;
      if (typeof atkRaw === 'string') {
        attackers = JSON.parse(atkRaw)?.json || JSON.parse(atkRaw) || [];
      } else if (Array.isArray(atkRaw)) {
        attackers = atkRaw;
      } else if (atkRaw?.json) {
        attackers = atkRaw.json;
      }
      if (typeof defRaw === 'string') {
        defenders = JSON.parse(defRaw)?.json || JSON.parse(defRaw) || [];
      } else if (Array.isArray(defRaw)) {
        defenders = defRaw;
      } else if (defRaw?.json) {
        defenders = defRaw.json;
      }
    } catch {
      // skip parse failures
    }

    // Determine who's the player
    const attackersAreMobs = outcome.attackers_are_mobs;
    const players = attackersAreMobs ? defenders : attackers;

    for (const p of players) {
      const pHex = typeof p === 'string' ? p.toLowerCase() : '0x' + (p as Buffer).toString('hex');
      const charInfo = charMap.get(pHex);
      const playerName = charInfo?.name || pHex.slice(0, 10);
      playerFightCounts.set(playerName, (playerFightCounts.get(playerName) || 0) + 1);
    }

    // Win/loss/flee
    if (outcome.player_fled) {
      playerFlees++;
    } else if (outcome.attackers_win) {
      if (!attackersAreMobs) playerWins++;
      else playerDeaths++;
    } else {
      if (attackersAreMobs) playerWins++;
      else playerDeaths++;
    }

    // Item drops
    let itemsDropped: number[] = [];
    try {
      const raw = outcome.items_dropped;
      if (typeof raw === 'string') {
        const parsed = JSON.parse(raw);
        itemsDropped = (parsed?.json || parsed || []).map(Number);
      } else if (Array.isArray(raw)) {
        itemsDropped = raw.map(Number);
      } else if (raw?.json) {
        itemsDropped = raw.json.map(Number);
      }
    } catch {
      // skip
    }

    if (itemsDropped.length > 0) {
      fightsWithDrops++;
      for (const itemId of itemsDropped) {
        allDrops.push(itemId);
        const info = ITEM_INFO[itemId];
        const rarity = info?.rarity ?? -1;
        dropsByRarity.set(rarity, (dropsByRarity.get(rarity) || 0) + 1);
        dropsByItem.set(itemId, (dropsByItem.get(itemId) || 0) + 1);

        // Track HP potions
        if (info?.type?.startsWith('consumable_hp')) {
          hpPotionDrops.push(itemId);
        }
      }
    } else {
      fightsWithNoDrops++;
    }
  }

  // 5. Now query Items table for on-chain drop chances
  console.log('Loading on-chain item data...');
  const itemRows = await sql.unsafe(
    `SELECT item_id, item_type, drop_chance, rarity FROM "${DECODED_SCHEMA}"."ud__items"
     ORDER BY item_id ASC`,
  );

  // Update our item info with on-chain rarity
  const onChainItems = new Map<number, { dropChance: number; rarity: number; itemType: number }>();
  for (const row of itemRows) {
    const id = Number(row.item_id);
    onChainItems.set(id, {
      dropChance: Number(row.drop_chance),
      rarity: Number(row.rarity),
      itemType: Number(row.item_type),
    });
  }

  // 6. Check MobStats for elite info — query all mob entities from recent encounters
  console.log('Loading mob stats (elite detection)...');
  const mobStatsRows = await sql.unsafe(
    `SELECT __key_bytes, is_elite FROM "${DECODED_SCHEMA}"."ud__mob_stats"`,
  );
  const eliteMobs = new Set<string>();
  let totalMobEntities = 0;
  let eliteCount = 0;
  for (const row of mobStatsRows) {
    totalMobEntities++;
    if (row.is_elite) {
      eliteCount++;
      eliteMobs.add((row.__key_bytes as Buffer).toString('hex'));
    }
  }

  // 7. Get monster level distribution from Stats table for mobs (non-characters)
  // Actually, let's query WorldEncounter to get the entities involved in recent encounters
  console.log('Loading encounter entities for elite analysis...');
  const recentEncounterIds = await sql.unsafe(
    `SELECT __key_bytes FROM "${DECODED_SCHEMA}"."ud__combat_outcome"
     WHERE end_time > $1 ORDER BY end_time DESC`,
    [analysisWindowStart.toString()],
  );

  let eliteFights = 0;
  let normalFights = 0;
  for (const enc of recentEncounterIds) {
    const encKeyHex = (enc.__key_bytes as Buffer).toString('hex');
    // Check WorldEncounter for this encounter to get the entity (mob)
    const worldEnc = await sql.unsafe(
      `SELECT entity FROM "${DECODED_SCHEMA}"."ud__world_encounter" WHERE __key_bytes = $1`,
      [enc.__key_bytes],
    );
    if (worldEnc.length > 0 && worldEnc[0].entity) {
      let entityHex: string;
      if (Buffer.isBuffer(worldEnc[0].entity)) {
        entityHex = worldEnc[0].entity.toString('hex');
      } else {
        entityHex = String(worldEnc[0].entity).replace(/^0x/, '').toLowerCase();
      }
      if (eliteMobs.has(entityHex)) {
        eliteFights++;
      } else {
        normalFights++;
      }
    }
  }

  // ==================== OUTPUT ====================
  console.log('\n' + '='.repeat(70));
  console.log('                    DROP RATE ANALYSIS REPORT');
  console.log('='.repeat(70));

  console.log(`\n## Fight Summary`);
  console.log(`  Total fights: ${totalFights}`);
  console.log(`  Wins: ${playerWins} | Deaths: ${playerDeaths} | Flees: ${playerFlees}`);
  console.log(`  Win rate: ${totalFights > 0 ? ((playerWins / totalFights) * 100).toFixed(1) : 0}%`);
  console.log(`  Time window: ~${Math.round(windowMinutes)} minutes`);
  console.log(`  Fight rate: ${(totalFights / windowMinutes).toFixed(2)} fights/min (${(totalFights / windowMinutes * 60).toFixed(1)} fights/hr)`);

  console.log(`\n## Per-Player Breakdown`);
  for (const [name, count] of [...playerFightCounts.entries()].sort((a, b) => b[1] - a[1])) {
    const fightsPerHour = count / windowMinutes * 60;
    console.log(`  ${name}: ${count} fights (${fightsPerHour.toFixed(1)}/hr)`);
  }

  console.log(`\n## Elite vs Normal`);
  console.log(`  Elite fights: ${eliteFights} (${totalFights > 0 ? ((eliteFights / totalFights) * 100).toFixed(1) : 0}%)`);
  console.log(`  Normal fights: ${normalFights}`);
  console.log(`  Total mob entities ever: ${totalMobEntities} (${eliteCount} elite = ${((eliteCount / totalMobEntities) * 100).toFixed(1)}%)`);

  console.log(`\n## Drop Overview`);
  console.log(`  Total items dropped: ${allDrops.length}`);
  console.log(`  Fights with drops: ${fightsWithDrops} / ${totalFights} (${((fightsWithDrops / totalFights) * 100).toFixed(1)}%)`);
  console.log(`  Items per fight: ${(allDrops.length / totalFights).toFixed(3)}`);

  console.log(`\n## Drops by Rarity`);
  for (const rarity of [0, 1, 2, 3, 4, 5]) {
    const count = dropsByRarity.get(rarity) || 0;
    if (count > 0 || rarity <= 4) {
      const perFight = count / totalFights;
      const perHourPerPlayer = count / windowMinutes * 60 / Math.max(playerFightCounts.size, 1);
      const perDay10Players = perHourPerPlayer * 24 * 10;
      console.log(`  ${RARITY_NAMES[rarity] || `R${rarity}`}: ${count} drops (${perFight.toFixed(4)}/fight, ~${perHourPerPlayer.toFixed(2)}/hr/player, ~${perDay10Players.toFixed(1)}/day @ 10 players)`);
    }
  }

  console.log(`\n## Drops by Item (sorted by count)`);
  const sortedItems = [...dropsByItem.entries()].sort((a, b) => b[1] - a[1]);
  for (const [itemId, count] of sortedItems) {
    const info = ITEM_INFO[itemId];
    const onChain = onChainItems.get(itemId);
    const rarityStr = onChain ? `R${onChain.rarity}` : (info ? `R${info.rarity}` : '?');
    const name = info?.name || `Item #${itemId}`;
    const dropChance = onChain?.dropChance || '?';
    const perFight = count / totalFights;
    console.log(`  ${name} (ID:${itemId}, ${rarityStr}, chance:${dropChance}/100k): ${count}x (${perFight.toFixed(4)}/fight)`);
  }

  console.log(`\n## Health Potion Analysis`);
  const minorHpCount = dropsByItem.get(33) || 0;
  const hpCount = dropsByItem.get(34) || 0;
  const greaterHpCount = dropsByItem.get(35) || 0;
  const totalHp = minorHpCount + hpCount + greaterHpCount;
  console.log(`  Minor HP (ID:33): ${minorHpCount} drops`);
  console.log(`  Health Potion (ID:34): ${hpCount} drops`);
  console.log(`  Greater HP (ID:35): ${greaterHpCount} drops`);
  console.log(`  Total HP potions: ${totalHp} (${(totalHp / totalFights).toFixed(4)}/fight)`);
  console.log(`  Fights per HP potion: ${totalHp > 0 ? (totalFights / totalHp).toFixed(1) : 'N/A'}`);

  // 8. Theoretical analysis — what SHOULD rates be?
  console.log(`\n${'='.repeat(70)}`);
  console.log('             THEORETICAL RATE ANALYSIS');
  console.log('='.repeat(70));

  // Average fights per hour per player (from observed data)
  const avgFightsPerHourPerPlayer = totalFights / windowMinutes * 60 / Math.max(playerFightCounts.size, 1);
  const fightsPerDayPerPlayer = avgFightsPerHourPerPlayer * 24;
  // Assume active play is maybe 4-6 hours
  const activeHoursPerDay = 5;
  const fightsPerActiveDayPerPlayer = avgFightsPerHourPerPlayer * activeHoursPerDay;

  console.log(`\n## Observed Fight Rate`);
  console.log(`  Avg fights/hr/player: ${avgFightsPerHourPerPlayer.toFixed(1)}`);
  console.log(`  At ${activeHoursPerDay}hr active play: ${fightsPerActiveDayPerPlayer.toFixed(0)} fights/day/player`);

  // Michael's targets (per day, 10 concurrent players)
  const TARGETS = {
    rare: 2,        // R3 per day (total across 10 players)
    epic: 0.5,      // R4 per day
    common: 5,      // R1 per day
    uncommon: 20,    // R2 per day
  };

  console.log(`\n## Michael's Targets (per day, 10 concurrent players)`);
  console.log(`  R1 Common: ${TARGETS.common}/day`);
  console.log(`  R2 Uncommon: ${TARGETS.uncommon}/day`);
  console.log(`  R3 Rare: ${TARGETS.rare}/day`);
  console.log(`  R4 Epic: ${TARGETS.epic}/day`);

  // Calculate required drop chances
  // Total fights per day = fights/hr/player × active_hours × 10 players
  const totalFightsPerDay10 = avgFightsPerHourPerPlayer * activeHoursPerDay * 10;
  // Each fight rolls against ~N items on the monster's loot table
  // Average items in a monster's inventory: roughly 5-8 items per mob
  // But each item has its OWN independent roll. So: P(at least one R3 drop per fight) depends on
  // how many R3 items are in the loot table.
  //
  // Simpler: treat "target R3 drops/day" / "total fights/day" = required R3 drop rate per fight
  // Then: required per-item dropChance = perFightRate / avgR3ItemsPerLootTable

  // Count how many items of each rarity appear across all monster loot tables
  // We need to read monster inventories for this
  const mobInventories = await sql.unsafe(
    `SELECT mob_id, inventory FROM "${DECODED_SCHEMA}"."ud__mob_stats"
     WHERE mob_id IS NOT NULL`,
  );

  // Actually, mob_stats uses bytes32 mob_id key. Let's try the Mobs table
  const mobsData = await sql.unsafe(
    `SELECT mob_id, mob_stats FROM "${DECODED_SCHEMA}"."ud__mobs"`,
  );

  console.log(`\n## Monster Loot Table Analysis`);
  let totalR0InLootTables = 0;
  let totalR1InLootTables = 0;
  let totalR2InLootTables = 0;
  let totalR3InLootTables = 0;
  let totalR4InLootTables = 0;
  let totalConsumableHpInLootTables = 0;
  let totalItemsInLootTables = 0;
  let numMobs = 0;

  // Parse mob inventories from mob_stats table
  const mobInvRows = await sql.unsafe(
    `SELECT inventory FROM "${DECODED_SCHEMA}"."ud__mob_stats"`,
  );
  for (const row of mobInvRows) {
    let inv: number[] = [];
    try {
      const raw = row.inventory;
      if (typeof raw === 'string') {
        const parsed = JSON.parse(raw);
        inv = (parsed?.json || parsed || []).map(Number);
      } else if (Array.isArray(raw)) {
        inv = raw.map(Number);
      } else if (raw?.json) {
        inv = raw.json.map(Number);
      }
    } catch { continue; }

    if (inv.length === 0) continue;
    numMobs++;
    totalItemsInLootTables += inv.length;

    for (const itemId of inv) {
      const onChain = onChainItems.get(itemId);
      const info = ITEM_INFO[itemId];
      const rarity = onChain?.rarity ?? info?.rarity ?? -1;

      if (rarity === 0) totalR0InLootTables++;
      else if (rarity === 1) totalR1InLootTables++;
      else if (rarity === 2) totalR2InLootTables++;
      else if (rarity === 3) totalR3InLootTables++;
      else if (rarity === 4) totalR4InLootTables++;

      if (info?.type?.startsWith('consumable_hp')) {
        totalConsumableHpInLootTables++;
      }
    }
  }

  const avgItemsPerMob = totalItemsInLootTables / numMobs;
  console.log(`  ${numMobs} mobs, avg ${avgItemsPerMob.toFixed(1)} items/loot table`);
  console.log(`  R0 slots: ${totalR0InLootTables} (across all mobs)`);
  console.log(`  R1 slots: ${totalR1InLootTables}`);
  console.log(`  R2 slots: ${totalR2InLootTables}`);
  console.log(`  R3 slots: ${totalR3InLootTables}`);
  console.log(`  R4 slots: ${totalR4InLootTables}`);
  console.log(`  HP potion slots: ${totalConsumableHpInLootTables}`);

  // Calculate required dropChance values
  console.log(`\n## Required dropChance Values (per 100000)`);
  console.log(`  Based on ${totalFightsPerDay10.toFixed(0)} total fights/day (10 players × ${fightsPerActiveDayPerPlayer.toFixed(0)} fights/player × ${activeHoursPerDay}hr active)`);

  // For each rarity: target drops/day = SUM over all fights of SUM over loot table items of (dropChance/100000)
  // = totalFights × avgSlotsOfThatRarity × (dropChance / 100000)
  // => dropChance = (target × 100000) / (totalFights × avgSlots)

  // Average R3 slots encountered per fight = totalR3InLootTables / numMobs (assumes equal mob distribution)
  const avgR0PerFight = totalR0InLootTables / numMobs;
  const avgR1PerFight = totalR1InLootTables / numMobs;
  const avgR2PerFight = totalR2InLootTables / numMobs;
  const avgR3PerFight = totalR3InLootTables / numMobs;
  const avgR4PerFight = totalR4InLootTables / numMobs;
  const avgHpPerFight = totalConsumableHpInLootTables / numMobs;

  console.log(`  Avg R0 items per fight: ${avgR0PerFight.toFixed(2)}`);
  console.log(`  Avg R1 items per fight: ${avgR1PerFight.toFixed(2)}`);
  console.log(`  Avg R2 items per fight: ${avgR2PerFight.toFixed(2)}`);
  console.log(`  Avg R3 items per fight: ${avgR3PerFight.toFixed(2)}`);
  console.log(`  Avg R4 items per fight: ${avgR4PerFight.toFixed(2)}`);
  console.log(`  Avg HP potion items per fight: ${avgHpPerFight.toFixed(2)}`);

  for (const [label, target, avgSlots] of [
    ['R1 Common', TARGETS.common, avgR1PerFight],
    ['R2 Uncommon', TARGETS.uncommon, avgR2PerFight],
    ['R3 Rare', TARGETS.rare, avgR3PerFight],
    ['R4 Epic', TARGETS.epic, avgR4PerFight],
  ] as [string, number, number][]) {
    if (avgSlots === 0) {
      console.log(`  ${label}: NO SLOTS in loot tables — can't drop!`);
      continue;
    }
    const requiredChance = (target * 100000) / (totalFightsPerDay10 * avgSlots);
    const currentChance = label.includes('R1') ? 5000 : label.includes('R2') ? 100 : label.includes('R3') ? 3 : 2;
    console.log(`  ${label}: need ${requiredChance.toFixed(1)}/100k (current: ${currentChance}/100k) → ${(requiredChance / currentChance).toFixed(1)}x change`);
  }

  // Elite analysis
  console.log(`\n## Elite Impact (CURRENT — before multiplier fix)`);
  console.log(`  Current system: ELITE_DROP_BONUS = 15000 (additive +15%)`);
  console.log(`  For R3 (base=3): elite gives 3+15000 = 15003/100k = 15% per R3 item`);
  console.log(`  For R4 (base=2): elite gives 2+15000 = 15002/100k = 15% per R4 item`);
  console.log(`  This makes EVERY rare/epic item have ~15% drop rate from elites!`);

  console.log(`\n## Elite Impact (AFTER fix — multiplicative 2x)`);
  console.log(`  New system: ELITE_DROP_MULTIPLIER = 200 (2x)`);
  console.log(`  For R3 (base=3): elite gives 3*200/100 = 6/100k = 0.006%`);
  console.log(`  For R4 (base=2): elite gives 2*200/100 = 4/100k = 0.004%`);

  // HP Potion sustainability analysis
  console.log(`\n## HP Potion Sustainability (L10 infinite farming target)`);
  const hpPotDropsPerFight = totalHp / totalFights;
  console.log(`  Current HP pot rate: ${hpPotDropsPerFight.toFixed(4)}/fight`);
  console.log(`  Fights per HP pot: ${totalHp > 0 ? (totalFights / totalHp).toFixed(1) : 'N/A'}`);
  console.log(`  For infinite farming at L10: player needs ~1 pot every 3-5 fights`);
  console.log(`  → Need pot rate of ~0.20-0.33 per fight`);
  const currentHpRate = hpPotDropsPerFight;
  const targetHpRate = 0.25; // 1 pot per 4 fights
  console.log(`  → Current: ${currentHpRate.toFixed(4)}/fight, need: ${targetHpRate.toFixed(2)}/fight`);
  if (currentHpRate > 0) {
    console.log(`  → Multiplier needed: ${(targetHpRate / currentHpRate).toFixed(1)}x`);
  }

  // Current drop chance values from on-chain
  console.log(`\n## Current On-Chain Drop Chances (from Items table)`);
  const seenRarities = new Map<number, number[]>();
  for (const [id, data] of onChainItems.entries()) {
    if (data.dropChance > 0) {
      if (!seenRarities.has(data.rarity)) seenRarities.set(data.rarity, []);
      seenRarities.get(data.rarity)!.push(data.dropChance);
    }
  }
  for (const [rarity, chances] of [...seenRarities.entries()].sort((a, b) => a[0] - b[0])) {
    const unique = [...new Set(chances)].sort((a, b) => a - b);
    console.log(`  R${rarity}: ${unique.join(', ')} (${chances.length} items)`);
  }

  // Check for R3/R4 items
  console.log(`\n## R3/R4 Items On-Chain`);
  for (const [id, data] of [...onChainItems.entries()].sort((a, b) => a[0] - b[0])) {
    if (data.rarity >= 3) {
      const info = ITEM_INFO[id];
      console.log(`  ID:${id} ${info?.name || '?'} — R${data.rarity}, dropChance=${data.dropChance}, type=${data.itemType}`);
    }
  }

  await sql.end();
  console.log('\nDone.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
