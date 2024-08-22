import { Entity } from '@latticexyz/recs';

export enum ActionType {
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

export enum StatsClasses {
  Warrior,
  Rogue,
  Mage,
}

export type ActionOutcomeType = {
  attackerDamageDelt: string;
  attackerDied: boolean;
  attackerId: string;
  actionId: string;
  actionNumber: string;
  blockNumber: string;
  crit: boolean;
  currentTurn: string;
  defenderDamageDelt: string;
  defenderDied: boolean;
  defenderId: string;
  encounterId: string;
  hit: boolean;
  miss: boolean;
  timestamp: string;
  weaponId: string;
};

export type Armor = ArmorStats &
  Metadata & {
    balance: string;
    itemId: Entity;
    owner: string;
    tokenId: string;
  };

export type ArmorStats = {
  agiModifier: string;
  armorModifier: string;
  classRestrictions: StatsClasses[];
  hitPointModifier: string;
  intModifier: string;
  minLevel: string;
  strModifier: string;
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

export type Monster = Metadata &
  EntityStats & {
    id: Entity;
    inBattle: boolean;
    mobId: string;
  };

export type Weapon = WeaponStats &
  Metadata & {
    balance: string;
    itemId: Entity;
    owner: string;
    tokenId: string;
  };

export type WeaponStats = {
  agiModifier: string;
  classRestrictions: StatsClasses[];
  hitPointModifier: string;
  intModifier: string;
  maxDamage: string;
  minDamage: string;
  minLevel: string;
  strModifier: string;
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
