#!/usr/bin/env npx tsx
/**
 * Generate zone data JSON files (monsters.json, items.json, effects.json)
 * from the Z2 sim data in journey-z2.ts.
 *
 * Usage: npx tsx scripts/generate-zone-data.ts
 * Output: zones/windy_peaks/{monsters,items,effects}.json
 */

import { keccak256, toHex, encodePacked } from 'viem';
import * as fs from 'fs';
import * as path from 'path';

// ============================================================
// Effect ID helpers
// ============================================================

/** Generate a deterministic effectId from a name (first 8 bytes of keccak256) */
function effectId(name: string): string {
  const hash = keccak256(encodePacked(['string'], [name]));
  return hash.slice(0, 18).padEnd(66, '0'); // 8 bytes + zero-pad to 32 bytes
}

// Well-known effect IDs from Dark Cave (reused)
const BASIC_PHYSICAL = '0xbeeab8b096ac11af000000000000000000000000000000000000000000000000';
const BASIC_MAGIC = '0xeee09063621624b3000000000000000000000000000000000000000000000000';

// ============================================================
// Z2 Sim Data — copied from journey-z2.ts (single source of truth)
// XP values are sim-scale /100 for on-chain
// ============================================================

const XP_SCALE = 100;

interface MonsterDef {
  name: string;
  level: number;
  str: number;
  agi: number;
  int: number;
  hp: number;
  armor: number;
  classType: number; // 0=Warrior, 1=Rogue, 2=Mage
  xp: number; // sim-scale
  weaponMinDmg: number;
  weaponMaxDmg: number;
  weaponScaling: 'str' | 'agi';
  weaponIsMagic: boolean;
  isBoss?: boolean;
}

const MONSTERS: MonsterDef[] = [
  { name: 'Ridge Stalker', level: 11, str: 15, agi: 27, int: 7, hp: 95, armor: 4, classType: 1, xp: 800, weaponMinDmg: 7, weaponMaxDmg: 12, weaponScaling: 'agi', weaponIsMagic: false },
  { name: 'Frost Wraith', level: 12, str: 10, agi: 11, int: 28, hp: 90, armor: 3, classType: 2, xp: 1000, weaponMinDmg: 8, weaponMaxDmg: 13, weaponScaling: 'str', weaponIsMagic: true },
  { name: 'Granite Sentinel', level: 13, str: 24, agi: 8, int: 5, hp: 100, armor: 5, classType: 0, xp: 1200, weaponMinDmg: 8, weaponMaxDmg: 12, weaponScaling: 'str', weaponIsMagic: false },
  { name: 'Gale Phantom', level: 14, str: 12, agi: 29, int: 7, hp: 100, armor: 4, classType: 1, xp: 1400, weaponMinDmg: 8, weaponMaxDmg: 13, weaponScaling: 'agi', weaponIsMagic: false },
  { name: 'Blighthorn', level: 15, str: 25, agi: 10, int: 6, hp: 100, armor: 5, classType: 0, xp: 1600, weaponMinDmg: 7, weaponMaxDmg: 12, weaponScaling: 'str', weaponIsMagic: false },
  { name: 'Storm Shrike', level: 16, str: 10, agi: 12, int: 29, hp: 90, armor: 4, classType: 2, xp: 1800, weaponMinDmg: 8, weaponMaxDmg: 13, weaponScaling: 'str', weaponIsMagic: true },
  { name: 'Hollow Scout', level: 17, str: 14, agi: 30, int: 10, hp: 100, armor: 5, classType: 1, xp: 2000, weaponMinDmg: 8, weaponMaxDmg: 13, weaponScaling: 'agi', weaponIsMagic: false },
  { name: 'Ironpeak Charger', level: 18, str: 27, agi: 14, int: 8, hp: 105, armor: 6, classType: 0, xp: 2200, weaponMinDmg: 8, weaponMaxDmg: 13, weaponScaling: 'str', weaponIsMagic: false },
  { name: 'Peakfire Wraith', level: 19, str: 12, agi: 14, int: 29, hp: 90, armor: 4, classType: 2, xp: 2500, weaponMinDmg: 8, weaponMaxDmg: 13, weaponScaling: 'str', weaponIsMagic: true },
  { name: "Korrath's Warden", level: 20, str: 29, agi: 14, int: 7, hp: 125, armor: 5, classType: 0, xp: 4000, weaponMinDmg: 9, weaponMaxDmg: 14, weaponScaling: 'str', weaponIsMagic: false, isBoss: true },
];

