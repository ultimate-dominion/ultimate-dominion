/**
 * Cave Background Renderer — Procedural ASCII cave environment for battle scenes.
 *
 * Generates a sparse ASCII cave background (stalactites, stalagmites, rock walls,
 * scattered debris) onto an offscreen canvas. The result is cached and blitted each
 * frame behind the monster layer, with an optional torchlight flicker pass.
 *
 * Design goals:
 *   - Establish sense of place (Dark Cave) without competing with the creature
 *   - Dim characters (opacity 0.10–0.25) in warm earth tones
 *   - Stalactites from ceiling, stalagmites from floor, rough wall edges
 *   - Subtle animated flicker on ~2% of cells to suggest distant torchlight
 */

import { FONTS } from '../theme';

// ── Character palettes ──────────────────────────────────────────────────

/** Heavy rock / wall characters */
const ROCK_CHARS = ['#', '%', '@', '&', 'X'];
/** Medium density rock texture */
const TEXTURE_CHARS = ['=', '+', '*', '~', '^'];
/** Sparse floor/ceiling scatter */
const SCATTER_CHARS = ['.', ',', "'", '`', ':', ';'];
/** Stalactite/stalagmite tip characters */
const SPIKE_CHARS = ['|', '/', '\\', 'V', 'v', '^', 'A'];

// ── Color palette (warm cave stone) ─────────────────────────────────────

type CaveColor = { r: number; g: number; b: number };

const STONE_COLORS: CaveColor[] = [
  { r: 92, g: 78, b: 58 },   // dark brown stone
  { r: 105, g: 88, b: 65 },  // medium brown
  { r: 80, g: 72, b: 58 },   // cool gray-brown
  { r: 98, g: 85, b: 65 },   // warm gray
  { r: 70, g: 60, b: 48 },   // deep shadow stone
];

const MOSS_COLORS: CaveColor[] = [
  { r: 45, g: 62, b: 38 },   // dark moss
  { r: 52, g: 68, b: 42 },   // damp green
];

// ── Seeded PRNG (deterministic per-scene) ───────────────────────────────

