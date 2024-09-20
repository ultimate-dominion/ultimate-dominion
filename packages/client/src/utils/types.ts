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
}

export enum TokenType {
  NATIVE,
  ERC20,
  ERC721,
  ERC1155,
}

export type Armor = ArmorTemplate & {
  balance: string;
  itemId: Entity;
  owner: string;
};

export type ArmorStats = {
  agiModifier: string;
  armorModifier: string;
  hpModifier: string;
  intModifier: string;
  minLevel: string;
  strModifier: string;
};

export type ArmorTemplate = ArmorStats &
  Metadata & {
    itemType: ItemType;
    statRestrictions: StatRestrictions;
    tokenId: string;
  };

export type AttackOutcomeType = {
  attackerDamageDelt: string;
  attackerDied: boolean;
  attackerId: string;
  attackNumber: string;
  blockNumber: string;
  crit: boolean[];
  currentTurn: string;
  effectIds: string[];
  encounterId: string;
  damagePerHit: string[];
  defenderDamageDelt: string;
  defenderDied: boolean;
  defenderId: string;
  hit: boolean[];
  itemId: string;
  miss: boolean[];
  timestamp: string;
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
  tokenId: string;
};

export type CombatOutcomeType = {
  attackers: Entity[];
  defenders: Entity[];
  encounterId: Entity;
  endTime: string;
  expDropped: string;
  goldDropped: string;
  itemsDropped: string[];
  winner: Entity;
};

export type ConsiderationData = {
  amount: string;
  identifier: string;
  recipient: string;
  token: string;
  tokenType: TokenType;
};

export type EntityStats = {
  agility: string;
  maxHp: string;
  currentHp: string;
  entityClass: StatsClasses;
  experience: string;
  intelligence: string;
  level: string;
  strength: string;
};

export type CombatDetails = {
  attackers: Entity[];
  currentTurn: string;
  currentTurnTimer: string;
  defenders: Entity[];
  encounterId: Entity;
  encounterType: EncounterType;
  end: string;
  maxTurns: string;
  start: string;
};

export type Metadata = {
  description: string;
  image: string;
  name: string;
};

export type Monster = MonsterTemplate & {
  maxHp: string;
  currentHp: string;
  id: Entity;
  inBattle: boolean;
  isSpawned: boolean;
  position: { x: number; y: number };
};

export type MonsterStats = {
  agility: string;
  armor: string;
  entityClass: StatsClasses;
  experience: string;
  hitPoints: string;
  intelligence: string;
  inventory: string[];
  level: string;
  strength: string;
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
  amount: string;
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
  mobId: string;
  position: { x: number; y: number };
  priceMarkdown: string;
  priceMarkup: string;
  sellableItems: string[];
  shopId: string;
};

export type Spell = SpellTemplate & {
  balance: string;
  itemId: Entity;
  owner: string;
};

export type SpellStats = {
  effects: string[];
  itemId: string;
  maxDamage: string;
  minDamage: string;
  minLevel: string;
};

export type SpellTemplate = SpellStats &
  Metadata & {
    itemType: ItemType;
    statRestrictions: StatRestrictions;
    tokenId: string;
  };

export type StatRestrictions = {
  minAgility: string;
  minIntelligence: string;
  minStrength: string;
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
  balance: string;
  itemId: Entity;
  owner: string;
};

export type WeaponStats = {
  agiModifier: string;
  effects: string[];
  hpModifier: string;
  intModifier: string;
  maxDamage: string;
  minDamage: string;
  minLevel: string;
  strModifier: string;
};

export type WeaponTemplate = WeaponStats &
  Metadata & {
    itemType: ItemType;
    statRestrictions: StatRestrictions;
    tokenId: string;
  };