interface WeaponDef {
  name: string;
  minDamage: number;
  maxDamage: number;
  strMod: number;
  agiMod: number;
  intMod: number;
  hpMod: number;
  scaling: 'str' | 'agi';
  isMagic: boolean;
  minStr: number;
  minAgi: number;
  minInt: number;
  rarity: number;
  price: number;
}

const WEAPONS: WeaponDef[] = [
  // STR pure
  { name: 'Ridgestone Hammer', minDamage: 5, maxDamage: 8, strMod: 1, agiMod: 0, intMod: 0, hpMod: 2, scaling: 'str', isMagic: false, minStr: 16, minAgi: 0, minInt: 0, rarity: 1, price: 40 },
  { name: 'Peak Cleaver', minDamage: 6, maxDamage: 10, strMod: 2, agiMod: 0, intMod: 0, hpMod: 3, scaling: 'str', isMagic: false, minStr: 20, minAgi: 0, minInt: 0, rarity: 2, price: 80 },
  { name: 'Windforged Axe', minDamage: 7, maxDamage: 12, strMod: 3, agiMod: 0, intMod: 0, hpMod: 4, scaling: 'str', isMagic: false, minStr: 24, minAgi: 0, minInt: 0, rarity: 3, price: 150 },
  { name: "Warden's Maul", minDamage: 9, maxDamage: 14, strMod: 4, agiMod: 0, intMod: 0, hpMod: 5, scaling: 'str', isMagic: false, minStr: 28, minAgi: 0, minInt: 0, rarity: 4, price: 300 },
  // AGI pure
  { name: 'Scrub Bow', minDamage: 4, maxDamage: 7, strMod: 0, agiMod: 1, intMod: 0, hpMod: 2, scaling: 'agi', isMagic: false, minStr: 0, minAgi: 16, minInt: 0, rarity: 1, price: 40 },
  { name: 'Gale Bow', minDamage: 5, maxDamage: 9, strMod: 0, agiMod: 2, intMod: 0, hpMod: 3, scaling: 'agi', isMagic: false, minStr: 0, minAgi: 20, minInt: 0, rarity: 2, price: 80 },
  { name: 'Stormfeather Bow', minDamage: 6, maxDamage: 11, strMod: 0, agiMod: 3, intMod: 0, hpMod: 4, scaling: 'agi', isMagic: false, minStr: 0, minAgi: 24, minInt: 0, rarity: 3, price: 150 },
  { name: 'Peakwind Longbow', minDamage: 7, maxDamage: 13, strMod: 0, agiMod: 4, intMod: 0, hpMod: 5, scaling: 'agi', isMagic: false, minStr: 0, minAgi: 28, minInt: 0, rarity: 4, price: 300 },
  // INT pure (magic)
  { name: 'Frozen Shard', minDamage: 5, maxDamage: 8, strMod: 0, agiMod: 0, intMod: 1, hpMod: 2, scaling: 'str', isMagic: true, minStr: 0, minAgi: 0, minInt: 16, rarity: 1, price: 40 },
  { name: 'Rime Staff', minDamage: 6, maxDamage: 10, strMod: 0, agiMod: 0, intMod: 2, hpMod: 3, scaling: 'str', isMagic: true, minStr: 0, minAgi: 0, minInt: 20, rarity: 2, price: 80 },
  { name: 'Stormglass Rod', minDamage: 8, maxDamage: 13, strMod: 0, agiMod: 0, intMod: 3, hpMod: 4, scaling: 'str', isMagic: true, minStr: 0, minAgi: 0, minInt: 24, rarity: 3, price: 150 },
  { name: 'Wraith Beacon', minDamage: 10, maxDamage: 15, strMod: 0, agiMod: 0, intMod: 4, hpMod: 6, scaling: 'str', isMagic: true, minStr: 0, minAgi: 0, minInt: 28, rarity: 4, price: 300 },
  // Hybrids
  { name: "Warden's Ember", minDamage: 5, maxDamage: 9, strMod: 2, agiMod: 0, intMod: 2, hpMod: 2, scaling: 'str', isMagic: false, minStr: 18, minAgi: 0, minInt: 10, rarity: 3, price: 200 },
  { name: 'Windweaver', minDamage: 4, maxDamage: 8, strMod: 0, agiMod: 2, intMod: 2, hpMod: 0, scaling: 'agi', isMagic: false, minStr: 0, minAgi: 18, minInt: 10, rarity: 3, price: 200 },
  { name: 'Ridgefang', minDamage: 6, maxDamage: 10, strMod: 2, agiMod: 2, intMod: 0, hpMod: 3, scaling: 'str', isMagic: false, minStr: 18, minAgi: 6, minInt: 0, rarity: 3, price: 200 },
  { name: 'Viperstrike', minDamage: 5, maxDamage: 9, strMod: 2, agiMod: 2, intMod: 0, hpMod: 2, scaling: 'agi', isMagic: false, minStr: 8, minAgi: 18, minInt: 0, rarity: 3, price: 200 },
  { name: 'Ashveil Staff', minDamage: 6, maxDamage: 10, strMod: 1, agiMod: 0, intMod: 2, hpMod: 2, scaling: 'str', isMagic: true, minStr: 6, minAgi: 0, minInt: 18, rarity: 3, price: 200 },
];

