/**
 * Weapon projectile animations for the BattleSceneCanvas.
 * Ported from tools/creature-lab/battle-scene.js.
 *
 * Three weapon types based on dominant stat:
 *   - melee (STR): spinning warhammer
 *   - ranged (AGI): arrow with fletching + motion trail
 *   - spell (INT): fire bolt with radial glow + particle trail
 *
 * When a 3D item model is available, the projectile renders through the
 * ASCII pipeline (MonsterAsciiRenderer) so it matches the rest of the UI.
 * Otherwise falls back to the original 2D canvas drawings.
 */

import type { Weapon, Spell, StatRestrictions } from '../../../utils/types';
import { getItemDrawFn, isItemModelReady, itemSlug, loadItemModel, setItemRotation } from './glbItemLoader';
import type { MonsterTemplate } from './monsterTemplates';
import { renderMonster } from './MonsterAsciiRenderer';

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

// ── ASCII item template cache ────────────────────────────────────────────
// One template per item slug, reused across frames.

const itemTemplateCache = new Map<string, MonsterTemplate>();

function getItemTemplate(slug: string): MonsterTemplate | null {
  const cached = itemTemplateCache.get(slug);
  if (cached) return cached;

  const drawFn = getItemDrawFn(slug);
  if (!drawFn) return null;

  const template: MonsterTemplate = {
    id: `item-${slug}`,
    name: slug,
    gridWidth: 1,
    gridHeight: 1,
    monsterClass: 0 as const,
    level: 1,
    dynamic: true,
    // Brighter settings for small projectile — needs to pop against dark battle bg
    renderOverrides: {
      brightnessBoost: 2.4,
      gamma: 0.40,
      ambient: 0.85,
      charDensityFloor: 0.15,
    },
    draw: drawFn,
  };

  itemTemplateCache.set(slug, template);
  return template;
}

// ── 2D fallback draw functions ──────────────────────────────────────────
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
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(progress * Math.PI * 2.5);

  const sz = w * 0.03;
  // Head
  ctx.fillStyle = '#C4B89E';
  ctx.fillRect(-sz, -sz * 1.5, sz * 2, sz);
  // Handle
  ctx.fillStyle = '#6B5D4F';
  ctx.fillRect(-sz * 0.2, -sz * 0.5, sz * 0.4, sz * 2);

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
  const sz = w * 0.025;

  // Arrow shaft
  ctx.fillStyle = '#C4B89E';
  ctx.fillRect(x - sz, y - 1, sz * 2, 2);

  // Arrowhead
  ctx.fillStyle = '#D4A54A';
  ctx.beginPath();
  ctx.moveTo(x + sz, y);
  ctx.lineTo(x + sz - 4, y - 3);
  ctx.lineTo(x + sz - 4, y + 3);
  ctx.closePath();
  ctx.fill();

  // Fletching
  ctx.fillStyle = '#8A7E6A';
  ctx.fillRect(x - sz, y - 2, 3, 4);

  // Motion trail
  const trailLen = 3;
  for (let i = 0; i < trailLen; i++) {
    const tx = x - sz - (i + 1) * sz * 0.5;
    ctx.fillStyle = `rgba(196,184,158,${0.3 - i * 0.1})`;
    ctx.fillRect(tx, y - 0.5, sz * 0.4, 1);
  }
}

