export interface ClassData {
  name: string;
  bonuses: string;
  phys: string;
  spell: string;
  heal: string;
  crit: string;
  maxHp: string;
  spellName: string;
  spellDesc: string;
  archetype: 'str' | 'agi' | 'int' | 'hybrid';
  description: string;
}

export const classes: ClassData[] = [
  {
    name: 'Warrior',
    bonuses: '+3 STR, +10 HP',
    phys: '110%', spell: '100%', heal: '100%', crit: '100%', maxHp: '100%',
    spellName: 'Battle Cry',
    spellDesc: '+4 STR, +3 armor for 3 turns',
    archetype: 'str',
    description: 'The frontline bruiser. Warriors deal the highest physical damage and get bonus health to soak hits. Their Battle Cry further amplifies their strength and toughness in prolonged fights.',
  },
  {
    name: 'Paladin',
    bonuses: '+2 STR, +15 HP',
    phys: '105%', spell: '100%', heal: '105%', crit: '100%', maxHp: '100%',
    spellName: 'Divine Shield',
    spellDesc: '+5 armor, +3 STR for 3 turns',
    archetype: 'str',
    description: 'A holy warrior who trades raw damage for durability. The Paladin has the highest base HP bonus of any class and a slight boost to both physical damage and healing. Divine Shield makes them extremely hard to kill.',
  },
  {
    name: 'Ranger',
    bonuses: '+3 AGI',
    phys: '110%', spell: '100%', heal: '100%', crit: '100%', maxHp: '100%',
    spellName: "Hunter's Mark",
    spellDesc: '-5 AGI, -2 armor on target for 4 turns',
    archetype: 'agi',
    description: "A precise striker who exploits the combat triangle. Rangers match Warriors in physical damage but focus on agility instead of bulk. Hunter's Mark cripples evasive enemies, making them vulnerable to follow-up attacks.",
  },
  {
    name: 'Rogue',
    bonuses: '+2 AGI, +1 INT',
    phys: '100%', spell: '100%', heal: '100%', crit: '115%', maxHp: '100%',
    spellName: 'Shadowstep',
    spellDesc: '+8 AGI for 2 turns',
    archetype: 'agi',
    description: 'The critical strike specialist. Rogues have the highest crit multiplier in the game, turning every fight into a gamble that favors them. Shadowstep gives a massive evasion spike for two crucial turns.',
  },
  {
    name: 'Druid',
    bonuses: '+2 AGI, +2 STR',
    phys: '105%', spell: '105%', heal: '100%', crit: '100%', maxHp: '105%',
    spellName: 'Entangle',
    spellDesc: '-5 AGI, -3 STR on target for 3 turns',
    archetype: 'hybrid',
    description: 'A versatile hybrid who blends physical and magical prowess. The Druid is the only class with bonuses to physical damage, spell damage, and max HP — a jack-of-all-trades who can adapt to any opponent.',
  },
  {
    name: 'Warlock',
    bonuses: '+2 AGI, +2 INT',
    phys: '100%', spell: '110%', heal: '100%', crit: '100%', maxHp: '100%',
    spellName: 'Soul Drain',
    spellDesc: '8-14 magic damage + (-3 STR, -3 INT) for 3 turns',
    archetype: 'hybrid',
    description: 'A dark caster who weakens enemies while dealing damage. Soul Drain is the only class ability that both deals damage and applies debuffs, making Warlocks uniquely oppressive in sustained fights.',
  },
  {
    name: 'Wizard',
    bonuses: '+3 INT',
    phys: '100%', spell: '115%', heal: '100%', crit: '100%', maxHp: '100%',
    spellName: 'Arcane Blast',
    spellDesc: '12-20 magic damage',
    archetype: 'int',
    description: 'Pure magical devastation. Wizards have the highest spell damage multiplier in the game, making every spell hit significantly harder. Arcane Blast adds yet more burst damage to an already overwhelming arsenal.',
  },
  {
    name: 'Cleric',
    bonuses: '+2 INT, +10 HP',
    phys: '100%', spell: '100%', heal: '110%', crit: '100%', maxHp: '100%',
    spellName: 'Blessing',
    spellDesc: '+3 INT, +5 armor, +5 max HP for 3 turns',
    archetype: 'int',
    description: "The ultimate survivor. Clerics are the only class with a healing bonus, making their Heal spells significantly more effective. Blessing further boosts their defenses, turning Clerics into opponents that simply won't go down.",
  },
  {
    name: 'Sorcerer',
    bonuses: '+2 STR, +2 INT',
    phys: '100%', spell: '108%', heal: '100%', crit: '100%', maxHp: '105%',
    spellName: 'Arcane Surge',
    spellDesc: '10-16 magic damage',
    archetype: 'hybrid',
    description: 'A battle mage who pairs magical talent with physical resilience. Sorcerers get a modest spell boost and extra HP, making them sturdier than pure casters. Their split stat bonuses allow flexible builds.',
  },
];
