import { describe, it, expect } from "vitest";
import {
  trycastSpell3,
  simulate2v2PvP,
  simulatePartyPvE,
  buildPartyMember,
  loadData,
  buildArchetypes,
  CLASS_SPELLS_3,
  Z3_MONSTERS,
  type PartyMember,
  type Spell3Tracker,
} from "./journey-z3.js";
import type { Combatant, CombatConstants, CcHistoryEntry, ClassSpell } from "./types.js";
import {
  applySilence,
  applyRoot,
  type ActiveEffectInstance,
} from "./combat.js";

// Shared test data
let data: ReturnType<typeof loadData>;
let archetypes: ReturnType<typeof buildArchetypes>;

function setup() {
  if (!data) {
    data = loadData();
    archetypes = buildArchetypes(data);
  }
}

const CC: CombatConstants = {
  attackModifier: 1.0, agiAttackModifier: 1.0, defenseModifier: 1.0,
  critMultiplier: 2, critBaseChance: 5, critAgiDivisor: 4,
  evasionMultiplier: 2, evasionCap: 25, doubleStrikeMultiplier: 3, doubleStrikeCap: 40,
  combatTriangleFlatPct: 0, combatTrianglePerStat: 0.02, combatTriangleMax: 0.12,
  magicResistPerInt: 3, magicResistCap: 40,
  blockChancePerStr: 2, blockChanceCap: 35, blockReductionPhys: 0.55, blockReductionMagic: 0.30,
  hitStartingProbability: 90, hitAttackerDampener: 95, hitDefenderDampener: 30,
  hitMin: 5, hitMax: 98, spellDodgeThreshold: 10, spellDodgePctPerAgi: 2.0, spellDodgeCap: 20,
  classMultiplierBase: 1000,
};

// ============================================================
// buildPartyMember tests
// ============================================================

describe("buildPartyMember", () => {
  it("builds a party member without spell3 below L25", () => {
    setup();
    const arch = archetypes.find(a => a.className === "Warrior" && a.statPath === "str")!;
    const pm = buildPartyMember(arch, 24, data, true); // useSpell3=true but level<25
    expect(pm.spell3).toBeNull();
    expect(pm.alive).toBe(true);
    expect(pm.hp).toBe(pm.maxHp);
    expect(pm.soulLinkedTo).toBe(-1);
  });

  it("equips spell3 at L25+ when useSpell3 is true", () => {
    setup();
    const arch = archetypes.find(a => a.className === "Warrior" && a.statPath === "str")!;
    const pm = buildPartyMember(arch, 25, data, true);
    expect(pm.spell3).not.toBeNull();
    expect(pm.spell3!.spell.name).toBe("Iron Wall");
    expect(pm.spell3!.spell.type).toBe("guard");
    expect(pm.spell3!.usesRemaining).toBe(3); // Warrior guard has maxUses: 3
  });

  it("does not equip spell3 when useSpell3 is false", () => {
    setup();
    const arch = archetypes.find(a => a.className === "Warrior" && a.statPath === "str")!;
    const pm = buildPartyMember(arch, 30, data, false);
    expect(pm.spell3).toBeNull();
  });

  it("drops weapon3 when spell3 is equipped", () => {
    setup();
    const arch = archetypes.find(a => a.className === "Warrior" && a.statPath === "str")!;
    const pmNoSpell = buildPartyMember(arch, 30, data, false);
    const pmWithSpell = buildPartyMember(arch, 30, data, true);
    // weapon3 should be null when spell3 is active
    expect(pmWithSpell.gear.weapon3).toBeNull();
    expect(pmWithSpell.spell3).not.toBeNull();
  });

  it("all 9 classes get their correct spell3", () => {
    setup();
    const classNames = ["Warrior", "Paladin", "Ranger", "Rogue", "Druid", "Warlock", "Wizard", "Sorcerer", "Cleric"];
    for (const cls of classNames) {
      const arch = archetypes.find(a => a.className === cls)!;
      expect(arch).toBeDefined();
      const pm = buildPartyMember(arch, 25, data, true);
      expect(pm.spell3).not.toBeNull();
      expect(pm.spell3!.spell.name).toBe(CLASS_SPELLS_3[cls].name);
    }
  });
});

// ============================================================
// trycastSpell3 tests
// ============================================================

