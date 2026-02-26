/**
 * Maps item names to their bundled image paths.
 * Images are in /public/images/items/ as PNG files.
 */
const ITEM_IMAGES: Record<string, string> = {
  'Broken Sword': '/images/items/broken-sword.png',
  'Worn Shortbow': '/images/items/worn-shortbow.png',
  'Cracked Wand': '/images/items/cracked-wand.png',
  'Hunting Bow': '/images/items/hunting-bow.png',
  'Iron Axe': '/images/items/iron-axe.png',
  'Apprentice Staff': '/images/items/apprentice-staff.png',
  'Steel Mace': '/images/items/steel-mace.png',
  'Recurve Bow': '/images/items/recurve-bow.png',
  'Channeling Rod': '/images/items/channeling-rod.png',
  'Runesword': '/images/items/runesword.png',
  'Warhammer': '/images/items/warhammer.png',
  'Longbow': '/images/items/longbow.png',
  "Rat King's Fang": '/images/items/rat-kings-fang.png',
  'Sporecap Wand': '/images/items/sporecap-wand.png',
  "Brute's Cleaver": '/images/items/brutes-cleaver.png',
  'Crystal Blade': '/images/items/crystal-blade.png',
  "Troll's Bonebreaker": '/images/items/trolls-bonebreaker.png',
  'Webspinner Bow': '/images/items/webspinner-bow.png',
  'Necrotic Staff': '/images/items/necrotic-staff.png',
  'Earthshaker Maul': '/images/items/earthshaker-maul.png',
  'Dragonfire Scepter': '/images/items/dragonfire-scepter.png',
};

export const getItemImage = (name: string): string | undefined => {
  return ITEM_IMAGES[name];
};
