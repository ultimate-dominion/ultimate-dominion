import { Address, Hash } from 'viem';

export enum AttackType {
  Temporary,
  PhysicalDamage,
  MagicDamage,
  StatusEffect,
}

export enum EncounterType {
  PvP,
  PvE,
  World,
}

export enum ItemFilterOptions {
  All = 'All',
  Armor = 'Armor',
  Consumable = 'Consumable',
  Spell = 'Spell',
  Weapon = 'Weapon',
}

export enum ItemType {
  Weapon,
  Armor,
  Spell,
  Consumable,
  QuestItem,
}

export enum MarketplaceFilter {
  ForSale = 'For Sale',
  GoldOffers = '$GOLD Offers',
  MyListings = 'My Listings',
}

export enum MobType {
  Monster,
  NPC,
  Shop,
}

export enum OrderStatus {
  Canceled,
  Active,
  Fulfilled,
}

export enum OrderType {
  None = 'none',
  Buying = 'buying',
  Selling = 'selling',
}

export enum StatsClasses {
  Strength,
  Agility,
  Intelligence,
}

/** Derive dominant stat class from actual stats (used pre-L10 before advanced class selection). */
export function getDominantStatClass(
  strength: bigint | number,
  agility: bigint | number,
  intelligence: bigint | number,
): StatsClasses {
  const s = Number(strength);
  const a = Number(agility);
  const i = Number(intelligence);
  if (i >= s && i >= a) return StatsClasses.Intelligence;
  if (a >= s) return StatsClasses.Agility;
  return StatsClasses.Strength;
}

// Implicit Class System enums
export enum Race {
  None,
  Human,
  Elf,
  Dwarf,
}

export enum PowerSource {
  None,
  Divine,
  Weave,
  Physical,
}

export enum ArmorType {
  None,
  Cloth,
  Leather,
  Plate,
}

export enum AdvancedClass {
  None,
  Paladin,   // STR + Divine
  Sorcerer,  // STR + Weave
  Warrior,   // STR + Physical
  Druid,     // AGI + Divine
  Warlock,   // AGI + Weave
  Ranger,    // AGI + Physical
  Cleric,    // INT + Divine
  Wizard,    // INT + Weave
  Rogue,     // INT + Physical
}

export enum Rarity {
  Worn = 0,
  Common = 1,
  Uncommon = 2,
  Rare = 3,
  Epic = 4,
  Legendary = 5,
}

export const RARITY_COLORS: Record<Rarity, string> = {
  [Rarity.Worn]: '#8a8a8a',      // Muted gray
  [Rarity.Common]: '#C4B89E',    // Parchment (legible on dark bg)
  [Rarity.Uncommon]: '#3d8a4e',  // Forest green
  [Rarity.Rare]: '#3d6fb5',      // Steel blue
  [Rarity.Epic]: '#7b4ab5',      // Dusty purple
  [Rarity.Legendary]: '#c47a2a', // Aged gold/amber
};

export const RARITY_NAMES: Record<Rarity, string> = {
  [Rarity.Worn]: 'Worn',
  [Rarity.Common]: 'Common',
  [Rarity.Uncommon]: 'Uncommon',
  [Rarity.Rare]: 'Rare',
  [Rarity.Epic]: 'Epic',
  [Rarity.Legendary]: 'Legendary',
};

export const CLASS_COLORS: Record<StatsClasses, string> = {
  [StatsClasses.Strength]: '#B85C3A',     // warm copper
  [StatsClasses.Agility]: '#5A8A3E',      // forest green
  [StatsClasses.Intelligence]: '#4A7AB5', // steel blue
};

export const ADVANCED_CLASS_NAMES: Record<AdvancedClass, string> = {
  [AdvancedClass.None]: '',
  [AdvancedClass.Paladin]: 'Paladin',
  [AdvancedClass.Sorcerer]: 'Sorcerer',
  [AdvancedClass.Warrior]: 'Warrior',
  [AdvancedClass.Druid]: 'Druid',
  [AdvancedClass.Warlock]: 'Warlock',
  [AdvancedClass.Ranger]: 'Ranger',
  [AdvancedClass.Cleric]: 'Cleric',
  [AdvancedClass.Wizard]: 'Wizard',
  [AdvancedClass.Rogue]: 'Rogue',
};

