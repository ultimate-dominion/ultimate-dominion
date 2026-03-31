/**
 * Monster ASCII Renderer v7 — Brightness + Surface Texture
 *
 * Rendering pipeline (D&D Monster Manual style):
 * Template stage (512px, cached):
 *   1. Draw template silhouette with colors
 *   2. Global brightness boost (1.8x) — paint bright, display moody
 *   3. Procedural noise texture — surface detail (scales, fur, stone grain)
 *   4. Auto-contour — edge detection brightens silhouette boundary
 *
 * Render stage (per frame):
 *   5. Area-averaged color sampling with full RGB
 *   6. Normal-mapped directional lighting (high ambient 0.70)
 *   7. Aggressive gamma lift (0.50) for dark-bg visibility
 *   8. Edge-directed characters — Sobel picks /\|- at edges
 *   9. Rim lighting — 150% boost at silhouette boundary
 *   10. Multi-pass depth extrusion for 3D volume
 *   11. Perspective foreshortening + idle animation
 */

import { FONTS } from '../theme';
import type { MonsterTemplate } from './monsterTemplates';

// Dense character palette sorted by visual density.
const CHAR_PALETTE = " .`',:-~^;*+!=?#@";

// Edge-directed characters indexed by quantized angle (0-7, 45° steps).
// Angle is the direction of the EDGE (perpendicular to gradient direction).
// 0=right, 1=upper-right, 2=up, 3=upper-left, etc.
const EDGE_CHARS = ['-', '/', '|', '\\', '-', '/', '|', '\\'];
// Minimum gradient magnitude (normalized 0-1) to trigger edge character
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
};

let cellBuffer: CellData[] = [];
let cellCount = 0;
// Grid mapping (row, col) → cellBuffer index. -1 = empty cell.
let gridIndex: Int32Array = new Int32Array(0);
// Per-cell sampled luminance (0-1) for Sobel edge detection in post-pass.
let lumGrid: Float32Array = new Float32Array(0);

function ensureBuffer(size: number) {
  while (cellBuffer.length < size) {
    cellBuffer.push({ char: '', x: 0, y: 0, r: 0, g: 0, b: 0, a: 0, weight: 400, fontSize: 4 });
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

function getTemplateImage(template: MonsterTemplate): TemplateData {
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

  // Template post-processing pipeline (order matters):
  // 1. Brightness boost — lift everything so renderer has headroom
  applyBrightnessBoost(data.data, w, h);
  // 2. Noise texture — break up smooth gradients with surface detail
  applyNoiseTexture(data.data, w, h);
  // 3. Auto-contour — brighten silhouette edges (runs AFTER noise so edges are crisp)
  applyContourBrightening(data.data, w, h);

  cached = { data, w, h, normals: null, normalCols: 0, normalRows: 0 };
  templateCache.set(template.id, cached);
  return cached;
}

// ---------------------------------------------------------------------------
// Template post-processing constants
// ---------------------------------------------------------------------------

/** Threshold for "black" pixel detection (luminance below this = background) */
const CONTOUR_BLACK_THRESHOLD = 8;
/** How much to brighten contour pixels (multiplier) */
const CONTOUR_BOOST = 2.2;
/** Global brightness multiplier for all non-black template pixels.
 *  Templates should paint at moderate brightness; this lifts everything
 *  so the renderer's lighting/gamma has more headroom. */
const TEMPLATE_BRIGHTNESS_BOOST = 1.8;

// ---------------------------------------------------------------------------
// Procedural noise — fast hash-based value noise for surface texture
// ---------------------------------------------------------------------------

/** Integer hash → pseudo-random float in [-1, 1] */
function hash2d(x: number, y: number): number {
  let n = x * 374761393 + y * 668265263;
  n = ((n ^ (n >> 13)) * 1274126177) | 0;
  return ((n ^ (n >> 16)) & 0x7fffffff) / 0x7fffffff * 2 - 1;
}

/** Smoothstep interpolation */
function smoothstep(t: number): number {
  return t * t * (3 - 2 * t);
}

/** 2D value noise, returns [-1, 1] */
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

/** Two-octave fractal noise for surface texture, returns [-1, 1] */
function surfaceNoise(x: number, y: number): number {
  // Octave 1: broad variation (muscle groups, large scales)
  const n1 = valueNoise(x * 0.15, y * 0.15) * 0.6;
  // Octave 2: fine detail (individual scales, fur strands, stone grain)
  const n2 = valueNoise(x * 0.6, y * 0.6) * 0.4;
  return n1 + n2;
}

// ---------------------------------------------------------------------------
// Template post-processing pipeline
// ---------------------------------------------------------------------------

/** Step 1: Global brightness boost — multiply all non-black pixels */
function applyBrightnessBoost(pixels: Uint8ClampedArray, w: number, h: number): void {
  for (let i = 0; i < w * h; i++) {
    const idx = i * 4;
    const lum = 0.299 * pixels[idx] + 0.587 * pixels[idx + 1] + 0.114 * pixels[idx + 2];
    if (lum < CONTOUR_BLACK_THRESHOLD) continue;
    pixels[idx]     = Math.min(255, Math.floor(pixels[idx] * TEMPLATE_BRIGHTNESS_BOOST));
    pixels[idx + 1] = Math.min(255, Math.floor(pixels[idx + 1] * TEMPLATE_BRIGHTNESS_BOOST));
    pixels[idx + 2] = Math.min(255, Math.floor(pixels[idx + 2] * TEMPLATE_BRIGHTNESS_BOOST));
  }
}

/** Step 2: Procedural noise overlay — adds surface texture variation */
function applyNoiseTexture(pixels: Uint8ClampedArray, w: number, h: number): void {
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4;
      const lum = 0.299 * pixels[idx] + 0.587 * pixels[idx + 1] + 0.114 * pixels[idx + 2];
      if (lum < CONTOUR_BLACK_THRESHOLD) continue;

      // Noise amplitude scales with brightness — brighter areas get more texture
      const noise = surfaceNoise(x, y);
      const amplitude = 0.15 + (lum / 255) * 0.10; // 15-25% modulation
      const mod = 1 + noise * amplitude;

      pixels[idx]     = Math.min(255, Math.max(0, Math.floor(pixels[idx] * mod)));
      pixels[idx + 1] = Math.min(255, Math.max(0, Math.floor(pixels[idx + 1] * mod)));
      pixels[idx + 2] = Math.min(255, Math.max(0, Math.floor(pixels[idx + 2] * mod)));
    }
  }
}

