/**
 * Combat resolution extracted from the balance sim.
 * All functions take explicit CombatConstants + RngFn instead of reading module state.
 */

import type { CombatConstants, Combatant, WeaponEffect, CcHistoryEntry, CcResistance } from "./types.js";

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
  type: "dot" | "stat_debuff" | "self_buff" | "weapon_enchant" | "silence" | "root" | "reflect";
  turnsRemaining: number;
  damagePerTick: number;
  strMod: number;
  agiMod: number;
  intMod: number;
  armorMod: number;
  // Weapon enchant: bonus magic damage added to each weapon attack
  bonusMagicDmgMin?: number;
  bonusMagicDmgMax?: number;
  bonusMagicDmgPerInt?: number;
  // Reflect: % of magic damage returned to attacker
  reflectPct?: number;
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
    let evadeChance = Math.min(Math.floor((defender.agi - attacker.agi) * cc.evasionMultiplier), cc.evasionCap);
    if (!w.isMagic && attacker.str > defender.str) {
      const strReduction = Math.min(attacker.str - defender.str, 15);
      evadeChance = Math.max(0, evadeChance - strReduction);
    }
    if (rng(1, 100) <= evadeChance) return 0;
  }

  // Spell dodge (AGI defense vs magic — additional to regular evasion)
  if (w.isMagic && defender.agi >= cc.spellDodgeThreshold) {
    const spellDodgeChance = Math.min(
      Math.floor((defender.agi - cc.spellDodgeThreshold) * cc.spellDodgePctPerAgi),
      cc.spellDodgeCap,
    );
    if (rng(1, 100) <= spellDodgeChance) return 0;
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

  // ±25% damage variance so hits don't feel static
  const varianceRoll = rng(75, 125);
  damage = damage * varianceRoll / 100;

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

  // ±25% damage variance
  const dualVarianceRoll = rng(75, 125);
  damage = damage * dualVarianceRoll / 100;

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

  // ±25% damage variance
  const breathVarianceRoll = rng(75, 125);
  damage = damage * breathVarianceRoll / 100;

  const resistPct = Math.min(defender.int * cc.magicResistPerInt, cc.magicResistCap);
  damage = Math.max(1, damage * (1 - resistPct / 100));

  return Math.max(1, Math.floor(damage));
}

// ============================================================
// Z3 CC effects: silence, root, reflect, guard
// ============================================================

/**
 * Calculate CC duration after resistance.
 * Each point of resist stat above 20 reduces duration by 0.1t (floored).
 * Silence: resisted by INT. Root: resisted by STR.
 */
export function applyCcResistance(
  baseDuration: number,
  resistStat: number,
  armorResist: number,  // from CcResistance on armor
): number {
  const statReduction = resistStat > 20 ? Math.floor((resistStat - 20) * 0.1) : 0;
  const totalReduction = statReduction + armorResist;
  return Math.max(1, baseDuration - totalReduction);
}

/**
 * Diminishing returns for CC.
 * 1st application: full duration.
 * 2nd within 4 rounds: half duration (minimum 1).
 * 3rd within 4 rounds: immune (0 duration).
 */
export function getCcDiminishedDuration(
  baseDuration: number,
  ccType: "silence" | "root",
  ccHistory: CcHistoryEntry[],
  currentRound: number,
): number {
  const recentApplications = ccHistory.filter(
    e => e.type === ccType && (currentRound - e.appliedRound) <= 4,
  ).length;

  if (recentApplications === 0) return baseDuration;
  if (recentApplications === 1) return Math.max(1, Math.floor(baseDuration / 2));
  return 0; // immune — 3rd+ application within window
}

/**
 * Apply silence effect to a target.
 * Silence prevents spell casting for N turns.
 * Does not prevent weapon attacks, consumable use, or Guard.
 */
export function applySilence(
  targetEffects: ActiveEffectInstance[],
  duration: number,
  sourceName: string,
): boolean {
  if (duration <= 0) return false;
  const existing = targetEffects.find(e => e.type === "silence");
  if (existing) {
    existing.turnsRemaining = Math.max(existing.turnsRemaining, duration);
    return true;
  }
  targetEffects.push({
    name: sourceName,
    type: "silence",
    turnsRemaining: duration,
    damagePerTick: 0,
    strMod: 0, agiMod: 0, intMod: 0, armorMod: 0,
  });
  return true;
}

/**
 * Apply root effect to a target.
 * Root sets evasion to 0 and prevents double-strike for N turns.
 */
export function applyRoot(
  targetEffects: ActiveEffectInstance[],
  duration: number,
  sourceName: string,
): boolean {
  if (duration <= 0) return false;
  const existing = targetEffects.find(e => e.type === "root");
  if (existing) {
    existing.turnsRemaining = Math.max(existing.turnsRemaining, duration);
    return true;
  }
  targetEffects.push({
    name: sourceName,
    type: "root",
    turnsRemaining: duration,
    damagePerTick: 0,
    strMod: 0, agiMod: 0, intMod: 0, armorMod: 0,
  });
  return true;
}

/**
 * Apply reflect effect to a target (self-buff).
 * Reflect returns a percentage of incoming magic damage back to the attacker.
 */
export function applyReflect(
  targetEffects: ActiveEffectInstance[],
  duration: number,
  reflectPct: number,
  sourceName: string,
): boolean {
  if (duration <= 0) return false;
  const existing = targetEffects.find(e => e.type === "reflect");
  if (existing) {
    existing.turnsRemaining = Math.max(existing.turnsRemaining, duration);
    existing.reflectPct = Math.max(existing.reflectPct ?? 0, reflectPct);
    return true;
  }
  targetEffects.push({
    name: sourceName,
    type: "reflect",
    turnsRemaining: duration,
    damagePerTick: 0,
    strMod: 0, agiMod: 0, intMod: 0, armorMod: 0,
    reflectPct,
  });
  return true;
}

