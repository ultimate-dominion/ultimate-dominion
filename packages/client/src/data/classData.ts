import { AdvancedClass, ADVANCED_CLASS_COLORS } from '../utils/types';
import { getClassImage } from '../utils/classImages';

export interface ClassPageData {
  name: string;
  slug: string;
  enumValue: AdvancedClass;
  icon: string;
  color: string;
  archetype: 'Strength' | 'Agility' | 'Intelligence' | 'Hybrid';
  flatBonuses: string;
  multipliers: { phys: string; spell: string; heal: string; crit: string; maxHp: string };
  spellName: string;
  spellDesc: string;
  description: string;
  lore: string;
  playstyle: string;
  strengths: string[];
  weaknesses: string[];
  image?: string;
}

export const CLASS_DATA: ClassPageData[] = [
  {
    name: 'Warrior',
    slug: 'warrior',
    enumValue: AdvancedClass.Warrior,
    icon: '⚔️',
    color: ADVANCED_CLASS_COLORS[AdvancedClass.Warrior],
    archetype: 'Strength',
    flatBonuses: '+3 STR, +10 HP',
    multipliers: { phys: '110%', spell: '100%', heal: '100%', crit: '100%', maxHp: '100%' },
    spellName: 'Battle Cry',
    spellDesc: '+4 STR, +3 Armor for 3 turns',
    description: 'The frontline bruiser. Warriors deal the highest physical damage and get bonus health to soak hits. Their Battle Cry further amplifies their strength and toughness in prolonged fights.',
    lore: 'No divine blessing. No arcane trick. Just iron discipline and the will to keep swinging when others fall. Warriors are forged in the Dark Cave, where survival rewards nothing but the chance to fight again.',
    playstyle: 'Warriors excel at sustained physical damage. Stack STR gear to maximize the 110% physical multiplier — every point of weapon damage hits harder than any other class. Battle Cry turns you into an armored battering ram for three turns, ideal for burning down tough monsters or overpowering PvP opponents.',
    strengths: ['Highest physical damage multiplier (110%)', 'Bonus HP for survivability', 'Battle Cry provides both offense and defense'],
    weaknesses: ['No magic scaling', 'No healing bonus', 'Reliant on physical weapons'],
    image: getClassImage('Warrior'),
  },
  {
    name: 'Paladin',
    slug: 'paladin',
    enumValue: AdvancedClass.Paladin,
    icon: '🛡️',
    color: ADVANCED_CLASS_COLORS[AdvancedClass.Paladin],
    archetype: 'Strength',
    flatBonuses: '+2 STR, +15 HP',
    multipliers: { phys: '105%', spell: '100%', heal: '105%', crit: '100%', maxHp: '100%' },
    spellName: 'Divine Shield',
    spellDesc: '+5 Armor, +3 STR for 3 turns',
    description: 'A holy warrior who trades raw damage for durability. The Paladin has the highest base HP bonus of any class and a slight boost to both physical damage and healing. Divine Shield makes them extremely hard to kill.',
    lore: 'There are those who pray and those who answer. Paladins heard something in the dark — not the whisper of the Weave, but something older. They fight not for glory, but because something told them they must.',
    playstyle: 'Paladins are the tankiest class in the game. With +15 HP and Divine Shield stacking armor, you can outlast almost anything. The 105% physical and healing multipliers make you a well-rounded fighter who heals effectively and deals respectable damage. Ideal for players who want to survive everything.',
    strengths: ['Highest HP bonus of any class (+15)', 'Divine Shield provides massive armor', 'Slight healing boost makes potions more effective'],
    weaknesses: ['Lower physical multiplier than Warrior/Ranger', 'No crit or spell scaling', 'Jack-of-trades offense'],
    image: getClassImage('Paladin'),
  },
  {
    name: 'Ranger',
    slug: 'ranger',
    enumValue: AdvancedClass.Ranger,
    icon: '🏹',
    color: ADVANCED_CLASS_COLORS[AdvancedClass.Ranger],
    archetype: 'Agility',
    flatBonuses: '+3 AGI',
    multipliers: { phys: '110%', spell: '100%', heal: '100%', crit: '100%', maxHp: '100%' },
    spellName: "Hunter's Mark",
    spellDesc: '-5 AGI, -2 Armor on enemy for 4 turns',
    description: "A precise striker who exploits the combat triangle. Rangers match Warriors in physical damage but focus on agility instead of bulk. Hunter's Mark cripples evasive enemies, making them vulnerable to follow-up attacks.",
    lore: "Rangers move through the Dark Cave like they were born in it. They don't charge — they wait, they watch, and when the moment comes, they don't miss. Some say they learned patience from the cave itself.",
    playstyle: "Rangers bring the same 110% physical damage as Warriors but through AGI instead of STR. This means higher evasion, more double-strike procs, and AGI-based crit bonuses. Hunter's Mark is devastating — stripping 5 AGI and 2 Armor for four turns makes even the toughest enemies vulnerable. Best for players who want offensive power with evasive survivability.",
    strengths: ['Matches Warrior physical damage (110%)', "Hunter's Mark is the longest debuff (4 turns)", 'AGI build benefits from evasion and double strike'],
    weaknesses: ['No HP bonus', 'No magic scaling', 'Lower base damage per hit than STR builds'],
    image: getClassImage('Ranger'),
  },
  {
    name: 'Rogue',
    slug: 'rogue',
    enumValue: AdvancedClass.Rogue,
    icon: '🗡️',
    color: ADVANCED_CLASS_COLORS[AdvancedClass.Rogue],
    archetype: 'Agility',
    flatBonuses: '+2 AGI, +1 INT',
    multipliers: { phys: '100%', spell: '100%', heal: '100%', crit: '115%', maxHp: '100%' },
    spellName: 'Shadowstep',
    spellDesc: '+8 AGI for 2 turns',
    description: 'The critical strike specialist. Rogues have the highest crit multiplier in the game, turning every fight into a gamble that favors them. Shadowstep gives a massive evasion spike for two crucial turns.',
    lore: 'The Cave rewards those who strike first and ask nothing. Rogues understand this better than anyone. They take what they want and vanish before the darkness can take it back.',
    playstyle: 'Rogues live and die by critical hits. With 115% crit damage — the highest in the game — every crit is devastating. Shadowstep gives +8 AGI for 2 turns, making you nearly untouchable and dramatically increasing double-strike chances. The +1 INT bonus adds a small magic edge. High risk, high reward.',
    strengths: ['Highest crit multiplier (115%)', 'Shadowstep provides massive AGI spike', 'Dual AGI+INT bonuses for build flexibility'],
    weaknesses: ['No base physical or spell damage multiplier', 'Inconsistent without crits', 'Shadowstep lasts only 2 turns'],
    image: getClassImage('Rogue'),
  },
  {
    name: 'Druid',
    slug: 'druid',
    enumValue: AdvancedClass.Druid,
    icon: '🌿',
    color: ADVANCED_CLASS_COLORS[AdvancedClass.Druid],
    archetype: 'Hybrid',
    flatBonuses: '+2 AGI, +2 STR',
    multipliers: { phys: '105%', spell: '105%', heal: '100%', crit: '100%', maxHp: '105%' },
    spellName: 'Entangle',
    spellDesc: '-5 AGI, -3 STR on enemy for 3 turns',
    description: 'A versatile hybrid who blends physical and magical prowess. The Druid is the only class with bonuses to physical damage, spell damage, and max HP — a jack-of-all-trades who can adapt to any opponent.',
    lore: 'Where others see stone and shadow, Druids see a living ecosystem. The Dark Cave breathes, they say. It remembers. And if you learn to listen, it fights alongside you.',
    playstyle: 'Druids are the ultimate generalists. 105% physical, 105% spell, and 105% max HP means you benefit from every type of gear. Entangle cripples both AGI and STR for 3 turns, making it effective against almost any opponent. Build STR/AGI hybrid and let the multipliers do the work.',
    strengths: ['Only class with phys + spell + HP multipliers', 'Entangle debuffs two stats at once', 'Flexible — benefits from any gear combination'],
    weaknesses: ['Master of none — no multiplier above 105%', 'No healing or crit bonuses', 'Outspecialized by focused classes'],
    image: getClassImage('Druid'),
  },
  {
    name: 'Warlock',
    slug: 'warlock',
    enumValue: AdvancedClass.Warlock,
    icon: '🔮',
    color: ADVANCED_CLASS_COLORS[AdvancedClass.Warlock],
    archetype: 'Hybrid',
    flatBonuses: '+2 AGI, +2 INT',
    multipliers: { phys: '100%', spell: '110%', heal: '100%', crit: '100%', maxHp: '100%' },
    spellName: 'Soul Drain',
    spellDesc: '8-14 magic damage + (-3 STR, -3 INT) for 3 turns',
    description: 'A dark caster who weakens enemies while dealing damage. Soul Drain is the only class ability that both deals damage and applies debuffs, making Warlocks uniquely oppressive in sustained fights.',
    lore: 'The Weave offers power freely — if you know where to look and what to sacrifice. Warlocks found the thread that connects all living things in the Cave, and they learned to pull it loose.',
    playstyle: 'Warlocks are sustained-fight specialists. Soul Drain is unique — it deals 8-14 magic damage AND applies stat debuffs, giving you tempo and attrition in a single cast. The 110% spell multiplier rewards INT-heavy builds. AGI+INT flat bonuses mean solid evasion alongside strong magic. Excellent in long PvP fights.',
    strengths: ['Soul Drain deals damage AND debuffs (unique)', '110% spell damage multiplier', 'AGI+INT bonuses for evasion + magic'],
    weaknesses: ['No physical damage boost', 'No HP bonus', 'Soul Drain damage is modest compared to Wizard burst'],
    image: getClassImage('Warlock'),
  },
  {
    name: 'Wizard',
    slug: 'wizard',
    enumValue: AdvancedClass.Wizard,
    icon: '📖',
    color: ADVANCED_CLASS_COLORS[AdvancedClass.Wizard],
    archetype: 'Intelligence',
    flatBonuses: '+3 INT',
    multipliers: { phys: '100%', spell: '115%', heal: '100%', crit: '100%', maxHp: '100%' },
    spellName: 'Arcane Blast',
    spellDesc: '12-20 magic damage',
    description: 'Pure magical devastation. Wizards have the highest spell damage multiplier in the game, making every spell hit significantly harder. Arcane Blast adds yet more burst damage to an already overwhelming arsenal.',
    lore: 'The Weave runs through the Dark Cave like blood through veins. Wizards don\'t just tap it — they rip it open. Every Arcane Blast tears a small hole in the fabric of the cave itself. The cave heals. Eventually.',
    playstyle: 'Wizards are glass cannons. 115% spell damage is the highest in the game, and Arcane Blast (12-20 magic damage) stacks on top for enormous burst. Every point of INT and every spell-damage weapon hits harder on a Wizard than on anyone else. Stack INT, blow things up, end fights fast.',
    strengths: ['Highest spell multiplier (115%)', 'Arcane Blast deals massive burst damage (12-20)', 'Pure INT scaling — simple and devastating'],
    weaknesses: ['No HP, armor, or healing bonus', 'No physical damage scaling', 'Fragile — must win fast or risk attrition'],
    image: getClassImage('Wizard'),
  },
  {
    name: 'Cleric',
    slug: 'cleric',
    enumValue: AdvancedClass.Cleric,
    icon: '✨',
    color: ADVANCED_CLASS_COLORS[AdvancedClass.Cleric],
    archetype: 'Intelligence',
    flatBonuses: '+2 INT, +10 HP',
    multipliers: { phys: '100%', spell: '100%', heal: '110%', crit: '100%', maxHp: '100%' },
    spellName: 'Blessing',
    spellDesc: '+3 INT, +5 Armor, +5 Max HP for 3 turns',
    description: "The ultimate survivor. Clerics are the only class with a healing bonus, making their Heal spells significantly more effective. Blessing further boosts their defenses, turning Clerics into opponents that simply won't go down.",
    lore: 'In the Dark Cave, healing is an act of defiance. Every wound the cave inflicts, the Cleric undoes. They are living proof that the darkness does not always win — and the cave does not forgive them for it.',
    playstyle: 'Clerics are the only class with a healing multiplier (110%), making every heal spell and potion more effective. Blessing stacks INT, armor, and max HP for three turns, making you progressively harder to kill. With +10 HP baseline and a defense-stacking spell, Clerics win by refusing to die. Excellent for long PvE grinds.',
    strengths: ['Only class with healing multiplier (110%)', 'Blessing stacks three defensive buffs at once', '+10 HP baseline for durability'],
    weaknesses: ['No damage multipliers (phys or spell)', 'Slow kill speed', 'Outpaced by damage classes in short fights'],
    image: getClassImage('Cleric'),
  },
  {
    name: 'Sorcerer',
    slug: 'sorcerer',
    enumValue: AdvancedClass.Sorcerer,
    icon: '💪',
    color: ADVANCED_CLASS_COLORS[AdvancedClass.Sorcerer],
    archetype: 'Hybrid',
    flatBonuses: '+2 STR, +2 INT',
    multipliers: { phys: '100%', spell: '108%', heal: '100%', crit: '100%', maxHp: '105%' },
    spellName: 'Arcane Surge',
    spellDesc: '10-16 magic damage',
    description: 'A battle mage who pairs magical talent with physical resilience. Sorcerers get a modest spell boost and extra HP, making them sturdier than pure casters. Their split stat bonuses allow flexible builds.',
    lore: 'Where Wizards channel the Weave through careful study, Sorcerers channel it through sheer force of will — and muscle. They punch the magic into shape. It\'s not elegant, but it works.',
    playstyle: 'Sorcerers split the difference between caster and brawler. 108% spell damage and 105% max HP means you hit decently hard with magic while being harder to kill than a Wizard. STR+INT flat bonuses let you build hybrid — physical weapon with spell support, or full INT with STR for defense. Arcane Surge (10-16) adds reliable burst.',
    strengths: ['Spell damage + HP multiplier combo', 'STR+INT bonuses for hybrid builds', 'Sturdier than pure casters'],
    weaknesses: ['Spell multiplier lower than Wizard/Warlock', 'No physical damage multiplier despite STR bonus', 'Jack-of-trades caster'],
    image: getClassImage('Sorcerer'),
  },
];

/** Look up class data by slug (URL-safe lowercase name) */
export const getClassBySlug = (slug: string): ClassPageData | undefined =>
  CLASS_DATA.find(c => c.slug === slug.toLowerCase());

/** All valid class slugs for routing */
export const CLASS_SLUGS = CLASS_DATA.map(c => c.slug);
