/**
 * Stateless combat engine — wraps the balance sim into a reusable API.
 * Both the balance sim and drop sim can use this.
 *
 * Usage:
 *   const engine = createEngine(gameData);
 *   const arch = engine.archetypes[0];
 *   const result = engine.fight(arch, 5, engine.monsterByLevel(3));
 *   // result.won, result.rounds
 */

import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { loadGameData } from "./loader.js";
import { applyOverrides, type SimFlags } from "./overrides.js";
import type {
  GameData, Weapon, Armor, Monster, Combatant, Archetype,
  StatProfile, CombatConstants, LevelingConstants, AdvancedClass,
  WeaponEffect, ClassSpell, CombatResult, Consumable, ArchetypeConfig,
} from "./types.js";
import {
  totalStatPointsAtLevel,
  totalHpFromLeveling,
  buildProfile as _buildProfile,
  canEquip as _canEquip,
  canEquipArmor as _canEquipArmor,
  makeCombatant as _makeCombatant,
  makeMonsterCombatant as _makeMonsterCombatant,
  getDominant as _getDominant,
} from "./formulas.js";
import {
  resolveAttack as _resolveAttack,
  resolveDualMagicHit as _resolveDualMagicHit,
  resolveBreathAttack as _resolveBreathAttack,
  tickEffects,
  adjustCombatant,
  defaultRng,
  type ActiveEffectInstance,
  type RngFn,
} from "./combat.js";

// ============================================================
//  Engine interface
// ============================================================

export interface GearLoadout {
  profile: StatProfile;
  weapon: Weapon;
  armor: Armor | null;
  armorRating: number;
}

export interface FightResult {
  won: boolean;
  rounds: number;
  damageDealt: number;
}

export interface Engine {
  data: GameData;
  archetypes: Archetype[];
  monsterByLevel(level: number): Monster;
  buildGearLoadout(arch: Archetype, level: number, maxRarity?: number): GearLoadout;
  fight(arch: Archetype, level: number, monster: Monster, maxWeaponRarity?: number): FightResult;
  winRate(arch: Archetype, level: number, monster: Monster, iterations?: number, maxWeaponRarity?: number): number;
  precomputeWinRates(iterations?: number): Record<string, Record<number, Record<number, number>>>;
}

// ============================================================
//  Engine factory
// ============================================================

