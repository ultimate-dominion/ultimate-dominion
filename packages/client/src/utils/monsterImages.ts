/**
 * Maps monster names to their bundled image paths.
 * Images are in /public/images/monsters/ as optimized WebP files.
 */
const MONSTER_IMAGES: Record<string, string> = {
  'Dire Rat': '/images/monsters/dire-rat.webp',
  'Fungal Shaman': '/images/monsters/fungal-shaman.webp',
  'Cavern Brute': '/images/monsters/cavern-brute.webp',
  'Crystal Elemental': '/images/monsters/crystal-elemental.webp',
  'Ironhide Troll': '/images/monsters/ironhide-troll.webp',
  'Phase Spider': '/images/monsters/phase-spider.webp',
  'Bonecaster': '/images/monsters/bonecaster.webp',
  'Rock Golem': '/images/monsters/rock-golem.webp',
  'Pale Stalker': '/images/monsters/pale-stalker.webp',
  'Dusk Drake': '/images/monsters/dusk-drake.webp',
  'Basilisk': '/images/monsters/basilisk.webp',
};

export const getMonsterImage = (name: string): string | undefined => {
  return MONSTER_IMAGES[name];
};
