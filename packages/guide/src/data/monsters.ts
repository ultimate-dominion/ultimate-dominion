export interface Monster {
  name: string;
  level: number;
  monsterClass: 'Warrior' | 'Rogue' | 'Mage';
  hp: number;
  str: number;
  agi: number;
  int: number;
  armor: number;
  xp: number;
  drops: string[];
  combatTip: string;
}

// From zones/dark_cave/monsters.json — the on-chain deployed monsters
// Class mapping: 0=Warrior, 1=Rogue, 2=Mage
// 10 regular monsters (one per level) + Basilisk boss
export const darkCaveMonsters: Monster[] = [
  {
    name: 'Dire Rat',
    level: 1,
    monsterClass: 'Rogue',
    hp: 10, str: 3, agi: 6, int: 2, armor: 0, xp: 225,
    drops: ['Broken Sword', 'Worn Shortbow', 'Cracked Wand', 'Tattered Cloth', 'Worn Leather Vest', 'Dire Rat Fang', 'Minor Health Potion', 'Antidote', 'Fortifying Stew', 'Quickening Berries', 'Focusing Tea'],
    combatTip: 'A Rogue-class creature — Strength-based attacks have the triangle advantage. Very low HP and stats make this a quick fight for any build. Drops all three starter weapons and the rare Dire Rat Fang (poisons on hit).',
  },
  {
    name: 'Fungal Shaman',
    level: 2,
    monsterClass: 'Mage',
    hp: 12, str: 3, agi: 4, int: 8, armor: 0, xp: 400,
    drops: ['Cracked Wand', 'Apprentice Staff', 'Tattered Cloth', 'Apprentice Robes', 'Leather Jerkin', 'Sporecap Wand', 'Spore Cloud', 'Minor Health Potion', 'Antidote'],
    combatTip: 'A Mage-class caster — Agility builds have the edge. Watch for magical damage; INT is its strongest stat at 8. Drops the Sporecap Wand (uncommon) and Spore Cloud consumable.',
  },
  {
    name: 'Cavern Brute',
    level: 3,
    monsterClass: 'Warrior',
    hp: 18, str: 9, agi: 4, int: 3, armor: 1, xp: 550,
    drops: ['Iron Axe', 'Broken Sword', 'Padded Armor', 'Rusty Chainmail', 'Worn Leather Vest', 'Notched Cleaver', 'Minor Health Potion', 'Antidote'],
    combatTip: 'A Warrior with decent STR and the first armor you\'ll face. Intelligence-based attacks bypass the combat triangle. Drops the uncommon Notched Cleaver and Padded Armor.',
  },
  {
    name: 'Crystal Elemental',
    level: 4,
    monsterClass: 'Mage',
    hp: 16, str: 4, agi: 5, int: 10, armor: 1, xp: 800,
    drops: ['Channeling Rod', 'Apprentice Staff', 'Cracked Wand', 'Acolyte Vestments', 'Apprentice Robes', 'Tattered Cloth', 'Crystal Shard', 'Minor Health Potion', 'Health Potion', 'Antidote'],
    combatTip: 'High INT makes this a dangerous caster. Agility builds counter it well. Has 1 armor. Drops the Crystal Shard — a hybrid STR/INT weapon.',
  },
  {
    name: 'Ironhide Troll',
    level: 5,
    monsterClass: 'Warrior',
    hp: 26, str: 11, agi: 6, int: 5, armor: 2, xp: 1000,
    drops: ['Light Mace', 'Notched Blade', 'Iron Axe', 'Studded Leather', 'Padded Armor', 'Rusty Chainmail', 'Gnarled Cudgel', 'Trollhide Cleaver', 'Bloodrage Tonic', 'Trollblood Ale', 'Health Potion', 'Flashpowder', 'Venom Vial', 'Spore Cloud', 'Sapping Poison'],
    combatTip: 'The first real tank — 26 HP, 2 armor, and 11 STR. Intelligence builds have the triangle advantage. Drops the rare Gnarled Cudgel and epic Trollhide Cleaver. Also drops combat tonics and offensive consumables.',
  },
  {
    name: 'Phase Spider',
    level: 6,
    monsterClass: 'Rogue',
    hp: 22, str: 8, agi: 12, int: 5, armor: 0, xp: 1325,
    drops: ['Shortbow', 'Hunting Bow', 'Scout Armor', 'Leather Jerkin', 'Webspinner Bow', 'Spider Silk Wraps', 'Phasefang', 'Venom Vial', 'Health Potion', 'Flashpowder'],
    combatTip: 'Extremely agile at 12 AGI — hard to hit with physical attacks. Strength builds have the triangle advantage. May poison on hit. Drops the epic Phasefang and uncommon Spider Silk Wraps.',
  },
  {
    name: 'Bonecaster',
    level: 7,
    monsterClass: 'Mage',
    hp: 26, str: 6, agi: 7, int: 13, armor: 0, xp: 2000,
    drops: ['Mage Staff', 'Channeling Rod', 'Apprentice Staff', 'Mage Robes', 'Acolyte Vestments', 'Apprentice Robes', 'Bone Staff', 'Sporecap Wand', 'Health Potion', 'Greater Health Potion', 'Flashpowder', 'Venom Vial', 'Spore Cloud', 'Sapping Poison'],
    combatTip: 'A powerful caster with the highest INT so far at 13. Agility builds counter it. Watch for heavy magic damage — bring healing. Drops the rare Bone Staff.',
  },
  {
    name: 'Rock Golem',
    level: 8,
    monsterClass: 'Warrior',
    hp: 38, str: 14, agi: 8, int: 7, armor: 3, xp: 2500,
    drops: ['Warhammer', 'Light Mace', 'Notched Blade', 'Iron Axe', 'Etched Chainmail', 'Studded Leather', 'Padded Armor', 'Stone Maul', 'Carved Stone Plate', 'Stoneskin Salve', 'Gnarled Cudgel', 'Greater Health Potion', 'Flashpowder'],
    combatTip: 'Massive HP pool (38) and the highest armor in the cave (3). Intelligence has the triangle advantage. Drops rare Stone Maul and Carved Stone Plate — one of the best farming targets for STR gear.',
  },
  {
    name: 'Pale Stalker',
    level: 9,
    monsterClass: 'Rogue',
    hp: 34, str: 10, agi: 15, int: 7, armor: 0, xp: 3250,
    drops: ['Longbow', 'Shortbow', 'Hunting Bow', 'Ranger Leathers', 'Scout Armor', 'Leather Jerkin', 'Darkwood Bow', "Stalker's Vest", 'Flashpowder', 'Webspinner Bow', 'Dire Rat Fang', 'Greater Health Potion', 'Sapping Poison'],
    combatTip: 'Blazing fast with 15 AGI — the evasion king. Strength builds dominate via the combat triangle. Drops the rare Darkwood Bow (inflicts bleed) and Stalker\'s Vest.',
  },
  {
    name: 'Dusk Drake',
    level: 10,
    monsterClass: 'Mage',
    hp: 52, str: 13, agi: 13, int: 15, armor: 2, xp: 6500,
    drops: ['Mage Staff', 'Warhammer', 'Longbow', 'Channeling Rod', 'Light Mace', 'Shortbow', 'Notched Blade', 'Mage Robes', 'Etched Chainmail', 'Ranger Leathers', 'Smoldering Rod', 'Scorched Scale Vest', 'Drakescale Staff', "Drake's Cowl", 'Bone Staff', 'Greater Health Potion', 'Flashpowder'],
    combatTip: 'The apex predator of the Dark Cave. 52 HP, 15 INT, balanced secondary stats with 13 AGI, and 2 armor. Agility builds have the triangle edge. Drops rare and epic gear from every class including the Drakescale Staff and Drake\'s Cowl.',
  },
];

export const basilisk: Monster = {
  name: 'Basilisk',
  level: 12,
  monsterClass: 'Warrior',
  hp: 130, str: 17, agi: 12, int: 10, armor: 4, xp: 10000,
  drops: ['Trollhide Cleaver', 'Phasefang', 'Drakescale Staff', "Drake's Cowl", 'Carved Stone Plate', "Stalker's Vest", 'Scorched Scale Vest', 'Greater Health Potion', 'Flashpowder'],
  combatTip: 'The Dark Cave boss. 130 HP, 4 armor, and boss AI that uses both Basilisk Fangs (physical + venom) and Petrifying Gaze (magic + venom). Intelligence builds have the triangle advantage, but the massive HP pool and dual attack modes make this a war of attrition. Drops only rare and epic gear.',
};
