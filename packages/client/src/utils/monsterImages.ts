/**
 * Maps monster names to their bundled image paths.
 * Images are in /public/images/monsters/ as optimized WebP files.
 */
const MONSTER_IMAGES: Record<string, string> = {
  // Dark Cave (Zone 1)
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

  // Windy Peaks (Zone 2)
  'Ridge Stalker': '/images/monsters/ridge-stalker.webp',
  'Frost Wraith': '/images/monsters/frost-wraith.webp',
  'Granite Sentinel': '/images/monsters/granite-sentinel.webp',
  'Gale Phantom': '/images/monsters/gale-phantom.webp',
  'Blighthorn': '/images/monsters/blighthorn.webp',
  'Storm Shrike': '/images/monsters/storm-shrike.webp',
  'Hollow Scout': '/images/monsters/hollow-scout.webp',
  'Ironpeak Charger': '/images/monsters/ironpeak-charger.webp',
  'Peakfire Wraith': '/images/monsters/peakfire-wraith.webp',
  "Korrath's Warden": '/images/monsters/korraths-warden.webp',
};

const ipfsMonsterCache: Record<string, string> = {};

export const loadMonsterManifest = async (zoneName: string): Promise<void> => {
  try {
    const res = await fetch(`/images/manifests/${zoneName}-monsters.json`);
    if (!res.ok) return;
    const manifest: Record<string, { url: string }> = await res.json();
    for (const [name, entry] of Object.entries(manifest)) {
      ipfsMonsterCache[name] = entry.url;
    }
  } catch {
    // no-op
  }
};

export const getMonsterImage = (name: string): string | undefined => {
  return MONSTER_IMAGES[name] ?? ipfsMonsterCache[name];
};
