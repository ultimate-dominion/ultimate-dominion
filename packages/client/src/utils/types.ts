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
  experience: string;
  intelligence: string;
  maxHitPoints: string;
  strength: string;
};

export enum CharacterClasses {
  Warrior,
  Rogue,
  Mage,
}

export type Metadata = {
  description: string;
  image: string;
  name: string;
};
