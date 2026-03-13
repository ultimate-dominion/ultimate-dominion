/**
 * Proposed balance changes — overrides applied on top of on-chain data.
 *
 * The sim always uses proposed combat constants (testing changes before deploy).
 * Weapon/armor/monster variants are selected via CLI flags.
 *
 * ALL data here represents PROPOSED changes, not what's currently on-chain.
 * On-chain state is loaded by loader.ts from zone JSON + constants.json.
 */

import type {
  GameData,
  Weapon,
  Armor,
  Monster,
  ClassSpell,
  WeaponEffect,
  CombatConstants,
  LevelingConstants,
  Consumable,
} from "./types.js";

// ============================================================
// PROPOSED LEVELING CONSTANTS
// ============================================================

export const PROPOSED_LEVELING_CONSTANTS: LevelingConstants = {
  baseHp: 18,
  earlyGameCap: 10,
  midGameCap: 50,
  statPointsEarly: 1,             // on-chain: 2
  statPointsMid: 1,
  statPointsLate: 1,
  hpGainEarly: 2,
  hpGainMid: 1,
  hpGainLate: 1,
  powerSourceBonusLevel: 5,
};

// ============================================================
// PROPOSED COMBAT CONSTANTS
// These differ from on-chain (constants.json) — see SESSION.md for full diff
// ============================================================

export const PROPOSED_COMBAT_CONSTANTS: CombatConstants = {
  attackModifier: 1.2,
  agiAttackModifier: 1.0,        // on-chain: 0.9
  defenseModifier: 1.0,           // same as on-chain
  critMultiplier: 2,
  critBaseChance: 5,              // on-chain: 4
  critAgiDivisor: 4,              // same as on-chain (sim uses hardcoded /4 in resolveAttack)
  evasionMultiplier: 2,            // (AGI diff) × 2, capped at 35% — fixed from division to match design
  evasionCap: 35,                 // on-chain: 25
  doubleStrikeMultiplier: 3,      // on-chain: 2 (sim uses × 3 in resolveAttack)
  doubleStrikeCap: 40,            // on-chain: 25
  combatTriangleFlatPct: 0,        // removed — triangle driven by per-stat bonus only
  combatTrianglePerStat: 0.02,    // on-chain: 0.02 (same, but triangle cap differs)
  combatTriangleMax: 0.12,        // on-chain: 0.20
  magicResistPerInt: 3,           // on-chain: 2
  magicResistCap: 40,
  blockChancePerStr: 2,           // on-chain: 1.5
  blockChanceCap: 35,
  blockReductionPhys: 0.55,
  blockReductionMagic: 0.30,      // partial block vs magic (30% vs 55% physical) — closes INT>STR gap
  hitStartingProbability: 90,     // same as on-chain (not used by sim yet)
  hitAttackerDampener: 95,        // same as on-chain (not used by sim yet)
  hitDefenderDampener: 30,        // same as on-chain (not used by sim yet)
  hitMin: 5,                      // same as on-chain (not used by sim yet)
  hitMax: 98,                     // same as on-chain (not used by sim yet)
  spellDodgeThreshold: 10,        // same as on-chain (not used by sim yet)
  spellDodgePctPerAgi: 2.0,       // same as on-chain (not used by sim yet)
  spellDodgeCap: 20,              // same as on-chain (not used by sim yet)
  classMultiplierBase: 1000,      // same as on-chain
};

// ============================================================
// CLASS SPELLS (L5) — not on-chain yet, entirely proposed
// Cast once on turn 1, replacing weapon attack.
// ============================================================

export const CLASS_SPELLS: Record<string, ClassSpell> = {
  // STR classes: tank spells — survivability over damage
  Warrior:  { name: "Battle Cry",    type: "damage_buff",   baseDmgMin: 5, baseDmgMax: 10, dmgPerStr: 0.5, strPct: 0.25, armorMod: 8, hpPct: 0.10, duration: 8, maxUses: 2 },
  Paladin:  { name: "Divine Shield", type: "self_buff",     strPct: 0.15, armorMod: 10, hpPct: 0.15, duration: 8, maxUses: 2 },

  // AGI classes
  Ranger:   { name: "Marked Shot",     type: "damage_debuff", baseDmgMin: 4, baseDmgMax: 8, dmgPerAgi: 0.4, agiPct: -0.20, armorMod: -5, duration: 8 },
  Rogue:    { name: "Expose Weakness", type: "damage_debuff", baseDmgMin: 4, baseDmgMax: 8, dmgPerAgi: 0.4, armorMod: -8, strPct: -0.15, duration: 8 },

  // Hybrid: Druid deals nature (magic) damage + anti-AGI debuff + armor strip (roots pull at plate)
  Druid:    { name: "Entangle",      type: "damage_debuff", baseDmgMin: 3, baseDmgMax: 6, dmgPerInt: 0.3, agiPct: -0.25, strPct: -0.15, armorMod: -3, duration: 8 },

  // INT classes
  Warlock:  { name: "Soul Drain",    type: "damage_debuff", baseDmgMin: 4, baseDmgMax: 8, dmgPerInt: 0.4, strPct: -0.12, intPct: -0.12, duration: 5, maxUses: 2 },
  Wizard:   { name: "Arcane Blast",  type: "magic_damage",  baseDmgMin: 5, baseDmgMax: 10, dmgPerInt: 0.5, maxUses: 3 },
  Sorcerer: { name: "Arcane Infusion", type: "weapon_enchant", baseDmgMin: 3, baseDmgMax: 6, dmgPerInt: 0.25, duration: 10 },
  Cleric:   { name: "Blessing",      type: "self_buff",     intPct: 0.12, armorMod: 7, hpPct: 0.15, duration: 6, maxUses: 2 },
};

