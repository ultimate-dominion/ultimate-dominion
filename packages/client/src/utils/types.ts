import { Entity } from '@latticexyz/recs';

export type Character = CharacterData & CharacterStats;

export type CharacterData = Metadata & {
  characterClass: StatsClasses;
  characterId: Entity;
  goldBalance: string;
  locked: boolean;
  owner: string;
  tokenId: string;
};

export type CharacterStats = {
  agility: string;
  baseHitPoints: string;
  characterClass: StatsClasses;
  experience: string;
  intelligence: string;
  level: string;
  baseHitPoints: string;
  strength: string;
};

export enum StatsClasses {
  Warrior,
  Rogue,
  Mage,
}

export type Metadata = {
  description: string;
  image: string;
  name: string;
};

export type Monster = Metadata & {
  class: StatsClasses;
  level: string;
  mobId: string;
  monsterId: Entity;
};

export type Weapon = Metadata & {
  agiModifier: string;
  classRestrictions: StatsClasses[];
  hitPointModifier: string;
  intModifier: string;
  maxDamage: string;
  minDamage: string;
  minLevel: string;
  strModifier: string;
};
