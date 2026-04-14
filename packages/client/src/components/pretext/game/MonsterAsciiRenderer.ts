/**
 * Monster ASCII Renderer v8 — Half-Block + Selective Rim + Background Fill + Glow
 *
 * What's new in v8 (over v7):
 *   1. Per-cell background color — fills gaps between character strokes with ambient color
 *   2. Selective rim coloring — warm highlights on lit edges, cool tones on shadow edges
 *   3. Half-block interior rendering — non-edge cells render as 2 colored halves (2x vert res)
 *   4. Canvas glow for accent cells — bright features (eyes, teeth, magic) get light bleed
 *
 * Rendering pipeline:
 * Template stage (512px, cached):
 *   1. Draw template silhouette with colors
 *   2. Global brightness boost (1.8x) — paint bright, display moody
 *   3. Procedural noise texture — surface detail (scales, fur, stone grain)
 *   4. Auto-contour — edge detection brightens silhouette boundary
 *
 * Render stage (per frame):
 *   5. Area-averaged color sampling with full RGB + half-cell sampling for interior
 *   6. Normal-mapped directional lighting (high ambient 0.70)
 *   7. Aggressive gamma lift (0.50) for dark-bg visibility
 *   8. Interior/edge classification — edge cells get characters, interior gets half-blocks
 *   9. Selective rim lighting — warm/cool shift based on light direction
 *   10. Background color fill — dim ambient rect behind every visible cell
 *   11. Multi-pass depth extrusion for 3D volume (handles both modes)
 *   12. Main render — half-block rects for interior, characters for edges
 *   13. Canvas glow — shadowBlur on bright accent cells
 *   14. Perspective foreshortening + idle animation
 */

import { FONTS } from '../theme';
import type { MonsterTemplate } from './monsterTemplates';

// Dense character palette sorted by visual density.
const CHAR_PALETTE = " .`',:-~^;*+!=?#@";

// Edge-directed characters indexed by quantized angle (0-7, 45° steps).
const EDGE_CHARS = ['-', '/', '|', '\\', '-', '/', '|', '\\'];
const EDGE_GRADIENT_THRESHOLD = 0.08;

// ---------------------------------------------------------------------------
// Module state
// ---------------------------------------------------------------------------

let charBrightness: number[] | null = null;
const templateCache = new Map<string, TemplateData>();

type TemplateData = {
  data: ImageData;
  w: number;
  h: number;
  normals: Float32Array | null;
  normalCols: number;
  normalRows: number;
};

type CellData = {
  char: string;
  x: number;
  y: number;
  r: number;
  g: number;
  b: number;
  a: number;
  weight: number;
  fontSize: number;
  // v8: cell geometry for fillRect
  cellW: number;
  cellH: number;
  // v8: rendering mode (set during edge detection pass)
  isInterior: boolean;
  // v8: half-block colors (only used when isInterior = true)
  topR: number;
  topG: number;
  topB: number;
  botR: number;
  botG: number;
  botB: number;
};

let cellBuffer: CellData[] = [];
let cellCount = 0;
let gridIndex: Int32Array = new Int32Array(0);
let lumGrid: Float32Array = new Float32Array(0);

function ensureBuffer(size: number) {
  while (cellBuffer.length < size) {
    cellBuffer.push({
      char: '', x: 0, y: 0, r: 0, g: 0, b: 0, a: 0, weight: 400, fontSize: 4,
      cellW: 0, cellH: 0, isInterior: false,
      topR: 0, topG: 0, topB: 0, botR: 0, botG: 0, botB: 0,
    });
  }
  if (gridIndex.length < size) {
    gridIndex = new Int32Array(size);
    lumGrid = new Float32Array(size);
  }
}

/** Measure visual density of each palette character via alpha-channel coverage */
function buildCharBrightness(): number[] {
  const canvas = document.createElement('canvas');
  const size = 16;
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  return Array.from(CHAR_PALETTE).map((char) => {
    ctx.clearRect(0, 0, size, size);
    ctx.fillStyle = '#fff';
    ctx.font = `400 ${size}px ${FONTS.serif}`;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';
    ctx.fillText(char, size / 2, size / 2);

    const imageData = ctx.getImageData(0, 0, size, size);
    let sum = 0;
    for (let i = 3; i < imageData.data.length; i += 4) {
      sum += imageData.data[i];
    }
    return sum / (size * size * 255);
  });
}

function ensureInit() {
  if (!charBrightness) {
    charBrightness = buildCharBrightness();
  }
}

// ---------------------------------------------------------------------------
// High-resolution template rendering
// ---------------------------------------------------------------------------

const TEMPLATE_RES = 512;

// Canvas elements reused for dynamic (animated) templates — avoids per-frame allocation
const dynamicCanvasCache = new Map<string, { c: HTMLCanvasElement; ctx: CanvasRenderingContext2D }>();

function getTemplateImage(template: MonsterTemplate): TemplateData {
  // Dynamic templates (GLB creatures) re-render every frame — skip the image cache
  if (template.dynamic) {
    const w = TEMPLATE_RES;
    const h = Math.round(TEMPLATE_RES * template.gridHeight / template.gridWidth);
    let dc = dynamicCanvasCache.get(template.id);
    if (!dc) {
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      dc = { c, ctx: c.getContext('2d', { willReadFrequently: true })! };
      dynamicCanvasCache.set(template.id, dc);
    }
    dc.ctx.fillStyle = '#000';
    dc.ctx.fillRect(0, 0, w, h);
    template.draw(dc.ctx, w, h);
    const data = dc.ctx.getImageData(0, 0, w, h);
    applyBrightnessBoost(data.data, w, h, template.renderOverrides?.brightnessBoost);
    // Skip noise for dynamic templates — GLB toon shading provides natural variation
    applyContourBrightening(data.data, w, h);
    return { data, w, h, normals: null, normalCols: 0, normalRows: 0 };
  }

  let cached = templateCache.get(template.id);
  if (cached) return cached;

  const w = TEMPLATE_RES;
  const h = Math.round(TEMPLATE_RES * template.gridHeight / template.gridWidth);
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, w, h);
  template.draw(ctx, w, h);
  const data = ctx.getImageData(0, 0, w, h);

  applyBrightnessBoost(data.data, w, h, template.renderOverrides?.brightnessBoost);
  applyNoiseTexture(data.data, w, h);
  applyContourBrightening(data.data, w, h);

  cached = { data, w, h, normals: null, normalCols: 0, normalRows: 0 };
  templateCache.set(template.id, cached);
  return cached;
}