// ============================================================
// WEAPONS — tuned baseline (the balanced set from sim sessions)
// This is the DEFAULT weapon set the sim uses. Different from on-chain
// (which has different names + stats). This is what we're deploying.
//
// Name renames from on-chain:
//   Recurve Bow → Shortbow
//   Etched Blade → Notched Blade
//   Crystal Blade → Crystal Shard
//   Rat King's Fang → Dire Rat Fang
//   Troll's Bonebreaker → Troll's Cudgel
//   Giant's Club → Stone Maul
// ============================================================

export const WEAPONS_BASELINE: Weapon[] = [
  // Starters (R0)
  { name: "Broken Sword",     minDamage: 1, maxDamage: 1, strMod: 1, agiMod: 0, intMod: 0, hpMod: 0, scaling: "str", isMagic: false, minStr: 0,  minAgi: 0,  minInt: 0,  rarity: 0, price: 5 },
  { name: "Worn Shortbow",    minDamage: 1, maxDamage: 1, strMod: 0, agiMod: 1, intMod: 0, hpMod: 0, scaling: "agi", isMagic: false, minStr: 0,  minAgi: 0,  minInt: 0,  rarity: 0, price: 5 },
  { name: "Cracked Wand",     minDamage: 1, maxDamage: 1, strMod: 0, agiMod: 0, intMod: 1, hpMod: 0, scaling: "str", isMagic: true,  minStr: 0,  minAgi: 0,  minInt: 0,  rarity: 0, price: 5 },
  // R1
  { name: "Iron Axe",         minDamage: 1, maxDamage: 2, strMod: 1, agiMod: 0, intMod: 0, hpMod: 0, scaling: "str", isMagic: false, minStr: 5,  minAgi: 0,  minInt: 0,  rarity: 1, price: 15 },
  { name: "Hunting Bow",      minDamage: 1, maxDamage: 2, strMod: 0, agiMod: 1, intMod: 0, hpMod: 0, scaling: "agi", isMagic: false, minStr: 0,  minAgi: 8,  minInt: 0,  rarity: 1, price: 15 },
  { name: "Apprentice Staff",  minDamage: 1, maxDamage: 2, strMod: 0, agiMod: 0, intMod: 1, hpMod: 2, scaling: "str", isMagic: true,  minStr: 0,  minAgi: 0,  minInt: 6,  rarity: 1, price: 15 },
  { name: "Light Mace",       minDamage: 2, maxDamage: 4, strMod: 2, agiMod: 0, intMod: 0, hpMod: 5, scaling: "str", isMagic: false, minStr: 9,  minAgi: 0,  minInt: 0,  rarity: 1, price: 40 },
  { name: "Shortbow",         minDamage: 2, maxDamage: 3, strMod: 0, agiMod: 2, intMod: 0, hpMod: 0, scaling: "agi", isMagic: false, minStr: 0,  minAgi: 7,  minInt: 0,  rarity: 1, price: 40 },
  { name: "Channeling Rod",   minDamage: 2, maxDamage: 3, strMod: 0, agiMod: 0, intMod: 2, hpMod: 2, scaling: "str", isMagic: true,  minStr: 0,  minAgi: 0,  minInt: 10, rarity: 1, price: 40 },
  { name: "Notched Blade",    minDamage: 2, maxDamage: 3, strMod: 1, agiMod: 0, intMod: 1, hpMod: 0, scaling: "str", isMagic: false, minStr: 5,  minAgi: 0,  minInt: 5,  rarity: 1, price: 50 },
  // R2
  { name: "Notched Cleaver",  minDamage: 2, maxDamage: 4, strMod: 2, agiMod: 0, intMod: 0, hpMod: 3, scaling: "str", isMagic: false, minStr: 7,  minAgi: 0,  minInt: 0,  rarity: 2, price: 60 },
  { name: "Sporecap Wand",    minDamage: 1, maxDamage: 2, strMod: 0, agiMod: 0, intMod: 2, hpMod: 3, scaling: "str", isMagic: true,  minStr: 0,  minAgi: 0,  minInt: 5,  rarity: 2, price: 60 },
  { name: "Crystal Shard",    minDamage: 6, maxDamage: 9, strMod: 1, agiMod: 0, intMod: 2, hpMod: 3, scaling: "str", isMagic: false, minStr: 5,  minAgi: 0,  minInt: 5,  rarity: 2, price: 70 },
  { name: "Webspinner Bow",   minDamage: 3, maxDamage: 4, strMod: 0, agiMod: 3, intMod: 0, hpMod: 0, scaling: "agi", isMagic: false, minStr: 0,  minAgi: 10, minInt: 0,  rarity: 2, price: 90 },
  { name: "Warhammer",        minDamage: 4, maxDamage: 7, strMod: 3, agiMod: 0, intMod: 0, hpMod: 8, scaling: "str", isMagic: false, minStr: 13, minAgi: 0,  minInt: 0,  rarity: 2, price: 100 },
  { name: "Longbow",          minDamage: 4, maxDamage: 6, strMod: 0, agiMod: 3, intMod: 0, hpMod: 0, scaling: "agi", isMagic: false, minStr: 0,  minAgi: 15, minInt: 0,  rarity: 2, price: 100 },
  { name: "Mage Staff",       minDamage: 3, maxDamage: 5, strMod: 0, agiMod: 0, intMod: 3, hpMod: 5, scaling: "str", isMagic: true,  minStr: 0,  minAgi: 0,  minInt: 11, rarity: 2, price: 100 },
  // R3
  { name: "Dire Rat Fang",    minDamage: 2, maxDamage: 3, strMod: 0, agiMod: 2, intMod: 0, hpMod: 0, scaling: "str", isMagic: false, minStr: 0,  minAgi: 0,  minInt: 0,  rarity: 3, price: 150 },
  { name: "Gnarled Cudgel",   minDamage: 4, maxDamage: 6, strMod: 3, agiMod: 0, intMod: 0, hpMod: 5, scaling: "str", isMagic: false, minStr: 12, minAgi: 0,  minInt: 0,  rarity: 3, price: 180 },
  { name: "Bone Staff",       minDamage: 3, maxDamage: 5, strMod: 0, agiMod: 0, intMod: 3, hpMod: 3, scaling: "str", isMagic: true,  minStr: 0,  minAgi: 0,  minInt: 13, rarity: 3, price: 180 },
  { name: "Stone Maul",       minDamage: 5, maxDamage: 7, strMod: 4, agiMod: 0, intMod: 0, hpMod: 8, scaling: "str", isMagic: false, minStr: 15, minAgi: 0,  minInt: 0,  rarity: 3, price: 250 },
  // R4
  { name: "Darkwood Bow",     minDamage: 6, maxDamage: 9, strMod: 2, agiMod: 5, intMod: 0, hpMod: 3, scaling: "agi", isMagic: false, minStr: 0,  minAgi: 18, minInt: 0,  rarity: 4, price: 220 },
  { name: "Smoldering Rod",   minDamage: 5, maxDamage: 8, strMod: 0, agiMod: 2, intMod: 5, hpMod: 5, scaling: "str", isMagic: true,  minStr: 0,  minAgi: 0,  minInt: 16, rarity: 4, price: 300 },
];

