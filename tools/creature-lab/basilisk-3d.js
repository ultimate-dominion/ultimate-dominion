// ==========================================================================
// basilisk-3d.js — Three.js scene definition for the Basilisk
//
// Converts the existing 2D basiliskSkeleton into a 3D creature using
// creature-builder.js. Designed to feed makeThreeDrawFn → renderAscii for
// full-screen ASCII rendering with real depth, normals, and toon shading.
//
// Usage:
//   import Basilisk3D from './basilisk-3d.js';
//   const threeRenderer = createThreeRenderer(512, 341);
//   const drawFn = Basilisk3D.makeDrawFn(threeRenderer);
//   bundle.playClip('idle');
// ==========================================================================

import { buildCreature } from './creature-builder.js';
import { makeThreeDrawFn } from './three-bridge.js';

// Re-export the 2D version for the viewer's fallback path
export { drawBasiliskClean, basiliskSkeleton } from './basilisk.js';

// --------------------------------------------------------------------------
// Toon palette — matches basilisk.js luminance bands exactly
//   DEEP    [12,6,2]       lum 0.025
//   SHADOW  [48,28,9]      lum 0.11
//   MID     [108,67,22]    lum 0.27
//   BELLY   [142,112,64]   lum 0.43  (belly plate)
//   LIGHT   [188,145,60]   lum 0.59
//   HI      [232,194,98]   lum 0.77
//   RIM     [252,234,165]  lum 0.92
// --------------------------------------------------------------------------
export const BASILISK_PALETTE = [
  { r: 12,  g: 6,   b: 2   },  // 0 DEEP
  { r: 48,  g: 28,  b: 9   },  // 1 SHADOW
  { r: 108, g: 67,  b: 22  },  // 2 MID
  { r: 142, g: 112, b: 64  },  // 3 BELLY
  { r: 188, g: 145, b: 60  },  // 4 LIGHT
  { r: 232, g: 194, b: 98  },  // 5 HI
  { r: 252, g: 234, b: 165 },  // 6 RIM
];

export const GRID_W = 12;
export const GRID_H = 8;

// --------------------------------------------------------------------------
// Basilisk 3D spec — coordinates lifted from basiliskSkeleton + draw data
// --------------------------------------------------------------------------
export const BASILISK_3D_SPEC = {
  rig: 'quadruped',
  palette: BASILISK_PALETTE,
  gridW: GRID_W,
  gridH: GRID_H,

  body: {
    spine: [
      { id: 'snout',    x: 0.10, y: 0.56, radius: 0.024 },
      { id: 'head',     x: 0.20, y: 0.36, radius: 0.116 },
      { id: 'neck',     x: 0.34, y: 0.42, radius: 0.082 },
      { id: 'shoulder', x: 0.47, y: 0.40, radius: 0.114 },
      { id: 'mid',      x: 0.60, y: 0.43, radius: 0.102 },
      { id: 'hip',      x: 0.73, y: 0.48, radius: 0.090 },
    ],
  },

  limbs: [
    // Far front leg — behind body (z-back), dark
    {
      side: 'far',
      radius: 0.054,
      positions: [[0.52, 0.54], [0.56, 0.67], [0.58, 0.80]],
    },
    // Far rear leg — behind body
    {
      side: 'far',
      radius: 0.052,
      positions: [[0.79, 0.58], [0.84, 0.69], [0.87, 0.80]],
    },
    // Near rear leg — in front of body
    {
      side: 'near',
      radius: 0.060,
      positions: [[0.67, 0.58], [0.65, 0.71], [0.62, 0.82]],
    },
    // Near front leg — planted forward, supporting forward lean
    {
      side: 'near',
      radius: 0.064,
      positions: [[0.36, 0.56], [0.28, 0.68], [0.22, 0.80]],
    },
  ],

  // Tail sweeps up-right from hip, barbed tip at upper right
  // Points map to the bezier control shape from the 2D draw code
  tail: {
    baseRadius: 0.055,
    points: [
      [0.73, 0.44],  // tail base at hip level
      [0.80, 0.38],  // first curve (tail spine 1)
      [0.86, 0.28],  // mid sweep (tail spine 2)
      [0.91, 0.20],  // upper portion (tail spine 3)
      [0.94, 0.16],  // near tip
      [0.985, 0.09], // barbed tip — RIM material in builder
    ],
  },

  // Head — massive croc skull, raised in threat pose
  head: {
    x: 0.20,
    y: 0.36,
    radius: 0.116,
    jawDrop: 0.25,   // wide open — threat display
    teethCount: 8,
  },

  // Dorsal spines — from spineData in basilisk.js draw code
  // [x, y, height, radius] all normalized
  accessories: [
    {
      type: 'spineRow',
      positions: [
        [0.32, 0.32, 0.118, 0.026],
        [0.40, 0.29, 0.110, 0.023],
        [0.47, 0.27, 0.100, 0.021],  // over shoulder
        [0.53, 0.27, 0.090, 0.019],
        [0.60, 0.29, 0.080, 0.017],  // over mid
        [0.67, 0.30, 0.068, 0.015],
        [0.73, 0.30, 0.056, 0.013],  // over hip
        [0.84, 0.32, 0.042, 0.010],
        [0.91, 0.22, 0.028, 0.007],
      ],
    },
  ],
};

// --------------------------------------------------------------------------
// Factory — call once per renderer to get a stable drawFn
// --------------------------------------------------------------------------

/**
 * Build the Basilisk 3D scene and return a drawFn for renderAscii.
 * Pass a shared ThreeRenderer instance (createThreeRenderer) for efficiency.
 *
 * Returns { drawFn, bundle } so callers can drive animations.
 */
export function makeBasiliskDrawFn(threeRenderer) {
  const bundle = buildCreature(BASILISK_3D_SPEC);
  bundle.playClip('idle');
  const drawFn = makeThreeDrawFn(bundle.scene, bundle.camera, threeRenderer);
  return { drawFn, bundle };
}

export default {
  gridW: GRID_W,
  gridH: GRID_H,
  makeDrawFn: makeBasiliskDrawFn,
  spec: BASILISK_3D_SPEC,
};
