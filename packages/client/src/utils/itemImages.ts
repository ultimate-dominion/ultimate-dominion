/**
 * Maps item names to their bundled image paths.
 * Images are in /public/images/items/ as PNG files.
 */
const ITEM_IMAGES: Record<string, string> = {
  'Broken Sword': '/images/items/broken-sword.png',
  'Worn Shortbow': '/images/items/worn-shortbow.png',
  'Cracked Wand': '/images/items/cracked-wand.png',
  'Hunting Bow': '/images/items/hunting-bow.png',
  'Apprentice Staff': '/images/items/apprentice-staff.png',
  'Steel Mace': '/images/items/steel-mace.png',
  'Recurve Bow': '/images/items/recurve-bow.png',
  'Channeling Rod': '/images/items/channeling-rod.png',
  'Runesword': '/images/items/runesword.png',
  'Warhammer': '/images/items/warhammer.png',
  'Longbow': '/images/items/longbow.png',
};

export const getItemImage = (name: string): string | undefined => {
  return ITEM_IMAGES[name];
};
