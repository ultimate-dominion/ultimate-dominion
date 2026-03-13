import { describe, it, expect } from "vitest";
import {
  applyOverrides,
  PROPOSED_COMBAT_CONSTANTS,
  PROPOSED_LEVELING_CONSTANTS,
  CLASS_SPELLS,
  WEAPONS_BASELINE,
  WEAPONS_REBALANCED,
  WEAPONS_V2,
  WEAPONS_V3,
  ARMORS_WITH_SECONDARY_REQS,
  MONSTERS_RETUNED,
  PROPOSED_WEAPON_EFFECTS,
  PROPOSED_MONSTER_WEAPON_EFFECTS,
  type SimFlags,
} from "./overrides.js";
import type { GameData, Weapon, Armor, Monster } from "./types.js";

function makeMinimalGameData(): GameData {
  return {
    weapons: [{ name: "TestSword", minDamage: 1, maxDamage: 2, strMod: 0, agiMod: 0, intMod: 0, hpMod: 0, scaling: "str" as const, isMagic: false, minStr: 0, minAgi: 0, minInt: 0, rarity: 0, price: 5 }],
    armors: [{ name: "TestArmor", armorValue: 1, strMod: 0, agiMod: 0, intMod: 0, hpMod: 0, minStr: 0, minAgi: 0, minInt: 0, armorType: "Cloth" as const, rarity: 0, price: 5 }],
    monsters: [{ name: "TestMob", level: 1, str: 5, agi: 5, int: 5, hp: 10, armor: 0, classType: 0, xp: 10, weaponMinDmg: 1, weaponMaxDmg: 2, weaponScaling: "str" as const, weaponIsMagic: false }],
    consumables: [],
    weaponEffects: { "ExistingWeapon": [{ type: "dot" as const, name: "burn", damagePerTick: 2, duration: 3 }] },
    monsterWeaponEffects: { "ExistingMonster": [{ type: "dot" as const, name: "sting", damagePerTick: 1 }] },
    combatConstants: { attackModifier: 1.0, agiAttackModifier: 0.8, defenseModifier: 1.0, critMultiplier: 1.5, critBaseChance: 3, critAgiDivisor: 4, evasionMultiplier: 2, evasionCap: 20, doubleStrikeMultiplier: 2, doubleStrikeCap: 20, combatTriangleFlatPct: 0.15, combatTrianglePerStat: 0.01, combatTriangleMax: 0.15, magicResistPerInt: 1, magicResistCap: 30, blockChancePerStr: 1, blockChanceCap: 25, blockReductionPhys: 0.4, blockReductionMagic: 0.2, hitStartingProbability: 85, hitAttackerDampener: 90, hitDefenderDampener: 25, hitMin: 5, hitMax: 95, spellDodgeThreshold: 8, spellDodgePctPerAgi: 1.5, spellDodgeCap: 15, classMultiplierBase: 1000 },
    levelingConstants: { baseHp: 15, earlyGameCap: 8, midGameCap: 40, statPointsEarly: 2, statPointsMid: 2, statPointsLate: 2, hpGainEarly: 2, hpGainMid: 2, hpGainLate: 2, powerSourceBonusLevel: 4 },
    races: {},
    startingArmors: {},
    powerSources: {},
    classes: {},
    baseRolls: {},
    archetypeConfigs: {},
    classSpells: {},
  };
}

const NO_FLAGS: SimFlags = {
  useRebalanced: false,
  useV2: false,
  useV3: false,
  useArmor: false,
  useSpells: false,
  useRetunedMonsters: false,
};

