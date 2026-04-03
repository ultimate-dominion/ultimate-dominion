// skeleton-creature-3d.js — Three.js scene for Skeleton Creature
import { buildCreature } from './creature-builder.js';
import { makeThreeDrawFn } from './three-bridge.js';

// Re-export 2D for fallback
export { drawSkeletonClean, skeletonSkeleton } from './skeleton-creature.js';

// --------------------------------------------------------------------------
// Toon palette — matches skeleton-creature.js color bands
//   boneShadow   [28,22,16]   lum 0.072
//   boneDark     [55,48,38]   lum 0.143
//   boneMid      [95,82,66]   lum 0.280
//   boneLight    [145,128,105]lum 0.473
//   boneHighlight[175,158,132]lum 0.598
//   eyeGlow      [70,225,100] lum 0.680 (undead green)
//   eyeCore      [160,255,180]lum 0.900
// --------------------------------------------------------------------------
export const SKELETON_CREATURE_PALETTE = [
  { r: 28,  g: 22,  b: 16  },  // 0 DEEP
  { r: 55,  g: 48,  b: 38  },  // 1 SHADOW
  { r: 95,  g: 82,  b: 66  },  // 2 MID
  { r: 145, g: 128, b: 105 },  // 3 LIGHT
  { r: 175, g: 158, b: 132 },  // 4 HI
  { r: 160, g: 255, b: 180 },  // 5 RIM (eye glow)
];

export const GRID_W = 7;
export const GRID_H = 5;

// --------------------------------------------------------------------------
// Skeleton 3D spec — undead warrior mid-sword-swing, forward lean
// --------------------------------------------------------------------------
export const SKELETON_CREATURE_3D_SPEC = {
  palette: SKELETON_CREATURE_PALETTE,
  gridW: GRID_W,
  gridH: GRID_H,

  body: {
    spine: [
      { id: 'jaw',    x: 0.20, y: 0.20, radius: 0.020 },
      { id: 'head',   x: 0.26, y: 0.12, radius: 0.072 },
      { id: 'neck',   x: 0.32, y: 0.24, radius: 0.018 },
      { id: 'chest',  x: 0.38, y: 0.36, radius: 0.065 },
      { id: 'belly',  x: 0.40, y: 0.48, radius: 0.025 },
      { id: 'hip',    x: 0.42, y: 0.56, radius: 0.045 },
    ],
  },

  limbs: [
    // Near arm — sword arm, swinging down
    {
      side: 'near',
      radius: 0.018,
      positions: [[0.30, 0.32], [0.20, 0.38], [0.14, 0.44], [0.08, 0.48]],
    },
    // Far arm — weapon hand (treat as near for visibility)
    {
      side: 'near',
      radius: 0.016,
      positions: [[0.46, 0.34], [0.52, 0.42], [0.54, 0.50], [0.54, 0.56]],
    },
    // Near leg — forward stride, lunging
    {
      side: 'near',
      radius: 0.020,
      positions: [[0.36, 0.60], [0.30, 0.72], [0.28, 0.83], [0.26, 0.93]],
    },
    // Far leg — planted back
    {
      side: 'far',
      radius: 0.018,
      positions: [[0.48, 0.60], [0.54, 0.72], [0.58, 0.83], [0.60, 0.93]],
    },
  ],

  head: {
    x: 0.26,
    y: 0.12,
    radius: 0.072,
    jawDrop: 0.18,
    teethCount: 0,   // skeleton — show bone, not teeth
  },

  accessories: [],
};

// --------------------------------------------------------------------------
// Factory
// --------------------------------------------------------------------------
export function makeSkeletonCreatureDrawFn(threeRenderer) {
  const bundle = buildCreature(SKELETON_CREATURE_3D_SPEC);
  bundle.playClip('idle');
  const drawFn = makeThreeDrawFn(bundle.scene, bundle.camera, threeRenderer);
  return { drawFn, bundle };
}

export default {
  gridW: GRID_W,
  gridH: GRID_H,
  makeDrawFn: makeSkeletonCreatureDrawFn,
  spec: SKELETON_CREATURE_3D_SPEC,
};
