/**
 * Maps monster names to their bundled image paths.
 * Images are in /public/images/monsters/ as optimized WebP files.
 */
const MONSTER_IMAGES: Record<string, string> = {
  'Dire Rat': '/images/monsters/cave-rat.webp',
  'Fungal Shaman': '/images/monsters/fungal-shaman.webp',
  'Cavern Brute': '/images/monsters/cavern-brute.webp',
  'Crystal Elemental': '/images/monsters/crystal-elemental.webp',
  'Ironhide Troll': '/images/monsters/cave-troll.webp',
  'Phase Spider': '/images/monsters/phase-spider.webp',
  'Bonecaster': '/images/monsters/lich-acolyte.webp',
  'Rock Golem': '/images/monsters/stone-giant.webp',
  'Pale Stalker': '/images/monsters/shadow-stalker.webp',
  'Dusk Drake': '/images/monsters/shadow-dragon.webp',
  'Basilisk': '/images/monsters/shadow-dragon.webp',
};

export const getMonsterImage = (name: string): string | undefined => {
  return MONSTER_IMAGES[name];
};
