/**
 * Data loader for the balance simulation.
 * Reads zone JSON (items.json, monsters.json, effects.json) and constants.json.
 * Maps on-chain data format to sim types.
 */

import { readFileSync } from "fs";
import { resolve } from "path";
import type {
  GameData,
  Weapon,
  Armor,
  Monster,
  Consumable,
  WeaponEffect,
  CombatConstants,
  LevelingConstants,
  Race,
  StartingArmor,
  PowerSource,
  AdvancedClass,
  ArchetypeConfig,
} from "./types.js";

// ============================================================
// Zone JSON types (raw format from items.json, monsters.json, effects.json)
// ============================================================

interface ZoneWeapon {
  name: string;
  rarity: number;
  price: number;
  dropChance: number;
  scalingStat?: string; // "AGI" — absent means STR
  isStarter?: boolean;
  metadataUri?: string;
  stats: {
    strModifier: number;
    agiModifier: number;
    intModifier: number;
    hpModifier: number;
    minDamage: number;
    maxDamage: number;
    minLevel: number;
    effects: string[];
  };
  statRestrictions: {
    minStrength: number;
    minAgility: number;
    minIntelligence: number;
  };
}

interface ZoneArmor {
  name: string;
  rarity: number;
  price: number;
  armorType: string;
  isStarter?: boolean;
  stats: {
    strModifier: number;
    agiModifier: number;
    intModifier: number;
    hpModifier: number;
    armorModifier: number;
    minLevel: number;
  };
  statRestrictions: {
    minStrength: number;
    minAgility: number;
    minIntelligence: number;
  };
}

interface ZoneMonster {
  name: string;
  stats: {
    strength: number;
    agility: number;
    intelligence: number;
    hitPoints: number;
    armor: number;
    class: number;
    experience: number;
    level: number;
    inventoryNames: string[];
  };
}

interface ZoneConsumable {
  name: string;
  rarity: number;
  price: number;
  metadataUri?: string;
  stats: {
    effects: string[];
    minDamage: number;
    maxDamage: number;
    minLevel: number;
  };
  statRestrictions: {
    minStrength: number;
    minAgility: number;
    minIntelligence: number;
  };
}

interface ZoneStatusEffect {
  effectId: string;
  name: string;
  stats: {
    strModifier: number;
    agiModifier: number;
    intModifier: number;
    armorModifier: number;
    hpModifier: number;
    damagePerTick: number;
    resistanceStat: number;
  };
  validity: {
    validTime: number;
    validTurns: number;
    maxStacks: number;
    cooldown: number;
  };
  targetsSelf?: boolean;
}

interface ZoneItemsJson {
  armor: ZoneArmor[];
  weapons: ZoneWeapon[];
  consumables: ZoneConsumable[];
}

interface ZoneMonstersJson {
  monsters: ZoneMonster[];
}

interface ZoneEffectsJson {
  magicDamage: { effectId: string; name: string }[];
  physicalDamage: { effectId: string; name: string }[];
  statusEffects: ZoneStatusEffect[];
}

interface ZoneSpell {
  className: string;
  name: string;
  effectName: string;
  type: string;
  strPct: number;
  agiPct: number;
  intPct: number;
  hpPct: number;
  armorFlat: number;
  spellMinDamage: number;
  spellMaxDamage: number;
  dmgPerStat: number;
  dmgScalingStat: number; // 0=none, 1=STR, 2=AGI, 3=INT
  dmgIsPhysical: boolean;
  maxUses: number;
  isWeaponEnchant: boolean;
  validTurns: number;
}

interface ZoneSpellsJson {
  spells: ZoneSpell[];
}

// ============================================================
// Constants JSON types
// ============================================================

