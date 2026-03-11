#!/usr/bin/env npx tsx
/**
 * Prod Baseline — Read all on-chain game data from production and dump as readable JSON.
 * This is the foundation for the cleanup audit.
 *
 * Usage: CHAIN_ID=8453 npx tsx scripts/prod-baseline.ts
 */

import { decodeAbiParameters, Hex } from 'viem';

const INDEXER_URL = 'https://indexer-production-d6df.up.railway.app';

// ============ Monster Stats ABI (matches zone-loader encoding) ============

const monsterStatsAbi = [{ type: 'tuple', components: [
  { name: 'agility', type: 'int256' },
  { name: 'armor', type: 'int256' },
  { name: 'class', type: 'uint8' },
  { name: 'experience', type: 'uint256' },
  { name: 'hitPoints', type: 'int256' },
  { name: 'intelligence', type: 'int256' },
  { name: 'inventory', type: 'uint256[]' },
  { name: 'level', type: 'uint256' },
  { name: 'strength', type: 'int256' },
]}] as const;

const weaponStatsAbi = [
  { type: 'tuple', components: [
    { name: 'agiModifier', type: 'int256' },
    { name: 'intModifier', type: 'int256' },
    { name: 'hpModifier', type: 'int256' },
    { name: 'maxDamage', type: 'int256' },
    { name: 'minDamage', type: 'int256' },
    { name: 'minLevel', type: 'uint256' },
    { name: 'strModifier', type: 'int256' },
    { name: 'effects', type: 'bytes32[]' },
  ]},
  { type: 'tuple', components: [
    { name: 'minAgility', type: 'int256' },
    { name: 'minIntelligence', type: 'int256' },
    { name: 'minStrength', type: 'int256' },
  ]},
] as const;

const armorStatsAbi = [
  { type: 'tuple', components: [
    { name: 'agiModifier', type: 'int256' },
    { name: 'armorModifier', type: 'int256' },
    { name: 'hpModifier', type: 'int256' },
    { name: 'intModifier', type: 'int256' },
    { name: 'minLevel', type: 'uint256' },
    { name: 'strModifier', type: 'int256' },
    { name: 'armorType', type: 'uint8' },
  ]},
  { type: 'tuple', components: [
    { name: 'minAgility', type: 'int256' },
    { name: 'minIntelligence', type: 'int256' },
    { name: 'minStrength', type: 'int256' },
  ]},
] as const;

const consumableStatsAbi = [
  { type: 'tuple', components: [
    { name: 'minDamage', type: 'int256' },
    { name: 'maxDamage', type: 'int256' },
    { name: 'minLevel', type: 'uint256' },
    { name: 'effects', type: 'bytes32[]' },
  ]},
  { type: 'tuple', components: [
    { name: 'minAgility', type: 'int256' },
    { name: 'minIntelligence', type: 'int256' },
    { name: 'minStrength', type: 'int256' },
  ]},
] as const;

// ============ Helpers ============

const CLASS_NAMES: Record<number, string> = { 0: 'Warrior', 1: 'Rogue', 2: 'Mage' };
const ITEM_TYPES: Record<number, string> = { 0: 'Weapon', 1: 'Armor', 3: 'Consumable' };
const ARMOR_TYPES: Record<number, string> = { 1: 'Heavy', 2: 'Medium', 3: 'Light' };

function bigIntToNum(val: bigint | number): number {
  return Number(val);
}

function decodeMonsterStats(hex: Hex) {
  try {
    const [decoded] = decodeAbiParameters(monsterStatsAbi, hex);
    return {
      strength: bigIntToNum(decoded.agility), // field order in ABI matches Solidity struct
      agility: bigIntToNum(decoded.agility),
      armor: bigIntToNum(decoded.armor),
      class: CLASS_NAMES[decoded.class] ?? `Unknown(${decoded.class})`,
      classId: decoded.class,
      experience: bigIntToNum(decoded.experience),
      hitPoints: bigIntToNum(decoded.hitPoints),
      intelligence: bigIntToNum(decoded.intelligence),
      inventory: decoded.inventory.map(bigIntToNum),
      level: bigIntToNum(decoded.level),
      strength_actual: bigIntToNum(decoded.strength),
    };
  } catch (e) {
    return null;
  }
}

