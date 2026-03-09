export type Rarity = 'worn' | 'common' | 'uncommon' | 'rare';

export interface Weapon {
  name: string;
  rarity: Rarity;
  damage: string;
  str: number;
  agi: number;
  int: number;
  hp: number;
  minStr: number;
  minAgi: number;
  minInt: number;
  minLevel: number;
}

export interface Armor {
  name: string;
  rarity: Rarity;
  armor: number;
  str: number;
  agi: number;
  int: number;
  hp: number;
  minStr: number;
  minAgi: number;
  minInt: number;
  minLevel: number;
}

export interface Consumable {
  name: string;
  rarity: Rarity;
  effect: string;
}

const R = { 0: 'worn', 1: 'common', 2: 'uncommon', 3: 'rare' } as const;

// Dark Cave weapons
export const weapons: Weapon[] = [
  // Worn starters
  { name: 'Broken Sword',    rarity: 'worn', damage: '1–1',  str: 1, agi: 0, int: 0, hp: 0, minStr: 0, minAgi: 0, minInt: 0, minLevel: 0 },
  { name: 'Worn Shortbow',   rarity: 'worn', damage: '1–1',  str: 0, agi: 1, int: 0, hp: 0, minStr: 0, minAgi: 0, minInt: 0, minLevel: 0 },
  { name: 'Cracked Wand',    rarity: 'worn', damage: '1–1',  str: 0, agi: 0, int: 1, hp: 0, minStr: 0, minAgi: 0, minInt: 0, minLevel: 0 },
  // Common
  { name: 'Iron Axe',        rarity: 'common', damage: '1–2',  str: 1, agi: 0, int: 0, hp: 0, minStr: 5, minAgi: 0, minInt: 0, minLevel: 0 },
  { name: 'Hunting Bow',     rarity: 'common', damage: '1–2',  str: 0, agi: 1, int: 0, hp: 0, minStr: 0, minAgi: 8, minInt: 0, minLevel: 0 },
  { name: 'Apprentice Staff', rarity: 'common', damage: '1–2', str: 0, agi: 0, int: 1, hp: 2, minStr: 0, minAgi: 0, minInt: 6, minLevel: 0 },
  { name: 'Steel Mace',      rarity: 'common', damage: '2–4',  str: 2, agi: 0, int: 0, hp: 5, minStr: 9, minAgi: 0, minInt: 0, minLevel: 0 },
  { name: 'Recurve Bow',     rarity: 'common', damage: '2–3',  str: 0, agi: 2, int: 0, hp: 0, minStr: 0, minAgi: 7, minInt: 0, minLevel: 0 },
  { name: 'Channeling Rod',  rarity: 'common', damage: '2–3',  str: 0, agi: 0, int: 2, hp: 2, minStr: 0, minAgi: 0, minInt: 10, minLevel: 0 },
  { name: 'Etched Blade',    rarity: 'common', damage: '2–3',  str: 1, agi: 0, int: 1, hp: 0, minStr: 5, minAgi: 0, minInt: 5, minLevel: 0 },
  // Uncommon
  { name: 'Warhammer',       rarity: 'uncommon', damage: '4–7', str: 3, agi: 0, int: 0, hp: 8, minStr: 13, minAgi: 0, minInt: 0, minLevel: 0 },
  { name: 'Longbow',         rarity: 'uncommon', damage: '4–6', str: 0, agi: 3, int: 0, hp: 0, minStr: 0, minAgi: 15, minInt: 0, minLevel: 0 },
  { name: 'Mage Staff',      rarity: 'uncommon', damage: '3–5', str: 0, agi: 0, int: 3, hp: 5, minStr: 0, minAgi: 0, minInt: 11, minLevel: 0 },
  { name: 'Sporecap Wand',   rarity: 'uncommon', damage: '1–2', str: 0, agi: 0, int: 2, hp: 3, minStr: 0, minAgi: 0, minInt: 5, minLevel: 0 },
  { name: "Brute's Cleaver", rarity: 'uncommon', damage: '2–4', str: 2, agi: 0, int: 0, hp: 3, minStr: 7, minAgi: 0, minInt: 0, minLevel: 0 },
  { name: 'Crystal Blade',   rarity: 'uncommon', damage: '6–9', str: 1, agi: 0, int: 2, hp: 3, minStr: 5, minAgi: 0, minInt: 5, minLevel: 0 },
  { name: 'Webspinner Bow',  rarity: 'uncommon', damage: '3–4', str: 0, agi: 3, int: 0, hp: 0, minStr: 0, minAgi: 10, minInt: 0, minLevel: 0 },
  // Rare
  { name: "Rat King's Fang", rarity: 'rare', damage: '2–3', str: 0, agi: 2, int: 0, hp: 0, minStr: 0, minAgi: 0, minInt: 0, minLevel: 0 },
  { name: "Troll's Bonebreaker", rarity: 'rare', damage: '4–6', str: 3, agi: 0, int: 0, hp: 5, minStr: 10, minAgi: 0, minInt: 0, minLevel: 0 },
  { name: 'Bone Staff',      rarity: 'rare', damage: '3–5', str: 0, agi: 0, int: 3, hp: 3, minStr: 0, minAgi: 0, minInt: 13, minLevel: 0 },
  { name: "Giant's Club",    rarity: 'rare', damage: '5–7', str: 4, agi: 0, int: 0, hp: 8, minStr: 15, minAgi: 0, minInt: 0, minLevel: 0 },
  { name: 'Darkwood Bow',    rarity: 'rare', damage: '4–6', str: 0, agi: 4, int: 0, hp: 0, minStr: 0, minAgi: 18, minInt: 0, minLevel: 0 },
  { name: 'Smoldering Rod',  rarity: 'rare', damage: '4–5', str: 0, agi: 2, int: 4, hp: 5, minStr: 0, minAgi: 0, minInt: 16, minLevel: 0 },
];