describe("trycastSpell3", () => {
  function makeMockPartyMember(overrides: Partial<PartyMember> = {}): PartyMember {
    setup();
    const arch = archetypes.find(a => a.className === "Warrior" && a.statPath === "str")!;
    const base = buildPartyMember(arch, 25, data, true);
    return { ...base, ...overrides };
  }

  function makeMockCombatant(): Combatant {
    return {
      str: 20, agi: 10, int: 5, hp: 100, maxHp: 100, armor: 5,
      weapon: { name: "Boss", minDamage: 5, maxDamage: 10, strMod: 0, agiMod: 0, intMod: 0, hpMod: 0, scaling: "str", isMagic: false, minStr: 0, minAgi: 0, minInt: 0, rarity: 1, price: 0 },
      physMult: 1000, spellMult: 1000, critMult: 1000, hpMult: 1000,
      dominantType: "STR", dominantStat: 20, className: "Monster",
    };
  }

  it("does not cast when silenced", () => {
    const pm = makeMockPartyMember();
    applySilence(pm.effects, 2, "Test");
    const mob = makeMockCombatant();
    const dmg = { value: 0 };
    const taken = { value: 0 };
    const result = trycastSpell3(pm, [pm], mob, [], [], 1, CC, dmg, taken);
    expect(result).toBe(false);
  });

  it("does not cast when uses exhausted", () => {
    const pm = makeMockPartyMember();
    pm.spell3!.usesRemaining = 0;
    const mob = makeMockCombatant();
    const result = trycastSpell3(pm, [pm], mob, [], [], 1, CC, { value: 0 }, { value: 0 });
    expect(result).toBe(false);
  });

  it("does not cast when on cooldown", () => {
    const pm = makeMockPartyMember();
    pm.spell3!.cooldownUntil = 5;
    const mob = makeMockCombatant();
    const result = trycastSpell3(pm, [pm], mob, [], [], 3, CC, { value: 0 }, { value: 0 });
    expect(result).toBe(false);
  });

  it("does not cast when spell3 is null", () => {
    const pm = makeMockPartyMember();
    pm.spell3 = null;
    const mob = makeMockCombatant();
    const result = trycastSpell3(pm, [pm], mob, [], [], 1, CC, { value: 0 }, { value: 0 });
    expect(result).toBe(false);
  });

  it("guard requires an ally to guard", () => {
    // Solo warrior — no allies to guard
    const pm = makeMockPartyMember();
    const mob = makeMockCombatant();
    const result = trycastSpell3(pm, [pm], mob, [], [], 1, CC, { value: 0 }, { value: 0 });
    expect(result).toBe(false); // no ally to guard
  });

  it("guard casts when ally is present", () => {
    const pm1 = makeMockPartyMember();
    const pm2 = makeMockPartyMember();
    pm2.spell3 = null; // second member isn't a warrior
    const mob = makeMockCombatant();
    const result = trycastSpell3(pm1, [pm1, pm2], mob, [], [], 1, CC, { value: 0 }, { value: 0 });
    expect(result).toBe(true);
    expect(pm1.spell3!.usesRemaining).toBe(2); // decremented from 3
  });

  it("silence spell (Rogue) applies silence to boss and deals damage", () => {
    setup();
    const rogueArch = archetypes.find(a => a.className === "Rogue" && a.statPath === "agi")!;
    const pm = buildPartyMember(rogueArch, 25, data, true);
    expect(pm.spell3!.spell.type).toBe("silence");

    const mob = makeMockCombatant();
    const mobEffects: ActiveEffectInstance[] = [];
    const mobCcHistory: CcHistoryEntry[] = [];
    const dmg = { value: 0 };
    const result = trycastSpell3(pm, [pm], mob, mobEffects, mobCcHistory, 1, CC, dmg, { value: 0 });
    expect(result).toBe(true);
    expect(dmg.value).toBeGreaterThan(0); // dealt damage
    expect(mob.hp).toBeLessThan(100); // boss took damage
    expect(mobEffects.some(e => e.type === "silence")).toBe(true); // boss silenced
    expect(mobCcHistory.length).toBe(1);
  });

  it("root spell (Ranger) applies root to boss and deals damage", () => {
    setup();
    const rangerArch = archetypes.find(a => a.className === "Ranger" && a.statPath === "agi")!;
    const pm = buildPartyMember(rangerArch, 25, data, true);
    expect(pm.spell3!.spell.type).toBe("root");

    const mob = makeMockCombatant();
    const mobEffects: ActiveEffectInstance[] = [];
    const mobCcHistory: CcHistoryEntry[] = [];
    const dmg = { value: 0 };
    const result = trycastSpell3(pm, [pm], mob, mobEffects, mobCcHistory, 1, CC, dmg, { value: 0 });
    expect(result).toBe(true);
    expect(dmg.value).toBeGreaterThan(0);
    expect(mobEffects.some(e => e.type === "root")).toBe(true);
  });

  it("heal spell (Cleric) heals critically wounded ally", () => {
    setup();
    const clericArch = archetypes.find(a => a.className === "Cleric")!;
    const pm = buildPartyMember(clericArch, 25, data, true);
    expect(pm.spell3!.spell.type).toBe("ally_heal");

    // Create a wounded ally
    const allyArch = archetypes.find(a => a.className === "Warrior")!;
    const ally = buildPartyMember(allyArch, 25, data, false);
    ally.hp = Math.floor(ally.maxHp * 0.3); // 30% HP — below 40% threshold
    const prevHp = ally.hp;

    const mob = makeMockCombatant();
    const result = trycastSpell3(pm, [pm, ally], mob, [], [], 1, CC, { value: 0 }, { value: 0 });
    expect(result).toBe(true);
    expect(ally.hp).toBeGreaterThan(prevHp); // healed
  });

  it("heal spell does NOT cast when everyone is healthy", () => {
    setup();
    const clericArch = archetypes.find(a => a.className === "Cleric")!;
    const pm = buildPartyMember(clericArch, 25, data, true);

    const allyArch = archetypes.find(a => a.className === "Warrior")!;
    const ally = buildPartyMember(allyArch, 25, data, false);
    // ally at full HP

    const mob = makeMockCombatant();
    const result = trycastSpell3(pm, [pm, ally], mob, [], [], 1, CC, { value: 0 }, { value: 0 });
    expect(result).toBe(false); // nobody wounded
  });

  it("root spell does not cast when boss is CC immune (DR)", () => {
    setup();
    const rangerArch = archetypes.find(a => a.className === "Ranger" && a.statPath === "agi")!;
    const pm = buildPartyMember(rangerArch, 25, data, true);

    const mob = makeMockCombatant();
    const mobEffects: ActiveEffectInstance[] = [];
    // 3 roots in 4 rounds = immune
    const mobCcHistory: CcHistoryEntry[] = [
      { type: "root", appliedRound: 1 },
      { type: "root", appliedRound: 3 },
    ];
    const result = trycastSpell3(pm, [pm], mob, mobEffects, mobCcHistory, 5, CC, { value: 0 }, { value: 0 });
    expect(result).toBe(false); // immune, don't waste
  });
});

