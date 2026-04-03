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
import { makeCreatureCamera, addCreatureLighting, makeThreeDrawFn } from './three-bridge.js';

// Clip name normalisation — maps whatever the artist called their animations
// to our standard clip names (idle / attack / hit / death / walk / block).
const CLIP_NAME_MAP = [
  { keys: ['idle', 'breathing', 'breath', 'stand'],      target: 'idle'   },
  { keys: ['attack', 'swing', 'bite', 'slash', 'strike'], target: 'attack' },
  { keys: ['hit', 'hurt', 'damage', 'impact', 'flinch'], target: 'hit'    },
  { keys: ['death', 'die', 'dead', 'fall'],               target: 'death'  },
  { keys: ['walk', 'run', 'move', 'crawl'],               target: 'walk'   },
  { keys: ['block', 'guard', 'parry', 'defend'],          target: 'block'  },
];

function normaliseClipName(rawName) {
  const lower = rawName.toLowerCase();
  for (const { keys, target } of CLIP_NAME_MAP) {
    if (keys.some(k => lower.includes(k))) return target;
  }
  return rawName; // keep original if no match
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
// Call this after load if you want the toon look; skip for PBR sampling.
// --------------------------------------------------------------------------
export function applyToonMaterials(model, toonGradMap) {
  model.traverse(node => {
    if (!node.isMesh) return;
    const old = Array.isArray(node.material) ? node.material : [node.material];
    const next = old.map(m => {
      const toon = new THREE.MeshToonMaterial({
        color: m.color ?? new THREE.Color(0.5, 0.5, 0.5),
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
  const { toon = true, targetHeight = 1.8 } = opts;

  const gltf = await new Promise((resolve, reject) => {
    new GLTFLoader().load(url, resolve, undefined, reject);
  });

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0, 0, 0);
  addCreatureLighting(scene);

  const model = gltf.scene;
  fitModel(model, targetHeight);

  if (toon) {
    // Build a simple 5-stop gradient matching the creature-builder toon look
    const gradData = new Uint8Array([
      20,  12,   8, 255,   // deep shadow
      70,  55,  40, 255,   // shadow
      140, 110,  75, 255,  // mid
      200, 170, 120, 255,  // light
      240, 220, 180, 255,  // highlight
    ]);
    const gradMap = new THREE.DataTexture(gradData, 5, 1);
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
    const target = normaliseClipName(clip.name);
    // First clip wins for each target name
    if (!seenTargets.has(target)) {
      clips[target] = clip;
      seenTargets.add(target);
    }
    // Also store by original name for explicit access
    clips[clip.name] = clip;
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
