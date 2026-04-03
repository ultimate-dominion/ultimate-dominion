// goblin-3d.js — Three.js scene for Goblin
import { buildCreature } from './creature-builder.js';
import { makeThreeDrawFn } from './three-bridge.js';

// Re-export 2D for fallback
export { drawGoblinClean, goblinSkeleton } from './goblin.js';

// --------------------------------------------------------------------------
// Toon palette — matches goblin.js color bands
//   skinShadow [32,40,16]     lum 0.117
//   skinDark   [58,72,28]     lum 0.193
//   leatherDark[62,44,28]     lum 0.162
//   skinMid    [88,108,42]    lum 0.330
//   leatherMid [92,68,42]     lum 0.270
//   skinLight  [118,142,58]   lum 0.484
//   leatherLight[118,90,56]   lum 0.353
//   eyeOuter   [255,160,20]   lum 0.645
//   teethColor [210,200,175]  lum 0.790
// --------------------------------------------------------------------------
export const GOBLIN_PALETTE = [
  { r: 32,  g: 40,  b: 16  },  // 0 DEEP
  { r: 58,  g: 72,  b: 28  },  // 1 SHADOW
  { r: 62,  g: 44,  b: 28  },  // 2 LEATHER (warm mid)
  { r: 88,  g: 108, b: 42  },  // 3 MID
  { r: 118, g: 142, b: 58  },  // 4 LIGHT
  { r: 255, g: 160, b: 20  },  // 5 HI (eye glow)
  { r: 210, g: 200, b: 175 },  // 6 RIM
];

export const GRID_W = 7;
export const GRID_H = 7;

// --------------------------------------------------------------------------
// Goblin 3D spec — squat barrel-chested, axe raised overhead, wide stance
// --------------------------------------------------------------------------
export const GOBLIN_3D_SPEC = {
  palette: GOBLIN_PALETTE,
  gridW: GRID_W,
  gridH: GRID_H,

  body: {
    spine: [
      { id: 'jaw',    x: 0.30, y: 0.38, radius: 0.016 },
      { id: 'head',   x: 0.38, y: 0.28, radius: 0.082 },
      { id: 'neck',   x: 0.42, y: 0.42, radius: 0.050 },
      { id: 'chest',  x: 0.46, y: 0.52, radius: 0.095 },
      { id: 'belly',  x: 0.48, y: 0.62, radius: 0.098 },
      { id: 'hip',    x: 0.48, y: 0.72, radius: 0.080 },
    ],
  },

  limbs: [
    // Near arm — top grip on axe, raised
    {
      side: 'near',
      radius: 0.034,
      positions: [[0.44, 0.48], [0.52, 0.36], [0.60, 0.24], [0.64, 0.16]],
    },
    // Far arm — lower grip on axe shaft
    {
      side: 'far',
      radius: 0.028,
      positions: [[0.50, 0.50], [0.54, 0.40], [0.58, 0.30], [0.60, 0.22]],
    },
    // Near leg — stubby, planted wide forward
    {
      side: 'near',
      radius: 0.040,
      positions: [[0.40, 0.78], [0.36, 0.86], [0.34, 0.94]],
    },
    // Far leg — stubby, back
    {
      side: 'far',
      radius: 0.034,
      positions: [[0.56, 0.78], [0.62, 0.86], [0.64, 0.94]],
    },
  ],

  head: {
    x: 0.38,
    y: 0.28,
    radius: 0.082,
    jawDrop: 0.18,
    teethCount: 5,
  },

  accessories: [],
};

// --------------------------------------------------------------------------
// Factory
// --------------------------------------------------------------------------
export function makeGoblinDrawFn(threeRenderer) {
  const bundle = buildCreature(GOBLIN_3D_SPEC);
  bundle.playClip('idle');
  const drawFn = makeThreeDrawFn(bundle.scene, bundle.camera, threeRenderer);
  return { drawFn, bundle };
}

export default {
  gridW: GRID_W,
  gridH: GRID_H,
  makeDrawFn: makeGoblinDrawFn,
  spec: GOBLIN_3D_SPEC,
};
