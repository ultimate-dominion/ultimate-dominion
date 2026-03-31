/**
 * Monster ASCII Renderer v3
 *
 * Renders monster silhouettes as dense, tightly-packed ASCII art with 3D depth.
 * Uses normal-mapped lighting, perspective projection, ground shadows, and
 * idle animation to make ASCII monsters feel alive and volumetric.
 *
 * Core techniques:
 * - Template canvas at 512px for fine detail
 * - Area-averaged brightness sampling with gradient normals
 * - Perspective foreshortening (bottom wider than top = "looking up")
 * - Animated directional light → per-character illumination via normals
 * - Idle animation: bob, sway, breathing, character-level wave
 * - Ground shadow for spatial grounding
 * - Compact character palette (punctuation, not letters)
 * - 4-5px cells packed tight so the SHAPE dominates
 */

import { FONTS } from '../theme';
import type { MonsterTemplate } from './monsterTemplates';

// Dense character palette sorted by visual density — no wide letters.
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
  // Pre-computed normal map (nx, ny per cell at fixed grid resolution)
  normals: Float32Array | null;
  normalCols: number;
  normalRows: number;
};

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

/** Sample brightness from high-res template at a fractional position */
function sampleAt(
  data: Uint8ClampedArray,
  imgW: number,
  imgH: number,
  fx: number,
  fy: number,
): number {
  const px = Math.min(Math.max(0, Math.floor(fx * imgW)), imgW - 1);
  const py = Math.min(Math.max(0, Math.floor(fy * imgH)), imgH - 1);
  return data[(py * imgW + px) * 4] / 255;
}

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

/** Area-averaged brightness sampling */
function sampleBrightness(
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
      sum += data[(y * imgW + x) * 4]; // red channel
      count++;
    }
  }
  return count > 0 ? sum / (count * 255) : 0;
}

/**
 * Compute per-cell surface normals from brightness gradients.
 * Treats brightness as a heightmap — gradient direction = surface normal.
 */
function computeNormals(
  tpl: TemplateData,
  cols: number,
  rows: number,
): Float32Array {
  // Check if we already have normals at this resolution
  if (tpl.normals && tpl.normalCols === cols && tpl.normalRows === rows) {
    return tpl.normals;
  }

  const normals = new Float32Array(cols * rows * 2); // nx, ny per cell
  const d = tpl.data.data;
  const iw = tpl.w;
  const ih = tpl.h;

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      // Sample brightness at neighboring cells for gradient
      const bL = col > 0
        ? sampleBrightness(d, iw, ih, col - 1, row, cols, rows)
        : 0;
      const bR = col < cols - 1
        ? sampleBrightness(d, iw, ih, col + 1, row, cols, rows)
        : 0;
      const bU = row > 0
        ? sampleBrightness(d, iw, ih, col, row - 1, cols, rows)
        : 0;
      const bD = row < rows - 1
        ? sampleBrightness(d, iw, ih, col, row + 1, cols, rows)
        : 0;

      // Gradient → surface normal (heightmap to normal conversion)
      const nx = bL - bR;
      const ny = bU - bD;
      const idx = (row * cols + col) * 2;
      normals[idx] = nx;
      normals[idx + 1] = ny;
    }
  }

  // Cache
  tpl.normals = normals;
  tpl.normalCols = cols;
  tpl.normalRows = rows;
  return normals;
}

// ---------------------------------------------------------------------------
// Color + weight
// ---------------------------------------------------------------------------

const CLASS_COLORS: Record<number, { r: number; g: number; b: number }> = {
  0: { r: 200, g: 150, b: 60 },  // Warrior — warm amber
  1: { r: 130, g: 165, b: 200 }, // Rogue — cool blue-gray
  2: { r: 160, g: 100, b: 180 }, // Mage — purple/violet
};

const BOSS_COLOR = { r: 200, g: 60, b: 40 };

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

