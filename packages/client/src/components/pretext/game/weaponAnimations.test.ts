import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock glbItemLoader — we test its integration with drawWeapon
vi.mock('./glbItemLoader', () => ({
  isItemModelReady: vi.fn().mockReturnValue(false),
  getItemDrawFn: vi.fn().mockReturnValue(null),
  setItemRotation: vi.fn(),
  itemSlug: vi.fn((name: string) =>
    name.toLowerCase().replace(/['']/g, '').replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
  ),
  loadItemModel: vi.fn().mockResolvedValue(undefined),
}));

// Mock MonsterAsciiRenderer
vi.mock('./MonsterAsciiRenderer', () => ({
  renderMonster: vi.fn(),
}));

import {
  classifyWeapon,
  drawWeapon,
  WEAPON_SPEED,
  type WeaponAnimType,
} from './weaponAnimations';
import { isItemModelReady, getItemDrawFn, setItemRotation, loadItemModel } from './glbItemLoader';
import { renderMonster } from './MonsterAsciiRenderer';

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

    it('renders ASCII projectile when item model is ready', () => {
      const mockDrawFn = vi.fn();
      vi.mocked(isItemModelReady).mockReturnValue(true);
      vi.mocked(getItemDrawFn).mockReturnValue(mockDrawFn);
      const ctx = makeCtx();
      drawWeapon(ctx, 'melee', 100, 100, 400, 300, 0.5, 'Iron Axe');
      // Should set rotation and call renderMonster (ASCII pipeline)
      expect(setItemRotation).toHaveBeenCalledWith('iron-axe', expect.any(Number), expect.any(Number));
      expect(renderMonster).toHaveBeenCalledWith(
        ctx,
        expect.objectContaining({ id: 'item-iron-axe', dynamic: true }),
        expect.any(Number), expect.any(Number),
        expect.any(Number), expect.any(Number),
        expect.objectContaining({ cellSize: 6, enable3D: true, enableGlow: true }),
      );
    });

    it('falls back to 2D if getItemDrawFn returns null', () => {
      vi.mocked(isItemModelReady).mockReturnValue(true);
      vi.mocked(getItemDrawFn).mockReturnValue(null);
      const ctx = makeCtx();
      drawWeapon(ctx, 'ranged', 100, 100, 400, 300, 0.5, 'Hunting Bow');
      // renderMonster should NOT be called
      expect(renderMonster).not.toHaveBeenCalled();
      // 2D fallback draws
      expect(ctx.fillRect).toHaveBeenCalled();
    });

    it('applies spin rotation for melee weapons', () => {
      const mockDrawFn = vi.fn();
      vi.mocked(isItemModelReady).mockReturnValue(true);
      vi.mocked(getItemDrawFn).mockReturnValue(mockDrawFn);
      const ctx = makeCtx();
      const progress = 0.5;
      drawWeapon(ctx, 'melee', 100, 100, 400, 300, progress, 'Iron Axe');
      // Melee Z rotation = progress * PI * 2.5
      const expectedZ = progress * Math.PI * 2.5;
      const expectedY = progress * Math.PI * 1.2;
      expect(setItemRotation).toHaveBeenCalledWith('iron-axe', expectedZ, expectedY);
    });

    it('applies minimal rotation for non-melee weapons', () => {
      const mockDrawFn = vi.fn();
      vi.mocked(isItemModelReady).mockReturnValue(true);
      vi.mocked(getItemDrawFn).mockReturnValue(mockDrawFn);
      const ctx = makeCtx();
      drawWeapon(ctx, 'ranged', 100, 100, 400, 300, 0.5, 'Hunting Bow');
      // Ranged: z=0, y=progress*0.3
      expect(setItemRotation).toHaveBeenCalledWith('hunting-bow', 0, 0.5 * 0.3);
    });
  });
});
