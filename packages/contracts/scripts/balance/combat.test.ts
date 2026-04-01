import { describe, it, expect } from "vitest";
import {
  seededRng,
  tickEffects,
  adjustCombatant,
  resolveAttack,
  resolveDualMagicHit,
  resolveBreathAttack,
  type ActiveEffectInstance,
  type RngFn,
} from "./combat.js";
import type { CombatConstants, Combatant, Weapon, WeaponEffect } from "./types.js";

const CC: CombatConstants = {
  attackModifier: 1.0,
  agiAttackModifier: 1.0,
  defenseModifier: 1.0,
  critMultiplier: 2,
  critBaseChance: 5,
  critAgiDivisor: 4,
  evasionMultiplier: 2,
  evasionCap: 35,
  doubleStrikeMultiplier: 3,
  doubleStrikeCap: 40,
  combatTriangleFlatPct: 0.20,
  combatTrianglePerStat: 0.02,
  combatTriangleMax: 0.12,
  magicResistPerInt: 3,
  magicResistCap: 40,
  blockChancePerStr: 2,
  blockChanceCap: 30,
  blockReductionPhys: 0.50,
  blockReductionMagic: 0.0,
  hitStartingProbability: 90,
  hitAttackerDampener: 95,
  hitDefenderDampener: 30,
  hitMin: 5,
  hitMax: 98,
  spellDodgeThreshold: 10,
  spellDodgePctPerAgi: 2.0,
  spellDodgeCap: 20,
  classMultiplierBase: 1000,
};

function makeWeapon(overrides: Partial<Weapon> = {}): Weapon {
  return {
    name: "Sword", minDamage: 3, maxDamage: 5, strMod: 2, agiMod: 0, intMod: 0, hpMod: 0,
    scaling: "str", isMagic: false, minStr: 0, minAgi: 0, minInt: 0, rarity: 1, price: 50,
    ...overrides,
  };
}

function makeCombatant(overrides: Partial<Combatant> = {}): Combatant {
  return {
    str: 15, agi: 8, int: 6, hp: 40, maxHp: 40, armor: 2,
    weapon: makeWeapon(),
    physMult: 1000, spellMult: 1000, critMult: 1000, hpMult: 1000,
    dominantType: "STR", dominantStat: 15, className: "Warrior",
    ...overrides,
  };
}

/** RNG that always returns the same value (for forcing specific outcomes) */
function fixedRng(value: number): RngFn {
  return (_min, _max) => value;
}

/** RNG that returns values from a sequence, cycling */
function sequenceRng(values: number[]): RngFn {
  let i = 0;
  return (_min, _max) => {
    const v = values[i % values.length];
    i++;
    return v;
  };
}

