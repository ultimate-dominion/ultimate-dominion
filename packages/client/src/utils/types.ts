export type Character = Metadata & {
  agility: string;
  characterClass: CharacterClasses;
  characterId: string;
  hitPoints: string;
  intelligence: string;
  locked: boolean;
  owner: string;
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