// ============================================================
// WEAPON VARIANTS — proposed rebalancing on top of baseline
//   Giant's Club → Stone Maul
// ============================================================

/** V1 Rebalanced: stat changes only, no requirement changes */
export const WEAPONS_REBALANCED: Weapon[] = [
  // Starters (R0) — unchanged from on-chain
  { name: "Broken Sword",     minDamage: 1, maxDamage: 1, strMod: 1, agiMod: 0, intMod: 0, hpMod: 0, scaling: "str", isMagic: false, minStr: 0,  minAgi: 0,  minInt: 0,  rarity: 0, price: 5 },
  { name: "Worn Shortbow",    minDamage: 1, maxDamage: 1, strMod: 0, agiMod: 1, intMod: 0, hpMod: 0, scaling: "agi", isMagic: false, minStr: 0,  minAgi: 0,  minInt: 0,  rarity: 0, price: 5 },
  { name: "Cracked Wand",     minDamage: 1, maxDamage: 1, strMod: 0, agiMod: 0, intMod: 1, hpMod: 0, scaling: "str", isMagic: true,  minStr: 0,  minAgi: 0,  minInt: 0,  rarity: 0, price: 5 },
  // R1 — STR HP reduced, AGI gets HP
  { name: "Iron Axe",         minDamage: 1, maxDamage: 2, strMod: 1, agiMod: 0, intMod: 0, hpMod: 0, scaling: "str", isMagic: false, minStr: 5,  minAgi: 0,  minInt: 0,  rarity: 1, price: 15 },
  { name: "Hunting Bow",      minDamage: 1, maxDamage: 2, strMod: 0, agiMod: 1, intMod: 0, hpMod: 2, scaling: "agi", isMagic: false, minStr: 0,  minAgi: 8,  minInt: 0,  rarity: 1, price: 15 },
  { name: "Apprentice Staff",  minDamage: 1, maxDamage: 2, strMod: 0, agiMod: 0, intMod: 1, hpMod: 2, scaling: "str", isMagic: true,  minStr: 0,  minAgi: 0,  minInt: 6,  rarity: 1, price: 15 },
  { name: "Light Mace",       minDamage: 2, maxDamage: 4, strMod: 2, agiMod: 0, intMod: 0, hpMod: 3, scaling: "str", isMagic: false, minStr: 9,  minAgi: 0,  minInt: 0,  rarity: 1, price: 40 },
  { name: "Shortbow",      minDamage: 2, maxDamage: 3, strMod: 0, agiMod: 2, intMod: 0, hpMod: 3, scaling: "agi", isMagic: false, minStr: 0,  minAgi: 7,  minInt: 0,  rarity: 1, price: 40 },
  { name: "Channeling Rod",   minDamage: 2, maxDamage: 3, strMod: 0, agiMod: 0, intMod: 2, hpMod: 3, scaling: "str", isMagic: true,  minStr: 0,  minAgi: 0,  minInt: 10, rarity: 1, price: 40 },
  { name: "Notched Blade",     minDamage: 2, maxDamage: 3, strMod: 1, agiMod: 0, intMod: 1, hpMod: 0, scaling: "str", isMagic: false, minStr: 5,  minAgi: 0,  minInt: 5,  rarity: 1, price: 50 },
  // R2
  { name: "Notched Cleaver",  minDamage: 2, maxDamage: 4, strMod: 2, agiMod: 0, intMod: 0, hpMod: 2, scaling: "str", isMagic: false, minStr: 7,  minAgi: 0,  minInt: 0,  rarity: 2, price: 60 },
  { name: "Sporecap Wand",    minDamage: 1, maxDamage: 2, strMod: 0, agiMod: 0, intMod: 2, hpMod: 3, scaling: "str", isMagic: true,  minStr: 0,  minAgi: 0,  minInt: 5,  rarity: 2, price: 60 },
  { name: "Crystal Shard",    minDamage: 4, maxDamage: 6, strMod: 1, agiMod: 0, intMod: 2, hpMod: 3, scaling: "str", isMagic: false, minStr: 5,  minAgi: 0,  minInt: 5,  rarity: 2, price: 70 },
  { name: "Webspinner Bow",   minDamage: 3, maxDamage: 5, strMod: 0, agiMod: 3, intMod: 0, hpMod: 4, scaling: "agi", isMagic: false, minStr: 0,  minAgi: 10, minInt: 0,  rarity: 2, price: 90 },
  { name: "Warhammer",        minDamage: 4, maxDamage: 7, strMod: 3, agiMod: 0, intMod: 0, hpMod: 5, scaling: "str", isMagic: false, minStr: 13, minAgi: 0,  minInt: 0,  rarity: 2, price: 100 },
  { name: "Longbow",          minDamage: 4, maxDamage: 7, strMod: 0, agiMod: 3, intMod: 0, hpMod: 5, scaling: "agi", isMagic: false, minStr: 0,  minAgi: 15, minInt: 0,  rarity: 2, price: 100 },
  { name: "Mage Staff",       minDamage: 3, maxDamage: 5, strMod: 0, agiMod: 0, intMod: 3, hpMod: 5, scaling: "str", isMagic: true,  minStr: 0,  minAgi: 0,  minInt: 11, rarity: 2, price: 100 },
  // R3
  { name: "Dire Rat Fang",  minDamage: 2, maxDamage: 3, strMod: 0, agiMod: 2, intMod: 0, hpMod: 0, scaling: "str", isMagic: false, minStr: 0,  minAgi: 0,  minInt: 0,  rarity: 3, price: 150 },
  { name: "Gnarled Cudgel", minDamage: 4, maxDamage: 6, strMod: 3, agiMod: 0, intMod: 0, hpMod: 3, scaling: "str", isMagic: false, minStr: 12, minAgi: 0,  minInt: 0,  rarity: 3, price: 180 },
  { name: "Bone Staff",       minDamage: 3, maxDamage: 5, strMod: 0, agiMod: 0, intMod: 3, hpMod: 5, scaling: "str", isMagic: true,  minStr: 0,  minAgi: 0,  minInt: 13, rarity: 3, price: 180 },
  { name: "Stone Maul",     minDamage: 5, maxDamage: 7, strMod: 4, agiMod: 0, intMod: 0, hpMod: 5, scaling: "str", isMagic: false, minStr: 15, minAgi: 0,  minInt: 0,  rarity: 3, price: 250 },
  // R4
  { name: "Darkwood Bow",     minDamage: 7, maxDamage: 10,strMod: 2, agiMod: 5, intMod: 0, hpMod: 6, scaling: "agi", isMagic: false, minStr: 0,  minAgi: 18, minInt: 0,  rarity: 4, price: 220 },
  { name: "Smoldering Rod",   minDamage: 5, maxDamage: 8, strMod: 0, agiMod: 2, intMod: 5, hpMod: 6, scaling: "str", isMagic: true,  minStr: 0,  minAgi: 0,  minInt: 16, rarity: 4, price: 300 },
];

