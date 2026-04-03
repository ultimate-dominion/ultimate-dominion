// kobold-3d.js — Three.js scene for Kobold
import { buildCreature } from './creature-builder.js';
import { makeThreeDrawFn } from './three-bridge.js';

// Re-export 2D for fallback
export { drawKoboldClean, koboldSkeleton } from './kobold.js';

// --------------------------------------------------------------------------
// Toon palette — matches kobold.js color bands
//   scaleShadow [26,20,14]     lum 0.060
//   scaleDark   [52,42,32]     lum 0.128
//   scaleMid    [78,64,48]     lum 0.208
//   vestDark    [148,58,18]    lum 0.242 (vest orange-brown)
//   scaleLight  [108,90,66]    lum 0.310
//   vestMid     [190,95,35]    lum 0.405
//   vestLight   [222,138,52]   lum 0.575
//   teethColor  [215,205,185]  lum 0.808
// --------------------------------------------------------------------------
export const KOBOLD_PALETTE = [
  { r: 26,  g: 20,  b: 14  },  // 0 DEEP
  { r: 52,  g: 42,  b: 32  },  // 1 SHADOW
  { r: 78,  g: 64,  b: 48  },  // 2 MID
  { r: 148, g: 58,  b: 18  },  // 3 VEST (warm accent)
  { r: 108, g: 90,  b: 66  },  // 4 LIGHT
  { r: 222, g: 138, b: 52  },  // 5 HI
  { r: 215, g: 205, b: 185 },  // 6 RIM
];

export const GRID_W = 7;
export const GRID_H = 5;

// --------------------------------------------------------------------------
// Kobold 3D spec — extreme crouch, lunging forward, spear arm extended
// --------------------------------------------------------------------------
export const KOBOLD_3D_SPEC = {
  palette: KOBOLD_PALETTE,
  gridW: GRID_W,
  gridH: GRID_H,

  body: {
    spine: [
      { id: 'snout',  x: 0.08, y: 0.42, radius: 0.012 },
      { id: 'head',   x: 0.17, y: 0.36, radius: 0.042 },
      { id: 'neck',   x: 0.27, y: 0.32, radius: 0.028 },
      { id: 'chest',  x: 0.38, y: 0.34, radius: 0.055 },
      { id: 'belly',  x: 0.50, y: 0.38, radius: 0.048 },
      { id: 'hip',    x: 0.60, y: 0.36, radius: 0.042 },
    ],
  },

  limbs: [
    // Near arm — spear arm, reaching forward
    {
      side: 'near',
      radius: 0.022,
      positions: [[0.32, 0.38], [0.22, 0.48], [0.14, 0.46], [0.08, 0.48]],
    },
    // Far arm — tucked back for balance
    {
      side: 'far',
      radius: 0.018,
      positions: [[0.42, 0.38], [0.38, 0.50], [0.34, 0.54], [0.30, 0.56]],
    },
    // Near leg — forward stride, digitigrade
    {
      side: 'near',
      radius: 0.028,
      positions: [[0.52, 0.42], [0.44, 0.56], [0.50, 0.68], [0.42, 0.76], [0.38, 0.84]],
    },
    // Far leg — back stride, coiled
    {
      side: 'far',
      radius: 0.024,
      positions: [[0.62, 0.42], [0.66, 0.54], [0.62, 0.66], [0.66, 0.74], [0.68, 0.82]],
    },
  ],

  // S-curve tail sweeping up then dipping
  tail: {
    baseRadius: 0.021,
    points: [
      [0.64, 0.38],
      [0.72, 0.28],
      [0.80, 0.24],
      [0.87, 0.30],
      [0.92, 0.22],
      [0.96, 0.14],
    ],
  },

  head: {
    x: 0.17,
    y: 0.36,
    radius: 0.042,
    jawDrop: 0.25,   // aggressive threat pose
    teethCount: 5,
  },

  accessories: [],
};

// --------------------------------------------------------------------------
// Factory
// --------------------------------------------------------------------------
export function makeKoboldDrawFn(threeRenderer) {
  const bundle = buildCreature(KOBOLD_3D_SPEC);
  bundle.playClip('idle');
  const drawFn = makeThreeDrawFn(bundle.scene, bundle.camera, threeRenderer);
  return { drawFn, bundle };
}

export default {
  gridW: GRID_W,
  gridH: GRID_H,
  makeDrawFn: makeKoboldDrawFn,
  spec: KOBOLD_3D_SPEC,
};
