// bugbear-3d.js — Three.js scene for Bugbear
import { buildCreature } from './creature-builder.js';
import { makeThreeDrawFn } from './three-bridge.js';

// Re-export 2D for fallback
export { drawBugbearClean, bugbearSkeleton } from './bugbear.js';

// --------------------------------------------------------------------------
// Toon palette — matches bugbear.js color bands
//   furShadow  [30,18,12]     lum 0.063
//   furDark    [52,34,22]     lum 0.112
//   furMid     [78,52,34]     lum 0.188
//   leatherDark[58,42,28]     lum 0.140
//   furLight   [108,76,48]    lum 0.295
//   metalDark  [68,78,82]     lum 0.261
//   metalMid   [98,108,112]   lum 0.396
//   metalLight [148,158,162]  lum 0.590
//   eyeOuter   [220,160,30]   lum 0.638
//   teethColor [210,200,180]  lum 0.779
// --------------------------------------------------------------------------
export const BUGBEAR_PALETTE = [
  { r: 30,  g: 18,  b: 12  },  // 0 DEEP
  { r: 52,  g: 34,  b: 22  },  // 1 SHADOW
  { r: 78,  g: 52,  b: 34  },  // 2 MID
  { r: 108, g: 76,  b: 48  },  // 3 LIGHT
  { r: 148, g: 158, b: 162 },  // 4 METAL (armor accent)
  { r: 220, g: 160, b: 30  },  // 5 HI (eye glow)
  { r: 210, g: 200, b: 180 },  // 6 RIM
];

export const GRID_W = 7;
export const GRID_H = 7;

// --------------------------------------------------------------------------
// Bugbear 3D spec — massive hulk, morningstar at side, far arm reaching hard left
// --------------------------------------------------------------------------
export const BUGBEAR_3D_SPEC = {
  rig: 'biped',
  palette: BUGBEAR_PALETTE,
  gridW: GRID_W,
  gridH: GRID_H,

  body: {
    spine: [
      { id: 'snout',  x: 0.18, y: 0.18, radius: 0.032 },
      { id: 'head',   x: 0.27, y: 0.14, radius: 0.082 },
      { id: 'neck',   x: 0.37, y: 0.25, radius: 0.070 },
      { id: 'chest',  x: 0.46, y: 0.38, radius: 0.148 },
      { id: 'belly',  x: 0.50, y: 0.54, radius: 0.122 },
      { id: 'hip',    x: 0.52, y: 0.66, radius: 0.098 },
    ],
  },

  limbs: [
    // Near arm — weapon arm hanging to thigh
    {
      side: 'near',
      radius: 0.054,
      positions: [[0.36, 0.38], [0.33, 0.52], [0.38, 0.65], [0.44, 0.78]],
    },
    // Far arm — reaching hard left, aggressive
    {
      side: 'far',
      radius: 0.042,
      positions: [[0.52, 0.34], [0.40, 0.22], [0.26, 0.18], [0.12, 0.24]],
    },
    // Near leg — forward, wide
    {
      side: 'near',
      radius: 0.056,
      positions: [[0.43, 0.73], [0.38, 0.82], [0.35, 0.90], [0.33, 0.97]],
    },
    // Far leg — back, weight bearing
    {
      side: 'far',
      radius: 0.050,
      positions: [[0.60, 0.73], [0.63, 0.82], [0.65, 0.90], [0.67, 0.97]],
    },
  ],

  head: {
    x: 0.27,
    y: 0.14,
    radius: 0.082,
    jawDrop: 0.25,   // fanged snout, wide open
    teethCount: 6,
  },

  accessories: [],
};

// --------------------------------------------------------------------------
// Factory
// --------------------------------------------------------------------------
export function makeBugbearDrawFn(threeRenderer) {
  const bundle = buildCreature(BUGBEAR_3D_SPEC);
  bundle.playClip('idle');
  const drawFn = makeThreeDrawFn(bundle.scene, bundle.camera, threeRenderer);
  return { drawFn, bundle };
}

export default {
  gridW: GRID_W,
  gridH: GRID_H,
  makeDrawFn: makeBugbearDrawFn,
  spec: BUGBEAR_3D_SPEC,
};
