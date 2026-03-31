/**
 * Monster ASCII Renderer
 *
 * Adapts the BossAsciiSplash brightness-to-character algorithm for arbitrary
 * monster silhouette templates. Renders a MonsterTemplate to any canvas context
 * at any size, with level-based weight and class-based color.
 *
 * Usage:
 *   import { renderMonster } from './MonsterAsciiRenderer';
 *   import { getTemplate } from './monsterTemplates';
 *
 *   // Inside onFrame callback:
 *   const template = getTemplate('dire_rat')!;
 *   renderMonster(ctx, template, 0, 0, width, height, { elapsed });
 */

import { FONTS } from '../theme';
import type { MonsterTemplate } from './monsterTemplates';

// Character palette sorted by visual density (space = empty → N = very dense)
const CHAR_PALETTE = " .`'-,:;!~+*=?#%@MWBN";

// ---------------------------------------------------------------------------
// Module state (initialized lazily)
// ---------------------------------------------------------------------------

let charBrightness: number[] | null = null;
const silhouetteCache = new Map<string, ImageData>();

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
// Color palette by monster class
// ---------------------------------------------------------------------------

const CLASS_COLORS: Record<number, { r: number; g: number; b: number }> = {
  0: { r: 200, g: 150, b: 60 }, // Warrior — warm amber
  1: { r: 130, g: 165, b: 200 }, // Rogue — cool blue-gray
  2: { r: 160, g: 100, b: 180 }, // Mage — purple/violet
};

const BOSS_COLOR = { r: 200, g: 60, b: 40 }; // Deep red

// ---------------------------------------------------------------------------
// Weight mapping — higher-level monsters use heavier font weights
// ---------------------------------------------------------------------------

