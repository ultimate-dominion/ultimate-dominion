export type Character = Metadata & {
  characterClass: CharacterClasses;
  characterId: string;
  locked: boolean;
  owner: string;
};

export enum CharacterClasses {
  Warrior,
  Mage,
  Rogue,
}

export type Metadata = {
  description: string;
  image: string;
  name: string;
};