describe("combat", () => {
  describe("seededRng", () => {
    it("is deterministic with same seed", () => {
      const rng1 = seededRng(42);
      const rng2 = seededRng(42);
      const results1 = Array.from({ length: 10 }, () => rng1(1, 100));
      const results2 = Array.from({ length: 10 }, () => rng2(1, 100));
      expect(results1).toEqual(results2);
    });

    it("produces different results with different seeds", () => {
      const rng1 = seededRng(42);
      const rng2 = seededRng(99);
      const results1 = Array.from({ length: 10 }, () => rng1(1, 100));
      const results2 = Array.from({ length: 10 }, () => rng2(1, 100));
      expect(results1).not.toEqual(results2);
    });

    it("stays within bounds", () => {
      const rng = seededRng(123);
      for (let i = 0; i < 1000; i++) {
        const val = rng(5, 10);
        expect(val).toBeGreaterThanOrEqual(5);
        expect(val).toBeLessThanOrEqual(10);
      }
    });
  });

  describe("tickEffects", () => {
    it("returns DOT damage and decrements turns", () => {
      const effects: ActiveEffectInstance[] = [
        { name: "poison", type: "dot", turnsRemaining: 3, damagePerTick: 5, strMod: 0, agiMod: 0, intMod: 0, armorMod: 0 },
      ];
      const dmg = tickEffects(effects);
      expect(dmg).toBe(5);
      expect(effects[0].turnsRemaining).toBe(2);
    });

    it("removes expired effects", () => {
      const effects: ActiveEffectInstance[] = [
        { name: "poison", type: "dot", turnsRemaining: 1, damagePerTick: 3, strMod: 0, agiMod: 0, intMod: 0, armorMod: 0 },
      ];
      const dmg = tickEffects(effects);
      expect(dmg).toBe(3);
      expect(effects.length).toBe(0);
    });

    it("handles multiple effects including non-DOT", () => {
      const effects: ActiveEffectInstance[] = [
        { name: "poison", type: "dot", turnsRemaining: 2, damagePerTick: 3, strMod: 0, agiMod: 0, intMod: 0, armorMod: 0 },
        { name: "weaken", type: "stat_debuff", turnsRemaining: 1, damagePerTick: 0, strMod: -5, agiMod: 0, intMod: 0, armorMod: 0 },
      ];
      const dmg = tickEffects(effects);
      expect(dmg).toBe(3); // only DOT contributes
      expect(effects.length).toBe(1); // weaken expired
      expect(effects[0].name).toBe("poison");
    });
  });

  describe("adjustCombatant", () => {
    it("applies stat debuffs", () => {
      const base = makeCombatant({ str: 20, agi: 10, int: 5, armor: 3 });
      const effects: ActiveEffectInstance[] = [
        { name: "weaken", type: "stat_debuff", turnsRemaining: 3, damagePerTick: 0, strMod: -8, agiMod: 0, intMod: 0, armorMod: -2 },
      ];
      const adjusted = adjustCombatant(base, effects);
      expect(adjusted.str).toBe(12);
      expect(adjusted.armor).toBe(1);
      expect(adjusted.dominantType).toBe("STR");
    });

    it("clamps stats to 0 minimum", () => {
      const base = makeCombatant({ str: 5, agi: 3, int: 2 });
      const effects: ActiveEffectInstance[] = [
        { name: "weaken", type: "stat_debuff", turnsRemaining: 3, damagePerTick: 0, strMod: -10, agiMod: -10, intMod: -10, armorMod: 0 },
      ];
      const adjusted = adjustCombatant(base, effects);
      expect(adjusted.str).toBe(0);
      expect(adjusted.agi).toBe(0);
      expect(adjusted.int).toBe(0);
    });

    it("returns same object when no stat changes", () => {
      const base = makeCombatant();
      const effects: ActiveEffectInstance[] = [
        { name: "dot_only", type: "dot", turnsRemaining: 3, damagePerTick: 5, strMod: 0, agiMod: 0, intMod: 0, armorMod: 0 },
      ];
      const adjusted = adjustCombatant(base, effects);
      expect(adjusted).toBe(base); // same reference
    });

    it("applies self_buff effects", () => {
      const base = makeCombatant({ str: 15, agi: 8, int: 6 });
      const effects: ActiveEffectInstance[] = [
        { name: "rage", type: "self_buff", turnsRemaining: 3, damagePerTick: 0, strMod: 5, agiMod: 0, intMod: 0, armorMod: 3 },
      ];
      const adjusted = adjustCombatant(base, effects);
      expect(adjusted.str).toBe(20);
      expect(adjusted.armor).toBe(base.armor + 3);
    });
  });

  describe("resolveAttack", () => {
    it("always returns >= 1 damage when not evaded", () => {
      // Force no evasion (attacker AGI >= defender AGI), no crit, min damage roll
      const attacker = makeCombatant({ agi: 20, str: 5, weapon: makeWeapon({ minDamage: 1, maxDamage: 1 }) });
      const defender = makeCombatant({ agi: 5, str: 20, armor: 100 }); // high armor
      // rng sequence: 100 (no crit), 1 (min damage)
      const rng = sequenceRng([100, 1]);
      const dmg = resolveAttack(attacker, defender, CC, rng);
      expect(dmg).toBeGreaterThanOrEqual(1);
    });

    it("returns 0 when evaded", () => {
      const attacker = makeCombatant({ agi: 5 });
      const defender = makeCombatant({ agi: 30 }); // much higher AGI
      // Force evasion roll to hit (rng returns 1, well under evasion chance)
      const rng = fixedRng(1);
      const dmg = resolveAttack(attacker, defender, CC, rng);
      expect(dmg).toBe(0);
    });

    it("applies crit path: maxDamage * critMultiplier", () => {
      const weapon = makeWeapon({ minDamage: 3, maxDamage: 10, isMagic: false, scaling: "str" });
      const attacker = makeCombatant({ str: 15, agi: 8, weapon, dominantType: "STR", dominantStat: 15 });
      const defender = makeCombatant({ str: 15, agi: 5, armor: 0, dominantType: "STR", dominantStat: 15 });
      // rng: 1 (crit hit — below critChance which is 5+2=7), then doesn't matter for damage roll (crit uses maxDmg)
      // Then 100 for no double strike, 100 for no block
      const rng = sequenceRng([1, 100, 100]);
      const dmg = resolveAttack(attacker, defender, CC, rng);
      // rawDmg=10, scalingMod=1.2, damage=10*1.2=12, statDiff=(15*1.2-15)=3, damage=12+1.5=13.5
      // crit: 13.5*2=27, physMult=1000/1000=1, no triangle (same type), no double strike, no block
      // floor(27) = 27
      expect(dmg).toBe(27);
    });

    it("reduces physical damage by armor", () => {
      const weapon = makeWeapon({ minDamage: 5, maxDamage: 5, isMagic: false });
      const attacker = makeCombatant({ str: 10, agi: 8, weapon });
      const defNoArmor = makeCombatant({ str: 10, armor: 0 });
      const defWithArmor = makeCombatant({ str: 10, armor: 5 });
      const rng1 = sequenceRng([100, 100, 100]); // no crit, no double strike, no block
      const rng2 = sequenceRng([100, 100, 100]);
      const dmgNoArmor = resolveAttack(attacker, defNoArmor, CC, rng1);
      const dmgWithArmor = resolveAttack(attacker, defWithArmor, CC, rng2);
      expect(dmgWithArmor).toBeLessThan(dmgNoArmor);
    });

    it("magic bypasses armor", () => {
      const weapon = makeWeapon({ minDamage: 5, maxDamage: 5, isMagic: true, scaling: "str" });
      const attacker = makeCombatant({ int: 15, agi: 20, weapon, dominantType: "INT", dominantStat: 15 });
      const defNoArmor = makeCombatant({ int: 5, agi: 5, armor: 0, dominantType: "STR", dominantStat: 10 });
      const defWithArmor = makeCombatant({ int: 5, agi: 5, armor: 20, dominantType: "STR", dominantStat: 10 });
      // no evasion (attacker agi > defender), no crit, no block
      const rng1 = sequenceRng([100, 100]);
      const rng2 = sequenceRng([100, 100]);
      const dmg1 = resolveAttack(attacker, defNoArmor, CC, rng1);
      const dmg2 = resolveAttack(attacker, defWithArmor, CC, rng2);
      // Magic ignores armor, so damage should be the same
      expect(dmg1).toBe(dmg2);
    });

    it("magic damage reduced by INT resist", () => {
      const weapon = makeWeapon({ minDamage: 5, maxDamage: 5, isMagic: true });
      const attacker = makeCombatant({ int: 15, agi: 20, weapon });
      const defLowInt = makeCombatant({ int: 0, agi: 5, armor: 0 });
      const defHighInt = makeCombatant({ int: 13, agi: 5, armor: 0 }); // 13*3=39% resist
      const rng1 = sequenceRng([100, 100]);
      const rng2 = sequenceRng([100, 100]);
      const dmg1 = resolveAttack(attacker, defLowInt, CC, rng1);
      const dmg2 = resolveAttack(attacker, defHighInt, CC, rng2);
      expect(dmg2).toBeLessThan(dmg1);
    });

    it("AGI weapon double strike adds 50% damage", () => {
      const weapon = makeWeapon({ minDamage: 5, maxDamage: 5, scaling: "agi", isMagic: false });
      const attacker = makeCombatant({ agi: 25, str: 5, weapon, dominantType: "AGI", dominantStat: 25 });
      const defender = makeCombatant({ agi: 5, str: 15, armor: 0, dominantType: "STR", dominantStat: 15 });
      // no crit (100), damage roll (5), variance neutral (100), double strike PROC/MISS, no block (100)
      const rngNoDs = sequenceRng([100, 5, 100, 100, 100]); // no ds
      const rngDs = sequenceRng([100, 5, 100, 1, 100]);    // ds procs
      const dmgNoDs = resolveAttack(attacker, defender, CC, rngNoDs);
      const dmgDs = resolveAttack(attacker, defender, CC, rngDs);
      // Double strike adds damage/2, so dmgDs should be ~1.5x dmgNoDs
      expect(dmgDs).toBeGreaterThan(dmgNoDs);
    });

    it("block reduces physical damage", () => {
      const weapon = makeWeapon({ minDamage: 10, maxDamage: 10, isMagic: false });
      const attacker = makeCombatant({ str: 15, agi: 20, weapon });
      const defender = makeCombatant({ str: 20, agi: 5, armor: 0 }); // str>10 so block possible
      // no crit (100), damage (100), variance neutral (100), block PROC (1)
      const rngBlock = sequenceRng([100, 100, 100, 1]);
      // no crit (100), damage (100), variance neutral (100), block MISS (100)
      const rngNoBlock = sequenceRng([100, 100, 100, 100]);
      const dmgBlock = resolveAttack(attacker, defender, CC, rngBlock);
      const dmgNoBlock = resolveAttack(attacker, defender, CC, rngNoBlock);
      expect(dmgBlock).toBeLessThan(dmgNoBlock);
    });

    it("class multiplier scales damage", () => {
      const weapon = makeWeapon({ minDamage: 5, maxDamage: 5 });
      const base = makeCombatant({ str: 15, agi: 20, weapon });
      const buffed = makeCombatant({ str: 15, agi: 20, weapon, physMult: 1200 });
      const defender = makeCombatant({ str: 10, agi: 5, armor: 0 });
      const rng1 = sequenceRng([100, 100, 100]);
      const rng2 = sequenceRng([100, 100, 100]);
      const dmg1 = resolveAttack(base, defender, CC, rng1);
      const dmg2 = resolveAttack(buffed, defender, CC, rng2);
      expect(dmg2).toBeGreaterThan(dmg1);
    });

    it("applies ±25% damage variance", () => {
      const weapon = makeWeapon({ minDamage: 5, maxDamage: 5, isMagic: false });
      const attacker = makeCombatant({ str: 15, agi: 20, weapon });
      const defender = makeCombatant({ str: 15, agi: 5, armor: 0 });
      // Collect damage values over many seeded rolls — should see more than the old 1-2 unique values
      const rng = seededRng(42);
      const damages = new Set<number>();
      for (let i = 0; i < 1000; i++) {
        const dmg = resolveAttack(attacker, defender, CC, rng);
        if (dmg > 0) damages.add(dmg);
      }
      // With ±25% variance, equal-stat matchup should produce many distinct values
      expect(damages.size).toBeGreaterThan(3);
    });

    it("variance keeps damage >= 1", () => {
      const weapon = makeWeapon({ minDamage: 1, maxDamage: 1, isMagic: false });
      const attacker = makeCombatant({ str: 5, agi: 20, weapon });
      const defender = makeCombatant({ str: 20, agi: 5, armor: 10 }); // high armor
      const rng = seededRng(99);
      for (let i = 0; i < 1000; i++) {
        const dmg = resolveAttack(attacker, defender, CC, rng);
        expect(dmg).toBeGreaterThanOrEqual(1);
      }
    });

    it("combat triangle adds damage bonus", () => {
      const weapon = makeWeapon({ minDamage: 5, maxDamage: 5 });
      // STR vs AGI = advantage
      const attacker = makeCombatant({ str: 20, weapon, dominantType: "STR", dominantStat: 20 });
      const defAdv = makeCombatant({ agi: 10, armor: 0, dominantType: "AGI", dominantStat: 10 });
      const defNoAdv = makeCombatant({ str: 10, armor: 0, dominantType: "STR", dominantStat: 10 });
      const rng1 = sequenceRng([100, 100, 100]);
      const rng2 = sequenceRng([100, 100, 100]);
      const dmgAdv = resolveAttack(attacker, defAdv, CC, rng1);
      const dmgNoAdv = resolveAttack(attacker, defNoAdv, CC, rng2);
      expect(dmgAdv).toBeGreaterThan(dmgNoAdv);
    });
  });

  describe("resolveDualMagicHit", () => {
    it("deals magic damage using INT stats", () => {
      const weapon = makeWeapon({ minDamage: 3, maxDamage: 5, isMagic: true });
      const attacker = makeCombatant({ int: 15, weapon, spellMult: 1200 });
      const defender = makeCombatant({ int: 5 });
      const rng = seededRng(42);
      const dmg = resolveDualMagicHit(attacker, defender, CC, rng);
      expect(dmg).toBeGreaterThanOrEqual(1);
    });
  });

  describe("resolveBreathAttack", () => {
    it("uses breath minDmg/maxDmg and INT comparison", () => {
      const breath: WeaponEffect = { type: "magic_breath", name: "gaze", minDmg: 6, maxDmg: 10 };
      const attacker = makeCombatant({ int: 15 });
      const defender = makeCombatant({ int: 5 });
      const rng = seededRng(42);
      const dmg = resolveBreathAttack(attacker, defender, breath, CC, rng);
      expect(dmg).toBeGreaterThanOrEqual(1);
    });
  });

  describe("statistical tests (10k iterations)", () => {
    const ITERATIONS = 10000;

    it("mirror match produces ~50% win rate (among decisive fights)", () => {
      const rng = seededRng(12345);
      const weapon = makeWeapon({ minDamage: 3, maxDamage: 5 });
      const a = makeCombatant({ str: 15, agi: 8, int: 6, hp: 30, maxHp: 30, weapon, dominantType: "STR", dominantStat: 15 });
      const b = makeCombatant({ str: 15, agi: 8, int: 6, hp: 30, maxHp: 30, weapon, dominantType: "STR", dominantStat: 15 });

      let aWins = 0;
      let bWins = 0;
      for (let i = 0; i < ITERATIONS; i++) {
        let aHp = a.maxHp;
        let bHp = b.maxHp;
        for (let round = 0; round < 20 && aHp > 0 && bHp > 0; round++) {
          bHp -= resolveAttack(a, b, CC, rng);
          if (bHp <= 0) break;
          aHp -= resolveAttack(b, a, CC, rng);
        }
        if (bHp <= 0) aWins++;
        else if (aHp <= 0) bWins++;
      }
      const decisive = aWins + bWins;
      expect(decisive).toBeGreaterThan(ITERATIONS * 0.5); // most fights should resolve
      const winRate = aWins / decisive;
      // Attacker has slight first-mover advantage, so expect 50-60%
      expect(winRate).toBeGreaterThan(0.45);
      expect(winRate).toBeLessThan(0.65);
    });

    it("higher level character wins more often", () => {
      const rng = seededRng(54321);
      const weapon = makeWeapon({ minDamage: 3, maxDamage: 5 });
      const strong = makeCombatant({ str: 25, agi: 10, hp: 60, maxHp: 60, weapon, dominantType: "STR", dominantStat: 25 });
      const weak = makeCombatant({ str: 12, agi: 6, hp: 30, maxHp: 30, weapon, dominantType: "STR", dominantStat: 12 });

      let strongWins = 0;
      for (let i = 0; i < ITERATIONS; i++) {
        let sHp = strong.maxHp;
        let wHp = weak.maxHp;
        for (let round = 0; round < 8 && sHp > 0 && wHp > 0; round++) {
          wHp -= resolveAttack(strong, weak, CC, rng);
          if (wHp <= 0) break;
          sHp -= resolveAttack(weak, strong, CC, rng);
        }
        if (wHp <= 0) strongWins++;
      }
      expect(strongWins / ITERATIONS).toBeGreaterThan(0.70);
    });

    it("combat triangle is directional: STR>AGI, AGI>INT, INT>STR", () => {
      const rng = seededRng(99999);
      const strW = makeWeapon({ minDamage: 3, maxDamage: 5, scaling: "str" });
      const agiW = makeWeapon({ minDamage: 3, maxDamage: 5, scaling: "agi" });
      const intW = makeWeapon({ minDamage: 3, maxDamage: 5, scaling: "str", isMagic: true });

      const strBuild = makeCombatant({ str: 20, agi: 8, int: 6, hp: 40, maxHp: 40, weapon: strW, dominantType: "STR", dominantStat: 20 });
      const agiBuild = makeCombatant({ str: 6, agi: 20, int: 8, hp: 40, maxHp: 40, weapon: agiW, dominantType: "AGI", dominantStat: 20 });
      const intBuild = makeCombatant({ str: 6, agi: 8, int: 20, hp: 40, maxHp: 40, weapon: intW, dominantType: "INT", dominantStat: 20 });

      function winRate(a: Combatant, b: Combatant): number {
        let wins = 0;
        for (let i = 0; i < ITERATIONS; i++) {
          let aHp = a.maxHp, bHp = b.maxHp;
          for (let r = 0; r < 8 && aHp > 0 && bHp > 0; r++) {
            bHp -= resolveAttack(a, b, CC, rng);
            if (bHp <= 0) break;
            aHp -= resolveAttack(b, a, CC, rng);
          }
          if (bHp <= 0) wins++;
        }
        return wins / ITERATIONS;
      }

      expect(winRate(strBuild, agiBuild)).toBeGreaterThan(0.50); // STR > AGI
      expect(winRate(agiBuild, intBuild)).toBeGreaterThan(0.50); // AGI > INT
      expect(winRate(intBuild, strBuild)).toBeGreaterThan(0.50); // INT > STR
    });

    it("damage is always >= 1 across 10k attacks", () => {
      const rng = seededRng(77777);
      const attacker = makeCombatant({ agi: 20 }); // high agi to avoid evasion by having more
      const defender = makeCombatant({ agi: 5, armor: 100 });
      for (let i = 0; i < ITERATIONS; i++) {
        const dmg = resolveAttack(attacker, defender, CC, rng);
        // Can be 0 only from evasion. With attacker.agi > defender.agi, no evasion.
        expect(dmg).toBeGreaterThanOrEqual(1);
      }
    });

    it("AGI builds evade more than STR builds", () => {
      const rng = seededRng(11111);
      const weapon = makeWeapon({ minDamage: 3, maxDamage: 5 });
      // With evasionMultiplier=2, AGI gap produces evasion: (agiDiff=35) * 2 = 70% → capped at 35%
      const strAttacker = makeCombatant({ str: 10, agi: 5, weapon });
      const agiDefender = makeCombatant({ agi: 40, str: 10 });

      let evades = 0;
      for (let i = 0; i < ITERATIONS; i++) {
        const dmg = resolveAttack(strAttacker, agiDefender, CC, rng);
        if (dmg === 0) evades++;
      }
      expect(evades).toBeGreaterThan(0);
      expect(evades / ITERATIONS).toBeGreaterThan(0.10); // at least 10% evade rate
    });
  });
});
