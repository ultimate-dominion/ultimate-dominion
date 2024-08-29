import { Entity } from '@latticexyz/recs';

export enum AttackType {
  Temporary,
  PhysicalAttack,
  MagicAttack,
  StatusEffect,
}

export enum EncounterType {
  PvP,
  PvE,
}

export enum ItemType {
  Weapon,
  Armor,
  Spell,
  Potion,
  Material,
  QuestItem,
}

export enum MobType {
  Monster,
  NPC,
}

export enum StatsClasses {
  Warrior,
  Rogue,
  Mage,
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
  goldBalance: string;
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

export type EntityStats = {
  agility: string;
  baseHp: string;
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

export type Item = Metadata & {
  itemId: Entity;
  itemType: ItemType;
  class: StatsClasses;
  stats: WeaponStats | ArmorStats | null;
  tokenId: string;
};
export type Order = {
  orderHash: string;
  orderStatus: string;
  offer: OfferData;
  consideration: ConsiderationData;
};
export type OfferData = {
  amount: string;
  identifier: string;
  token: string;
  tokenType: string;
};
export type ConsiderationData = {
  amount: string;
  identifier: string;
  token: string;
  tokenType: string;
  recipient: string;
};

export type StatRestrictions = {
  minAgility: string;
  minIntelligence: string;
  minStrength: string;
};
