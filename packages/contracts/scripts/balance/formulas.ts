/**
 * Pure deterministic formulas extracted from the balance sim.
 * All functions take explicit parameters instead of reading module state.
 * The sim engine imports these and passes its module-level constants.
 */

import type {
  LevelingConstants,
  Archetype,
  StatProfile,
  Weapon,
  Armor,
  Combatant,
  AdvancedClass,
} from "./types.js";

// ============================================================
// Leveling curves
// ============================================================

export function statPointsForLevel(level: number, c: LevelingConstants): number {
  if (level <= c.earlyGameCap) return c.statPointsEarly;
  if (level <= c.midGameCap) return c.statPointsMid;
  return c.statPointsLate;
}

export function hpForLevel(level: number, c: LevelingConstants): number {
  if (level <= c.earlyGameCap) return c.hpGainEarly;
  if (level <= c.midGameCap) return c.hpGainMid;
  return (level % 2 === 0) ? c.hpGainLate : 0;
}

export function totalStatPointsAtLevel(level: number, c: LevelingConstants): number {
  let total = 0;
  for (let l = 1; l <= level; l++) total += statPointsForLevel(l, c);
  return total;
}

export function totalHpFromLeveling(level: number, c: LevelingConstants): number {
  let total = 0;
  for (let l = 1; l <= level; l++) total += hpForLevel(l, c);
  return total;
}

// ============================================================
// Stat allocation
// ============================================================

export function allocatePoints(
  totalPoints: number,
  path: "str" | "agi" | "int",
  extraPsPoint: boolean = false,
): { str: number; agi: number; int: number } {
  const points = totalPoints + (extraPsPoint ? 1 : 0);
  const alloc = { str: 0, agi: 0, int: 0 };
  alloc[path] = points;
  return alloc;
}

// ============================================================
// Profile building
// ============================================================

export function buildProfile(
  arch: Archetype,
  level: number,
  c: LevelingConstants,
  classMultiplierBase: number,
): StatProfile {
  let str = arch.baseRoll.str;
  let agi = arch.baseRoll.agi;
  let int_ = arch.baseRoll.int;
  let hp = c.baseHp;

  str += arch.race.str;
  agi += arch.race.agi;
  int_ += arch.race.int;
  hp += arch.race.hp;

  str += arch.startingArmor.str;
  agi += arch.startingArmor.agi;
  int_ += arch.startingArmor.int;
  hp += arch.startingArmor.hp;

  const totalStatPts = totalStatPointsAtLevel(level, c);
  const isPsPhysical = arch.powerSource.type === "physical";
  const psExtraPoint = isPsPhysical && level >= c.powerSourceBonusLevel;
  const alloc = allocatePoints(totalStatPts, arch.statPath, psExtraPoint);
  str += alloc.str; agi += alloc.agi; int_ += alloc.int;

  hp += totalHpFromLeveling(level, c);

  if (level >= c.powerSourceBonusLevel) {
    if (arch.powerSource.type === "weave") int_ += 1;
    else if (arch.powerSource.type === "divine") hp += 2;
  }

  if (level >= 10) {
    str += arch.advClass.flatStr;
    agi += arch.advClass.flatAgi;
    int_ += arch.advClass.flatInt;
    hp += arch.advClass.flatHp;
  }

  if (level >= 10 && arch.advClass.hpMult !== classMultiplierBase) {
    hp = Math.floor((hp * arch.advClass.hpMult) / classMultiplierBase);
  }

  const totalStats = str + agi + int_;
  const primaryStat = Math.max(str, agi, int_);
  const dominantType = str >= agi && str >= int_ ? "STR" :
                       agi > str && agi >= int_ ? "AGI" : "INT";

  return { str, agi, int: int_, hp, totalStats, primaryStat, dominantType };
}

// ============================================================
// Equipment checks
// ============================================================

export function canEquip(weapon: Weapon, profile: StatProfile): boolean {
  return profile.str >= weapon.minStr &&
         profile.agi >= weapon.minAgi &&
         profile.int >= weapon.minInt;
}

export function canEquipArmor(armor: Armor, profile: StatProfile): boolean {
  return profile.str >= armor.minStr &&
         profile.agi >= armor.minAgi &&
         profile.int >= armor.minInt;
}

// ============================================================
// Combat triangle
// ============================================================

export function triangleAdvantage(attackerType: string, defenderType: string): boolean {
  return (attackerType === "STR" && defenderType === "AGI") ||
         (attackerType === "AGI" && defenderType === "INT") ||
         (attackerType === "INT" && defenderType === "STR");
}

// ============================================================
// Dominant stat
// ============================================================

export function getDominant(str: number, agi: number, int_: number): { type: string; stat: number } {
  if (str >= agi && str >= int_) return { type: "STR", stat: str };
  if (agi > str && agi >= int_) return { type: "AGI", stat: agi };
  return { type: "INT", stat: int_ };
}

// ============================================================
// Combatant construction
// ============================================================

export function makeCombatant(
  profile: StatProfile,
  weapon: Weapon,
  advClass: AdvancedClass,
  armor: number = 0,
  className: string = "",
): Combatant {
  const str = profile.str + weapon.strMod;
  const agi = profile.agi + weapon.agiMod;
  const int_ = profile.int + weapon.intMod;
  const dom = getDominant(str, agi, int_);
  let hp = profile.hp + weapon.hpMod;
  if (advClass.hpMult > 1000) {
    hp = profile.hp + Math.floor(weapon.hpMod * advClass.hpMult / 1000);
  }

  return {
    str, agi, int: int_,
    hp, maxHp: hp, armor,
    weapon,
    physMult: advClass.physMult,
    spellMult: advClass.spellMult,
    critMult: advClass.critMult,
    hpMult: advClass.hpMult,
    dominantType: dom.type,
    dominantStat: dom.stat,
    className,
  };
}

export function makeMonsterCombatant(
  m: { name: string; str: number; agi: number; int: number; hp: number; armor: number; weaponMinDmg: number; weaponMaxDmg: number; weaponScaling: "str" | "agi"; weaponIsMagic: boolean },
  hasMonsterEffects: boolean,
): Combatant {
  const dom = getDominant(m.str, m.agi, m.int);
  const weaponName = hasMonsterEffects ? m.name : "Monster Attack";
  const monsterWeapon: Weapon = {
    name: weaponName, minDamage: m.weaponMinDmg, maxDamage: m.weaponMaxDmg,
    strMod: 0, agiMod: 0, intMod: 0, hpMod: 0,
    scaling: m.weaponScaling, isMagic: m.weaponIsMagic,
    minStr: 0, minAgi: 0, minInt: 0, rarity: 0, price: 0,
  };
  return {
    str: m.str, agi: m.agi, int: m.int,
    hp: m.hp, maxHp: m.hp, armor: m.armor,
    weapon: monsterWeapon,
    physMult: 1000, spellMult: 1000, critMult: 1000, hpMult: 1000,
    dominantType: dom.type, dominantStat: dom.stat,
    className: "",
  };
}