/** V2: Secondary stat requirements on weapons. Creates cross-path tradeoffs. */
export const WEAPONS_V2: Weapon[] = [
  // R0 — no requirements
  { name: "Broken Sword",     minDamage: 1, maxDamage: 1, strMod: 1, agiMod: 0, intMod: 0, hpMod: 0, scaling: "str", isMagic: false, minStr: 0,  minAgi: 0,  minInt: 0,  rarity: 0, price: 5 },
  { name: "Worn Shortbow",    minDamage: 1, maxDamage: 1, strMod: 0, agiMod: 1, intMod: 0, hpMod: 0, scaling: "agi", isMagic: false, minStr: 0,  minAgi: 0,  minInt: 0,  rarity: 0, price: 5 },
  { name: "Cracked Wand",     minDamage: 1, maxDamage: 1, strMod: 0, agiMod: 0, intMod: 1, hpMod: 0, scaling: "str", isMagic: true,  minStr: 0,  minAgi: 0,  minInt: 0,  rarity: 0, price: 5 },
  // R1 cheap (15g) — single primary req
  { name: "Iron Axe",         minDamage: 1, maxDamage: 2, strMod: 1, agiMod: 0, intMod: 0, hpMod: 0, scaling: "str", isMagic: false, minStr: 5,  minAgi: 0,  minInt: 0,  rarity: 1, price: 15 },
  { name: "Hunting Bow",      minDamage: 1, maxDamage: 2, strMod: 0, agiMod: 1, intMod: 0, hpMod: 2, scaling: "agi", isMagic: false, minStr: 0,  minAgi: 8,  minInt: 0,  rarity: 1, price: 15 },
  { name: "Apprentice Staff",  minDamage: 1, maxDamage: 2, strMod: 0, agiMod: 0, intMod: 1, hpMod: 2, scaling: "str", isMagic: true,  minStr: 0,  minAgi: 0,  minInt: 6,  rarity: 1, price: 15 },
  // R1 mid — slight secondary
  { name: "Light Mace",       minDamage: 2, maxDamage: 4, strMod: 2, agiMod: 0, intMod: 0, hpMod: 3, scaling: "str", isMagic: false, minStr: 9,  minAgi: 5,  minInt: 0,  rarity: 1, price: 40 },
  { name: "Shortbow",      minDamage: 2, maxDamage: 3, strMod: 0, agiMod: 2, intMod: 0, hpMod: 3, scaling: "agi", isMagic: false, minStr: 6,  minAgi: 7,  minInt: 0,  rarity: 1, price: 40 },
  { name: "Channeling Rod",   minDamage: 2, maxDamage: 3, strMod: 0, agiMod: 0, intMod: 2, hpMod: 3, scaling: "str", isMagic: true,  minStr: 4,  minAgi: 0,  minInt: 10, rarity: 1, price: 40 },
  { name: "Notched Blade",     minDamage: 2, maxDamage: 3, strMod: 1, agiMod: 0, intMod: 1, hpMod: 0, scaling: "str", isMagic: false, minStr: 5,  minAgi: 0,  minInt: 5,  rarity: 1, price: 50 },
  // R2 mid — moderate secondary
  { name: "Notched Cleaver",  minDamage: 2, maxDamage: 4, strMod: 2, agiMod: 0, intMod: 0, hpMod: 2, scaling: "str", isMagic: false, minStr: 7,  minAgi: 5,  minInt: 0,  rarity: 2, price: 60 },
  { name: "Sporecap Wand",    minDamage: 1, maxDamage: 2, strMod: 0, agiMod: 0, intMod: 2, hpMod: 3, scaling: "str", isMagic: true,  minStr: 0,  minAgi: 0,  minInt: 5,  rarity: 2, price: 60 },
  { name: "Crystal Shard",    minDamage: 4, maxDamage: 6, strMod: 1, agiMod: 0, intMod: 2, hpMod: 3, scaling: "str", isMagic: false, minStr: 8,  minAgi: 0,  minInt: 8,  rarity: 2, price: 70 },
  { name: "Webspinner Bow",   minDamage: 3, maxDamage: 5, strMod: 0, agiMod: 3, intMod: 0, hpMod: 4, scaling: "agi", isMagic: false, minStr: 7,  minAgi: 10, minInt: 0,  rarity: 2, price: 90 },
  { name: "Warhammer",        minDamage: 4, maxDamage: 7, strMod: 3, agiMod: 0, intMod: 0, hpMod: 5, scaling: "str", isMagic: false, minStr: 13, minAgi: 6,  minInt: 0,  rarity: 2, price: 100 },
  { name: "Longbow",          minDamage: 4, maxDamage: 7, strMod: 0, agiMod: 3, intMod: 0, hpMod: 5, scaling: "agi", isMagic: false, minStr: 8,  minAgi: 15, minInt: 0,  rarity: 2, price: 100 },
  { name: "Mage Staff",       minDamage: 3, maxDamage: 5, strMod: 0, agiMod: 0, intMod: 3, hpMod: 5, scaling: "str", isMagic: true,  minStr: 5,  minAgi: 0,  minInt: 11, rarity: 2, price: 100 },
  // R3
  { name: "Dire Rat Fang",  minDamage: 2, maxDamage: 3, strMod: 0, agiMod: 2, intMod: 0, hpMod: 0, scaling: "str", isMagic: false, minStr: 0,  minAgi: 0,  minInt: 0,  rarity: 3, price: 150 },
  { name: "Gnarled Cudgel", minDamage: 4, maxDamage: 6, strMod: 3, agiMod: 0, intMod: 0, hpMod: 3, scaling: "str", isMagic: false, minStr: 12, minAgi: 6,  minInt: 0,  rarity: 3, price: 180 },
  { name: "Bone Staff",       minDamage: 3, maxDamage: 5, strMod: 0, agiMod: 0, intMod: 3, hpMod: 5, scaling: "str", isMagic: true,  minStr: 6,  minAgi: 0,  minInt: 13, rarity: 3, price: 180 },
  { name: "Stone Maul",     minDamage: 5, maxDamage: 7, strMod: 4, agiMod: 0, intMod: 0, hpMod: 5, scaling: "str", isMagic: false, minStr: 15, minAgi: 8,  minInt: 0,  rarity: 3, price: 250 },
  // R4
  { name: "Darkwood Bow",     minDamage: 7, maxDamage: 10,strMod: 2, agiMod: 5, intMod: 0, hpMod: 6, scaling: "agi", isMagic: false, minStr: 9,  minAgi: 18, minInt: 0,  rarity: 4, price: 220 },
  { name: "Smoldering Rod",   minDamage: 5, maxDamage: 8, strMod: 0, agiMod: 2, intMod: 5, hpMod: 6, scaling: "str", isMagic: true,  minStr: 7,  minAgi: 0,  minInt: 16, rarity: 4, price: 300 },
];