interface ArmorDef {
  name: string;
  armorValue: number;
  strMod: number;
  agiMod: number;
  intMod: number;
  hpMod: number;
  minStr: number;
  minAgi: number;
  minInt: number;
  armorType: 'Plate' | 'Leather' | 'Cloth';
  rarity: number;
  price: number;
}

const ARMORS: ArmorDef[] = [
  // Plate
  { name: 'Peakstone Mail', armorValue: 5, strMod: 1, agiMod: -1, intMod: 0, hpMod: 3, minStr: 14, minAgi: 0, minInt: 0, armorType: 'Plate', rarity: 1, price: 35 },
  { name: 'Ridgeforged Plate', armorValue: 7, strMod: 2, agiMod: -1, intMod: 0, hpMod: 5, minStr: 18, minAgi: 0, minInt: 0, armorType: 'Plate', rarity: 2, price: 70 },
  { name: 'Windsworn Plate', armorValue: 9, strMod: 3, agiMod: -1, intMod: 0, hpMod: 8, minStr: 22, minAgi: 0, minInt: 0, armorType: 'Plate', rarity: 3, price: 140 },
  { name: "Warden's Bulwark", armorValue: 11, strMod: 4, agiMod: -1, intMod: 0, hpMod: 10, minStr: 26, minAgi: 0, minInt: 0, armorType: 'Plate', rarity: 4, price: 280 },
  // Leather
  { name: 'Mountain Hide', armorValue: 3, strMod: 0, agiMod: 2, intMod: 0, hpMod: 2, minStr: 0, minAgi: 14, minInt: 0, armorType: 'Leather', rarity: 1, price: 35 },
  { name: 'Galebound Leather', armorValue: 4, strMod: 0, agiMod: 3, intMod: 0, hpMod: 4, minStr: 0, minAgi: 18, minInt: 0, armorType: 'Leather', rarity: 2, price: 70 },
  { name: 'Stormhide Vest', armorValue: 5, strMod: 0, agiMod: 4, intMod: 0, hpMod: 6, minStr: 0, minAgi: 22, minInt: 0, armorType: 'Leather', rarity: 3, price: 140 },
  { name: 'Phantom Shroud', armorValue: 6, strMod: 0, agiMod: 5, intMod: 0, hpMod: 8, minStr: 0, minAgi: 26, minInt: 0, armorType: 'Leather', rarity: 4, price: 280 },
  // Cloth
  { name: 'Frostweave Robe', armorValue: 2, strMod: 0, agiMod: 0, intMod: 2, hpMod: 5, minStr: 0, minAgi: 0, minInt: 14, armorType: 'Cloth', rarity: 1, price: 35 },
  { name: 'Mistcloak', armorValue: 3, strMod: 0, agiMod: 0, intMod: 3, hpMod: 8, minStr: 0, minAgi: 0, minInt: 18, armorType: 'Cloth', rarity: 2, price: 70 },
  { name: 'Wraith Vestments', armorValue: 4, strMod: 0, agiMod: 0, intMod: 4, hpMod: 12, minStr: 0, minAgi: 0, minInt: 22, armorType: 'Cloth', rarity: 3, price: 140 },
  { name: 'Ember Mantle', armorValue: 5, strMod: 0, agiMod: 0, intMod: 5, hpMod: 16, minStr: 0, minAgi: 0, minInt: 26, armorType: 'Cloth', rarity: 4, price: 280 },
];