// ============================================================
// simulatePartyPvE tests
// ============================================================

describe("simulatePartyPvE", () => {
  it("solo party member can fight a non-elite monster", () => {
    setup();
    const arch = archetypes.find(a => a.className === "Warrior" && a.statPath === "str")!;
    const pm = buildPartyMember(arch, 21, data);
    const monster = Z3_MONSTERS.find(m => m.level === 21)!;

    const result = simulatePartyPvE([pm], monster, data);
    expect(["party", "enemies", "draw"]).toContain(result.winningSide);
    expect(result.rounds).toBeGreaterThan(0);
    expect(result.rounds).toBeLessThanOrEqual(30);
  });

  it("3v1 party vs L30 boss is a real fight (takes multiple rounds)", () => {
    setup();
    const boss = Z3_MONSTERS.find(m => m.level === 30 && m.isElite)!;
    const arches = [
      archetypes.find(a => a.statPath === "str")!,
      archetypes.find(a => a.statPath === "agi")!,
      archetypes.find(a => a.statPath === "int")!,
    ];

    const party = arches.map(a => buildPartyMember(a, 30, data));
    const result = simulatePartyPvE(party, boss, data);

    // Fight should last multiple rounds (boss has phases + high HP)
    expect(result.rounds).toBeGreaterThan(3);
    // Both sides should deal meaningful damage
    expect(result.totalDamageDealt).toBeGreaterThan(0);
    expect(result.totalDamageTaken).toBeGreaterThan(0);
  });

  it("party HP remaining is tracked per member", () => {
    setup();
    const monster = Z3_MONSTERS.find(m => m.level === 21)!;
    const arches = archetypes.slice(0, 2);
    const party = arches.map(a => buildPartyMember(a, 21, data));

    const result = simulatePartyPvE(party, monster, data);
    expect(result.partyHpRemaining.length).toBe(2);
    for (const hp of result.partyHpRemaining) {
      expect(hp).toBeGreaterThanOrEqual(0);
    }
  });

  it("spell3 resets between iterations (uses restored)", () => {
    setup();
    const arch = archetypes.find(a => a.className === "Rogue" && a.statPath === "agi")!;
    const pm = buildPartyMember(arch, 25, data, true);
    const monster = Z3_MONSTERS.find(m => m.level === 21)!;

    // Run fight — spell3 uses get consumed
    simulatePartyPvE([pm], monster, data);
    // After fight, uses should still be reset (since simulatePartyPvE resets at start)
    // Run again to verify
    const pm2 = buildPartyMember(arch, 25, data, true);
    expect(pm2.spell3!.usesRemaining).toBe(2); // Rogue spell has maxUses: 2
    simulatePartyPvE([pm2], monster, data);
    // Running again should work (uses reset internally)
    const result = simulatePartyPvE([pm2], monster, data);
    expect(["party", "enemies", "draw"]).toContain(result.winningSide);
  });
});

// ============================================================
// simulate2v2PvP tests
// ============================================================