interface ConstantsJson {
  combat: {
    hit: { startingProbability: number; attackerDampener: number; defenderDampener: number; min: number; max: number; strWeaponsUseStr: boolean };
    damage: { attackModifier: number; agiAttackModifier: number; defenseModifier: number; critMultiplier: number };
    evasion: { multiplier: number; cap: number };
    doubleStrike: { multiplier: number; cap: number };
    crit: { baseChance: number; agiDivisor: number };
    magicResist: { pctPerInt: number; cap: number };
    triangle: { flatBonusPct: number; bonusPerStatPct: number; maxBonusPct: number; order: string[] };
    spellDodge: { threshold: number; pctPerAgi: number; cap: number };
    block: { chancePerStr: number; cap: number; damageReduction: number; vsMagicPenalty: number };
    classMultiplierBase: number;
  };
  leveling: {
    maxLevel: number;
    statPointsPerLevel: number;
    hpPerLevel: number;
    baseHp: number;
    earlyGameCap: number;
    midGameCap: number;
    powerSourceBonusLevel: number;
  };
  baseRolls: Record<string, { str: number; agi: number; int: number }>;
  races: Record<string, { str: number; agi: number; int: number; hp: number }>;
  startingArmors: Record<string, { str: number; agi: number; int: number; hp: number }>;
  powerSources: Record<string, { type: string }>;
  classes: Record<string, { flatStr: number; flatAgi: number; flatInt: number; flatHp: number; physMult: number; spellMult: number; healMult: number; critMult: number; hpMult: number }>;
  archetypes: Record<string, ArchetypeConfig>;
}

// ============================================================
// Known effect IDs
// ============================================================

const MAGIC_ATTACK_EFFECT_IDS = new Set([
  "0xeee09063621624b3000000000000000000000000000000000000000000000000", // basic magic attack
  "0x2e0e6d5039f8c272000000000000000000000000000000000000000000000000", // basic magic heal
]);

const PHYSICAL_ATTACK_EFFECT_ID =
  "0xbeeab8b096ac11af000000000000000000000000000000000000000000000000";

// ============================================================
// Mapping functions
// ============================================================

function weiToGold(priceWei: number): number {
  // Zone JSON stores prices in wei (1e18 = 1 gold)
  return Math.round(priceWei / 1e18);
}

function mapWeapon(zw: ZoneWeapon, effectIndex: Map<string, ZoneStatusEffect>): Weapon {
  const isMagic = zw.stats.effects.some((eid) => MAGIC_ATTACK_EFFECT_IDS.has(eid));
  const scaling: "str" | "agi" = zw.scalingStat?.toUpperCase() === "AGI" ? "agi" : "str";

  return {
    name: zw.name,
    minDamage: zw.stats.minDamage,
    maxDamage: zw.stats.maxDamage,
    strMod: zw.stats.strModifier,
    agiMod: zw.stats.agiModifier,
    intMod: zw.stats.intModifier,
    hpMod: zw.stats.hpModifier,
    scaling,
    isMagic,
    minStr: zw.statRestrictions.minStrength,
    minAgi: zw.statRestrictions.minAgility,
    minInt: zw.statRestrictions.minIntelligence,
    rarity: zw.rarity,
    price: weiToGold(zw.price),
  };
}

function mapArmor(za: ZoneArmor): Armor {
  return {
    name: za.name,
    armorValue: za.stats.armorModifier,
    strMod: za.stats.strModifier,
    agiMod: za.stats.agiModifier,
    intMod: za.stats.intModifier,
    hpMod: za.stats.hpModifier,
    minStr: za.statRestrictions.minStrength,
    minAgi: za.statRestrictions.minAgility,
    minInt: za.statRestrictions.minIntelligence,
    armorType: za.armorType as "Plate" | "Leather" | "Cloth",
    rarity: za.rarity,
    price: weiToGold(za.price),
  };
}

function isMonsterWeapon(zw: ZoneWeapon): boolean {
  if (zw.metadataUri?.startsWith("weapon:monster_")) return true;
  // Catch non-standard monster weapons (e.g. basilisk_fangs, petrifying_gaze)
  if (zw.dropChance === 0 && zw.price === 0) return true;
  return false;
}

function isPlayerWeapon(zw: ZoneWeapon): boolean {
  return !isMonsterWeapon(zw);
}

