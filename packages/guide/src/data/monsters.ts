export interface Monster {
  name: string;
  level: number;
  monsterClass: 'Warrior' | 'Rogue' | 'Mage';
  hp: number;
  str: number;
  agi: number;
  int: number;
  armor: number;
  drops: string[];
  combatTip: string;
}

export const darkCaveMonsters: Monster[] = [
  {
    name: 'Cave Rat',
    level: 1,
    monsterClass: 'Rogue',
    hp: 10, str: 3, agi: 6, int: 2, armor: 0,
    drops: ['Starter weapons', 'Starter armor', 'Minor Health Potion', 'Fortifying Stew'],
    combatTip: 'A Rogue-class creature — Strength-based attacks have an advantage. Low HP makes this a quick fight for any build.',
  },
  {
    name: 'Fungal Shaman',
    level: 2,
    monsterClass: 'Mage',
    hp: 11, str: 3, agi: 4, int: 8, armor: 0,
    drops: ['Apprentice Staff', 'Starter armor', 'Minor Health Potion', 'Quickening Berries'],
    combatTip: 'A Mage-class caster — Agility builds have the edge. Watch for magical damage; bring physical attacks.',
  },
  {
    name: 'Cavern Brute',
    level: 3,
    monsterClass: 'Warrior',
    hp: 18, str: 9, agi: 4, int: 3, armor: 1,
    drops: ['Iron Axe', 'Leather Jerkin', 'Minor Health Potion', 'Fortifying Stew'],
    combatTip: 'A Warrior with decent armor and high STR. Intelligence-based attacks bypass the combat triangle advantage. Hits hard — consider a health potion.',
  },
  {
    name: 'Crystal Elemental',
    level: 4,
    monsterClass: 'Mage',
    hp: 16, str: 4, agi: 5, int: 10, armor: 1,
    drops: ['Runesword', 'Acolyte Vestments', 'Minor Health Potion', 'Quickening Berries'],
    combatTip: 'High INT makes this a dangerous caster. Agility builds counter it well. Drops the Runesword — a hybrid STR/INT weapon.',
  },
  {
    name: 'Cave Troll',
    level: 5,
    monsterClass: 'Warrior',
    hp: 26, str: 11, agi: 6, int: 5, armor: 2,
    drops: ['Recurve Bow', 'Apprentice Robes', 'Health Potion', 'Focusing Tea'],
    combatTip: 'The first real tank. High HP, decent armor, and punishing STR. Intelligence builds have the triangle advantage. Stock health potions.',
  },
  {
    name: 'Phase Spider',
    level: 6,
    monsterClass: 'Rogue',
    hp: 23, str: 8, agi: 13, int: 6, armor: 0,
    drops: ['Hunting Bow', 'Padded Armor', 'Health Potion', 'Fortifying Stew', 'Antidote'],
    combatTip: 'Extremely agile — hard to hit with physical attacks. Strength builds have the triangle advantage. May inflict poison, so the Antidote drop is useful for future fights.',
  },
  {
    name: 'Lich Acolyte',
    level: 7,
    monsterClass: 'Mage',
    hp: 25, str: 6, agi: 7, int: 15, armor: 0,
    drops: ['Channeling Rod', 'Studded Leather', 'Health Potion', 'Quickening Berries'],
    combatTip: 'A powerful caster with the highest INT so far. Agility builds counter it. Watch for heavy magic damage — bring healing.',
  },
  {
    name: 'Stone Giant',
    level: 8,
    monsterClass: 'Warrior',
    hp: 40, str: 16, agi: 8, int: 7, armor: 3,
    drops: ['Steel Mace', 'Warhammer', 'Scout Armor', 'Greater Health Potion', 'Focusing Tea'],
    combatTip: 'A massive HP pool and the highest armor in the cave. Intelligence has the triangle advantage. Can drop two different weapons — one of the best farming targets.',
  },
  {
    name: 'Shadow Stalker',
    level: 9,
    monsterClass: 'Rogue',
    hp: 34, str: 11, agi: 18, int: 8, armor: 0,
    drops: ['Longbow', 'Chainmail Shirt', 'Greater Health Potion', 'Fortifying Stew', 'Smoke Bomb'],
    combatTip: 'Blazing fast with 18 AGI — the evasion king. Strength builds dominate via the combat triangle. Drops the Smoke Bomb, a useful debuff consumable.',
  },
  {
    name: 'Shadow Dragon',
    level: 10,
    monsterClass: 'Mage',
    hp: 48, str: 12, agi: 12, int: 20, armor: 2,
    drops: ['Mage Staff', 'Ranger Leathers', 'Mage Robes', 'Greater Health Potion'],
    combatTip: 'The apex predator of the Dark Cave. Massive HP, high INT, balanced secondary stats, and armor. Agility builds have the triangle edge. Bring your best gear and plenty of potions. Can drop two different rare armors.',
  },
];