export const ADVANCED_CLASS_COLORS: Record<AdvancedClass, string> = {
  [AdvancedClass.None]: '#8A7E6A',
  [AdvancedClass.Paladin]: '#D4A54A',    // gold
  [AdvancedClass.Sorcerer]: '#C8872A',   // amber
  [AdvancedClass.Warrior]: '#B85C3A',    // copper
  [AdvancedClass.Druid]: '#5A8A3E',      // green
  [AdvancedClass.Warlock]: '#7B4AB5',    // purple
  [AdvancedClass.Ranger]: '#3A9A8A',     // teal
  [AdvancedClass.Cleric]: '#C4B89E',     // parchment
  [AdvancedClass.Wizard]: '#4A7AB5',     // blue
  [AdvancedClass.Rogue]: '#6A6A6A',      // shadow-grey
};

export enum SystemToAllow {
  LootManager = 'LootManager',
  Marketplace = 'Marketplace',
  Shop = 'Shop',
}

export enum TokenType {
  NATIVE,
  ERC20,
  ERC721,
  ERC1155,
}

export type Armor = ArmorTemplate & {
  balance: bigint;
  itemId: string;
  owner: string;
};

export type ArmorStats = {
  agiModifier: bigint;
  armorModifier: bigint;
  hpModifier: bigint;
  intModifier: bigint;
  minLevel: bigint;
  strModifier: bigint;
};

export type ArmorTemplate = ArmorStats &
  Metadata & {
    itemType: ItemType;
    price: bigint;
    rarity?: Rarity;
    statRestrictions: StatRestrictions;
    tokenId: string;
  };

export type AttackOutcomeType = {
  attackerDamageDelt: bigint;
  attackerDied: boolean;
  attackerId: string;
  attackNumber: bigint;
  blocked: boolean;
  blockNumber: bigint;
  crit: boolean[];
  currentTurn: bigint;
  damagePerHit: bigint[];
  defenderDamageDelt: bigint;
  defenderDied: boolean;
  defenderId: string;
  doubleStrike: boolean;
  effectIds: string[];
  encounterId: string;
  hit: boolean[];
  itemId: string;
  miss: boolean[];
  spellDodged: boolean;
  timestamp: bigint;
};

export type Character = CharacterData & EntityStats & Metadata;

export type CharacterData = {
  baseStats: EntityStats;
  externalGoldBalance: bigint;
  id: string;
  inBattle: boolean;
  isSpawned: boolean;
  locked: boolean;
  owner: string;
  position: { x: number; y: number };
  pvpCooldownTimer: bigint;
  tokenId: string;
  worldEncounter?: WorldEncounter;
  worldStatusEffects: WorldStatusEffect[];
};

export type CombatOutcomeType = {
  attackers: string[];
  defenders: string[];
  encounterId: string;
  endTime: bigint;
  expDropped: bigint;
  goldDropped: bigint;
  itemsDropped: string[];
  playerFled: boolean;
  winner: string;
};

export type ConsiderationData = {
  amount: bigint;
  identifier: string;
  recipient: string;
  token: string;
  tokenType: TokenType;
};

export type Consumable = ConsumableTemplate & {
  balance: bigint;
  itemId: string;
  owner: string;
};

export type ConsumableStats = {
  agiModifier: bigint;
  effects: string[];
  hpModifier: bigint;
  hpRestoreAmount: bigint;
  intModifier: bigint;
  minLevel: bigint;
  strModifier: bigint;
};

export type ConsumableTemplate = ConsumableStats &
  ConsumableValidity &
  Metadata & {
    itemType: ItemType;
    price: bigint;
    rarity?: Rarity;
    statRestrictions: StatRestrictions;
    tokenId: string;
  };

export type ConsumableValidity = {
  cooldown: bigint;
  maxStacks: bigint;
  validTime: bigint;
  validTurns: bigint;
};

export type EntityStats = {
  agility: bigint;
  currentHp: bigint;
  entityClass: StatsClasses;
  experience: bigint;
  intelligence: bigint;
  level: bigint;
  maxHp: bigint;
  strength: bigint;
  // Implicit class system fields
  race: Race;
  powerSource: PowerSource;
  startingArmor: ArmorType;
  advancedClass: AdvancedClass;
  hasSelectedAdvancedClass: boolean;
};

