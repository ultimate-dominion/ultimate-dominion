/**
 * itemAsciiArt.ts — Subtype-based silhouette templates for item ASCII rendering.
 *
 * Each weapon/armor subtype gets a draw function that paints a recognizable
 * silhouette onto a canvas. The MonsterAsciiRenderer converts these to ASCII
 * art for inline UI display (item cards, loadouts, shop, etc.).
 *
 * Draw functions paint warm-toned shapes on a black background:
 *   (ctx, w, h) => void
 *
 * Rarity controls brightness: R0 is dim/monochrome, R4 is vivid with accents.
 */

import type { MonsterTemplate } from './monsterTemplates';

// ── Weapon subtype classification (mirrors item-forge.mjs) ────────────

export type WeaponSubtype = 'sword' | 'axe' | 'mace' | 'dagger' | 'bow' | 'staff' | 'wand' | 'spear';
export type ArmorSubtype = 'cloth' | 'leather' | 'plate';
export type ItemSubtype = WeaponSubtype | ArmorSubtype;

export function classifyWeaponSubtype(name: string): WeaponSubtype {
  const n = name.toLowerCase();
  if (/bow/.test(n)) return 'bow';
  if (/staff/.test(n)) return 'staff';
  if (/wand|rod/.test(n)) return 'wand';
  if (/axe|cleaver/.test(n)) return 'axe';
  if (/hammer|maul|cudgel|mace/.test(n)) return 'mace';
  if (/dagger|fang|shard|phasefang/.test(n)) return 'dagger';
  if (/spear|lance/.test(n)) return 'spear';
  return 'sword';
}

export function classifyArmorSubtype(name: string): ArmorSubtype {
  const n = name.toLowerCase();
  if (/cloth|robe|vestment|cowl|mantle|wraps|tattered|frostweave|mistcloak|ember/.test(n)) return 'cloth';
  if (/leather|jerkin|vest|scout|ranger|stalker|hide|shroud|stormhide|galebound|phantom/.test(n)) return 'leather';
  return 'plate';
}

// ── Rarity color palette ──────────────────────────────────────────────

type RarityPalette = { base: string; accent: string; glow: string };

const RARITY_PALETTES: RarityPalette[] = [
  { base: '#6B6560', accent: '#8A8478', glow: 'none' },          // R0: dim gray
  { base: '#8A7E6A', accent: '#A89A82', glow: 'none' },          // R1: warm gray
  { base: '#7A9A6A', accent: '#9AB882', glow: 'none' },          // R2: green tint
  { base: '#5A88B8', accent: '#7AA8D8', glow: '#5A88B820' },     // R3: blue
  { base: '#9A6AB8', accent: '#BA8AD8', glow: '#9A6AB830' },     // R4: purple
];

function getPalette(rarity: number): RarityPalette {
  return RARITY_PALETTES[Math.min(rarity, 4)];
}

// ── Draw helpers ──────────────────────────────────────────────────────

function fillBg(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, w, h);
}

// ── Weapon draw functions ─────────────────────────────────────────────

function drawSword(ctx: CanvasRenderingContext2D, w: number, h: number, pal: RarityPalette) {
  fillBg(ctx, w, h);
  const cx = w / 2, cy = h / 2;

  // Blade
  ctx.fillStyle = pal.accent;
  ctx.beginPath();
  ctx.moveTo(cx, h * 0.08);
  ctx.lineTo(cx + w * 0.08, h * 0.62);
  ctx.lineTo(cx - w * 0.08, h * 0.62);
  ctx.closePath();
  ctx.fill();

  // Fuller (center line)
  ctx.fillStyle = pal.base;
  ctx.fillRect(cx - w * 0.02, h * 0.15, w * 0.04, h * 0.42);

  // Crossguard
  ctx.fillStyle = pal.base;
  ctx.fillRect(cx - w * 0.22, h * 0.60, w * 0.44, h * 0.06);

  // Grip
  ctx.fillStyle = '#4A3A28';
  ctx.fillRect(cx - w * 0.05, h * 0.66, w * 0.10, h * 0.20);

  // Pommel
  ctx.fillStyle = pal.base;
  ctx.beginPath();
  ctx.arc(cx, h * 0.90, w * 0.06, 0, Math.PI * 2);
  ctx.fill();
}

