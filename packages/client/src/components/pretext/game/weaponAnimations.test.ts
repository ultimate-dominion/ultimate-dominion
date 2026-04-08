import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock glbItemLoader — we test its integration with drawWeapon
vi.mock('./glbItemLoader', () => ({
  isItemModelReady: vi.fn().mockReturnValue(false),
  drawItemProjectile: vi.fn().mockReturnValue(false),
  itemSlug: vi.fn((name: string) =>
    name.toLowerCase().replace(/['']/g, '').replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
  ),
  loadItemModel: vi.fn().mockResolvedValue(undefined),
}));

import {
  classifyWeapon,
  drawWeapon,
  WEAPON_SPEED,
  type WeaponAnimType,
} from './weaponAnimations';
import { isItemModelReady, drawItemProjectile, loadItemModel } from './glbItemLoader';

// Minimal canvas mock for draw functions
function makeCtx(): CanvasRenderingContext2D {
  return {
    save: vi.fn(),
    restore: vi.fn(),
    translate: vi.fn(),
    rotate: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    closePath: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    fillRect: vi.fn(),
    strokeStyle: '',
    fillStyle: '',
    lineWidth: 0,
    createRadialGradient: vi.fn().mockReturnValue({
      addColorStop: vi.fn(),
    }),
  } as unknown as CanvasRenderingContext2D;
}

