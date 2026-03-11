/**
 * Combat resolution extracted from the balance sim.
 * All functions take explicit CombatConstants + RngFn instead of reading module state.
 */

import type { CombatConstants, Combatant, WeaponEffect } from "./types.js";

// ============================================================
// RNG abstraction
// ============================================================

export type RngFn = (min: number, max: number) => number;

export const defaultRng: RngFn = (min, max) =>
  Math.floor(Math.random() * (max - min + 1)) + min;

/**
 * Simple seeded PRNG (mulberry32). Deterministic for tests.
 */
export function seededRng(seed: number): RngFn {
  let s = seed | 0;
  return (min: number, max: number): number => {
    s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    const norm = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    return Math.floor(norm * (max - min + 1)) + min;
  };
}

// ============================================================
// Active effect types (used by combat loop)
// ============================================================

export interface ActiveEffectInstance {
  name: string;
  type: "dot" | "stat_debuff" | "self_buff";
  turnsRemaining: number;
  damagePerTick: number;
  strMod: number;
  agiMod: number;
  intMod: number;
  armorMod: number;
}

// ============================================================
// Effect helpers
// ============================================================

/** Tick all effects: decrement turns, sum DOT damage, remove expired. Returns total DOT damage. */
export function tickEffects(effects: ActiveEffectInstance[]): number {
  let dotDamage = 0;
  for (let i = effects.length - 1; i >= 0; i--) {
    effects[i].turnsRemaining--;
    if (effects[i].type === "dot") {
      dotDamage += effects[i].damagePerTick;
    }
    if (effects[i].turnsRemaining <= 0) {
      effects.splice(i, 1);
    }
  }
  return dotDamage;
}

/** Apply stat buffs/debuffs to a combatant. Returns new combatant with adjusted stats. */
export function adjustCombatant(base: Combatant, effects: ActiveEffectInstance[]): Combatant {
  let strAdj = 0, agiAdj = 0, intAdj = 0, armorAdj = 0;
  for (const e of effects) {
    if (e.type === "stat_debuff" || e.type === "self_buff") {
      strAdj += e.strMod;
      agiAdj += e.agiMod;
      intAdj += e.intMod;
      armorAdj += e.armorMod;
    }
  }
  if (strAdj === 0 && agiAdj === 0 && intAdj === 0 && armorAdj === 0) return base;

  const str = Math.max(0, base.str + strAdj);
  const agi = Math.max(0, base.agi + agiAdj);
  const int_ = Math.max(0, base.int + intAdj);
  // Inline getDominant to avoid circular dependency
  const dominantType = str >= agi && str >= int_ ? "STR" :
                       agi > str && agi >= int_ ? "AGI" : "INT";
  const dominantStat = str >= agi && str >= int_ ? str :
                       agi > str && agi >= int_ ? agi : int_;
  return {
    ...base,
    str, agi, int: int_,
    armor: Math.max(0, base.armor + armorAdj),
    dominantType,
    dominantStat,
  };
}

// ============================================================
// Attack resolution
// ============================================================