// ---------------------------------------------------------------------------
// Template post-processing constants
// ---------------------------------------------------------------------------

const CONTOUR_BLACK_THRESHOLD = 8;
const CONTOUR_BOOST = 2.2;
const TEMPLATE_BRIGHTNESS_BOOST = 2.5;

// ---------------------------------------------------------------------------
// Procedural noise
// ---------------------------------------------------------------------------

function hash2d(x: number, y: number): number {
  let n = x * 374761393 + y * 668265263;
  n = ((n ^ (n >> 13)) * 1274126177) | 0;
  return ((n ^ (n >> 16)) & 0x7fffffff) / 0x7fffffff * 2 - 1;
}

function smoothstep(t: number): number {
  return t * t * (3 - 2 * t);
}

function valueNoise(x: number, y: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = smoothstep(x - ix);
  const fy = smoothstep(y - iy);

  const v00 = hash2d(ix, iy);
  const v10 = hash2d(ix + 1, iy);
  const v01 = hash2d(ix, iy + 1);
  const v11 = hash2d(ix + 1, iy + 1);

  const top = v00 + (v10 - v00) * fx;
  const bot = v01 + (v11 - v01) * fx;
  return top + (bot - top) * fy;
}

function surfaceNoise(x: number, y: number): number {
  const n1 = valueNoise(x * 0.15, y * 0.15) * 0.6;
  const n2 = valueNoise(x * 0.6, y * 0.6) * 0.4;
  return n1 + n2;
}

// ---------------------------------------------------------------------------
// Template post-processing pipeline
// ---------------------------------------------------------------------------

function applyBrightnessBoost(pixels: Uint8ClampedArray, w: number, h: number, boost?: number): void {
  const mul = boost ?? TEMPLATE_BRIGHTNESS_BOOST;
  for (let i = 0; i < w * h; i++) {
    const idx = i * 4;
    const lum = 0.299 * pixels[idx] + 0.587 * pixels[idx + 1] + 0.114 * pixels[idx + 2];
    if (lum < CONTOUR_BLACK_THRESHOLD) continue;
    pixels[idx]     = Math.min(255, Math.floor(pixels[idx] * mul));
    pixels[idx + 1] = Math.min(255, Math.floor(pixels[idx + 1] * mul));
    pixels[idx + 2] = Math.min(255, Math.floor(pixels[idx + 2] * mul));
  }
}

function applyNoiseTexture(pixels: Uint8ClampedArray, w: number, h: number): void {
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4;
      const lum = 0.299 * pixels[idx] + 0.587 * pixels[idx + 1] + 0.114 * pixels[idx + 2];
      if (lum < CONTOUR_BLACK_THRESHOLD) continue;

      const noise = surfaceNoise(x, y);
      const amplitude = 0.15 + (lum / 255) * 0.10;
      const mod = 1 + noise * amplitude;

      pixels[idx]     = Math.min(255, Math.max(0, Math.floor(pixels[idx] * mod)));
      pixels[idx + 1] = Math.min(255, Math.max(0, Math.floor(pixels[idx + 1] * mod)));
      pixels[idx + 2] = Math.min(255, Math.max(0, Math.floor(pixels[idx + 2] * mod)));
    }
  }
}

function applyContourBrightening(pixels: Uint8ClampedArray, w: number, h: number): void {
  const nonBlack = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const idx = i * 4;
    const lum = 0.299 * pixels[idx] + 0.587 * pixels[idx + 1] + 0.114 * pixels[idx + 2];
    nonBlack[i] = lum >= CONTOUR_BLACK_THRESHOLD ? 1 : 0;
  }

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (!nonBlack[i]) continue;

      let edgeDist = 0;
      for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]] as const) {
        const nx1 = x + dx;
        const ny1 = y + dy;
        if (nx1 < 0 || nx1 >= w || ny1 < 0 || ny1 >= h || !nonBlack[ny1 * w + nx1]) {
          edgeDist = 2;
          break;
        }
        const nx2 = x + dx * 2;
        const ny2 = y + dy * 2;
        if (nx2 < 0 || nx2 >= w || ny2 < 0 || ny2 >= h || !nonBlack[ny2 * w + nx2]) {
          if (edgeDist < 1) edgeDist = 1;
        }
      }

      if (edgeDist > 0) {
        const boost = edgeDist === 2 ? CONTOUR_BOOST : 1 + (CONTOUR_BOOST - 1) * 0.5;
        const idx = i * 4;
        pixels[idx]     = Math.min(255, Math.floor(pixels[idx] * boost));
        pixels[idx + 1] = Math.min(255, Math.floor(pixels[idx + 1] * boost));
        pixels[idx + 2] = Math.min(255, Math.floor(pixels[idx + 2] * boost));
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Full-color sampling
// ---------------------------------------------------------------------------

type ColorSample = { r: number; g: number; b: number; lum: number };

/** Area-averaged color sampling — returns RGB [0..1] and perceptual luminance */
function sampleColor(
  data: Uint8ClampedArray,
  imgW: number,
  imgH: number,
  col: number,
  row: number,
  cols: number,
  rows: number,
): ColorSample {
  const x0 = Math.floor((col / cols) * imgW);
  const y0 = Math.floor((row / rows) * imgH);
  const x1 = Math.max(x0 + 1, Math.ceil(((col + 1) / cols) * imgW));
  const y1 = Math.max(y0 + 1, Math.ceil(((row + 1) / rows) * imgH));

  let rSum = 0, gSum = 0, bSum = 0;
  let count = 0;
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const idx = (y * imgW + x) * 4;
      rSum += data[idx];
      gSum += data[idx + 1];
      bSum += data[idx + 2];
      count++;
    }
  }

  if (count === 0) return { r: 0, g: 0, b: 0, lum: 0 };

  const r = rSum / count;
  const g = gSum / count;
  const b = bSum / count;
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

  return { r: r / 255, g: g / 255, b: b / 255, lum };
}

