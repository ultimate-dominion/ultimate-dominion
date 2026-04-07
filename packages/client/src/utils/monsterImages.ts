/**
 * Maps monster names to their bundled image paths.
 * Most monsters now use ASCII rendering via monsterTemplatesRedux.ts.
 * This map is only for legacy webp portraits that still exist.
 */
const MONSTER_IMAGES: Record<string, string> = {
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