// ============================================================
// Narrative descriptions — every item tells a story
// ============================================================
const DESC: Record<string, string> = {
  // --- Monsters ---
  'Ridge Stalker': 'Lean and low to the ground. It watches from the ridgelines, patient as stone, until it isn\'t.',
  'Frost Wraith': 'The cold didn\'t kill it. The cold is what it became.',
  'Granite Sentinel': 'Carved by hands or grown by the mountain \u2014 no one\'s sure. It guards the path and doesn\'t negotiate.',
  'Gale Phantom': 'More wind than creature. You hear it before you see it, and by then it\'s behind you.',
  'Blighthorn': 'Where it grazes, nothing grows. The decay rides in its breath.',
  'Storm Shrike': 'Lightning dances between its feathers. It screams and the thunder answers.',
  'Hollow Scout': 'Wears the remnants of a faction uniform. Doesn\'t serve either side anymore.',
  'Ironpeak Charger': 'Built like the mountain itself. When it charges, the ground remembers.',
  'Peakfire Wraith': 'Born where the stone still holds Korrath\'s heat. It burns cold.',
  "Korrath's Warden": 'A soldier who climbed the peak and found something that wouldn\'t let go. The armor isn\'t his. He doesn\'t care.',

  // --- STR Weapons ---
  'Ridgestone Hammer': 'Chipped from the mountain\'s own rock. Every swing carries the weight of the peak.',
  'Peak Cleaver': 'Forged at a mountain camp. The edge holds despite the wind.',
  'Windforged Axe': 'The blade hums in strong wind. Whoever made it understood the peaks.',
  "Warden's Maul": 'Pulled from a dead man\'s hands at the summit. The grip is still warm.',

  // --- AGI Weapons ---
  'Scrub Bow': 'Bent from scrub wood that grows sideways in the wind. Shoots true enough.',
  'Gale Bow': 'The draw is light. Arrows fly like the wind itself carried them.',
  'Stormfeather Bow': 'Fletched with feathers from something that flew through storms. Doesn\'t miss in wind.',
  'Peakwind Longbow': 'The string sings a note you can feel in your chest. Range that makes the peaks feel small.',

  // --- INT Weapons ---
  'Frozen Shard': 'A splinter of ice that won\'t melt. It cuts the air when you point it.',
  'Rime Staff': 'White wood crusted with permanent frost. The cold comes from inside it.',
  'Stormglass Rod': 'Glass that survived a lightning strike. The crack inside pulses.',
  'Wraith Beacon': 'It doesn\'t cast light. It casts attention. Things come when you raise it.',

  // --- Hybrid Weapons ---
  "Warden's Ember": 'A blade that glows like a coal. The Warden\'s heat lingers in the steel.',
  'Windweaver': 'Light as air, sharp as spite. The magic and the edge are the same thing.',
  'Ridgefang': 'Tooth of something that lived inside the mountain. Cuts and keeps cutting.',
  'Viperstrike': 'Fast and venomous. Named by someone who didn\'t survive to rename it.',
  'Ashveil Staff': 'Charred wood from a lightning-struck tree. The magic tastes like smoke.',

  // --- Plate Armor ---
  'Peakstone Mail': 'Mountain stone links threaded with iron. Heavy and honest.',
  'Ridgeforged Plate': 'Hammered at a ridge forge by someone who stayed too long. Good work.',
  'Windsworn Plate': 'Scored by decades of mountain wind. The dents are a map of storms survived.',
  "Warden's Bulwark": 'Taken from the summit. The metal is warm and hums when storms approach.',

  // --- Leather Armor ---
  'Mountain Hide': 'Thick-skinned beast leather, poorly cured. Smells like altitude.',
  'Galebound Leather': 'Supple and windproof. Made by someone who knew the peaks.',
  'Stormhide Vest': 'The hide crackles with static. Whatever wore this skin lived in the storms.',
  'Phantom Shroud': 'You can see through it in certain light. Or maybe you can\'t see what\'s behind it.',

  // --- Cloth Armor ---
  'Frostweave Robe': 'Woven from threads that hold the cold. You feel sharper wearing it.',
  'Mistcloak': 'Grey as the mountain mist. Hard to see. Hard to hit.',
  'Wraith Vestments': 'The fabric moves when the air doesn\'t. Something in the weave still remembers.',
  'Ember Mantle': 'Warm without fire. The lining glows faintly where Korrath\'s heat seeped into the thread.',
};

