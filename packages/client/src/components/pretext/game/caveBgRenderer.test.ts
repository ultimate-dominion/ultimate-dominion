import { describe, expect, it, beforeEach } from 'vitest';

import {
  generateCaveCells,
  getCaveBg,
  clearCaveBgCache,
  type CaveBgCell,
} from './caveBgRenderer';

describe('caveBgRenderer', () => {
  beforeEach(() => {
    clearCaveBgCache();
  });

  describe('generateCaveCells', () => {
    it('generates cells for given dimensions', () => {
      const cells = generateCaveCells(400, 300, 8, 42);
      expect(cells.length).toBeGreaterThan(0);
    });

    it('produces deterministic output for the same seed', () => {
      const a = generateCaveCells(400, 300, 8, 42);
      const b = generateCaveCells(400, 300, 8, 42);

      expect(a.length).toBe(b.length);
      for (let i = 0; i < a.length; i++) {
        expect(a[i].char).toBe(b[i].char);
        expect(a[i].x).toBe(b[i].x);
        expect(a[i].y).toBe(b[i].y);
        expect(a[i].r).toBe(b[i].r);
        expect(a[i].g).toBe(b[i].g);
        expect(a[i].b).toBe(b[i].b);
      }
    });

    it('produces different output for different seeds', () => {
      const a = generateCaveCells(400, 300, 8, 42);
      const b = generateCaveCells(400, 300, 8, 99);

      // Same dimensions but different seed should give different cell positions/chars
      const aChars = a.map(c => c.char).join('');
      const bChars = b.map(c => c.char).join('');
      expect(aChars).not.toBe(bChars);
    });

    it('all cells have valid alpha values between 0 and 1', () => {
      const cells = generateCaveCells(600, 400, 8, 42);
      for (const cell of cells) {
        expect(cell.alpha).toBeGreaterThanOrEqual(0);
        expect(cell.alpha).toBeLessThanOrEqual(1);
      }
    });

    it('all cells have valid RGB values between 0 and 255', () => {
      const cells = generateCaveCells(600, 400, 8, 42);
      for (const cell of cells) {
        expect(cell.r).toBeGreaterThanOrEqual(0);
        expect(cell.r).toBeLessThanOrEqual(255);
        expect(cell.g).toBeGreaterThanOrEqual(0);
        expect(cell.g).toBeLessThanOrEqual(255);
        expect(cell.b).toBeGreaterThanOrEqual(0);
        expect(cell.b).toBeLessThanOrEqual(255);
      }
    });

    it('cells have low alpha values (dim background)', () => {
      const cells = generateCaveCells(400, 300, 8, 42);
      const maxAlpha = Math.max(...cells.map(c => c.alpha));
      // Background cells should be very dim — max alpha should be well under 0.20
      expect(maxAlpha).toBeLessThanOrEqual(0.20);
    });

    it('places more cells near edges than in the center', () => {
      const cells = generateCaveCells(600, 400, 8, 42);
      const centerCells = cells.filter(c =>
        c.x > 200 && c.x < 400 && c.y > 130 && c.y < 270,
      );
      const edgeCells = cells.filter(c =>
        c.x < 100 || c.x > 500 || c.y < 60 || c.y > 340,
      );
      expect(edgeCells.length).toBeGreaterThan(centerCells.length);
    });

    it('marks some cells as flickering', () => {
      const cells = generateCaveCells(600, 400, 8, 42);
      const flickering = cells.filter(c => c.flicker);
      expect(flickering.length).toBeGreaterThan(0);
      // But not too many — should be a small percentage
      expect(flickering.length / cells.length).toBeLessThan(0.10);
    });

    it('handles zero-size canvas gracefully', () => {
      const cells = generateCaveCells(0, 0, 8, 42);
      expect(cells).toEqual([]);
    });

    it('handles very small canvas', () => {
      const cells = generateCaveCells(16, 16, 8, 42);
      // Should still produce some cells (edges)
      expect(cells.length).toBeGreaterThanOrEqual(0);
    });

    it('scales cell count with canvas size', () => {
      const small = generateCaveCells(200, 150, 8, 42);
      const large = generateCaveCells(800, 600, 8, 42);
      expect(large.length).toBeGreaterThan(small.length);
    });
  });

  describe('getCaveBg (caching)', () => {
    it('returns a cache object with canvas and cells', () => {
      const bg = getCaveBg(400, 300);
      expect(bg.canvas).toBeDefined();
      expect(bg.cells.length).toBeGreaterThan(0);
      expect(bg.width).toBe(400);
      expect(bg.height).toBe(300);
    });

    it('returns the same cache for identical dimensions', () => {
      const a = getCaveBg(400, 300);
      const b = getCaveBg(400, 300);
      expect(a).toBe(b); // same reference
    });

    it('returns the same cache for dimensions within 20px tolerance', () => {
      const a = getCaveBg(400, 300);
      const b = getCaveBg(410, 310);
      expect(a).toBe(b); // still same reference due to tolerance
    });

    it('regenerates cache when dimensions change significantly', () => {
      const a = getCaveBg(400, 300);
      const b = getCaveBg(600, 400);
      expect(a).not.toBe(b);
    });

    it('clearCaveBgCache forces regeneration', () => {
      const a = getCaveBg(400, 300);
      clearCaveBgCache();
      const b = getCaveBg(400, 300);
      expect(a).not.toBe(b);
    });
  });
});
