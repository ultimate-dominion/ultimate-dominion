export type Rarity = 'worn' | 'common' | 'uncommon' | 'rare' | 'epic';

export interface Weapon {
  name: string;
  rarity: Rarity;
  damage: string;
  str: number;
  agi: number;
  int: number;
  hp: number;
  requires: string;
  special?: string;
}

export interface Armor {
  name: string;
  rarity: Rarity;
  armor: number;
  str: number;
  agi: number;
  int: number;
  hp: number;
  requires: string;
}

export interface Consumable {
  name: string;
  rarity: Rarity;
  effect: string;
}

// Dark Cave weapons — from on-chain items.json
export const weapons: Weapon[] = [
  // Worn starters
  { name: 'Broken Sword',      rarity: 'worn', damage: '1–1',  str: 1, agi: 0, int: 0, hp: 0, requires: 'None' },
  { name: 'Worn Shortbow',     rarity: 'worn', damage: '1–1',  str: 0, agi: 1, int: 0, hp: 0, requires: 'None' },
  { name: 'Cracked Wand',      rarity: 'worn', damage: '1–1',  str: 0, agi: 0, int: 1, hp: 0, requires: 'None' },
  // Common
  { name: 'Iron Axe',          rarity: 'common', damage: '1–2',  str: 1, agi: 0, int: 0, hp: 0, requires: '5 STR' },
  { name: 'Hunting Bow',       rarity: 'common', damage: '1–2',  str: 0, agi: 1, int: 0, hp: 2, requires: '8 AGI' },
  { name: 'Apprentice Staff',  rarity: 'common', damage: '1–2',  str: 0, agi: 0, int: 1, hp: 2, requires: '6 INT' },
  { name: 'Light Mace',        rarity: 'common', damage: '2–4',  str: 2, agi: 0, int: 0, hp: 3, requires: '8 STR, 3 AGI' },
  { name: 'Shortbow',          rarity: 'common', damage: '2–3',  str: 0, agi: 2, int: 0, hp: 3, requires: '7 AGI, 4 STR' },
  { name: 'Channeling Rod',    rarity: 'common', damage: '2–3',  str: 0, agi: 0, int: 2, hp: 3, requires: '9 INT, 3 STR' },
  { name: 'Notched Blade',     rarity: 'common', damage: '2–3',  str: 1, agi: 0, int: 1, hp: 0, requires: '4 STR, 4 INT' },
  // Uncommon
  { name: 'Warhammer',         rarity: 'uncommon', damage: '4–7', str: 3, agi: 0, int: 0, hp: 5, requires: '11 STR, 4 AGI' },
  { name: 'Longbow',           rarity: 'uncommon', damage: '4–7', str: 0, agi: 3, int: 0, hp: 5, requires: '13 AGI, 4 STR' },
  { name: 'Mage Staff',        rarity: 'uncommon', damage: '4–6', str: 0, agi: 0, int: 3, hp: 5, requires: '9 INT, 4 STR' },
  { name: 'Sporecap Wand',     rarity: 'uncommon', damage: '1–2', str: 0, agi: 0, int: 2, hp: 3, requires: '5 INT' },
  { name: 'Notched Cleaver',   rarity: 'uncommon', damage: '2–4', str: 2, agi: 0, int: 0, hp: 2, requires: '7 STR, 3 AGI' },
  { name: 'Crystal Shard',     rarity: 'uncommon', damage: '4–6', str: 1, agi: 0, int: 2, hp: 3, requires: '6 STR, 6 INT' },
  { name: 'Webspinner Bow',    rarity: 'uncommon', damage: '3–5', str: 0, agi: 3, int: 0, hp: 4, requires: '10 AGI, 5 STR' },
  // Rare
  { name: 'Dire Rat Fang',     rarity: 'rare', damage: '2–3', str: 0, agi: 2, int: 0, hp: 0, requires: 'None', special: 'Poisons target' },
  { name: 'Gnarled Cudgel',    rarity: 'rare', damage: '4–6', str: 3, agi: 0, int: 0, hp: 3, requires: '10 STR, 4 AGI' },
  { name: 'Bone Staff',        rarity: 'rare', damage: '4–6', str: 0, agi: 0, int: 3, hp: 5, requires: '11 INT, 4 STR' },
  { name: 'Stone Maul',        rarity: 'rare', damage: '5–6', str: 3, agi: 0, int: 0, hp: 5, requires: '13 STR, 4 AGI' },
  { name: 'Darkwood Bow',      rarity: 'rare', damage: '6–9', str: 2, agi: 5, int: 0, hp: 6, requires: '14 AGI, 6 STR', special: 'Inflicts bleed' },
  { name: 'Smoldering Rod',    rarity: 'rare', damage: '5–7', str: 0, agi: 0, int: 5, hp: 6, requires: '13 INT, 4 STR' },
  // Epic
  { name: 'Trollhide Cleaver', rarity: 'epic', damage: '6–9', str: 3, agi: 3, int: 0, hp: 5, requires: '16 STR, 10 AGI', special: 'Weakens target STR' },
  { name: 'Phasefang',         rarity: 'epic', damage: '4–8', str: 0, agi: 4, int: 3, hp: 5, requires: '16 AGI, 11 INT', special: 'Poisons and blinds target' },
  { name: 'Drakescale Staff',  rarity: 'epic', damage: '5–8', str: 2, agi: 0, int: 3, hp: 5, requires: '12 STR, 11 INT', special: 'Stupefies target INT' },
];

