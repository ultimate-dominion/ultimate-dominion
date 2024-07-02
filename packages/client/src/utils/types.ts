export type Character = Metadata & {
  characterClass: CharacterClasses;
  characterId: string;
  goldBalance: string;
  locked: boolean;
  owner: string;
};

export type CharacterStats = {
  agility: string;
  experience: string;
  hitPoints: string;
  intelligence: string;
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
