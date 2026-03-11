import { describe, it, expect } from "vitest";
import {
  statPointsForLevel,
  hpForLevel,
  totalStatPointsAtLevel,
  totalHpFromLeveling,
  allocatePoints,
  buildProfile,
  canEquip,
  canEquipArmor,
  triangleAdvantage,
  getDominant,
  makeCombatant,
  makeMonsterCombatant,
} from "./formulas.js";
import type { LevelingConstants, Archetype, Weapon, Armor, AdvancedClass } from "./types.js";

const DEFAULT_LC: LevelingConstants = {
  baseHp: 18,
  earlyGameCap: 10,
  midGameCap: 50,
  statPointsEarly: 1,
  statPointsMid: 1,
  statPointsLate: 1,
  hpGainEarly: 2,
  hpGainMid: 1,
  hpGainLate: 1,
  powerSourceBonusLevel: 5,
};

const WARRIOR_CLASS: AdvancedClass = {
  name: "Warrior", flatStr: 3, flatAgi: 0, flatInt: 0, flatHp: 10,
  physMult: 1100, spellMult: 1000, healMult: 1000, critMult: 1000, hpMult: 1000,
};

const SORCERER_CLASS: AdvancedClass = {
  name: "Sorcerer", flatStr: 2, flatAgi: 0, flatInt: 2, flatHp: 0,
  physMult: 1000, spellMult: 1150, healMult: 1000, critMult: 1000, hpMult: 1050,
};

function makeArchetype(overrides: Partial<Archetype> = {}): Archetype {
  return {
    id: "WAR-S",
    name: "Tank",
    className: "Warrior",
    advClass: WARRIOR_CLASS,
    race: { name: "Dwarf", str: 2, agi: -1, int: 0, hp: 1 },
    startingArmor: { name: "Plate", str: 2, agi: -1, int: 0, hp: 1 },
    powerSource: { name: "Physical", type: "physical" },
    statPath: "str",
    baseRoll: { str: 8, agi: 5, int: 6 },
    ...overrides,
  };
}

function makeWeapon(overrides: Partial<Weapon> = {}): Weapon {
  return {
    name: "Test Sword", minDamage: 2, maxDamage: 4, strMod: 2, agiMod: 0, intMod: 0, hpMod: 5,
    scaling: "str", isMagic: false, minStr: 9, minAgi: 0, minInt: 0, rarity: 1, price: 40,
    ...overrides,
  };
}

