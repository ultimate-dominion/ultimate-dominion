// goblin-shaman-3d.js — Three.js scene for Goblin Shaman
import { buildCreature } from './creature-builder.js';
import { makeThreeDrawFn } from './three-bridge.js';

// Re-export 2D for fallback
export { drawGoblinShamanClean, goblinShamanSkeleton } from './goblin-shaman.js';

// --------------------------------------------------------------------------
// Toon palette — matches goblin-shaman.js color bands
//   skinShadow [28,32,14]     lum 0.095
//   robeShadow [22,10,8]      lum 0.030
//   skinDark   [52,58,28]     lum 0.170
//   robeDark   [42,18,12]     lum 0.058
//   skinMid    [72,82,38]     lum 0.245
//   robeMid    [68,28,18]     lum 0.115
//   robeLight  [88,40,24]     lum 0.163
//   orbGlow    [255,180,40]   lum 0.690
//   orbCore    [255,220,100]  lum 0.862
// --------------------------------------------------------------------------
export const GOBLIN_SHAMAN_PALETTE = [
  { r: 22,  g: 10,  b: 8   },  // 0 DEEP (robe shadow)
  { r: 42,  g: 18,  b: 12  },  // 1 SHADOW (robe dark)
  { r: 68,  g: 28,  b: 18  },  // 2 MID (robe)
  { r: 72,  g: 82,  b: 38  },  // 3 SKIN MID
  { r: 88,  g: 40,  b: 24  },  // 4 LIGHT (robe highlight)
  { r: 255, g: 180, b: 40  },  // 5 HI (orb glow)
  { r: 255, g: 220, b: 100 },  // 6 RIM (orb core)
];

export const GRID_W = 7;
export const GRID_H = 7;

// --------------------------------------------------------------------------
// Goblin Shaman 3D spec — hunched caster, staff extended upward
// --------------------------------------------------------------------------
export const GOBLIN_SHAMAN_3D_SPEC = {
  palette: GOBLIN_SHAMAN_PALETTE,
  gridW: GRID_W,
  gridH: GRID_H,

  body: {
    spine: [
      { id: 'jaw',    x: 0.30, y: 0.40, radius: 0.014 },
      { id: 'head',   x: 0.36, y: 0.30, radius: 0.074 },
      { id: 'neck',   x: 0.40, y: 0.44, radius: 0.042 },
      { id: 'chest',  x: 0.44, y: 0.54, radius: 0.082 },
      { id: 'belly',  x: 0.46, y: 0.64, radius: 0.078 },
      { id: 'hip',    x: 0.46, y: 0.74, radius: 0.065 },
    ],
  },

  limbs: [
    // Near arm — free hand, dangling low
    {
      side: 'near',
      radius: 0.028,
      positions: [[0.40, 0.52], [0.34, 0.58], [0.28, 0.64], [0.24, 0.68]],
    },
    // Far arm — gripping staff, extended upward (staff arm treated as near for visibility)
    {
      side: 'near',
      radius: 0.024,
      positions: [[0.48, 0.50], [0.52, 0.42], [0.54, 0.36], [0.56, 0.32]],
    },
    // Near leg — forward, weight planted
    {
      side: 'near',
      radius: 0.036,
      positions: [[0.38, 0.78], [0.34, 0.86], [0.32, 0.94]],
    },
    // Far leg — back
    {
      side: 'far',
      radius: 0.030,
      positions: [[0.54, 0.78], [0.58, 0.86], [0.60, 0.94]],
    },
  ],

  head: {
    x: 0.36,
    y: 0.30,
    radius: 0.074,
    jawDrop: 0.18,
    teethCount: 5,
  },

  accessories: [],
};

// --------------------------------------------------------------------------
// Factory
// --------------------------------------------------------------------------
export function makeGoblinShamanDrawFn(threeRenderer) {
  const bundle = buildCreature(GOBLIN_SHAMAN_3D_SPEC);
  bundle.playClip('idle');
  const drawFn = makeThreeDrawFn(bundle.scene, bundle.camera, threeRenderer);
  return { drawFn, bundle };
}

export default {
  gridW: GRID_W,
  gridH: GRID_H,
  makeDrawFn: makeGoblinShamanDrawFn,
  spec: GOBLIN_SHAMAN_3D_SPEC,
};
