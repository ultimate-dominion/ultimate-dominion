// carrion-crawler-3d.js — Three.js scene for Carrion Crawler
import { buildCreature } from './creature-builder.js';
import { makeThreeDrawFn } from './three-bridge.js';

// Re-export 2D for fallback
export { drawCarrionCrawlerClean, carrionCrawlerSkeleton } from './carrion-crawler.js';

// --------------------------------------------------------------------------
// Toon palette — matches carrion-crawler.js color bands
//   shellDark      [20,32,16]    lum 0.082
//   shellMid       [40,66,30]    lum 0.172
//   shellLight     [72,106,52]   lum 0.308
//   shellHi        [108,144,80]  lum 0.476
//   bellyShadow    [96,64,50]    lum 0.222
//   bellyBase      [172,136,112] lum 0.534
//   bellyLight     [204,178,148] lum 0.695
//   teethColor     [236,224,194] lum 0.872
// --------------------------------------------------------------------------
export const CARRION_CRAWLER_PALETTE = [
  { r: 20,  g: 32,  b: 16  },  // 0 DEEP
  { r: 40,  g: 66,  b: 30  },  // 1 SHADOW
  { r: 72,  g: 106, b: 52  },  // 2 MID
  { r: 108, g: 144, b: 80  },  // 3 LIGHT
  { r: 172, g: 136, b: 112 },  // 4 BELLY (warm contrast)
  { r: 204, g: 178, b: 148 },  // 5 HI
  { r: 236, g: 224, b: 194 },  // 6 RIM
];

export const GRID_W = 10;
export const GRID_H = 13;

// --------------------------------------------------------------------------
// Carrion Crawler 3D spec — multi-segment worm body, 8 leg tentacles
// Note: the 2D file mirrors the canvas (ctx.scale(-1,1)), so skeleton coords
// are as defined in the export — the builder handles orientation.
// --------------------------------------------------------------------------
export const CARRION_CRAWLER_3D_SPEC = {
  rig: 'serpentine',
  palette: CARRION_CRAWLER_PALETTE,
  gridW: GRID_W,
  gridH: GRID_H,

  body: {
    spine: [
      { id: 'snout',  x: 0.80, y: 0.25, radius: 0.050 },
      { id: 'head',   x: 0.72, y: 0.23, radius: 0.100 },
      { id: 'neck',   x: 0.66, y: 0.34, radius: 0.116 },
      { id: 'chest',  x: 0.58, y: 0.46, radius: 0.134 },
      { id: 'mid',    x: 0.47, y: 0.58, radius: 0.148 },
      { id: 'rump',   x: 0.35, y: 0.69, radius: 0.156 },
      { id: 'tail',   x: 0.24, y: 0.79, radius: 0.144 },
    ],
  },

  limbs: [
    // Far legs (behind body)
    {
      side: 'far',
      radius: 0.026,
      positions: [[0.22, 0.84], [0.19, 0.89], [0.18, 0.93]],
    },
    {
      side: 'far',
      radius: 0.028,
      positions: [[0.34, 0.79], [0.34, 0.86], [0.35, 0.91]],
    },
    {
      side: 'far',
      radius: 0.026,
      positions: [[0.45, 0.70], [0.48, 0.78], [0.50, 0.86]],
    },
    {
      side: 'far',
      radius: 0.024,
      positions: [[0.56, 0.60], [0.61, 0.69], [0.64, 0.79]],
    },
    // Near legs (in front of body)
    {
      side: 'near',
      radius: 0.030,
      positions: [[0.29, 0.82], [0.30, 0.89], [0.31, 0.93]],
    },
    {
      side: 'near',
      radius: 0.032,
      positions: [[0.42, 0.78], [0.47, 0.86], [0.50, 0.92]],
    },
    {
      side: 'near',
      radius: 0.030,
      positions: [[0.53, 0.68], [0.58, 0.78], [0.61, 0.87]],
    },
    {
      side: 'near',
      radius: 0.028,
      positions: [[0.63, 0.58], [0.69, 0.67], [0.74, 0.79]],
    },
  ],

  head: {
    x: 0.72,
    y: 0.23,
    radius: 0.100,
    jawDrop: 0.25,   // gaping maw, mandibles visible
    teethCount: 6,
  },

  accessories: [],
};

// --------------------------------------------------------------------------
// Factory
// --------------------------------------------------------------------------
export function makeCarrionCrawlerDrawFn(threeRenderer) {
  const bundle = buildCreature(CARRION_CRAWLER_3D_SPEC);
  bundle.playClip('idle');
  const drawFn = makeThreeDrawFn(bundle.scene, bundle.camera, threeRenderer);
  return { drawFn, bundle };
}

export default {
  gridW: GRID_W,
  gridH: GRID_H,
  makeDrawFn: makeCarrionCrawlerDrawFn,
  spec: CARRION_CRAWLER_3D_SPEC,
};