function buildWeaponEffects(
  zw: ZoneWeapon,
  effectIndex: Map<string, ZoneStatusEffect>
): WeaponEffect[] {
  const effects: WeaponEffect[] = [];
  for (const eid of zw.stats.effects) {
    if (eid === PHYSICAL_ATTACK_EFFECT_ID || MAGIC_ATTACK_EFFECT_IDS.has(eid)) continue;
    const se = effectIndex.get(eid);
    if (!se) continue;

    if (se.stats.damagePerTick > 0) {
      effects.push({
        type: "dot",
        name: se.name,
        damagePerTick: se.stats.damagePerTick,
        maxStacks: se.validity.maxStacks,
        duration: se.validity.validTurns,
        cooldown: se.validity.cooldown,
      });
    } else if (
      se.stats.strModifier !== 0 ||
      se.stats.agiModifier !== 0 ||
      se.stats.intModifier !== 0 ||
      se.stats.armorModifier !== 0
    ) {
      effects.push({
        type: "stat_debuff",
        name: se.name,
        strMod: se.stats.strModifier,
        agiMod: se.stats.agiModifier,
        intMod: se.stats.intModifier,
        armorMod: se.stats.armorModifier,
        duration: se.validity.validTurns,
        cooldown: se.validity.cooldown,
      });
    }
  }

  // Check for dual magic: weapon has BOTH physical and magic attack effects
  const hasPhysical = zw.stats.effects.includes(PHYSICAL_ATTACK_EFFECT_ID);
  const hasMagic = zw.stats.effects.some((eid) => MAGIC_ATTACK_EFFECT_IDS.has(eid));
  if (hasPhysical && hasMagic) {
    // This is not quite right — dual_magic in the sim means extra magic hit.
    // On-chain, having both effects might work differently. But for the sim model:
    effects.push({ type: "dual_magic", name: "dual_magic" });
  }

  return effects;
}

function mapMonster(
  zm: ZoneMonster,
  weaponsByName: Map<string, ZoneWeapon>,
  effectIndex: Map<string, ZoneStatusEffect>
): Monster {
  // Monster weapon is their first inventory item
  const weaponName = zm.stats.inventoryNames[0];
  const weapon = weaponsByName.get(weaponName);

  let weaponMinDmg = 1;
  let weaponMaxDmg = 2;
  let weaponScaling: "str" | "agi" = "str";
  let weaponIsMagic = false;

  if (weapon) {
    weaponMinDmg = weapon.stats.minDamage;
    weaponMaxDmg = weapon.stats.maxDamage;
    weaponScaling = weapon.scalingStat?.toUpperCase() === "AGI" ? "agi" : "str";
    weaponIsMagic = weapon.stats.effects.some((eid) => MAGIC_ATTACK_EFFECT_IDS.has(eid));
  }

  return {
    name: zm.name,
    level: zm.stats.level,
    str: zm.stats.strength,
    agi: zm.stats.agility,
    int: zm.stats.intelligence,
    hp: zm.stats.hitPoints,
    armor: zm.stats.armor,
    classType: zm.stats.class,
    xp: zm.stats.experience,
    weaponMinDmg,
    weaponMaxDmg,
    weaponScaling,
    weaponIsMagic,
  };
}

