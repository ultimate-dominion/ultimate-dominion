// ==========================================================================
// glb-loader.js — Load a .glb file into the ASCII creature pipeline
//
// Replaces creature-builder.js for assets that come from real 3D tools
// (Quaternius, Mixamo, Meshy, etc.). Same bundle interface — the viewer
// and renderAscii pipeline don't need to change.
//
// Usage:
//   const { drawFn, bundle } = await loadGLBCreature('glb/goblin.glb', 7, 7, threeRenderer);
//   bundle.playClip('attack');
// ==========================================================================

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { makeCreatureCamera, makeThreeDrawFn } from './three-bridge.js';

// Clip name normalisation — maps whatever the artist called their animations
// to our standard clip names (idle / attack / hit / death / walk / block).
const CLIP_NAME_MAP = [
  // Standard names first — most packs use these
  { keys: ['idle', 'breathing', 'breath', 'stand',
            'floating'],                                    target: 'idle'   },
  { keys: ['attack', 'swing', 'bite', 'slash', 'strike',
            'chop', 'spellcast', 'cast', 'shoot', 'stab',
            'punch', 'kick', 'throw', 'headbutt', 'weapon'], target: 'attack' },
  { keys: ['hit', 'hurt', 'damage', 'impact', 'flinch',
            'hitrecieve', 'hitreact'],                      target: 'hit'    },
  { keys: ['death', 'die', 'dead', 'fall'],                target: 'death'  },
  { keys: ['walk', 'run', 'move', 'crawl', 'fly', 'swim'], target: 'walk'   },
  { keys: ['block', 'guard', 'parry', 'defend'],           target: 'block'  },
  // KayKit skeleton-specific: awaken = idle
  { keys: ['awaken', 'inactive', 'spawn'],                 target: 'idle'   },
];

// Strip common armature-prefix conventions before mapping.
// Quaternius: "CharacterArmature|Idle" → "Idle"
// Mixamo:     "mixamo.com/Idle"        → "Idle"
function stripArmaturePrefix(name) {
  return name.replace(/^[^|]+\|/, '').replace(/^mixamo\.com\//, '');
}

function normaliseClipName(rawName) {
  const lower = stripArmaturePrefix(rawName).toLowerCase();
  for (const { keys, target } of CLIP_NAME_MAP) {
    if (keys.some(k => lower.includes(k))) return target;
  }
  return stripArmaturePrefix(rawName); // clean display name if no match
}

// --------------------------------------------------------------------------
// Auto-fit — centre and scale the loaded model into our world units.
// We target a bounding box height of ~1.8 world units so it fills the frame.
// --------------------------------------------------------------------------
function fitModel(model, targetHeight = 1.8) {
  const box  = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());

  const scale = targetHeight / Math.max(size.y, size.x * 0.5, 0.001);
  model.scale.setScalar(scale);

  // Re-measure after scale
  box.setFromObject(model);
  box.getCenter(center);

  // Shift so centre of mass sits at origin, feet near y = -targetHeight/2
  model.position.sub(center);
  // Nudge up slightly so feet aren't clipped — adjust if needed per asset
  model.position.y -= box.getSize(new THREE.Vector3()).y * 0.08;
}

// --------------------------------------------------------------------------
// Toon material pass — replace PBR materials with MeshToonMaterial so the
// ASCII renderer gets the same flat-shaded banding we use for spec creatures.
//
// Key insight: most game GLBs store color in albedo textures, not m.color.
// m.color is almost always white (1,1,1) and multiplying by that blows out
// the gradient. We use a fixed mid-gray base so the gradient does the work.
// --------------------------------------------------------------------------
export function applyToonMaterials(model, toonGradMap) {
  model.traverse(node => {
    if (!node.isMesh) return;
    const old = Array.isArray(node.material) ? node.material : [node.material];
    const next = old.map(m => {
      // Check if the base color is meaningfully non-white (artist painted it).
      // Threshold: if luminance < 0.85, trust the color; otherwise use mid-gray.
      const c = m.color ?? new THREE.Color(0.5, 0.5, 0.5);
      const lum = c.r * 0.299 + c.g * 0.587 + c.b * 0.114;
      const baseColor = lum < 0.85 ? c.clone().multiplyScalar(0.85) : new THREE.Color(0.52, 0.50, 0.48);
      const toon = new THREE.MeshToonMaterial({
        color: baseColor,
        gradientMap: toonGradMap,
      });
      m.dispose();
      return toon;
    });
    node.material = Array.isArray(node.material) ? next : next[0];
  });
}

// --------------------------------------------------------------------------
// Main loader
// --------------------------------------------------------------------------

/**
 * Load a .glb file and return a bundle with the same interface as buildCreature.
 *
 * @param {string}  url          — path relative to viewer (e.g. 'glb/goblin.glb')
 * @param {number}  gridW        — creature grid width for camera aspect
 * @param {number}  gridH        — creature grid height
 * @param {object}  threeRenderer — shared WebGLRenderer from getThreeRenderer()
 * @param {object}  [opts]
 * @param {boolean} [opts.toon=true]     — replace PBR mats with MeshToon
 * @param {number}  [opts.targetHeight]  — world-unit height to fit model to
 *
 * @returns {Promise<{ drawFn, bundle }>}
 */