function decodeItemStats(itemType: number, hex: Hex) {
  if (!hex || hex === '0x') return null;
  try {
    if (itemType === 0) { // Weapon
      const [weapon, restrictions] = decodeAbiParameters(weaponStatsAbi, hex);
      return {
        type: 'weapon',
        minDamage: bigIntToNum(weapon.minDamage),
        maxDamage: bigIntToNum(weapon.maxDamage),
        strModifier: bigIntToNum(weapon.strModifier),
        agiModifier: bigIntToNum(weapon.agiModifier),
        intModifier: bigIntToNum(weapon.intModifier),
        hpModifier: bigIntToNum(weapon.hpModifier),
        minLevel: bigIntToNum(weapon.minLevel),
        effects: weapon.effects,
        minStrength: bigIntToNum(restrictions.minStrength),
        minAgility: bigIntToNum(restrictions.minAgility),
        minIntelligence: bigIntToNum(restrictions.minIntelligence),
      };
    } else if (itemType === 1) { // Armor
      const [armor, restrictions] = decodeAbiParameters(armorStatsAbi, hex);
      return {
        type: 'armor',
        armorModifier: bigIntToNum(armor.armorModifier),
        strModifier: bigIntToNum(armor.strModifier),
        agiModifier: bigIntToNum(armor.agiModifier),
        intModifier: bigIntToNum(armor.intModifier),
        hpModifier: bigIntToNum(armor.hpModifier),
        minLevel: bigIntToNum(armor.minLevel),
        armorType: ARMOR_TYPES[armor.armorType] ?? `Unknown(${armor.armorType})`,
        armorTypeId: armor.armorType,
        minStrength: bigIntToNum(restrictions.minStrength),
        minAgility: bigIntToNum(restrictions.minAgility),
        minIntelligence: bigIntToNum(restrictions.minIntelligence),
      };
    } else if (itemType === 3) { // Consumable
      const [consumable, restrictions] = decodeAbiParameters(consumableStatsAbi, hex);
      return {
        type: 'consumable',
        minDamage: bigIntToNum(consumable.minDamage),
        maxDamage: bigIntToNum(consumable.maxDamage),
        minLevel: bigIntToNum(consumable.minLevel),
        effects: consumable.effects,
        minStrength: bigIntToNum(restrictions.minStrength),
        minAgility: bigIntToNum(restrictions.minAgility),
        minIntelligence: bigIntToNum(restrictions.minIntelligence),
      };
    }
  } catch (e) {
    return { type: 'decode_error', error: String(e) };
  }
  return null;
}

// ============ Main ============