function mapConsumable(
  zc: ZoneConsumable,
  effectIndex: Map<string, ZoneStatusEffect>
): Consumable | null {
  // Flee items: Smoke Bomb / Flashpowder — check BEFORE effect loop.
  // smoke_cloak effect (validTurns=2, targetsSelf=true, all-zero stats) matches
  // tradeoff_buff pattern if we don't catch it here.
  const lcName = zc.name.toLowerCase();
  if (lcName.includes("smoke") || lcName.includes("flashpowder")) {
    return {
      name: zc.name,
      type: "flee",
      rarity: zc.rarity,
      price: weiToGold(zc.price),
    };
  }

  // Skip vendor trash (no effects, no damage)
  if (zc.stats.effects.length === 0 && zc.stats.minDamage === 0) return null;

  // Health potions: negative damage = heal
  if (zc.stats.minDamage < 0) {
    return {
      name: zc.name,
      type: "heal",
      healAmount: Math.abs(zc.stats.minDamage),
      rarity: zc.rarity,
      price: weiToGold(zc.price),
    };
  }

  // Look up effect to categorize
  for (const eid of zc.stats.effects) {
    const se = effectIndex.get(eid);
    if (!se) continue;

    // Pre-combat buffs: validTime > 0, validTurns = 0
    if (se.validity.validTime > 0 && se.validity.validTurns === 0) {
      return {
        name: zc.name,
        type: "pre_buff",
        strMod: se.stats.strModifier || undefined,
        agiMod: se.stats.agiModifier || undefined,
        intMod: se.stats.intModifier || undefined,
        rarity: zc.rarity,
        price: weiToGold(zc.price),
      };
    }

    // Cleanse: targets poison effect (antidote)
    if (zc.name === "Antidote") {
      return {
        name: zc.name,
        type: "cleanse",
        rarity: zc.rarity,
        price: weiToGold(zc.price),
      };
    }

    // In-combat effects with validTurns > 0
    if (se.validity.validTurns > 0) {
      const isSelfBuff = se.targetsSelf === true;
      const hasNegativeStats =
        se.stats.strModifier < 0 ||
        se.stats.agiModifier < 0 ||
        se.stats.intModifier < 0 ||
        se.stats.armorModifier < 0;

      if (isSelfBuff) {
        // Tradeoff buffs: self-targeted, mix of positive and negative mods
        return {
          name: zc.name,
          type: "tradeoff_buff",
          rarity: zc.rarity,
          price: weiToGold(zc.price),
          effect: {
            strMod: se.stats.strModifier,
            agiMod: se.stats.agiModifier,
            intMod: se.stats.intModifier,
            armorMod: se.stats.armorModifier,
            damagePerTick: se.stats.damagePerTick,
            duration: se.validity.validTurns,
            maxStacks: se.validity.maxStacks,
            cooldown: se.validity.cooldown,
          },
        };
      }

      // Debuffs: applied to target
      return {
        name: zc.name,
        type: "debuff",
        rarity: zc.rarity,
        price: weiToGold(zc.price),
        effect: {
          strMod: se.stats.strModifier,
          agiMod: se.stats.agiModifier,
          intMod: se.stats.intModifier,
          armorMod: se.stats.armorModifier,
          damagePerTick: se.stats.damagePerTick,
          duration: se.validity.validTurns,
          maxStacks: se.validity.maxStacks,
          cooldown: se.validity.cooldown,
        },
      };
    }
  }

  // Smoke cloak / flashpowder — short duration self-buff with no stat mods
  // These are special items the sim doesn't model yet, skip
  return null;
}

function mapSpell(zs: ZoneSpell): ClassSpell {
  // On-chain stores percentages as basis points (2500 = 25%), sim uses decimals (0.25)
  const spell: ClassSpell = {
    name: zs.name,
    type: zs.type as ClassSpell["type"],
    duration: zs.validTurns || undefined,
    baseDmgMin: zs.spellMinDamage || undefined,
    baseDmgMax: zs.spellMaxDamage || undefined,
    maxUses: zs.maxUses || undefined,
  };

  if (zs.strPct !== 0) spell.strPct = zs.strPct / 10000;
  if (zs.agiPct !== 0) spell.agiPct = zs.agiPct / 10000;
  if (zs.intPct !== 0) spell.intPct = zs.intPct / 10000;
  if (zs.hpPct !== 0) spell.hpPct = zs.hpPct / 10000;
  if (zs.armorFlat !== 0) spell.armorMod = zs.armorFlat;

  // Map dmgPerStat to the correct scaling field (basis points → decimal)
  if (zs.dmgPerStat > 0) {
    const scaled = zs.dmgPerStat / 1000;
    if (zs.dmgScalingStat === 1) spell.dmgPerStr = scaled;
    else if (zs.dmgScalingStat === 2) spell.dmgPerAgi = scaled;
    else if (zs.dmgScalingStat === 3) spell.dmgPerInt = scaled;
  }

  return spell;
}