function drawAxe(ctx: CanvasRenderingContext2D, w: number, h: number, pal: RarityPalette) {
  fillBg(ctx, w, h);
  const cx = w / 2;

  // Shaft
  ctx.fillStyle = '#5A4A38';
  ctx.fillRect(cx - w * 0.04, h * 0.15, w * 0.08, h * 0.75);

  // Axe head
  ctx.fillStyle = pal.accent;
  ctx.beginPath();
  ctx.moveTo(cx + w * 0.04, h * 0.12);
  ctx.quadraticCurveTo(cx + w * 0.40, h * 0.20, cx + w * 0.38, h * 0.42);
  ctx.lineTo(cx + w * 0.04, h * 0.42);
  ctx.closePath();
  ctx.fill();

  // Edge highlight
  ctx.strokeStyle = pal.base;
  ctx.lineWidth = w * 0.02;
  ctx.beginPath();
  ctx.moveTo(cx + w * 0.38, h * 0.18);
  ctx.quadraticCurveTo(cx + w * 0.42, h * 0.30, cx + w * 0.38, h * 0.42);
  ctx.stroke();
}

function drawMace(ctx: CanvasRenderingContext2D, w: number, h: number, pal: RarityPalette) {
  fillBg(ctx, w, h);
  const cx = w / 2;

  // Handle
  ctx.fillStyle = '#5A4A38';
  ctx.fillRect(cx - w * 0.04, h * 0.45, w * 0.08, h * 0.48);

  // Head
  ctx.fillStyle = pal.accent;
  ctx.beginPath();
  ctx.arc(cx, h * 0.28, w * 0.22, 0, Math.PI * 2);
  ctx.fill();

  // Flanges
  ctx.fillStyle = pal.base;
  for (let i = 0; i < 4; i++) {
    const angle = (i * Math.PI) / 2 - Math.PI / 4;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(angle) * w * 0.16, h * 0.28 + Math.sin(angle) * w * 0.16);
    ctx.lineTo(cx + Math.cos(angle) * w * 0.30, h * 0.28 + Math.sin(angle) * w * 0.30);
    ctx.lineTo(cx + Math.cos(angle + 0.3) * w * 0.16, h * 0.28 + Math.sin(angle + 0.3) * w * 0.16);
    ctx.closePath();
    ctx.fill();
  }
}

function drawDagger(ctx: CanvasRenderingContext2D, w: number, h: number, pal: RarityPalette) {
  fillBg(ctx, w, h);
  const cx = w / 2;

  // Blade (shorter, curved)
  ctx.fillStyle = pal.accent;
  ctx.beginPath();
  ctx.moveTo(cx, h * 0.12);
  ctx.quadraticCurveTo(cx + w * 0.15, h * 0.30, cx + w * 0.06, h * 0.52);
  ctx.lineTo(cx - w * 0.06, h * 0.52);
  ctx.quadraticCurveTo(cx - w * 0.10, h * 0.30, cx, h * 0.12);
  ctx.closePath();
  ctx.fill();

  // Guard
  ctx.fillStyle = pal.base;
  ctx.fillRect(cx - w * 0.16, h * 0.52, w * 0.32, h * 0.05);

  // Handle
  ctx.fillStyle = '#4A3A28';
  ctx.fillRect(cx - w * 0.05, h * 0.57, w * 0.10, h * 0.28);

  // Pommel
  ctx.fillStyle = pal.base;
  ctx.beginPath();
  ctx.arc(cx, h * 0.88, w * 0.05, 0, Math.PI * 2);
  ctx.fill();
}