export const armors: Armor[] = [
  // Worn starters
  { name: 'Tattered Cloth',     rarity: 'worn', armor: 1,  str: 0, agi: 0, int: 1, hp: 0, minStr: 0, minAgi: 0, minInt: 0, minLevel: 0 },
  { name: 'Worn Leather Vest',  rarity: 'worn', armor: 2,  str: -1, agi: 1, int: 0, hp: 0, minStr: 0, minAgi: 0, minInt: 0, minLevel: 0 },
  { name: 'Rusty Chainmail',    rarity: 'worn', armor: 3,  str: 0, agi: -1, int: 0, hp: 0, minStr: 0, minAgi: 0, minInt: 0, minLevel: 0 },
  // Common
  { name: 'Padded Armor',       rarity: 'common', armor: 3,  str: 1, agi: 0, int: 0, hp: 0, minStr: 8, minAgi: 0, minInt: 0, minLevel: 0 },
  { name: 'Leather Jerkin',     rarity: 'common', armor: 2,  str: 0, agi: 1, int: 0, hp: 0, minStr: 0, minAgi: 5, minInt: 0, minLevel: 0 },
  { name: 'Apprentice Robes',   rarity: 'common', armor: 1,  str: 0, agi: 0, int: 1, hp: 0, minStr: 0, minAgi: 0, minInt: 7, minLevel: 0 },
  { name: 'Studded Leather',    rarity: 'common', armor: 5,  str: 1, agi: 0, int: 0, hp: 5, minStr: 8, minAgi: 0, minInt: 0, minLevel: 0 },
  { name: 'Scout Armor',        rarity: 'common', armor: 4,  str: 0, agi: 2, int: 0, hp: 0, minStr: 0, minAgi: 10, minInt: 0, minLevel: 0 },
  { name: 'Acolyte Vestments',  rarity: 'common', armor: 2,  str: 0, agi: 0, int: 2, hp: 0, minStr: 0, minAgi: 0, minInt: 7, minLevel: 0 },
  // Uncommon
  { name: 'Chainmail Shirt',    rarity: 'uncommon', armor: 8,  str: 2, agi: 0, int: 0, hp: 8, minStr: 12, minAgi: 0, minInt: 0, minLevel: 0 },
  { name: 'Ranger Leathers',    rarity: 'uncommon', armor: 6,  str: 0, agi: 3, int: 0, hp: 0, minStr: 0, minAgi: 11, minInt: 0, minLevel: 0 },
  { name: 'Mage Robes',         rarity: 'uncommon', armor: 4,  str: 0, agi: 0, int: 3, hp: 0, minStr: 0, minAgi: 0, minInt: 14, minLevel: 0 },
  { name: 'Spider Silk Wraps',  rarity: 'uncommon', armor: 3,  str: 0, agi: 4, int: 0, hp: 0, minStr: 0, minAgi: 12, minInt: 0, minLevel: 0 },
  // Rare
  { name: 'Cracked Stone Plate', rarity: 'rare', armor: 8,  str: 3, agi: 0, int: 0, hp: 8, minStr: 14, minAgi: 0, minInt: 0, minLevel: 0 },
  { name: "Stalker's Cloak",    rarity: 'rare', armor: 5,  str: 0, agi: 5, int: 0, hp: 0, minStr: 0, minAgi: 16, minInt: 0, minLevel: 0 },
  { name: 'Scorched Scale Vest', rarity: 'rare', armor: 10, str: 2, agi: 2, int: 2, hp: 5, minStr: 12, minAgi: 0, minInt: 0, minLevel: 0 },
];

export const consumables: Consumable[] = [
  { name: 'Minor Health Potion',   rarity: 'common',    effect: 'Restores 15 HP' },
  { name: 'Health Potion',         rarity: 'common',    effect: 'Restores 35 HP' },
  { name: 'Greater Health Potion', rarity: 'uncommon',  effect: 'Restores 75 HP' },
  { name: 'Fortifying Stew',      rarity: 'common',    effect: 'Temporarily boosts Strength' },
  { name: 'Quickening Berries',   rarity: 'common',    effect: 'Temporarily boosts Agility' },
  { name: 'Focusing Tea',         rarity: 'common',    effect: 'Temporarily boosts Intelligence' },
  { name: 'Antidote',             rarity: 'common',    effect: 'Clears poison status effect' },
  { name: 'Flashpowder',          rarity: 'uncommon',  effect: 'Guarantees a successful flee from combat' },
  { name: 'Venom Vial',           rarity: 'uncommon',  effect: 'Inflicts poison on the target' },
  { name: 'Spore Cloud',          rarity: 'uncommon',  effect: 'Debuffs target Intelligence' },
  { name: 'Sapping Poison',       rarity: 'uncommon',  effect: 'Debuffs target Strength' },
];

export const rarityOrder: Rarity[] = ['worn', 'common', 'uncommon', 'rare'];

export const rarityColors: Record<Rarity, string> = {
  worn: '#9d9d9d',
  common: '#ffffff',
  uncommon: '#1eff00',
  rare: '#0070dd',
};