function mapCombatConstants(c: ConstantsJson["combat"]): CombatConstants {
  return {
    attackModifier: c.damage.attackModifier,
    agiAttackModifier: c.damage.agiAttackModifier,
    defenseModifier: c.damage.defenseModifier,
    critMultiplier: c.damage.critMultiplier,
    critBaseChance: c.crit.baseChance,
    critAgiDivisor: c.crit.agiDivisor,
    evasionMultiplier: c.evasion.multiplier,
    evasionCap: c.evasion.cap,
    doubleStrikeMultiplier: c.doubleStrike.multiplier,
    doubleStrikeCap: c.doubleStrike.cap,
    combatTriangleFlatPct: c.triangle.flatBonusPct / 100,
    combatTrianglePerStat: c.triangle.bonusPerStatPct / 100,
    combatTriangleMax: c.triangle.maxBonusPct / 100,
    magicResistPerInt: c.magicResist.pctPerInt,
    magicResistCap: c.magicResist.cap,
    blockChancePerStr: c.block.chancePerStr,
    blockChanceCap: c.block.cap,
    blockReductionPhys: c.block.damageReduction,
    blockReductionMagic: c.block.vsMagicPenalty,
    hitStartingProbability: c.hit.startingProbability,
    hitAttackerDampener: c.hit.attackerDampener,
    hitDefenderDampener: c.hit.defenderDampener,
    hitMin: c.hit.min,
    hitMax: c.hit.max,
    spellDodgeThreshold: c.spellDodge.threshold,
    spellDodgePctPerAgi: c.spellDodge.pctPerAgi,
    spellDodgeCap: c.spellDodge.cap,
    classMultiplierBase: c.classMultiplierBase,
  };
}

function mapLevelingConstants(l: ConstantsJson["leveling"]): LevelingConstants {
  // On-chain has flat rates (single statPointsPerLevel / hpPerLevel).
  // The sim's tiered system (early/mid/late) is a proposed change in overrides.
  // Loader maps the flat on-chain value to all three tiers.
  return {
    baseHp: l.baseHp,
    earlyGameCap: l.earlyGameCap,
    midGameCap: l.midGameCap,
    statPointsEarly: l.statPointsPerLevel,
    statPointsMid: l.statPointsPerLevel,
    statPointsLate: l.statPointsPerLevel,
    hpGainEarly: l.hpPerLevel,
    hpGainMid: l.hpPerLevel,
    hpGainLate: l.hpPerLevel,
    powerSourceBonusLevel: l.powerSourceBonusLevel,
  };
}

// ============================================================
// Main loader
// ============================================================

