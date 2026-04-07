/**
 * glbCreatureLoader.ts — Three.js GLB → ASCII pipeline bridge
 *
 * Loads a .glb model asynchronously (dynamic import so Three.js doesn't hit
 * the initial bundle), then returns a sync draw function compatible with the
 * MonsterTemplate draw interface: (ctx, w, h) => void
 *
 * While loading, the provided fallbackDraw is used so the ASCII renderer
 * always has something to show.
 *
 * One shared WebGLRenderer instance is reused across all creatures to stay
 * within browser WebGL context limits.
 */

// ---- Shared WebGL renderer (created once, reused) -------------------------

let _sharedRenderer: import('three').WebGLRenderer | null = null;
let _rendererReady = false;

async function getSharedRenderer(): Promise<import('three').WebGLRenderer> {
  if (_sharedRenderer && _rendererReady) return _sharedRenderer;

  console.log('[glbCreatureLoader] creating shared WebGL renderer');
  const THREE = await import('three');
  _sharedRenderer = new THREE.WebGLRenderer({
    antialias: false,
    preserveDrawingBuffer: true, // required for ctx.drawImage to work
    alpha: false,
  });
  _sharedRenderer.setSize(512, 512);
  _sharedRenderer.setPixelRatio(1); // never 2x — no benefit for ASCII sampling
  _sharedRenderer.toneMapping = THREE.NoToneMapping;
  _sharedRenderer.outputColorSpace = THREE.LinearSRGBColorSpace;
  _sharedRenderer.shadowMap.enabled = false;
  _rendererReady = true;
  return _sharedRenderer;
}

// ---- Toon gradient (7-stop, matches creature lab) -------------------------

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

// ---- Material pass --------------------------------------------------------

function applyToonMaterials(
  model: import('three').Object3D,
  toonGradMap: import('three').DataTexture,
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
        gradientMap: toonGradMap,
      });
      mat.dispose();
      return toon;
    });
    mesh.material = Array.isArray(mesh.material) ? next : next[0];
  });
}

// ---- Auto-fit model into world units -------------------------------------

function fitModel(model: import('three').Object3D, THREE: typeof import('three'), targetHeight = 1.8) {
  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  const scale = targetHeight / Math.max(size.y, size.x * 0.5, 0.001);
  model.scale.setScalar(scale);
  box.setFromObject(model);
  const center = box.getCenter(new THREE.Vector3());
  model.position.sub(center);
  model.position.y -= box.getSize(new THREE.Vector3()).y * 0.08;
}

// ---- Clip normalisation (mirrors glb-loader.js) --------------------------

const CLIP_MAP: { keys: string[]; target: string }[] = [
  { keys: ['idle', 'breathing', 'breath', 'stand', 'floating', 'alert', 'look', 'awaken', 'inactive', 'spawn'], target: 'idle' },
  { keys: ['attack', 'bite', 'swing', 'slash', 'strike', 'chop', 'punch', 'kick', 'bark', 'snap', 'pounce', 'claw', 'headbutt'], target: 'attack' },
  { keys: ['hit', 'hurt', 'damage', 'impact', 'flinch', 'hitreact'], target: 'hit' },
  { keys: ['death', 'die', 'dead', 'fall', 'dying'], target: 'death' },
  { keys: ['walk', 'run', 'move', 'crawl', 'sneak', 'trot', 'gallop', 'jump', 'leap'], target: 'walk' },
];

function normaliseClipName(rawName: string): string {
  const lower = rawName.replace(/^[^|]+\|/, '').toLowerCase();
  for (const { keys, target } of CLIP_MAP) {
    if (keys.some((k) => lower.includes(k))) return target;
  }
  return rawName;
}

// ---- Per-creature state ---------------------------------------------------