/** Step 3: Auto-contour — brighten silhouette edges */
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
  // Perceptual luminance (ITU-R BT.601)
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

// Gamma exponent for dark-background visibility lift (< 1 brightens darks)
// 0.50 is aggressive — lifts dark midtones significantly while preserving highlights
const GAMMA = 0.50;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export type RenderOptions = {
  alpha?: number;
  elapsed?: number;
  /** Target cell width in px. Smaller = denser. Default: 4. Min: 3 */
  cellSize?: number;
  /** Enable 3D perspective + lighting + animation. Default: true */
  enable3D?: boolean;
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
  const { alpha = 1, elapsed = 0, cellSize = 4, enable3D = true } = options;

  if (width < 20 || height < 20) return;

  const tpl = getTemplateImage(template);

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
  const breathScale = enable3D ? 1 + Math.sin(elapsed * 0.0025) * 0.012 : 1;
  const perspectiveAmount = enable3D ? 0.12 : 0;

  // Animated light direction
  const lightAngle = elapsed * 0.0008;
  const lightX = Math.cos(lightAngle) * 0.6;
  const lightY = -0.3 + Math.sin(lightAngle * 0.7) * 0.2;
  const lightZ = 0.7;
  const lightLen = Math.sqrt(lightX * lightX + lightY * lightY + lightZ * lightZ);
  const lx = lightX / lightLen;
  const ly = lightY / lightLen;
  const lz = lightZ / lightLen;

  const centerX = x + (width - renderW) / 2 + swayX;
  const centerY = y + (height - renderH) / 2 + bobY;

  let normals: Float32Array | null = null;
  if (enable3D) {
    normals = computeNormals(tpl, cols, rows);
  }

  // Boss wave
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
    const glowR = Math.max(renderW, renderH) * 0.65;
    const grad = ctx.createRadialGradient(glowCX, glowCY, 0, glowCX, glowCY, glowR);
    grad.addColorStop(0, `rgba(${atm.r},${atm.g},${atm.b},${atm.intensity})`);
    grad.addColorStop(0.35, `rgba(${atm.r},${atm.g},${atm.b},${atm.intensity * 0.5})`);
    grad.addColorStop(0.7, `rgba(${atm.r},${atm.g},${atm.b},${atm.intensity * 0.15})`);
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
      // Sample full color from template
      const color = sampleColor(tpl.data.data, tpl.w, tpl.h, col, row, cols, rows);
      if (color.lum < 0.02) continue;

      // Lighting modulates the template's own color
      let lightMul = 1.0;
      if (normals) {
        const nIdx = (row * cols + col) * 2;
        const nx = normals[nIdx];
        const ny = normals[nIdx + 1];
        const nz = 0.5;
        const nLen = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;

        const dot = (nx / nLen) * lx + (ny / nLen) * ly + (nz / nLen) * lz;
        // High ambient (0.70) — nothing disappears into shadow
        lightMul = 0.70 + Math.max(0, dot) * 0.30;

        // Strong specular highlights for surface sheen
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

      // Character selection based on luminance (lit)
      const litLum = Math.min(1, color.lum * lightMul);
      // Floor character density — dim pixels still get visible characters
      // Without this, dim areas map to '.' or ',' which are invisible on black bg
      const charLum = Math.max(0.30, litLum);
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

      // Apply gamma lift — pulls darks up for visibility on dark background
      // pow(x, 0.72) where x in [0..1] brightens dark values more than bright ones
      const litR = color.r * lightMul;
      const litG = color.g * lightMul;
      const litB = color.b * lightMul;
      const r = Math.min(255, Math.floor(Math.pow(Math.min(1, litR), GAMMA) * 255));
      const g = Math.min(255, Math.floor(Math.pow(Math.min(1, litG), GAMMA) * 255));
      const bChan = Math.min(255, Math.floor(Math.pow(Math.min(1, litB), GAMMA) * 255));
      // High min alpha (0.75) — even dark areas must be visible against black bg
      const a = alpha * (0.75 + litLum * 0.25);

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

      // Track in grid for edge detection + Sobel
      gridIndex[row * cols + col] = cellIdx;
      lumGrid[row * cols + col] = color.lum;
    }
  }

  // -----------------------------------------------------------------------
  // Rim lighting + edge-directed characters
  //
  // Two passes combined for efficiency:
  // 1. Rim lighting — edge cells get brightness boost (backlit silhouette)
  // 2. Edge-directed chars — Sobel gradient at edges picks /\|- for sharp outlines
  // -----------------------------------------------------------------------

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const idx = gridIndex[row * cols + col];
      if (idx < 0) continue;

      // Check 8-connected neighbors for empty cells
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

      if (emptyNeighbors > 0) {
        const cell = cellBuffer[idx];
        // Strong rim boost — up to 150% brightness at exposed edges
        const rimStrength = Math.min(1, emptyNeighbors / 3);
        const boost = 1 + rimStrength * 1.5;
        cell.r = Math.min(255, Math.floor(cell.r * boost));
        cell.g = Math.min(255, Math.floor(cell.g * boost));
        cell.b = Math.min(255, Math.floor(cell.b * boost));
        cell.a = Math.min(1, cell.a + rimStrength * 0.35);

        // Edge-directed character selection via Sobel gradient
        // Compute Gx and Gy from the lumGrid
        const gIdx = row * cols + col;
        const lumL = col > 0 ? lumGrid[gIdx - 1] : 0;
        const lumR = col < cols - 1 ? lumGrid[gIdx + 1] : 0;
        const lumU = row > 0 ? lumGrid[gIdx - cols] : 0;
        const lumD = row < rows - 1 ? lumGrid[gIdx + cols] : 0;
        // Sobel-like gradient (simplified 3x3 → central differences)
        const gx = lumR - lumL;
        const gy = lumD - lumU;
        const gradMag = Math.sqrt(gx * gx + gy * gy);

        if (gradMag > EDGE_GRADIENT_THRESHOLD) {
          // Gradient angle → edge direction (perpendicular, rotated 90°)
          // atan2(gy, gx) gives gradient direction; edge runs perpendicular
          const angle = Math.atan2(gy, gx) + Math.PI / 2;
          // Quantize to 8 directions (45° steps), wrapping negative
          const quantized = ((Math.round(angle / (Math.PI / 4)) % 8) + 8) % 8;
          cell.char = EDGE_CHARS[quantized];
        }
      }
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
        ctx.font = `${c.weight} ${c.fontSize}px ${FONTS.serif}`;
        ctx.fillStyle = `rgba(${Math.floor(c.r * darken)}, ${Math.floor(c.g * darken)}, ${Math.floor(c.b * darken)}, ${c.a * layerAlpha})`;
        ctx.fillText(c.char, c.x + ox, c.y + oy);
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
    ctx.font = `${c.weight} ${c.fontSize}px ${FONTS.serif}`;
    ctx.fillStyle = `rgba(${c.r}, ${c.g}, ${c.b}, ${c.a})`;
    ctx.fillText(c.char, c.x, c.y);
  }

  if (template.isBoss) {
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
  }
}

/** Clear all caches */
export function clearCache(): void {
  templateCache.clear();
}