/**
 * V3: Epic hybrid weapons + pure path nerfs + secondary reqs scaled for 1pt/level.
 * Rogue gets Phasefang (AGI/INT hybrid). Epic weapons have status effects.
 */
export const WEAPONS_V3: Weapon[] = [
  // R0 — unchanged
  { name: "Broken Sword",     minDamage: 1, maxDamage: 1, strMod: 1, agiMod: 0, intMod: 0, hpMod: 0, scaling: "str", isMagic: false, minStr: 0,  minAgi: 0,  minInt: 0,  rarity: 0, price: 5 },
  { name: "Worn Shortbow",    minDamage: 1, maxDamage: 1, strMod: 0, agiMod: 1, intMod: 0, hpMod: 0, scaling: "agi", isMagic: false, minStr: 0,  minAgi: 0,  minInt: 0,  rarity: 0, price: 5 },
  { name: "Cracked Wand",     minDamage: 1, maxDamage: 1, strMod: 0, agiMod: 0, intMod: 1, hpMod: 0, scaling: "str", isMagic: true,  minStr: 0,  minAgi: 0,  minInt: 0,  rarity: 0, price: 5 },
  // R1 cheap — unchanged from V2
  { name: "Iron Axe",         minDamage: 1, maxDamage: 2, strMod: 1, agiMod: 0, intMod: 0, hpMod: 0, scaling: "str", isMagic: false, minStr: 5,  minAgi: 0,  minInt: 0,  rarity: 1, price: 15 },
  { name: "Hunting Bow",      minDamage: 1, maxDamage: 2, strMod: 0, agiMod: 1, intMod: 0, hpMod: 2, scaling: "agi", isMagic: false, minStr: 0,  minAgi: 8,  minInt: 0,  rarity: 1, price: 15 },
  { name: "Apprentice Staff",  minDamage: 1, maxDamage: 2, strMod: 0, agiMod: 0, intMod: 1, hpMod: 2, scaling: "str", isMagic: true,  minStr: 0,  minAgi: 0,  minInt: 6,  rarity: 1, price: 15 },
  // R1 mid — secondary reqs scaled for 1pt/level
  { name: "Light Mace",       minDamage: 2, maxDamage: 4, strMod: 2, agiMod: 0, intMod: 0, hpMod: 3, scaling: "str", isMagic: false, minStr: 8,  minAgi: 3,  minInt: 0,  rarity: 1, price: 40 },
  { name: "Shortbow",      minDamage: 2, maxDamage: 3, strMod: 0, agiMod: 2, intMod: 0, hpMod: 3, scaling: "agi", isMagic: false, minStr: 4,  minAgi: 7,  minInt: 0,  rarity: 1, price: 40 },
  { name: "Channeling Rod",   minDamage: 2, maxDamage: 3, strMod: 0, agiMod: 0, intMod: 2, hpMod: 3, scaling: "str", isMagic: true,  minStr: 3,  minAgi: 0,  minInt: 9,  rarity: 1, price: 40 },
  { name: "Notched Blade",     minDamage: 2, maxDamage: 3, strMod: 1, agiMod: 0, intMod: 1, hpMod: 0, scaling: "str", isMagic: false, minStr: 4,  minAgi: 0,  minInt: 4,  rarity: 1, price: 50 },
  // R2 mid — secondary reqs scaled
  { name: "Notched Cleaver",  minDamage: 2, maxDamage: 4, strMod: 2, agiMod: 0, intMod: 0, hpMod: 2, scaling: "str", isMagic: false, minStr: 7,  minAgi: 3,  minInt: 0,  rarity: 2, price: 60 },
  { name: "Sporecap Wand",    minDamage: 1, maxDamage: 2, strMod: 0, agiMod: 0, intMod: 2, hpMod: 3, scaling: "str", isMagic: true,  minStr: 0,  minAgi: 0,  minInt: 5,  rarity: 2, price: 60 },
  { name: "Crystal Shard",    minDamage: 4, maxDamage: 6, strMod: 1, agiMod: 0, intMod: 2, hpMod: 3, scaling: "str", isMagic: false, minStr: 6,  minAgi: 0,  minInt: 6,  rarity: 2, price: 70 },
  { name: "Webspinner Bow",   minDamage: 3, maxDamage: 5, strMod: 0, agiMod: 3, intMod: 0, hpMod: 4, scaling: "agi", isMagic: false, minStr: 5,  minAgi: 10, minInt: 0,  rarity: 2, price: 90 },
  // R2 high — reqs scaled for 1pt/level
  { name: "Warhammer",        minDamage: 4, maxDamage: 7, strMod: 3, agiMod: 0, intMod: 0, hpMod: 5, scaling: "str", isMagic: false, minStr: 11, minAgi: 4,  minInt: 0,  rarity: 2, price: 100 },
  { name: "Longbow",          minDamage: 4, maxDamage: 7, strMod: 0, agiMod: 3, intMod: 0, hpMod: 5, scaling: "agi", isMagic: false, minStr: 4,  minAgi: 13, minInt: 0,  rarity: 2, price: 100 },
  { name: "Mage Staff",       minDamage: 3, maxDamage: 5, strMod: 0, agiMod: 0, intMod: 3, hpMod: 5, scaling: "str", isMagic: true,  minStr: 4,  minAgi: 0,  minInt: 9,  rarity: 2, price: 100 },
  // R3 — pure path ceiling (nerfed from V2)
  { name: "Dire Rat Fang",  minDamage: 2, maxDamage: 3, strMod: 0, agiMod: 2, intMod: 0, hpMod: 0, scaling: "str", isMagic: false, minStr: 0,  minAgi: 0,  minInt: 0,  rarity: 3, price: 150 },
  { name: "Gnarled Cudgel", minDamage: 4, maxDamage: 6, strMod: 3, agiMod: 0, intMod: 0, hpMod: 3, scaling: "str", isMagic: false, minStr: 10, minAgi: 4,  minInt: 0,  rarity: 3, price: 180 },
  { name: "Bone Staff",       minDamage: 3, maxDamage: 5, strMod: 0, agiMod: 0, intMod: 3, hpMod: 5, scaling: "str", isMagic: true,  minStr: 4,  minAgi: 0,  minInt: 11, rarity: 3, price: 180 },
  { name: "Stone Maul",     minDamage: 5, maxDamage: 6, strMod: 3, agiMod: 0, intMod: 0, hpMod: 5, scaling: "str", isMagic: false, minStr: 13, minAgi: 5,  minInt: 0,  rarity: 3, price: 250 },
  // R3 — pure path endgame (demoted from R4)
  { name: "Darkwood Bow",     minDamage: 7, maxDamage: 10, strMod: 2, agiMod: 5, intMod: 0, hpMod: 6, scaling: "agi", isMagic: false, minStr: 4,  minAgi: 14, minInt: 0,  rarity: 3, price: 220 },
  { name: "Smoldering Rod",   minDamage: 5, maxDamage: 7, strMod: 0, agiMod: 2, intMod: 5, hpMod: 6, scaling: "str", isMagic: true,  minStr: 5,  minAgi: 0,  minInt: 13, rarity: 3, price: 300 },
  // R4 EPIC — hybrid weapons (require cross-path investment, marketplace drivers)
  { name: "Trollhide Cleaver", minDamage: 6, maxDamage: 9, strMod: 3, agiMod: 3, intMod: 0, hpMod: 5, scaling: "str", isMagic: false, minStr: 16, minAgi: 10, minInt: 0,  rarity: 4, price: 350 },
  { name: "Phasefang",  minDamage: 4, maxDamage: 8, strMod: 0, agiMod: 4, intMod: 3, hpMod: 5, scaling: "agi", isMagic: true,  minStr: 0,  minAgi: 16, minInt: 11, rarity: 4, price: 350 },
  { name: "Drakescale Staff",   minDamage: 5, maxDamage: 8, strMod: 2, agiMod: 0, intMod: 3, hpMod: 5, scaling: "str", isMagic: true,  minStr: 12, minAgi: 0,  minInt: 11, rarity: 4, price: 350 },
];