interface CreatureState {
  loaded: boolean;
  drawFn: ((ctx: CanvasRenderingContext2D, w: number, h: number) => void) | null;
  /** Play a named clip (idle/attack/hit/death/walk). Only available after load. */
  playClip?: (name: string, fadeTime?: number) => void;
  /** The Three.js model root — needed for bone attachment */
  model?: import('three').Object3D;
}

const creatureCache = new Map<string, CreatureState>();

// ---- Weapon attachment ----------------------------------------------------

/**
 * Attach a weapon mesh to the RightHand bone of a loaded creature model.
 * The weapon inherits all animation transforms (idle sway, attack swing, etc.)
 * automatically because it becomes a child of the bone.
 *
 * @returns true if attachment succeeded, false if bone not found
 */
export function attachWeapon(
  model: import('three').Object3D,
  weaponMesh: import('three').Object3D,
): boolean {
  // Meshy rigged models use Mixamo skeleton — RightHand is always present
  const rightHand = model.getObjectByName('RightHand');
  if (!rightHand) {
    console.warn('[glbCreatureLoader] RightHand bone not found — cannot attach weapon');
    return false;
  }
  rightHand.add(weaponMesh);
  return true;
}

/**
 * Get a loaded creature's state (for external animation control / weapon attachment).
 * Returns null if not yet loaded.
 */
export function getCreatureState(url: string): CreatureState | null {
  const state = creatureCache.get(url);
  if (!state?.loaded) return null;
  return state;
}

// ---- Main loader ---------------------------------------------------------

/**
 * Load a .glb model and set up a sync draw function for it.
 * Call once per creature type — subsequent calls return the cached state.
 *
 * @param url            Public URL of the .glb file (e.g. '/models/creatures/dire-rat.glb')
 * @param gridW / gridH  Creature grid dimensions (for camera aspect)
 * @param yaw            Y rotation in radians for 3/4 left-facing view (default: -Math.PI * 0.33)
 * @param pitch          X rotation for slight look-down (default: -0.08)
 * @param opts.playerMode  If true, disable auto-attack loop and face right (+yaw)
 */