/** Check if a combatant is silenced (has active silence effect). */
export function isSilenced(effects: ActiveEffectInstance[]): boolean {
  return effects.some(e => e.type === "silence" && e.turnsRemaining > 0);
}

/** Check if a combatant is rooted (has active root effect). */
export function isRooted(effects: ActiveEffectInstance[]): boolean {
  return effects.some(e => e.type === "root" && e.turnsRemaining > 0);
}

/** Get active reflect effect (if any). Returns reflectPct or 0. */
export function getReflectPct(effects: ActiveEffectInstance[]): number {
  const reflect = effects.find(e => e.type === "reflect" && e.turnsRemaining > 0);
  return reflect?.reflectPct ?? 0;
}

/**
 * Resolve attack with root/reflect awareness.
 * If defender is rooted: evasion = 0, no double-strike.
 * If defender has reflect and attack is magic: return reflected damage.
 * Returns { damage, reflected }.
 */
export function resolveAttackZ3(
  attacker: Combatant,
  defender: Combatant,
  cc: CombatConstants,
  rng: RngFn,
  defenderRooted: boolean,
  defenderReflectPct: number,
): { damage: number; reflected: number } {
  const w = attacker.weapon;

  // Evasion check — rooted defender can't evade
  if (!defenderRooted && defender.agi > attacker.agi) {
    let evadeChance = Math.min(Math.floor((defender.agi - attacker.agi) * cc.evasionMultiplier), cc.evasionCap);
    if (!w.isMagic && attacker.str > defender.str) {
      const strReduction = Math.min(attacker.str - defender.str, 15);
      evadeChance = Math.max(0, evadeChance - strReduction);
    }
    if (rng(1, 100) <= evadeChance) return { damage: 0, reflected: 0 };
  }

  // Spell dodge — rooted defender can't spell-dodge
  if (!defenderRooted && w.isMagic && defender.agi >= cc.spellDodgeThreshold) {
    const spellDodgeChance = Math.min(
      Math.floor((defender.agi - cc.spellDodgeThreshold) * cc.spellDodgePctPerAgi),
      cc.spellDodgeCap,
    );
    if (rng(1, 100) <= spellDodgeChance) return { damage: 0, reflected: 0 };
  }

  const critChance = cc.critBaseChance + Math.floor(attacker.agi / cc.critAgiDivisor);
  const isCrit = rng(1, 100) <= critChance;
  let rawDmg = isCrit ? w.maxDamage : rng(w.minDamage, w.maxDamage);

  const scalingMod = w.isMagic ? cc.attackModifier :
                     w.scaling === "agi" ? cc.agiAttackModifier : cc.attackModifier;
  let damage = rawDmg * scalingMod;

  let attackerStat: number, defenderStat: number;
  if (w.isMagic) { attackerStat = attacker.int; defenderStat = defender.int; }
  else if (w.scaling === "agi") { attackerStat = attacker.agi; defenderStat = defender.agi; }
  else { attackerStat = attacker.str; defenderStat = defender.str; }

  const statDiff = (attackerStat * scalingMod) - (defenderStat * cc.defenseModifier);
  if (statDiff > 0) damage += statDiff / 2;
  else damage = Math.max(1, damage + statDiff / 2);

  damage = damage * rng(75, 125) / 100;

  if (!w.isMagic) {
    damage = Math.max(1, damage - Math.max(0, defender.armor));
  } else {
    const resistPct = Math.min(defender.int * cc.magicResistPerInt, cc.magicResistCap);
    damage = Math.max(1, damage * (1 - resistPct / 100));
  }

  if (isCrit) {
    damage *= cc.critMultiplier;
    if (attacker.critMult > 1000) damage = damage * attacker.critMult / 1000;
  }

  if (w.isMagic) damage = damage * attacker.spellMult / 1000;
  else damage = damage * attacker.physMult / 1000;

  const hasTriangleAdv = (attacker.dominantType === "STR" && defender.dominantType === "AGI") ||
                         (attacker.dominantType === "AGI" && defender.dominantType === "INT") ||
                         (attacker.dominantType === "INT" && defender.dominantType === "STR");
  if (hasTriangleAdv) {
    const diff = Math.abs(attacker.dominantStat - defender.dominantStat);
    damage *= (1 + Math.min(diff * cc.combatTrianglePerStat, cc.combatTriangleMax));
  }

  // Double strike — rooted attacker can't double-strike
  if (w.scaling === "agi" && !w.isMagic && attacker.agi > defender.agi) {
    const dsChance = Math.min((attacker.agi - defender.agi) * cc.doubleStrikeMultiplier, cc.doubleStrikeCap);
    if (rng(1, 100) <= dsChance) damage += damage / 2;
  }

  if (defender.str > 10) {
    const blockChance = Math.min((defender.str - 10) * cc.blockChancePerStr, cc.blockChanceCap);
    if (rng(1, 100) <= blockChance) {
      damage *= (1 - (w.isMagic ? cc.blockReductionMagic : cc.blockReductionPhys));
    }
  }

  const finalDamage = Math.max(1, Math.floor(damage));

  // Reflect: magic attacks return damage to attacker
  let reflected = 0;
  if (w.isMagic && defenderReflectPct > 0) {
    reflected = Math.max(1, Math.floor(finalDamage * defenderReflectPct));
  }

  return { damage: finalDamage, reflected };
}
