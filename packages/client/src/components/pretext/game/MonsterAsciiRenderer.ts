/**
 * Monster ASCII Renderer v4 — Full Color
 *
 * Each monster template draws in its OWN colors (D&D Monster Manual style).
 * The renderer samples RGB directly from the template and uses luminance
 * for character density selection. No more flat class-based color overlay.
 *
 * Core techniques:
 * - Full-color templates: each monster has its own palette
 * - Template canvas at 512px for fine detail
 * - RGB sampling with luminance-based character selection
 * - Multi-pass depth extrusion (3 shadow layers)
 * - Normal-mapped directional lighting modulates template colors
 * - Perspective foreshortening (bottom wider = "looking up")
 * - Idle animation: bob, sway, breathing, organic wave
 * - Ground shadow, boss brightness wave
 */

import { FONTS } from '../theme';
import type { MonsterTemplate } from './monsterTemplates';

// Dense character palette sorted by visual density.
const CHAR_PALETTE = " .`',:-~^;*+!=?#@";

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

function ensureBuffer(size: number) {
  while (cellBuffer.length < size) {
    cellBuffer.push({ char: '', x: 0, y: 0, r: 0, g: 0, b: 0, a: 0, weight: 400, fontSize: 4 });
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

  cached = { data, w, h, normals: null, normalCols: 0, normalRows: 0 };
  templateCache.set(template.id, cached);
  return cached;
}

// ---------------------------------------------------------------------------
// Full-color sampling
// ---------------------------------------------------------------------------

type ColorSample = { r: number; g: number; b: number; lum: number };

/** Area-averaged color sampling — returns RGB and perceptual luminance */
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
  // Ground shadow (use average color from template center)
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

  ensureBuffer(cols * rows);
  cellCount = 0;

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
        lightMul = 0.4 + Math.max(0, dot) * 0.6;

        // Specular highlight
        if (color.lum > 0.3) {
          const hx = lx;
          const hy = ly;
          const hz = lz + 1;
          const hLen = Math.sqrt(hx * hx + hy * hy + hz * hz) || 1;
          const spec = Math.max(0, (nx / nLen) * (hx / hLen) + (ny / nLen) * (hy / hLen) + (nz / nLen) * (hz / hLen));
          lightMul += Math.pow(spec, 8) * 0.25;
        }
      }

      // Boss wave
      if (bossWaveFront >= 0) {
        const colT = col / cols;
        const distFromWave = Math.abs(colT - bossWaveFront);
        lightMul += Math.max(0, 1 - distFromWave * 4) * 0.3;
      }

      lightMul = Math.min(1.4, Math.max(0, lightMul));

      // Character selection based on luminance (lit)
      const litLum = Math.min(1, color.lum * lightMul);
      let bestIdx = 0;
      let bestDiff = 1;
      for (let i = 0; i < brightness.length; i++) {
        const diff = Math.abs(brightness[i] - litLum);
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

      // Use template's own color, modulated by lighting
      const r = Math.min(255, Math.floor(color.r * 255 * lightMul));
      const g = Math.min(255, Math.floor(color.g * 255 * lightMul));
      const bChan = Math.min(255, Math.floor(color.b * 255 * lightMul));
      const a = alpha * (0.25 + litLum * 0.75);

      const cell = cellBuffer[cellCount++];
      cell.char = char;
      cell.x = cellX;
      cell.y = cellY;
      cell.r = r;
      cell.g = g;
      cell.b = bChan;
      cell.a = a;
      cell.weight = weight;
      cell.fontSize = drawFontSize;
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
    // Boss glow uses the monster's own dominant color
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