export function resolveAttack(
  attacker: Combatant,
  defender: Combatant,
  cc: CombatConstants,
  rng: RngFn,
): number {
  const w = attacker.weapon;

  // Evasion check (defender AGI vs attacker AGI)
  if (defender.agi > attacker.agi) {
    let evadeChance = Math.min(Math.floor((defender.agi - attacker.agi) / cc.evasionDivisor), cc.evasionCap);
    if (!w.isMagic && attacker.str > defender.str) {
      const strReduction = Math.min(attacker.str - defender.str, 15);
      evadeChance = Math.max(0, evadeChance - strReduction);
    }
    if (rng(1, 100) <= evadeChance) return 0;
  }

  // Crit check
  const critChance = cc.critBaseChance + Math.floor(attacker.agi / cc.critAgiDivisor);
  const isCrit = rng(1, 100) <= critChance;

  // Roll damage
  let rawDmg: number;
  if (isCrit) {
    rawDmg = w.maxDamage;
  } else {
    rawDmg = rng(w.minDamage, w.maxDamage);
  }

  // Scaling modifier
  const scalingMod = w.isMagic ? cc.attackModifier :
                     w.scaling === "agi" ? cc.agiAttackModifier : cc.attackModifier;

  let damage = rawDmg * scalingMod;

  // Stat bonus
  let attackerStat: number;
  let defenderStat: number;
  if (w.isMagic) {
    attackerStat = attacker.int;
    defenderStat = defender.int;
  } else if (w.scaling === "agi") {
    attackerStat = attacker.agi;
    defenderStat = defender.agi;
  } else {
    attackerStat = attacker.str;
    defenderStat = defender.str;
  }

  const statDiff = (attackerStat * scalingMod) - (defenderStat * cc.defenseModifier);
  if (statDiff > 0) {
    damage += statDiff / 2;
  } else {
    damage = Math.max(1, damage + statDiff / 2);
  }

  // Armor reduction (physical only)
  if (!w.isMagic) {
    const armorReduction = Math.max(0, defender.armor);
    damage = Math.max(1, damage - armorReduction);
  }

  // Magic resistance (magic only)
  if (w.isMagic) {
    const resistPct = Math.min(defender.int * cc.magicResistPerInt, cc.magicResistCap);
    damage = Math.max(1, damage * (1 - resistPct / 100));
  }

  // Crit multiplier
  if (isCrit) {
    damage *= cc.critMultiplier;
    if (attacker.critMult > 1000) {
      damage = damage * attacker.critMult / 1000;
    }
  }

  // Class damage multiplier
  if (w.isMagic) {
    damage = damage * attacker.spellMult / 1000;
  } else {
    damage = damage * attacker.physMult / 1000;
  }

  // Combat triangle
  const hasTriangleAdv = (attacker.dominantType === "STR" && defender.dominantType === "AGI") ||
                         (attacker.dominantType === "AGI" && defender.dominantType === "INT") ||
                         (attacker.dominantType === "INT" && defender.dominantType === "STR");
  if (hasTriangleAdv) {
    const diff = Math.abs(attacker.dominantStat - defender.dominantStat);
    const bonus = Math.min(diff * cc.combatTrianglePerStat, cc.combatTriangleMax);
    damage *= (1 + bonus);
  }

  // Double strike (AGI weapons only)
  if (w.scaling === "agi" && !w.isMagic && attacker.agi > defender.agi) {
    const dsChance = Math.min((attacker.agi - defender.agi) * cc.doubleStrikeMultiplier, cc.doubleStrikeCap);
    if (rng(1, 100) <= dsChance) {
      damage += damage / 2;
    }
  }

  // Block (STR-based defense)
  if (defender.str > 10) {
    const blockChance = Math.min((defender.str - 10) * cc.blockChancePerStr, cc.blockChanceCap);
    if (rng(1, 100) <= blockChance) {
      const reduction = w.isMagic ? cc.blockReductionMagic : cc.blockReductionPhys;
      damage *= (1 - reduction);
    }
  }

  return Math.max(1, Math.floor(damage));
}

export function resolveDualMagicHit(
  attacker: Combatant,
  defender: Combatant,
  cc: CombatConstants,
  rng: RngFn,
): number {
  const w = attacker.weapon;
  const rawDmg = rng(w.minDamage, w.maxDamage);
  let damage = rawDmg * cc.attackModifier;

  const statDiff = (attacker.int * cc.attackModifier) - defender.int;
  if (statDiff > 0) {
    damage += statDiff / 2;
  } else {
    damage = Math.max(1, damage + statDiff / 2);
  }

  const resistPct = Math.min(defender.int * cc.magicResistPerInt, cc.magicResistCap);
  damage = Math.max(1, damage * (1 - resistPct / 100));

  damage = damage * attacker.spellMult / 1000;

  return Math.max(1, Math.floor(damage));
}

export function resolveBreathAttack(
  attacker: Combatant,
  defender: Combatant,
  breath: WeaponEffect,
  cc: CombatConstants,
  rng: RngFn,
): number {
  const rawDmg = rng(breath.minDmg ?? 1, breath.maxDmg ?? 1);

  const statDiff = attacker.int - defender.int;
  let damage = rawDmg + statDiff / 2;

  const resistPct = Math.min(defender.int * cc.magicResistPerInt, cc.magicResistCap);
  damage = Math.max(1, damage * (1 - resistPct / 100));

  return Math.max(1, Math.floor(damage));
}
