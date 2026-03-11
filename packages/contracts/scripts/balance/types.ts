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
  rarity: number;
  price: number;
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
  armorType: "Plate" | "Leather" | "Cloth";
  rarity: number;
  price: number;
}

export interface ClassSpell {
  name: string;
  type: "self_buff" | "debuff" | "magic_damage" | "damage_debuff" | "damage_buff";
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
}

export interface WeaponEffect {
  type: "dot" | "stat_debuff" | "dual_magic" | "magic_breath";
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
  evasionDivisor: number;
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
