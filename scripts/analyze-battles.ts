/**
 * On-chain battle data analysis — compares real combat outcomes to sim expectations.
 * Usage: npx tsx scripts/analyze-battles.ts
 */

const INDEXER_URL = 'https://indexer-production-d6df.up.railway.app/api';
const DAYS_BACK = 5;
const CUTOFF_TS = Math.floor(Date.now() / 1000) - (DAYS_BACK * 24 * 60 * 60);

const MONSTER_BY_LEVEL: Record<number, { name: string; class: number; classLabel: string }> = {
  1: { name: 'Dire Rat', class: 1, classLabel: 'Rogue' },
  2: { name: 'Fungal Shaman', class: 2, classLabel: 'Mage' },
  3: { name: 'Cavern Brute', class: 0, classLabel: 'Warrior' },
  4: { name: 'Crystal Elemental', class: 2, classLabel: 'Mage' },
  5: { name: 'Ironhide Troll', class: 0, classLabel: 'Warrior' },
  6: { name: 'Phase Spider', class: 1, classLabel: 'Rogue' },
  7: { name: 'Bonecaster', class: 2, classLabel: 'Mage' },
  8: { name: 'Rock Golem', class: 0, classLabel: 'Warrior' },
  9: { name: 'Pale Stalker', class: 1, classLabel: 'Rogue' },
  10: { name: 'Dusk Drake', class: 2, classLabel: 'Mage' },
  12: { name: 'Basilisk', class: 0, classLabel: 'Warrior (Boss)' },
};

// Monster stats from monsters.json for sim comparison
const MONSTER_STATS: Record<number, { str: number; agi: number; int: number; hp: number; armor: number; class: number }> = {
  1:  { str: 3,  agi: 6,  int: 2,  hp: 10,  armor: 0, class: 1 },
  2:  { str: 3,  agi: 4,  int: 8,  hp: 12,  armor: 0, class: 2 },
  3:  { str: 7,  agi: 4,  int: 3,  hp: 14,  armor: 0, class: 0 },
  4:  { str: 4,  agi: 5,  int: 10, hp: 16,  armor: 1, class: 2 },
  5:  { str: 11, agi: 6,  int: 5,  hp: 26,  armor: 2, class: 0 },
  6:  { str: 8,  agi: 12, int: 5,  hp: 22,  armor: 0, class: 1 },
  7:  { str: 6,  agi: 7,  int: 13, hp: 26,  armor: 0, class: 2 },
  8:  { str: 14, agi: 8,  int: 7,  hp: 38,  armor: 3, class: 0 },
  9:  { str: 10, agi: 15, int: 7,  hp: 34,  armor: 0, class: 1 },
  10: { str: 13, agi: 13, int: 15, hp: 52,  armor: 2, class: 2 },
  12: { str: 17, agi: 12, int: 10, hp: 130, armor: 4, class: 0 },
};

function parseNum(val: any): number {
  if (typeof val === 'number') return val;
  if (typeof val === 'string') return Number(val);
  return 0;
}

function fromEther(val: any): number {
  const n = typeof val === 'string' ? Number(BigInt(val)) : Number(val);
  return n / 1e18;
}

function getDominantType(str: number, agi: number, int: number): string {
  if (str >= agi && str >= int) return 'STR';
  if (agi > str && agi >= int) return 'AGI';
  return 'INT';
}

function hasTriangleAdvantage(playerDominant: string, mobClass: number): 'advantage' | 'disadvantage' | 'neutral' {
  const mobType = { 0: 'STR', 1: 'AGI', 2: 'INT' }[mobClass];
  if (!mobType) return 'neutral';
  if ((playerDominant === 'STR' && mobType === 'AGI') ||
      (playerDominant === 'AGI' && mobType === 'INT') ||
      (playerDominant === 'INT' && mobType === 'STR')) return 'advantage';
  if ((playerDominant === 'STR' && mobType === 'INT') ||
      (playerDominant === 'AGI' && mobType === 'STR') ||
      (playerDominant === 'INT' && mobType === 'AGI')) return 'disadvantage';
  return 'neutral';
}

interface BattleRecord {
  encounterId: string;
  playerCharId: string;
  monsterEntityId: string;
  monsterLevel: number;
  monsterName: string;
  monsterClass: number;
  playerWon: boolean;
  playerFled: boolean;
  turns: number;
  xpDropped: number;
  goldDropped: number;
  itemsDropped: number[];
  startTime: number;
  endTime: number;
  playerStr: number;
  playerAgi: number;
  playerInt: number;
  playerLevel: number;
  playerMaxHp: number;
  mobStr: number;
  mobAgi: number;
  mobInt: number;
  mobHp: number;
  mobArmor: number;
  isElite: boolean;
  equippedWeapons: number[];
  actions: ActionRecord[];
}