// ============================================================
// Drop chance by rarity (per 10000)
// ============================================================
const DROP_CHANCE: Record<number, number> = {
  1: 4000,  // 40% — common Z2 gear
  2: 2000,  // 20%
  3: 500,   // 5%
  4: 100,   // 1% — boss drops
};

// ============================================================
// Monster inventory assignment
// Rarity-based: R1 from L11-13, R2 from L14-16, R3 from L17-19, R4 from L20
// ============================================================
function monsterInventory(m: MonsterDef): string[] {
  const inv: string[] = [];

  // Monster's own weapon (always first)
  inv.push(monsterWeaponName(m));

  // Drop pool based on level range
  if (m.level <= 13) {
    // R1 gear
    for (const w of WEAPONS.filter(w => w.rarity === 1)) inv.push(w.name);
    for (const a of ARMORS.filter(a => a.rarity === 1)) inv.push(a.name);
  } else if (m.level <= 16) {
    // R1-R2 gear
    for (const w of WEAPONS.filter(w => w.rarity <= 2)) inv.push(w.name);
    for (const a of ARMORS.filter(a => a.rarity <= 2)) inv.push(a.name);
  } else if (m.level <= 19) {
    // R2-R3 gear
    for (const w of WEAPONS.filter(w => w.rarity >= 2 && w.rarity <= 3)) inv.push(w.name);
    for (const a of ARMORS.filter(a => a.rarity >= 2 && a.rarity <= 3)) inv.push(a.name);
  } else {
    // Boss: R3-R4 gear
    for (const w of WEAPONS.filter(w => w.rarity >= 3)) inv.push(w.name);
    for (const a of ARMORS.filter(a => a.rarity >= 3)) inv.push(a.name);
  }

  // Z1 consumables (reusable across zones)
  inv.push('Minor Health Potion', 'Health Potion', 'Greater Health Potion');
  inv.push('Fortifying Stew', 'Quickening Berries', 'Focusing Tea');
  if (m.level >= 14) inv.push('Bloodrage Tonic', 'Stoneskin Salve', 'Trollblood Ale');
  if (m.level >= 17) inv.push('Venom Vial', 'Flashpowder');

  return inv;
}