async function main() {
  console.log('Fetching prod data from indexer...\n');

  // Fetch items
  const itemsRes = await fetch(`${INDEXER_URL}/api/items`);
  const itemsWrapper = await itemsRes.json();
  const itemsData = itemsWrapper.items ?? itemsWrapper;

  // Fetch monsters
  const monstersRes = await fetch(`${INDEXER_URL}/api/monsters`);
  const monstersWrapper = await monstersRes.json();
  const monstersList = monstersWrapper.monsters ?? monstersWrapper;

  // Fetch effects
  const effectsData = itemsWrapper.effects ?? {};
  const effectValidityData = itemsWrapper.effectValidity ?? {};

  // ============ Decode Monsters ============
  console.log('='.repeat(70));
  console.log('  PROD MONSTERS (on-chain)');
  console.log('='.repeat(70));

  const monsters: any[] = [];
  for (const m of monstersList) {
    if (m.mobType === 2) continue; // Skip shops
    try {
      const [decoded] = decodeAbiParameters(monsterStatsAbi, m.mobStats as Hex);
      const monster = {
        id: m.mobId,
        name: (m.mobMetadata ?? '').replace('monster:', ''),
        level: bigIntToNum(decoded.level),
        strength: bigIntToNum(decoded.strength),
        agility: bigIntToNum(decoded.agility),
        intelligence: bigIntToNum(decoded.intelligence),
        hitPoints: bigIntToNum(decoded.hitPoints),
        armor: bigIntToNum(decoded.armor),
        class: CLASS_NAMES[decoded.class] ?? `Unknown(${decoded.class})`,
        classId: decoded.class,
        experience: bigIntToNum(decoded.experience),
        inventory: decoded.inventory.map(bigIntToNum),
      };
      monsters.push(monster);
      console.log(`  [${monster.id}] ${monster.name} — L${monster.level} ${monster.class}`);
      console.log(`      STR:${monster.strength} AGI:${monster.agility} INT:${monster.intelligence} HP:${monster.hitPoints} ARM:${monster.armor} XP:${monster.experience}`);
      console.log(`      Drops: [${monster.inventory.join(', ')}]`);
    } catch (e) {
      console.log(`  [${m.mobId}] ${m.mobMetadata ?? 'unknown'} — DECODE FAILED: ${e}`);
    }
  }

  // ============ Decode Effects ============
  console.log('\n' + '='.repeat(70));
  console.log('  PROD EFFECTS (on-chain)');
  console.log('='.repeat(70));

  const effects: any[] = [];
  for (const [effectId, e] of Object.entries(effectsData) as [string, any][]) {
    const validity = effectValidityData[effectId];
    effects.push({
      effectId,
      strModifier: Number(e.strModifier ?? 0),
      agiModifier: Number(e.agiModifier ?? 0),
      intModifier: Number(e.intModifier ?? 0),
      armorModifier: Number(e.armorModifier ?? 0),
      hpModifier: Number(e.hpModifier ?? 0),
      damagePerTick: Number(e.damagePerTick ?? 0),
      resistanceStat: Number(e.resistanceStat ?? 0),
      ...(validity ? {
        cooldown: Number(validity.cooldown ?? 0),
        maxStacks: Number(validity.maxStacks ?? 0),
        validTurns: Number(validity.validTurns ?? 0),
        validTime: Number(validity.validTime ?? 0),
      } : {}),
    });
    const mods = [];
    if (e.strModifier && e.strModifier !== '0') mods.push(`STR:${e.strModifier}`);
    if (e.agiModifier && e.agiModifier !== '0') mods.push(`AGI:${e.agiModifier}`);
    if (e.intModifier && e.intModifier !== '0') mods.push(`INT:${e.intModifier}`);
    if (e.armorModifier && e.armorModifier !== '0') mods.push(`ARM:${e.armorModifier}`);
    if (e.hpModifier && e.hpModifier !== '0') mods.push(`HP:${e.hpModifier}`);
    if (e.damagePerTick && e.damagePerTick !== '0') mods.push(`DoT:${e.damagePerTick}`);
    const validStr = validity ? ` cd:${validity.cooldown} stacks:${validity.maxStacks} turns:${validity.validTurns} time:${validity.validTime}` : '';
    console.log(`  ${effectId.slice(0, 18)}... ${mods.join(' ')}${validStr}`);
  }

  // ============ Decode Items ============
  console.log('\n' + '='.repeat(70));
  console.log('  PROD ITEMS (on-chain)');
  console.log('='.repeat(70));

  const weapons: any[] = [];
  const armor: any[] = [];
  const consumables: any[] = [];

  for (const item of itemsData) {
    // Use pre-decoded stats from indexer where available
    const base = {
      id: Number(item.itemId),
      rarity: Number(item.rarity),
      dropChance: Number(item.dropChance),
      price: item.price ? (BigInt(item.price) / BigInt(10**18)).toString() : '0',
    };

    if (item.itemType === 0 && item.weaponStats) {
      const w = item.weaponStats;
      weapons.push({
        ...base,
        type: 'weapon',
        minDamage: Number(w.minDamage),
        maxDamage: Number(w.maxDamage),
        strModifier: Number(w.strModifier),
        agiModifier: Number(w.agiModifier),
        intModifier: Number(w.intModifier),
        hpModifier: Number(w.hpModifier),
        minLevel: Number(w.minLevel),
        effects: w.effects ?? [],
        minStrength: Number(item.statRestrictions?.minStrength ?? 0),
        minAgility: Number(item.statRestrictions?.minAgility ?? 0),
        minIntelligence: Number(item.statRestrictions?.minIntelligence ?? 0),
      });
    } else if (item.itemType === 1 && item.armorStats) {
      const a = item.armorStats;
      armor.push({
        ...base,
        type: 'armor',
        armorModifier: Number(a.armorModifier),
        strModifier: Number(a.strModifier),
        agiModifier: Number(a.agiModifier),
        intModifier: Number(a.intModifier),
        hpModifier: Number(a.hpModifier),
        minLevel: Number(a.minLevel),
        armorType: ARMOR_TYPES[Number(a.armorType)] ?? `Unknown(${a.armorType})`,
        armorTypeId: Number(a.armorType),
        minStrength: Number(item.statRestrictions?.minStrength ?? 0),
        minAgility: Number(item.statRestrictions?.minAgility ?? 0),
        minIntelligence: Number(item.statRestrictions?.minIntelligence ?? 0),
      });
    } else if (item.itemType === 3 && item.consumableStats) {
      const c = item.consumableStats;
      consumables.push({
        ...base,
        type: 'consumable',
        minDamage: Number(c.minDamage),
        maxDamage: Number(c.maxDamage),
        minLevel: Number(c.minLevel),
        effects: c.effects ?? [],
        minStrength: Number(item.statRestrictions?.minStrength ?? 0),
        minAgility: Number(item.statRestrictions?.minAgility ?? 0),
        minIntelligence: Number(item.statRestrictions?.minIntelligence ?? 0),
      });
    }
  }

  console.log(`\n>>> Weapons (${weapons.length}) <<<`);
  for (const w of weapons.sort((a, b) => a.id - b.id)) {
    const scaling = w.agiModifier > 0 ? 'AGI' : w.intModifier > 0 ? 'INT' : 'STR';
    console.log(`  [${w.id}] ${w.name} — DMG:${w.minDamage}-${w.maxDamage} STR:${w.strModifier > 0 ? '+' : ''}${w.strModifier} AGI:${w.agiModifier > 0 ? '+' : ''}${w.agiModifier} INT:${w.intModifier > 0 ? '+' : ''}${w.intModifier} HP:${w.hpModifier > 0 ? '+' : ''}${w.hpModifier} Lvl:${w.minLevel} R${w.rarity} Drop:${w.dropChance} ${w.price}`);
    if (w.minStrength || w.minAgility || w.minIntelligence) {
      console.log(`         Req: STR>=${w.minStrength} AGI>=${w.minAgility} INT>=${w.minIntelligence}`);
    }
    if (w.effects?.length > 0) {
      console.log(`         Effects: [${w.effects.join(', ')}]`);
    }
  }

  console.log(`\n>>> Armor (${armor.length}) <<<`);
  for (const a of armor.sort((a, b) => a.id - b.id)) {
    console.log(`  [${a.id}] ${a.name} — ARM:${a.armorModifier} Type:${a.armorType} STR:${a.strModifier > 0 ? '+' : ''}${a.strModifier} AGI:${a.agiModifier > 0 ? '+' : ''}${a.agiModifier} INT:${a.intModifier > 0 ? '+' : ''}${a.intModifier} HP:${a.hpModifier > 0 ? '+' : ''}${a.hpModifier} Lvl:${a.minLevel} R${a.rarity} Drop:${a.dropChance} ${a.price}`);
    if (a.minStrength || a.minAgility || a.minIntelligence) {
      console.log(`         Req: STR>=${a.minStrength} AGI>=${a.minAgility} INT>=${a.minIntelligence}`);
    }
  }

  console.log(`\n>>> Consumables (${consumables.length}) <<<`);
  for (const c of consumables.sort((a, b) => a.id - b.id)) {
    console.log(`  [${c.id}] ${c.name} — DMG:${c.minDamage}-${c.maxDamage} Lvl:${c.minLevel} R${c.rarity} Drop:${c.dropChance} ${c.price}`);
    if (c.effects?.length > 0) {
      console.log(`         Effects: [${c.effects.join(', ')}]`);
    }
  }

  // ============ Summary ============
  console.log('\n' + '='.repeat(70));
  console.log('  SUMMARY');
  console.log('='.repeat(70));
  console.log(`  Monsters: ${monsters.length}`);
  console.log(`  Weapons:  ${weapons.length}`);
  console.log(`  Armor:    ${armor.length}`);
  console.log(`  Consumables: ${consumables.length}`);
  console.log(`  Total items: ${weapons.length + armor.length + consumables.length}`);

  // ============ Write JSON baseline ============
  const baseline = {
    timestamp: new Date().toISOString(),
    worldAddress: '0x99d01939F58B965E6E84a1D167E710Abdf5764b0',
    chain: 'Base Mainnet (8453)',
    monsters,
    weapons,
    armor,
    consumables,
  };

  const fs = await import('fs');
  const outPath = new URL('../prod-baseline.json', import.meta.url).pathname;
  fs.writeFileSync(outPath, JSON.stringify(baseline, (_, v) => typeof v === 'bigint' ? Number(v) : v, 2));
  console.log(`\n  Wrote baseline to: ${outPath}`);
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
