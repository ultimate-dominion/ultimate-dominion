// hook-horror-3d.js — Three.js scene for Hook Horror
import { buildCreature } from './creature-builder.js';
import { makeThreeDrawFn } from './three-bridge.js';

// Re-export 2D for fallback
export { drawHookHorrorClean, hookHorrorSkeleton } from './hook-horror.js';

// --------------------------------------------------------------------------
// Toon palette — matches hook-horror.js color bands
//   bodyDark   [26,20,44]     lum 0.065
//   bodyMid    [62,48,102]    lum 0.180
//   bodyLight  [108,86,162]   lum 0.344
//   bodyHi     [155,130,210]  lum 0.515
//   hookDark   [52,36,18]     lum 0.100
//   hookMid    [128,96,58]    lum 0.363
//   hookLight  [198,165,114]  lum 0.644
//   boneLight  [218,192,156]  lum 0.742
// --------------------------------------------------------------------------
export const HOOK_HORROR_PALETTE = [
  { r: 26,  g: 20,  b: 44  },  // 0 DEEP
  { r: 62,  g: 48,  b: 102 },  // 1 SHADOW
  { r: 108, g: 86,  b: 162 },  // 2 MID
  { r: 155, g: 130, b: 210 },  // 3 LIGHT
  { r: 128, g: 96,  b: 58  },  // 4 HOOK MID (bone-horn accent)
  { r: 198, g: 165, b: 114 },  // 5 HI (hook highlight)
  { r: 218, g: 192, b: 156 },  // 6 RIM
];

export const GRID_W = 14;
export const GRID_H = 12;

// --------------------------------------------------------------------------
// Hook Horror 3D spec — bipedal, massive shoulders, hook arms raised
// Head up roaring, wide stance
// --------------------------------------------------------------------------
export const HOOK_HORROR_3D_SPEC = {
  palette: HOOK_HORROR_PALETTE,
  gridW: GRID_W,
  gridH: GRID_H,

  body: {
    spine: [
      { id: 'beak',     x: 0.18, y: 0.14, radius: 0.024 },
      { id: 'head',     x: 0.28, y: 0.12, radius: 0.066 },
      { id: 'neck',     x: 0.38, y: 0.24, radius: 0.058 },
      { id: 'shoulder', x: 0.50, y: 0.36, radius: 0.145 },
      { id: 'belly',    x: 0.55, y: 0.56, radius: 0.126 },
      { id: 'hip',      x: 0.58, y: 0.72, radius: 0.100 },
    ],
  },

  limbs: [
    // Far arm — rises from right shoulder, hook sweeps up-right
    {
      side: 'far',
      radius: 0.044,
      positions: [[0.62, 0.30], [0.74, 0.20], [0.84, 0.16]],
    },
    // Near arm — exits from left shoulder, hook sweeps hard left
    {
      side: 'near',
      radius: 0.050,
      positions: [[0.42, 0.40], [0.28, 0.44], [0.16, 0.42]],
    },
    // Far leg — back-right stance
    {
      side: 'far',
      radius: 0.050,
      positions: [[0.66, 0.80], [0.72, 0.90], [0.76, 0.98]],
    },
    // Near leg — forward-left, wide stance
    {
      side: 'near',
      radius: 0.054,
      positions: [[0.50, 0.80], [0.44, 0.91], [0.40, 0.99]],
    },
  ],

  head: {
    x: 0.28,
    y: 0.12,
    radius: 0.066,
    jawDrop: 0.25,   // roaring upward, beak wide
    teethCount: 0,   // beak creature — no teeth, bone edge
  },

  accessories: [],
};

// --------------------------------------------------------------------------
// Factory
// --------------------------------------------------------------------------
export function makeHookHorrorDrawFn(threeRenderer) {
  const bundle = buildCreature(HOOK_HORROR_3D_SPEC);
  bundle.playClip('idle');
  const drawFn = makeThreeDrawFn(bundle.scene, bundle.camera, threeRenderer);
  return { drawFn, bundle };
}

export default {
  gridW: GRID_W,
  gridH: GRID_H,
  makeDrawFn: makeHookHorrorDrawFn,
  spec: HOOK_HORROR_3D_SPEC,
};