describe("overrides", () => {
  describe("always-applied overrides", () => {
    it("always overrides combat constants", () => {
      const result = applyOverrides(makeMinimalGameData(), NO_FLAGS);
      expect(result.combatConstants).toEqual(PROPOSED_COMBAT_CONSTANTS);
    });

    it("always overrides leveling constants", () => {
      const result = applyOverrides(makeMinimalGameData(), NO_FLAGS);
      expect(result.levelingConstants).toEqual(PROPOSED_LEVELING_CONSTANTS);
    });

    it("always applies class spells", () => {
      const result = applyOverrides(makeMinimalGameData(), NO_FLAGS);
      expect(result.classSpells).toEqual(CLASS_SPELLS);
    });
  });

  describe("weapon variant selection", () => {
    it("defaults to WEAPONS_BASELINE when no weapon flags", () => {
      const result = applyOverrides(makeMinimalGameData(), NO_FLAGS);
      expect(result.weapons).toEqual(WEAPONS_BASELINE);
    });

    it("uses WEAPONS_REBALANCED with useRebalanced flag", () => {
      const result = applyOverrides(makeMinimalGameData(), { ...NO_FLAGS, useRebalanced: true });
      expect(result.weapons).toEqual(WEAPONS_REBALANCED);
    });

    it("uses WEAPONS_V2 with useV2 flag", () => {
      const result = applyOverrides(makeMinimalGameData(), { ...NO_FLAGS, useV2: true });
      expect(result.weapons).toEqual(WEAPONS_V2);
    });

    it("uses WEAPONS_V3 with useV3 flag", () => {
      const result = applyOverrides(makeMinimalGameData(), { ...NO_FLAGS, useV3: true });
      expect(result.weapons).toEqual(WEAPONS_V3);
    });

    it("V3 wins over V2 and rebalanced", () => {
      const result = applyOverrides(makeMinimalGameData(), {
        ...NO_FLAGS, useV3: true, useV2: true, useRebalanced: true,
      });
      expect(result.weapons).toEqual(WEAPONS_V3);
    });
  });

  describe("armor overrides", () => {
    it("does not change armors with useArmor alone", () => {
      const data = makeMinimalGameData();
      const result = applyOverrides(data, { ...NO_FLAGS, useArmor: true });
      expect(result.armors).toEqual(data.armors);
    });

    it("applies armor overrides with useArmor + useV2", () => {
      const result = applyOverrides(makeMinimalGameData(), { ...NO_FLAGS, useArmor: true, useV2: true });
      expect(result.armors).toEqual(ARMORS_WITH_SECONDARY_REQS);
    });

    it("applies armor overrides with useArmor + useV3", () => {
      const result = applyOverrides(makeMinimalGameData(), { ...NO_FLAGS, useArmor: true, useV3: true });
      expect(result.armors).toEqual(ARMORS_WITH_SECONDARY_REQS);
    });
  });

  describe("monster overrides", () => {
    it("applies retuned monsters with useRetunedMonsters", () => {
      const result = applyOverrides(makeMinimalGameData(), { ...NO_FLAGS, useRetunedMonsters: true });
      expect(result.monsters).toEqual(MONSTERS_RETUNED);
    });
  });

  describe("weapon effects merge", () => {
    it("merges proposed weapon effects over existing (per-key replace)", () => {
      const data = makeMinimalGameData();
      const result = applyOverrides(data, NO_FLAGS);
      // Proposed effects should be present
      for (const key of Object.keys(PROPOSED_WEAPON_EFFECTS)) {
        expect(result.weaponEffects[key]).toEqual(PROPOSED_WEAPON_EFFECTS[key]);
      }
      // Existing effects that aren't overwritten should survive
      expect(result.weaponEffects["ExistingWeapon"]).toBeDefined();
    });

    it("merges proposed monster weapon effects", () => {
      const data = makeMinimalGameData();
      const result = applyOverrides(data, NO_FLAGS);
      for (const key of Object.keys(PROPOSED_MONSTER_WEAPON_EFFECTS)) {
        expect(result.monsterWeaponEffects[key]).toEqual(PROPOSED_MONSTER_WEAPON_EFFECTS[key]);
      }
      expect(result.monsterWeaponEffects["ExistingMonster"]).toBeDefined();
    });
  });

  describe("immutability", () => {
    it("does not mutate the input data", () => {
      const data = makeMinimalGameData();
      const originalWeapons = data.weapons;
      const originalArmors = data.armors;
      const originalMonsters = data.monsters;
      const originalCombat = data.combatConstants;
      const originalLeveling = data.levelingConstants;

      applyOverrides(data, { ...NO_FLAGS, useV3: true, useArmor: true, useRetunedMonsters: true });

      // Original data should be unchanged
      expect(data.weapons).toBe(originalWeapons);
      expect(data.armors).toBe(originalArmors);
      expect(data.monsters).toBe(originalMonsters);
      expect(data.combatConstants).toBe(originalCombat);
      expect(data.levelingConstants).toBe(originalLeveling);
    });

    it("returns a new object with no shared array references", () => {
      const data = makeMinimalGameData();
      const result = applyOverrides(data, NO_FLAGS);
      expect(result).not.toBe(data);
      expect(result.weapons).not.toBe(data.weapons);
    });
  });
});