function monsterWeaponName(m: MonsterDef): string {
  const slug = m.name.replace(/'/g, '').replace(/\s+/g, ' ');
  return `${slug} Strike`;
}

// ============================================================
// Generate monsters.json
// ============================================================
function generateMonsters() {
  return {
    monsters: MONSTERS.map(m => ({
      name: m.name,
      metadataUri: `monster:${m.name.toLowerCase().replace(/'/g, '').replace(/\s+/g, '_')}`,
      stats: {
        agility: m.agi,
        armor: m.armor,
        class: m.classType,
        experience: Math.round(m.xp / XP_SCALE),
        hasBossAI: m.isBoss ?? false,
        hitPoints: m.hp,
        intelligence: m.int,
        inventoryNames: monsterInventory(m),
        level: m.level,
        strength: m.str,
      },
    })),
  };
}

// ============================================================
// Generate items.json
// ============================================================
function toWei(gold: number): string {
  return `${gold}000000000000000000`;
}

function generateItems() {
  const armor = ARMORS.map(a => ({
    name: a.name,
    description: DESC[a.name] || '',
    rarity: a.rarity,
    dropChance: DROP_CHANCE[a.rarity] ?? 0,
    initialSupply: toWei(10),
    metadataUri: `armor:${a.name.toLowerCase().replace(/'/g, '').replace(/\s+/g, '_')}`,
    price: toWei(a.price),
    armorType: a.armorType,
    isStarter: false,
    stats: {
      agiModifier: a.agiMod,
      armorModifier: a.armorValue,
      hpModifier: a.hpMod,
      intModifier: a.intMod,
      minLevel: 0,
      strModifier: a.strMod,
    },
    statRestrictions: {
      minAgility: a.minAgi,
      minIntelligence: a.minInt,
      minStrength: a.minStr,
    },
  }));

  const weapons: any[] = [];

  // Player weapons
  for (const w of WEAPONS) {
    const baseEffect = w.isMagic ? BASIC_MAGIC : BASIC_PHYSICAL;
    weapons.push({
      name: w.name,
      description: DESC[w.name] || '',
      rarity: w.rarity,
      dropChance: DROP_CHANCE[w.rarity] ?? 0,
      initialSupply: toWei(10),
      metadataUri: `weapon:${w.name.toLowerCase().replace(/'/g, '').replace(/\s+/g, '_')}`,
      price: toWei(w.price),
      isStarter: false,
      scalingStat: w.scaling === 'agi' ? 'AGI' : '',
      stats: {
        agiModifier: w.agiMod,
        effects: [baseEffect],
        hpModifier: w.hpMod,
        intModifier: w.intMod,
        maxDamage: w.maxDamage,
        minDamage: w.minDamage,
        minLevel: 0,
        strModifier: w.strMod,
      },
      statRestrictions: {
        minAgility: w.minAgi,
        minIntelligence: w.minInt,
        minStrength: w.minStr,
      },
    });
  }

  // Monster weapons (non-droppable)
  for (const m of MONSTERS) {
    const baseEffect = m.weaponIsMagic ? BASIC_MAGIC : BASIC_PHYSICAL;
    weapons.push({
      name: monsterWeaponName(m),
      description: '',
      rarity: 0,
      dropChance: 0,
      initialSupply: toWei(10),
      metadataUri: `weapon:monster_${m.name.toLowerCase().replace(/'/g, '').replace(/\s+/g, '_')}`,
      price: 0,
      isStarter: false,
      scalingStat: m.weaponScaling === 'agi' ? 'AGI' : '',
      stats: {
        agiModifier: 0,
        effects: [baseEffect],
        hpModifier: 0,
        intModifier: 0,
        maxDamage: m.weaponMaxDmg,
        minDamage: m.weaponMinDmg,
        minLevel: 0,
        strModifier: 0,
      },
      statRestrictions: {
        minAgility: 0,
        minIntelligence: 0,
        minStrength: 0,
      },
    });
  }

  return { armor, weapons };
}

// ============================================================
// Generate effects.json (Z2-specific status effects)
// Reuses basic physical/magic damage from DC. Only new status effects here.
// ============================================================
function generateEffects() {
  const statusEffects = [
    // Monster effects
    { name: 'slash_wound', display: 'Slash Wound', strMod: 0, agiMod: 0, intMod: 0, armorMod: -3, dmg: 0, duration: 4, cooldown: 0, maxStacks: 1 },
    { name: 'cold_touch', display: 'Cold Touch', strMod: 0, agiMod: -4, intMod: 0, armorMod: 0, dmg: 0, duration: 3, cooldown: 0, maxStacks: 1 },
    { name: 'ground_pound', display: 'Ground Pound', strMod: -3, agiMod: -3, intMod: 0, armorMod: -2, dmg: 0, duration: 3, cooldown: 0, maxStacks: 1 },
    { name: 'wind_gust', display: 'Wind Gust', strMod: -4, agiMod: 0, intMod: 0, armorMod: -3, dmg: 0, duration: 3, cooldown: 0, maxStacks: 1 },
    { name: 'decay_bite', display: 'Decay Bite', strMod: 0, agiMod: 0, intMod: 0, armorMod: 0, dmg: 4, duration: 5, cooldown: 0, maxStacks: 1 },
    { name: 'corruption', display: 'Corruption', strMod: -3, agiMod: 0, intMod: -3, armorMod: 0, dmg: 0, duration: 4, cooldown: 0, maxStacks: 1 },
    { name: 'gore', display: 'Gore', strMod: 0, agiMod: 0, intMod: 0, armorMod: 0, dmg: 4, duration: 5, cooldown: 0, maxStacks: 1 },
    { name: 'burn', display: 'Burn', strMod: 0, agiMod: 0, intMod: 0, armorMod: 0, dmg: 3, duration: 5, cooldown: 0, maxStacks: 1 },
    { name: 'ground_slam', display: 'Ground Slam', strMod: -3, agiMod: -3, intMod: 0, armorMod: -2, dmg: 0, duration: 3, cooldown: 3, maxStacks: 1 },
    // Player weapon effects
    { name: 'z2_bleed', display: 'Bleed', strMod: 0, agiMod: 0, intMod: 0, armorMod: 0, dmg: 2, duration: 4, cooldown: 0, maxStacks: 1 },
    { name: 'hamstring', display: 'Hamstring', strMod: 0, agiMod: -3, intMod: 0, armorMod: 0, dmg: 0, duration: 3, cooldown: 0, maxStacks: 1 },
    { name: 'wither', display: 'Wither', strMod: -4, agiMod: 0, intMod: 0, armorMod: 0, dmg: 0, duration: 4, cooldown: 0, maxStacks: 1 },
    { name: 'deep_wound', display: 'Deep Wound', strMod: 0, agiMod: 0, intMod: 0, armorMod: 0, dmg: 3, duration: 5, cooldown: 0, maxStacks: 1 },
    { name: 'crush', display: 'Crush', strMod: 0, agiMod: 0, intMod: 0, armorMod: -4, dmg: 0, duration: 4, cooldown: 0, maxStacks: 1 },
    { name: 'lacerate', display: 'Lacerate', strMod: 0, agiMod: 0, intMod: 0, armorMod: 0, dmg: 3, duration: 5, cooldown: 0, maxStacks: 1 },
    { name: 'enfeeble', display: 'Enfeeble', strMod: -6, agiMod: 0, intMod: 0, armorMod: -3, dmg: 0, duration: 5, cooldown: 0, maxStacks: 1 },
    { name: 'arcane_burn', display: 'Arcane Burn', strMod: 0, agiMod: 0, intMod: 0, armorMod: 0, dmg: 3, duration: 5, cooldown: 0, maxStacks: 1 },
    { name: 'armor_rend', display: 'Armor Rend', strMod: 0, agiMod: 0, intMod: 0, armorMod: -3, dmg: 0, duration: 3, cooldown: 0, maxStacks: 1 },
    { name: 'venom_strike', display: 'Venom Strike', strMod: 0, agiMod: 0, intMod: 0, armorMod: 0, dmg: 3, duration: 5, cooldown: 0, maxStacks: 1 },
    { name: 'soulfire', display: 'Soulfire', strMod: 0, agiMod: 0, intMod: 0, armorMod: 0, dmg: 2, duration: 4, cooldown: 0, maxStacks: 1 },
    { name: 'z2_weaken', display: 'Weaken', strMod: -2, agiMod: 0, intMod: 0, armorMod: 0, dmg: 0, duration: 3, cooldown: 0, maxStacks: 1 },
    { name: 'z2_hybrid_bleed', display: 'Bleed', strMod: 0, agiMod: 0, intMod: 0, armorMod: 0, dmg: 3, duration: 4, cooldown: 0, maxStacks: 1 },
  ];

  return {
    magicDamage: [
      { effectId: BASIC_MAGIC, name: 'basic magic attack', stats: { attackModifierBonus: 0, bonusDamage: 0, critChanceBonus: 0 } },
    ],
    physicalDamage: [
      { effectId: BASIC_PHYSICAL, name: 'basic weapon attack', stats: { armorPenetration: 0, attackModifierBonus: 0, bonusDamage: 0, critChanceBonus: 0 } },
    ],
    statusEffects: statusEffects.map(e => ({
      effectId: effectId(e.name),
      name: e.name,
      stats: {
        agiModifier: e.agiMod,
        armorModifier: e.armorMod,
        damagePerTick: e.dmg,
        hpModifier: 0,
        intModifier: e.intMod,
        resistanceStat: 0,
        strModifier: e.strMod,
      },
      validity: {
        cooldown: e.cooldown,
        maxStacks: e.maxStacks,
        validTime: 0,
        validTurns: e.duration,
      },
    })),
  };
}

// ============================================================
// Write files
// ============================================================
const outDir = path.join(__dirname, '..', 'zones', 'windy_peaks');

const monstersJson = generateMonsters();
const itemsJson = generateItems();
const effectsJson = generateEffects();

fs.writeFileSync(path.join(outDir, 'monsters.json'), JSON.stringify(monstersJson, null, 2) + '\n');
fs.writeFileSync(path.join(outDir, 'items.json'), JSON.stringify(itemsJson, null, 2) + '\n');
fs.writeFileSync(path.join(outDir, 'effects.json'), JSON.stringify(effectsJson, null, 2) + '\n');

console.log(`Generated zone data in ${outDir}:`);
console.log(`  monsters.json: ${monstersJson.monsters.length} monsters`);
console.log(`  items.json: ${itemsJson.armor.length} armor, ${itemsJson.weapons.length} weapons (${WEAPONS.length} player + ${MONSTERS.length} monster)`);
console.log(`  effects.json: ${effectsJson.statusEffects.length} status effects`);