export function loadGameData(zonePath: string, constantsPath: string): GameData {
  // Read zone files
  const itemsRaw = JSON.parse(readFileSync(resolve(zonePath, "items.json"), "utf-8")) as ZoneItemsJson;
  const monstersRaw = JSON.parse(readFileSync(resolve(zonePath, "monsters.json"), "utf-8")) as ZoneMonstersJson;
  const effectsRaw = JSON.parse(readFileSync(resolve(zonePath, "effects.json"), "utf-8")) as ZoneEffectsJson;

  // Read spells (optional — zones without spells get empty classSpells)
  const spellsPath = resolve(zonePath, "spells.json");
  let spellsRaw: ZoneSpellsJson = { spells: [] };
  try {
    spellsRaw = JSON.parse(readFileSync(spellsPath, "utf-8")) as ZoneSpellsJson;
  } catch {
    // No spells.json — zone has no class spells
  }

  // Read constants
  const constantsRaw = JSON.parse(readFileSync(resolve(constantsPath), "utf-8")) as ConstantsJson;

  // Build effect index by ID
  const effectIndex = new Map<string, ZoneStatusEffect>();
  for (const se of effectsRaw.statusEffects) {
    effectIndex.set(se.effectId, se);
  }

  // Build weapon name index (all weapons including monster weapons)
  const allWeaponsByName = new Map<string, ZoneWeapon>();
  for (const zw of itemsRaw.weapons) {
    allWeaponsByName.set(zw.name, zw);
  }

  // Map weapons (player-equippable only)
  const weapons = itemsRaw.weapons
    .filter(isPlayerWeapon)
    .map((zw) => mapWeapon(zw, effectIndex));

  // Map armors
  const armors = itemsRaw.armor.map(mapArmor);

  // Map monsters
  const monsters = monstersRaw.monsters.map((zm) =>
    mapMonster(zm, allWeaponsByName, effectIndex)
  );

  // Map consumables (filter out vendor trash)
  const consumables = itemsRaw.consumables
    .map((zc) => mapConsumable(zc, effectIndex))
    .filter((c): c is Consumable => c !== null);

  // Build weapon effects from effect IDs
  const weaponEffects: Record<string, WeaponEffect[]> = {};
  for (const zw of itemsRaw.weapons.filter(isPlayerWeapon)) {
    const effects = buildWeaponEffects(zw, effectIndex);
    if (effects.length > 0) {
      weaponEffects[zw.name] = effects;
    }
  }

  // Build monster weapon effects
  const monsterWeaponEffects: Record<string, WeaponEffect[]> = {};
  for (const zm of monstersRaw.monsters) {
    const weaponName = zm.stats.inventoryNames[0];
    const weapon = allWeaponsByName.get(weaponName);
    if (weapon) {
      const effects = buildWeaponEffects(weapon, effectIndex);
      if (effects.length > 0) {
        // Key by monster name (not weapon name) for sim lookup
        monsterWeaponEffects[zm.name] = effects;
      }
    }
  }

  // Map constants
  const combatConstants = mapCombatConstants(constantsRaw.combat);
  const levelingConstants = mapLevelingConstants(constantsRaw.leveling);

  // Map races
  const races: Record<string, Race> = {};
  for (const [key, val] of Object.entries(constantsRaw.races)) {
    races[key] = { name: key.charAt(0).toUpperCase() + key.slice(1), ...val };
  }

  // Map starting armors
  const startingArmors: Record<string, StartingArmor> = {};
  for (const [key, val] of Object.entries(constantsRaw.startingArmors)) {
    startingArmors[key] = { name: key.charAt(0).toUpperCase() + key.slice(1), ...val };
  }

  // Map power sources
  const powerSources: Record<string, PowerSource> = {};
  for (const [key, val] of Object.entries(constantsRaw.powerSources)) {
    powerSources[key] = {
      name: key.charAt(0).toUpperCase() + key.slice(1),
      type: val.type as "divine" | "weave" | "physical",
    };
  }

  // Map classes (flat bonuses + multipliers both from constants.json)
  const classes: Record<string, AdvancedClass> = {};
  for (const [key, val] of Object.entries(constantsRaw.classes)) {
    classes[key] = {
      name: key.charAt(0).toUpperCase() + key.slice(1),
      flatStr: val.flatStr,
      flatAgi: val.flatAgi,
      flatInt: val.flatInt,
      flatHp: val.flatHp,
      physMult: val.physMult,
      spellMult: val.spellMult,
      healMult: val.healMult,
      critMult: val.critMult,
      hpMult: val.hpMult,
    };
  }

  return {
    weapons,
    armors,
    monsters,
    consumables,
    weaponEffects,
    monsterWeaponEffects,
    combatConstants,
    levelingConstants,
    races,
    startingArmors,
    powerSources,
    classes,
    baseRolls: constantsRaw.baseRolls,
    archetypeConfigs: constantsRaw.archetypes,
    classSpells: Object.fromEntries(
      spellsRaw.spells.map((zs) => [zs.className, mapSpell(zs)])
    ),
  };
}