interface ActionRecord {
  turn: number;
  attackNumber: number;
  itemId: number;
  attackerId: string;
  defenderId: string;
  attackerDamage: number;
  defenderDamage: number;
  attackerDied: boolean;
  defenderDied: boolean;
  damagePerHit: number[];
  effectIds: string[];
  timestamp: number;
}

async function main() {
  console.log('Fetching snapshot from indexer...');
  const resp = await fetch(`${INDEXER_URL}/snapshot`);
  if (!resp.ok) throw new Error(`Snapshot failed: ${resp.status}`);
  const data = await resp.json();
  const tables = data.tables;
  console.log(`Snapshot at block ${data.block}, ${Object.keys(tables).length} tables\n`);

  const combatEncounters = tables['CombatEncounter'] || {};
  const combatOutcomes = tables['CombatOutcome'] || {};
  const actionOutcomes = tables['ActionOutcome'] || {};
  const stats = tables['Stats'] || {};
  const charEquipment = tables['CharacterEquipment'] || {};
  const characters = tables['Characters'] || {};
  const mobStatsTable = tables['MobStats'] || {};
  const weaponStatsTable = tables['WeaponStats'] || {};
  const weaponScalingTable = tables['WeaponScaling'] || {};
  const itemsTable = tables['Items'] || {};
  const itemsMetadata = tables['ItemsMetadataURI'] || {};
  const classMultipliers = tables['ClassMultipliers'] || {};
  const effectsTable = tables['Effects'] || {};
  const statusEffectStats = tables['StatusEffectStats'] || {};

  // Build stats lookup by entityId
  const statsLookup: Record<string, any> = {};
  for (const [_k, s] of Object.entries(stats)) {
    statsLookup[s.entityId] = s;
  }

  // Build mob stats lookup by mobId
  const mobStatsLookup: Record<string, any> = {};
  for (const [_k, ms] of Object.entries(mobStatsTable)) {
    mobStatsLookup[ms.mobId] = ms;
  }

  // Build character equipment lookup
  const equipLookup: Record<string, any> = {};
  for (const [_k, eq] of Object.entries(charEquipment)) {
    equipLookup[eq.characterId] = eq;
  }

  // Build weapon info lookup
  const weaponInfo: Record<number, { minDmg: number; maxDmg: number; usesAgi: boolean; isMagic: boolean }> = {};
  for (const [_k, ws] of Object.entries(weaponStatsTable)) {
    const id = parseNum((ws as any).itemId);
    // Check if weapon uses AGI scaling
    let usesAgi = false;
    for (const [_wk, wsc] of Object.entries(weaponScalingTable)) {
      if (parseNum((wsc as any).itemId) === id) {
        usesAgi = (wsc as any).usesAgi === true;
        break;
      }
    }
    // Check item type for magic
    let isMagic = false;
    for (const [_ik, it] of Object.entries(itemsTable)) {
      if (parseNum((it as any).itemId) === id) {
        // itemType: 3 = Spell, check if weapon has magic damage
        const itemType = parseNum((it as any).itemType);
        isMagic = itemType === 3; // Spell type
        break;
      }
    }
    weaponInfo[id] = {
      minDmg: parseNum((ws as any).minDamage),
      maxDmg: parseNum((ws as any).maxDamage),
      usesAgi,
      isMagic,
    };
  }

  // Build combat outcome lookup by encounterId
  const outcomeLookup: Record<string, any> = {};
  for (const [_k, co] of Object.entries(combatOutcomes)) {
    outcomeLookup[co.encounterId] = co;
  }

  // Group action outcomes by encounterId
  const actionsByEncounter: Record<string, ActionRecord[]> = {};
  for (const [_k, ao] of Object.entries(actionOutcomes)) {
    const eid = (ao as any).encounterId;
    if (!eid) continue;
    const action: ActionRecord = {
      turn: parseNum((ao as any).currentTurn),
      attackNumber: parseNum((ao as any).attackNumber),
      itemId: parseNum((ao as any).itemId),
      attackerId: (ao as any).attackerId,
      defenderId: (ao as any).defenderId,
      attackerDamage: parseNum((ao as any).attackerDamageDelt),
      defenderDamage: parseNum((ao as any).defenderDamageDelt),
      attackerDied: (ao as any).attackerDied === true,
      defenderDied: (ao as any).defenderDied === true,
      damagePerHit: Array.isArray((ao as any).damagePerHit) ? (ao as any).damagePerHit.map(parseNum) : [],
      effectIds: Array.isArray((ao as any).effectIds) ? (ao as any).effectIds : [],
      timestamp: parseNum((ao as any).timestamp),
    };
    if (!actionsByEncounter[eid]) actionsByEncounter[eid] = [];
    actionsByEncounter[eid].push(action);
  }
  for (const actions of Object.values(actionsByEncounter)) {
    actions.sort((a, b) => a.turn - b.turn || a.attackNumber - b.attackNumber);
  }

  // Build battle records
  const battles: BattleRecord[] = [];
  let skipped = 0, tooOld = 0;

  for (const [_k, enc] of Object.entries(combatEncounters)) {
    const encounterId = (enc as any).encounterId;
    const endTime = parseNum((enc as any).end);
    if (endTime === 0) continue;
    if (endTime < CUTOFF_TS) { tooOld++; continue; }

    const attackersAreMobs = (enc as any).attackersAreMobs === true;
    if (attackersAreMobs) { skipped++; continue; }

    const attackers: string[] = (enc as any).attackers || [];
    const defenders: string[] = (enc as any).defenders || [];
    const playerCharId = attackers[0];
    const monsterEntityId = defenders[0];
    if (!playerCharId || !monsterEntityId) { skipped++; continue; }

    const outcome = outcomeLookup[encounterId];
    if (!outcome) { skipped++; continue; }

    const monsterStat = statsLookup[monsterEntityId];
    if (!monsterStat) { skipped++; continue; }

    const playerStat = statsLookup[playerCharId];
    const monsterLevel = parseNum(monsterStat.level);
    const monsterInfo = MONSTER_BY_LEVEL[monsterLevel] || { name: `Monster L${monsterLevel}`, class: -1, classLabel: 'Unknown' };

    // Check if elite (mob entity level can reveal via stat comparison)
    const baseMob = MONSTER_STATS[monsterLevel];
    const mobHpActual = parseNum(monsterStat.maxHp);
    const isElite = baseMob ? mobHpActual > baseMob.hp * 1.2 : false; // 1.5x HP for elite, threshold at 1.2x

    const equip = equipLookup[playerCharId] || {};

    battles.push({
      encounterId,
      playerCharId,
      monsterEntityId,
      monsterLevel,
      monsterName: monsterInfo.name,
      monsterClass: monsterInfo.class,
      playerWon: outcome.attackersWin === true,
      playerFled: outcome.playerFled === true,
      turns: parseNum((enc as any).currentTurn),
      xpDropped: parseNum(outcome.expDropped),
      goldDropped: fromEther(outcome.goldDropped),
      itemsDropped: Array.isArray(outcome.itemsDropped) ? outcome.itemsDropped.map(parseNum) : [],
      startTime: parseNum((enc as any).start),
      endTime,
      playerStr: playerStat ? parseNum(playerStat.strength) : 0,
      playerAgi: playerStat ? parseNum(playerStat.agility) : 0,
      playerInt: playerStat ? parseNum(playerStat.intelligence) : 0,
      playerLevel: playerStat ? parseNum(playerStat.level) : 0,
      playerMaxHp: playerStat ? parseNum(playerStat.maxHp) : 0,
      mobStr: parseNum(monsterStat.strength),
      mobAgi: parseNum(monsterStat.agility),
      mobInt: parseNum(monsterStat.intelligence),
      mobHp: mobHpActual,
      mobArmor: baseMob?.armor ?? 0,
      isElite,
      equippedWeapons: Array.isArray(equip.equippedWeapons) ? equip.equippedWeapons.map(parseNum) : [],
      actions: actionsByEncounter[encounterId] || [],
    });
  }

  console.log(`=== BATTLE DATA SUMMARY ===`);
  console.log(`Total encounters (all time): ${Object.keys(combatEncounters).length}`);
  console.log(`Analyzed PvE battles (last ${DAYS_BACK} days): ${battles.length}`);
  console.log(`Skipped: ${skipped} | Too old: ${tooOld}`);

  if (battles.length === 0) { console.log('\nNo battles to analyze.'); return; }

  // ===========================
  // WIN RATES BY MONSTER
  // ===========================
  console.log('\n\n========================================');
  console.log('  WIN RATES BY MONSTER');
  console.log('========================================\n');

  type MonsterBucket = { wins: number; losses: number; flees: number; totalTurns: number; battles: BattleRecord[] };
  const byMonster: Record<number, MonsterBucket> = {};
  for (const b of battles) {
    if (!byMonster[b.monsterLevel]) byMonster[b.monsterLevel] = { wins: 0, losses: 0, flees: 0, totalTurns: 0, battles: [] };
    const m = byMonster[b.monsterLevel];
    m.battles.push(b);
    m.totalTurns += b.turns;
    if (b.playerFled) m.flees++;
    else if (b.playerWon) m.wins++;
    else m.losses++;
  }

  console.log('Lvl | Monster              | Fights |  Win% | Loss% | Flee% | Avg Turns');
  console.log('----|----------------------|--------|-------|-------|-------|----------');
  for (const level of Object.keys(byMonster).map(Number).sort((a, b) => a - b)) {
    const m = byMonster[level];
    const total = m.wins + m.losses + m.flees;
    const info = MONSTER_BY_LEVEL[level] || { name: `Unknown L${level}`, classLabel: '?' };
    const pad = (n: number, t: number) => ((n / t) * 100).toFixed(1);
    console.log(`  ${String(level).padStart(2)} | ${(info.name + ` (${info.classLabel})`).padEnd(20)} | ${String(total).padStart(6)} | ${pad(m.wins, total).padStart(5)}% | ${pad(m.losses, total).padStart(5)}% | ${pad(m.flees, total).padStart(5)}% | ${(m.totalTurns / total).toFixed(1).padStart(5)}`);
  }

  // ===========================
  // DAMAGE ANALYSIS BY MONSTER
  // ===========================
  console.log('\n\n========================================');
  console.log('  DAMAGE PER TURN BY MONSTER');
  console.log('========================================\n');

  console.log('Lvl | Monster              | Avg Player Dmg/Turn | Avg Mob Dmg/Turn | Player 0-dmg% | Mob 0-dmg%');
  console.log('----|----------------------|---------------------|------------------|---------------|----------');

  for (const level of Object.keys(byMonster).map(Number).sort((a, b) => a - b)) {
    const m = byMonster[level];
    let playerDmg = 0, playerAtks = 0, playerZero = 0;
    let mobDmg = 0, mobAtks = 0, mobZero = 0;

    for (const b of m.battles) {
      for (const a of b.actions) {
        const isPlayer = a.attackerId === b.playerCharId;
        if (isPlayer) {
          playerAtks++;
          playerDmg += a.attackerDamage;
          if (a.attackerDamage === 0) playerZero++;
        } else {
          mobAtks++;
          mobDmg += a.attackerDamage;
          if (a.attackerDamage === 0) mobZero++;
        }
      }
    }
    const info = MONSTER_BY_LEVEL[level] || { name: `Unknown L${level}` };
    const avgPDmg = playerAtks > 0 ? (playerDmg / playerAtks).toFixed(1) : 'N/A';
    const avgMDmg = mobAtks > 0 ? (mobDmg / mobAtks).toFixed(1) : 'N/A';
    const pZeroPct = playerAtks > 0 ? ((playerZero / playerAtks) * 100).toFixed(1) : 'N/A';
    const mZeroPct = mobAtks > 0 ? ((mobZero / mobAtks) * 100).toFixed(1) : 'N/A';
    console.log(`  ${String(level).padStart(2)} | ${info.name.padEnd(20)} | ${String(avgPDmg).padStart(19)} | ${String(avgMDmg).padStart(16)} | ${String(pZeroPct).padStart(13)}% | ${String(mZeroPct).padStart(5)}%`);
  }

  // ===========================
  // WIN RATES BY STAT PATH
  // ===========================
  console.log('\n\n========================================');
  console.log('  WIN RATES BY PLAYER STAT PATH');
  console.log('========================================\n');

  const byPath: Record<string, { wins: number; losses: number; total: number }> = {};
  for (const b of battles) {
    if (b.playerFled) continue;
    const dom = getDominantType(b.playerStr, b.playerAgi, b.playerInt);
    if (!byPath[dom]) byPath[dom] = { wins: 0, losses: 0, total: 0 };
    byPath[dom].total++;
    if (b.playerWon) byPath[dom].wins++;
    else byPath[dom].losses++;
  }

  for (const path of ['STR', 'AGI', 'INT']) {
    const p = byPath[path];
    if (!p) continue;
    console.log(`  ${path}: ${p.wins}/${p.total} = ${((p.wins / p.total) * 100).toFixed(1)}% win rate`);
  }

  // ===========================
  // COMBAT TRIANGLE
  // ===========================
  console.log('\n\n========================================');
  console.log('  COMBAT TRIANGLE EFFECTIVENESS');
  console.log('========================================');
  console.log('  Expected: STR beats Rogue, AGI beats Mage, INT beats Warrior');
  console.log('  Triangle should give a measurable edge, not dominate.\n');

  for (const path of ['STR', 'AGI', 'INT']) {
    const adv = { wins: 0, total: 0 };
    const dis = { wins: 0, total: 0 };
    const neu = { wins: 0, total: 0 };

    for (const b of battles) {
      if (b.playerFled || b.monsterClass < 0) continue;
      const dom = getDominantType(b.playerStr, b.playerAgi, b.playerInt);
      if (dom !== path) continue;
      const rel = hasTriangleAdvantage(dom, b.monsterClass);
      const bucket = rel === 'advantage' ? adv : rel === 'disadvantage' ? dis : neu;
      bucket.total++;
      if (b.playerWon) bucket.wins++;
    }

    const pct = (w: number, t: number) => t > 0 ? ((w / t) * 100).toFixed(1) + '%' : 'N/A';
    console.log(`  ${path}: Advantage ${pct(adv.wins, adv.total)} (n=${adv.total}) | Disadvantage ${pct(dis.wins, dis.total)} (n=${dis.total}) | Neutral ${pct(neu.wins, neu.total)} (n=${neu.total})`);
  }

  // ===========================
  // DETAILED DAMAGE MECHANICS
  // ===========================
  console.log('\n\n========================================');
  console.log('  COMBAT MECHANICS ANALYSIS');
  console.log('========================================\n');

  let totalPlayerActions = 0, totalMobActions = 0;
  let playerTotalDmg = 0, mobTotalDmg = 0;
  let playerZeroDmg = 0, mobZeroDmg = 0;
  let multiHitActions = 0; // proxy for double strike
  let playerActionsByMonsterLevel: Record<number, { dmgSum: number; count: number; zeroCount: number }> = {};
  let weaponUsage: Record<number, { count: number; totalDmg: number; zeroDmg: number }> = {};

  for (const b of battles) {
    for (const a of b.actions) {
      const isPlayer = a.attackerId === b.playerCharId;
      if (isPlayer) {
        totalPlayerActions++;
        playerTotalDmg += a.attackerDamage;
        if (a.attackerDamage === 0) playerZeroDmg++;
        if (a.damagePerHit.filter(d => d > 0).length > 1) multiHitActions++;

        if (!playerActionsByMonsterLevel[b.monsterLevel])
          playerActionsByMonsterLevel[b.monsterLevel] = { dmgSum: 0, count: 0, zeroCount: 0 };
        playerActionsByMonsterLevel[b.monsterLevel].dmgSum += a.attackerDamage;
        playerActionsByMonsterLevel[b.monsterLevel].count++;
        if (a.attackerDamage === 0) playerActionsByMonsterLevel[b.monsterLevel].zeroCount++;

        // Track weapon usage
        if (a.itemId > 0) {
          if (!weaponUsage[a.itemId]) weaponUsage[a.itemId] = { count: 0, totalDmg: 0, zeroDmg: 0 };
          weaponUsage[a.itemId].count++;
          weaponUsage[a.itemId].totalDmg += a.attackerDamage;
          if (a.attackerDamage === 0) weaponUsage[a.itemId].zeroDmg++;
        }
      } else {
        totalMobActions++;
        mobTotalDmg += a.attackerDamage;
        if (a.attackerDamage === 0) mobZeroDmg++;
      }
    }
  }

  const playerMissRate = totalPlayerActions > 0 ? ((playerZeroDmg / totalPlayerActions) * 100) : 0;
  const mobMissRate = totalMobActions > 0 ? ((mobZeroDmg / totalMobActions) * 100) : 0;
  const playerAvgDmg = totalPlayerActions > 0 ? (playerTotalDmg / (totalPlayerActions - playerZeroDmg)) : 0;
  const mobAvgDmg = totalMobActions > 0 ? (mobTotalDmg / (totalMobActions - mobZeroDmg)) : 0;
  const dsRate = totalPlayerActions > 0 ? ((multiHitActions / totalPlayerActions) * 100) : 0;

  console.log('--- Player Attacks ---');
  console.log(`  Total actions:       ${totalPlayerActions}`);
  console.log(`  Zero-damage rate:    ${playerMissRate.toFixed(1)}% (evasion + misses + effect-only turns)`);
  console.log(`  Multi-hit rate:      ${dsRate.toFixed(1)}% (double strike proxy — sim expects 0-40% for AGI)`);
  console.log(`  Avg dmg (non-zero):  ${playerAvgDmg.toFixed(1)}`);
  console.log(`  Total damage dealt:  ${playerTotalDmg}`);

  console.log('\n--- Monster Attacks ---');
  console.log(`  Total actions:       ${totalMobActions}`);
  console.log(`  Zero-damage rate:    ${mobMissRate.toFixed(1)}%`);
  console.log(`  Avg dmg (non-zero):  ${mobAvgDmg.toFixed(1)}`);
  console.log(`  Total damage dealt:  ${mobTotalDmg}`);

  // ===========================
  // WEAPON PERFORMANCE
  // ===========================
  console.log('\n\n========================================');
  console.log('  WEAPON PERFORMANCE (Top 20 by usage)');
  console.log('========================================\n');

  // Get item names from items metadata
  const itemNames: Record<number, string> = {};
  for (const [_k, im] of Object.entries(itemsMetadata)) {
    const id = parseNum((im as any).itemId);
    const uri = (im as any).uri || '';
    // URI format is typically "item:weapon_name" or just the name
    itemNames[id] = uri.replace('item:', '').replace(/_/g, ' ');
  }

  const sortedWeapons = Object.entries(weaponUsage)
    .map(([id, data]) => ({
      id: Number(id),
      name: itemNames[Number(id)] || `Item #${id}`,
      ...data,
      avgDmg: data.count - data.zeroDmg > 0 ? data.totalDmg / (data.count - data.zeroDmg) : 0,
      missRate: (data.zeroDmg / data.count) * 100,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 20);

  console.log('  ID | Name                     | Uses | Avg Dmg | Miss% | Total Dmg');
  console.log('-----|--------------------------|------|---------|-------|----------');
  for (const w of sortedWeapons) {
    const wInfo = weaponInfo[w.id];
    const dmgRange = wInfo ? `(${wInfo.minDmg}-${wInfo.maxDmg})` : '';
    console.log(`  ${String(w.id).padStart(2)} | ${w.name.padEnd(24)} | ${String(w.count).padStart(4)} | ${w.avgDmg.toFixed(1).padStart(7)} | ${w.missRate.toFixed(1).padStart(5)}% | ${String(w.totalDmg).padStart(9)} ${dmgRange}`);
  }

  // ===========================
  // PLAYER LEVEL vs MONSTER LEVEL
  // ===========================
  console.log('\n\n========================================');
  console.log('  WIN RATE: PLAYER LEVEL vs MONSTER LEVEL');
  console.log('========================================\n');

  const levelDiff: Record<string, { wins: number; total: number }> = {};
  for (const b of battles) {
    if (b.playerFled) continue;
    const diff = b.playerLevel - b.monsterLevel;
    const bucket = diff >= 3 ? '3+ above' : diff >= 1 ? '1-2 above' : diff === 0 ? 'Same level' : diff >= -2 ? '1-2 below' : '3+ below';
    if (!levelDiff[bucket]) levelDiff[bucket] = { wins: 0, total: 0 };
    levelDiff[bucket].total++;
    if (b.playerWon) levelDiff[bucket].wins++;
  }

  for (const bucket of ['3+ below', '1-2 below', 'Same level', '1-2 above', '3+ above']) {
    const d = levelDiff[bucket];
    if (!d) continue;
    console.log(`  ${bucket.padEnd(12)}: ${d.wins}/${d.total} = ${((d.wins / d.total) * 100).toFixed(1)}%`);
  }

  // ===========================
  // ELITE vs NORMAL
  // ===========================
  console.log('\n\n========================================');
  console.log('  ELITE vs NORMAL MONSTERS');
  console.log('========================================\n');

  let eliteW = 0, eliteT = 0, normW = 0, normT = 0;
  for (const b of battles) {
    if (b.playerFled) continue;
    if (b.isElite) { eliteT++; if (b.playerWon) eliteW++; }
    else { normT++; if (b.playerWon) normW++; }
  }
  const elitePct = battles.filter(b => b.isElite).length / battles.length * 100;
  console.log(`  Normal: ${normW}/${normT} = ${normT > 0 ? ((normW / normT) * 100).toFixed(1) : 'N/A'}% win rate`);
  console.log(`  Elite:  ${eliteW}/${eliteT} = ${eliteT > 0 ? ((eliteW / eliteT) * 100).toFixed(1) : 'N/A'}% win rate`);
  console.log(`  Elite spawn rate: ${elitePct.toFixed(1)}% (expected 15%)`);

  // ===========================
  // FIGHT DURATION
  // ===========================
  console.log('\n\n========================================');
  console.log('  FIGHT DURATION DISTRIBUTION');
  console.log('========================================\n');

  const nonFlee = battles.filter(b => !b.playerFled);
  const avgTurns = nonFlee.reduce((s, b) => s + b.turns, 0) / nonFlee.length;
  const maxTurnFights = nonFlee.filter(b => b.turns >= 15).length;
  const thirtyTurnFights = nonFlee.filter(b => b.turns >= 30).length;

  console.log(`  Average: ${avgTurns.toFixed(1)} turns`);
  console.log(`  Hit 15+ turns: ${maxTurnFights} (${((maxTurnFights / nonFlee.length) * 100).toFixed(1)}%)`);
  console.log(`  Hit 30 turns (hard cap): ${thirtyTurnFights} (${((thirtyTurnFights / nonFlee.length) * 100).toFixed(1)}%)`);

  // Histogram (buckets of 2)
  const turnBuckets: Record<string, number> = {};
  for (const b of nonFlee) {
    const bucket = b.turns <= 2 ? '1-2' : b.turns <= 4 ? '3-4' : b.turns <= 6 ? '5-6' :
                   b.turns <= 8 ? '7-8' : b.turns <= 10 ? '9-10' : b.turns <= 12 ? '11-12' :
                   b.turns <= 15 ? '13-15' : b.turns <= 20 ? '16-20' : '21-30';
    turnBuckets[bucket] = (turnBuckets[bucket] || 0) + 1;
  }
  console.log('\n  Turn range | Fights | %');
  console.log('  -----------|--------|------');
  for (const bucket of ['1-2', '3-4', '5-6', '7-8', '9-10', '11-12', '13-15', '16-20', '21-30']) {
    const count = turnBuckets[bucket] || 0;
    const pct = ((count / nonFlee.length) * 100).toFixed(1);
    const bar = '#'.repeat(Math.ceil(count / nonFlee.length * 40));
    console.log(`  ${bucket.padEnd(10)} | ${String(count).padStart(6)} | ${pct.padStart(5)}% ${bar}`);
  }

  // ===========================
  // XP & GOLD ECONOMY
  // ===========================
  console.log('\n\n========================================');
  console.log('  XP & GOLD PER MONSTER (wins only)');
  console.log('========================================\n');

  const expectedXP: Record<number, number> = { 1: 225, 2: 400, 3: 550, 4: 800, 5: 1000, 6: 1325, 7: 2000, 8: 2500, 9: 3250, 10: 6500, 12: 10000 };

  console.log('Lvl | Monster              | Avg XP | Expected | Avg Gold | Wins');
  console.log('----|----------------------|--------|----------|----------|------');
  for (const level of Object.keys(byMonster).map(Number).sort((a, b) => a - b)) {
    const wins = byMonster[level].battles.filter(b => b.playerWon);
    if (wins.length === 0) continue;
    const avgXp = wins.reduce((s, b) => s + b.xpDropped, 0) / wins.length;
    const avgGold = wins.reduce((s, b) => s + b.goldDropped, 0) / wins.length;
    const info = MONSTER_BY_LEVEL[level] || { name: `Unknown L${level}` };
    const exp = expectedXP[level] || 0;
    console.log(`  ${String(level).padStart(2)} | ${info.name.padEnd(20)} | ${avgXp.toFixed(0).padStart(6)} | ${String(exp).padStart(8)} | ${avgGold.toFixed(1).padStart(8)} | ${String(wins.length).padStart(4)}`);
  }

  // ===========================
  // ITEM DROP RATES
  // ===========================
  console.log('\n\n========================================');
  console.log('  ITEM DROP ANALYSIS');
  console.log('========================================\n');

  const winsWithActions = battles.filter(b => b.playerWon);
  const totalDrops = winsWithActions.reduce((s, b) => s + b.itemsDropped.filter(id => id > 0).length, 0);
  const dropDist: Record<number, number> = {};
  for (const b of winsWithActions) {
    const n = b.itemsDropped.filter(id => id > 0).length;
    dropDist[n] = (dropDist[n] || 0) + 1;
  }

  console.log(`  Fights won: ${winsWithActions.length}`);
  console.log(`  Total items dropped: ${totalDrops}`);
  console.log(`  Avg drops/win: ${(totalDrops / winsWithActions.length).toFixed(2)}`);
  console.log(`\n  Drops per fight:`);
  for (const n of Object.keys(dropDist).map(Number).sort((a, b) => a - b)) {
    console.log(`    ${n} items: ${dropDist[n]} (${((dropDist[n] / winsWithActions.length) * 100).toFixed(1)}%)`);
  }

  // ===========================
  // ACTIVE PLAYERS
  // ===========================
  console.log('\n\n========================================');
  console.log('  ACTIVE PLAYER PROFILES');
  console.log('========================================\n');

  const uniquePlayers = new Map<string, BattleRecord>();
  for (const b of battles) {
    const existing = uniquePlayers.get(b.playerCharId);
    if (!existing || b.endTime > existing.endTime) uniquePlayers.set(b.playerCharId, b);
  }

  console.log(`  Unique players (last ${DAYS_BACK} days): ${uniquePlayers.size}`);
  console.log(`  Total battles: ${battles.length}`);
  console.log(`  Avg battles/player: ${(battles.length / uniquePlayers.size).toFixed(0)}`);

  const pathDist: Record<string, number> = {};
  const levelDist: Record<number, number> = {};
  for (const b of uniquePlayers.values()) {
    const dom = getDominantType(b.playerStr, b.playerAgi, b.playerInt);
    pathDist[dom] = (pathDist[dom] || 0) + 1;
    levelDist[b.playerLevel] = (levelDist[b.playerLevel] || 0) + 1;
  }

  console.log(`\n  By stat path:`);
  for (const p of ['STR', 'AGI', 'INT']) {
    console.log(`    ${p}: ${pathDist[p] || 0}`);
  }
  console.log(`\n  By level:`);
  for (const l of Object.keys(levelDist).map(Number).sort((a, b) => a - b)) {
    console.log(`    L${l}: ${levelDist[l]}`);
  }

  // Per-player breakdown
  console.log(`\n  Per-player battle counts:`);
  const playerBattleCounts: Record<string, number> = {};
  for (const b of battles) {
    playerBattleCounts[b.playerCharId] = (playerBattleCounts[b.playerCharId] || 0) + 1;
  }
  const sortedPlayers = Object.entries(playerBattleCounts).sort((a, b) => b[1] - a[1]);
  for (const [charId, count] of sortedPlayers) {
    const latest = uniquePlayers.get(charId)!;
    const dom = getDominantType(latest.playerStr, latest.playerAgi, latest.playerInt);
    console.log(`    L${latest.playerLevel} ${dom} (S${latest.playerStr}/A${latest.playerAgi}/I${latest.playerInt}): ${count} battles`);
  }

  // ===========================
  // SIM COMPARISON SUMMARY
  // ===========================
  console.log('\n\n========================================');
  console.log('  SIM vs ON-CHAIN COMPARISON');
  console.log('========================================\n');

  console.log('  KEY OBSERVATIONS:');
  console.log(`\n  1. OVERALL WIN RATE: ${((battles.filter(b => !b.playerFled && b.playerWon).length / battles.filter(b => !b.playerFled).length) * 100).toFixed(1)}%`);
  console.log('     Sim expects ~60-90% depending on level match and gear.');
  console.log('     High rates suggest players are over-leveled for content they fight.');

  // Check Warrior mob difficulty
  const warriorMobs = [3, 5, 8, 12]; // Cavern Brute, Ironhide Troll, Rock Golem, Basilisk
  const mageMobs = [2, 4, 7, 10]; // Fungal Shaman, Crystal Elemental, Bonecaster, Dusk Drake
  const rogueMobs = [1, 6, 9]; // Dire Rat, Phase Spider, Pale Stalker

  const avgWinByClass = (levels: number[]) => {
    let w = 0, t = 0;
    for (const l of levels) {
      const m = byMonster[l];
      if (!m) continue;
      w += m.wins;
      t += m.wins + m.losses;
    }
    return t > 0 ? ((w / t) * 100).toFixed(1) : 'N/A';
  };

  console.log(`\n  2. WIN RATE BY MOB CLASS:`);
  console.log(`     Warrior mobs: ${avgWinByClass(warriorMobs)}% (tanky, high armor — should be hardest)`);
  console.log(`     Mage mobs:    ${avgWinByClass(mageMobs)}% (magic damage bypasses armor)`);
  console.log(`     Rogue mobs:   ${avgWinByClass(rogueMobs)}% (high evasion)`);
  console.log('     Sim expects Warrior mobs to be hardest for non-INT builds.');

  console.log(`\n  3. FIGHT DURATION: avg ${avgTurns.toFixed(1)} turns`);
  console.log('     Sim expects 5-8 turns for level-appropriate fights.');
  console.log(`     ${((maxTurnFights / nonFlee.length) * 100).toFixed(1)}% hit 15+ turns — these are grindy/stalemate fights.`);

  console.log(`\n  4. COMBAT TRIANGLE:`);
  const overallTriangle = { advWins: 0, advTotal: 0, disWins: 0, disTotal: 0 };
  for (const b of battles) {
    if (b.playerFled || b.monsterClass < 0) continue;
    const dom = getDominantType(b.playerStr, b.playerAgi, b.playerInt);
    const rel = hasTriangleAdvantage(dom, b.monsterClass);
    if (rel === 'advantage') { overallTriangle.advTotal++; if (b.playerWon) overallTriangle.advWins++; }
    if (rel === 'disadvantage') { overallTriangle.disTotal++; if (b.playerWon) overallTriangle.disWins++; }
  }
  const advPct = ((overallTriangle.advWins / overallTriangle.advTotal) * 100).toFixed(1);
  const disPct = ((overallTriangle.disWins / overallTriangle.disTotal) * 100).toFixed(1);
  console.log(`     With advantage: ${advPct}% (n=${overallTriangle.advTotal})`);
  console.log(`     With disadvantage: ${disPct}% (n=${overallTriangle.disTotal})`);
  console.log(`     Delta: ${(parseFloat(advPct) - parseFloat(disPct)).toFixed(1)} percentage points`);
  console.log('     Sim expects ~5-15% advantage from triangle (tiebreaker, not dominant).');

  console.log(`\n  5. ZERO-DAMAGE ACTIONS (evasion/miss proxy):`);
  console.log(`     Player: ${playerMissRate.toFixed(1)}% (sim expects 0-35% based on AGI gap)`);
  console.log(`     Mob:    ${mobMissRate.toFixed(1)}% (sim expects ~5-20%)`);

  console.log(`\n  6. MULTI-HIT ATTACKS (double strike proxy):`);
  console.log(`     ${dsRate.toFixed(1)}% of player actions had multiple damage values`);
  console.log('     Sim expects 0-40% for AGI builds, 0% for STR/INT builds.');

  console.log(`\n  7. BASILISK (Zone Boss):`);
  const basilisk = byMonster[12];
  if (basilisk) {
    const bTotal = basilisk.wins + basilisk.losses;
    console.log(`     ${basilisk.wins}/${bTotal} wins (${((basilisk.wins / bTotal) * 100).toFixed(0)}%) — sim target is 30-60% with pots.`);
    console.log(`     ${bTotal} total attempts. Avg ${(basilisk.totalTurns / (basilisk.wins + basilisk.losses + basilisk.flees)).toFixed(0)} turns.`);
  } else {
    console.log('     No Basilisk fights in this period.');
  }
}

main().catch(console.error);