// ============================================================
// ARMOR WITH SECONDARY STAT REQUIREMENTS (proposed — on-chain has primary only)
// ============================================================

export const ARMORS_WITH_SECONDARY_REQS: Armor[] = [
  // R0 — unchanged
  { name: "Tattered Cloth",     armorValue: 1, strMod: 0,  agiMod: 0, intMod: 1, hpMod: 0, minStr: 0,  minAgi: 0,  minInt: 0,  armorType: "Cloth",   rarity: 0, price: 5 },
  { name: "Worn Leather Vest",  armorValue: 2, strMod: -1, agiMod: 1, intMod: 0, hpMod: 0, minStr: 0,  minAgi: 0,  minInt: 0,  armorType: "Leather", rarity: 0, price: 5 },
  { name: "Rusty Chainmail",    armorValue: 3, strMod: 0,  agiMod: -1,intMod: 0, hpMod: 0, minStr: 0,  minAgi: 0,  minInt: 0,  armorType: "Plate",   rarity: 0, price: 5 },
  // R1 — single primary req
  { name: "Padded Armor",       armorValue: 3, strMod: 1,  agiMod: 0, intMod: 0, hpMod: 0, minStr: 8,  minAgi: 0,  minInt: 0,  armorType: "Plate",   rarity: 1, price: 15 },
  { name: "Leather Jerkin",     armorValue: 2, strMod: 0,  agiMod: 1, intMod: 0, hpMod: 0, minStr: 0,  minAgi: 5,  minInt: 0,  armorType: "Leather", rarity: 1, price: 15 },
  { name: "Apprentice Robes",   armorValue: 1, strMod: 0,  agiMod: 0, intMod: 1, hpMod: 0, minStr: 0,  minAgi: 0,  minInt: 7,  armorType: "Cloth",   rarity: 1, price: 15 },
  { name: "Studded Leather",    armorValue: 5, strMod: 1,  agiMod: 0, intMod: 0, hpMod: 5, minStr: 8,  minAgi: 0,  minInt: 0,  armorType: "Plate",   rarity: 1, price: 40 },
  { name: "Scout Armor",        armorValue: 4, strMod: 0,  agiMod: 2, intMod: 0, hpMod: 0, minStr: 0,  minAgi: 10, minInt: 0,  armorType: "Leather", rarity: 1, price: 40 },
  { name: "Acolyte Vestments",  armorValue: 2, strMod: 0,  agiMod: 0, intMod: 2, hpMod: 0, minStr: 0,  minAgi: 0,  minInt: 7,  armorType: "Cloth",   rarity: 1, price: 40 },
  // R2 — primary + secondary req (costs 0-1 off-path)
  { name: "Etched Chainmail",    armorValue: 8, strMod: 2,  agiMod: 0, intMod: 0, hpMod: 8, minStr: 12, minAgi: 0,  minInt: 7,  armorType: "Plate",   rarity: 2, price: 100 },
  { name: "Ranger Leathers",    armorValue: 6, strMod: 0,  agiMod: 3, intMod: 0, hpMod: 0, minStr: 0,  minAgi: 11, minInt: 8,  armorType: "Leather", rarity: 2, price: 100 },
  { name: "Mage Robes",         armorValue: 4, strMod: 0,  agiMod: 0, intMod: 3, hpMod: 0, minStr: 0,  minAgi: 10, minInt: 14, armorType: "Cloth",   rarity: 2, price: 100 },
  { name: "Spider Silk Wraps",  armorValue: 3, strMod: 0,  agiMod: 4, intMod: 0, hpMod: 0, minStr: 0,  minAgi: 12, minInt: 8,  armorType: "Leather", rarity: 2, price: 90 },
  // R3 — primary + higher secondary (costs 1-3 off-path)
  { name: "Carved Stone Plate",armorValue: 10, strMod: 3, agiMod: 0, intMod: 0, hpMod: 10, minStr: 14, minAgi: 0,  minInt: 9,  armorType: "Plate",   rarity: 3, price: 200 },
  { name: "Stalker's Cloak",    armorValue: 7,  strMod: 0, agiMod: 5, intMod: 0, hpMod: 0,  minStr: 0,  minAgi: 14, minInt: 8,  armorType: "Leather", rarity: 3, price: 200 },
  { name: "Drake's Cowl",      armorValue: 6,  strMod: 0, agiMod: 0, intMod: 5, hpMod: 0,  minStr: 0,  minAgi: 12, minInt: 14, armorType: "Cloth",   rarity: 3, price: 200 },
  { name: "Scorched Scale Vest",armorValue: 8,  strMod: 1, agiMod: 1, intMod: 4, hpMod: 6,  minStr: 12, minAgi: 0,  minInt: 9,  armorType: "Plate",   rarity: 3, price: 250 },
];