function getWeight(level: number, isBoss: boolean, brightness: number): number {
  // Available weights: 400, 600, 700 (loaded in usePretextFonts)
  if (isBoss || level >= 10) {
    return brightness < 0.3 ? 600 : 700;
  }
  if (level >= 7) {
    return brightness < 0.25 ? 400 : brightness < 0.55 ? 600 : 700;
  }
  if (level >= 4) {
    return brightness < 0.3 ? 400 : 600;
  }
  // Level 1-3: lighter overall
  return brightness < 0.4 ? 400 : brightness < 0.7 ? 400 : 600;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export type RenderOptions = {
  /** Global alpha (0-1). Default: 1 */
  alpha?: number;
  /** Elapsed time in ms — used for boss pulse animation */
  elapsed?: number;
};

/**
 * Render a monster's ASCII silhouette to a canvas context.
 *
 * The monster is centered within the (x, y, width, height) region and
 * scaled to fit while maintaining its template aspect ratio.
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
  const { alpha = 1, elapsed = 0 } = options;

  if (width < 20 || height < 20) return;

  // -----------------------------------------------------------------------
  // Grid sizing
  // -----------------------------------------------------------------------

  // Target cell width: scale to fill the space, clamped for readability
  const cellAspect = 1.4; // Character cells are taller than wide

  // Calculate cell size to fit the template grid in the available area
  const fitByWidth = width / template.gridWidth;
  const fitByHeight = height / (template.gridHeight * cellAspect);
  let cellW = Math.min(fitByWidth, fitByHeight);
  cellW = Math.max(5, Math.min(20, cellW));

  const cellH = cellW * cellAspect;
  const cols = template.gridWidth;
  const rows = template.gridHeight;
  const renderW = cols * cellW;
  const renderH = rows * cellH;
  const offsetX = x + (width - renderW) / 2;
  const offsetY = y + (height - renderH) / 2;

  // -----------------------------------------------------------------------
  // Silhouette (cached per template + grid resolution)
  // -----------------------------------------------------------------------

  const cacheKey = `${template.id}-${cols}-${rows}`;
  let imgData = silhouetteCache.get(cacheKey);
  if (!imgData) {
    const c = document.createElement('canvas');
    c.width = cols;
    c.height = rows;
    const octx = c.getContext('2d')!;
    // Black background
    octx.fillStyle = '#000';
    octx.fillRect(0, 0, cols, rows);
    // Draw silhouette
    template.draw(octx, cols, rows);
    imgData = octx.getImageData(0, 0, cols, rows);
    silhouetteCache.set(cacheKey, imgData);
  }

  // -----------------------------------------------------------------------
  // Color and glow
  // -----------------------------------------------------------------------

  const baseColor = template.isBoss
    ? BOSS_COLOR
    : (CLASS_COLORS[template.monsterClass] ?? CLASS_COLORS[0]);

  // Boss glow: pulsing shadow
  if (template.isBoss) {
    ctx.shadowColor = `rgba(${baseColor.r}, ${baseColor.g}, ${baseColor.b}, 0.6)`;
    ctx.shadowBlur = 8 + Math.sin(elapsed * 0.003) * 4;
  }

  // -----------------------------------------------------------------------
  // Render character grid
  // -----------------------------------------------------------------------

  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';

  const fontSize = cellW * 1.15;
  const brightness = charBrightness!;

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const px = (row * cols + col) * 4;
      // Red channel = brightness (template draws white-on-black)
      const b = imgData.data[px] / 255;
      if (b < 0.03) continue;

      // Find closest character by brightness
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

      // Font weight based on level + brightness
      const weight = getWeight(template.level, !!template.isBoss, b);
      ctx.font = `${weight} ${fontSize}px ${FONTS.serif}`;

      // Color: base color modulated by brightness
      const r = Math.floor(baseColor.r * b);
      const g = Math.floor(baseColor.g * b);
      const bChan = Math.floor(baseColor.b * b);
      ctx.fillStyle = `rgba(${r}, ${g}, ${bChan}, ${alpha * (0.3 + b * 0.7)})`;

      ctx.fillText(
        char,
        offsetX + col * cellW + cellW / 2,
        offsetY + row * cellH + cellH / 2,
      );
    }
  }

  // Reset shadow
  if (template.isBoss) {
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
  }
}

/**
 * Render at higher resolution by scaling the grid up from the template's
 * natural dimensions. Useful for boss splash / large views.
 */
export function renderMonsterHiRes(
  ctx: CanvasRenderingContext2D,
  template: MonsterTemplate,
  x: number,
  y: number,
  width: number,
  height: number,
  options: RenderOptions = {},
): void {
  ensureInit();
  const { alpha = 1, elapsed = 0 } = options;

  if (width < 40 || height < 40) return;

  const cellAspect = 1.4;
  // Target ~10px per cell for hi-res
  const targetCellW = Math.max(8, Math.min(12, Math.min(width, height) / 30));
  const cellH = targetCellW * cellAspect;

  // Calculate grid to fill space while maintaining template aspect ratio
  const templateAspect = template.gridWidth / template.gridHeight;
  const maxCols = Math.floor(width / targetCellW);
  const maxRows = Math.floor(height / cellH);

  let cols: number, rows: number;
  if (maxCols / maxRows < templateAspect) {
    cols = maxCols;
    rows = Math.round(cols / templateAspect);
  } else {
    rows = maxRows;
    cols = Math.round(rows * templateAspect);
  }

  cols = Math.max(template.gridWidth, cols);
  rows = Math.max(template.gridHeight, rows);

  const cellW = Math.min(width / cols, height / (rows * cellAspect));
  const actualCellH = cellW * cellAspect;
  const renderW = cols * cellW;
  const renderH = rows * actualCellH;
  const offsetX = x + (width - renderW) / 2;
  const offsetY = y + (height - renderH) / 2;

  // Render silhouette at this resolution
  const cacheKey = `${template.id}-${cols}-${rows}`;
  let imgData = silhouetteCache.get(cacheKey);
  if (!imgData) {
    const c = document.createElement('canvas');
    c.width = cols;
    c.height = rows;
    const octx = c.getContext('2d')!;
    octx.fillStyle = '#000';
    octx.fillRect(0, 0, cols, rows);
    template.draw(octx, cols, rows);
    imgData = octx.getImageData(0, 0, cols, rows);
    silhouetteCache.set(cacheKey, imgData);
  }

  const baseColor = template.isBoss
    ? BOSS_COLOR
    : (CLASS_COLORS[template.monsterClass] ?? CLASS_COLORS[0]);

  if (template.isBoss) {
    ctx.shadowColor = `rgba(${baseColor.r}, ${baseColor.g}, ${baseColor.b}, 0.6)`;
    ctx.shadowBlur = 10 + Math.sin(elapsed * 0.003) * 5;
  }

  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';
  const fontSize = cellW * 1.15;
  const brightness = charBrightness!;

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const px = (row * cols + col) * 4;
      const b = imgData.data[px] / 255;
      if (b < 0.03) continue;

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
        offsetX + col * cellW + cellW / 2,
        offsetY + row * actualCellH + actualCellH / 2,
      );
    }
  }

  if (template.isBoss) {
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
  }
}

/** Clear the silhouette cache (e.g. on hot reload or window resize) */
export function clearCache(): void {
  silhouetteCache.clear();
}