describe('weaponAnimations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('classifyWeapon', () => {
    it('returns spell for spell items regardless of stats', () => {
      const spell = { name: 'Fireball', statRestrictions: { minStrength: 0, minAgility: 0, minIntelligence: 5 } };
      expect(classifyWeapon(spell as any, true)).toBe('spell');
    });

    it('returns spell for spell flag even with high STR', () => {
      const spell = { name: 'War Chant', statRestrictions: { minStrength: 10, minAgility: 0, minIntelligence: 0 } };
      expect(classifyWeapon(spell as any, true)).toBe('spell');
    });

    it('returns melee for STR-dominant weapon', () => {
      const weapon = { name: 'Iron Axe', statRestrictions: { minStrength: 8, minAgility: 2, minIntelligence: 1 } };
      expect(classifyWeapon(weapon as any, false)).toBe('melee');
    });

    it('returns ranged for AGI-dominant weapon', () => {
      const weapon = { name: 'Hunting Bow', statRestrictions: { minStrength: 2, minAgility: 8, minIntelligence: 1 } };
      expect(classifyWeapon(weapon as any, false)).toBe('ranged');
    });

    it('returns spell for INT-dominant weapon', () => {
      const weapon = { name: 'Staff of Fire', statRestrictions: { minStrength: 1, minAgility: 2, minIntelligence: 8 } };
      expect(classifyWeapon(weapon as any, false)).toBe('spell');
    });

    it('returns melee when no statRestrictions', () => {
      const weapon = { name: 'Broken Sword' };
      expect(classifyWeapon(weapon as any, false)).toBe('melee');
    });

    it('returns ranged when AGI ties STR (AGI wins ties)', () => {
      const weapon = { name: 'Balanced Blade', statRestrictions: { minStrength: 5, minAgility: 5, minIntelligence: 0 } };
      expect(classifyWeapon(weapon as any, false)).toBe('ranged');
    });

    it('returns spell when INT ties others (INT wins ties)', () => {
      const weapon = { name: 'Arcane Sword', statRestrictions: { minStrength: 5, minAgility: 5, minIntelligence: 5 } };
      expect(classifyWeapon(weapon as any, false)).toBe('spell');
    });

    it('handles BigInt stat values via Number coercion', () => {
      const weapon = { name: 'Heavy Mace', statRestrictions: { minStrength: BigInt(10), minAgility: BigInt(2), minIntelligence: BigInt(1) } };
      expect(classifyWeapon(weapon as any, false)).toBe('melee');
    });
  });

  describe('WEAPON_SPEED', () => {
    it('defines speeds for all weapon types', () => {
      expect(WEAPON_SPEED.melee).toBeGreaterThan(0);
      expect(WEAPON_SPEED.ranged).toBeGreaterThan(0);
      expect(WEAPON_SPEED.spell).toBeGreaterThan(0);
    });

    it('ranged is fastest, melee is slowest', () => {
      expect(WEAPON_SPEED.ranged).toBeLessThan(WEAPON_SPEED.melee);
      expect(WEAPON_SPEED.ranged).toBeLessThan(WEAPON_SPEED.spell);
    });
  });

  describe('drawWeapon', () => {
    it('uses 2D fallback when no itemName provided', () => {
      const ctx = makeCtx();
      drawWeapon(ctx, 'melee', 100, 100, 400, 300, 0.5);
      // Should draw canvas primitives (not call glbItemLoader)
      expect(isItemModelReady).not.toHaveBeenCalled();
      expect(ctx.save).toHaveBeenCalled();
    });

    it('uses 2D fallback when item model not ready', () => {
      vi.mocked(isItemModelReady).mockReturnValue(false);
      const ctx = makeCtx();
      drawWeapon(ctx, 'melee', 100, 100, 400, 300, 0.5, 'Iron Axe');
      // Should kick off load for next time
      expect(loadItemModel).toHaveBeenCalledWith('iron-axe');
      // Still draws 2D fallback
      expect(ctx.save).toHaveBeenCalled();
    });

    it('uses 3D model when item is ready and drawItemProjectile succeeds', () => {
      vi.mocked(isItemModelReady).mockReturnValue(true);
      vi.mocked(drawItemProjectile).mockReturnValue(true);
      const ctx = makeCtx();
      drawWeapon(ctx, 'melee', 100, 100, 400, 300, 0.5, 'Iron Axe');
      expect(drawItemProjectile).toHaveBeenCalledWith(
        ctx, 'iron-axe', 100, 100, 400 * 0.06, expect.any(Number),
      );
      // 2D fallback should NOT have been called (no save from 2D draw fns)
      // The ctx.save would not be called since drawItemProjectile returned true
    });

    it('falls back to 2D if drawItemProjectile returns false', () => {
      vi.mocked(isItemModelReady).mockReturnValue(true);
      vi.mocked(drawItemProjectile).mockReturnValue(false);
      const ctx = makeCtx();
      drawWeapon(ctx, 'ranged', 100, 100, 400, 300, 0.5, 'Hunting Bow');
      // drawItemProjectile was attempted
      expect(drawItemProjectile).toHaveBeenCalled();
      // 2D fallback draws (ranged uses save/restore)
      expect(ctx.save).toHaveBeenCalled();
    });

    it('passes spin rotation for melee weapons', () => {
      vi.mocked(isItemModelReady).mockReturnValue(true);
      vi.mocked(drawItemProjectile).mockReturnValue(true);
      const ctx = makeCtx();
      const progress = 0.5;
      drawWeapon(ctx, 'melee', 100, 100, 400, 300, progress, 'Iron Axe');
      // Melee rotation = progress * PI * 2.5
      const expectedRotation = progress * Math.PI * 2.5;
      expect(drawItemProjectile).toHaveBeenCalledWith(
        ctx, 'iron-axe', 100, 100, expect.any(Number), expectedRotation,
      );
    });

    it('passes zero rotation for non-melee weapons', () => {
      vi.mocked(isItemModelReady).mockReturnValue(true);
      vi.mocked(drawItemProjectile).mockReturnValue(true);
      const ctx = makeCtx();
      drawWeapon(ctx, 'ranged', 100, 100, 400, 300, 0.5, 'Hunting Bow');
      expect(drawItemProjectile).toHaveBeenCalledWith(
        ctx, 'hunting-bow', 100, 100, expect.any(Number), 0,
      );
    });
  });
});