function drawBow(ctx: CanvasRenderingContext2D, w: number, h: number, pal: RarityPalette) {
  fillBg(ctx, w, h);
  const cx = w / 2;

  // Bow limb (curved)
  ctx.strokeStyle = pal.accent;
  ctx.lineWidth = w * 0.06;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(cx - w * 0.05, h * 0.10);
  ctx.quadraticCurveTo(cx - w * 0.38, h * 0.50, cx - w * 0.05, h * 0.90);
  ctx.stroke();

  // String
  ctx.strokeStyle = pal.base;
  ctx.lineWidth = w * 0.02;
  ctx.beginPath();
  ctx.moveTo(cx - w * 0.05, h * 0.10);
  ctx.lineTo(cx + w * 0.15, h * 0.50);
  ctx.lineTo(cx - w * 0.05, h * 0.90);
  ctx.stroke();

  // Arrow
  ctx.fillStyle = '#8A7A68';
  ctx.fillRect(cx - w * 0.02, h * 0.18, w * 0.04, h * 0.64);
  // Arrowhead
  ctx.fillStyle = pal.accent;
  ctx.beginPath();
  ctx.moveTo(cx, h * 0.10);
  ctx.lineTo(cx + w * 0.06, h * 0.20);
  ctx.lineTo(cx - w * 0.06, h * 0.20);
  ctx.closePath();
  ctx.fill();
}

function drawStaff(ctx: CanvasRenderingContext2D, w: number, h: number, pal: RarityPalette) {
  fillBg(ctx, w, h);
  const cx = w / 2;

  // Shaft
  ctx.fillStyle = '#5A4A38';
  ctx.fillRect(cx - w * 0.04, h * 0.25, w * 0.08, h * 0.70);

  // Crystal/orb
  ctx.fillStyle = pal.accent;
  ctx.beginPath();
  ctx.arc(cx, h * 0.18, w * 0.15, 0, Math.PI * 2);
  ctx.fill();

  // Inner glow
  ctx.fillStyle = pal.base;
  ctx.beginPath();
  ctx.arc(cx, h * 0.16, w * 0.07, 0, Math.PI * 2);
  ctx.fill();

  // Staff head prongs
  ctx.fillStyle = '#6A5A48';
  ctx.beginPath();
  ctx.moveTo(cx - w * 0.12, h * 0.28);
  ctx.quadraticCurveTo(cx - w * 0.18, h * 0.16, cx - w * 0.08, h * 0.08);
  ctx.lineTo(cx - w * 0.04, h * 0.14);
  ctx.lineTo(cx - w * 0.04, h * 0.28);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(cx + w * 0.12, h * 0.28);
  ctx.quadraticCurveTo(cx + w * 0.18, h * 0.16, cx + w * 0.08, h * 0.08);
  ctx.lineTo(cx + w * 0.04, h * 0.14);
  ctx.lineTo(cx + w * 0.04, h * 0.28);
  ctx.closePath();
  ctx.fill();
}

function drawWand(ctx: CanvasRenderingContext2D, w: number, h: number, pal: RarityPalette) {
  fillBg(ctx, w, h);
  const cx = w / 2;

  // Rod
  ctx.fillStyle = '#5A4A38';
  ctx.save();
  ctx.translate(cx, h * 0.50);
  ctx.rotate(-0.15);
  ctx.fillRect(-w * 0.03, -h * 0.32, w * 0.06, h * 0.64);
  ctx.restore();

  // Glowing tip
  ctx.fillStyle = pal.accent;
  ctx.beginPath();
  ctx.arc(cx - w * 0.05, h * 0.15, w * 0.10, 0, Math.PI * 2);
  ctx.fill();

  // Inner spark
  ctx.fillStyle = pal.base;
  ctx.beginPath();
  ctx.arc(cx - w * 0.05, h * 0.14, w * 0.04, 0, Math.PI * 2);
  ctx.fill();
}

