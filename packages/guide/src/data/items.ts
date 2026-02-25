export type Rarity = 'worn' | 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';

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

const R = { 0: 'worn', 1: 'common', 2: 'uncommon', 3: 'rare', 4: 'epic', 5: 'legendary' } as const;

// Dark Cave starter weapons (Tier 1)
export const weapons: Weapon[] = [
  // Tier 1 — Worn starters
  { name: 'Broken Sword',    rarity: 'worn', damage: '2–4',  str: 0, agi: 0, int: 0, hp: 0, minStr: 0, minAgi: 0, minInt: 0, minLevel: 1 },
  { name: 'Worn Shortbow',   rarity: 'worn', damage: '2–4',  str: 0, agi: 0, int: 0, hp: 0, minStr: 0, minAgi: 0, minInt: 0, minLevel: 1 },
  { name: 'Cracked Wand',    rarity: 'worn', damage: '2–4',  str: 0, agi: 0, int: 0, hp: 0, minStr: 0, minAgi: 0, minInt: 0, minLevel: 1 },
  // Common
  { name: 'Iron Axe',        rarity: 'common', damage: '4–8',  str: 1, agi: 0, int: 0, hp: 0, minStr: 6, minAgi: 0, minInt: 0, minLevel: 1 },
  { name: 'Hunting Bow',     rarity: 'common', damage: '4–7',  str: 0, agi: 1, int: 0, hp: 0, minStr: 0, minAgi: 6, minInt: 0, minLevel: 1 },
  { name: 'Apprentice Staff', rarity: 'common', damage: '3–6', str: 0, agi: 0, int: 1, hp: 0, minStr: 0, minAgi: 0, minInt: 6, minLevel: 1 },
  // Uncommon
  { name: 'Steel Mace',      rarity: 'uncommon', damage: '8–14',  str: 2, agi: 0, int: 0, hp: 5, minStr: 8, minAgi: 0, minInt: 0, minLevel: 5 },
  { name: 'Recurve Bow',     rarity: 'uncommon', damage: '7–12',  str: 0, agi: 2, int: 0, hp: 0, minStr: 0, minAgi: 8, minInt: 0, minLevel: 5 },
  { name: 'Channeling Rod',  rarity: 'uncommon', damage: '6–10',  str: 0, agi: 0, int: 2, hp: 0, minStr: 0, minAgi: 0, minInt: 8, minLevel: 5 },
  { name: 'Runesword',       rarity: 'uncommon', damage: '7–11',  str: 1, agi: 0, int: 1, hp: 0, minStr: 5, minAgi: 0, minInt: 5, minLevel: 5 },
  // Rare
  { name: 'Warhammer',       rarity: 'rare', damage: '15–25', str: 3, agi: 0, int: 0, hp: 8, minStr: 12, minAgi: 0, minInt: 0, minLevel: 10 },
  { name: 'Longbow',         rarity: 'rare', damage: '13–22', str: 0, agi: 3, int: 0, hp: 0, minStr: 0, minAgi: 12, minInt: 0, minLevel: 10 },
  { name: 'Mage Staff',      rarity: 'rare', damage: '12–18', str: 0, agi: 0, int: 3, hp: 0, minStr: 0, minAgi: 0, minInt: 12, minLevel: 10 },
  // Epic (T1)
  { name: 'Greatsword',      rarity: 'epic', damage: '28–42', str: 4, agi: 0, int: 0, hp: 15, minStr: 20, minAgi: 0, minInt: 0, minLevel: 25 },
  { name: "Assassin's Bow",  rarity: 'epic', damage: '25–38', str: 0, agi: 5, int: 0, hp: 0, minStr: 0, minAgi: 20, minInt: 0, minLevel: 25 },
  { name: 'Arcane Staff',    rarity: 'epic', damage: '22–32', str: 0, agi: 0, int: 5, hp: 0, minStr: 0, minAgi: 0, minInt: 20, minLevel: 25 },
  // Legendary
  { name: 'Godslayer',       rarity: 'legendary', damage: '150–180', str: 15, agi: 0, int: 0, hp: 50, minStr: 68, minAgi: 0, minInt: 0, minLevel: 90 },
  { name: "Eternity's Edge", rarity: 'legendary', damage: '135–165', str: 0, agi: 15, int: 0, hp: 0, minStr: 0, minAgi: 68, minInt: 0, minLevel: 90 },
  { name: 'Worldshaper',     rarity: 'legendary', damage: '125–155', str: 0, agi: 0, int: 15, hp: 0, minStr: 0, minAgi: 0, minInt: 68, minLevel: 90 },
];