/**
 * v8: Sample top-half or bottom-half of a cell's region.
 * Used for half-block interior rendering (2x vertical resolution).
 */
function sampleHalfColor(
  data: Uint8ClampedArray,
  imgW: number,
  imgH: number,
  col: number,
  row: number,
  cols: number,
  rows: number,
  half: 'top' | 'bottom',
): ColorSample {
  const x0 = Math.floor((col / cols) * imgW);
  const y0full = Math.floor((row / rows) * imgH);
  const y1full = Math.max(y0full + 1, Math.ceil(((row + 1) / rows) * imgH));
  const yMid = Math.floor((y0full + y1full) / 2);

  const y0 = half === 'top' ? y0full : Math.max(yMid, y0full + 1);
  const y1 = half === 'top' ? Math.max(yMid, y0full + 1) : y1full;
  const x1 = Math.max(x0 + 1, Math.ceil(((col + 1) / cols) * imgW));

  let rSum = 0, gSum = 0, bSum = 0;
  let count = 0;
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const idx = (y * imgW + x) * 4;
      rSum += data[idx];
      gSum += data[idx + 1];
      bSum += data[idx + 2];
      count++;
    }
  }

  if (count === 0) return { r: 0, g: 0, b: 0, lum: 0 };

  const r = rSum / count;
  const g = gSum / count;
  const b = bSum / count;
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

  return { r: r / 255, g: g / 255, b: b / 255, lum };
}

/** Luminance-only sampling for normals computation */
function sampleLuminance(
  data: Uint8ClampedArray,
  imgW: number,
  imgH: number,
  col: number,
  row: number,
  cols: number,
  rows: number,
): number {
  const x0 = Math.floor((col / cols) * imgW);
  const y0 = Math.floor((row / rows) * imgH);
  const x1 = Math.max(x0 + 1, Math.ceil(((col + 1) / cols) * imgW));
  const y1 = Math.max(y0 + 1, Math.ceil(((row + 1) / rows) * imgH));

  let sum = 0;
  let count = 0;
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const idx = (y * imgW + x) * 4;
      sum += 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
      count++;
    }
  }
  return count > 0 ? sum / (count * 255) : 0;
}

/**
 * Compute per-cell surface normals from luminance gradients.
 */
function computeNormals(
  tpl: TemplateData,
  cols: number,
  rows: number,
): Float32Array {
  if (tpl.normals && tpl.normalCols === cols && tpl.normalRows === rows) {
    return tpl.normals;
  }

  const normals = new Float32Array(cols * rows * 2);
  const d = tpl.data.data;
  const iw = tpl.w;
  const ih = tpl.h;

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const bL = col > 0 ? sampleLuminance(d, iw, ih, col - 1, row, cols, rows) : 0;
      const bR = col < cols - 1 ? sampleLuminance(d, iw, ih, col + 1, row, cols, rows) : 0;
      const bU = row > 0 ? sampleLuminance(d, iw, ih, col, row - 1, cols, rows) : 0;
      const bD = row < rows - 1 ? sampleLuminance(d, iw, ih, col, row + 1, cols, rows) : 0;

      const idx = (row * cols + col) * 2;
      normals[idx] = bL - bR;
      normals[idx + 1] = bU - bD;
    }
  }

  tpl.normals = normals;
  tpl.normalCols = cols;
  tpl.normalRows = rows;
  return normals;
}

// ---------------------------------------------------------------------------
// Weight
// ---------------------------------------------------------------------------

