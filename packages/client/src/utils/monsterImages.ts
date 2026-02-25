/**
 * Maps monster names to their bundled image paths.
 * Images are in /public/images/monsters/ as optimized WebP files.
 */
const MONSTER_IMAGES: Record<string, string> = {
  'Cave Rat': '/images/monsters/cave-rat.webp',
  'Fungal Shaman': '/images/monsters/fungal-shaman.webp',
  'Cavern Brute': '/images/monsters/cavern-brute.webp',
  'Crystal Elemental': '/images/monsters/crystal-elemental.webp',
  'Cave Troll': '/images/monsters/cave-troll.webp',
  'Phase Spider': '/images/monsters/phase-spider.webp',
  'Lich Acolyte': '/images/monsters/lich-acolyte.webp',
  'Stone Giant': '/images/monsters/stone-giant.webp',
  'Shadow Stalker': '/images/monsters/shadow-stalker.webp',
  'Shadow Dragon': '/images/monsters/shadow-dragon.webp',
};

export const getMonsterImage = (name: string): string | undefined => {
  return MONSTER_IMAGES[name];
};
