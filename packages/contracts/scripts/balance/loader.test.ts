import { describe, it, expect } from "vitest";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { loadGameData } from "./loader.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const fixturePath = resolve(__dirname, "__fixtures__");
const constantsPath = resolve(fixturePath, "constants.json");

function load() {
  return loadGameData(fixturePath, constantsPath);
}

describe("loader", () => {
  describe("structural completeness", () => {
    it("returns all GameData keys", () => {
      const data = load();
      const keys = Object.keys(data).sort();
      expect(keys).toEqual([
        "archetypeConfigs", "armors", "baseRolls", "classSpells", "classes",
        "combatConstants", "consumables", "levelingConstants", "monsterWeaponEffects",
        "monsters", "powerSources", "races", "startingArmors", "weaponEffects", "weapons",
      ]);
    });
  });

  describe("weapon mapping", () => {
    it("maps STR weapon correctly", () => {
      const data = load();
      const ironAxe = data.weapons.find(w => w.name === "Iron Axe");
      expect(ironAxe).toBeDefined();
      expect(ironAxe!.scaling).toBe("str");
      expect(ironAxe!.isMagic).toBe(false);
      expect(ironAxe!.strMod).toBe(1);
      expect(ironAxe!.minDamage).toBe(1);
      expect(ironAxe!.maxDamage).toBe(2);
      expect(ironAxe!.minStr).toBe(5);
    });

    it("maps AGI weapon with scalingStat=AGI", () => {
      const data = load();
      const bow = data.weapons.find(w => w.name === "Hunting Bow");
      expect(bow).toBeDefined();
      expect(bow!.scaling).toBe("agi");
      expect(bow!.isMagic).toBe(false);
      expect(bow!.agiMod).toBe(1);
    });

    it("maps magic weapon from magic effect ID", () => {
      const data = load();
      const rod = data.weapons.find(w => w.name === "Smoldering Rod");
      expect(rod).toBeDefined();
      expect(rod!.isMagic).toBe(true);
      expect(rod!.scaling).toBe("str"); // no scalingStat → defaults to str
    });

    it("maps dual-magic weapon with both physical+magic effects", () => {
      const data = load();
      const boneStaff = data.weapons.find(w => w.name === "Bone Staff");
      expect(boneStaff).toBeDefined();
      expect(boneStaff!.isMagic).toBe(true); // has magic effect
      // dual_magic should appear in weaponEffects
      expect(data.weaponEffects["Bone Staff"]).toBeDefined();
      const dualMagic = data.weaponEffects["Bone Staff"].find(e => e.type === "dual_magic");
      expect(dualMagic).toBeDefined();
    });

    it("filters out monster weapons from weapons array", () => {
      const data = load();
      const monsterWeapon = data.weapons.find(w => w.name === "Venomous Bite");
      expect(monsterWeapon).toBeUndefined();
    });

    it("converts price from wei to gold", () => {
      const data = load();
      const ironAxe = data.weapons.find(w => w.name === "Iron Axe");
      expect(ironAxe!.price).toBe(15);
      const rod = data.weapons.find(w => w.name === "Smoldering Rod");
      expect(rod!.price).toBe(300);
    });
  });

  describe("armor mapping", () => {
    it("maps armorModifier to armorValue and preserves type", () => {
      const data = load();
      expect(data.armors.length).toBeGreaterThan(0);
      const cloth = data.armors.find(a => a.name === "Tattered Cloth");
      expect(cloth).toBeDefined();
      expect(cloth!.armorValue).toBe(1);
      expect(cloth!.armorType).toBe("Cloth");
      expect(cloth!.intMod).toBe(1);
      expect(cloth!.price).toBe(5);
    });
  });

  describe("monster mapping", () => {
    it("maps monster with known weapon", () => {
      const data = load();
      const rat = data.monsters.find(m => m.name === "Cave Rat");
      expect(rat).toBeDefined();
      expect(rat!.weaponMinDmg).toBe(1);
      expect(rat!.weaponMaxDmg).toBe(2);
      expect(rat!.weaponScaling).toBe("agi"); // Venomous Bite has scalingStat: "AGI"
      expect(rat!.level).toBe(1);
      expect(rat!.str).toBe(4);
      expect(rat!.agi).toBe(7);
    });

    it("falls back to defaults for unknown weapon", () => {
      const data = load();
      const golem = data.monsters.find(m => m.name === "Rock Golem");
      expect(golem).toBeDefined();
      expect(golem!.weaponMinDmg).toBe(1);
      expect(golem!.weaponMaxDmg).toBe(2);
      expect(golem!.weaponScaling).toBe("str");
      expect(golem!.weaponIsMagic).toBe(false);
    });
  });

  describe("consumable mapping", () => {
    it("maps heal consumable (minDamage < 0)", () => {
      const data = load();
      const potion = data.consumables.find(c => c.name === "Minor Health Potion");
      expect(potion).toBeDefined();
      expect(potion!.type).toBe("heal");
      expect(potion!.healAmount).toBe(15); // abs(-15)
    });

    it("maps pre_buff consumable (validTime > 0)", () => {
      const data = load();
      const tea = data.consumables.find(c => c.name === "Focusing Tea");
      expect(tea).toBeDefined();
      expect(tea!.type).toBe("pre_buff");
      expect(tea!.intMod).toBe(5);
    });

    it("maps antidote as cleanse", () => {
      const data = load();
      const antidote = data.consumables.find(c => c.name === "Antidote");
      expect(antidote).toBeDefined();
      expect(antidote!.type).toBe("cleanse");
    });

    it("maps debuff consumable (validTurns > 0, not targetsSelf)", () => {
      const data = load();
      const sapping = data.consumables.find(c => c.name === "Sapping Poison");
      expect(sapping).toBeDefined();
      expect(sapping!.type).toBe("debuff");
      expect(sapping!.effect).toBeDefined();
      expect(sapping!.effect!.strMod).toBe(-8);
      expect(sapping!.effect!.duration).toBe(8);
    });

    it("maps tradeoff_buff consumable (validTurns > 0, targetsSelf)", () => {
      const data = load();
      const ale = data.consumables.find(c => c.name === "Trollblood Ale");
      expect(ale).toBeDefined();
      expect(ale!.type).toBe("tradeoff_buff");
      expect(ale!.effect).toBeDefined();
      expect(ale!.effect!.strMod).toBe(8);
      expect(ale!.effect!.agiMod).toBe(-3);
      expect(ale!.effect!.intMod).toBe(-5);
    });

    it("filters out vendor trash (no effects, no damage)", () => {
      const data = load();
      const ratTooth = data.consumables.find(c => c.name === "Rat Tooth");
      expect(ratTooth).toBeUndefined();
    });
  });

  describe("weapon effects", () => {
    it("maps DOT effect from poison on Venomous Bite (monster weapon)", () => {
      const data = load();
      // Monster weapon effects are keyed by monster name
      const ratEffects = data.monsterWeaponEffects["Cave Rat"];
      expect(ratEffects).toBeDefined();
      const dot = ratEffects.find(e => e.type === "dot");
      expect(dot).toBeDefined();
      expect(dot!.damagePerTick).toBe(3);
      expect(dot!.maxStacks).toBe(2);
      expect(dot!.duration).toBe(8);
      expect(dot!.cooldown).toBe(2);
    });

    it("keys monster weapon effects by monster name, not weapon name", () => {
      const data = load();
      expect(data.monsterWeaponEffects["Venomous Bite"]).toBeUndefined();
      expect(data.monsterWeaponEffects["Cave Rat"]).toBeDefined();
    });
  });

  describe("combat constants", () => {
    it("maps all combat constants with triangle pcts divided by 100", () => {
      const data = load();
      const cc = data.combatConstants;
      expect(cc.attackModifier).toBe(1.0);
      expect(cc.agiAttackModifier).toBe(1.0);
      expect(cc.critMultiplier).toBe(2);
      expect(cc.critBaseChance).toBe(4);
      expect(cc.evasionCap).toBe(25);
      expect(cc.combatTriangleFlatPct).toBe(0.20); // 20/100
      expect(cc.combatTrianglePerStat).toBe(0.02); // 2/100
      expect(cc.combatTriangleMax).toBe(0.20);     // 20/100
      expect(cc.magicResistPerInt).toBe(2);
      expect(cc.magicResistCap).toBe(40);
      expect(cc.blockChancePerStr).toBe(1.5);
      expect(cc.blockChanceCap).toBe(30);
      expect(cc.blockReductionPhys).toBe(0.5);
      expect(cc.blockReductionMagic).toBe(0.5);
      expect(cc.classMultiplierBase).toBe(1000);
      // All fields present
      expect(Object.keys(cc).length).toBe(28);
    });
  });

  describe("leveling constants", () => {
    it("maps flat rate to all 3 tiers", () => {
      const data = load();
      const lc = data.levelingConstants;
      expect(lc.baseHp).toBe(18);
      expect(lc.earlyGameCap).toBe(10);
      expect(lc.midGameCap).toBe(50);
      // Flat statPointsPerLevel=2 → all 3 tiers = 2
      expect(lc.statPointsEarly).toBe(2);
      expect(lc.statPointsMid).toBe(2);
      expect(lc.statPointsLate).toBe(2);
      // Flat hpPerLevel=2 → all 3 tiers = 2
      expect(lc.hpGainEarly).toBe(2);
      expect(lc.hpGainMid).toBe(2);
      expect(lc.hpGainLate).toBe(2);
      expect(lc.powerSourceBonusLevel).toBe(5);
    });
  });

  describe("races, classes, armors", () => {
    it("capitalizes race names", () => {
      const data = load();
      expect(data.races["human"].name).toBe("Human");
      expect(data.races["dwarf"].name).toBe("Dwarf");
      expect(data.races["elf"].name).toBe("Elf");
    });

    it("maps class multipliers correctly", () => {
      const data = load();
      const warrior = data.classes["warrior"];
      expect(warrior.name).toBe("Warrior");
      expect(warrior.flatStr).toBe(3);
      expect(warrior.physMult).toBe(1100);
      expect(warrior.hpMult).toBe(1000);
    });

    it("maps starting armors with capitalized names", () => {
      const data = load();
      expect(data.startingArmors["plate"].name).toBe("Plate");
      expect(data.startingArmors["plate"].str).toBe(2);
    });

    it("maps power sources with type", () => {
      const data = load();
      expect(data.powerSources["physical"].type).toBe("physical");
      expect(data.powerSources["weave"].type).toBe("weave");
    });

    it("initializes classSpells as empty", () => {
      const data = load();
      expect(data.classSpells).toEqual({});
    });
  });
});
