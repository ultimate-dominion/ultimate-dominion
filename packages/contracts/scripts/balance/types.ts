/**
 * Shared types for the balance simulation.
 * Used by loader, overrides, and the sim engine.
 */

export interface Race {
  name: string;
  str: number;
  agi: number;
  int: number;
  hp: number;
}

export interface StartingArmor {
  name: string;
  str: number;
  agi: number;
  int: number;
  hp: number;
}

export interface PowerSource {
  name: string;
  type: "divine" | "weave" | "physical";
}

export interface AdvancedClass {
  name: string;
  flatStr: number;
  flatAgi: number;
  flatInt: number;
  flatHp: number;
  physMult: number;
  spellMult: number;
  healMult: number;
  critMult: number;
  hpMult: number;
}

export interface Weapon {
  name: string;
  minDamage: number;
  maxDamage: number;
  strMod: number;
  agiMod: number;
  intMod: number;
  hpMod: number;
  scaling: "str" | "agi";
  isMagic: boolean;
  minStr: number;
  minAgi: number;
  minInt: number;
  minHp?: number;       // HP gate for divine builds
  rarity: number;
  price: number;
  partyAura?: PartyAura; // passive party buff when equipped
}

export interface Monster {
  name: string;
  level: number;
  str: number;
  agi: number;
  int: number;
  hp: number;
  armor: number;
  classType: number; // 0=warrior, 1=rogue, 2=mage
  xp: number;
  weaponMinDmg: number;
  weaponMaxDmg: number;
  weaponScaling: "str" | "agi";
  weaponIsMagic: boolean;
  isElite?: boolean;        // multiplayer-designed mob
  partyHpScale?: number;    // HP multiplier per extra party member (e.g. 0.8 = +80% HP per ally)
  phases?: MonsterPhase[];  // phase transitions at HP thresholds
  cleave?: boolean;         // hits random second target in party
}

export interface Armor {
  name: string;
  armorValue: number;
  strMod: number;
  agiMod: number;
  intMod: number;
  hpMod: number;
  minStr: number;
  minAgi: number;
  minInt: number;
  minHp?: number;         // HP gate for divine builds
  armorType: "Plate" | "Leather" | "Cloth";
  rarity: number;
  price: number;
  partyAura?: PartyAura;  // passive party buff when equipped
  ccResist?: CcResistance; // reduces incoming CC duration
}

export interface ClassSpell {
  name: string;
  type: "self_buff" | "debuff" | "magic_damage" | "damage_debuff" | "damage_buff" | "weapon_enchant"
    | "silence" | "root" | "reflect" | "guard" | "party_buff" | "ally_heal" | "speed_buff" | "soul_link";
  strPct?: number;
  agiPct?: number;
  intPct?: number;
  armorMod?: number;
  hpPct?: number;
  duration?: number;
  baseDmgMin?: number;
  baseDmgMax?: number;
  dmgPerInt?: number;
  dmgPerStr?: number;
  dmgPerAgi?: number;
  maxUses?: number;        // how many times per fight (default 1)
  // Multiplayer spell fields
  ccDuration?: number;     // silence/root duration (before resistance)
  reflectPct?: number;     // reflect: % of magic damage returned
  guardDmgPct?: number;    // guard: % of damage taken by guardian (0.6 = 60%)
  targetAlly?: boolean;    // true = targets ally, false = targets enemy
  partyWide?: boolean;     // true = affects all allies
  silenceImmune?: boolean; // caster is immune to silence while active
}

export interface WeaponEffect {
  type: "dot" | "stat_debuff" | "dual_magic" | "magic_breath" | "silence" | "root" | "reflect";
  name: string;
  damagePerTick?: number;
  maxStacks?: number;
  duration?: number;
  cooldown?: number;
  strMod?: number;
  agiMod?: number;
  intMod?: number;
  armorMod?: number;
  minDmg?: number;
  maxDmg?: number;
  reflectPct?: number;  // for reflect effects: % of magic damage returned
}

export interface Consumable {
  name: string;
  type: "pre_buff" | "heal" | "debuff" | "tradeoff_buff" | "cleanse";
  strMod?: number;
  agiMod?: number;
  intMod?: number;
  armorMod?: number;
  healAmount?: number;
  effect?: {
    strMod: number;
    agiMod: number;
    intMod: number;
    armorMod: number;
    damagePerTick: number;
    duration: number;
    maxStacks: number;
    cooldown: number;
  };
  rarity: number;
  price: number;
}

export interface Archetype {
  id: string;
  name: string;
  className: string;
  advClass: AdvancedClass;
  race: Race;
  startingArmor: StartingArmor;
  powerSource: PowerSource;
  statPath: "str" | "agi" | "int";
  baseRoll: { str: number; agi: number; int: number };
}

export interface StatProfile {
  str: number;
  agi: number;
  int: number;
  hp: number;
  totalStats: number;
  primaryStat: number;
  dominantType: string;
}

export interface Combatant {
  str: number;
  agi: number;
  int: number;
  hp: number;
  maxHp: number;
  armor: number;
  weapon: Weapon;
  physMult: number;
  spellMult: number;
  critMult: number;
  hpMult: number;
  dominantType: string;
  dominantStat: number;
  className: string;
}

export interface CombatResult {
  attackerWins: number;
  defenderWins: number;
  avgRounds: number;
  avgDamagePerRound: number;
  winRate: number;
  iterations: number;
}