export async function loadGLBCreature(
  url: string,
  gridW: number,
  gridH: number,
  yaw = -Math.PI * 0.33,
  pitch = -0.08,
  opts?: { playerMode?: boolean },
): Promise<void> {
  if (creatureCache.has(url)) return;

  console.log('[glbCreatureLoader] loading', url);
  const isPlayer = opts?.playerMode ?? false;

  // Reserve slot immediately so concurrent callers don't double-load
  creatureCache.set(url, { loaded: false, drawFn: null });

  const THREE = await import('three');
  const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');
  const renderer = await getSharedRenderer();

  const gltf = await new Promise<Awaited<ReturnType<typeof GLTFLoader.prototype.loadAsync>>>((resolve, reject) => {
    new GLTFLoader().load(url, resolve, undefined, reject);
  });

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0, 0, 0);

  const keyLight = new THREE.DirectionalLight(0xffffff, 1.8);
  keyLight.position.set(1.5, 2.0, 3.0);
  scene.add(keyLight);
  const fillLight = new THREE.DirectionalLight(0xffffff, 0.25);
  fillLight.position.set(-1.2, -0.5, 1.5);
  scene.add(fillLight);
  scene.add(new THREE.AmbientLight(0xffffff, 0.10));

  const model = gltf.scene;
  fitModel(model, THREE);
  model.rotation.order = 'YXZ';
  model.rotation.y = yaw;
  model.rotation.x = pitch;

  const gradMap = await makeToonGradient(THREE);
  applyToonMaterials(model, gradMap, THREE);
  scene.add(model);

  const vH = 2.2;
  const vW = vH * (gridW / gridH);
  const camera = new THREE.OrthographicCamera(-vW / 2, vW / 2, vH / 2, -vH / 2, 0.01, 100);
  camera.position.set(0, 0, 5);
  camera.lookAt(0, 0, 0);

  // Animation mixer + clips
  const mixer = new THREE.AnimationMixer(model);
  const actions: Record<string, import('three').AnimationAction> = {};

  gltf.animations.forEach((clip: import('three').AnimationClip) => {
    const target = normaliseClipName(clip.name);
    if (!actions[target]) {
      const action = mixer.clipAction(clip);
      if (['attack', 'hit', 'death'].includes(target)) {
        action.loop = THREE.LoopOnce;
        action.clampWhenFinished = target === 'death';
      }
      actions[target] = action;
    }
    // Also store by raw stripped name for direct access
    const stripped = clip.name.replace(/^[^|]+\|/, '');
    if (!actions[stripped]) actions[stripped] = mixer.clipAction(clip);
  });

  // Start idle
  let currentAction = actions['idle'] ?? Object.values(actions)[0] ?? null;
  currentAction?.play();

  // Auto-attack loop: play attack every 4 seconds during idle (monsters only)
  let lastAttackTime = performance.now();
  const ATTACK_INTERVAL_MS = 4000;

  function playClip(name: string, fadeTime = 0.15) {
    const next = actions[name];
    if (!next || next === currentAction) return;
    if (currentAction) currentAction.crossFadeTo(next, fadeTime, false);
    if (next.loop === THREE.LoopOnce) next.reset();
    next.play();
    currentAction = next;

    if (['attack', 'hit', 'walk'].includes(name)) {
      const onFinish = (e: { action: import('three').AnimationAction }) => {
        if (e.action !== next) return;
        mixer.removeEventListener('finished', onFinish);
        playClip('idle', 0.22);
      };
      mixer.addEventListener('finished', onFinish);
    }
  }

  let lastRenderMs = performance.now();

  const drawFn = (ctx: CanvasRenderingContext2D, w: number, h: number) => {
    const now = performance.now();
    const delta = Math.min((now - lastRenderMs) / 1000, 0.1); // cap at 100ms
    lastRenderMs = now;

    mixer.update(delta);

    // Trigger attack animation periodically (monster auto-attack only)
    if (!isPlayer && now - lastAttackTime > ATTACK_INTERVAL_MS && actions['attack']) {
      lastAttackTime = now;
      playClip('attack');
    }

    // Resize renderer if canvas dimensions changed
    const sz = renderer.getSize(new THREE.Vector2());
    if (sz.x !== w || sz.y !== h) {
      renderer.setSize(w, h);
      const newW = vH * (w / h);
      camera.left = -newW / 2;
      camera.right = newW / 2;
      camera.updateProjectionMatrix();
    }

    renderer.render(scene, camera);
    ctx.drawImage(renderer.domElement, 0, 0, w, h);
  };

  console.log('[glbCreatureLoader] ready', url, '— clips:', Object.keys(actions).join(', '), isPlayer ? '(player)' : '');
  creatureCache.set(url, { loaded: true, drawFn, playClip, model });
}

/**
 * Create a MonsterTemplate-compatible draw function for a GLB creature.
 * Kicks off async loading on first call; uses fallbackDraw until ready.
 *
 * @param url          Public URL of the .glb file
 * @param gridW/gridH  Grid dimensions
 * @param fallbackDraw 2D canvas fallback while GLB loads (~1-2s)
 */
export function makeGLBDrawFn(
  url: string,
  gridW: number,
  gridH: number,
  fallbackDraw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void,
  yaw?: number,
): (ctx: CanvasRenderingContext2D, w: number, h: number) => void {
  let loadStarted = false;

  return function drawGLBCreature(ctx: CanvasRenderingContext2D, w: number, h: number) {
    const state = creatureCache.get(url);

    if (state?.loaded && state.drawFn) {
      state.drawFn(ctx, w, h);
      return;
    }

    // Fallback while loading
    fallbackDraw(ctx, w, h);

    if (!loadStarted) {
      loadStarted = true;
      loadGLBCreature(url, gridW, gridH, yaw).catch((err) => {
        console.error('[glbCreatureLoader] FAILED to load', url, err);
      });
    }
  };
}