function mulberry32(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── Types ───────────────────────────────────────────────────────────────

export type CaveBgCell = {
  char: string;
  x: number;
  y: number;
  r: number;
  g: number;
  b: number;
  alpha: number;
  flicker: boolean; // true = this cell participates in torchlight animation
};

export type CaveBgCache = {
  canvas: OffscreenCanvas | HTMLCanvasElement;
  cells: CaveBgCell[];
  width: number;
  height: number;
};

// ── Generation ──────────────────────────────────────────────────────────

function pick<T>(arr: T[], rand: () => number): T {
  return arr[Math.floor(rand() * arr.length)];
}

function pickColor(rand: () => number): CaveColor {
  // 80% stone, 20% moss
  return rand() < 0.8 ? pick(STONE_COLORS, rand) : pick(MOSS_COLORS, rand);
}

// ── Structure builders ─────────────────────────────────────────────────

type Formation = {
  col: number;     // column position
  baseWidth: number; // width at the base (ceiling/floor edge)
  tipRow: number;   // how far the tip extends into the cave (row index)
  baseRow: number;  // where it starts (0 for stalactites, rows-1 for stalagmites)
};

/**
 * Build connected stalactite/stalagmite formations.
 * Each formation is a tapered column that narrows to a point.
 */
function buildFormations(
  cols: number,
  rows: number,
  fromTop: boolean,
  count: number,
  rand: () => number,
): Formation[] {
  const formations: Formation[] = [];
  for (let i = 0; i < count; i++) {
    const col = Math.floor(rand() * cols);
    const baseWidth = 1 + Math.floor(rand() * 3); // 1-3 cells wide at base
    const maxExtent = Math.floor(rows * (0.15 + rand() * 0.20)); // 15-35% of height
    const tipRow = fromTop ? maxExtent : rows - 1 - maxExtent;
    const baseRow = fromTop ? 0 : rows - 1;
    formations.push({ col, baseWidth, tipRow, baseRow });
  }
  return formations;
}

/**
 * Check if a cell (row, col) falls inside any formation and return
 * how deep into the formation it is (0 = base/dense, 1 = tip/sparse).
 */
function getFormationDensity(
  row: number,
  col: number,
  formations: Formation[],
  fromTop: boolean,
): number {
  for (const f of formations) {
    const length = Math.abs(f.tipRow - f.baseRow);
    if (length === 0) continue;

    const progress = fromTop
      ? row / length           // 0 at ceiling, 1 at tip
      : (f.baseRow - row) / length; // 0 at floor, 1 at tip

    if (progress < 0 || progress > 1) continue;

    // Width tapers from baseWidth at base to 1 at tip
    const widthAtRow = f.baseWidth * (1 - progress * 0.8);
    const halfW = widthAtRow / 2;
    if (col >= f.col - halfW && col <= f.col + halfW) {
      return progress; // 0 = dense base, 1 = thin tip
    }
  }
  return -1; // not in any formation
}

/**
 * Generate a grid of cave background cells for the given canvas dimensions.
 * Creates connected rock structures: stalactites from ceiling, stalagmites
 * from floor, rough wall masses on sides, and sparse interior debris.
 *
 * @param w - Canvas width in px
 * @param h - Canvas height in px
 * @param cellSize - Target cell size in px (default 8, coarser than creature cells)
 * @param seed - PRNG seed for deterministic generation (default 42)
 */
export function generateCaveCells(
  w: number,
  h: number,
  cellSize = 8,
  seed = 42,
): CaveBgCell[] {
  const rand = mulberry32(seed);
  const cols = Math.ceil(w / cellSize);
  const rows = Math.ceil(h / cellSize);
  const cells: CaveBgCell[] = [];

  // Pre-generate formation structures
  const stalCount = 4 + Math.floor(rand() * 5); // 4-8 stalactites
  const stagCount = 3 + Math.floor(rand() * 4); // 3-6 stalagmites
  const stalactites = buildFormations(cols, rows, true, stalCount, rand);
  const stalagmites = buildFormations(cols, rows, false, stagCount, rand);

  // Wall rock profiles — irregular depth from each side
  const leftWall = new Float32Array(rows);
  const rightWall = new Float32Array(rows);
  for (let r = 0; r < rows; r++) {
    // Layered sine waves create irregular but connected wall shapes
    leftWall[r] = 2 + Math.sin(r * 0.3 + seed) * 1.5
                    + Math.sin(r * 0.7 + seed * 3) * 1.0
                    + Math.sin(r * 0.13 + seed * 7) * 2.0;
    rightWall[r] = 2 + Math.sin(r * 0.25 + seed * 2) * 1.5
                     + Math.sin(r * 0.6 + seed * 5) * 1.0
                     + Math.sin(r * 0.11 + seed * 11) * 2.0;
    leftWall[r] = Math.max(1, leftWall[r]);
    rightWall[r] = Math.max(1, rightWall[r]);
  }

  // Ceiling and floor profiles — irregular rock mass
  const ceiling = new Float32Array(cols);
  const floor = new Float32Array(cols);
  for (let c = 0; c < cols; c++) {
    ceiling[c] = 1.5 + Math.sin(c * 0.2 + seed * 4) * 1.0
                      + Math.sin(c * 0.5 + seed * 6) * 0.8;
    floor[c] = 1.5 + Math.sin(c * 0.22 + seed * 8) * 1.0
                    + Math.sin(c * 0.45 + seed * 10) * 0.8;
    ceiling[c] = Math.max(1, ceiling[c]);
    floor[c] = Math.max(1, floor[c]);
  }

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const x = col * cellSize + cellSize / 2;
      const y = row * cellSize + cellSize / 2;
      const rowT = row / (rows - 1 || 1);

      // ── Check formations ───────────────────────────────────────────

      // Stalactite
      const stalDensity = getFormationDensity(row, col, stalactites, true);
      if (stalDensity >= 0) {
        const color = pickColor(rand);
        const isTip = stalDensity > 0.7;
        const isMid = stalDensity > 0.4;
        const char = isTip ? pick(SPIKE_CHARS, rand)
                   : isMid ? pick(TEXTURE_CHARS, rand)
                   : pick(ROCK_CHARS, rand);
        // Dense at base, thinner at tip. Add noise for natural look.
        const noise = rand() * 0.05;
        const fillProb = 1.0 - stalDensity * 0.5; // 100% fill at base, 50% at tip
        if (rand() < fillProb) {
          cells.push({
            char,
            x, y,
            ...color,
            alpha: 0.18 + (1 - stalDensity) * 0.12 + noise,
            flicker: isTip && rand() < 0.06,
          });
        }
        continue;
      }

      // Stalagmite
      const stagDensity = getFormationDensity(row, col, stalagmites, false);
      if (stagDensity >= 0) {
        const color = pickColor(rand);
        const isTip = stagDensity > 0.7;
        const isMid = stagDensity > 0.4;
        const char = isTip ? pick(SPIKE_CHARS, rand)
                   : isMid ? pick(TEXTURE_CHARS, rand)
                   : pick(ROCK_CHARS, rand);
        const noise = rand() * 0.05;
        const fillProb = 1.0 - stagDensity * 0.5;
        if (rand() < fillProb) {
          cells.push({
            char,
            x, y,
            ...color,
            alpha: 0.18 + (1 - stagDensity) * 0.12 + noise,
            flicker: isTip && rand() < 0.06,
          });
        }
        continue;
      }

      // ── Ceiling rock mass ──────────────────────────────────────────
      if (row < ceiling[col]) {
        const depth = 1 - row / ceiling[col]; // 1 at top, 0 at edge
        const color = pickColor(rand);
        cells.push({
          char: depth > 0.5 ? pick(ROCK_CHARS, rand) : pick(TEXTURE_CHARS, rand),
          x, y,
          ...color,
          alpha: 0.15 + depth * 0.15,
          flicker: rand() < 0.02,
        });
        continue;
      }

      // ── Floor rock mass ────────────────────────────────────────────
      if (row > rows - 1 - floor[col]) {
        const depth = 1 - (rows - 1 - row) / floor[col];
        const color = pickColor(rand);
        cells.push({
          char: depth > 0.5 ? pick(ROCK_CHARS, rand) : pick(TEXTURE_CHARS, rand),
          x, y,
          ...color,
          alpha: 0.15 + depth * 0.15,
          flicker: rand() < 0.02,
        });
        continue;
      }

      // ── Left wall rock mass ────────────────────────────────────────
      if (col < leftWall[row]) {
        const depth = 1 - col / leftWall[row];
        const color = pickColor(rand);
        cells.push({
          char: depth > 0.5 ? pick(ROCK_CHARS, rand) : pick(TEXTURE_CHARS, rand),
          x, y,
          ...color,
          alpha: 0.12 + depth * 0.16,
          flicker: rand() < 0.02,
        });
        continue;
      }

      // ── Right wall rock mass ───────────────────────────────────────
      if (col > cols - 1 - rightWall[row]) {
        const depth = 1 - (cols - 1 - col) / rightWall[row];
        const color = pickColor(rand);
        cells.push({
          char: depth > 0.5 ? pick(ROCK_CHARS, rand) : pick(TEXTURE_CHARS, rand),
          x, y,
          ...color,
          alpha: 0.12 + depth * 0.16,
          flicker: rand() < 0.02,
        });
        continue;
      }

      // ── Scattered interior debris ──────────────────────────────────
      // Very sparse in the center so as not to compete with the creature
      const edgeX = Math.min(col / (cols - 1 || 1), 1 - col / (cols - 1 || 1)) * 2;
      const edgeY = Math.min(rowT, 1 - rowT) * 2;
      const distFromEdge = Math.min(edgeX, edgeY);
      const interiorProb = 0.006 + (1 - distFromEdge) * 0.010;
      if (rand() < interiorProb) {
        const color = pickColor(rand);
        cells.push({
          char: pick(SCATTER_CHARS, rand),
          x, y,
          ...color,
          alpha: 0.06 + rand() * 0.06,
          flicker: rand() < 0.04,
        });
      }
    }
  }

  return cells;
}

