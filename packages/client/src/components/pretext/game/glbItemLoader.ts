/**
 * glbItemLoader.ts — Load 3D item models for weapon projectile rendering.
 *
 * Simpler than glbCreatureLoader: items don't animate. Each item gets a
 * cached Three.js scene that can be rendered at any rotation/angle into
 * a small offscreen canvas, then stamped onto the battle scene.
 *
 * Shares the WebGLRenderer from glbCreatureLoader to stay within browser
 * WebGL context limits.
 *
 * Flow:
 *   1. loadItemManifest() — fetch manifest.json once
 *   2. loadItemModel(slug) — load GLB, cache scene + camera
 *   3. drawItemProjectile() — render item at position with rotation
 */

import { getSharedRenderer } from './glbCreatureLoader';

// ---- Types ---------------------------------------------------------------

export interface ItemManifestEntry {
  name: string;
  file: string;
  category: 'weapons' | 'armor';
  subtype: string;
  rarity: number;
  socket: string;
  offset: [number, number, number];
  rotation: [number, number, number];
  scale: number;
}

interface ItemRenderState {
  loaded: boolean;
  scene: import('three').Scene | null;
  camera: import('three').OrthographicCamera | null;
  model: import('three').Object3D | null;
}

// ---- Caches ---------------------------------------------------------------

let manifest: Record<string, ItemManifestEntry> | null = null;
let manifestLoading = false;
const itemCache = new Map<string, ItemRenderState>();

// Size of the offscreen render for item projectiles (small = fast)
const ITEM_RENDER_SIZE = 96;

// Cached reference to the shared renderer (grabbed during first loadItemModel)
let _renderer: import('three').WebGLRenderer | null = null;
let _rendererTHREE: typeof import('three') | null = null;

// ---- Manifest loader ------------------------------------------------------

export async function loadItemManifest(): Promise<Record<string, ItemManifestEntry>> {
  if (manifest) return manifest;
  if (manifestLoading) {
    // Wait for in-flight load
    return new Promise((resolve) => {
      const check = setInterval(() => {
        if (manifest) { clearInterval(check); resolve(manifest); }
      }, 50);
    });
  }

  manifestLoading = true;
  try {
    const res = await fetch('/models/items/manifest.json');
    if (!res.ok) {
      console.warn('[glbItemLoader] manifest not found, items will use 2D fallback');
      manifest = {};
      return manifest;
    }
    manifest = await res.json();
    console.log('[glbItemLoader] manifest loaded:', Object.keys(manifest!).length, 'items');
    return manifest!;
  } catch {
    manifest = {};
    return manifest;
  } finally {
    manifestLoading = false;
  }
}

// ---- Toon material (matches creature loader for visual consistency) -------

async function makeToonGradient(THREE: typeof import('three')) {
  const gradData = new Uint8Array([
     8,   6,   5, 255,
    32,  28,  24, 255,
    72,  66,  60, 255,
   118, 108, 100, 255,
   168, 155, 142, 255,
   210, 198, 184, 255,
   245, 235, 222, 255,
  ]);
  const gradMap = new THREE.DataTexture(gradData, 7, 1);
  gradMap.minFilter = THREE.NearestFilter;
  gradMap.magFilter = THREE.NearestFilter;
  gradMap.needsUpdate = true;
  return gradMap;
}

function applyToonMaterials(
  model: import('three').Object3D,
  gradMap: import('three').DataTexture,
  THREE: typeof import('three'),
) {
  model.traverse((node) => {
    if (!(node as import('three').Mesh).isMesh) return;
    const mesh = node as import('three').Mesh;
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    const next = materials.map((m) => {
      const mat = m as import('three').MeshStandardMaterial;
      const albedoMap = mat.map ?? null;
      const baseColor = albedoMap
        ? new THREE.Color(0.82, 0.82, 0.82)
        : (() => {
            const c = mat.color ?? new THREE.Color(0.5, 0.5, 0.5);
            const lum = c.r * 0.299 + c.g * 0.587 + c.b * 0.114;
            return lum < 0.85 ? c.clone().multiplyScalar(0.85) : new THREE.Color(0.52, 0.50, 0.48);
          })();
      const toon = new THREE.MeshToonMaterial({
        color: baseColor,
        map: albedoMap,
        gradientMap: gradMap,
      });
      mat.dispose();
      return toon;
    });
    mesh.material = Array.isArray(mesh.material) ? next : next[0];
  });
}