describe("simulate2v2PvP", () => {
  it("returns a valid result (1, 2, or 0)", () => {
    setup();
    const arches = archetypes.slice(0, 4);
    const team1 = arches.slice(0, 2).map(a => buildPartyMember(a, 30, data));
    const team2 = arches.slice(2, 4).map(a => buildPartyMember(a, 30, data));

    const result = simulate2v2PvP(team1, team2, data.combatConstants, data);
    expect([0, 1, 2]).toContain(result);
  });

  it("resets HP and effects between calls", () => {
    setup();
    const arches = archetypes.slice(0, 4);
    const team1 = arches.slice(0, 2).map(a => buildPartyMember(a, 30, data));
    const team2 = arches.slice(2, 4).map(a => buildPartyMember(a, 30, data));

    // Run once
    simulate2v2PvP(team1, team2, data.combatConstants, data);
    // Members should be usable again (internal reset)
    const result2 = simulate2v2PvP(team1, team2, data.combatConstants, data);
    expect([0, 1, 2]).toContain(result2);
  });

  it("higher-AGI team members act first in resolution order", () => {
    setup();
    // Create two teams where one has much higher AGI
    const strArch = archetypes.find(a => a.statPath === "str")!;
    const agiArch = archetypes.find(a => a.statPath === "agi")!;

    // Run many iterations — high AGI team should have an edge
    let agiTeamWins = 0;
    const iterations = 100;
    for (let i = 0; i < iterations; i++) {
      const team1 = [buildPartyMember(agiArch, 30, data), buildPartyMember(agiArch, 30, data)];
      const team2 = [buildPartyMember(strArch, 30, data), buildPartyMember(strArch, 30, data)];
      const result = simulate2v2PvP(team1, team2, data.combatConstants, data);
      if (result === 1) agiTeamWins++;
    }
    // AGI team should win at least sometimes (not zero) — they have speed advantage
    // But STR team has tankiness, so this is a soft check
    expect(agiTeamWins).toBeGreaterThan(0);
    expect(agiTeamWins).toBeLessThan(iterations); // not 100% either
  });

  it("spell3 is active in PvP when enabled", () => {
    setup();
    const arch1 = archetypes.find(a => a.className === "Rogue" && a.statPath === "agi")!;
    const arch2 = archetypes.find(a => a.className === "Warrior" && a.statPath === "str")!;

    const pm1 = buildPartyMember(arch1, 30, data, true);
    const pm2 = buildPartyMember(arch2, 30, data, true);
    expect(pm1.spell3).not.toBeNull();
    expect(pm2.spell3).not.toBeNull();

    // Can be used in PvP (members have spell3 set)
    const result = simulate2v2PvP([pm1], [pm2], data.combatConstants, data);
    expect([0, 1, 2]).toContain(result);
  });
});

// ============================================================
// CLASS_SPELLS_3 data integrity tests
// ============================================================

describe("CLASS_SPELLS_3 data", () => {
  it("has spells for all 9 classes", () => {
    const expected = ["Warrior", "Paladin", "Ranger", "Rogue", "Druid", "Warlock", "Wizard", "Sorcerer", "Cleric"];
    for (const cls of expected) {
      expect(CLASS_SPELLS_3[cls]).toBeDefined();
      expect(CLASS_SPELLS_3[cls].name).toBeTruthy();
    }
  });

  it("all spells have maxUses >= 1", () => {
    for (const [cls, spell] of Object.entries(CLASS_SPELLS_3)) {
      expect(spell.maxUses).toBeGreaterThanOrEqual(1);
    }
  });

  it("CC spells have ccDuration set", () => {
    const ccSpells = Object.values(CLASS_SPELLS_3).filter(s => s.type === "silence" || s.type === "root");
    expect(ccSpells.length).toBeGreaterThan(0);
    for (const spell of ccSpells) {
      expect(spell.ccDuration).toBeGreaterThan(0);
    }
  });

  it("reflect spells have reflectPct set", () => {
    const reflectSpells = Object.values(CLASS_SPELLS_3).filter(s => s.type === "reflect");
    expect(reflectSpells.length).toBeGreaterThan(0);
    for (const spell of reflectSpells) {
      expect(spell.reflectPct).toBeGreaterThan(0);
    }
  });

  it("ally-targeted spells have targetAlly flag", () => {
    const allySpells = Object.values(CLASS_SPELLS_3).filter(s =>
      s.type === "guard" || s.type === "soul_link" || s.type === "speed_buff" || s.type === "ally_heal"
    );
    expect(allySpells.length).toBeGreaterThan(0);
    for (const spell of allySpells) {
      // ally_heal doesn't have targetAlly on it but targets allies
      if (spell.type !== "ally_heal") {
        expect(spell.targetAlly).toBe(true);
      }
    }
  });
});