describe("formulas", () => {
  describe("statPointsForLevel", () => {
    it("returns early rate for levels within earlyGameCap", () => {
      expect(statPointsForLevel(1, DEFAULT_LC)).toBe(1);
      expect(statPointsForLevel(10, DEFAULT_LC)).toBe(1);
    });

    it("returns mid rate on even levels in mid range", () => {
      expect(statPointsForLevel(12, DEFAULT_LC)).toBe(1); // even
      expect(statPointsForLevel(14, DEFAULT_LC)).toBe(1); // even
    });

    it("returns 0 on odd levels in mid range", () => {
      expect(statPointsForLevel(11, DEFAULT_LC)).toBe(0);
      expect(statPointsForLevel(13, DEFAULT_LC)).toBe(0);
    });

    it("returns late rate on every 5th level after midGameCap", () => {
      expect(statPointsForLevel(55, DEFAULT_LC)).toBe(1);
      expect(statPointsForLevel(60, DEFAULT_LC)).toBe(1);
    });

    it("returns 0 on non-5th levels after midGameCap", () => {
      expect(statPointsForLevel(51, DEFAULT_LC)).toBe(0);
      expect(statPointsForLevel(52, DEFAULT_LC)).toBe(0);
      expect(statPointsForLevel(53, DEFAULT_LC)).toBe(0);
    });
  });

  describe("hpForLevel", () => {
    it("returns early HP rate within earlyGameCap", () => {
      expect(hpForLevel(1, DEFAULT_LC)).toBe(2);
      expect(hpForLevel(10, DEFAULT_LC)).toBe(2);
    });

    it("returns mid HP rate in mid range (every level)", () => {
      expect(hpForLevel(11, DEFAULT_LC)).toBe(1);
      expect(hpForLevel(25, DEFAULT_LC)).toBe(1);
    });

    it("returns late HP on even levels, 0 on odd after midGameCap", () => {
      expect(hpForLevel(52, DEFAULT_LC)).toBe(1); // even
      expect(hpForLevel(51, DEFAULT_LC)).toBe(0); // odd
    });
  });

  describe("totalStatPointsAtLevel", () => {
    it("accumulates correctly for early levels", () => {
      // 10 levels × 1 pt each = 10
      expect(totalStatPointsAtLevel(10, DEFAULT_LC)).toBe(10);
    });

    it("matches hand-calculated sum through mid levels", () => {
      // L1-10: 10 × 1 = 10
      // L11-12: 0 + 1 = 1 (only even levels)
      expect(totalStatPointsAtLevel(12, DEFAULT_LC)).toBe(11);
    });
  });

  describe("totalHpFromLeveling", () => {
    it("accumulates HP correctly for early levels", () => {
      // 10 levels × 2 HP each = 20
      expect(totalHpFromLeveling(10, DEFAULT_LC)).toBe(20);
    });

    it("adds mid HP on top of early", () => {
      // L1-10: 20, L11-12: 1+1 = 2 → 22
      expect(totalHpFromLeveling(12, DEFAULT_LC)).toBe(22);
    });
  });

  describe("allocatePoints", () => {
    it("puts all points into str path", () => {
      expect(allocatePoints(10, "str")).toEqual({ str: 10, agi: 0, int: 0 });
    });

    it("puts all points into agi path", () => {
      expect(allocatePoints(10, "agi")).toEqual({ str: 0, agi: 10, int: 0 });
    });

    it("puts all points into int path", () => {
      expect(allocatePoints(10, "int")).toEqual({ str: 0, agi: 0, int: 10 });
    });

    it("adds +1 when extraPsPoint is true", () => {
      expect(allocatePoints(10, "str", true)).toEqual({ str: 11, agi: 0, int: 0 });
    });
  });

  describe("buildProfile", () => {
    it("builds level 1 profile from base + race + armor + leveling", () => {
      const arch = makeArchetype();
      const profile = buildProfile(arch, 1, DEFAULT_LC, 1000);
      // base: str=8, agi=5, int=6
      // race (Dwarf): str+2, agi-1, int+0, hp+1
      // armor (Plate): str+2, agi-1, int+0, hp+1
      // level 1 stat points: 1 → all to str
      // HP: baseHp(18) + race.hp(1) + armor.hp(1) + hpForLevel(1)=2 = 22
      expect(profile.str).toBe(8 + 2 + 2 + 1); // 13
      expect(profile.agi).toBe(5 - 1 - 1);       // 3
      expect(profile.int).toBe(6 + 0 + 0);       // 6
      expect(profile.hp).toBe(18 + 1 + 1 + 2);  // 22
      expect(profile.dominantType).toBe("STR");
    });

    it("includes class bonuses at level 10", () => {
      const arch = makeArchetype();
      const profile = buildProfile(arch, 10, DEFAULT_LC, 1000);
      // base(8)+race(2)+armor(2)+10pts+1(physical ps bonus at L5)+class(3) = 26
      expect(profile.str).toBe(8 + 2 + 2 + 10 + 1 + 3); // 26
      // HP: 18+1+1+20+10(classHp) = 50
      expect(profile.hp).toBe(18 + 1 + 1 + 20 + 10);
    });

    it("applies power source bonus at level 5+", () => {
      // physical → +1 extra stat point
      const physArch = makeArchetype({ powerSource: { name: "Physical", type: "physical" } });
      const physProfile = buildProfile(physArch, 5, DEFAULT_LC, 1000);
      // 5 stat pts + 1 extra = 6 to str
      expect(physProfile.str).toBe(8 + 2 + 2 + 6); // 18

      // weave → +1 INT
      const weaveArch = makeArchetype({ powerSource: { name: "Weave", type: "weave" }, statPath: "int", baseRoll: { str: 5, agi: 6, int: 8 } });
      const weaveProfile = buildProfile(weaveArch, 5, DEFAULT_LC, 1000);
      expect(weaveProfile.int).toBe(8 + 0 + 0 + 5 + 1); // 14

      // divine → +2 HP
      const divineArch = makeArchetype({ powerSource: { name: "Divine", type: "divine" } });
      const divineProfile = buildProfile(divineArch, 5, DEFAULT_LC, 1000);
      expect(divineProfile.hp).toBe(18 + 1 + 1 + 10 + 2); // 32
    });

    it("applies hpMult when class has hpMult != classMultiplierBase", () => {
      const arch = makeArchetype({ advClass: SORCERER_CLASS });
      const profile = buildProfile(arch, 10, DEFAULT_LC, 1000);
      // Sorcerer hpMult=1050, base HP before mult = 18+1+1+20+0 = 40, flatStr=2, flatInt=2
      // But the mult applies to the full HP: floor(40 * 1050 / 1000) = floor(42) = 42
      expect(profile.hp).toBe(Math.floor(40 * 1050 / 1000));
    });
  });

  describe("canEquip", () => {
    it("returns true when profile meets all requirements", () => {
      const weapon = makeWeapon({ minStr: 10, minAgi: 5, minInt: 3 });
      const profile = { str: 15, agi: 8, int: 6, hp: 30, totalStats: 29, primaryStat: 15, dominantType: "STR" };
      expect(canEquip(weapon, profile)).toBe(true);
    });

    it("returns false when one requirement not met", () => {
      const weapon = makeWeapon({ minStr: 10, minAgi: 5, minInt: 3 });
      const profile = { str: 9, agi: 8, int: 6, hp: 30, totalStats: 23, primaryStat: 9, dominantType: "STR" };
      expect(canEquip(weapon, profile)).toBe(false);
    });

    it("returns true when requirements are exactly met", () => {
      const weapon = makeWeapon({ minStr: 10, minAgi: 5, minInt: 3 });
      const profile = { str: 10, agi: 5, int: 3, hp: 30, totalStats: 18, primaryStat: 10, dominantType: "STR" };
      expect(canEquip(weapon, profile)).toBe(true);
    });
  });

  describe("canEquipArmor", () => {
    it("returns true when profile meets all requirements", () => {
      const armor: Armor = { name: "Test", armorValue: 5, strMod: 0, agiMod: 0, intMod: 0, hpMod: 0, minStr: 8, minAgi: 0, minInt: 5, armorType: "Plate", rarity: 1, price: 50 };
      const profile = { str: 10, agi: 5, int: 7, hp: 30, totalStats: 22, primaryStat: 10, dominantType: "STR" };
      expect(canEquipArmor(armor, profile)).toBe(true);
    });

    it("returns false when INT requirement not met", () => {
      const armor: Armor = { name: "Test", armorValue: 5, strMod: 0, agiMod: 0, intMod: 0, hpMod: 0, minStr: 8, minAgi: 0, minInt: 10, armorType: "Cloth", rarity: 1, price: 50 };
      const profile = { str: 10, agi: 5, int: 7, hp: 30, totalStats: 22, primaryStat: 10, dominantType: "STR" };
      expect(canEquipArmor(armor, profile)).toBe(false);
    });
  });

  describe("triangleAdvantage", () => {
    it("STR has advantage over AGI", () => {
      expect(triangleAdvantage("STR", "AGI")).toBe(true);
    });

    it("AGI has advantage over INT", () => {
      expect(triangleAdvantage("AGI", "INT")).toBe(true);
    });

    it("INT has advantage over STR", () => {
      expect(triangleAdvantage("INT", "STR")).toBe(true);
    });

    it("AGI has no advantage over STR", () => {
      expect(triangleAdvantage("AGI", "STR")).toBe(false);
    });

    it("same type has no advantage", () => {
      expect(triangleAdvantage("STR", "STR")).toBe(false);
      expect(triangleAdvantage("AGI", "AGI")).toBe(false);
      expect(triangleAdvantage("INT", "INT")).toBe(false);
    });
  });

  describe("getDominant", () => {
    it("returns STR when str is highest", () => {
      expect(getDominant(15, 10, 8)).toEqual({ type: "STR", stat: 15 });
    });

    it("returns AGI when agi is strictly highest", () => {
      expect(getDominant(10, 15, 8)).toEqual({ type: "AGI", stat: 15 });
    });

    it("returns INT when int is highest (agi not > str)", () => {
      expect(getDominant(8, 8, 15)).toEqual({ type: "INT", stat: 15 });
    });

    it("STR wins ties with equal values (matches on-chain)", () => {
      expect(getDominant(10, 10, 10)).toEqual({ type: "STR", stat: 10 });
    });

    it("STR wins tie with AGI when both >= INT", () => {
      expect(getDominant(10, 10, 5)).toEqual({ type: "STR", stat: 10 });
    });

    it("AGI wins tie with INT when AGI > STR", () => {
      expect(getDominant(5, 10, 10)).toEqual({ type: "AGI", stat: 10 });
    });
  });

  describe("makeCombatant", () => {
    it("adds weapon mods to profile stats and recalculates dominant", () => {
      const profile = { str: 15, agi: 5, int: 6, hp: 30, totalStats: 26, primaryStat: 15, dominantType: "STR" };
      const weapon = makeWeapon({ strMod: 2, agiMod: 1, intMod: 0, hpMod: 5 });
      const combatant = makeCombatant(profile, weapon, WARRIOR_CLASS, 3, "Warrior");
      expect(combatant.str).toBe(17);
      expect(combatant.agi).toBe(6);
      expect(combatant.hp).toBe(35);
      expect(combatant.maxHp).toBe(35);
      expect(combatant.armor).toBe(3);
      expect(combatant.physMult).toBe(1100);
      expect(combatant.dominantType).toBe("STR");
      expect(combatant.className).toBe("Warrior");
    });

    it("applies hpMult to weapon HP when class has hpMult > 1000", () => {
      const profile = { str: 15, agi: 5, int: 8, hp: 30, totalStats: 28, primaryStat: 15, dominantType: "STR" };
      const weapon = makeWeapon({ hpMod: 10 });
      const combatant = makeCombatant(profile, weapon, SORCERER_CLASS);
      // hpMult=1050: hp = profile.hp + floor(weapon.hpMod * 1050 / 1000) = 30 + 10 = 40
      expect(combatant.hp).toBe(30 + Math.floor(10 * 1050 / 1000));
    });
  });

  describe("makeMonsterCombatant", () => {
    it("maps monster stats to combatant with default multipliers", () => {
      const monster = {
        name: "Cave Rat", str: 4, agi: 7, int: 3, hp: 12, armor: 0,
        weaponMinDmg: 1, weaponMaxDmg: 2, weaponScaling: "agi" as const, weaponIsMagic: false,
      };
      const combatant = makeMonsterCombatant(monster, true);
      expect(combatant.str).toBe(4);
      expect(combatant.agi).toBe(7);
      expect(combatant.int).toBe(3);
      expect(combatant.hp).toBe(12);
      expect(combatant.maxHp).toBe(12);
      expect(combatant.physMult).toBe(1000);
      expect(combatant.spellMult).toBe(1000);
      expect(combatant.dominantType).toBe("AGI");
      expect(combatant.weapon.name).toBe("Cave Rat"); // hasMonsterEffects=true
    });

    it("uses 'Monster Attack' name when no monster effects", () => {
      const monster = {
        name: "Rock Golem", str: 16, agi: 8, int: 6, hp: 45, armor: 4,
        weaponMinDmg: 1, weaponMaxDmg: 3, weaponScaling: "str" as const, weaponIsMagic: false,
      };
      const combatant = makeMonsterCombatant(monster, false);
      expect(combatant.weapon.name).toBe("Monster Attack");
    });
  });
});