// ---- Model loader ---------------------------------------------------------

/**
 * Load a single item's GLB model. Call per item slug.
 * Returns immediately if already cached/loading.
 */
export async function loadItemModel(slug: string): Promise<void> {
  if (itemCache.has(slug)) return;
  itemCache.set(slug, { loaded: false, scene: null, camera: null, model: null });

  const m = await loadItemManifest();
  const entry = m[slug];
  if (!entry?.file) {
    console.warn(`[glbItemLoader] no GLB for "${slug}"`);
    return;
  }

  const THREE = await import('three');
  const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');

  // Cache shared renderer reference for sync drawItemProjectile calls
  if (!_renderer) {
    _renderer = await getSharedRenderer();
    _rendererTHREE = THREE;
  }

  const url = `/models/items/${entry.file}`;
  const gltf = await new Promise<Awaited<ReturnType<typeof GLTFLoader.prototype.loadAsync>>>((resolve, reject) => {
    new GLTFLoader().load(url, resolve, undefined, reject);
  }).catch((err) => {
    console.error(`[glbItemLoader] failed to load ${url}:`, err);
    return null;
  });

  if (!gltf) return;

  const scene = new THREE.Scene();
  scene.background = null; // transparent — composited onto battle scene

  // Lighting (simpler than creatures — single key + ambient)
  const keyLight = new THREE.DirectionalLight(0xffffff, 2.0);
  keyLight.position.set(1.5, 2.0, 3.0);
  scene.add(keyLight);
  scene.add(new THREE.AmbientLight(0xffffff, 0.15));

  const model = gltf.scene;

  // Fit model to unit cube
  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z, 0.001);
  model.scale.setScalar(1.4 / maxDim);
  box.setFromObject(model);
  const center = box.getCenter(new THREE.Vector3());
  model.position.sub(center);

  const gradMap = await makeToonGradient(THREE);
  applyToonMaterials(model, gradMap, THREE);
  scene.add(model);

  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.01, 100);
  camera.position.set(0, 0, 5);
  camera.lookAt(0, 0, 0);

  console.log('[glbItemLoader] ready:', slug);
  itemCache.set(slug, { loaded: true, scene, camera, model });
}

// ---- Render function for projectile drawing -------------------------------

/**
 * Draw an item model as a projectile at (x, y) on the battle canvas.
 *
 * @param ctx       Battle scene canvas context
 * @param slug      Item slug (e.g. 'iron-axe')
 * @param x         Center X position on battle canvas
 * @param y         Center Y position on battle canvas
 * @param size      Display size in pixels (square)
 * @param rotation  Z rotation in radians (for spin effect)
 * @returns true if 3D model was drawn, false if not loaded (caller should use 2D fallback)
 */
export function drawItemProjectile(
  ctx: CanvasRenderingContext2D,
  slug: string,
  x: number,
  y: number,
  size: number,
  rotation: number,
): boolean {
  const state = itemCache.get(slug);
  if (!state?.loaded || !state.scene || !state.camera || !state.model) {
    // Kick off load if not started
    if (!itemCache.has(slug)) loadItemModel(slug).catch(() => {});
    return false;
  }

  // Rotate the model for spin effect
  state.model.rotation.z = rotation;
  state.model.rotation.y = rotation * 0.5; // slight Y rotation for depth

  // Render synchronously if renderer is ready (it will be if creatures loaded first)
  if (!_renderer) return false;

  const THREE = _rendererTHREE!;
  const prevSize = _renderer.getSize(new THREE.Vector2());

  // Render at small size with transparent background
  _renderer.setSize(ITEM_RENDER_SIZE, ITEM_RENDER_SIZE);
  _renderer.setClearColor(0x000000, 0);
  _renderer.render(state.scene, state.camera);

  // Stamp onto battle canvas
  const half = size / 2;
  ctx.drawImage(
    _renderer.domElement,
    x - half,
    y - half,
    size,
    size,
  );

  // Restore renderer size
  _renderer.setSize(prevSize.x, prevSize.y);

  return true;
}

/**
 * Check if an item's 3D model is loaded and ready to draw.
 */
export function isItemModelReady(slug: string): boolean {
  return itemCache.get(slug)?.loaded === true;
}

/**
 * Slugify an item name to match manifest keys.
 * Must match item-forge.mjs slugify().
 */
export function itemSlug(name: string): string {
  return name.toLowerCase().replace(/['']/g, '').replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
}