// ============================================================
// MONSTER OVERRIDES — proposed retuning (sim values differ from on-chain)
// Primary stats ~75-90%, HP ~80-85%, armor -1 where high
// ============================================================

export const MONSTERS_RETUNED: Monster[] = [
  { name: "Dire Rat",           level: 1,  str: 3,  agi: 6,  int: 2,  hp: 10, armor: 0, classType: 1, xp: 225,  weaponMinDmg: 1, weaponMaxDmg: 2, weaponScaling: "agi", weaponIsMagic: false },
  { name: "Fungal Shaman",     level: 2,  str: 3,  agi: 4,  int: 8,  hp: 12, armor: 0, classType: 2, xp: 400,  weaponMinDmg: 1, weaponMaxDmg: 2, weaponScaling: "str", weaponIsMagic: true },
  { name: "Cavern Brute",      level: 3,  str: 9,  agi: 4,  int: 3,  hp: 18, armor: 1, classType: 0, xp: 550,  weaponMinDmg: 1, weaponMaxDmg: 2, weaponScaling: "str", weaponIsMagic: false },
  { name: "Crystal Elemental", level: 4,  str: 4,  agi: 5,  int: 10, hp: 16, armor: 1, classType: 2, xp: 800,  weaponMinDmg: 1, weaponMaxDmg: 2, weaponScaling: "str", weaponIsMagic: true },
  { name: "Ironhide Troll",    level: 5,  str: 11, agi: 6,  int: 5,  hp: 26, armor: 2, classType: 0, xp: 1000, weaponMinDmg: 1, weaponMaxDmg: 3, weaponScaling: "str", weaponIsMagic: false },
  { name: "Phase Spider",      level: 6,  str: 8,  agi: 12, int: 5,  hp: 22, armor: 0, classType: 1, xp: 1325, weaponMinDmg: 1, weaponMaxDmg: 2, weaponScaling: "agi", weaponIsMagic: false },
  { name: "Bonecaster",        level: 7,  str: 6,  agi: 7,  int: 13, hp: 26, armor: 0, classType: 2, xp: 2000, weaponMinDmg: 1, weaponMaxDmg: 2, weaponScaling: "str", weaponIsMagic: true },
  { name: "Rock Golem",        level: 8,  str: 14, agi: 8,  int: 7,  hp: 38, armor: 3, classType: 0, xp: 2500, weaponMinDmg: 1, weaponMaxDmg: 3, weaponScaling: "str", weaponIsMagic: false },
  { name: "Pale Stalker",      level: 9,  str: 10, agi: 15, int: 7,  hp: 34, armor: 0, classType: 1, xp: 3250, weaponMinDmg: 1, weaponMaxDmg: 2, weaponScaling: "agi", weaponIsMagic: false },
  { name: "Dusk Drake",        level: 10, str: 13, agi: 13, int: 15, hp: 52, armor: 2, classType: 2, xp: 6500, weaponMinDmg: 1, weaponMaxDmg: 2, weaponScaling: "str", weaponIsMagic: true },
  // Zone boss — 3 attack types. On-chain (mobId 12). Level 12 = raid boss tier.
  { name: "Basilisk",   level: 12, str: 17, agi: 12, int: 10, hp: 130, armor: 4, classType: 0, xp: 10000, weaponMinDmg: 3, weaponMaxDmg: 5, weaponScaling: "str", weaponIsMagic: false },
];

