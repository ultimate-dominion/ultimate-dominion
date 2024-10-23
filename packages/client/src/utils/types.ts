import { Entity } from '@latticexyz/recs';
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
  Warrior,
  Rogue,
  Mage,
}

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
  itemId: Entity;
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
    statRestrictions: StatRestrictions;
    tokenId: string;
  };

export type AttackOutcomeType = {
  attackerDamageDelt: bigint;
  attackerDied: boolean;
  attackerId: string;
  attackNumber: bigint;
  blockNumber: bigint;
  crit: boolean[];
  currentTurn: bigint;
  damagePerHit: bigint[];
  defenderDamageDelt: bigint;
  defenderDied: boolean;
  defenderId: string;
  effectIds: string[];
  encounterId: string;
  hit: boolean[];
  itemId: string;
  miss: boolean[];
  timestamp: bigint;
};

export type Character = CharacterData & EntityStats & Metadata;

export type CharacterData = {
  baseStats: EntityStats;
  escrowGoldBalance: bigint;
  externalGoldBalance: bigint;
  id: Entity;
  inBattle: boolean;
  locked: boolean;
  owner: string;
  pvpCooldownTimer: bigint;
  tokenId: string;
  worldStatusEffects: WorldStatusEffect[];
};

export type CombatOutcomeType = {
  attackers: Entity[];
  defenders: Entity[];
  encounterId: Entity;
  endTime: bigint;
  expDropped: bigint;
  goldDropped: bigint;
  itemsDropped: string[];
  playerFled: boolean;
  winner: Entity;
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
  itemId: Entity;
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
};

export type CombatDetails = {
  attackers: Entity[];
  currentTurn: bigint;
  currentTurnTimer: bigint;
  defenders: Entity[];
  encounterId: Entity;
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

export type Monster = MonsterTemplate & {
  currentHp: bigint;
  id: Entity;
  inBattle: boolean;
  isSpawned: boolean;
  maxHp: bigint;
  position: { x: number; y: number };
};

export type MonsterStats = {
  agility: bigint;
  armor: bigint;
  entityClass: StatsClasses;
  experience: bigint;
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

export type Spell = SpellTemplate & {
  balance: bigint;
  itemId: Entity;
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
    statRestrictions: StatRestrictions;
    tokenId: string;
  };

export type StatRestrictions = {
  minAgility: bigint;
  minIntelligence: bigint;
  minStrength: bigint;
};

export type StatusAction = {
  active: boolean;
  effectId: Entity;
  name: string;
  turnStart: string;
  validTurns: string;
  victimId: Entity;
};

export type Weapon = WeaponTemplate & {
  balance: bigint;
  itemId: Entity;
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
    statRestrictions: StatRestrictions;
    tokenId: string;
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