export async function loadGLBCreature(url, gridW, gridH, threeRenderer, opts = {}) {
  const {
    toon = true,
    targetHeight = 1.8,
    // 3/4 left-facing orientation — matches UD creature visual language.
    // Most game GLBs (KayKit, Quaternius, Mixamo) face -Z (away from camera)
    // in their rest pose. Rotating Y by +117° puts them facing left with the
    // face on the LEFT of canvas and ~30° depth visible.
    //   yaw=0         → default rest pose (front or back depending on exporter)
    //   yaw=+Math.PI  → full 180° flip
    //   yaw=+Math.PI*0.65 → 3/4 left-front for -Z facing models (KayKit/Quaternius)
    //   yaw=-Math.PI*0.25 → 3/4 left-front for +Z facing models (Three.js examples)
    yaw   = Math.PI * 0.65,    // ~+117° — 3/4 left-front for -Z-facing models
    pitch = -0.08,              // slight downward tilt — mild elevation angle
  } = opts;

  const gltf = await new Promise((resolve, reject) => {
    new GLTFLoader().load(url, resolve, undefined, reject);
  });

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0, 0, 0);

  // GLB-specific lighting — lower ambient so shadow areas go genuinely dark.
  // The ASCII renderer needs a real luminance range to pick varied characters.
  // creature-builder uses ambient=0.35 which is fine for primitives but lifts
  // the shadow floor too high on real meshes with complex geometry.
  const keyLight = new THREE.DirectionalLight(0xffffff, 1.8);
  keyLight.position.set(1.5, 2.0, 3.0);  // upper-right, toward viewer
  scene.add(keyLight);
  const fillLight = new THREE.DirectionalLight(0xffffff, 0.25);
  fillLight.position.set(-1.2, -0.5, 1.5);
  scene.add(fillLight);
  scene.add(new THREE.AmbientLight(0xffffff, 0.10));  // very low — let shadows be dark

  const model = gltf.scene;
  fitModel(model, targetHeight);

  // Orient to 3/4 left-facing view — creature faces left toward player.
  // Applied after fitModel so centering is correct first.
  model.rotation.order = 'YXZ';
  model.rotation.y = yaw;
  model.rotation.x = pitch;

  if (toon) {
    // 7-stop toon gradient — wide contrast range so ASCII gets dark shadows
    // and bright highlights to drive character selection across the full set.
    // NearestFilter gives hard toon bands (no linear interpolation).
    const gradData = new Uint8Array([
       8,   6,   5, 255,   // 0 deep shadow  — near-black
      32,  28,  24, 255,   // 1 shadow
      72,  66,  60, 255,   // 2 dark mid
     118, 108, 100, 255,   // 3 mid          — this is where most surfaces land
     168, 155, 142, 255,   // 4 light mid
     210, 198, 184, 255,   // 5 lit
     245, 235, 222, 255,   // 6 highlight    — rim/specular catch
    ]);
    const gradMap = new THREE.DataTexture(gradData, 7, 1);
    gradMap.minFilter = THREE.NearestFilter;
    gradMap.magFilter = THREE.NearestFilter;
    gradMap.needsUpdate = true;
    applyToonMaterials(model, gradMap);
  }

  scene.add(model);

  const camera = makeCreatureCamera(gridW, gridH);
  const mixer  = new THREE.AnimationMixer(model);

  // Build clip map — normalise artist names to our standard set
  const clips  = {};
  const seenTargets = new Set();
  gltf.animations.forEach(clip => {
    const target   = normaliseClipName(clip.name);   // 'idle' / 'attack' / etc., or stripped display name
    const stripped = stripArmaturePrefix(clip.name); // 'Idle', 'Punch', etc.
    // First clip wins for each target name
    if (!seenTargets.has(target)) {
      clips[target] = clip;
      seenTargets.add(target);
    }
    // Also store by stripped name for explicit access via dropdown
    if (stripped !== target) clips[stripped] = clip;
  });

  // Build actions
  const actions = {};
  Object.entries(clips).forEach(([name, clip]) => {
    const action = mixer.clipAction(clip);
    // One-shot clips
    if (['attack', 'hit', 'death', 'walk'].includes(name)) {
      action.loop = THREE.LoopOnce;
      action.clampWhenFinished = name === 'death';
    }
    actions[name] = action;
  });

  // Start idle (or first available clip if no idle)
  const startClip = actions.idle ?? Object.values(actions)[0] ?? null;
  startClip?.play();
  let currentAction = startClip;

  function playClip(name, fadeTime = 0.15) {
    const next = actions[name];
    if (!next || next === currentAction) return;
    if (currentAction) currentAction.crossFadeTo(next, fadeTime, false);
    if (next.loop === THREE.LoopOnce) next.reset();
    next.play();
    currentAction = next;

    const returnToIdle = ['attack', 'hit', 'walk'].includes(name);
    if (returnToIdle) {
      const onFinish = (e) => {
        if (e.action !== next) return;
        mixer.removeEventListener('finished', onFinish);
        playClip('idle', 0.22);
      };
      mixer.addEventListener('finished', onFinish);
    }
  }

  const drawFn = makeThreeDrawFn(scene, camera, threeRenderer);

  // Log available clips so the viewer can show them
  const availableClips = Object.keys(clips).filter(k => !gltf.animations.find(a => a.name === k) || true);
  console.log(`[glb-loader] ${url} — clips:`, Object.keys(actions).join(', '));

  return {
    drawFn,
    bundle: {
      scene,
      camera,
      model,
      mixer,
      clips,
      actions,
      playClip,
      // Standard stance interface — GLB creatures start at origin
      stances: [
        { position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
        { position: [-0.04, -0.03, 0], rotation: [0, 0, 0.05], scale: [1, 0.97, 1] },
        { position: [0.04, 0.02, 0],  rotation: [0, 0, -0.04], scale: [1.04, 0.98, 1] },
      ],
      // Raw clip names from the asset for the viewer dropdown
      clipNames: Object.keys(actions),
    },
  };
}