function drawSpear(ctx: CanvasRenderingContext2D, w: number, h: number, pal: RarityPalette) {
  fillBg(ctx, w, h);
  const cx = w / 2;

  // Shaft
  ctx.fillStyle = '#5A4A38';
  ctx.fillRect(cx - w * 0.03, h * 0.22, w * 0.06, h * 0.72);

  // Spearhead
  ctx.fillStyle = pal.accent;
  ctx.beginPath();
  ctx.moveTo(cx, h * 0.05);
  ctx.lineTo(cx + w * 0.10, h * 0.25);
  ctx.lineTo(cx - w * 0.10, h * 0.25);
  ctx.closePath();
  ctx.fill();
}

// ── Armor draw functions ──────────────────────────────────────────────

function drawCloth(ctx: CanvasRenderingContext2D, w: number, h: number, pal: RarityPalette) {
  fillBg(ctx, w, h);
  const cx = w / 2;

  // Hood
  ctx.fillStyle = pal.base;
  ctx.beginPath();
  ctx.arc(cx, h * 0.18, w * 0.18, Math.PI, 0);
  ctx.lineTo(cx + w * 0.22, h * 0.28);
  ctx.lineTo(cx - w * 0.22, h * 0.28);
  ctx.closePath();
  ctx.fill();

  // Robe body
  ctx.fillStyle = pal.accent;
  ctx.beginPath();
  ctx.moveTo(cx - w * 0.20, h * 0.28);
  ctx.lineTo(cx - w * 0.35, h * 0.92);
  ctx.lineTo(cx + w * 0.35, h * 0.92);
  ctx.lineTo(cx + w * 0.20, h * 0.28);
  ctx.closePath();
  ctx.fill();

  // Collar
  ctx.fillStyle = pal.base;
  ctx.beginPath();
  ctx.moveTo(cx - w * 0.10, h * 0.28);
  ctx.lineTo(cx, h * 0.40);
  ctx.lineTo(cx + w * 0.10, h * 0.28);
  ctx.closePath();
  ctx.fill();

  // Belt
  ctx.fillStyle = '#4A3A28';
  ctx.fillRect(cx - w * 0.24, h * 0.55, w * 0.48, h * 0.04);
}

