/**
 * Maps advanced class names to their bundled image paths.
 * Images are in /public/images/classes/ as optimized WebP files.
 */
const CLASS_IMAGES: Record<string, string> = {
  Warrior: '/images/classes/warrior.webp',
  Paladin: '/images/classes/paladin.webp',
  Ranger: '/images/classes/ranger.webp',
  Rogue: '/images/classes/rogue.webp',
  Warlock: '/images/classes/warlock.webp',
  Wizard: '/images/classes/wizard.webp',
  Cleric: '/images/classes/cleric.webp',
  Sorcerer: '/images/classes/sorcerer.webp',
  Druid: '/images/classes/druid.webp',
};

export const getClassImage = (name: string): string | undefined => {
  return CLASS_IMAGES[name];
};