export const armors: Armor[] = [
  // Worn starters
  { name: 'Tattered Cloth',        rarity: 'worn', armor: 1,  str: 0, agi: 0, int: 1, hp: 0, requires: 'None' },
  { name: 'Worn Leather Vest',     rarity: 'worn', armor: 2,  str: -1, agi: 1, int: 0, hp: 0, requires: 'None' },
  { name: 'Rusty Chainmail',       rarity: 'worn', armor: 3,  str: 0, agi: -1, int: 0, hp: 0, requires: 'None' },
  // Common
  { name: 'Padded Armor',          rarity: 'common', armor: 3,  str: 1, agi: 0, int: 0, hp: 0, requires: '8 STR' },
  { name: 'Leather Jerkin',        rarity: 'common', armor: 2,  str: 0, agi: 1, int: 0, hp: 0, requires: '5 AGI' },
  { name: 'Apprentice Robes',      rarity: 'common', armor: 1,  str: 0, agi: 0, int: 1, hp: 0, requires: '7 INT' },
  { name: 'Studded Leather',       rarity: 'common', armor: 5,  str: 1, agi: 0, int: 0, hp: 5, requires: '8 STR' },
  { name: 'Scout Armor',           rarity: 'common', armor: 4,  str: 0, agi: 2, int: 0, hp: 0, requires: '10 AGI' },
  { name: 'Acolyte Vestments',     rarity: 'common', armor: 2,  str: 0, agi: 0, int: 2, hp: 0, requires: '7 INT' },
  // Uncommon
  { name: 'Etched Chainmail',      rarity: 'uncommon', armor: 8,  str: 2, agi: 0, int: 0, hp: 8, requires: '12 STR, 7 INT' },
  { name: 'Ranger Leathers',       rarity: 'uncommon', armor: 6,  str: 0, agi: 3, int: 0, hp: 0, requires: '11 AGI, 8 INT' },
  { name: 'Mage Robes',            rarity: 'uncommon', armor: 4,  str: 0, agi: 0, int: 3, hp: 0, requires: '14 INT, 10 AGI' },
  { name: 'Spider Silk Wraps',     rarity: 'uncommon', armor: 3,  str: 0, agi: 4, int: 0, hp: 0, requires: '12 AGI, 8 INT' },
  // Rare
  { name: 'Carved Stone Plate',    rarity: 'rare', armor: 10, str: 3, agi: 0, int: 0, hp: 10, requires: '14 STR, 9 INT' },
  { name: "Stalker's Vest",        rarity: 'rare', armor: 7,  str: 0, agi: 5, int: 0, hp: 0, requires: '14 AGI, 8 INT' },
  { name: 'Scorched Scale Vest',   rarity: 'rare', armor: 8,  str: 1, agi: 1, int: 4, hp: 6, requires: '12 STR, 9 INT' },
  { name: "Drake's Cowl",          rarity: 'rare', armor: 6,  str: 0, agi: 0, int: 5, hp: 0, requires: '14 INT, 12 AGI' },
];

export const consumables: Consumable[] = [
  // Healing
  { name: 'Minor Health Potion',   rarity: 'common',   effect: 'Restores 15 HP' },
  { name: 'Health Potion',         rarity: 'common',   effect: 'Restores 35 HP' },
  { name: 'Greater Health Potion', rarity: 'common',   effect: 'Restores 75 HP' },
  // Stat buffs
  { name: 'Fortifying Stew',      rarity: 'common',   effect: '+5 STR for 10 minutes' },
  { name: 'Quickening Berries',   rarity: 'common',   effect: '+5 AGI for 10 minutes' },
  { name: 'Focusing Tea',         rarity: 'common',   effect: '+5 INT for 10 minutes' },
  // Combat tonics
  { name: 'Bloodrage Tonic',      rarity: 'common',   effect: '+6 STR, -4 armor for 3 turns (self)' },
  { name: 'Stoneskin Salve',      rarity: 'common',   effect: '+6 armor, -4 AGI for 3 turns (self)' },
  { name: 'Trollblood Ale',       rarity: 'common',   effect: '+8 STR, -3 AGI, -5 INT for 3 turns (self)' },
  // Utility
  { name: 'Antidote',             rarity: 'common',   effect: 'Clears poison status effect' },
  { name: 'Flashpowder',          rarity: 'uncommon', effect: 'Guarantees a successful flee with no gold penalty' },
  // Offensive consumables
  { name: 'Venom Vial',           rarity: 'common',   effect: 'Inflicts poison (3 dmg/turn for 8 turns)' },
  { name: 'Spore Cloud',          rarity: 'common',   effect: 'Reduces target INT by 8 for 8 turns' },
  { name: 'Sapping Poison',       rarity: 'common',   effect: 'Reduces target STR by 8 for 8 turns' },
  // Junk (vendor items)
  { name: 'Rat Tooth',            rarity: 'worn',     effect: 'Vendor trash — sell for gold' },
  { name: 'Cave Moss',            rarity: 'worn',     effect: 'Vendor trash — sell for gold' },
  { name: 'Cracked Bone',         rarity: 'worn',     effect: 'Vendor trash — sell for gold' },
  { name: 'Dull Crystal',         rarity: 'worn',     effect: 'Vendor trash — sell for gold' },
  { name: 'Tattered Hide',        rarity: 'worn',     effect: 'Vendor trash — sell for gold' },
  { name: 'Bent Nail',            rarity: 'worn',     effect: 'Vendor trash — sell for gold' },
];

export const rarityOrder: Rarity[] = ['worn', 'common', 'uncommon', 'rare', 'epic'];

export const rarityColors: Record<Rarity, string> = {
  worn: '#9d9d9d',
  common: '#ffffff',
  uncommon: '#1eff00',
  rare: '#0070dd',
  epic: '#a335ee',
};
