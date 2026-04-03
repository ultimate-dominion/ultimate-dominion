// dire-rat-3d.js — Three.js scene for Dire Rat
import { buildCreature } from './creature-builder.js';
import { makeThreeDrawFn } from './three-bridge.js';

// Re-export 2D for fallback
export { drawDireRatClean, direRatSkeleton } from './dire-rat.js';

// --------------------------------------------------------------------------
// Toon palette — matches dire-rat.js drawNewDireRat color bands
//   furShadow  [14,10,8]       lum 0.022
//   furDark    [28,20,16]      lum 0.045
//   skinDark   [48,28,24]      lum 0.090
//   furMid     [52,38,28]      lum 0.110
//   skinMid    [72,42,36]      lum 0.152
//   furLight   [82,62,44]      lum 0.200
//   skinLight  [95,58,48]      lum 0.210
//   teethColor [240,230,210]   lum 0.890
// --------------------------------------------------------------------------
export const DIRE_RAT_PALETTE = [
  { r: 14,  g: 10,  b: 8   },  // 0 DEEP/shadow
  { r: 28,  g: 20,  b: 16  },  // 1 furDark
  { r: 52,  g: 38,  b: 28  },  // 2 furMid
  { r: 82,  g: 62,  b: 44  },  // 3 furLight
  { r: 95,  g: 58,  b: 48  },  // 4 skinLight (HI)
  { r: 240, g: 230, b: 210 },  // 5 RIM (teeth)
];

export const GRID_W = 7;
export const GRID_H = 4;

// --------------------------------------------------------------------------
// Dire Rat 3D spec — ground-hugging 3/4 profile, stubby legs, long tail
// --------------------------------------------------------------------------
export const DIRE_RAT_3D_SPEC = {
  rig: 'quadruped',
  palette: DIRE_RAT_PALETTE,
  gridW: GRID_W,
  gridH: GRID_H,

  body: {
    spine: [
      { id: 'snout',  x: 0.10, y: 0.84, radius: 0.025 },
      { id: 'head',   x: 0.16, y: 0.78, radius: 0.065 },
      { id: 'neck',   x: 0.26, y: 0.72, radius: 0.074 },
      { id: 'chest',  x: 0.38, y: 0.64, radius: 0.120 },
      { id: 'belly',  x: 0.52, y: 0.60, radius: 0.140 },
      { id: 'hip',    x: 0.64, y: 0.64, radius: 0.125 },
      { id: 'rump',   x: 0.72, y: 0.70, radius: 0.058 },
    ],
  },

  limbs: [
    // Near front leg
    {
      side: 'near',
      radius: 0.040,
      positions: [[0.26, 0.78], [0.20, 0.86], [0.16, 0.92], [0.14, 0.97]],
    },
    // Far front leg
    {
      side: 'far',
      radius: 0.032,
      positions: [[0.34, 0.76], [0.28, 0.84], [0.24, 0.92], [0.23, 0.97]],
    },
    // Near rear leg
    {
      side: 'near',
      radius: 0.100,
      positions: [[0.58, 0.64], [0.60, 0.76], [0.65, 0.86], [0.59, 0.92], [0.55, 0.97]],
    },
    // Far rear leg
    {
      side: 'far',
      radius: 0.085,
      positions: [[0.66, 0.64], [0.68, 0.76], [0.72, 0.86], [0.68, 0.92], [0.66, 0.97]],
    },
  ],

  // Tail sweeps up and back from rump
  tail: {
    baseRadius: 0.027,
    points: [
      [0.74, 0.72],
      [0.82, 0.64],
      [0.90, 0.58],
      [0.94, 0.50],
      [0.93, 0.42],
      [0.88, 0.38],
    ],
  },

  head: {
    x: 0.16,
    y: 0.78,
    radius: 0.065,
    jawDrop: 0.18,
    teethCount: 5,
  },

  accessories: [],
};

// --------------------------------------------------------------------------
// Factory
// --------------------------------------------------------------------------
export function makeDireRatDrawFn(threeRenderer) {
  const bundle = buildCreature(DIRE_RAT_3D_SPEC);
  bundle.playClip('idle');
  const drawFn = makeThreeDrawFn(bundle.scene, bundle.camera, threeRenderer);
  return { drawFn, bundle };
}

export default {
  gridW: GRID_W,
  gridH: GRID_H,
  makeDrawFn: makeDireRatDrawFn,
  spec: DIRE_RAT_3D_SPEC,
};
