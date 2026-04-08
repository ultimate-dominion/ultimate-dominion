/**
 * Weapon projectile animations for the BattleSceneCanvas.
 * Ported from tools/creature-lab/battle-scene.js.
 *
 * Three weapon types based on dominant stat:
 *   - melee (STR): spinning warhammer
 *   - ranged (AGI): arrow with fletching + motion trail
 *   - spell (INT): fire bolt with radial glow + particle trail
 */

import type { Weapon, Spell, StatRestrictions } from '../../../utils/types';
import { drawItemProjectile, isItemModelReady, itemSlug, loadItemModel } from './glbItemLoader';

// ── Weapon type classification ──────────────────────────────────────────

export type WeaponAnimType = 'melee' | 'ranged' | 'spell';

/**
 * Determine animation type from an item's stat restrictions.
 * Spells always animate as spell. Weapons use dominant stat requirement.
 */
export function classifyWeapon(
  item: Weapon | Spell,
  isSpell: boolean,
): WeaponAnimType {
  if (isSpell) return 'spell';
  const sr = (item as Weapon).statRestrictions as StatRestrictions | undefined;
  if (!sr) return 'melee';

  const str = Number(sr.minStrength);
  const agi = Number(sr.minAgility);
  const int = Number(sr.minIntelligence);

  if (int >= str && int >= agi) return 'spell';
  if (agi >= str) return 'ranged';
  return 'melee';
}

// ── Draw functions ──────────────────────────────────────────────────────
// All draw at (x, y) with w/h as viewport reference for proportional sizing.
// progress: 0 → 1 over flight duration.

export function drawMelee(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  _h: number,
  progress: number,
): void {
  const headW = w * 0.06;
  const headH = w * 0.03;
  const handleLen = w * 0.08;
  const rot = progress * Math.PI * 2.5;

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);

  // Handle
  ctx.strokeStyle = 'rgb(140,100,60)';
  ctx.lineWidth = w * 0.008;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(-handleLen, 0);
  ctx.stroke();

  // Head
  ctx.fillStyle = 'rgb(160,160,170)';
  ctx.fillRect(-headW / 2, -headH, headW, headH * 2);

  // Edge highlight
  ctx.fillStyle = 'rgb(200,200,210)';
  ctx.fillRect(-headW / 2, -headH, headW * 0.3, headH * 2);

  ctx.restore();
}

export function drawRanged(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  _h: number,
  progress: number,
): void {
  const arrowLen = w * 0.07;

  ctx.save();
  ctx.translate(x, y);

  // Shaft
  ctx.strokeStyle = 'rgb(160,130,80)';
  ctx.lineWidth = w * 0.004;
  ctx.beginPath();
  ctx.moveTo(-arrowLen, 0);
  ctx.lineTo(0, 0);
  ctx.stroke();

  // Arrowhead
  ctx.fillStyle = 'rgb(180,180,190)';
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(-w * 0.015, -w * 0.008);
  ctx.lineTo(-w * 0.015, w * 0.008);
  ctx.closePath();
  ctx.fill();

  // Fletching
  ctx.fillStyle = 'rgb(140,60,50)';
  ctx.beginPath();
  ctx.moveTo(-arrowLen, 0);
  ctx.lineTo(-arrowLen + w * 0.012, -w * 0.006);
  ctx.lineTo(-arrowLen + w * 0.012, w * 0.006);
  ctx.closePath();
  ctx.fill();

  // Motion trail
  ctx.strokeStyle = `rgba(200,180,140,${0.3 * (1 - progress)})`;
  ctx.lineWidth = w * 0.002;
  ctx.beginPath();
  ctx.moveTo(-arrowLen, 0);
  ctx.lineTo(-arrowLen - w * 0.15, 0);
  ctx.stroke();

  ctx.restore();
}

export function drawSpell(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  _h: number,
  progress: number,
): void {
  const pulseR = w * 0.015 + Math.sin(progress * 20) * w * 0.003;

  // Outer glow
  const grd = ctx.createRadialGradient(x, y, 0, x, y, pulseR * 3);
  grd.addColorStop(0, 'rgba(255,120,20,0.6)');
  grd.addColorStop(0.5, 'rgba(255,60,10,0.2)');
  grd.addColorStop(1, 'rgba(255,30,0,0)');
  ctx.fillStyle = grd;
  ctx.beginPath();
  ctx.arc(x, y, pulseR * 3, 0, Math.PI * 2);
  ctx.fill();

  // Core
  ctx.fillStyle = 'rgb(255,220,120)';
  ctx.beginPath();
  ctx.arc(x, y, pulseR, 0, Math.PI * 2);
  ctx.fill();

  // Trail particles
  for (let i = 0; i < 5; i++) {
    const tx = x - w * 0.01 * (i + 1) + (Math.random() - 0.5) * w * 0.01;
    const ty = y + (Math.random() - 0.5) * w * 0.015;
    const tr = pulseR * (0.6 - i * 0.1);
    ctx.fillStyle = `rgba(255,${100 - i * 15},${20 - i * 4},${0.5 - i * 0.1})`;
    ctx.beginPath();
    ctx.arc(tx, ty, Math.max(1, tr), 0, Math.PI * 2);
    ctx.fill();
  }
}

// ── Unified draw dispatcher ─────────────────────────────────────────────

const DRAW_FNS: Record<
  WeaponAnimType,
  (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, progress: number) => void
> = {
  melee: drawMelee,
  ranged: drawRanged,
  spell: drawSpell,
};

/**
 * Draw a weapon projectile at (x, y). If a 3D item model is available for
 * the given itemName, renders it through the ASCII pipeline. Otherwise falls
 * back to the original 2D canvas drawings.
 *
 * @param itemName  Optional weapon name from items.json (e.g. "Iron Axe").
 *                  When provided, kicks off GLB loading and uses 3D once ready.
 */
export function drawWeapon(
  ctx: CanvasRenderingContext2D,
  type: WeaponAnimType,
  x: number,
  y: number,
  w: number,
  h: number,
  progress: number,
  itemName?: string,
): void {
  // Try 3D item model first
  if (itemName) {
    const slug = itemSlug(itemName);
    if (isItemModelReady(slug)) {
      const size = w * 0.06; // projectile display size proportional to canvas
      const rotation = type === 'melee' ? progress * Math.PI * 2.5 : 0;
      if (drawItemProjectile(ctx, slug, x, y, size, rotation)) return;
    } else {
      // Kick off load for next time (non-blocking)
      loadItemModel(slug).catch(() => {});
    }
  }

  // 2D fallback
  DRAW_FNS[type](ctx, x, y, w, h, progress);
}

// ── Animation speeds per weapon type (ms) ───────────────────────────────

export const WEAPON_SPEED: Record<WeaponAnimType, number> = {
  melee: 600,
  ranged: 400,
  spell: 500,
};
