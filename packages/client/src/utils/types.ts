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

export type BattleActionOutcome = {
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

export type Character = CharacterData & EntityStats & Metadata;

export type CharacterData = {
  characterId: Entity;
  goldBalance: string;
  inBattle: boolean;
  locked: boolean;
  owner: string;
  tokenId: string;
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
    inBattle: boolean;
    mobId: string;
    monsterId: Entity;
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
