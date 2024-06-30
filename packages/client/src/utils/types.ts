export type Character = Metadata & {
  agility: string;
  experience: string;
  characterClass: CharacterClasses;
  characterId: string;
  goldBalance: string;
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