export function createEngine(data: GameData): Engine {
  const cc = data.combatConstants;
  const lc = data.levelingConstants;
  const maxCombatRounds = 8;
  const rng = defaultRng;

  function getWeaponEffects(weaponName: string): WeaponEffect[] {
    return data.weaponEffects[weaponName] || data.monsterWeaponEffects[weaponName] || [];
  }

  function estimateEffectValue(weaponName: string): number {
    const effects = getWeaponEffects(weaponName);
    let value = 0;
    for (const e of effects) {
      switch (e.type) {
        case "dot":
          value += (e.damagePerTick ?? 0) * (e.maxStacks ?? 1) * 1.2;
          break;
        case "stat_debuff":
          value += Math.abs(e.strMod ?? 0) * 0.8 +
                   Math.abs(e.agiMod ?? 0) * 0.5 +
                   Math.abs(e.intMod ?? 0) * 0.4;
          break;
        case "dual_magic":
          value += 4.0;
          break;
      }
    }
    return value;
  }

  function buildProfile(arch: Archetype, level: number): StatProfile {
    return _buildProfile(arch, level, lc, cc.classMultiplierBase);
  }

  function selectBestWeapon(arch: Archetype, profile: StatProfile, maxRarity?: number): Weapon {
    const equippable = data.weapons.filter(w =>
      _canEquip(w, profile) && (maxRarity === undefined || w.rarity <= maxRarity)
    );
    if (equippable.length === 0) return data.weapons[0];

    const scored = equippable.map(w => {
      const avgDmg = (w.minDamage + w.maxDamage) / 2;
      const scalingMod = w.isMagic ? cc.attackModifier :
                         w.scaling === "agi" ? cc.agiAttackModifier : cc.attackModifier;
      let attackerStat: number;
      if (w.isMagic) attackerStat = profile.int + w.intMod;
      else if (w.scaling === "agi") attackerStat = profile.agi + w.agiMod;
      else attackerStat = profile.str + w.strMod;

      const baseDmg = avgDmg * scalingMod;
      const statBonus = Math.max(0, attackerStat * scalingMod - 10) / 2;
      let classMult = w.isMagic ? arch.advClass.spellMult / 1000 : arch.advClass.physMult / 1000;
      const effectMult = 1 + estimateEffectValue(w.name) / 25;
      return { weapon: w, score: (baseDmg + statBonus) * classMult * effectMult + w.hpMod * 0.3 };
    });

    scored.sort((a, b) => b.score - a.score);
    return scored[0].weapon;
  }

  function selectBestArmor(profile: StatProfile, path: "str" | "agi" | "int", maxRarity?: number): Armor {
    const equippable = data.armors.filter(a =>
      _canEquipArmor(a, profile) && (maxRarity === undefined || a.rarity <= maxRarity)
    );
    if (equippable.length === 0) return data.armors[0];

    const scored = equippable.map(a => {
      let score = a.armorValue * 1.5 + a.hpMod;
      const pathBonus = path === "str" ? a.strMod : path === "agi" ? a.agiMod : a.intMod;
      score += pathBonus * 2.0;
      score += (a.strMod + a.agiMod + a.intMod) * 0.3;
      score += a.rarity * 0.1;
      return { armor: a, score };
    });

    scored.sort((a, b) => b.score - a.score);
    return scored[0].armor;
  }

  function applyArmorToProfile(profile: StatProfile, armor: Armor): StatProfile {
    const str = profile.str + armor.strMod;
    const agi = profile.agi + armor.agiMod;
    const int_ = profile.int + armor.intMod;
    const hp = profile.hp + armor.hpMod;
    const dom = _getDominant(str, agi, int_);
    return { str, agi, int: int_, hp, totalStats: str + agi + int_, primaryStat: dom.stat, dominantType: dom.type };
  }

  function getBaseStats(arch: Archetype, level: number) {
    let str = arch.baseRoll.str + arch.race.str + arch.startingArmor.str;
    let agi = arch.baseRoll.agi + arch.race.agi + arch.startingArmor.agi;
    let int_ = arch.baseRoll.int + arch.race.int + arch.startingArmor.int;
    let hp = lc.baseHp + arch.race.hp + arch.startingArmor.hp;
    hp += totalHpFromLeveling(level, lc);

    let extraPrimaryPt = 0;
    if (level >= lc.powerSourceBonusLevel) {
      if (arch.powerSource.type === "physical") extraPrimaryPt = 1;
      else if (arch.powerSource.type === "weave") int_ += 1;
      else if (arch.powerSource.type === "divine") hp += 2;
    }

    if (level >= 10) {
      str += arch.advClass.flatStr;
      agi += arch.advClass.flatAgi;
      int_ += arch.advClass.flatInt;
      hp += arch.advClass.flatHp;
    }

    return { str, agi, int: int_, hp, extraPrimaryPt };
  }

  function buildGearLoadout(arch: Archetype, level: number, maxRarity?: number): GearLoadout {
    const secondaryStats: ("str" | "agi" | "int")[] =
      arch.statPath === "str" ? ["agi", "int"] :
      arch.statPath === "agi" ? ["str", "int"] : ["str", "agi"];

    const base = getBaseStats(arch, level);
    const totalPoints = totalStatPointsAtLevel(level, lc) + base.extraPrimaryPt;

    let bestLoadout: GearLoadout | null = null;
    let bestScore = -Infinity;

    for (let offPath = 0; offPath <= 5; offPath++) {
      const primaryPoints = totalPoints - offPath;
      if (primaryPoints < 0) break;

      for (let s1 = offPath; s1 >= 0; s1--) {
        const s2 = offPath - s1;
        let str = base.str, agi = base.agi, int_ = base.int, hp = base.hp;

        if (arch.statPath === "str") str += primaryPoints;
        else if (arch.statPath === "agi") agi += primaryPoints;
        else int_ += primaryPoints;

        if (secondaryStats[0] === "str") str += s1;
        else if (secondaryStats[0] === "agi") agi += s1;
        else int_ += s1;

        if (secondaryStats[1] === "str") str += s2;
        else if (secondaryStats[1] === "agi") agi += s2;
        else int_ += s2;

        if (level >= 10 && arch.advClass.hpMult !== cc.classMultiplierBase) {
          hp = Math.floor((hp * arch.advClass.hpMult) / cc.classMultiplierBase);
        }

        const dom = _getDominant(str, agi, int_);
        const baseProfile: StatProfile = { str, agi, int: int_, hp, totalStats: str + agi + int_, primaryStat: dom.stat, dominantType: dom.type };

        const armor = selectBestArmor(baseProfile, arch.statPath, maxRarity);
        const profile = applyArmorToProfile(baseProfile, armor);
        const weapon = selectBestWeapon(arch, profile, maxRarity);
        const armorRating = armor.armorValue;

        const avgDmg = (weapon.minDamage + weapon.maxDamage) / 2;
        const scalingMod = weapon.isMagic ? cc.attackModifier :
                           weapon.scaling === "agi" ? cc.agiAttackModifier : cc.attackModifier;
        let attackerStat: number;
        if (weapon.isMagic) attackerStat = profile.int + weapon.intMod;
        else if (weapon.scaling === "agi") attackerStat = profile.agi + weapon.agiMod;
        else attackerStat = profile.str + weapon.strMod;

        const dmgScore = (avgDmg * scalingMod + Math.max(0, attackerStat * scalingMod - 10) / 2);
        const classMult = weapon.isMagic ? arch.advClass.spellMult / 1000 : arch.advClass.physMult / 1000;
        const effectMult = 1 + estimateEffectValue(weapon.name) / 25;
        const weaponScore = dmgScore * classMult * effectMult + weapon.hpMod * 0.3;
        const armorScore = armorRating * 1.5 + armor.hpMod * 0.3;
        const combatAgi = profile.agi + weapon.agiMod;
        let agiScore = Math.max(0, combatAgi - 10) * 0.15;
        if (weapon.scaling === "agi" && !weapon.isMagic && arch.statPath === "agi"
            && arch.advClass.physMult >= arch.advClass.spellMult) {
          agiScore += combatAgi * 0.35;
        }
        const magicBypassScore = weapon.isMagic ? 4.0 : 0;
        const combatStr = profile.str + weapon.strMod;
        const strDefScore = combatStr > 10 ? (combatStr - 10) * 0.25 : 0;

        const totalScore = weaponScore + armorScore + agiScore + magicBypassScore + strDefScore;
        if (totalScore > bestScore) {
          bestScore = totalScore;
          bestLoadout = { profile, weapon, armor, armorRating };
        }
      }
    }

    return bestLoadout!;
  }

  // Single combat — simplified version without spells/consumables for drop sim
  function simulateOneFight(attacker: Combatant, defender: Combatant): FightResult {
    let aHp = attacker.maxHp;
    let dHp = defender.maxHp;
    let rounds = 0;
    let totalDamageDealt = 0;

    const aEffects: ActiveEffectInstance[] = [];
    const dEffects: ActiveEffectInstance[] = [];
    const aHasEffects = getWeaponEffects(attacker.weapon.name).length > 0;
    const dHasEffects = getWeaponEffects(defender.weapon.name).length > 0;
    const aHasDualMagic = getWeaponEffects(attacker.weapon.name).some(e => e.type === "dual_magic");
    const dHasDualMagic = getWeaponEffects(defender.weapon.name).some(e => e.type === "dual_magic");
    const aBreathEffect = getWeaponEffects(attacker.weapon.name).find(e => e.type === "magic_breath");
    const dBreathEffect = getWeaponEffects(defender.weapon.name).find(e => e.type === "magic_breath");
    const aBreathCooldown = { lastUsed: -999 };
    const dBreathCooldown = { lastUsed: -999 };

    while (rounds < maxCombatRounds && aHp > 0 && dHp > 0) {
      rounds++;

      // Tick effects
      const aDot = tickEffects(aEffects);
      const dDot = tickEffects(dEffects);
      aHp -= aDot;
      dHp -= dDot;
      if (aHp <= 0 || dHp <= 0) break;

      // Adjust stats for active effects
      const adjAttacker = adjustCombatant(attacker, aEffects);
      const adjDefender = adjustCombatant(defender, dEffects);

      // Attacker's turn
      const aDmg = _resolveAttack(adjAttacker, adjDefender, cc, rng);
      dHp -= aDmg;
      totalDamageDealt += aDmg;

      // Apply weapon effects on hit
      if (aDmg > 0 && aHasEffects) {
        for (const e of getWeaponEffects(attacker.weapon.name)) {
          if (e.type === "dot") {
            const existing = dEffects.find(x => x.name === e.name);
            if (existing) {
              existing.turnsRemaining = e.duration ?? 3;
              // stack if under max
            } else {
              dEffects.push({
                name: e.name, type: "dot", turnsRemaining: e.duration ?? 3,
                damagePerTick: e.damagePerTick ?? 0, strMod: 0, agiMod: 0, intMod: 0, armorMod: 0,
              });
            }
          } else if (e.type === "stat_debuff") {
            dEffects.push({
              name: e.name, type: "stat_debuff", turnsRemaining: e.duration ?? 3,
              damagePerTick: 0, strMod: e.strMod ?? 0, agiMod: e.agiMod ?? 0,
              intMod: e.intMod ?? 0, armorMod: e.armorMod ?? 0,
            });
          }
        }
      }

      // Dual magic hit
      if (aHasDualMagic && dHp > 0) {
        const dualDmg = _resolveDualMagicHit(adjAttacker, adjDefender, cc, rng);
        dHp -= dualDmg;
        totalDamageDealt += dualDmg;
      }

      // Breath attack
      if (aBreathEffect && dHp > 0 && (rounds - aBreathCooldown.lastUsed) >= (aBreathEffect.cooldown ?? 2)) {
        const bDmg = _resolveBreathAttack(adjAttacker, adjDefender, aBreathEffect, cc, rng);
        dHp -= bDmg;
        totalDamageDealt += bDmg;
        aBreathCooldown.lastUsed = rounds;
      }

      if (dHp <= 0) break;

      // Defender's turn
      const dDmg = _resolveAttack(adjDefender, adjAttacker, cc, rng);
      aHp -= dDmg;

      if (dDmg > 0 && dHasEffects) {
        for (const e of getWeaponEffects(defender.weapon.name)) {
          if (e.type === "dot") {
            const existing = aEffects.find(x => x.name === e.name);
            if (existing) {
              existing.turnsRemaining = e.duration ?? 3;
            } else {
              aEffects.push({
                name: e.name, type: "dot", turnsRemaining: e.duration ?? 3,
                damagePerTick: e.damagePerTick ?? 0, strMod: 0, agiMod: 0, intMod: 0, armorMod: 0,
              });
            }
          } else if (e.type === "stat_debuff") {
            aEffects.push({
              name: e.name, type: "stat_debuff", turnsRemaining: e.duration ?? 3,
              damagePerTick: 0, strMod: e.strMod ?? 0, agiMod: e.agiMod ?? 0,
              intMod: e.intMod ?? 0, armorMod: e.armorMod ?? 0,
            });
          }
        }
      }

      if (dHasDualMagic && aHp > 0) {
        const dualDmg = _resolveDualMagicHit(adjDefender, adjAttacker, cc, rng);
        aHp -= dualDmg;
      }

      if (dBreathEffect && aHp > 0 && (rounds - dBreathCooldown.lastUsed) >= (dBreathEffect.cooldown ?? 2)) {
        const bDmg = _resolveBreathAttack(adjDefender, adjAttacker, dBreathEffect, cc, rng);
        aHp -= bDmg;
        dBreathCooldown.lastUsed = rounds;
      }
    }

    return { won: dHp <= 0 && aHp > 0, rounds, damageDealt: totalDamageDealt };
  }

  // Build archetypes from GameData
  const archetypes: Archetype[] = Object.entries(data.archetypeConfigs).map(([id, cfg]) => {
    const className = cfg.class.charAt(0).toUpperCase() + cfg.class.slice(1);
    return {
      id, name: cfg.name, className,
      advClass: data.classes[cfg.class],
      race: data.races[cfg.race],
      startingArmor: data.startingArmors[cfg.armor],
      powerSource: data.powerSources[cfg.power],
      statPath: cfg.path,
      baseRoll: data.baseRolls[cfg.path],
    };
  });

  // Public API
  return {
    data,
    archetypes,

    monsterByLevel(level: number): Monster {
      return data.monsters.find(m => m.level === level) || data.monsters[0];
    },

    buildGearLoadout,

    fight(arch: Archetype, level: number, monster: Monster, maxWeaponRarity?: number): FightResult {
      const gear = buildGearLoadout(arch, level, maxWeaponRarity);
      const player = _makeCombatant(gear.profile, gear.weapon, arch.advClass, gear.armorRating, arch.className);
      const mob = _makeMonsterCombatant(monster, !!data.monsterWeaponEffects[monster.name]);
      return simulateOneFight(player, mob);
    },

    winRate(arch: Archetype, level: number, monster: Monster, iterations = 200, maxWeaponRarity?: number): number {
      let wins = 0;
      for (let i = 0; i < iterations; i++) {
        if (this.fight(arch, level, monster, maxWeaponRarity).won) wins++;
      }
      return wins / iterations;
    },

    // Pre-compute win rates for all archetypes × levels × monsters
    precomputeWinRates(iterations = 100): Record<string, Record<number, Record<number, number>>> {
      const table: Record<string, Record<number, Record<number, number>>> = {};
      for (const arch of archetypes) {
        table[arch.id] = {};
        for (let playerLevel = 1; playerLevel <= 10; playerLevel++) {
          table[arch.id][playerLevel] = {};
          for (let mobLevel = 1; mobLevel <= 10; mobLevel++) {
            const monster = data.monsters.find(m => m.level === mobLevel);
            if (!monster) continue;
            const maxRarity = playerLevel <= 1 ? 0 : playerLevel <= 3 ? 1 : playerLevel <= 5 ? 2 : playerLevel <= 7 ? 3 : 4;
            table[arch.id][playerLevel][mobLevel] = this.winRate(arch, playerLevel, monster, iterations, maxRarity);
          }
        }
      }
      return table;
    },
  };
}

// ============================================================
//  Convenience: load data and create engine in one call
// ============================================================

export function loadEngine(simFlags?: Partial<SimFlags>): Engine {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  const zonePath = resolve(__dirname, "../../zones/dark_cave");
  const constantsPath = resolve(__dirname, "../balance/constants.json");

  const baselineData = loadGameData(zonePath, constantsPath);
  const flags: SimFlags = {
    useRebalanced: false,
    useV2: false,
    useV3: true,
    useArmor: true,
    useSpells: false,
    useRetunedMonsters: true,
    useOnchain: false,
    ...simFlags,
  };
  const data = applyOverrides(baselineData, flags);
  return createEngine(data);
}