// ── Static layer rendering (cached) ─────────────────────────────────────

/**
 * Render cave cells to an offscreen canvas. Called once, result is cached.
 */
export function renderCaveBgStatic(
  cells: CaveBgCell[],
  w: number,
  h: number,
): OffscreenCanvas | HTMLCanvasElement {
  const useOffscreen = typeof OffscreenCanvas !== 'undefined';
  const canvas = useOffscreen
    ? new OffscreenCanvas(w, h)
    : document.createElement('canvas');

  if (!useOffscreen) {
    (canvas as HTMLCanvasElement).width = w;
    (canvas as HTMLCanvasElement).height = h;
  }

  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
  if (!ctx) return canvas;

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  for (const cell of cells) {
    if (cell.flicker) continue; // flickering cells drawn per-frame
    ctx.font = `400 10px ${FONTS.mono}`;
    ctx.fillStyle = `rgba(${cell.r},${cell.g},${cell.b},${cell.alpha})`;
    ctx.fillText(cell.char, cell.x, cell.y);
  }

  return canvas;
}

// ── Per-frame flicker pass ──────────────────────────────────────────────

/**
 * Draw the flickering cells with time-varying alpha (torchlight effect).
 * Call this each frame AFTER blitting the static cache.
 */
export function renderCaveBgFlicker(
  ctx: CanvasRenderingContext2D,
  cells: CaveBgCell[],
  elapsed: number,
): void {
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `400 10px ${FONTS.mono}`;

  for (const cell of cells) {
    if (!cell.flicker) continue;

    // Each flickering cell gets its own phase based on position
    const phase = cell.x * 0.13 + cell.y * 0.17;
    const flicker = Math.sin(elapsed * 0.002 + phase) * 0.5 + 0.5;
    const alphaBoost = flicker * 0.10; // oscillates 0–0.10
    const alpha = cell.alpha + alphaBoost;

    // Slight warm shift when "lit" by torchlight
    const warmth = flicker * 0.3;
    const r = Math.min(255, Math.floor(cell.r + warmth * 30));
    const g = Math.min(255, Math.floor(cell.g + warmth * 15));
    const b = cell.b;

    ctx.fillStyle = `rgba(${r},${g},${b},${alpha})`;
    ctx.fillText(cell.char, cell.x, cell.y);
  }

  ctx.restore();
}

// ── Cache management ────────────────────────────────────────────────────

let cache: CaveBgCache | null = null;

/**
 * Get or create the cave background cache for the given dimensions.
 * Re-generates if the canvas size has changed significantly.
 */
export function getCaveBg(w: number, h: number, seed = 42): CaveBgCache {
  // Re-use cache if dimensions haven't changed much (within 20px)
  if (
    cache &&
    Math.abs(cache.width - w) < 20 &&
    Math.abs(cache.height - h) < 20
  ) {
    return cache;
  }

  const cells = generateCaveCells(w, h, 8, seed);
  const canvas = renderCaveBgStatic(cells, w, h);

  cache = { canvas, cells, width: w, height: h };
  return cache;
}

/**
 * Clear the cache (e.g. on unmount or scene change).
 */
export function clearCaveBgCache(): void {
  cache = null;
}
