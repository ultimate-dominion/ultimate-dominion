// gelatinous-ooze-3d.js — Three.js scene for Gelatinous Ooze
import { buildCreature } from './creature-builder.js';
import { makeThreeDrawFn } from './three-bridge.js';

// Re-export 2D for fallback
export { drawGelatinousOozeClean, gelatinousOozeSkeleton } from './gelatinous-ooze.js';

// --------------------------------------------------------------------------
// Toon palette — matches gelatinous-ooze.js color bands
//   bodyDark   [6,22,18]      lum 0.050
//   bodyMid    [12,38,32]     lum 0.093
//   bodyLight  [20,58,48]     lum 0.149
//   bodyBright [32,85,68]     lum 0.231
//   innerGlow  [40,150,110]   lum 0.429
//   slimeGlow  [60,210,160]   lum 0.620
//   boneColor  [220,210,170]  lum 0.806
// --------------------------------------------------------------------------
export const GELATINOUS_OOZE_PALETTE = [
  { r: 6,   g: 22,  b: 18  },  // 0 DEEP
  { r: 12,  g: 38,  b: 32  },  // 1 SHADOW
  { r: 20,  g: 58,  b: 48  },  // 2 MID
  { r: 32,  g: 85,  b: 68  },  // 3 LIGHT
  { r: 40,  g: 150, b: 110 },  // 4 HI (inner glow)
  { r: 60,  g: 210, b: 160 },  // 5 RIM (slime glow)
  { r: 220, g: 210, b: 170 },  // 6 BONE (accent)
];

export const GRID_W = 7;
export const GRID_H = 7;

// --------------------------------------------------------------------------
// Gelatinous Ooze 3D spec — amorphous cube, no limbs, no head, no tail
// Body spine is a single center node representing the blob mass
// --------------------------------------------------------------------------
export const GELATINOUS_OOZE_3D_SPEC = {
  palette: GELATINOUS_OOZE_PALETTE,
  gridW: GRID_W,
  gridH: GRID_H,

  body: {
    spine: [
      { id: 'center', x: 0.50, y: 0.50, radius: 0.250 },
    ],
  },

  limbs: [],

  accessories: [],
};

// --------------------------------------------------------------------------
// Factory
// --------------------------------------------------------------------------
export function makeGelatinousOozeDrawFn(threeRenderer) {
  const bundle = buildCreature(GELATINOUS_OOZE_3D_SPEC);
  bundle.playClip('idle');
  const drawFn = makeThreeDrawFn(bundle.scene, bundle.camera, threeRenderer);
  return { drawFn, bundle };
}

export default {
  gridW: GRID_W,
  gridH: GRID_H,
  makeDrawFn: makeGelatinousOozeDrawFn,
  spec: GELATINOUS_OOZE_3D_SPEC,
};