export const armors: Armor[] = [
  // Worn starters
  { name: 'Tattered Cloth',     rarity: 'worn', armor: 1,  str: 0, agi: 0, int: 0, hp: 0, minStr: 0, minAgi: 0, minInt: 0, minLevel: 1 },
  { name: 'Worn Leather Vest',  rarity: 'worn', armor: 2,  str: 0, agi: 0, int: 0, hp: 0, minStr: 0, minAgi: 0, minInt: 0, minLevel: 1 },
  // Common
  { name: 'Padded Armor',       rarity: 'common', armor: 3,  str: 1, agi: 0, int: 0, hp: 0, minStr: 6, minAgi: 0, minInt: 0, minLevel: 1 },
  { name: 'Leather Jerkin',     rarity: 'common', armor: 2,  str: 0, agi: 1, int: 0, hp: 0, minStr: 0, minAgi: 6, minInt: 0, minLevel: 1 },
  { name: 'Apprentice Robes',   rarity: 'common', armor: 1,  str: 0, agi: 0, int: 1, hp: 0, minStr: 0, minAgi: 0, minInt: 6, minLevel: 1 },
  // Uncommon
  { name: 'Studded Leather',    rarity: 'uncommon', armor: 5,  str: 1, agi: 0, int: 0, hp: 5, minStr: 8, minAgi: 0, minInt: 0, minLevel: 5 },
  { name: 'Scout Armor',        rarity: 'uncommon', armor: 4,  str: 0, agi: 2, int: 0, hp: 0, minStr: 0, minAgi: 8, minInt: 0, minLevel: 5 },
  { name: 'Acolyte Vestments',  rarity: 'uncommon', armor: 2,  str: 0, agi: 0, int: 2, hp: 0, minStr: 0, minAgi: 0, minInt: 8, minLevel: 5 },
  // Rare
  { name: 'Chainmail Shirt',    rarity: 'rare', armor: 8,  str: 2, agi: 0, int: 0, hp: 8, minStr: 12, minAgi: 0, minInt: 0, minLevel: 10 },
  { name: 'Ranger Leathers',    rarity: 'rare', armor: 6,  str: 0, agi: 3, int: 0, hp: 0, minStr: 0, minAgi: 12, minInt: 0, minLevel: 10 },
  { name: 'Mage Robes',         rarity: 'rare', armor: 4,  str: 0, agi: 0, int: 3, hp: 0, minStr: 0, minAgi: 0, minInt: 12, minLevel: 10 },
  // Epic
  { name: 'Half Plate',         rarity: 'epic', armor: 14, str: 3, agi: 0, int: 0, hp: 15, minStr: 20, minAgi: 0, minInt: 0, minLevel: 25 },
  { name: 'Shadow Leather',     rarity: 'epic', armor: 10, str: 0, agi: 4, int: 0, hp: 0, minStr: 0, minAgi: 20, minInt: 0, minLevel: 25 },
  { name: 'Archmage Robes',     rarity: 'epic', armor: 6,  str: 0, agi: 0, int: 4, hp: 0, minStr: 0, minAgi: 0, minInt: 20, minLevel: 25 },
  // Legendary
  { name: "Titan's Bulwark",    rarity: 'legendary', armor: 120, str: 12, agi: 0, int: 0, hp: 50, minStr: 68, minAgi: 0, minInt: 0, minLevel: 90 },
  { name: 'Voidwalker Shroud',  rarity: 'legendary', armor: 90,  str: 0, agi: 12, int: 0, hp: 0, minStr: 0, minAgi: 68, minInt: 0, minLevel: 90 },
  { name: 'Cosmic Vestments',   rarity: 'legendary', armor: 70,  str: 0, agi: 0, int: 12, hp: 0, minStr: 0, minAgi: 0, minInt: 68, minLevel: 90 },
];

export const consumables: Consumable[] = [
  { name: 'Minor Health Potion',   rarity: 'common',    effect: 'Restores a small amount of HP' },
  { name: 'Health Potion',         rarity: 'uncommon',  effect: 'Restores a moderate amount of HP' },
  { name: 'Greater Health Potion', rarity: 'rare',      effect: 'Restores a large amount of HP' },
  { name: 'Superior Health Potion', rarity: 'epic',     effect: 'Restores a massive amount of HP' },
  { name: 'Full Restore',          rarity: 'legendary', effect: 'Fully restores HP' },
  { name: 'Fortifying Stew',      rarity: 'common',    effect: 'Temporarily boosts Strength' },
  { name: 'Quickening Berries',   rarity: 'common',    effect: 'Temporarily boosts Agility' },
  { name: 'Focusing Tea',         rarity: 'common',    effect: 'Temporarily boosts Intelligence' },
  { name: 'Antidote',             rarity: 'common',    effect: 'Clears negative status effects' },
  { name: 'Smoke Bomb',           rarity: 'uncommon',  effect: 'Reduces target hit chance' },
  { name: 'Elixir of Strength',   rarity: 'rare',      effect: 'Powerful Strength boost' },
  { name: 'Elixir of Agility',    rarity: 'rare',      effect: 'Powerful Agility boost' },
  { name: 'Elixir of Intelligence', rarity: 'rare',    effect: 'Powerful Intelligence boost' },
];

export const rarityOrder: Rarity[] = ['worn', 'common', 'uncommon', 'rare', 'epic', 'legendary'];

export const rarityColors: Record<Rarity, string> = {
  worn: '#9d9d9d',
  common: '#ffffff',
  uncommon: '#1eff00',
  rare: '#0070dd',
  epic: '#a335ee',
  legendary: '#ff8000',
};