export interface CombatConstants {
  attackModifier: number;
  agiAttackModifier: number;
  defenseModifier: number;
  critMultiplier: number;
  critBaseChance: number;
  critAgiDivisor: number;
  evasionMultiplier: number;
  evasionCap: number;
  doubleStrikeMultiplier: number;
  doubleStrikeCap: number;
  combatTriangleFlatPct: number;
  combatTrianglePerStat: number;
  combatTriangleMax: number;
  magicResistPerInt: number;
  magicResistCap: number;
  blockChancePerStr: number;
  blockChanceCap: number;
  blockReductionPhys: number;
  blockReductionMagic: number;
  hitStartingProbability: number;
  hitAttackerDampener: number;
  hitDefenderDampener: number;
  hitMin: number;
  hitMax: number;
  spellDodgeThreshold: number;
  spellDodgePctPerAgi: number;
  spellDodgeCap: number;
  classMultiplierBase: number;
}

export interface LevelingConstants {
  baseHp: number;
  earlyGameCap: number;
  midGameCap: number;
  statPointsEarly: number;
  statPointsMid: number;
  statPointsLate: number;
  hpGainEarly: number;
  hpGainMid: number;
  hpGainLate: number;
  powerSourceBonusLevel: number;
}

export interface ArchetypeConfig {
  name: string;
  class: string;
  race: string;
  armor: string;
  power: string;
  path: "str" | "agi" | "int";
}

/** All game data needed by the sim */
export interface GameData {
  weapons: Weapon[];
  armors: Armor[];
  monsters: Monster[];
  consumables: Consumable[];
  weaponEffects: Record<string, WeaponEffect[]>;
  monsterWeaponEffects: Record<string, WeaponEffect[]>;
  combatConstants: CombatConstants;
  levelingConstants: LevelingConstants;
  races: Record<string, Race>;
  startingArmors: Record<string, StartingArmor>;
  powerSources: Record<string, PowerSource>;
  classes: Record<string, AdvancedClass>;
  baseRolls: Record<string, { str: number; agi: number; int: number }>;
  archetypeConfigs: Record<string, ArchetypeConfig>;
  classSpells: Record<string, ClassSpell>;
}

// ============================================================
// Z3 Multiplayer Types
// ============================================================

/** Passive party buff from equipped gear */
export interface PartyAura {
  armorMod?: number;   // +ARM to all party members
  dotReduction?: number; // reduce incoming DoT damage per tick for party
}

/** CC duration reduction from armor */
export interface CcResistance {
  silenceReduction?: number; // turns reduced from incoming silence
  rootReduction?: number;    // turns reduced from incoming root
}

/** Monster phase transition (at HP threshold) */
export interface MonsterPhase {
  hpPct: number;          // triggers when HP drops below this % (e.g. 0.66)
  addEffects?: string[];  // add these named effects to monster's arsenal
  enragePct?: number;     // damage multiplier increase (e.g. 0.3 = +30%)
  telegraphText?: string; // what the boss telegraphs before phase shift
}

/** Action choice for simultaneous lock-in combat */
export interface CombatAction {
  type: "attack" | "spell" | "heal" | "consumable" | "guard" | "defend";
  targetIndex: number;    // index into enemy party (for attack/spell) or ally party (for guard/heal)
  spellIndex?: number;    // which spell to cast (index into loadout spells)
  weaponIndex?: number;   // which weapon to use (0=primary, 1=secondary, 2=tertiary)
}

/** A combatant in a multi-party fight */
export interface PartyCombatant {
  combatant: Combatant;
  archetype: Archetype;
  loadout: CombatLoadoutRef;
  extraWeapons: Weapon[];
  hp: number;
  maxHp: number;
  effects: ActiveEffectRef[];  // forward reference — actual type in combat.ts
  spellTrackers: SpellTracker[];
  spellQueue: ClassSpell[];
  alive: boolean;
  silenced: boolean;       // can't cast spells this round
  rooted: boolean;         // evasion = 0, no double-strike
  reflecting: boolean;     // returning magic damage
  reflectPct: number;      // % of magic damage reflected
  guardTarget: number;     // index of ally being guarded (-1 = none)
  guardDmgPct: number;     // % of damage guardian absorbs
  ccHistory: CcHistoryEntry[]; // for diminishing returns
  threat: number;          // PvE: aggro accumulated
}

/** CC diminishing returns tracker */
export interface CcHistoryEntry {
  type: "silence" | "root";
  appliedRound: number;
}

/** Spell use tracker */
export interface SpellTracker {
  spell: ClassSpell;
  uses: number;
}

/** Reference type for loadout in multi-combat (mirrors CombatLoadout from sim) */
export interface CombatLoadoutRef {
  name: string;
  weaponCount: number;
  spells: ClassSpell[];
  consumables: any[];  // ConsumableSlot from sim
  goldCostPerFight: number;
}

/** Placeholder for ActiveEffectInstance forward reference */
export type ActiveEffectRef = any;

/** Result of a multi-combatant fight */
export interface MultiCombatResult {
  winningSide: "party" | "enemies" | "draw";
  rounds: number;
  partyHpRemaining: number[];   // remaining HP per party member
  totalDamageDealt: number;
  totalDamageTaken: number;
}

/** PvE elite boss telegraph */
export interface BossTelegraph {
  targetIndex: number;     // which party member the boss will target
  actionType: string;      // what the boss will do ("melee", "breath", "cleave", "silence")
}