// ============================================================
// PROPOSED WEAPON EFFECTS (for V3 epic weapons + monster specials)
// On-chain weapons derive effects from effect IDs in items.json.
// These are for weapons/monsters that don't exist on-chain yet.
// ============================================================

export const PROPOSED_WEAPON_EFFECTS: Record<string, WeaponEffect[]> = {
  // V3 epic weapons
  "Phasefang": [
    { type: "dot", name: "poison", damagePerTick: 2, maxStacks: 2, duration: 8, cooldown: 2 },
    { type: "stat_debuff", name: "blind", agiMod: -5, duration: 8, cooldown: 3 },
  ],
  "Trollhide Cleaver": [{ type: "stat_debuff", name: "weaken", strMod: -8, duration: 8, cooldown: 3 }],
  "Drakescale Staff":   [{ type: "stat_debuff", name: "stupify", intMod: -8, duration: 8, cooldown: 3 }],
};

export const PROPOSED_MONSTER_WEAPON_EFFECTS: Record<string, WeaponEffect[]> = {
  "Dire Rat": [{ type: "dot", name: "poison", damagePerTick: 3, maxStacks: 2, duration: 8, cooldown: 2 }],
  "Basilisk": [
    { type: "magic_breath", name: "gaze", minDmg: 8, maxDmg: 14, cooldown: 2 },
    { type: "dot", name: "venom", damagePerTick: 4, maxStacks: 1, duration: 6, cooldown: 3 },
  ],
};

// ============================================================
// Apply overrides to loaded game data based on flags
// ============================================================

export interface SimFlags {
  useRebalanced: boolean;
  useV2: boolean;
  useV3: boolean;
  useArmor: boolean;
  useSpells: boolean;
  useRetunedMonsters: boolean;
  useOnchain: boolean;
}

export function applyOverrides(data: GameData, flags: SimFlags): GameData {
  const result = { ...data };

  if (flags.useOnchain) {
    // --onchain: use raw loader data from constants.json + zone JSON.
    // No weapon, monster, constant, or spell overrides.
    // Shows the actual on-chain balance (including any data bugs).
    return result;
  }

  // Always use proposed constants (the whole point of the sim)
  result.combatConstants = PROPOSED_COMBAT_CONSTANTS;
  result.levelingConstants = PROPOSED_LEVELING_CONSTANTS;

  // Always use proposed class spells
  result.classSpells = CLASS_SPELLS;

  // Weapon variant selection — default is tuned baseline, not on-chain
  if (flags.useV3) {
    result.weapons = [...WEAPONS_V3];
  } else if (flags.useV2) {
    result.weapons = [...WEAPONS_V2];
  } else if (flags.useRebalanced) {
    result.weapons = [...WEAPONS_REBALANCED];
  } else {
    result.weapons = [...WEAPONS_BASELINE];
  }

  // Armor with secondary requirements (used when armor flag is on + V2/V3)
  if (flags.useArmor && (flags.useV2 || flags.useV3)) {
    result.armors = [...ARMORS_WITH_SECONDARY_REQS];
  }

  // Monster retuning (proposed stat adjustments)
  if (flags.useRetunedMonsters) {
    result.monsters = [...MONSTERS_RETUNED];
  }

  // Merge proposed weapon effects (V3 epics + monster specials).
  // Note: this REPLACES per-key, not merges — e.g., proposed "Dire Rat" effects
  // fully replace any on-chain effects loaded for that monster.
  result.weaponEffects = { ...result.weaponEffects, ...PROPOSED_WEAPON_EFFECTS };
  result.monsterWeaponEffects = { ...result.monsterWeaponEffects, ...PROPOSED_MONSTER_WEAPON_EFFECTS };

  return result;
}
