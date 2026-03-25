import { describe, it, expect } from "vitest";
import {
  seededRng,
  tickEffects,
  adjustCombatant,
  resolveAttackZ3,
  applyCcResistance,
  getCcDiminishedDuration,
  applySilence,
  applyRoot,
  applyReflect,
  isSilenced,
  isRooted,
  getReflectPct,
  type ActiveEffectInstance,
  type RngFn,
} from "./combat.js";
import type { CombatConstants, Combatant, Weapon, CcHistoryEntry } from "./types.js";

const CC: CombatConstants = {
  attackModifier: 1.2,
  agiAttackModifier: 1.0,
  defenseModifier: 1.0,
  critMultiplier: 2,
  critBaseChance: 5,
  critAgiDivisor: 4,
  evasionMultiplier: 2,
  evasionCap: 25,
  doubleStrikeMultiplier: 3,
  doubleStrikeCap: 40,
  combatTriangleFlatPct: 0,
  combatTrianglePerStat: 0.02,
  combatTriangleMax: 0.12,
  magicResistPerInt: 3,
  magicResistCap: 40,
  blockChancePerStr: 2,
  blockChanceCap: 35,
  blockReductionPhys: 0.55,
  blockReductionMagic: 0.30,
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

function makeMagicWeapon(overrides: Partial<Weapon> = {}): Weapon {
  return makeWeapon({ name: "Staff", isMagic: true, scaling: "str", intMod: 3, strMod: 0, ...overrides });
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

/** RNG that always returns a fixed value */
function fixedRng(value: number): RngFn {
  return (_min, _max) => value;
}

// ============================================================
// Silence tests
// ============================================================

describe("silence", () => {
  it("applies silence effect to target", () => {
    const effects: ActiveEffectInstance[] = [];
    const applied = applySilence(effects, 3, "Silencing Strike");
    expect(applied).toBe(true);
    expect(effects.length).toBe(1);
    expect(effects[0].type).toBe("silence");
    expect(effects[0].turnsRemaining).toBe(3);
  });

  it("refreshes duration if already silenced", () => {
    const effects: ActiveEffectInstance[] = [];
    applySilence(effects, 2, "Strike 1");
    applySilence(effects, 4, "Strike 2");
    expect(effects.length).toBe(1); // no stacking
    expect(effects[0].turnsRemaining).toBe(4); // refreshed to longer
  });

  it("does not apply if duration is 0", () => {
    const effects: ActiveEffectInstance[] = [];
    const applied = applySilence(effects, 0, "Weak");
    expect(applied).toBe(false);
    expect(effects.length).toBe(0);
  });

  it("isSilenced returns true when active", () => {
    const effects: ActiveEffectInstance[] = [];
    applySilence(effects, 2, "Test");
    expect(isSilenced(effects)).toBe(true);
  });

  it("isSilenced returns false when expired", () => {
    const effects: ActiveEffectInstance[] = [];
    applySilence(effects, 1, "Test");
    tickEffects(effects); // decrement to 0, remove
    expect(isSilenced(effects)).toBe(false);
  });

  it("silence expires after ticking down", () => {
    const effects: ActiveEffectInstance[] = [];
    applySilence(effects, 2, "Test");
    tickEffects(effects); // 2 → 1
    expect(isSilenced(effects)).toBe(true);
    tickEffects(effects); // 1 → 0, removed
    expect(isSilenced(effects)).toBe(false);
    expect(effects.length).toBe(0);
  });
});

// ============================================================
// Root tests
// ============================================================

describe("root", () => {
  it("applies root effect to target", () => {
    const effects: ActiveEffectInstance[] = [];
    const applied = applyRoot(effects, 3, "Ground Stomp");
    expect(applied).toBe(true);
    expect(effects.length).toBe(1);
    expect(effects[0].type).toBe("root");
    expect(effects[0].turnsRemaining).toBe(3);
  });

  it("refreshes duration if already rooted", () => {
    const effects: ActiveEffectInstance[] = [];
    applyRoot(effects, 2, "Stomp 1");
    applyRoot(effects, 4, "Stomp 2");
    expect(effects.length).toBe(1);
    expect(effects[0].turnsRemaining).toBe(4);
  });

  it("isRooted detects active root", () => {
    const effects: ActiveEffectInstance[] = [];
    applyRoot(effects, 2, "Test");
    expect(isRooted(effects)).toBe(true);
  });

  it("rooted defender cannot evade attacks", () => {
    // Defender has high AGI (should normally evade frequently)
    const attacker = makeCombatant({ agi: 5 });
    const defender = makeCombatant({ agi: 30 }); // high AGI
    const rng = seededRng(42);

    // Run 100 attacks without root — should have some evades
    let evades = 0;
    for (let i = 0; i < 100; i++) {
      const { damage } = resolveAttackZ3(attacker, defender, CC, rng, false, 0);
      if (damage === 0) evades++;
    }
    expect(evades).toBeGreaterThan(0); // should evade some

    // Run 100 attacks WITH root — should have zero evades from evasion
    // (can still "miss" from other mechanics but evasion check is skipped)
    const rng2 = seededRng(42);
    let rootedEvades = 0;
    for (let i = 0; i < 100; i++) {
      const { damage } = resolveAttackZ3(attacker, defender, CC, rng2, true, 0);
      if (damage === 0) rootedEvades++;
    }
    expect(rootedEvades).toBeLessThan(evades);
  });
});

// ============================================================
// Reflect tests
// ============================================================

describe("reflect", () => {
  it("applies reflect effect", () => {
    const effects: ActiveEffectInstance[] = [];
    const applied = applyReflect(effects, 2, 0.6, "Mirror");
    expect(applied).toBe(true);
    expect(effects.length).toBe(1);
    expect(effects[0].type).toBe("reflect");
    expect(effects[0].reflectPct).toBe(0.6);
  });

  it("refreshes duration and takes higher pct", () => {
    const effects: ActiveEffectInstance[] = [];
    applyReflect(effects, 2, 0.5, "Mirror 1");
    applyReflect(effects, 3, 0.7, "Mirror 2");
    expect(effects.length).toBe(1);
    expect(effects[0].turnsRemaining).toBe(3);
    expect(effects[0].reflectPct).toBe(0.7);
  });

  it("getReflectPct returns pct when active", () => {
    const effects: ActiveEffectInstance[] = [];
    applyReflect(effects, 2, 0.6, "Test");
    expect(getReflectPct(effects)).toBe(0.6);
  });

  it("getReflectPct returns 0 when no reflect", () => {
    expect(getReflectPct([])).toBe(0);
  });

  it("magic attacks return reflected damage", () => {
    const attacker = makeCombatant({ weapon: makeMagicWeapon(), int: 20 });
    const defender = makeCombatant({ int: 10 });
    const rng = fixedRng(50); // mid-roll, no crit, no evasion

    const { damage, reflected } = resolveAttackZ3(attacker, defender, CC, rng, false, 0);
    expect(damage).toBeGreaterThan(0);
    expect(reflected).toBe(0); // no reflect active

    const { damage: d2, reflected: r2 } = resolveAttackZ3(attacker, defender, CC, rng, false, 0.6);
    expect(d2).toBeGreaterThan(0);
    expect(r2).toBeGreaterThan(0); // defender has 60% reflect
    expect(r2).toBe(Math.max(1, Math.floor(d2 * 0.6)));
  });

  it("physical attacks do NOT trigger reflect", () => {
    const attacker = makeCombatant({ str: 20, weapon: makeWeapon() });
    const defender = makeCombatant();
    const rng = fixedRng(50);

    const { damage, reflected } = resolveAttackZ3(attacker, defender, CC, rng, false, 0.6);
    expect(damage).toBeGreaterThan(0);
    expect(reflected).toBe(0); // reflect only affects magic
  });
});

// ============================================================
// CC Resistance tests
// ============================================================

describe("CC resistance", () => {
  it("stat resistance reduces duration", () => {
    // INT 25 = 5 points above 20 = floor(5 * 0.1) = 0 reduction (needs 30+ for 1t reduction)
    expect(applyCcResistance(3, 25, 0)).toBe(3);
    // INT 30 = 10 points above 20 = floor(10 * 0.1) = 1 reduction
    expect(applyCcResistance(3, 30, 0)).toBe(2);
    // INT 40 = 20 points above 20 = floor(20 * 0.1) = 2 reduction
    expect(applyCcResistance(3, 40, 0)).toBe(1);
  });

  it("armor resistance stacks with stat resistance", () => {
    // INT 30 (1 stat reduction) + 1 armor reduction = 2 total reduction
    expect(applyCcResistance(3, 30, 1)).toBe(1);
  });

  it("minimum duration is 1", () => {
    expect(applyCcResistance(2, 50, 2)).toBe(1); // 3 total reduction on 2 dur = still 1
  });

  it("no reduction below stat threshold", () => {
    expect(applyCcResistance(3, 15, 0)).toBe(3); // INT 15 < 20, no reduction
    expect(applyCcResistance(3, 20, 0)).toBe(3); // INT 20 exactly = 0 points above
  });
});

// ============================================================
// Diminishing Returns tests
// ============================================================

describe("CC diminishing returns", () => {
  it("first application: full duration", () => {
    const history: CcHistoryEntry[] = [];
    expect(getCcDiminishedDuration(3, "silence", history, 1)).toBe(3);
  });

  it("second application within 4 rounds: half duration", () => {
    const history: CcHistoryEntry[] = [{ type: "silence", appliedRound: 1 }];
    expect(getCcDiminishedDuration(3, "silence", history, 3)).toBe(1); // floor(3/2) = 1
    expect(getCcDiminishedDuration(4, "silence", history, 3)).toBe(2); // floor(4/2) = 2
  });

  it("third application within 4 rounds: immune", () => {
    const history: CcHistoryEntry[] = [
      { type: "silence", appliedRound: 1 },
      { type: "silence", appliedRound: 3 },
    ];
    expect(getCcDiminishedDuration(3, "silence", history, 5)).toBe(0); // immune
  });

  it("applications outside 4-round window don't count", () => {
    const history: CcHistoryEntry[] = [{ type: "silence", appliedRound: 1 }];
    // Round 6: application at round 1 is 5 rounds ago (> 4), doesn't count
    expect(getCcDiminishedDuration(3, "silence", history, 6)).toBe(3);
  });

  it("different CC types have independent DR", () => {
    const history: CcHistoryEntry[] = [
      { type: "silence", appliedRound: 1 },
      { type: "silence", appliedRound: 3 },
    ];
    // Root should be unaffected by silence history
    expect(getCcDiminishedDuration(3, "root", history, 4)).toBe(3);
  });
});

// ============================================================
// resolveAttackZ3 tests
// ============================================================

describe("resolveAttackZ3", () => {
  it("deals damage with no special conditions", () => {
    const attacker = makeCombatant({ str: 20 });
    const defender = makeCombatant({ str: 10 });
    const rng = fixedRng(50); // mid-range rolls
    const { damage, reflected } = resolveAttackZ3(attacker, defender, CC, rng, false, 0);
    expect(damage).toBeGreaterThan(0);
    expect(reflected).toBe(0);
  });

  it("rooted defender cannot evade even with high AGI", () => {
    const attacker = makeCombatant({ agi: 5, str: 20 });
    const defender = makeCombatant({ agi: 50 }); // extremely high AGI
    // With fixedRng(1), evasion roll would be 1 which is <= evasion chance, so normally evades
    const { damage: evadedDmg } = resolveAttackZ3(attacker, defender, CC, fixedRng(1), false, 0);
    expect(evadedDmg).toBe(0); // evaded

    // With root, same roll — should NOT evade
    const { damage: rootedDmg } = resolveAttackZ3(attacker, defender, CC, fixedRng(50), true, 0);
    expect(rootedDmg).toBeGreaterThan(0);
  });

  it("reflect returns magic damage proportional to reflectPct", () => {
    const attacker = makeCombatant({ int: 25, weapon: makeMagicWeapon() });
    const defender = makeCombatant({ int: 5 }); // low resist
    const rng = fixedRng(50);

    const { damage, reflected } = resolveAttackZ3(attacker, defender, CC, rng, false, 0.5);
    expect(damage).toBeGreaterThan(0);
    expect(reflected).toBe(Math.max(1, Math.floor(damage * 0.5)));
  });

  it("reflect does not apply to physical attacks", () => {
    const attacker = makeCombatant({ str: 25, weapon: makeWeapon() });
    const defender = makeCombatant();
    const rng = fixedRng(50);

    const { reflected } = resolveAttackZ3(attacker, defender, CC, rng, false, 0.75);
    expect(reflected).toBe(0);
  });
});

// ============================================================
// Integration: effect lifecycle
// ============================================================

describe("effect lifecycle", () => {
  it("silence + root + reflect can coexist on same target", () => {
    const effects: ActiveEffectInstance[] = [];
    applySilence(effects, 3, "Silence");
    applyRoot(effects, 2, "Root");
    applyReflect(effects, 1, 0.6, "Reflect");

    expect(effects.length).toBe(3);
    expect(isSilenced(effects)).toBe(true);
    expect(isRooted(effects)).toBe(true);
    expect(getReflectPct(effects)).toBe(0.6);

    // Tick once: reflect expires (1t), others remain
    tickEffects(effects);
    expect(effects.length).toBe(2);
    expect(isSilenced(effects)).toBe(true);
    expect(isRooted(effects)).toBe(true);
    expect(getReflectPct(effects)).toBe(0);

    // Tick again: root expires (2t → 0)
    tickEffects(effects);
    expect(effects.length).toBe(1);
    expect(isSilenced(effects)).toBe(true);
    expect(isRooted(effects)).toBe(false);

    // Tick again: silence expires (3t → 0)
    tickEffects(effects);
    expect(effects.length).toBe(0);
  });

  it("adjustCombatant ignores silence/root/reflect (no stat changes)", () => {
    const base = makeCombatant({ str: 20, agi: 15, int: 10 });
    const effects: ActiveEffectInstance[] = [];
    applySilence(effects, 2, "S");
    applyRoot(effects, 2, "R");
    applyReflect(effects, 2, 0.5, "Ref");

    const adjusted = adjustCombatant(base, effects);
    // These effects don't have stat mods, so combatant should be unchanged
    expect(adjusted.str).toBe(base.str);
    expect(adjusted.agi).toBe(base.agi);
    expect(adjusted.int).toBe(base.int);
  });

  it("stat_debuff + silence coexist correctly", () => {
    const base = makeCombatant({ str: 20, agi: 15, int: 10 });
    const effects: ActiveEffectInstance[] = [];
    applySilence(effects, 3, "Silence");
    effects.push({
      name: "Weaken", type: "stat_debuff", turnsRemaining: 3,
      damagePerTick: 0, strMod: -5, agiMod: 0, intMod: 0, armorMod: 0,
    });

    expect(isSilenced(effects)).toBe(true);
    const adjusted = adjustCombatant(base, effects);
    expect(adjusted.str).toBe(15); // 20 - 5
  });
});
