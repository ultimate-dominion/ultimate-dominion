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
    hp: 12, str: 4, agi: 7, int: 3, armor: 0,
    drops: ['Starter weapons', 'Starter armor', 'Minor Health Potion', 'Rat King\'s Fang', 'Antidote'],
    combatTip: 'A Rogue-class creature — Strength-based attacks have an advantage. Low HP makes this a quick fight for any build.',
  },
  {
    name: 'Fungal Shaman',
    level: 2,
    monsterClass: 'Mage',
    hp: 14, str: 4, agi: 5, int: 9, armor: 0,
    drops: ['Apprentice Staff', 'Starter armor', 'Minor Health Potion', 'Quickening Berries', 'Sporecap Wand', 'Antidote'],
    combatTip: 'A Mage-class caster — Agility builds have the edge. Watch for magical damage; bring physical attacks.',
  },
  {
    name: 'Cavern Brute',
    level: 3,
    monsterClass: 'Warrior',
    hp: 22, str: 11, agi: 5, int: 4, armor: 1,
    drops: ['Iron Axe', 'Padded Armor', 'Rusty Chainmail', 'Minor Health Potion', 'Fortifying Stew', 'Brute\'s Cleaver', 'Antidote'],
    combatTip: 'A Warrior with decent armor and high STR. Intelligence-based attacks bypass the combat triangle advantage. Hits hard — consider a health potion.',
  },
  {
    name: 'Crystal Elemental',
    level: 4,
    monsterClass: 'Mage',
    hp: 20, str: 5, agi: 6, int: 12, armor: 1,
    drops: ['Channeling Rod', 'Acolyte Vestments', 'Health Potion', 'Quickening Berries', 'Crystal Blade', 'Antidote'],
    combatTip: 'High INT makes this a dangerous caster. Agility builds counter it well. Drops the Crystal Blade — a hybrid STR/INT weapon.',
  },
  {
    name: 'Cave Troll',
    level: 5,
    monsterClass: 'Warrior',
    hp: 32, str: 14, agi: 8, int: 6, armor: 3,
    drops: ['Steel Mace', 'Etched Blade', 'Studded Leather', 'Health Potion', 'Focusing Tea', 'Fortifying Stew', 'Troll\'s Bonebreaker', 'Antidote'],
    combatTip: 'The first real tank. High HP, decent armor, and punishing STR. Intelligence builds have the triangle advantage. Stock health potions.',
  },
  {
    name: 'Phase Spider',
    level: 6,
    monsterClass: 'Rogue',
    hp: 28, str: 10, agi: 15, int: 7, armor: 0,
    drops: ['Recurve Bow', 'Hunting Bow', 'Scout Armor', 'Health Potion', 'Venom Vial', 'Webspinner Bow', 'Spider Silk Wraps', 'Antidote'],
    combatTip: 'Extremely agile — hard to hit with physical attacks. Strength builds have the triangle advantage. May inflict poison, so the Antidote drop is useful for future fights.',
  },
  {
    name: 'Lich Acolyte',
    level: 7,
    monsterClass: 'Mage',
    hp: 32, str: 8, agi: 9, int: 17, armor: 0,
    drops: ['Mage Staff', 'Channeling Rod', 'Mage Robes', 'Acolyte Vestments', 'Health Potion', 'Quickening Berries', 'Bone Staff', 'Antidote'],
    combatTip: 'A powerful caster with the highest INT so far. Agility builds counter it. Watch for heavy magic damage — bring healing.',
  },
  {
    name: 'Stone Giant',
    level: 8,
    monsterClass: 'Warrior',
    hp: 48, str: 18, agi: 10, int: 9, armor: 4,
    drops: ['Warhammer', 'Steel Mace', 'Etched Blade', 'Chainmail Shirt', 'Studded Leather', 'Greater Health Potion', 'Focusing Tea', 'Giant\'s Club', 'Cracked Stone Plate', 'Antidote'],
    combatTip: 'A massive HP pool and the highest armor in the cave. Intelligence has the triangle advantage. Can drop multiple weapons and rare armor — one of the best farming targets.',
  },
  {
    name: 'Shadow Stalker',
    level: 9,
    monsterClass: 'Rogue',
    hp: 42, str: 14, agi: 20, int: 10, armor: 0,
    drops: ['Longbow', 'Recurve Bow', 'Ranger Leathers', 'Scout Armor', 'Greater Health Potion', 'Sapping Poison', 'Darkwood Bow', 'Stalker\'s Cloak', 'Antidote'],
    combatTip: 'Blazing fast with 20 AGI — the evasion king. Strength builds dominate via the combat triangle. Drops the Darkwood Bow and Stalker\'s Cloak, both rare.',
  },
  {
    name: 'Shadow Dragon',
    level: 10,
    monsterClass: 'Mage',
    hp: 70, str: 18, agi: 18, int: 20, armor: 3,
    drops: ['Mage Staff', 'Warhammer', 'Longbow', 'Channeling Rod', 'Steel Mace', 'Recurve Bow', 'Etched Blade', 'Mage Robes', 'Chainmail Shirt', 'Ranger Leathers', 'Greater Health Potion', 'Spore Cloud', 'Smoldering Rod', 'Scorched Scale Vest', 'Antidote'],
    combatTip: 'The apex predator of the Dark Cave. 70 HP, high INT, balanced secondary stats with 18 AGI, and armor. Agility builds have the triangle edge. Bring your best gear and plenty of potions. Can drop rare weapons and armor from every class.',
  },
];