/**
 * Render a monster as dense ASCII art with 3D depth.
 *
 * The monster fills the (x, y, width, height) region, centered and
 * scaled to maintain its template aspect ratio. Features:
 * - Perspective foreshortening (bottom wider, "looking up at" the monster)
 * - Animated directional lighting with heightmap normals
 * - Ground shadow for spatial grounding
 * - Idle animation: bob, sway, breathing, character wave
 */
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

  // -----------------------------------------------------------------------
  // Get high-res template
  // -----------------------------------------------------------------------

  const tpl = getTemplateImage(template);

  // -----------------------------------------------------------------------
  // Grid sizing — dense, tightly-packed cells
  // -----------------------------------------------------------------------

  const cellW = Math.max(3, cellSize);
  const cellH = cellW * 1.25; // Tight vertical packing

  const maxCols = Math.floor(width / cellW);
  const maxRows = Math.floor(height / cellH);

  // Fit to template aspect ratio
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

  // -----------------------------------------------------------------------
  // Compute actual cell dimensions and centering
  // -----------------------------------------------------------------------

  const actualCellW = Math.min(width / cols, height / (rows * 1.25));
  const actualCellH = actualCellW * 1.25;
  const renderW = cols * actualCellW;
  const renderH = rows * actualCellH;

  // -----------------------------------------------------------------------
  // 3D parameters
  // -----------------------------------------------------------------------

  // Idle animation
  const bobY = enable3D ? Math.sin(elapsed * 0.0018) * 3 : 0;
  const swayX = enable3D ? Math.sin(elapsed * 0.0013) * 1.5 : 0;
  const breathScale = enable3D ? 1 + Math.sin(elapsed * 0.0025) * 0.012 : 1;

  // Perspective: bottom is wider than top (looking up at the monster)
  const perspectiveAmount = enable3D ? 0.12 : 0; // 12% narrower at top

  // Animated light direction (orbits slowly)
  const lightAngle = elapsed * 0.0008;
  const lightX = Math.cos(lightAngle) * 0.6;
  const lightY = -0.3 + Math.sin(lightAngle * 0.7) * 0.2;
  const lightZ = 0.7; // always somewhat forward-facing
  const lightLen = Math.sqrt(lightX * lightX + lightY * lightY + lightZ * lightZ);
  const lx = lightX / lightLen;
  const ly = lightY / lightLen;
  const lz = lightZ / lightLen;

  // Center position with bob/sway
  const centerX = x + (width - renderW) / 2 + swayX;
  const centerY = y + (height - renderH) / 2 + bobY;

  // -----------------------------------------------------------------------
  // Compute normals for lighting
  // -----------------------------------------------------------------------

  let normals: Float32Array | null = null;
  if (enable3D) {
    normals = computeNormals(tpl, cols, rows);
  }

  // -----------------------------------------------------------------------
  // Color + glow setup
  // -----------------------------------------------------------------------

  const baseColor = template.isBoss
    ? BOSS_COLOR
    : (CLASS_COLORS[template.monsterClass] ?? CLASS_COLORS[0]);

  // -----------------------------------------------------------------------
  // Ground shadow
  // -----------------------------------------------------------------------

  if (enable3D) {
    ctx.save();
    const shadowH = renderH * 0.12;
    const shadowY = centerY + renderH * breathScale + shadowH * 0.3;
    const shadowW = renderW * 0.7;
    const shadowX = centerX + (renderW - shadowW) / 2;

    ctx.globalAlpha = alpha * 0.15;
    ctx.fillStyle = `rgb(${baseColor.r * 0.3}, ${baseColor.g * 0.3}, ${baseColor.b * 0.3})`;

    // Elliptical shadow using arc
    ctx.beginPath();
    ctx.ellipse(
      shadowX + shadowW / 2,
      shadowY,
      shadowW / 2,
      shadowH / 2,
      0, 0, Math.PI * 2,
    );
    ctx.fill();
    ctx.restore();
  }

  // -----------------------------------------------------------------------
  // Boss glow
  // -----------------------------------------------------------------------

  if (template.isBoss) {
    ctx.shadowColor = `rgba(${baseColor.r}, ${baseColor.g}, ${baseColor.b}, 0.6)`;
    ctx.shadowBlur = 8 + Math.sin(elapsed * 0.003) * 4;
  }

  // -----------------------------------------------------------------------
  // Render dense character grid with 3D effects
  // -----------------------------------------------------------------------

  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';

  const fontSize = actualCellW * 1.2;
  const brightness = charBrightness!;

  for (let row = 0; row < rows; row++) {
    // Perspective foreshortening: row 0 (top) is narrower, row (rows-1) is wider
    const rowT = row / (rows - 1 || 1); // 0 at top, 1 at bottom
    const perspScale = 1 - perspectiveAmount * (1 - rowT);

    // Breathing: scale from bottom center
    const breathOffsetY = (1 - breathScale) * (rows - row) * actualCellH * 0.5;

    // Row width after perspective
    const rowW = renderW * perspScale;
    const rowOffsetX = centerX + (renderW - rowW) / 2;

    const rowCellW = rowW / cols;
    const rowCellH = actualCellH * breathScale;
    const drawY = centerY + row * rowCellH + breathOffsetY;

    for (let col = 0; col < cols; col++) {
      // Area-averaged brightness from high-res template
      const b = sampleBrightness(
        tpl.data.data, tpl.w, tpl.h,
        col, row, cols, rows,
      );
      if (b < 0.02) continue;

      // ---------------------------------------------------------------
      // 3D lighting from normal map
      // ---------------------------------------------------------------

      let litB = b;
      if (normals) {
        const nIdx = (row * cols + col) * 2;
        const nx = normals[nIdx];
        const ny = normals[nIdx + 1];
        const nz = 0.5; // surface faces viewer
        const nLen = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;

        // Dot product with light direction
        const dot = (nx / nLen) * lx + (ny / nLen) * ly + (nz / nLen) * lz;
        // Remap: ambient 0.35 + diffuse 0.65
        const lighting = 0.35 + Math.max(0, dot) * 0.65;
        litB = b * lighting;

        // Specular highlight for bright areas
        if (b > 0.4) {
          // Half-vector for specular
          const hx = lx;
          const hy = ly;
          const hz = lz + 1; // viewer at z=1
          const hLen = Math.sqrt(hx * hx + hy * hy + hz * hz) || 1;
          const spec = Math.max(0, (nx / nLen) * (hx / hLen) + (ny / nLen) * (hy / hLen) + (nz / nLen) * (hz / hLen));
          litB += Math.pow(spec, 8) * 0.3 * b;
        }
      }

      litB = Math.min(1, Math.max(0, litB));

      // ---------------------------------------------------------------
      // Character selection from lit brightness
      // ---------------------------------------------------------------

      let bestIdx = 0;
      let bestDiff = 1;
      for (let i = 0; i < brightness.length; i++) {
        const diff = Math.abs(brightness[i] - litB);
        if (diff < bestDiff) {
          bestDiff = diff;
          bestIdx = i;
        }
      }

      const char = CHAR_PALETTE[bestIdx];
      if (char === ' ') continue;

      // ---------------------------------------------------------------
      // Character-level wave (organic ripple)
      // ---------------------------------------------------------------

      let waveX = 0;
      let waveY = 0;
      if (enable3D) {
        waveX = Math.sin(elapsed * 0.003 + col * 0.4 + row * 0.3) * 0.4;
        waveY = Math.cos(elapsed * 0.0025 + col * 0.3 + row * 0.5) * 0.3;
      }

      // ---------------------------------------------------------------
      // Draw
      // ---------------------------------------------------------------

      const weight = getWeight(template.level, !!template.isBoss, litB);
      const drawFontSize = fontSize * perspScale;
      ctx.font = `${weight} ${drawFontSize}px ${FONTS.serif}`;

      // Color modulated by lighting
      const r = Math.min(255, Math.floor(baseColor.r * litB * 1.1));
      const g = Math.min(255, Math.floor(baseColor.g * litB * 1.1));
      const bChan = Math.min(255, Math.floor(baseColor.b * litB * 1.1));
      ctx.fillStyle = `rgba(${r}, ${g}, ${bChan}, ${alpha * (0.25 + litB * 0.75)})`;

      ctx.fillText(
        char,
        rowOffsetX + col * rowCellW + rowCellW / 2 + waveX,
        drawY + rowCellH / 2 + waveY,
      );
    }
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
