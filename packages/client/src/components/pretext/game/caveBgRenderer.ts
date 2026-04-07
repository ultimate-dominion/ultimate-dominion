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

/**
 * Generate a grid of cave background cells for the given canvas dimensions.
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

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const x = col * cellSize + cellSize / 2;
      const y = row * cellSize + cellSize / 2;

      const rowT = row / (rows - 1 || 1); // 0 = top, 1 = bottom
      const colT = col / (cols - 1 || 1); // 0 = left, 1 = right

      // ── Edge proximity (0 = center, 1 = edge) ──────────────────────
      const edgeX = Math.min(colT, 1 - colT) * 2; // 0 at edges, 1 at center
      const edgeY = Math.min(rowT, 1 - rowT) * 2;
      const distFromEdge = Math.min(edgeX, edgeY);

      // ── Stalactites (top) ──────────────────────────────────────────
      if (rowT < 0.35) {
        // Probability decreases with distance from ceiling
        const stalProb = (1 - rowT / 0.35) * 0.18;
        // Clusters: sine-based density variation across columns
        const clusterMod = Math.sin(col * 0.7 + seed) * 0.5 + 0.5;
        if (rand() < stalProb * (0.5 + clusterMod * 0.5)) {
          const color = pickColor(rand);
          const isTip = rowT > 0.20;
          cells.push({
            char: isTip ? pick(SPIKE_CHARS, rand) : pick(ROCK_CHARS, rand),
            x,
            y,
            ...color,
            alpha: 0.12 + (1 - rowT / 0.35) * 0.14,
            flicker: rand() < 0.03,
          });
          continue;
        }
      }

      // ── Stalagmites (bottom) ───────────────────────────────────────
      if (rowT > 0.70) {
        const stagProb = ((rowT - 0.70) / 0.30) * 0.15;
        const clusterMod = Math.sin(col * 0.9 + seed * 2) * 0.5 + 0.5;
        if (rand() < stagProb * (0.5 + clusterMod * 0.5)) {
          const color = pickColor(rand);
          const isTip = rowT < 0.82;
          cells.push({
            char: isTip ? pick(SPIKE_CHARS, rand) : pick(ROCK_CHARS, rand),
            x,
            y,
            ...color,
            alpha: 0.12 + ((rowT - 0.70) / 0.30) * 0.14,
            flicker: rand() < 0.02,
          });
          continue;
        }
      }

      // ── Wall edges (left and right) ────────────────────────────────
      if (edgeX < 0.25) {
        const wallProb = (1 - edgeX / 0.25) * 0.12;
        if (rand() < wallProb) {
          const color = pickColor(rand);
          cells.push({
            char: pick(TEXTURE_CHARS, rand),
            x,
            y,
            ...color,
            alpha: 0.10 + (1 - edgeX / 0.25) * 0.12,
            flicker: rand() < 0.02,
          });
          continue;
        }
      }

      // ── Scattered interior debris ──────────────────────────────────
      // Very sparse in the center so as not to compete with the creature
      const interiorProb = 0.008 + (1 - distFromEdge) * 0.012;
      if (rand() < interiorProb) {
        const color = pickColor(rand);
        cells.push({
          char: pick(SCATTER_CHARS, rand),
          x,
          y,
          ...color,
          alpha: 0.08 + rand() * 0.08,
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