export type CombatDetails = {
  attackers: string[];
  currentTurn: bigint;
  currentTurnTimer: bigint;
  defenders: string[];
  encounterId: string;
  encounterType: EncounterType;
  end: bigint;
  maxTurns: bigint;
  start: bigint;
};

export type Metadata = {
  description: string;
  image: string;
  name: string;
};

export type QuestItemTemplate = Metadata & {
  itemType: ItemType;
  tokenId: string;
  rarity?: Rarity;
};

export type Monster = MonsterTemplate & {
  currentHp: bigint;
  id: string;
  inBattle: boolean;
  isElite: boolean;
  isSpawned: boolean;
  maxHp: bigint;
  position: { x: number; y: number };
};

export type MonsterStats = {
  agility: bigint;
  armor: bigint;
  entityClass: StatsClasses;
  experience: bigint;
  hasBossAI: boolean;
  hitPoints: bigint;
  intelligence: bigint;
  inventory: string[];
  level: bigint;
  strength: bigint;
};

export type MonsterTemplate = MonsterStats &
  Metadata & {
    mobId: string;
  };

export type NewConsideration = {
  amount: bigint;
  identifier: bigint;
  recipient: Address;
  token: Address;
  tokenType: TokenType;
};

export type NewOffer = {
  amount: bigint;
  identifier: bigint;
  token: Address;
  tokenType: TokenType;
};

export type NewOrder = {
  consideration: NewConsideration;
  offer: NewOffer;
  offerer: Address;
  signature: Hash;
};

export type OfferData = {
  amount: bigint;
  identifier: string;
  token: string;
  tokenType: TokenType;
};

export type Order = {
  orderHash: string;
  orderStatus: string;
  offer: OfferData;
  offerer: string;
  consideration: ConsiderationData;
};

export type Shop = {
  buyableItems: string[];
  gold: bigint;
  maxGold: bigint;
  name: string;
  position: { x: number; y: number };
  priceMarkdown: bigint;
  priceMarkup: bigint;
  sellableItems: string[];
  shopId: string;
  stock: bigint[];
};

export type NpcInteraction = 'respec' | 'guild' | 'dialogue' | 'examine';

export type Npc = {
  entityId: string;
  mobId: string;
  name: string;
  interaction: NpcInteraction;
  position: { x: number; y: number };
  metadataUri: string;
};

export type Spell = SpellTemplate & {
  balance: bigint;
  itemId: string;
  owner: string;
};

export type SpellStats = {
  effects: string[];
  itemId: string;
  maxDamage: bigint;
  minDamage: bigint;
  minLevel: bigint;
};

export type SpellTemplate = SpellStats &
  Metadata & {
    itemType: ItemType;
    price: bigint;
    rarity?: Rarity;
    statRestrictions: StatRestrictions;
    tokenId: string;
  };

export type StatRestrictions = {
  minAgility: bigint;
  minIntelligence: bigint;
  minStrength: bigint;
};

export type DotAction = {
  encounterId: string;
  turnNumber: bigint;
  entityId: string;
  totalDamage: bigint;
  individualDamages: bigint[];
};

export type StatusAction = {
  active: boolean;
  effectId: string;
  name: string;
  turnStart: string;
  validTurns: string;
  victimId: string;
};

export type Weapon = WeaponTemplate & {
  balance: bigint;
  itemId: string;
  owner: string;
};

export type WeaponStats = {
  agiModifier: bigint;
  effects: string[];
  hpModifier: bigint;
  intModifier: bigint;
  maxDamage: bigint;
  minDamage: bigint;
  minLevel: bigint;
  strModifier: bigint;
};

export type WeaponTemplate = WeaponStats &
  Metadata & {
    itemType: ItemType;
    price: bigint;
    rarity?: Rarity;
    statRestrictions: StatRestrictions;
    tokenId: string;
  };

export type WorldEncounter = {
  characterId: string;
  encounterId: string;
  shopId: string;
};

export type WorldStatusEffect = {
  agiModifier: bigint;
  active: boolean;
  effectId: string;
  intModifier: bigint;
  maxStacks: bigint;
  name: string;
  strModifier: bigint;
  timestampEnd: bigint;
  timestampStart: bigint;
};
