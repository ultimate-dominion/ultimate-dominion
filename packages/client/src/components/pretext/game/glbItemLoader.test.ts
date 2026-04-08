import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Three.js — must be before import
vi.mock('three', () => ({
  Scene: vi.fn(),
  WebGLRenderer: vi.fn(),
  OrthographicCamera: vi.fn(),
  DirectionalLight: vi.fn().mockReturnValue({ position: { set: vi.fn() } }),
  AmbientLight: vi.fn(),
  Box3: vi.fn().mockReturnValue({
    setFromObject: vi.fn().mockReturnThis(),
    getSize: vi.fn().mockReturnValue({ x: 1, y: 1, z: 1 }),
    getCenter: vi.fn().mockReturnValue({ x: 0, y: 0, z: 0 }),
  }),
  Vector3: vi.fn(),
  Color: vi.fn(),
  DataTexture: vi.fn().mockReturnValue({ needsUpdate: false }),
  NearestFilter: 1,
  MeshToonMaterial: vi.fn(),
}));

vi.mock('three/examples/jsm/loaders/GLTFLoader.js', () => ({
  GLTFLoader: vi.fn().mockImplementation(() => ({
    load: vi.fn(),
  })),
}));

vi.mock('./glbCreatureLoader', () => ({
  getSharedRenderer: vi.fn().mockResolvedValue(null),
}));

describe('glbItemLoader', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
  });

  describe('itemSlug', () => {
    // Import fresh each time to avoid cache state leaking
    async function getItemSlug() {
      const mod = await import('./glbItemLoader');
      return mod.itemSlug;
    }

    it('lowercases and hyphenates spaces', async () => {
      const itemSlug = await getItemSlug();
      expect(itemSlug('Iron Axe')).toBe('iron-axe');
    });

    it('strips apostrophes and curly quotes', async () => {
      const itemSlug = await getItemSlug();
      expect(itemSlug("Troll's Bane")).toBe('trolls-bane');
      expect(itemSlug('Hunter\u2019s Bow')).toBe('hunters-bow');
    });

    it('removes non-alphanumeric characters', async () => {
      const itemSlug = await getItemSlug();
      expect(itemSlug('Staff of Fire!')).toBe('staff-of-fire');
    });

    it('collapses multiple spaces', async () => {
      const itemSlug = await getItemSlug();
      expect(itemSlug('Broken   Sword')).toBe('broken-sword');
    });

    it('handles empty string', async () => {
      const itemSlug = await getItemSlug();
      expect(itemSlug('')).toBe('');
    });

    it('handles already-slugified input', async () => {
      const itemSlug = await getItemSlug();
      expect(itemSlug('iron-axe')).toBe('iron-axe');
    });
  });

  describe('loadItemManifest', () => {
    it('returns fetched manifest on success', async () => {
      const fakeManifest = {
        'iron-axe': {
          name: 'Iron Axe',
          file: 'iron-axe.glb',
          category: 'weapons',
          subtype: 'axe',
          rarity: 1,
          socket: 'hand_R.socket',
          offset: [0, 0, 0],
          rotation: [0, 0, 0],
          scale: 1.0,
        },
      };

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(fakeManifest),
      }) as unknown as typeof fetch;

      const { loadItemManifest } = await import('./glbItemLoader');
      const result = await loadItemManifest();
      expect(result).toEqual(fakeManifest);
      expect(fetch).toHaveBeenCalledWith('/models/items/manifest.json');
    });

    it('returns empty object on 404', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
      }) as unknown as typeof fetch;

      const { loadItemManifest } = await import('./glbItemLoader');
      const result = await loadItemManifest();
      expect(result).toEqual({});
    });

    it('returns empty object on network error', async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(
        new Error('network error'),
      ) as unknown as typeof fetch;

      const { loadItemManifest } = await import('./glbItemLoader');
      const result = await loadItemManifest();
      expect(result).toEqual({});
    });
  });

  describe('isItemModelReady', () => {
    it('returns false for unknown slug', async () => {
      const { isItemModelReady } = await import('./glbItemLoader');
      expect(isItemModelReady('nonexistent')).toBe(false);
    });
  });

  describe('getItemModel', () => {
    it('returns null for unknown slug', async () => {
      const { getItemModel } = await import('./glbItemLoader');
      expect(getItemModel('nonexistent')).toBeNull();
    });
  });
});
