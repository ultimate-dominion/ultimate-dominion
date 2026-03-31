/**
 * Monster ASCII Renderer
 *
 * Renders monster silhouettes as dense, tightly-packed ASCII art using small
 * punctuation characters. Templates are drawn at high resolution (256px) and
 * sampled onto a dense character grid (5-6px cells).
 *
 * Key differences from v1:
 * - Template canvas at 256px, not grid resolution (12px was way too coarse)
 * - Area-averaged brightness sampling (smooth gradients)
 * - Compact character palette (punctuation, not letters)
 * - Small cells packed tight so the SHAPE dominates, not individual chars
 */

import { FONTS } from '../theme';
import type { MonsterTemplate } from './monsterTemplates';

// Compact characters sorted by visual density — no wide letters.
// These pack tightly at small sizes so the silhouette reads clearly.
const CHAR_PALETTE = " .`',:-~^;*+!=?#@";

// ---------------------------------------------------------------------------
// Module state
// ---------------------------------------------------------------------------

let charBrightness: number[] | null = null;
const templateCache = new Map<string, { data: ImageData; w: number; h: number }>();

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

const TEMPLATE_RES = 256;

function getTemplateImage(template: MonsterTemplate) {
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

  cached = { data, w, h };
  templateCache.set(template.id, cached);
  return cached;
}

/** Area-averaged brightness sampling — smooth and alias-free */
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
  /** Target cell width in px. Smaller = denser. Default: 6 */
  cellSize?: number;
};

/**
 * Render a monster as dense ASCII art.
 *
 * The monster fills the (x, y, width, height) region, centered and
 * scaled to maintain its template aspect ratio. Characters are packed
 * tightly at `cellSize` pixels — default 6px gives ~50 columns in a
 * 300px-wide panel.
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
  const { alpha = 1, elapsed = 0, cellSize = 6 } = options;

  if (width < 20 || height < 20) return;

  // -----------------------------------------------------------------------
  // Get high-res template
  // -----------------------------------------------------------------------

  const tpl = getTemplateImage(template);

  // -----------------------------------------------------------------------
  // Grid sizing — fill space with small, tightly-packed cells
  // -----------------------------------------------------------------------

  const cellW = Math.max(3, cellSize);
  const cellH = cellW * 1.3; // Slightly less tall for tighter packing

  // How many cells fit?
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

  // Fit cells exactly
  const actualCellW = Math.min(width / cols, height / (rows * 1.3));
  const actualCellH = actualCellW * 1.3;
  const renderW = cols * actualCellW;
  const renderH = rows * actualCellH;
  const offsetX = x + (width - renderW) / 2;
  const offsetY = y + (height - renderH) / 2;

  // -----------------------------------------------------------------------
  // Color + glow
  // -----------------------------------------------------------------------

  const baseColor = template.isBoss
    ? BOSS_COLOR
    : (CLASS_COLORS[template.monsterClass] ?? CLASS_COLORS[0]);

  if (template.isBoss) {
    ctx.shadowColor = `rgba(${baseColor.r}, ${baseColor.g}, ${baseColor.b}, 0.6)`;
    ctx.shadowBlur = 8 + Math.sin(elapsed * 0.003) * 4;
  }

  // -----------------------------------------------------------------------
  // Render dense character grid
  // -----------------------------------------------------------------------

  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';

  const fontSize = actualCellW * 1.2;
  const brightness = charBrightness!;

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      // Area-averaged brightness from high-res template
      const b = sampleBrightness(
        tpl.data.data, tpl.w, tpl.h,
        col, row, cols, rows,
      );
      if (b < 0.02) continue;

      // Find closest character by visual density
      let bestIdx = 0;
      let bestDiff = 1;
      for (let i = 0; i < brightness.length; i++) {
        const diff = Math.abs(brightness[i] - b);
        if (diff < bestDiff) {
          bestDiff = diff;
          bestIdx = i;
        }
      }

      const char = CHAR_PALETTE[bestIdx];
      if (char === ' ') continue;

      const weight = getWeight(template.level, !!template.isBoss, b);
      ctx.font = `${weight} ${fontSize}px ${FONTS.serif}`;

      const r = Math.floor(baseColor.r * b);
      const g = Math.floor(baseColor.g * b);
      const bChan = Math.floor(baseColor.b * b);
      ctx.fillStyle = `rgba(${r}, ${g}, ${bChan}, ${alpha * (0.3 + b * 0.7)})`;

      ctx.fillText(
        char,
        offsetX + col * actualCellW + actualCellW / 2,
        offsetY + row * actualCellH + actualCellH / 2,
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