function drawLeather(ctx: CanvasRenderingContext2D, w: number, h: number, pal: RarityPalette) {
  fillBg(ctx, w, h);
  const cx = w / 2;

  // Vest body
  ctx.fillStyle = pal.accent;
  ctx.beginPath();
  ctx.moveTo(cx - w * 0.28, h * 0.12);
  ctx.lineTo(cx - w * 0.32, h * 0.80);
  ctx.lineTo(cx + w * 0.32, h * 0.80);
  ctx.lineTo(cx + w * 0.28, h * 0.12);
  ctx.closePath();
  ctx.fill();

  // Shoulder pads
  ctx.fillStyle = pal.base;
  ctx.beginPath();
  ctx.ellipse(cx - w * 0.24, h * 0.14, w * 0.12, h * 0.06, -0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(cx + w * 0.24, h * 0.14, w * 0.12, h * 0.06, 0.2, 0, Math.PI * 2);
  ctx.fill();

  // Center seam
  ctx.strokeStyle = '#4A3A28';
  ctx.lineWidth = w * 0.02;
  ctx.beginPath();
  ctx.moveTo(cx, h * 0.15);
  ctx.lineTo(cx, h * 0.75);
  ctx.stroke();

  // Buckle straps
  ctx.fillStyle = '#4A3A28';
  ctx.fillRect(cx - w * 0.30, h * 0.30, w * 0.60, h * 0.03);
  ctx.fillRect(cx - w * 0.30, h * 0.55, w * 0.60, h * 0.03);

  // Buckles
  ctx.fillStyle = pal.base;
  ctx.fillRect(cx - w * 0.04, h * 0.28, w * 0.08, h * 0.07);
  ctx.fillRect(cx - w * 0.04, h * 0.53, w * 0.08, h * 0.07);
}

function drawPlate(ctx: CanvasRenderingContext2D, w: number, h: number, pal: RarityPalette) {
  fillBg(ctx, w, h);
  const cx = w / 2;

  // Breastplate body
  ctx.fillStyle = pal.accent;
  ctx.beginPath();
  ctx.moveTo(cx - w * 0.32, h * 0.10);
  ctx.quadraticCurveTo(cx - w * 0.36, h * 0.50, cx - w * 0.28, h * 0.82);
  ctx.lineTo(cx + w * 0.28, h * 0.82);
  ctx.quadraticCurveTo(cx + w * 0.36, h * 0.50, cx + w * 0.32, h * 0.10);
  ctx.closePath();
  ctx.fill();

  // Chest ridge
  ctx.strokeStyle = pal.base;
  ctx.lineWidth = w * 0.03;
  ctx.beginPath();
  ctx.moveTo(cx, h * 0.14);
  ctx.lineTo(cx, h * 0.50);
  ctx.stroke();

  // Plate segments
  ctx.strokeStyle = '#4A3A28';
  ctx.lineWidth = w * 0.015;
  ctx.beginPath();
  ctx.moveTo(cx - w * 0.30, h * 0.35);
  ctx.lineTo(cx + w * 0.30, h * 0.35);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx - w * 0.28, h * 0.58);
  ctx.lineTo(cx + w * 0.28, h * 0.58);
  ctx.stroke();

  // Rivets
  ctx.fillStyle = pal.base;
  for (const oy of [0.18, 0.42, 0.68]) {
    for (const ox of [-0.18, 0.18]) {
      ctx.beginPath();
      ctx.arc(cx + w * ox, h * oy, w * 0.025, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

// ── Template builder ──────────────────────────────────────────────────

const WEAPON_DRAW: Record<WeaponSubtype, (ctx: CanvasRenderingContext2D, w: number, h: number, pal: RarityPalette) => void> = {
  sword: drawSword,
  axe: drawAxe,
  mace: drawMace,
  dagger: drawDagger,
  bow: drawBow,
  staff: drawStaff,
  wand: drawWand,
  spear: drawSpear,
};

const ARMOR_DRAW: Record<ArmorSubtype, (ctx: CanvasRenderingContext2D, w: number, h: number, pal: RarityPalette) => void> = {
  cloth: drawCloth,
  leather: drawLeather,
  plate: drawPlate,
};

const templateCache = new Map<string, MonsterTemplate>();

/**
 * Build a MonsterTemplate for an item (weapon or armor).
 * Caches by name so repeated renders reuse the same template.
 */
export function getItemAsciiTemplate(
  name: string,
  itemType: 'weapon' | 'armor',
  rarity: number = 0,
): MonsterTemplate {
  const cacheKey = `${name}-${rarity}`;
  const cached = templateCache.get(cacheKey);
  if (cached) return cached;

  const pal = getPalette(rarity);
  const subtype = itemType === 'weapon'
    ? classifyWeaponSubtype(name)
    : classifyArmorSubtype(name);

  const drawFn = itemType === 'weapon'
    ? WEAPON_DRAW[subtype as WeaponSubtype]
    : ARMOR_DRAW[subtype as ArmorSubtype];

  const template: MonsterTemplate = {
    id: `item-icon-${cacheKey}`,
    name,
    gridWidth: 1,
    gridHeight: 1,
    monsterClass: 0 as const,
    level: 1,
    dynamic: false,
    renderOverrides: {
      brightnessBoost: 1.6 + rarity * 0.2,
      gamma: 0.45,
      ambient: 0.80,
      charDensityFloor: 0.10,
    },
    draw: (ctx, w, h) => drawFn(ctx, w, h, pal),
  };

  templateCache.set(cacheKey, template);
  return template;
}
