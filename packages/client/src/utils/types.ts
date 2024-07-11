import { Entity } from '@latticexyz/recs';

export type Character = CharacterData & CharacterStats;

export type CharacterData = Metadata & {
  characterClass: CharacterClasses;
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
  level: string;
  mobId: string;
  monsterId: Entity;
};
