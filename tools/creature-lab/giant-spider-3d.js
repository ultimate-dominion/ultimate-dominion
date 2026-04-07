// giant-spider-3d.js — Three.js scene for Giant Spider
import { buildCreature } from './creature-builder.js';
import { makeThreeDrawFn } from './three-bridge.js';

// Re-export 2D for fallback
export { drawGiantSpiderClean, giantSpiderSkeleton } from './giant-spider.js';

// --------------------------------------------------------------------------
// Toon palette — matches giant-spider.js color bands
//   legShadow  [16,16,30]     lum 0.042
//   bodyDark   [22,22,38]     lum 0.059
//   bodyMid    [38,36,58]     lum 0.105
//   abdomenDark[26,20,36]     lum 0.068
//   legDark    [28,28,48]     lum 0.078
//   bodyLight  [55,52,82]     lum 0.180
//   abdomenMid [42,34,56]     lum 0.126
//   bodyBright [72,68,100]    lum 0.257
//   abdomenHi  [60,50,78]     lum 0.182
//   fangColor  [180,170,150]  lum 0.668
// --------------------------------------------------------------------------
export const GIANT_SPIDER_PALETTE = [
  { r: 16,  g: 16,  b: 30  },  // 0 DEEP
  { r: 22,  g: 22,  b: 38  },  // 1 SHADOW
  { r: 38,  g: 36,  b: 58  },  // 2 MID
  { r: 55,  g: 52,  b: 82  },  // 3 LIGHT
  { r: 72,  g: 68,  b: 100 },  // 4 HI
  { r: 180, g: 170, b: 150 },  // 5 RIM (fangs)
];

export const GRID_W = 7;
export const GRID_H = 5;

// --------------------------------------------------------------------------
// Giant Spider 3D spec — 8 legs (4 near + 4 far), large abdomen, no head section
// --------------------------------------------------------------------------
export const GIANT_SPIDER_3D_SPEC = {
  rig: 'quadruped',
  palette: GIANT_SPIDER_PALETTE,
  gridW: GRID_W,
  gridH: GRID_H,

  body: {
    spine: [
      { id: 'fangs',   x: 0.16, y: 0.52, radius: 0.020 },
      { id: 'head',    x: 0.24, y: 0.48, radius: 0.070 },
      { id: 'waist',   x: 0.38, y: 0.50, radius: 0.045 },
      { id: 'abdomen', x: 0.58, y: 0.46, radius: 0.140 },
      { id: 'rear',    x: 0.72, y: 0.50, radius: 0.100 },
    ],
  },

  limbs: [
    // Near leg 1 — front-most, reaching far forward
    {
      side: 'near',
      radius: 0.024,
      positions: [[0.18, 0.44], [0.08, 0.26], [0.02, 0.44], [-0.04, 0.66]],
    },
    // Near leg 2
    {
      side: 'near',
      radius: 0.024,
      positions: [[0.22, 0.42], [0.14, 0.24], [0.08, 0.48], [0.04, 0.72]],
    },
    // Near leg 3
    {
      side: 'near',
      radius: 0.024,
      positions: [[0.34, 0.44], [0.28, 0.22], [0.22, 0.50], [0.16, 0.74]],
    },
    // Near leg 4 — rear pair
    {
      side: 'near',
      radius: 0.024,
      positions: [[0.50, 0.46], [0.48, 0.24], [0.44, 0.52], [0.38, 0.76]],
    },
    // Far leg 1 — front
    {
      side: 'far',
      radius: 0.020,
      positions: [[0.20, 0.50], [0.12, 0.32], [0.06, 0.50], [0.00, 0.70]],
    },
    // Far leg 2
    {
      side: 'far',
      radius: 0.020,
      positions: [[0.26, 0.50], [0.20, 0.30], [0.14, 0.54], [0.08, 0.74]],
    },
    // Far leg 3
    {
      side: 'far',
      radius: 0.020,
      positions: [[0.38, 0.52], [0.34, 0.28], [0.30, 0.56], [0.24, 0.76]],
    },
    // Far leg 4 — rear
    {
      side: 'far',
      radius: 0.020,
      positions: [[0.54, 0.52], [0.54, 0.30], [0.50, 0.58], [0.44, 0.78]],
    },
  ],

  // No head section — spider has no visible jaw to animate
  accessories: [],
};

// --------------------------------------------------------------------------
// Factory
// --------------------------------------------------------------------------
export function makeGiantSpiderDrawFn(threeRenderer) {
  const bundle = buildCreature(GIANT_SPIDER_3D_SPEC);
  bundle.playClip('idle');
  const drawFn = makeThreeDrawFn(bundle.scene, bundle.camera, threeRenderer);
  return { drawFn, bundle };
}

export default {
  gridW: GRID_W,
  gridH: GRID_H,
  makeDrawFn: makeGiantSpiderDrawFn,
  spec: GIANT_SPIDER_3D_SPEC,
};