function getWeight(level: number, isBoss: boolean, brightness: number): number {
  if (isBoss || level >= 10) {
    return brightness < 0.3 ? 600 : 700;
  }
  if (level >= 7) {
    return brightness < 0.25 ? 400 : brightness < 0.55 ? 600 : 700;
  }
  if (level >= 4) {
    return brightness < 0.3 ? 400 : 600;
  }
  return brightness < 0.4 ? 400 : brightness < 0.7 ? 400 : 600;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEPTH_LAYERS = 3;
const DEPTH_OFFSET = 1.5;
const GAMMA = 0.38;

// v8: glow threshold — cells brighter than this get canvas shadowBlur
const GLOW_LUM_THRESHOLD = 0.72;
const GLOW_BLUR_BASE = 6;
const GLOW_BLUR_MAX = 14;

// v8: background fill intensity
const BG_FILL_BRIGHTNESS = 0.60; // how bright the bg rect is relative to cell color
const BG_FILL_ALPHA = 0.65;      // opacity of the bg rect

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Animation state — drives combat actions
// ---------------------------------------------------------------------------

export type AnimAction =
  | 'idle'
  | 'attack'      // Generic 3-phase attack (windup → strike → recover) for ASCII-only monsters
  | 'fangs'       // Basilisk Fangs — physical lunge + bite
  | 'gaze'        // Petrifying Gaze — eyes charge + magic wave
  | 'hit'         // Taking damage — recoil + flash
  | 'block'       // Defender blocks — reduced damage
  | 'dodge'       // Defender dodges — no damage
  | 'death'       // Dying — collapse + dissolve
  | 'enrage';     // Low HP — faster, redder, meaner

export type AnimationState = {
  action: AnimAction;
  /** Timestamp (ms) when the action started */
  startTime: number;
  /**
   * Optional per-signal duration override. Used by the battle scene to sync
   * the ASCII `'attack'` pose with the current weapon's projectile speed
   * (melee 600ms, spell 500ms, ranged 400ms) so the strike phase peaks at
   * the moment of impact. Falls back to `ACTION_DURATION[action]` if unset.
   */
  durationOverride?: number;
};

/** Easing: fast start, slow finish */
function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}
/** Easing: slow start, fast middle, slow finish */
function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}
/** Easing: overshoot then settle */
function easeOutBack(t: number): number {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

/** Duration of each action in ms */
const ACTION_DURATION: Record<AnimAction, number> = {
  idle: Infinity,
  // 600ms matches WEAPON_SPEED.melee so the ASCII strike pose peaks right as
  // the projectile reaches the defender.
  attack: 600,
  fangs: 900,
  gaze: 1200,
  hit: 500,
  block: 400,
  dodge: 350,
  death: 2000,
  enrage: 800,
};

type AnimParams = {
  translateX: number;
  translateY: number;
  scale: number;
  colorShiftR: number;
  colorShiftG: number;
  colorShiftB: number;
  glowIntensity: number;
  /** 0 = normal, 1 = fully dissolved */
  dissolve: number;
  /** Shake magnitude in pixels */
  shake: number;
};

export function computeAnimParams(anim: AnimationState | undefined, elapsed: number): AnimParams {
  const base: AnimParams = {
    translateX: 0, translateY: 0, scale: 1,
    colorShiftR: 0, colorShiftG: 0, colorShiftB: 0,
    glowIntensity: 0, dissolve: 0, shake: 0,
  };
  if (!anim || anim.action === 'idle') return base;

  const dt = elapsed - anim.startTime;
  const duration = anim.durationOverride ?? ACTION_DURATION[anim.action];
  const t = Math.min(1, dt / duration); // 0..1 progress

  switch (anim.action) {
    case 'attack': {
      // Three-phase generic attack for ASCII-only monsters. Monsters sit on
      // the right of the canvas and face LEFT toward the player, so "windup"
      // is pulling back to +X and "strike" is lunging toward -X.
      //   0.00-0.25 windup  — pull back (+X), crouch, faint red charge
      //   0.25-0.55 strike  — lunge toward the player (-X), scale up, shake
      //   0.55-1.00 recover — settle back to idle
      if (t < 0.25) {
        const p = easeInOutCubic(t / 0.25);
        base.translateX = 6 * p;          // pull back (away from player)
        base.translateY = 2 * p;
        base.scale = 1 - 0.02 * p;
        base.colorShiftR = Math.floor(20 * p);
      } else if (t < 0.55) {
        const p = easeOutBack((t - 0.25) / 0.30);
        base.translateX = 6 - 28 * p;     // lunge toward player (-X)
        base.translateY = 2 - 6 * p;
        base.scale = 0.98 + 0.10 * p;
        base.colorShiftR = Math.floor(20 + 40 * p);
        base.shake = (1 - (t - 0.25) / 0.30) * 3;
      } else {
        const p = easeOutCubic((t - 0.55) / 0.45);
        base.translateX = -22 * (1 - p);
        base.translateY = -4 * (1 - p);
        base.scale = 1.08 - 0.08 * p;
        base.colorShiftR = Math.floor(60 * (1 - p));
      }
      break;
    }
    case 'fangs': {
      // Phase 1 (0-0.25): tense — pull back slightly, crouch
      // Phase 2 (0.25-0.55): lunge — snap forward fast
      // Phase 3 (0.55-1.0): recover — settle back to idle
      if (t < 0.25) {
        const p = easeInOutCubic(t / 0.25);
        base.translateX = -8 * p;
        base.translateY = 3 * p;
        base.scale = 1 - 0.03 * p;
      } else if (t < 0.55) {
        const p = easeOutBack((t - 0.25) / 0.30);
        base.translateX = -8 + 35 * p;
        base.translateY = 3 - 8 * p;
        base.scale = 0.97 + 0.08 * p;
        base.shake = (1 - (t - 0.25) / 0.30) * 3;
      } else {
        const p = easeOutCubic((t - 0.55) / 0.45);
        base.translateX = 27 * (1 - p);
        base.translateY = -5 * (1 - p);
        base.scale = 1.05 - 0.05 * p;
      }
      break;
    }
    case 'gaze': {
      // Phase 1 (0-0.4): eyes charge — body stiffens, green glow builds
      // Phase 2 (0.4-0.65): release — wave of energy, slight recoil
      // Phase 3 (0.65-1.0): settle — glow fades
      if (t < 0.40) {
        const p = easeInOutCubic(t / 0.40);
        base.scale = 1 + 0.02 * p;
        base.colorShiftG = Math.floor(60 * p);
        base.glowIntensity = p;
        base.translateY = -2 * p;
      } else if (t < 0.65) {
        const p = easeOutCubic((t - 0.40) / 0.25);
        base.scale = 1.02 - 0.04 * p;
        base.translateX = -6 * p;
        base.colorShiftG = 60 - Math.floor(30 * p);
        base.glowIntensity = 1 - 0.3 * p;
        base.shake = (1 - p) * 4;
      } else {
        const p = easeOutCubic((t - 0.65) / 0.35);
        base.scale = 0.98 + 0.02 * p;
        base.translateX = -6 * (1 - p);
        base.colorShiftG = Math.floor(30 * (1 - p));
        base.glowIntensity = 0.7 * (1 - p);
      }
      break;
    }
    case 'hit': {
      // Quick recoil + white flash + shake
      if (t < 0.15) {
        const p = easeOutCubic(t / 0.15);
        base.translateX = -12 * p;
        base.scale = 1 - 0.04 * p;
        base.colorShiftR = Math.floor(120 * p);
        base.colorShiftG = Math.floor(100 * p);
        base.colorShiftB = Math.floor(100 * p);
        base.shake = 6 * p;
      } else {
        const p = easeOutCubic((t - 0.15) / 0.85);
        base.translateX = -12 * (1 - p);
        base.scale = 0.96 + 0.04 * p;
        base.colorShiftR = Math.floor(120 * (1 - p));
        base.colorShiftG = Math.floor(100 * (1 - p));
        base.colorShiftB = Math.floor(100 * (1 - p));
        base.shake = 6 * (1 - p);
      }
      break;
    }
    case 'death': {
      // Slow collapse: sink down, desaturate, dissolve from edges
      const p = easeInOutCubic(t);
      base.translateY = 20 * p;
      base.scale = 1 - 0.15 * p;
      // Desaturate by shifting all channels toward gray
      base.colorShiftR = -Math.floor(30 * p);
      base.colorShiftG = -Math.floor(30 * p);
      base.colorShiftB = -Math.floor(20 * p);
      base.dissolve = p;
      break;
    }
    case 'enrage': {
      // Pulse red, scale up aggressively, then hold at slightly larger
      if (t < 0.5) {
        const p = easeOutBack(t / 0.5);
        base.scale = 1 + 0.06 * p;
        base.colorShiftR = Math.floor(50 * p);
        base.shake = 3 * (1 - t / 0.5);
      } else {
        const p = (t - 0.5) / 0.5;
        base.scale = 1.06 - 0.02 * p;
        base.colorShiftR = Math.floor(50 * (1 - p * 0.4));
      }
      break;
    }
  }
  return base;
}

export type RenderOptions = {
  alpha?: number;
  elapsed?: number;
  /** Target cell width in px. Smaller = denser. Default: 4. Min: 3 */
  cellSize?: number;
  /** Enable 3D perspective + lighting + animation. Default: true */
  enable3D?: boolean;
  /** v8: Per-cell background fill for continuous color. Default: true */
  enableBgFill?: boolean;
  /** v8: Half-block rendering for interior cells. Default: false */
  enableHalfBlock?: boolean;
  /** v8: Canvas glow on bright accent cells. Default: true */
  enableGlow?: boolean;
  /** Combat animation state */
  animation?: AnimationState;
};

export function renderMonster(
  ctx: CanvasRenderingContext2D,
  template: MonsterTemplate,
  x: number,
  y: number,
  width: number,
  height: number,
  options: RenderOptions = {},
): void {
  ensureInit();
  const {
    alpha = 1,
    elapsed = 0,
    cellSize = 4,
    enable3D = true,
    enableBgFill = true,
    enableHalfBlock = false,
    enableGlow = true,
    animation,
  } = options;

  if (width < 20 || height < 20) return;

  // Compute animation parameters
  const anim = computeAnimParams(animation, elapsed);

  const tpl = getTemplateImage(template);

  // Per-template rendering overrides (dark creatures stay dark, etc.)
  const ovr = template.renderOverrides;
  const tplGamma = ovr?.gamma ?? GAMMA;
  const tplAmbient = ovr?.ambient ?? 0.85;
  const tplCharFloor = ovr?.charDensityFloor ?? 0.30;

  // -----------------------------------------------------------------------
  // Grid sizing
  // -----------------------------------------------------------------------

  const cellW = Math.max(3, cellSize);
  const cellH = cellW * 1.25;

  const maxCols = Math.floor(width / cellW);
  const maxRows = Math.floor(height / cellH);

  const templateAspect = template.gridWidth / template.gridHeight;
  let cols: number, rows: number;

  if (maxCols / maxRows > templateAspect) {
    rows = maxRows;
    cols = Math.round(rows * templateAspect);
  } else {
    cols = maxCols;
    rows = Math.round(cols / templateAspect);
  }

  cols = Math.max(10, cols);
  rows = Math.max(6, rows);

  const actualCellW = Math.min(width / cols, height / (rows * 1.25));
  const actualCellH = actualCellW * 1.25;
  const renderW = cols * actualCellW;
  const renderH = rows * actualCellH;

  // -----------------------------------------------------------------------
  // 3D parameters
  // -----------------------------------------------------------------------

  const bobY = enable3D ? Math.sin(elapsed * 0.0018) * 3 : 0;
  const swayX = enable3D ? Math.sin(elapsed * 0.0013) * 1.5 : 0;
  const breathScale = (enable3D ? 1 + Math.sin(elapsed * 0.0025) * 0.012 : 1) * anim.scale;
  const perspectiveAmount = enable3D ? 0.12 : 0;

  const lightAngle = elapsed * 0.0008;
  const lightX = Math.cos(lightAngle) * 0.6;
  const lightY = -0.3 + Math.sin(lightAngle * 0.7) * 0.2;
  const lightZ = 0.7;
  const lightLen = Math.sqrt(lightX * lightX + lightY * lightY + lightZ * lightZ);
  const lx = lightX / lightLen;
  const ly = lightY / lightLen;
  const lz = lightZ / lightLen;

  // Shake: random per-frame offset
  const shakeX = anim.shake > 0 ? (Math.random() - 0.5) * anim.shake * 2 : 0;
  const shakeY = anim.shake > 0 ? (Math.random() - 0.5) * anim.shake * 2 : 0;

  const centerX = x + (width - renderW) / 2 + swayX + anim.translateX + shakeX;
  const centerY = y + (height - renderH) / 2 + bobY + anim.translateY + shakeY;

  let normals: Float32Array | null = null;
  if (enable3D) {
    normals = computeNormals(tpl, cols, rows);
  }

  const bossWaveFront = template.isBoss
    ? (Math.sin(elapsed * 0.0015) * 0.5 + 0.5)
    : -1;

  // -----------------------------------------------------------------------
  // Atmospheric background glow
  // -----------------------------------------------------------------------

  if (template.atmosphere) {
    const atm = template.atmosphere;
    const glowCX = centerX + renderW / 2;
    const glowCY = centerY + renderH * 0.42;
    const glowR = Math.max(renderW, renderH) * 0.85;
    const boostI = atm.intensity * 2.5;
    const grad = ctx.createRadialGradient(glowCX, glowCY, 0, glowCX, glowCY, glowR);
    grad.addColorStop(0, `rgba(${atm.r},${atm.g},${atm.b},${Math.min(1, boostI)})`);
    grad.addColorStop(0.35, `rgba(${atm.r},${atm.g},${atm.b},${Math.min(1, boostI * 0.5)})`);
    grad.addColorStop(0.7, `rgba(${atm.r},${atm.g},${atm.b},${Math.min(1, boostI * 0.15)})`);
    grad.addColorStop(1, `rgba(${atm.r},${atm.g},${atm.b},0)`);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = grad;
    ctx.fillRect(x, y, width, height);
    ctx.restore();
  }

  // -----------------------------------------------------------------------
  // Ground shadow
  // -----------------------------------------------------------------------

  if (enable3D) {
    ctx.save();
    const shadowH = renderH * 0.1;
    const shadowY = centerY + renderH * breathScale + shadowH * 0.5;
    const shadowW = renderW * 0.65;
    const shadowCenterX = centerX + renderW / 2;

    ctx.globalAlpha = alpha * 0.12;
    ctx.fillStyle = 'rgb(20, 15, 10)';
    ctx.beginPath();
    ctx.ellipse(shadowCenterX, shadowY, shadowW / 2, shadowH / 2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // -----------------------------------------------------------------------
  // Pre-compute cell buffer with FULL COLOR from template
  // -----------------------------------------------------------------------

  const fontSize = actualCellW * 1.2;
  const brightness = charBrightness!;
  const gridSize = cols * rows;

  ensureBuffer(gridSize);
  cellCount = 0;
  gridIndex.fill(-1, 0, gridSize);
  lumGrid.fill(0, 0, gridSize);

  for (let row = 0; row < rows; row++) {
    const rowT = row / (rows - 1 || 1);
    const perspScale = 1 - perspectiveAmount * (1 - rowT);
    const breathOffsetY = (1 - breathScale) * (rows - row) * actualCellH * 0.5;
    const rowW = renderW * perspScale;
    const rowOffsetX = centerX + (renderW - rowW) / 2;
    const rowCellW = rowW / cols;
    const rowCellH = actualCellH * breathScale;
    const drawY = centerY + row * rowCellH + breathOffsetY;

    for (let col = 0; col < cols; col++) {
      const color = sampleColor(tpl.data.data, tpl.w, tpl.h, col, row, cols, rows);
      if (color.lum < 0.02) continue;

      // Lighting
      let lightMul = 1.0;
      if (normals) {
        const nIdx = (row * cols + col) * 2;
        const nx = normals[nIdx];
        const ny = normals[nIdx + 1];
        const nz = 0.5;
        const nLen = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;

        const dot = (nx / nLen) * lx + (ny / nLen) * ly + (nz / nLen) * lz;
        lightMul = tplAmbient + Math.max(0, dot) * (1 - tplAmbient);

        if (color.lum > 0.10) {
          const hx = lx;
          const hy = ly;
          const hz = lz + 1;
          const hLen = Math.sqrt(hx * hx + hy * hy + hz * hz) || 1;
          const spec = Math.max(0, (nx / nLen) * (hx / hLen) + (ny / nLen) * (hy / hLen) + (nz / nLen) * (hz / hLen));
          lightMul += Math.pow(spec, 5) * 0.6;
        }
      }

      // Boss wave
      if (bossWaveFront >= 0) {
        const colT = col / cols;
        const distFromWave = Math.abs(colT - bossWaveFront);
        lightMul += Math.max(0, 1 - distFromWave * 4) * 0.3;
      }

      lightMul = Math.min(2.0, Math.max(0, lightMul));

      // Character selection
      const litLum = Math.min(1, color.lum * lightMul);
      const charLum = Math.max(tplCharFloor, litLum);
      let bestIdx = 0;
      let bestDiff = 1;
      for (let i = 0; i < brightness.length; i++) {
        const diff = Math.abs(brightness[i] - charLum);
        if (diff < bestDiff) {
          bestDiff = diff;
          bestIdx = i;
        }
      }
      const char = CHAR_PALETTE[bestIdx];
      if (char === ' ') continue;

      // Wave displacement
      let waveX = 0;
      let waveY = 0;
      if (enable3D) {
        waveX = Math.sin(elapsed * 0.003 + col * 0.4 + row * 0.3) * 0.4
              + Math.sin(elapsed * 0.0017 + col * 0.23 + row * 0.17) * 0.2;
        waveY = Math.cos(elapsed * 0.0025 + col * 0.3 + row * 0.5) * 0.3
              + Math.cos(elapsed * 0.0013 + col * 0.19 + row * 0.31) * 0.15;
      }

      const weight = getWeight(template.level, !!template.isBoss, litLum);
      const drawFontSize = fontSize * perspScale;

      const cellX = rowOffsetX + col * rowCellW + rowCellW / 2 + waveX;
      const cellY = drawY + rowCellH / 2 + waveY;

      // Gamma lift
      const litR = color.r * lightMul;
      const litG = color.g * lightMul;
      const litB = color.b * lightMul;
      const r = Math.min(255, Math.floor(Math.pow(Math.min(1, litR), tplGamma) * 255));
      const g = Math.min(255, Math.floor(Math.pow(Math.min(1, litG), tplGamma) * 255));
      const bChan = Math.min(255, Math.floor(Math.pow(Math.min(1, litB), tplGamma) * 255));
      const a = alpha * (0.75 + litLum * 0.25);

      // v8: Sample half-colors for potential half-block rendering
      let topR = r, topG = g, topB = bChan;
      let botR = r, botG = g, botB = bChan;
      if (enableHalfBlock) {
        const topColor = sampleHalfColor(tpl.data.data, tpl.w, tpl.h, col, row, cols, rows, 'top');
        const botColor = sampleHalfColor(tpl.data.data, tpl.w, tpl.h, col, row, cols, rows, 'bottom');
        // Apply same lighting + gamma to half-colors
        topR = Math.min(255, Math.floor(Math.pow(Math.min(1, topColor.r * lightMul), tplGamma) * 255));
        topG = Math.min(255, Math.floor(Math.pow(Math.min(1, topColor.g * lightMul), tplGamma) * 255));
        topB = Math.min(255, Math.floor(Math.pow(Math.min(1, topColor.b * lightMul), tplGamma) * 255));
        botR = Math.min(255, Math.floor(Math.pow(Math.min(1, botColor.r * lightMul), tplGamma) * 255));
        botG = Math.min(255, Math.floor(Math.pow(Math.min(1, botColor.g * lightMul), tplGamma) * 255));
        botB = Math.min(255, Math.floor(Math.pow(Math.min(1, botColor.b * lightMul), tplGamma) * 255));
      }

      const cellIdx = cellCount++;
      const cell = cellBuffer[cellIdx];
      cell.char = char;
      cell.x = cellX;
      cell.y = cellY;
      cell.r = r;
      cell.g = g;
      cell.b = bChan;
      cell.a = a;
      cell.weight = weight;
      cell.fontSize = drawFontSize;
      cell.cellW = rowCellW;
      cell.cellH = rowCellH;
      cell.isInterior = false; // will be set in edge pass
      cell.topR = topR;
      cell.topG = topG;
      cell.topB = topB;
      cell.botR = botR;
      cell.botG = botG;
      cell.botB = botB;

      gridIndex[row * cols + col] = cellIdx;
      lumGrid[row * cols + col] = color.lum;
    }
  }

  // -----------------------------------------------------------------------
  // Rim lighting + edge-directed characters + v8 selective coloring
  // -----------------------------------------------------------------------

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const idx = gridIndex[row * cols + col];
      if (idx < 0) continue;

      let emptyNeighbors = 0;
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (dr === 0 && dc === 0) continue;
          const nr = row + dr;
          const nc = col + dc;
          if (nr < 0 || nr >= rows || nc < 0 || nc >= cols || gridIndex[nr * cols + nc] < 0) {
            emptyNeighbors++;
          }
        }
      }

      const cell = cellBuffer[idx];

      if (emptyNeighbors === 0) {
        // v8: Interior cell — all neighbors visible, mark for half-block
        cell.isInterior = enableHalfBlock;
      } else {
        // Edge cell — apply selective rim coloring
        cell.isInterior = false;
        const rimStrength = Math.min(1, emptyNeighbors / 3);

        // v8: Selective rim — warm (top/lit) vs cool (bottom/shadow)
        // Determine if this edge faces toward or away from light
        const rowNorm = (row / (rows - 1 || 1)) * 2 - 1; // -1 at top, +1 at bottom
        const colNorm = (col / (cols - 1 || 1)) * 2 - 1; // -1 at left, +1 at right
        // Dot product with light direction gives warm/cool factor
        const facingLight = -(rowNorm * ly + colNorm * lx); // higher = more lit
        const warmCool = Math.max(-1, Math.min(1, facingLight));

        // Warm rim: boost R and G (amber/yellow)
        // Cool rim: boost B (blue steel)
        const boost = 1 + rimStrength * 1.2;
        if (warmCool > 0) {
          // Warm edge — add amber
          const warmAmount = warmCool * rimStrength * 0.4;
          cell.r = Math.min(255, Math.floor(cell.r * boost + warmAmount * 80));
          cell.g = Math.min(255, Math.floor(cell.g * boost + warmAmount * 40));
          cell.b = Math.min(255, Math.floor(cell.b * (boost * 0.7)));
        } else {
          // Cool edge — add blue
          const coolAmount = -warmCool * rimStrength * 0.3;
          cell.r = Math.min(255, Math.floor(cell.r * (boost * 0.8)));
          cell.g = Math.min(255, Math.floor(cell.g * (boost * 0.85)));
          cell.b = Math.min(255, Math.floor(cell.b * boost + coolAmount * 60));
        }
        cell.a = Math.min(1, cell.a + rimStrength * 0.35);

        // Edge-directed character selection via Sobel gradient
        const gIdx = row * cols + col;
        const lumL = col > 0 ? lumGrid[gIdx - 1] : 0;
        const lumR = col < cols - 1 ? lumGrid[gIdx + 1] : 0;
        const lumU = row > 0 ? lumGrid[gIdx - cols] : 0;
        const lumD = row < rows - 1 ? lumGrid[gIdx + cols] : 0;
        const gx = lumR - lumL;
        const gy = lumD - lumU;
        const gradMag = Math.sqrt(gx * gx + gy * gy);

        if (gradMag > EDGE_GRADIENT_THRESHOLD) {
          const angle = Math.atan2(gy, gx) + Math.PI / 2;
          const quantized = ((Math.round(angle / (Math.PI / 4)) % 8) + 8) % 8;
          cell.char = EDGE_CHARS[quantized];
        }
      }
    }
  }

  // -----------------------------------------------------------------------
  // Animation: color shifts, dissolve, glow overlay
  // -----------------------------------------------------------------------

  if (anim.colorShiftR !== 0 || anim.colorShiftG !== 0 || anim.colorShiftB !== 0) {
    for (let i = 0; i < cellCount; i++) {
      const c = cellBuffer[i];
      c.r = Math.max(0, Math.min(255, c.r + anim.colorShiftR));
      c.g = Math.max(0, Math.min(255, c.g + anim.colorShiftG));
      c.b = Math.max(0, Math.min(255, c.b + anim.colorShiftB));
      c.topR = Math.max(0, Math.min(255, c.topR + anim.colorShiftR));
      c.topG = Math.max(0, Math.min(255, c.topG + anim.colorShiftG));
      c.topB = Math.max(0, Math.min(255, c.topB + anim.colorShiftB));
      c.botR = Math.max(0, Math.min(255, c.botR + anim.colorShiftR));
      c.botG = Math.max(0, Math.min(255, c.botG + anim.colorShiftG));
      c.botB = Math.max(0, Math.min(255, c.botB + anim.colorShiftB));
    }
  }

  // Dissolve: remove cells from edges inward based on dissolve progress
  if (anim.dissolve > 0) {
    const rcx = centerX + renderW / 2;
    const rcy = centerY + renderH / 2;
    const maxDist = Math.sqrt(renderW * renderW + renderH * renderH) * 0.5;
    for (let i = 0; i < cellCount; i++) {
      const c = cellBuffer[i];
      // Distance from creature center, normalized 0..1
      const dx = (c.x - rcx) / (maxDist || 1);
      const dy = (c.y - rcy) / (maxDist || 1);
      const edgeDist = Math.sqrt(dx * dx + dy * dy);
      // Noise so cells vanish organically
      const noise = Math.sin(c.x * 0.7 + c.y * 1.3) * 0.2;
      const threshold = anim.dissolve * 1.4;
      if (edgeDist + noise > (1 - threshold)) {
        c.a = 0;
      } else {
        c.a *= 1 - anim.dissolve * 0.5;
      }
    }
  }

  // Gaze glow: extra green atmospheric glow during petrifying gaze
  if (anim.glowIntensity > 0) {
    const glowCX = centerX + renderW * 0.15; // eyes are in the front
    const glowCY = centerY + renderH * 0.3;
    const glowR = Math.max(renderW, renderH) * 0.5;
    const grad = ctx.createRadialGradient(glowCX, glowCY, 0, glowCX, glowCY, glowR);
    const gi = anim.glowIntensity;
    grad.addColorStop(0, `rgba(40,255,40,${0.25 * gi})`);
    grad.addColorStop(0.3, `rgba(30,200,30,${0.12 * gi})`);
    grad.addColorStop(0.7, `rgba(20,120,20,${0.04 * gi})`);
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = grad;
    ctx.fillRect(x, y, width, height);
    ctx.restore();
  }

  // -----------------------------------------------------------------------
  // v8: Background color fill — dim ambient rect behind every visible cell
  // Creates continuous color field, fills gaps between character strokes
  // -----------------------------------------------------------------------

  if (enableBgFill) {
    for (let i = 0; i < cellCount; i++) {
      const c = cellBuffer[i];
      const bgR = Math.floor(c.r * BG_FILL_BRIGHTNESS);
      const bgG = Math.floor(c.g * BG_FILL_BRIGHTNESS);
      const bgB = Math.floor(c.b * BG_FILL_BRIGHTNESS);
      ctx.fillStyle = `rgba(${bgR},${bgG},${bgB},${c.a * BG_FILL_ALPHA})`;
      ctx.fillRect(
        c.x - c.cellW * 0.5,
        c.y - c.cellH * 0.5,
        c.cellW,
        c.cellH,
      );
    }
  }

  // -----------------------------------------------------------------------
  // Render: shadow extrusion layers
  // -----------------------------------------------------------------------

  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';

  if (enable3D) {
    for (let layer = DEPTH_LAYERS; layer >= 1; layer--) {
      const ox = layer * DEPTH_OFFSET;
      const oy = layer * DEPTH_OFFSET;
      const darken = 0.15 + (DEPTH_LAYERS - layer) * 0.05;
      const layerAlpha = (0.25 - layer * 0.05);

      for (let i = 0; i < cellCount; i++) {
        const c = cellBuffer[i];
        const dr = Math.floor(c.r * darken);
        const dg = Math.floor(c.g * darken);
        const db = Math.floor(c.b * darken);
        const da = c.a * layerAlpha;

        if (c.isInterior) {
          // Half-block depth shadow: 2 dim rects
          ctx.fillStyle = `rgba(${dr},${dg},${db},${da})`;
          ctx.fillRect(
            c.x - c.cellW * 0.5 + ox,
            c.y - c.cellH * 0.5 + oy,
            c.cellW,
            c.cellH,
          );
        } else {
          // Character depth shadow
          ctx.font = `${c.weight} ${c.fontSize}px ${FONTS.serif}`;
          ctx.fillStyle = `rgba(${dr},${dg},${db},${da})`;
          ctx.fillText(c.char, c.x + ox, c.y + oy);
        }
      }
    }
  }

  // -----------------------------------------------------------------------
  // Render: main layer
  // -----------------------------------------------------------------------

  if (template.isBoss) {
    ctx.shadowColor = 'rgba(200, 60, 40, 0.6)';
    ctx.shadowBlur = 8 + Math.sin(elapsed * 0.003) * 4;
  }

  for (let i = 0; i < cellCount; i++) {
    const c = cellBuffer[i];

    if (c.isInterior) {
      // v8: Half-block rendering — 2 colored rectangles per cell
      // Top half
      ctx.fillStyle = `rgba(${c.topR},${c.topG},${c.topB},${c.a})`;
      ctx.fillRect(
        c.x - c.cellW * 0.5,
        c.y - c.cellH * 0.5,
        c.cellW,
        c.cellH * 0.5,
      );
      // Bottom half
      ctx.fillStyle = `rgba(${c.botR},${c.botG},${c.botB},${c.a})`;
      ctx.fillRect(
        c.x - c.cellW * 0.5,
        c.y,
        c.cellW,
        c.cellH * 0.5,
      );
    } else {
      // Character rendering (edge cells)
      ctx.font = `${c.weight} ${c.fontSize}px ${FONTS.serif}`;
      ctx.fillStyle = `rgba(${c.r},${c.g},${c.b},${c.a})`;
      ctx.fillText(c.char, c.x, c.y);
    }
  }

  if (template.isBoss) {
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
  }

  // -----------------------------------------------------------------------
  // v8: Glow pass — re-render bright accent cells with canvas shadowBlur
  // Creates light bleed on eyes, teeth, magical effects
  // -----------------------------------------------------------------------

  if (enableGlow) {
    ctx.save();
    for (let i = 0; i < cellCount; i++) {
      const c = cellBuffer[i];
      // Compute cell brightness
      const cellLum = (0.299 * c.r + 0.587 * c.g + 0.114 * c.b) / 255;
      if (cellLum < GLOW_LUM_THRESHOLD) continue;

      // Glow intensity scales with brightness above threshold
      const glowT = (cellLum - GLOW_LUM_THRESHOLD) / (1 - GLOW_LUM_THRESHOLD);
      const blur = GLOW_BLUR_BASE + glowT * (GLOW_BLUR_MAX - GLOW_BLUR_BASE);

      ctx.shadowColor = `rgba(${c.r},${c.g},${c.b},${0.5 + glowT * 0.3})`;
      ctx.shadowBlur = blur;

      if (c.isInterior) {
        // Glow on half-block: draw a small bright rect
        const glowR = Math.min(255, c.r + 30);
        const glowG = Math.min(255, c.g + 30);
        const glowB = Math.min(255, c.b + 30);
        ctx.fillStyle = `rgba(${glowR},${glowG},${glowB},${c.a * 0.6})`;
        ctx.fillRect(
          c.x - c.cellW * 0.3,
          c.y - c.cellH * 0.3,
          c.cellW * 0.6,
          c.cellH * 0.6,
        );
      } else {
        // Glow on character: re-draw with shadow
        ctx.font = `${c.weight} ${c.fontSize}px ${FONTS.serif}`;
        ctx.fillStyle = `rgba(${c.r},${c.g},${c.b},${c.a * 0.7})`;
        ctx.fillText(c.char, c.x, c.y);
      }
    }
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.restore();
  }
}

/** Clear all caches */
export function clearCache(): void {
  templateCache.clear();
  dynamicCanvasCache.clear();
}