export function drawSpell(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  _h: number,
  progress: number,
): void {
  const baseR = w * 0.012;
  const pulse = 1 + Math.sin(progress * Math.PI * 6) * 0.3;
  const pulseR = baseR * pulse;

  // Outer glow
  const grd = ctx.createRadialGradient(x, y, 0, x, y, pulseR * 3);
  grd.addColorStop(0, 'rgba(255,160,50,0.4)');
  grd.addColorStop(0.5, 'rgba(255,100,20,0.15)');
  grd.addColorStop(1, 'rgba(255,60,10,0)');
  ctx.fillStyle = grd;
  ctx.fillRect(x - pulseR * 3, y - pulseR * 3, pulseR * 6, pulseR * 6);

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

// ── Monster attack draw functions ───────────────────────────────────────
// Visually distinct from player weapons — claws, fangs, dark magic.

function drawMonsterMelee(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  _h: number,
  progress: number,
): void {
  // ASCII claw slash — three slash characters that spread on impact
  ctx.save();
  ctx.translate(x, y);
  const sz = Math.round(w * 0.028);
  const font = `bold ${sz}px "Fira Code", monospace`;
  const spread = progress * sz * 0.8;
  const alpha = Math.max(0, 1 - progress * 0.3);

  const chars = ['╲', '│', '╱'];
  const offsets = [
    { dx: -spread, dy: -spread * 0.6 },
    { dx: 0, dy: 0 },
    { dx: spread, dy: -spread * 0.6 },
  ];

  for (let i = 0; i < 3; i++) {
    ctx.font = font;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = `rgba(200,80,60,${alpha})`;
    ctx.shadowColor = 'rgba(200,80,60,0.6)';
    ctx.shadowBlur = 8;
    ctx.fillText(chars[i], offsets[i].dx, offsets[i].dy);
  }
  ctx.shadowBlur = 0;

  // ASCII trail
  ctx.font = `${Math.round(sz * 0.6)}px "Fira Code", monospace`;
  for (let i = 1; i <= 3; i++) {
    ctx.fillStyle = `rgba(180,60,40,${0.3 - i * 0.08})`;
    ctx.fillText('·', -sz * i * 0.7, 0);
  }
  ctx.restore();
}

function drawMonsterRanged(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  _h: number,
  progress: number,
): void {
  // ASCII bone shard — rotating arrow-like characters
  const sz = Math.round(w * 0.026);
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(progress * Math.PI * 1.5);

  ctx.font = `bold ${sz}px "Fira Code", monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#B8A88A';
  ctx.shadowColor = 'rgba(184,168,138,0.5)';
  ctx.shadowBlur = 6;
  ctx.fillText('▶▸', 0, 0);
  ctx.shadowBlur = 0;

  ctx.restore();

  // ASCII trail
  const trailSz = Math.round(sz * 0.5);
  ctx.font = `${trailSz}px "Fira Code", monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (let i = 1; i <= 3; i++) {
    ctx.fillStyle = `rgba(160,140,120,${0.3 - i * 0.08})`;
    ctx.fillText('·', x - sz * i * 0.6, y);
  }
}

function drawMonsterSpell(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  _h: number,
  progress: number,
): void {
  // ASCII shadow bolt — pulsing dark magic character with glow
  const sz = Math.round(w * 0.03);
  const pulse = 1 + Math.sin(progress * Math.PI * 5) * 0.2;
  const pulseSz = Math.round(sz * pulse);

  ctx.save();
  ctx.font = `bold ${pulseSz}px "Fira Code", monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Outer glow
  ctx.shadowColor = 'rgba(140,80,200,0.7)';
  ctx.shadowBlur = 14;
  ctx.fillStyle = 'rgb(140,80,200)';
  ctx.fillText('◆', x, y);

  // Bright inner core
  ctx.shadowBlur = 0;
  ctx.font = `bold ${Math.round(pulseSz * 0.5)}px "Fira Code", monospace`;
  ctx.fillStyle = 'rgb(200,160,255)';
  ctx.fillText('✦', x, y);

  // ASCII particle trail
  ctx.font = `${Math.round(sz * 0.5)}px "Fira Code", monospace`;
  ctx.shadowBlur = 0;
  for (let i = 1; i <= 4; i++) {
    const tx = x - sz * i * 0.5;
    const ty = y + (i % 2 === 0 ? -2 : 2);
    ctx.fillStyle = `rgba(100,40,160,${0.4 - i * 0.08})`;
    ctx.fillText('·', tx, ty);
  }
  ctx.restore();
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

const MONSTER_DRAW_FNS: Record<
  WeaponAnimType,
  (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, progress: number) => void
> = {
  melee: drawMonsterMelee,
  ranged: drawMonsterRanged,
  spell: drawMonsterSpell,
};

/**
 * Draw a weapon projectile at (x, y). If a 3D item model is available for
 * the given itemName, renders it through the ASCII pipeline so it matches
 * the rest of the battle scene. Otherwise falls back to 2D canvas drawings.
 *
 * @param itemName        Optional weapon name from items.json (e.g. "Iron Axe").
 * @param isMonsterAttack If true, uses monster-themed visuals (claws, fangs, dark magic).
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
  isMonsterAttack?: boolean,
): void {
  // Try ASCII-rendered 3D item model first (player weapons only)
  if (itemName && !isMonsterAttack) {
    const slug = itemSlug(itemName);
    if (isItemModelReady(slug)) {
      const template = getItemTemplate(slug);
      if (template) {
        // Update item rotation before rendering
        const zRot = type === 'melee' ? progress * Math.PI * 2.5 : 0;
        const yRot = type === 'melee' ? progress * Math.PI * 1.2 : progress * 0.3;
        setItemRotation(slug, zRot, yRot);

        // Render as ASCII at the projectile position
        const size = w * 0.08;
        renderMonster(ctx, template, x - size / 2, y - size / 2, size, size, {
          cellSize: 6,
          enable3D: true,
          enableGlow: true,
          enableBgFill: false, // transparent bg — composited over battle scene
        });
        return;
      }
    } else {
      // Kick off load for next time (non-blocking)
      loadItemModel(slug).catch(() => {});
    }
  }

  // 2D fallback — monster attacks use distinct visuals
  const fns = isMonsterAttack ? MONSTER_DRAW_FNS : DRAW_FNS;
  fns[type](ctx, x, y, w, h, progress);
}

// ── Animation speeds per weapon type (ms) ───────────────────────────────

export const WEAPON_SPEED: Record<WeaponAnimType, number> = {
  melee: 600,
  ranged: 400,
  spell: 500,
};
