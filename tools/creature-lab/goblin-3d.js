// goblin-3d.js — Three.js scene for Goblin
import { buildCreature } from './creature-builder.js';
import { makeThreeDrawFn } from './three-bridge.js';

// Re-export 2D for fallback
export { drawGoblinClean, goblinSkeleton } from './goblin.js';

// --------------------------------------------------------------------------
// Toon palette — goblin green skin is the dominant read.
// Index ordering matters: creature-builder assigns matMid to body segments
// and far-limbs, so index 2 MUST be a green skin tone not leather.
//   0 DEEP    lum 0.05  very dark green-black
//   1 SHADOW  lum 0.12  dark green (skinShadow)
//   2 MID     lum 0.22  mid-dark green (skinDark) — body segments, far limbs
//   3 —       lum 0.35  mid green (skinMid) — toon gradient fill
//   4 LIGHT   lum 0.50  bright green (skinLight) — head, belly, near limbs
//   5 HI      lum 0.65  amber-orange (eyes) — glow trigger
//   6 RIM     lum 0.80  near-white (teeth, highlight) — strong glow
// --------------------------------------------------------------------------
export const GOBLIN_PALETTE = [
  { r: 18,  g: 26,  b: 8   },  // 0 DEEP — near black, green tint
  { r: 32,  g: 40,  b: 16  },  // 1 SHADOW — skinShadow dark green
  { r: 58,  g: 72,  b: 28  },  // 2 MID — skinDark mid-dark green ← was leather-brown
  { r: 88,  g: 108, b: 42  },  // 3 — skinMid (toon gradient fill)
  { r: 118, g: 142, b: 58  },  // 4 LIGHT — skinLight bright green
  { r: 255, g: 160, b: 20  },  // 5 HI — eye glow orange
  { r: 210, g: 200, b: 175 },  // 6 RIM — teeth / near-white highlights
];

export const GRID_W = 7;
export const GRID_H = 7;

// --------------------------------------------------------------------------
// Goblin 3D spec — squat barrel-chested, axe raised overhead, wide stance
// --------------------------------------------------------------------------
export const GOBLIN_3D_SPEC = {
  rig: 'biped',
  palette: GOBLIN_PALETTE,
  gridW: GRID_W,
  gridH: GRID_H,

  // Per-part color overrides
  skinColor:   [88, 108, 42],   // skinMid green — head, near limbs
  armorColor:  [42, 30, 18],    // dark leather — body, far limbs
  weaponColor: [105, 98, 85],   // aged iron axe head
  // weaponEdge uses palette RIM [210, 200, 175] — bright glint on cutting edge

  weapons: [
    {
      type: 'axe',
      hand: 'near',   // attaches to the first 'near' limb tip (raised arm)
      size: 0.175,    // world-unit reach (handle length)
    },
  ],

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
