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

export async function getSharedRenderer(): Promise<import('three').WebGLRenderer> {
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
    40,  36,  32, 255,   // shadow — lifted from near-black
    72,  65,  58, 255,
   110, 100,  92, 255,
   150, 138, 128, 255,
   190, 178, 165, 255,
   225, 215, 200, 255,
   250, 242, 230, 255,
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
  { keys: ['block', 'guard', 'defend', 'shield', 'parry', 'brace'], target: 'block' },
  { keys: ['dodge', 'evade', 'sidestep', 'roll', 'duck', 'avoid'], target: 'dodge' },
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
  /** Play a named clip (idle/attack/hit/death/walk/block/dodge). Only available after load. */
  playClip?: (name: string, fadeTime?: number) => void;
  /** The Three.js model root — needed for bone attachment */
  model?: import('three').Object3D;
}

const creatureCache = new Map<string, CreatureState>();

// ---- Equipment socket attachment ------------------------------------------

/**
 * Bone name candidates for each standard socket.
 * Tries socket node first (from creature-edit.mjs add-sockets), then falls
 * back to raw bone names from Mixamo, UniRig, and our standard convention.
 */
const SOCKET_BONE_CANDIDATES: Record<string, string[]> = {
  'hand_R.socket': ['hand_R.socket', 'hand_R', 'RightHand', 'mixamorig:RightHand'],
  'hand_L.socket': ['hand_L.socket', 'hand_L', 'LeftHand', 'mixamorig:LeftHand'],
  'chest.socket':  ['chest.socket', 'chest', 'Spine2', 'Spine02', 'mixamorig:Spine2'],
  'head.socket':   ['head.socket', 'head', 'Head', 'mixamorig:Head'],
  'back.socket':   ['back.socket', 'chest', 'Spine2', 'Spine02', 'mixamorig:Spine2'],
};

/**
 * Attach a mesh to any bone socket on a creature model.
 * Searches socket node first, then known bone name variants.
 *
 * @param socketName  Standard socket name (e.g. 'hand_R.socket', 'chest.socket')
 * @returns true if attachment succeeded, false if no matching bone found
 */
export function attachToSocket(
  model: import('three').Object3D,
  mesh: import('three').Object3D,
  socketName: string,
): boolean {
  const candidates = SOCKET_BONE_CANDIDATES[socketName] ?? [socketName];
  for (const name of candidates) {
    const node = model.getObjectByName(name);
    if (node) {
      node.add(mesh);
      return true;
    }
  }
  console.warn(`[glbCreatureLoader] Socket "${socketName}" not found in model`);
  return false;
}

/**
 * Attach a weapon mesh to the RightHand bone (convenience wrapper).
 * @deprecated Use attachToSocket(model, mesh, 'hand_R.socket') instead
 */
export function attachWeapon(
  model: import('three').Object3D,
  weaponMesh: import('three').Object3D,
): boolean {
  return attachToSocket(model, weaponMesh, 'hand_R.socket');
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

  const keyLight = new THREE.DirectionalLight(0xffffff, 2.2);
  keyLight.position.set(1.5, 2.0, 3.0);
  scene.add(keyLight);
  const fillLight = new THREE.DirectionalLight(0xffffff, 0.6);
  fillLight.position.set(-1.2, -0.5, 1.5);
  scene.add(fillLight);
  scene.add(new THREE.AmbientLight(0xffffff, 0.40));

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
    if (!next) return;

    // Back-to-back LoopOnce clips (e.g. two attacks in quick succession) need
    // to restart from frame 0, otherwise the second call is a silent no-op
    // because `next === currentAction`. Re-seat the action time and replay
    // without re-registering a finish listener — the original listener is
    // still alive and will self-remove on the next finish event.
    if (next === currentAction) {
      if (next.loop === THREE.LoopOnce) {
        next.reset();
        next.play();
      }
      return;
    }

    if (currentAction) currentAction.crossFadeTo(next, fadeTime, false);
    if (next.loop === THREE.LoopOnce) next.reset();
    next.play();
    currentAction = next;

    if (['attack', 'hit', 'walk', 'block', 'dodge'].includes(name)) {
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
 * Draw function that also carries the source GLB URL as a property, so the
 * battle scene can look the creature up (e.g. to trigger `playClip('attack')`
 * on a monster counterattack) without wiring the URL through every call site.
 */
export type GLBDrawFn = ((ctx: CanvasRenderingContext2D, w: number, h: number) => void) & {
  glbUrl: string;
  glbGridW: number;
  glbGridH: number;
  glbYaw?: number;
};

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
): GLBDrawFn {
  let loadStarted = false;

  const drawFn = function drawGLBCreature(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
  ) {
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
  } as GLBDrawFn;

  drawFn.glbUrl = url;
  drawFn.glbGridW = gridW;
  drawFn.glbGridH = gridH;
  drawFn.glbYaw = yaw;
  return drawFn;
}

/**
 * Narrow a plain draw fn to `GLBDrawFn` if it carries the `glbUrl` property.
 * Returns null for procedural (non-GLB) draw fns like `drawGelatinousOozeRedux`.
 */
export function asGLBDrawFn(
  draw: ((ctx: CanvasRenderingContext2D, w: number, h: number) => void) | undefined,
): GLBDrawFn | null {
  if (!draw) return null;
  const candidate = draw as Partial<GLBDrawFn>;
  if (typeof candidate.glbUrl === 'string') return draw as GLBDrawFn;
  return null;
}
