/**
 * Monster silhouette templates for ASCII rendering — v3
 *
 * All monsters in side/3/4 profile facing RIGHT (Pokemon battle style).
 * Each template draws a brightness field (white/gray on black) to a canvas
 * evaluated at 512px resolution.
 *
 * Design principles:
 * - Side/3/4 profile: identifiable from silhouette alone ("who's that Pokemon?" test)
 * - Hard edges with subtle gradient shading for 3D volume
 * - Distinct anatomy: visible limbs, jaws, tails, wings, horns
 * - Linear gradient overlays for directional side-lighting
 * - Fine detail strokes for muscle, bone, scale texture
 */

export type MonsterTemplate = {
  id: string;
  name: string;
  /** Aspect ratio width */
  gridWidth: number;
  /** Aspect ratio height */
  gridHeight: number;
  /** 0=Warrior(STR), 1=Rogue(AGI), 2=Mage(INT) */
  monsterClass: 0 | 1 | 2;
  level: number;
  isBoss?: boolean;
  /** Draw silhouette on a pre-filled black canvas at (w x h) pixels */
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void;
};

// ---------------------------------------------------------------------------
// Shading helpers
// ---------------------------------------------------------------------------

/** Radial gradient with HARD edge — shape reads clearly */
function bodyGrad(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, r: number,
  core = '#fff', mid = '#ddd',
): CanvasGradient {
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
  g.addColorStop(0, core);
  g.addColorStop(0.5, mid);
  g.addColorStop(0.8, '#999');
  g.addColorStop(0.95, '#555');
  g.addColorStop(1, '#111');
  return g;
}

/** Side-light linear gradient overlay */
function sideLight(
  ctx: CanvasRenderingContext2D,
  x0: number, y0: number, x1: number, y1: number,
  bright = 'rgba(255,255,255,0.3)', dark = 'rgba(0,0,0,0.25)',
): CanvasGradient {
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  g.addColorStop(0, bright);
  g.addColorStop(0.5, 'rgba(128,128,128,0)');
  g.addColorStop(1, dark);
  return g;
}

function fillEllipse(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, rx: number, ry: number,
) {
  ctx.beginPath();
  ctx.ellipse(cx, cy, Math.max(1, rx), Math.max(1, ry), 0, 0, Math.PI * 2);
  ctx.fill();
}

function fillCircle(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  fillEllipse(ctx, cx, cy, r, r);
}

/** Limb stroke with taper */
function drawLimb(
  ctx: CanvasRenderingContext2D,
  x0: number, y0: number,
  cx: number, cy: number,
  x1: number, y1: number,
  thickness: number,
  color = '#bbb',
) {
  ctx.strokeStyle = color;
  ctx.lineWidth = thickness;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.quadraticCurveTo(cx, cy, x1, y1);
  ctx.stroke();
}

// ---------------------------------------------------------------------------
// 1. Dire Rat — L1, Rogue
// Side profile: hunched rodent, long snout, big ears, bald tail, clawed feet
// ---------------------------------------------------------------------------
function drawDireRat(ctx: CanvasRenderingContext2D, w: number, h: number) {
  // Main body — horizontal mass, hunched
  ctx.fillStyle = bodyGrad(ctx, w * 0.45, h * 0.45, w * 0.22);
  ctx.beginPath();
  ctx.moveTo(w * 0.25, h * 0.30);
  ctx.bezierCurveTo(w * 0.35, h * 0.22, w * 0.55, h * 0.22, w * 0.65, h * 0.30);
  ctx.bezierCurveTo(w * 0.72, h * 0.35, w * 0.72, h * 0.55, w * 0.65, h * 0.60);
  ctx.bezierCurveTo(w * 0.55, h * 0.68, w * 0.35, h * 0.68, w * 0.25, h * 0.60);
  ctx.bezierCurveTo(w * 0.20, h * 0.55, w * 0.20, h * 0.35, w * 0.25, h * 0.30);
  ctx.fill();

  // Side-light overlay
  ctx.fillStyle = sideLight(ctx, w * 0.25, h * 0.30, w * 0.65, h * 0.60);
  ctx.fill();

  // Haunches — rear bulk
  ctx.fillStyle = bodyGrad(ctx, w * 0.60, h * 0.42, w * 0.14);
  fillEllipse(ctx, w * 0.60, h * 0.42, w * 0.13, h * 0.16);

  // Head — angular, rodent skull
  ctx.fillStyle = bodyGrad(ctx, w * 0.18, h * 0.38, w * 0.10);
  ctx.beginPath();
  ctx.moveTo(w * 0.22, h * 0.28);
  ctx.bezierCurveTo(w * 0.14, h * 0.26, w * 0.08, h * 0.32, w * 0.06, h * 0.38);
  ctx.bezierCurveTo(w * 0.04, h * 0.42, w * 0.06, h * 0.48, w * 0.10, h * 0.50);
  ctx.bezierCurveTo(w * 0.16, h * 0.52, w * 0.22, h * 0.50, w * 0.25, h * 0.45);
  ctx.bezierCurveTo(w * 0.26, h * 0.38, w * 0.26, h * 0.32, w * 0.22, h * 0.28);
  ctx.fill();

  // Snout — pointed, extends left
  ctx.fillStyle = '#ccc';
  ctx.beginPath();
  ctx.moveTo(w * 0.08, h * 0.36);
  ctx.bezierCurveTo(w * 0.04, h * 0.37, w * 0.01, h * 0.39, w * 0.00, h * 0.40);
  ctx.bezierCurveTo(w * 0.01, h * 0.42, w * 0.04, h * 0.44, w * 0.08, h * 0.44);
  ctx.closePath();
  ctx.fill();

  // Nose
  ctx.fillStyle = '#fff';
  fillCircle(ctx, w * 0.015, h * 0.405, w * 0.012);

  // Eye — sharp, bright
  ctx.fillStyle = '#fff';
  fillCircle(ctx, w * 0.13, h * 0.36, w * 0.015);
  ctx.fillStyle = '#000';
  fillCircle(ctx, w * 0.132, h * 0.36, w * 0.006);

  // Ears — two large triangular ears
  ctx.fillStyle = '#ccc';
  ctx.beginPath();
  ctx.moveTo(w * 0.15, h * 0.28);
  ctx.bezierCurveTo(w * 0.12, h * 0.16, w * 0.14, h * 0.10, w * 0.17, h * 0.08);
  ctx.bezierCurveTo(w * 0.20, h * 0.10, w * 0.21, h * 0.18, w * 0.20, h * 0.26);
  ctx.closePath();
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(w * 0.21, h * 0.26);
  ctx.bezierCurveTo(w * 0.19, h * 0.14, w * 0.22, h * 0.06, w * 0.25, h * 0.05);
  ctx.bezierCurveTo(w * 0.28, h * 0.08, w * 0.28, h * 0.18, w * 0.26, h * 0.26);
  ctx.closePath();
  ctx.fill();

  // Inner ear detail
  ctx.fillStyle = '#999';
  ctx.beginPath();
  ctx.moveTo(w * 0.165, h * 0.24);
  ctx.bezierCurveTo(w * 0.14, h * 0.16, w * 0.155, h * 0.12, w * 0.17, h * 0.11);
  ctx.bezierCurveTo(w * 0.185, h * 0.13, w * 0.19, h * 0.19, w * 0.185, h * 0.24);
  ctx.closePath();
  ctx.fill();

  // Tail — long, thin, curving upward
  ctx.strokeStyle = '#aaa';
  ctx.lineCap = 'round';
  ctx.lineWidth = w * 0.018;
  ctx.beginPath();
  ctx.moveTo(w * 0.70, h * 0.40);
  ctx.bezierCurveTo(w * 0.78, h * 0.32, w * 0.86, h * 0.22, w * 0.94, h * 0.12);
  ctx.stroke();
  // Taper
  ctx.strokeStyle = '#777';
  ctx.lineWidth = w * 0.008;
  ctx.beginPath();
  ctx.moveTo(w * 0.90, h * 0.16);
  ctx.bezierCurveTo(w * 0.95, h * 0.10, w * 0.98, h * 0.06, w * 0.99, h * 0.04);
  ctx.stroke();

  // Front legs — bent, clawed
  drawLimb(ctx, w * 0.30, h * 0.58, w * 0.28, h * 0.68, w * 0.26, h * 0.78, w * 0.020, '#bbb');
  drawLimb(ctx, w * 0.35, h * 0.60, w * 0.34, h * 0.70, w * 0.32, h * 0.80, w * 0.018, '#aaa');
  // Claws
  for (const lx of [0.26, 0.32]) {
    ctx.fillStyle = '#ddd';
    ctx.beginPath();
    ctx.moveTo(w * lx, h * 0.80);
    ctx.lineTo(w * (lx - 0.015), h * 0.85);
    ctx.lineTo(w * (lx + 0.01), h * 0.84);
    ctx.lineTo(w * (lx + 0.02), h * 0.85);
    ctx.closePath();
    ctx.fill();
  }

  // Hind legs — thicker, powerful
  drawLimb(ctx, w * 0.55, h * 0.58, w * 0.54, h * 0.70, w * 0.50, h * 0.82, w * 0.024, '#bbb');
  drawLimb(ctx, w * 0.60, h * 0.56, w * 0.60, h * 0.68, w * 0.57, h * 0.80, w * 0.022, '#aaa');
  // Hind claws
  for (const lx of [0.50, 0.57]) {
    ctx.fillStyle = '#ddd';
    ctx.beginPath();
    ctx.moveTo(w * lx, h * 0.82);
    ctx.lineTo(w * (lx - 0.012), h * 0.87);
    ctx.lineTo(w * (lx + 0.008), h * 0.86);
    ctx.lineTo(w * (lx + 0.018), h * 0.87);
    ctx.closePath();
    ctx.fill();
  }

  // Whiskers
  ctx.strokeStyle = '#888';
  ctx.lineWidth = w * 0.004;
  ctx.beginPath();
  ctx.moveTo(w * 0.05, h * 0.39);
  ctx.lineTo(w * -0.02, h * 0.34);
  ctx.moveTo(w * 0.05, h * 0.41);
  ctx.lineTo(w * -0.02, h * 0.38);
  ctx.moveTo(w * 0.05, h * 0.43);
  ctx.lineTo(w * -0.02, h * 0.46);
  ctx.stroke();

  // Fur texture lines on back
  ctx.strokeStyle = '#888';
  ctx.lineWidth = w * 0.003;
  for (let i = 0; i < 6; i++) {
    const t = 0.30 + i * 0.06;
    ctx.beginPath();
    ctx.moveTo(w * t, h * 0.26);
    ctx.quadraticCurveTo(w * (t + 0.02), h * 0.24, w * (t + 0.04), h * 0.26);
    ctx.stroke();
  }
}

// ---------------------------------------------------------------------------
// 2. Fungal Shaman — L2, Mage
// 3/4 view: mushroom cap head, thin humanoid body, gnarled staff, spore cloud
// ---------------------------------------------------------------------------
function drawFungalShaman(ctx: CanvasRenderingContext2D, w: number, h: number) {
  // Staff — gnarled stick, held in right hand
  ctx.strokeStyle = '#999';
  ctx.lineWidth = w * 0.025;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(w * 0.70, h * 0.10);
  ctx.bezierCurveTo(w * 0.68, h * 0.30, w * 0.66, h * 0.55, w * 0.62, h * 0.90);
  ctx.stroke();
  // Staff knob
  ctx.fillStyle = '#ccc';
  fillCircle(ctx, w * 0.70, h * 0.08, w * 0.035);

  // Spore cloud around staff top
  ctx.fillStyle = 'rgba(180,180,180,0.15)';
  for (let i = 0; i < 5; i++) {
    const angle = (i / 5) * Math.PI * 2;
    fillCircle(ctx, w * 0.70 + Math.cos(angle) * w * 0.06, h * 0.08 + Math.sin(angle) * h * 0.05, w * 0.025);
  }

  // Body — thin, slight hunch
  ctx.fillStyle = bodyGrad(ctx, w * 0.40, h * 0.55, w * 0.12, '#ddd', '#bbb');
  ctx.beginPath();
  ctx.moveTo(w * 0.35, h * 0.35);
  ctx.bezierCurveTo(w * 0.30, h * 0.40, w * 0.28, h * 0.55, w * 0.30, h * 0.70);
  ctx.bezierCurveTo(w * 0.32, h * 0.78, w * 0.42, h * 0.80, w * 0.50, h * 0.78);
  ctx.bezierCurveTo(w * 0.55, h * 0.70, w * 0.52, h * 0.50, w * 0.48, h * 0.38);
  ctx.bezierCurveTo(w * 0.44, h * 0.34, w * 0.38, h * 0.33, w * 0.35, h * 0.35);
  ctx.fill();

  // Mushroom cap — large dome, distinctive feature
  ctx.fillStyle = bodyGrad(ctx, w * 0.38, h * 0.18, w * 0.22, '#fff', '#ddd');
  ctx.beginPath();
  ctx.moveTo(w * 0.18, h * 0.30);
  ctx.bezierCurveTo(w * 0.15, h * 0.20, w * 0.18, h * 0.08, w * 0.28, h * 0.04);
  ctx.bezierCurveTo(w * 0.38, h * 0.00, w * 0.50, h * 0.02, w * 0.58, h * 0.08);
  ctx.bezierCurveTo(w * 0.64, h * 0.14, w * 0.62, h * 0.26, w * 0.58, h * 0.30);
  ctx.bezierCurveTo(w * 0.50, h * 0.34, w * 0.26, h * 0.34, w * 0.18, h * 0.30);
  ctx.fill();

  // Cap spots
  ctx.fillStyle = '#aaa';
  fillCircle(ctx, w * 0.30, h * 0.14, w * 0.025);
  fillCircle(ctx, w * 0.42, h * 0.10, w * 0.03);
  fillCircle(ctx, w * 0.52, h * 0.16, w * 0.02);
  fillCircle(ctx, w * 0.36, h * 0.22, w * 0.018);

  // Gill lines under cap
  ctx.strokeStyle = '#888';
  ctx.lineWidth = w * 0.004;
  for (let i = 0; i < 10; i++) {
    const gx = w * (0.22 + i * 0.04);
    ctx.beginPath();
    ctx.moveTo(gx, h * 0.30);
    ctx.lineTo(gx + w * 0.003, h * 0.34);
    ctx.stroke();
  }

  // Face — small, shadowed under cap
  ctx.fillStyle = '#bbb';
  fillCircle(ctx, w * 0.34, h * 0.32, w * 0.015);
  fillCircle(ctx, w * 0.42, h * 0.32, w * 0.015);
  // Mouth slit
  ctx.strokeStyle = '#aaa';
  ctx.lineWidth = w * 0.005;
  ctx.beginPath();
  ctx.moveTo(w * 0.35, h * 0.36);
  ctx.lineTo(w * 0.41, h * 0.36);
  ctx.stroke();

  // Arms — left arm down, right arm extended toward staff
  drawLimb(ctx, w * 0.32, h * 0.45, w * 0.25, h * 0.55, w * 0.22, h * 0.65, w * 0.016, '#bbb');
  drawLimb(ctx, w * 0.48, h * 0.45, w * 0.56, h * 0.48, w * 0.64, h * 0.50, w * 0.016, '#bbb');
  // Fingers gripping staff
  ctx.fillStyle = '#ccc';
  fillCircle(ctx, w * 0.64, h * 0.50, w * 0.012);

  // Legs — thin, rooted feel
  drawLimb(ctx, w * 0.34, h * 0.76, w * 0.32, h * 0.85, w * 0.28, h * 0.94, w * 0.020, '#aaa');
  drawLimb(ctx, w * 0.44, h * 0.76, w * 0.46, h * 0.86, w * 0.44, h * 0.95, w * 0.020, '#aaa');
  // Feet — root-like
  ctx.strokeStyle = '#888';
  ctx.lineWidth = w * 0.008;
  ctx.beginPath();
  ctx.moveTo(w * 0.28, h * 0.94);
  ctx.lineTo(w * 0.22, h * 0.97);
  ctx.moveTo(w * 0.28, h * 0.94);
  ctx.lineTo(w * 0.30, h * 0.98);
  ctx.moveTo(w * 0.44, h * 0.95);
  ctx.lineTo(w * 0.40, h * 0.98);
  ctx.moveTo(w * 0.44, h * 0.95);
  ctx.lineTo(w * 0.48, h * 0.98);
  ctx.stroke();
}

// ---------------------------------------------------------------------------
// 3. Cavern Brute — L3, Warrior
// 3/4 view: gorilla-like, massive arms, broad hunched shoulders, small head
// ---------------------------------------------------------------------------
function drawCavernBrute(ctx: CanvasRenderingContext2D, w: number, h: number) {
  // Massive torso — hunched, broad shoulders
  ctx.fillStyle = bodyGrad(ctx, w * 0.42, h * 0.38, w * 0.26, '#eee', '#ccc');
  ctx.beginPath();
  ctx.moveTo(w * 0.25, h * 0.18);
  ctx.bezierCurveTo(w * 0.15, h * 0.22, w * 0.12, h * 0.35, w * 0.15, h * 0.55);
  ctx.bezierCurveTo(w * 0.18, h * 0.68, w * 0.30, h * 0.72, w * 0.42, h * 0.70);
  ctx.bezierCurveTo(w * 0.55, h * 0.72, w * 0.65, h * 0.68, w * 0.68, h * 0.55);
  ctx.bezierCurveTo(w * 0.70, h * 0.35, w * 0.65, h * 0.20, w * 0.55, h * 0.16);
  ctx.bezierCurveTo(w * 0.45, h * 0.14, w * 0.32, h * 0.15, w * 0.25, h * 0.18);
  ctx.fill();

  // Side light
  ctx.fillStyle = sideLight(ctx, w * 0.15, h * 0.20, w * 0.68, h * 0.55);
  ctx.fill();

  // Small head — jutting forward from hunched shoulders
  ctx.fillStyle = bodyGrad(ctx, w * 0.30, h * 0.12, w * 0.10);
  ctx.beginPath();
  ctx.moveTo(w * 0.25, h * 0.10);
  ctx.bezierCurveTo(w * 0.22, h * 0.06, w * 0.26, h * 0.02, w * 0.32, h * 0.02);
  ctx.bezierCurveTo(w * 0.38, h * 0.02, w * 0.40, h * 0.06, w * 0.38, h * 0.12);
  ctx.bezierCurveTo(w * 0.36, h * 0.16, w * 0.28, h * 0.16, w * 0.25, h * 0.10);
  ctx.fill();

  // Brow ridge — menacing
  ctx.fillStyle = '#bbb';
  ctx.beginPath();
  ctx.moveTo(w * 0.24, h * 0.06);
  ctx.bezierCurveTo(w * 0.28, h * 0.04, w * 0.36, h * 0.04, w * 0.38, h * 0.06);
  ctx.lineTo(w * 0.36, h * 0.08);
  ctx.bezierCurveTo(w * 0.32, h * 0.06, w * 0.28, h * 0.06, w * 0.26, h * 0.08);
  ctx.closePath();
  ctx.fill();

  // Eyes — deep set, glowing
  ctx.fillStyle = '#fff';
  fillCircle(ctx, w * 0.28, h * 0.08, w * 0.012);
  fillCircle(ctx, w * 0.34, h * 0.08, w * 0.012);

  // Jaw — heavy, underbite
  ctx.fillStyle = '#aaa';
  ctx.beginPath();
  ctx.moveTo(w * 0.24, h * 0.12);
  ctx.bezierCurveTo(w * 0.22, h * 0.15, w * 0.28, h * 0.18, w * 0.36, h * 0.16);
  ctx.lineTo(w * 0.34, h * 0.12);
  ctx.closePath();
  ctx.fill();
  // Tusks
  ctx.fillStyle = '#ddd';
  ctx.beginPath();
  ctx.moveTo(w * 0.25, h * 0.13);
  ctx.lineTo(w * 0.23, h * 0.08);
  ctx.lineTo(w * 0.27, h * 0.12);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(w * 0.33, h * 0.13);
  ctx.lineTo(w * 0.35, h * 0.08);
  ctx.lineTo(w * 0.31, h * 0.12);
  ctx.fill();

  // Massive left arm (near side, reaching forward/down)
  ctx.fillStyle = bodyGrad(ctx, w * 0.15, h * 0.50, w * 0.10, '#ddd', '#bbb');
  ctx.beginPath();
  ctx.moveTo(w * 0.18, h * 0.28);
  ctx.bezierCurveTo(w * 0.10, h * 0.35, w * 0.06, h * 0.50, w * 0.08, h * 0.65);
  ctx.bezierCurveTo(w * 0.10, h * 0.75, w * 0.15, h * 0.80, w * 0.18, h * 0.82);
  ctx.bezierCurveTo(w * 0.22, h * 0.80, w * 0.24, h * 0.70, w * 0.22, h * 0.55);
  ctx.bezierCurveTo(w * 0.21, h * 0.40, w * 0.22, h * 0.32, w * 0.18, h * 0.28);
  ctx.fill();

  // Massive right arm (far side)
  ctx.fillStyle = bodyGrad(ctx, w * 0.65, h * 0.50, w * 0.10, '#ccc', '#aaa');
  ctx.beginPath();
  ctx.moveTo(w * 0.62, h * 0.28);
  ctx.bezierCurveTo(w * 0.70, h * 0.35, w * 0.75, h * 0.50, w * 0.73, h * 0.65);
  ctx.bezierCurveTo(w * 0.72, h * 0.75, w * 0.68, h * 0.80, w * 0.65, h * 0.82);
  ctx.bezierCurveTo(w * 0.62, h * 0.78, w * 0.60, h * 0.65, w * 0.60, h * 0.50);
  ctx.bezierCurveTo(w * 0.60, h * 0.38, w * 0.60, h * 0.30, w * 0.62, h * 0.28);
  ctx.fill();

  // Fists — massive, knuckle-dragging
  ctx.fillStyle = '#ccc';
  fillEllipse(ctx, w * 0.14, h * 0.83, w * 0.05, h * 0.04);
  fillEllipse(ctx, w * 0.68, h * 0.83, w * 0.05, h * 0.04);

  // Short thick legs
  ctx.fillStyle = bodyGrad(ctx, w * 0.35, h * 0.80, w * 0.08, '#ccc', '#aaa');
  fillEllipse(ctx, w * 0.35, h * 0.82, w * 0.07, h * 0.10);
  ctx.fillStyle = bodyGrad(ctx, w * 0.50, h * 0.80, w * 0.08, '#bbb', '#999');
  fillEllipse(ctx, w * 0.50, h * 0.82, w * 0.07, h * 0.10);

  // Feet
  ctx.fillStyle = '#aaa';
  fillEllipse(ctx, w * 0.33, h * 0.92, w * 0.06, h * 0.03);
  fillEllipse(ctx, w * 0.52, h * 0.92, w * 0.06, h * 0.03);

  // Muscle detail lines on chest
  ctx.strokeStyle = '#888';
  ctx.lineWidth = w * 0.004;
  ctx.beginPath();
  ctx.moveTo(w * 0.35, h * 0.30);
  ctx.quadraticCurveTo(w * 0.40, h * 0.40, w * 0.38, h * 0.50);
  ctx.moveTo(w * 0.48, h * 0.30);
  ctx.quadraticCurveTo(w * 0.44, h * 0.40, w * 0.46, h * 0.50);
  ctx.stroke();
}

// ---------------------------------------------------------------------------
// 4. Crystal Elemental — L4, Mage
// Side view: angular crystalline body, sharp geometric facets, floating shards
// ---------------------------------------------------------------------------
function drawCrystalElemental(ctx: CanvasRenderingContext2D, w: number, h: number) {
  // Floating crystal shards around body
  ctx.fillStyle = '#666';
  for (const [sx, sy, sr] of [[0.15, 0.20, 0.02], [0.70, 0.15, 0.025], [0.75, 0.55, 0.02], [0.10, 0.60, 0.018]] as [number, number, number][]) {
    ctx.beginPath();
    ctx.moveTo(w * sx, h * (sy - sr * 2));
    ctx.lineTo(w * (sx + sr), h * sy);
    ctx.lineTo(w * sx, h * (sy + sr * 2));
    ctx.lineTo(w * (sx - sr), h * sy);
    ctx.closePath();
    ctx.fill();
  }

  // Main crystal body — large angular diamond shape
  const grad = ctx.createLinearGradient(w * 0.25, h * 0.15, w * 0.65, h * 0.75);
  grad.addColorStop(0, '#fff');
  grad.addColorStop(0.3, '#ddd');
  grad.addColorStop(0.6, '#aaa');
  grad.addColorStop(1, '#555');
  ctx.fillStyle = grad;

  ctx.beginPath();
  ctx.moveTo(w * 0.42, h * 0.08);  // top point
  ctx.lineTo(w * 0.58, h * 0.18);  // upper right
  ctx.lineTo(w * 0.65, h * 0.40);  // right
  ctx.lineTo(w * 0.60, h * 0.65);  // lower right
  ctx.lineTo(w * 0.45, h * 0.80);  // bottom point
  ctx.lineTo(w * 0.30, h * 0.68);  // lower left
  ctx.lineTo(w * 0.22, h * 0.42);  // left
  ctx.lineTo(w * 0.28, h * 0.20);  // upper left
  ctx.closePath();
  ctx.fill();

  // Internal facet lines — creates crystalline structure
  ctx.strokeStyle = '#bbb';
  ctx.lineWidth = w * 0.005;
  ctx.beginPath();
  // Main vertical facet
  ctx.moveTo(w * 0.42, h * 0.08);
  ctx.lineTo(w * 0.44, h * 0.45);
  ctx.lineTo(w * 0.45, h * 0.80);
  // Cross facets
  ctx.moveTo(w * 0.28, h * 0.20);
  ctx.lineTo(w * 0.44, h * 0.45);
  ctx.lineTo(w * 0.65, h * 0.40);
  ctx.moveTo(w * 0.22, h * 0.42);
  ctx.lineTo(w * 0.44, h * 0.45);
  ctx.lineTo(w * 0.58, h * 0.18);
  ctx.moveTo(w * 0.30, h * 0.68);
  ctx.lineTo(w * 0.44, h * 0.45);
  ctx.lineTo(w * 0.60, h * 0.65);
  ctx.stroke();

  // Bright core glow
  ctx.fillStyle = bodyGrad(ctx, w * 0.44, h * 0.40, w * 0.10, '#fff', '#eee');
  fillCircle(ctx, w * 0.44, h * 0.40, w * 0.08);

  // Eye — central glowing point
  ctx.fillStyle = '#fff';
  fillCircle(ctx, w * 0.44, h * 0.35, w * 0.02);

  // Lower shard extensions (legs)
  ctx.fillStyle = '#aaa';
  ctx.beginPath();
  ctx.moveTo(w * 0.35, h * 0.75);
  ctx.lineTo(w * 0.30, h * 0.92);
  ctx.lineTo(w * 0.38, h * 0.82);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(w * 0.50, h * 0.75);
  ctx.lineTo(w * 0.55, h * 0.92);
  ctx.lineTo(w * 0.48, h * 0.82);
  ctx.closePath();
  ctx.fill();

  // Upper spike extensions
  ctx.fillStyle = '#ccc';
  ctx.beginPath();
  ctx.moveTo(w * 0.38, h * 0.12);
  ctx.lineTo(w * 0.32, h * 0.02);
  ctx.lineTo(w * 0.40, h * 0.10);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(w * 0.52, h * 0.14);
  ctx.lineTo(w * 0.60, h * 0.04);
  ctx.lineTo(w * 0.55, h * 0.14);
  ctx.closePath();
  ctx.fill();
}

// ---------------------------------------------------------------------------
// 5. Ironhide Troll — L5, Warrior
// 3/4 side view: hulking, hunched, long arms, thick hide, angry face
// ---------------------------------------------------------------------------
function drawIronhideTroll(ctx: CanvasRenderingContext2D, w: number, h: number) {
  // Massive torso — heavily hunched
  ctx.fillStyle = bodyGrad(ctx, w * 0.40, h * 0.40, w * 0.25, '#ddd', '#bbb');
  ctx.beginPath();
  ctx.moveTo(w * 0.30, h * 0.15);
  ctx.bezierCurveTo(w * 0.20, h * 0.18, w * 0.14, h * 0.30, w * 0.16, h * 0.50);
  ctx.bezierCurveTo(w * 0.18, h * 0.62, w * 0.28, h * 0.68, w * 0.40, h * 0.68);
  ctx.bezierCurveTo(w * 0.55, h * 0.68, w * 0.65, h * 0.62, w * 0.66, h * 0.48);
  ctx.bezierCurveTo(w * 0.68, h * 0.30, w * 0.60, h * 0.16, w * 0.48, h * 0.13);
  ctx.bezierCurveTo(w * 0.40, h * 0.12, w * 0.34, h * 0.13, w * 0.30, h * 0.15);
  ctx.fill();

  // Hunch/shoulder mass
  ctx.fillStyle = bodyGrad(ctx, w * 0.45, h * 0.18, w * 0.18, '#eee', '#ccc');
  fillEllipse(ctx, w * 0.45, h * 0.18, w * 0.18, h * 0.10);

  // Head — small, forward-jutting
  ctx.fillStyle = bodyGrad(ctx, w * 0.25, h * 0.08, w * 0.08, '#ddd', '#bbb');
  ctx.beginPath();
  ctx.moveTo(w * 0.22, h * 0.04);
  ctx.bezierCurveTo(w * 0.18, h * 0.02, w * 0.15, h * 0.05, w * 0.15, h * 0.10);
  ctx.bezierCurveTo(w * 0.15, h * 0.15, w * 0.20, h * 0.18, w * 0.26, h * 0.16);
  ctx.bezierCurveTo(w * 0.32, h * 0.14, w * 0.33, h * 0.08, w * 0.30, h * 0.04);
  ctx.bezierCurveTo(w * 0.27, h * 0.02, w * 0.24, h * 0.02, w * 0.22, h * 0.04);
  ctx.fill();

  // Eyes — angry, deep set
  ctx.fillStyle = '#fff';
  fillCircle(ctx, w * 0.20, h * 0.08, w * 0.010);
  fillCircle(ctx, w * 0.26, h * 0.08, w * 0.010);

  // Jaw / mouth — wide, tusks
  ctx.fillStyle = '#aaa';
  ctx.beginPath();
  ctx.moveTo(w * 0.16, h * 0.12);
  ctx.bezierCurveTo(w * 0.14, h * 0.16, w * 0.22, h * 0.20, w * 0.30, h * 0.16);
  ctx.lineTo(w * 0.28, h * 0.12);
  ctx.closePath();
  ctx.fill();
  // Tusks
  ctx.fillStyle = '#eee';
  ctx.beginPath();
  ctx.moveTo(w * 0.17, h * 0.14);
  ctx.lineTo(w * 0.15, h * 0.06);
  ctx.lineTo(w * 0.19, h * 0.12);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(w * 0.27, h * 0.14);
  ctx.lineTo(w * 0.29, h * 0.06);
  ctx.lineTo(w * 0.25, h * 0.12);
  ctx.fill();

  // Left arm — massive, reaching down/forward
  ctx.fillStyle = bodyGrad(ctx, w * 0.12, h * 0.45, w * 0.10, '#ddd', '#bbb');
  ctx.beginPath();
  ctx.moveTo(w * 0.18, h * 0.25);
  ctx.bezierCurveTo(w * 0.10, h * 0.30, w * 0.04, h * 0.50, w * 0.06, h * 0.68);
  ctx.bezierCurveTo(w * 0.08, h * 0.78, w * 0.14, h * 0.82, w * 0.18, h * 0.80);
  ctx.bezierCurveTo(w * 0.22, h * 0.75, w * 0.20, h * 0.55, w * 0.22, h * 0.40);
  ctx.closePath();
  ctx.fill();

  // Right arm (far side)
  ctx.fillStyle = bodyGrad(ctx, w * 0.68, h * 0.45, w * 0.08, '#ccc', '#999');
  ctx.beginPath();
  ctx.moveTo(w * 0.62, h * 0.25);
  ctx.bezierCurveTo(w * 0.72, h * 0.35, w * 0.76, h * 0.50, w * 0.74, h * 0.65);
  ctx.bezierCurveTo(w * 0.73, h * 0.75, w * 0.68, h * 0.78, w * 0.65, h * 0.76);
  ctx.bezierCurveTo(w * 0.62, h * 0.70, w * 0.62, h * 0.50, w * 0.62, h * 0.35);
  ctx.closePath();
  ctx.fill();

  // Clawed hands
  ctx.fillStyle = '#ddd';
  for (const [hx, hy] of [[0.10, 0.82], [0.68, 0.78]] as [number, number][]) {
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(w * (hx + i * 0.02), h * hy);
      ctx.lineTo(w * (hx + i * 0.02 - 0.01), h * (hy + 0.05));
      ctx.lineTo(w * (hx + i * 0.02 + 0.01), h * (hy + 0.03));
      ctx.fill();
    }
  }

  // Legs — short, thick, bowed
  ctx.fillStyle = bodyGrad(ctx, w * 0.32, h * 0.78, w * 0.08, '#ccc', '#aaa');
  fillEllipse(ctx, w * 0.32, h * 0.78, w * 0.07, h * 0.12);
  ctx.fillStyle = bodyGrad(ctx, w * 0.52, h * 0.78, w * 0.08, '#bbb', '#999');
  fillEllipse(ctx, w * 0.52, h * 0.78, w * 0.07, h * 0.12);

  // Feet — wide, clawed
  ctx.fillStyle = '#aaa';
  fillEllipse(ctx, w * 0.30, h * 0.92, w * 0.06, h * 0.025);
  fillEllipse(ctx, w * 0.54, h * 0.92, w * 0.06, h * 0.025);

  // Hide/plate texture
  ctx.strokeStyle = '#777';
  ctx.lineWidth = w * 0.004;
  for (let i = 0; i < 5; i++) {
    const ty = 0.25 + i * 0.08;
    ctx.beginPath();
    ctx.moveTo(w * 0.25, h * ty);
    ctx.quadraticCurveTo(w * 0.40, h * (ty + 0.02), w * 0.58, h * ty);
    ctx.stroke();
  }
}

// ---------------------------------------------------------------------------
// 6. Phase Spider — L6, Rogue
// Side/3/4 view: large abdomen, thorax, 8 legs radiating, fangs
// ---------------------------------------------------------------------------
function drawPhaseSpider(ctx: CanvasRenderingContext2D, w: number, h: number) {
  // Far-side legs (drawn first, behind body)
  const farLegColor = '#888';
  const farLegs: [number, number, number, number, number, number][] = [
    [0.42, 0.38, 0.52, 0.22, 0.62, 0.08],   // far front
    [0.48, 0.40, 0.60, 0.30, 0.72, 0.18],   // far mid-front
    [0.52, 0.44, 0.64, 0.50, 0.76, 0.62],   // far mid-back
    [0.50, 0.48, 0.58, 0.62, 0.68, 0.78],   // far back
  ];
  ctx.strokeStyle = farLegColor;
  ctx.lineWidth = w * 0.012;
  ctx.lineCap = 'round';
  for (const [x0, y0, cx, cy, x1, y1] of farLegs) {
    ctx.beginPath();
    ctx.moveTo(w * x0, h * y0);
    ctx.quadraticCurveTo(w * cx, h * cy, w * x1, h * y1);
    ctx.stroke();
  }

  // Abdomen — large, round, rear
  ctx.fillStyle = bodyGrad(ctx, w * 0.58, h * 0.45, w * 0.18, '#ddd', '#bbb');
  ctx.beginPath();
  ctx.moveTo(w * 0.45, h * 0.32);
  ctx.bezierCurveTo(w * 0.50, h * 0.24, w * 0.68, h * 0.24, w * 0.75, h * 0.35);
  ctx.bezierCurveTo(w * 0.80, h * 0.45, w * 0.78, h * 0.58, w * 0.72, h * 0.62);
  ctx.bezierCurveTo(w * 0.65, h * 0.66, w * 0.50, h * 0.64, w * 0.44, h * 0.55);
  ctx.bezierCurveTo(w * 0.40, h * 0.45, w * 0.42, h * 0.36, w * 0.45, h * 0.32);
  ctx.fill();

  // Abdomen pattern (hourglass marking)
  ctx.fillStyle = '#999';
  ctx.beginPath();
  ctx.moveTo(w * 0.58, h * 0.36);
  ctx.lineTo(w * 0.62, h * 0.44);
  ctx.lineTo(w * 0.58, h * 0.52);
  ctx.lineTo(w * 0.54, h * 0.44);
  ctx.closePath();
  ctx.fill();

  // Thorax — smaller, front
  ctx.fillStyle = bodyGrad(ctx, w * 0.32, h * 0.40, w * 0.10, '#eee', '#ccc');
  fillEllipse(ctx, w * 0.32, h * 0.40, w * 0.10, h * 0.08);

  // Head — small, with fangs
  ctx.fillStyle = bodyGrad(ctx, w * 0.20, h * 0.38, w * 0.06, '#eee', '#ccc');
  fillEllipse(ctx, w * 0.20, h * 0.38, w * 0.06, h * 0.05);

  // Eyes — cluster of 8 (simplified as 4 visible)
  ctx.fillStyle = '#fff';
  fillCircle(ctx, w * 0.16, h * 0.35, w * 0.008);
  fillCircle(ctx, w * 0.18, h * 0.34, w * 0.010);
  fillCircle(ctx, w * 0.17, h * 0.37, w * 0.007);
  fillCircle(ctx, w * 0.19, h * 0.36, w * 0.009);

  // Chelicerae / Fangs — distinctive
  ctx.fillStyle = '#ddd';
  ctx.beginPath();
  ctx.moveTo(w * 0.15, h * 0.38);
  ctx.bezierCurveTo(w * 0.12, h * 0.40, w * 0.10, h * 0.46, w * 0.11, h * 0.50);
  ctx.lineTo(w * 0.13, h * 0.48);
  ctx.bezierCurveTo(w * 0.13, h * 0.44, w * 0.14, h * 0.40, w * 0.16, h * 0.39);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(w * 0.16, h * 0.40);
  ctx.bezierCurveTo(w * 0.14, h * 0.44, w * 0.13, h * 0.50, w * 0.14, h * 0.53);
  ctx.lineTo(w * 0.16, h * 0.50);
  ctx.bezierCurveTo(w * 0.16, h * 0.46, w * 0.17, h * 0.42, w * 0.18, h * 0.41);
  ctx.closePath();
  ctx.fill();

  // Pedipalps — small feelers
  ctx.strokeStyle = '#bbb';
  ctx.lineWidth = w * 0.006;
  ctx.beginPath();
  ctx.moveTo(w * 0.16, h * 0.36);
  ctx.quadraticCurveTo(w * 0.10, h * 0.32, w * 0.08, h * 0.30);
  ctx.moveTo(w * 0.17, h * 0.37);
  ctx.quadraticCurveTo(w * 0.12, h * 0.35, w * 0.09, h * 0.34);
  ctx.stroke();

  // Near-side legs (drawn on top of body)
  const nearLegColor = '#bbb';
  const nearLegs: [number, number, number, number, number, number][] = [
    [0.28, 0.46, 0.18, 0.30, 0.08, 0.14],   // front
    [0.32, 0.48, 0.22, 0.40, 0.10, 0.28],   // mid-front
    [0.42, 0.52, 0.32, 0.64, 0.20, 0.78],   // mid-back
    [0.44, 0.55, 0.40, 0.70, 0.34, 0.88],   // back
  ];
  ctx.strokeStyle = nearLegColor;
  ctx.lineWidth = w * 0.015;
  for (const [x0, y0, cx, cy, x1, y1] of nearLegs) {
    ctx.beginPath();
    ctx.moveTo(w * x0, h * y0);
    ctx.quadraticCurveTo(w * cx, h * cy, w * x1, h * y1);
    ctx.stroke();
  }

  // Leg tips (tarsi) — small
  ctx.fillStyle = '#ccc';
  for (const [,,,, x1, y1] of nearLegs) {
    fillCircle(ctx, w * x1, h * y1, w * 0.008);
  }

  // Spinnerets — silk thread trailing
  ctx.strokeStyle = '#555';
  ctx.lineWidth = w * 0.003;
  ctx.beginPath();
  ctx.moveTo(w * 0.76, h * 0.55);
  ctx.bezierCurveTo(w * 0.82, h * 0.58, w * 0.88, h * 0.62, w * 0.95, h * 0.68);
  ctx.stroke();
}

// ---------------------------------------------------------------------------
// 7. Bonecaster — L7, Mage
// Side view: skeletal robed figure, skull head, staff with floating bone
// ---------------------------------------------------------------------------
function drawBonecaster(ctx: CanvasRenderingContext2D, w: number, h: number) {
  // Robe — flowing, tattered bottom
  ctx.fillStyle = bodyGrad(ctx, w * 0.40, h * 0.55, w * 0.18, '#ccc', '#aaa');
  ctx.beginPath();
  ctx.moveTo(w * 0.30, h * 0.28);
  ctx.bezierCurveTo(w * 0.24, h * 0.35, w * 0.20, h * 0.55, w * 0.18, h * 0.75);
  ctx.bezierCurveTo(w * 0.16, h * 0.85, w * 0.15, h * 0.92, w * 0.12, h * 0.98);
  ctx.lineTo(w * 0.22, h * 0.95);
  ctx.lineTo(w * 0.28, h * 0.98);
  ctx.lineTo(w * 0.35, h * 0.94);
  ctx.lineTo(w * 0.42, h * 0.98);
  ctx.lineTo(w * 0.48, h * 0.93);
  ctx.lineTo(w * 0.55, h * 0.97);
  ctx.lineTo(w * 0.60, h * 0.92);
  ctx.bezierCurveTo(w * 0.62, h * 0.80, w * 0.60, h * 0.60, w * 0.55, h * 0.40);
  ctx.bezierCurveTo(w * 0.52, h * 0.32, w * 0.45, h * 0.26, w * 0.38, h * 0.26);
  ctx.closePath();
  ctx.fill();

  // Side light on robe
  ctx.fillStyle = sideLight(ctx, w * 0.20, h * 0.30, w * 0.60, h * 0.70);
  ctx.fill();

  // Hood
  ctx.fillStyle = bodyGrad(ctx, w * 0.35, h * 0.18, w * 0.12, '#ddd', '#aaa');
  ctx.beginPath();
  ctx.moveTo(w * 0.28, h * 0.28);
  ctx.bezierCurveTo(w * 0.22, h * 0.22, w * 0.22, h * 0.10, w * 0.30, h * 0.05);
  ctx.bezierCurveTo(w * 0.38, h * 0.01, w * 0.48, h * 0.04, w * 0.50, h * 0.12);
  ctx.bezierCurveTo(w * 0.52, h * 0.20, w * 0.48, h * 0.28, w * 0.42, h * 0.30);
  ctx.closePath();
  ctx.fill();

  // Skull face inside hood — visible features
  ctx.fillStyle = '#eee';
  // Eye sockets
  fillCircle(ctx, w * 0.32, h * 0.16, w * 0.018);
  fillCircle(ctx, w * 0.40, h * 0.16, w * 0.018);
  // Dark eye interiors
  ctx.fillStyle = '#222';
  fillCircle(ctx, w * 0.32, h * 0.16, w * 0.010);
  fillCircle(ctx, w * 0.40, h * 0.16, w * 0.010);
  // Glowing pupils
  ctx.fillStyle = '#fff';
  fillCircle(ctx, w * 0.32, h * 0.16, w * 0.005);
  fillCircle(ctx, w * 0.40, h * 0.16, w * 0.005);
  // Nasal cavity
  ctx.fillStyle = '#bbb';
  ctx.beginPath();
  ctx.moveTo(w * 0.35, h * 0.19);
  ctx.lineTo(w * 0.37, h * 0.22);
  ctx.lineTo(w * 0.36, h * 0.19);
  ctx.fill();
  // Jaw — skeletal grin
  ctx.strokeStyle = '#ccc';
  ctx.lineWidth = w * 0.004;
  ctx.beginPath();
  ctx.moveTo(w * 0.30, h * 0.22);
  ctx.bezierCurveTo(w * 0.34, h * 0.24, w * 0.38, h * 0.24, w * 0.42, h * 0.22);
  ctx.stroke();
  // Teeth
  for (let i = 0; i < 5; i++) {
    const tx = 0.31 + i * 0.025;
    ctx.strokeStyle = '#ddd';
    ctx.lineWidth = w * 0.003;
    ctx.beginPath();
    ctx.moveTo(w * tx, h * 0.22);
    ctx.lineTo(w * tx, h * 0.24);
    ctx.stroke();
  }

  // Staff — bone staff with skull topper
  ctx.strokeStyle = '#bbb';
  ctx.lineWidth = w * 0.018;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(w * 0.72, h * 0.06);
  ctx.bezierCurveTo(w * 0.70, h * 0.30, w * 0.68, h * 0.60, w * 0.65, h * 0.90);
  ctx.stroke();

  // Staff skull topper
  ctx.fillStyle = '#eee';
  fillCircle(ctx, w * 0.72, h * 0.06, w * 0.035);
  ctx.fillStyle = '#222';
  fillCircle(ctx, w * 0.70, h * 0.05, w * 0.008);
  fillCircle(ctx, w * 0.74, h * 0.05, w * 0.008);
  ctx.fillStyle = '#fff';
  fillCircle(ctx, w * 0.70, h * 0.05, w * 0.004);
  fillCircle(ctx, w * 0.74, h * 0.05, w * 0.004);

  // Floating bone orbiting staff
  ctx.fillStyle = '#aaa';
  fillEllipse(ctx, w * 0.78, h * 0.12, w * 0.025, h * 0.008);
  fillEllipse(ctx, w * 0.66, h * 0.14, w * 0.02, h * 0.007);

  // Skeletal hand extended (casting)
  ctx.fillStyle = '#ddd';
  ctx.beginPath();
  ctx.moveTo(w * 0.28, h * 0.38);
  ctx.lineTo(w * 0.18, h * 0.42);
  ctx.lineTo(w * 0.12, h * 0.38);
  ctx.moveTo(w * 0.18, h * 0.42);
  ctx.lineTo(w * 0.10, h * 0.42);
  ctx.moveTo(w * 0.18, h * 0.42);
  ctx.lineTo(w * 0.12, h * 0.46);
  ctx.stroke();

  // Right hand gripping staff
  drawLimb(ctx, w * 0.48, h * 0.38, w * 0.58, h * 0.40, w * 0.68, h * 0.38, w * 0.012, '#bbb');
}

// ---------------------------------------------------------------------------
// 8. Rock Golem — L8, Warrior
// 3/4 view: massive stone humanoid, chunky angular, cracks, mossy
// ---------------------------------------------------------------------------
function drawRockGolem(ctx: CanvasRenderingContext2D, w: number, h: number) {
  // Massive torso — rectangular, stone
  ctx.fillStyle = bodyGrad(ctx, w * 0.42, h * 0.35, w * 0.25, '#ddd', '#bbb');
  ctx.beginPath();
  ctx.moveTo(w * 0.22, h * 0.12);
  ctx.lineTo(w * 0.62, h * 0.12);
  ctx.bezierCurveTo(w * 0.68, h * 0.14, w * 0.70, h * 0.25, w * 0.70, h * 0.40);
  ctx.bezierCurveTo(w * 0.70, h * 0.55, w * 0.65, h * 0.62, w * 0.58, h * 0.65);
  ctx.lineTo(w * 0.28, h * 0.65);
  ctx.bezierCurveTo(w * 0.20, h * 0.62, w * 0.16, h * 0.55, w * 0.16, h * 0.40);
  ctx.bezierCurveTo(w * 0.16, h * 0.25, w * 0.18, h * 0.14, w * 0.22, h * 0.12);
  ctx.fill();

  // Side light
  ctx.fillStyle = sideLight(ctx, w * 0.16, h * 0.12, w * 0.70, h * 0.55);
  ctx.fill();

  // Head — angular, flat-topped
  ctx.fillStyle = bodyGrad(ctx, w * 0.40, h * 0.06, w * 0.12, '#eee', '#ccc');
  ctx.beginPath();
  ctx.moveTo(w * 0.30, h * 0.12);
  ctx.lineTo(w * 0.28, h * 0.04);
  ctx.lineTo(w * 0.34, h * 0.00);
  ctx.lineTo(w * 0.50, h * 0.00);
  ctx.lineTo(w * 0.56, h * 0.04);
  ctx.lineTo(w * 0.54, h * 0.12);
  ctx.closePath();
  ctx.fill();

  // Eyes — glowing slits in stone
  ctx.fillStyle = '#fff';
  ctx.fillRect(w * 0.34, h * 0.05, w * 0.05, h * 0.02);
  ctx.fillRect(w * 0.45, h * 0.05, w * 0.05, h * 0.02);

  // Jaw line
  ctx.strokeStyle = '#999';
  ctx.lineWidth = w * 0.005;
  ctx.beginPath();
  ctx.moveTo(w * 0.32, h * 0.10);
  ctx.lineTo(w * 0.42, h * 0.12);
  ctx.lineTo(w * 0.52, h * 0.10);
  ctx.stroke();

  // Massive left arm — blocky
  ctx.fillStyle = bodyGrad(ctx, w * 0.10, h * 0.40, w * 0.10, '#ddd', '#aaa');
  ctx.beginPath();
  ctx.moveTo(w * 0.18, h * 0.18);
  ctx.lineTo(w * 0.08, h * 0.22);
  ctx.lineTo(w * 0.04, h * 0.45);
  ctx.lineTo(w * 0.02, h * 0.68);
  ctx.lineTo(w * 0.08, h * 0.72);
  ctx.lineTo(w * 0.14, h * 0.70);
  ctx.lineTo(w * 0.16, h * 0.50);
  ctx.lineTo(w * 0.18, h * 0.35);
  ctx.closePath();
  ctx.fill();

  // Massive right arm (far side, darker)
  ctx.fillStyle = bodyGrad(ctx, w * 0.72, h * 0.40, w * 0.08, '#bbb', '#888');
  ctx.beginPath();
  ctx.moveTo(w * 0.66, h * 0.18);
  ctx.lineTo(w * 0.74, h * 0.22);
  ctx.lineTo(w * 0.78, h * 0.45);
  ctx.lineTo(w * 0.80, h * 0.68);
  ctx.lineTo(w * 0.76, h * 0.72);
  ctx.lineTo(w * 0.70, h * 0.70);
  ctx.lineTo(w * 0.68, h * 0.50);
  ctx.lineTo(w * 0.66, h * 0.35);
  ctx.closePath();
  ctx.fill();

  // Fists — boulder-like
  ctx.fillStyle = '#ccc';
  fillEllipse(ctx, w * 0.06, h * 0.72, w * 0.05, h * 0.04);
  fillEllipse(ctx, w * 0.78, h * 0.72, w * 0.04, h * 0.035);

  // Legs — thick columns
  ctx.fillStyle = bodyGrad(ctx, w * 0.34, h * 0.78, w * 0.08, '#ccc', '#999');
  ctx.fillRect(w * 0.28, h * 0.64, w * 0.12, h * 0.24);
  ctx.fillStyle = bodyGrad(ctx, w * 0.52, h * 0.78, w * 0.08, '#bbb', '#888');
  ctx.fillRect(w * 0.46, h * 0.64, w * 0.12, h * 0.24);

  // Feet — wide stone blocks
  ctx.fillStyle = '#aaa';
  ctx.fillRect(w * 0.24, h * 0.88, w * 0.18, h * 0.06);
  ctx.fillRect(w * 0.44, h * 0.88, w * 0.18, h * 0.06);

  // Crack details in stone
  ctx.strokeStyle = '#777';
  ctx.lineWidth = w * 0.004;
  ctx.beginPath();
  ctx.moveTo(w * 0.35, h * 0.20);
  ctx.lineTo(w * 0.38, h * 0.30);
  ctx.lineTo(w * 0.35, h * 0.42);
  ctx.moveTo(w * 0.50, h * 0.18);
  ctx.lineTo(w * 0.48, h * 0.28);
  ctx.lineTo(w * 0.52, h * 0.38);
  ctx.moveTo(w * 0.28, h * 0.35);
  ctx.lineTo(w * 0.42, h * 0.38);
  ctx.moveTo(w * 0.44, h * 0.42);
  ctx.lineTo(w * 0.58, h * 0.40);
  ctx.stroke();

  // Moss/lichen spots
  ctx.fillStyle = '#666';
  fillCircle(ctx, w * 0.26, h * 0.28, w * 0.015);
  fillCircle(ctx, w * 0.55, h * 0.48, w * 0.012);
  fillCircle(ctx, w * 0.38, h * 0.58, w * 0.010);
}

// ---------------------------------------------------------------------------
// 9. Pale Stalker — L9, Rogue
// Side view: lean, elongated, ghostly predator, long limbs, hunched
// ---------------------------------------------------------------------------
function drawPaleStalker(ctx: CanvasRenderingContext2D, w: number, h: number) {
  // Lean torso — elongated, hunched forward
  ctx.fillStyle = bodyGrad(ctx, w * 0.40, h * 0.38, w * 0.14, '#eee', '#ccc');
  ctx.beginPath();
  ctx.moveTo(w * 0.30, h * 0.22);
  ctx.bezierCurveTo(w * 0.25, h * 0.25, w * 0.22, h * 0.35, w * 0.24, h * 0.50);
  ctx.bezierCurveTo(w * 0.26, h * 0.58, w * 0.36, h * 0.60, w * 0.46, h * 0.58);
  ctx.bezierCurveTo(w * 0.54, h * 0.55, w * 0.56, h * 0.42, w * 0.52, h * 0.30);
  ctx.bezierCurveTo(w * 0.48, h * 0.24, w * 0.38, h * 0.20, w * 0.30, h * 0.22);
  ctx.fill();

  // Head — elongated skull, predatory
  ctx.fillStyle = bodyGrad(ctx, w * 0.20, h * 0.18, w * 0.10, '#fff', '#ddd');
  ctx.beginPath();
  ctx.moveTo(w * 0.26, h * 0.16);
  ctx.bezierCurveTo(w * 0.20, h * 0.12, w * 0.12, h * 0.14, w * 0.08, h * 0.18);
  ctx.bezierCurveTo(w * 0.05, h * 0.20, w * 0.06, h * 0.25, w * 0.10, h * 0.27);
  ctx.bezierCurveTo(w * 0.16, h * 0.28, w * 0.24, h * 0.26, w * 0.28, h * 0.22);
  ctx.closePath();
  ctx.fill();

  // Jaw — long, filled with teeth
  ctx.fillStyle = '#ccc';
  ctx.beginPath();
  ctx.moveTo(w * 0.08, h * 0.22);
  ctx.bezierCurveTo(w * 0.04, h * 0.24, w * 0.03, h * 0.28, w * 0.06, h * 0.30);
  ctx.bezierCurveTo(w * 0.12, h * 0.32, w * 0.20, h * 0.30, w * 0.24, h * 0.26);
  ctx.closePath();
  ctx.fill();
  // Teeth
  ctx.fillStyle = '#eee';
  for (let i = 0; i < 6; i++) {
    const tx = 0.07 + i * 0.025;
    ctx.beginPath();
    ctx.moveTo(w * tx, h * 0.25);
    ctx.lineTo(w * (tx + 0.005), h * 0.28);
    ctx.lineTo(w * (tx + 0.01), h * 0.25);
    ctx.fill();
  }

  // Eyes — narrow, glowing
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.moveTo(w * 0.12, h * 0.17);
  ctx.lineTo(w * 0.16, h * 0.16);
  ctx.lineTo(w * 0.15, h * 0.18);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(w * 0.18, h * 0.17);
  ctx.lineTo(w * 0.22, h * 0.16);
  ctx.lineTo(w * 0.21, h * 0.18);
  ctx.closePath();
  ctx.fill();

  // Long arms — unnaturally long, clawed
  drawLimb(ctx, w * 0.28, h * 0.40, w * 0.20, h * 0.55, w * 0.14, h * 0.72, w * 0.014, '#ccc');
  drawLimb(ctx, w * 0.48, h * 0.38, w * 0.56, h * 0.52, w * 0.62, h * 0.68, w * 0.012, '#aaa');

  // Long claws
  ctx.fillStyle = '#eee';
  for (const [cx, cy, dir] of [[0.14, 0.72, -1], [0.62, 0.68, 1]] as [number, number, number][]) {
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.moveTo(w * cx, h * cy);
      ctx.lineTo(w * (cx + dir * (0.015 + i * 0.008)), h * (cy + 0.05 + i * 0.01));
      ctx.lineTo(w * (cx + dir * (i * 0.006)), h * (cy + 0.02));
      ctx.fill();
    }
  }

  // Legs — digitigrade (backward-bent knee), predator stance
  ctx.strokeStyle = '#bbb';
  ctx.lineWidth = w * 0.016;
  ctx.lineCap = 'round';
  // Left leg
  ctx.beginPath();
  ctx.moveTo(w * 0.32, h * 0.56);
  ctx.quadraticCurveTo(w * 0.28, h * 0.68, w * 0.32, h * 0.76);
  ctx.quadraticCurveTo(w * 0.34, h * 0.84, w * 0.28, h * 0.92);
  ctx.stroke();
  // Right leg
  ctx.strokeStyle = '#aaa';
  ctx.lineWidth = w * 0.014;
  ctx.beginPath();
  ctx.moveTo(w * 0.44, h * 0.56);
  ctx.quadraticCurveTo(w * 0.48, h * 0.68, w * 0.46, h * 0.76);
  ctx.quadraticCurveTo(w * 0.45, h * 0.84, w * 0.50, h * 0.92);
  ctx.stroke();

  // Clawed feet
  ctx.fillStyle = '#ccc';
  for (const fx of [0.28, 0.50]) {
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(w * fx, h * 0.92);
      ctx.lineTo(w * (fx - 0.015 + i * 0.015), h * 0.97);
      ctx.lineTo(w * (fx - 0.005 + i * 0.015), h * 0.94);
      ctx.fill();
    }
  }

  // Ribs visible through skin
  ctx.strokeStyle = '#999';
  ctx.lineWidth = w * 0.003;
  for (let i = 0; i < 5; i++) {
    const ry = 0.32 + i * 0.05;
    ctx.beginPath();
    ctx.moveTo(w * 0.28, h * ry);
    ctx.quadraticCurveTo(w * 0.38, h * (ry + 0.01), w * 0.48, h * ry);
    ctx.stroke();
  }

  // Wispy trailing energy
  ctx.strokeStyle = 'rgba(180,180,180,0.3)';
  ctx.lineWidth = w * 0.004;
  ctx.beginPath();
  ctx.moveTo(w * 0.50, h * 0.40);
  ctx.bezierCurveTo(w * 0.60, h * 0.38, w * 0.70, h * 0.42, w * 0.80, h * 0.36);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(w * 0.52, h * 0.48);
  ctx.bezierCurveTo(w * 0.62, h * 0.50, w * 0.72, h * 0.46, w * 0.82, h * 0.50);
  ctx.stroke();
}

// ---------------------------------------------------------------------------
// 10. Dusk Drake — L10, Mage
// Side view: winged drake, serpentine neck, spread wings, powerful tail
// ---------------------------------------------------------------------------
function drawDuskDrake(ctx: CanvasRenderingContext2D, w: number, h: number) {
  // Tail — thick, trailing left
  ctx.fillStyle = bodyGrad(ctx, w * 0.78, h * 0.55, w * 0.10, '#bbb', '#999');
  ctx.beginPath();
  ctx.moveTo(w * 0.68, h * 0.48);
  ctx.bezierCurveTo(w * 0.78, h * 0.45, w * 0.88, h * 0.50, w * 0.95, h * 0.58);
  ctx.bezierCurveTo(w * 0.98, h * 0.62, w * 0.96, h * 0.66, w * 0.92, h * 0.64);
  ctx.bezierCurveTo(w * 0.84, h * 0.58, w * 0.76, h * 0.56, w * 0.68, h * 0.56);
  ctx.closePath();
  ctx.fill();
  // Tail spade
  ctx.fillStyle = '#aaa';
  ctx.beginPath();
  ctx.moveTo(w * 0.95, h * 0.58);
  ctx.lineTo(w * 0.99, h * 0.54);
  ctx.lineTo(w * 1.00, h * 0.60);
  ctx.lineTo(w * 0.99, h * 0.66);
  ctx.closePath();
  ctx.fill();

  // Body — muscular, horizontal
  ctx.fillStyle = bodyGrad(ctx, w * 0.48, h * 0.48, w * 0.20, '#eee', '#ccc');
  ctx.beginPath();
  ctx.moveTo(w * 0.32, h * 0.38);
  ctx.bezierCurveTo(w * 0.40, h * 0.32, w * 0.56, h * 0.32, w * 0.68, h * 0.38);
  ctx.bezierCurveTo(w * 0.74, h * 0.42, w * 0.74, h * 0.56, w * 0.68, h * 0.60);
  ctx.bezierCurveTo(w * 0.56, h * 0.66, w * 0.40, h * 0.66, w * 0.32, h * 0.58);
  ctx.bezierCurveTo(w * 0.28, h * 0.52, w * 0.28, h * 0.42, w * 0.32, h * 0.38);
  ctx.fill();

  // Side light
  ctx.fillStyle = sideLight(ctx, w * 0.28, h * 0.32, w * 0.74, h * 0.60);
  ctx.fill();

  // Wings — large, spread upward (the defining feature)
  // Near wing (detailed)
  ctx.fillStyle = bodyGrad(ctx, w * 0.40, h * 0.20, w * 0.22, '#ddd', '#aaa');
  ctx.beginPath();
  ctx.moveTo(w * 0.40, h * 0.38);  // wing root at shoulder
  ctx.bezierCurveTo(w * 0.35, h * 0.28, w * 0.28, h * 0.14, w * 0.20, h * 0.04);
  ctx.bezierCurveTo(w * 0.18, h * 0.02, w * 0.14, h * 0.01, w * 0.10, h * 0.03);
  // Wing membrane scallops
  ctx.bezierCurveTo(w * 0.18, h * 0.10, w * 0.24, h * 0.16, w * 0.22, h * 0.22);
  ctx.bezierCurveTo(w * 0.28, h * 0.18, w * 0.32, h * 0.22, w * 0.30, h * 0.28);
  ctx.bezierCurveTo(w * 0.34, h * 0.24, w * 0.38, h * 0.28, w * 0.36, h * 0.34);
  ctx.closePath();
  ctx.fill();

  // Wing bone structure
  ctx.strokeStyle = '#999';
  ctx.lineWidth = w * 0.006;
  ctx.beginPath();
  ctx.moveTo(w * 0.40, h * 0.38);
  ctx.lineTo(w * 0.20, h * 0.04);
  ctx.moveTo(w * 0.35, h * 0.25);
  ctx.lineTo(w * 0.22, h * 0.22);
  ctx.moveTo(w * 0.37, h * 0.30);
  ctx.lineTo(w * 0.30, h * 0.28);
  ctx.stroke();

  // Far wing (simpler, behind body)
  ctx.fillStyle = '#888';
  ctx.beginPath();
  ctx.moveTo(w * 0.55, h * 0.36);
  ctx.bezierCurveTo(w * 0.58, h * 0.22, w * 0.62, h * 0.10, w * 0.68, h * 0.02);
  ctx.bezierCurveTo(w * 0.64, h * 0.08, w * 0.60, h * 0.16, w * 0.58, h * 0.24);
  ctx.bezierCurveTo(w * 0.62, h * 0.20, w * 0.64, h * 0.28, w * 0.60, h * 0.32);
  ctx.closePath();
  ctx.fill();

  // Neck — serpentine S-curve
  ctx.fillStyle = bodyGrad(ctx, w * 0.22, h * 0.32, w * 0.08, '#eee', '#ccc');
  ctx.beginPath();
  ctx.moveTo(w * 0.32, h * 0.40);
  ctx.bezierCurveTo(w * 0.26, h * 0.38, w * 0.18, h * 0.34, w * 0.14, h * 0.28);
  ctx.bezierCurveTo(w * 0.12, h * 0.24, w * 0.14, h * 0.20, w * 0.18, h * 0.18);
  ctx.bezierCurveTo(w * 0.22, h * 0.22, w * 0.26, h * 0.28, w * 0.30, h * 0.34);
  ctx.bezierCurveTo(w * 0.32, h * 0.36, w * 0.34, h * 0.38, w * 0.36, h * 0.40);
  ctx.closePath();
  ctx.fill();

  // Head — angular, reptilian, jaws
  ctx.fillStyle = bodyGrad(ctx, w * 0.12, h * 0.18, w * 0.07, '#fff', '#ddd');
  ctx.beginPath();
  ctx.moveTo(w * 0.14, h * 0.16);
  ctx.bezierCurveTo(w * 0.10, h * 0.14, w * 0.04, h * 0.15, w * 0.02, h * 0.18);
  ctx.bezierCurveTo(w * 0.01, h * 0.20, w * 0.03, h * 0.24, w * 0.06, h * 0.25);
  ctx.bezierCurveTo(w * 0.10, h * 0.26, w * 0.16, h * 0.24, w * 0.18, h * 0.20);
  ctx.closePath();
  ctx.fill();

  // Horns — two swept back
  ctx.fillStyle = '#ccc';
  ctx.beginPath();
  ctx.moveTo(w * 0.12, h * 0.16);
  ctx.bezierCurveTo(w * 0.10, h * 0.10, w * 0.14, h * 0.06, w * 0.20, h * 0.08);
  ctx.lineTo(w * 0.16, h * 0.14);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(w * 0.14, h * 0.15);
  ctx.bezierCurveTo(w * 0.14, h * 0.08, w * 0.18, h * 0.04, w * 0.24, h * 0.06);
  ctx.lineTo(w * 0.18, h * 0.13);
  ctx.closePath();
  ctx.fill();

  // Eye — bright, reptilian slit
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.moveTo(w * 0.08, h * 0.18);
  ctx.lineTo(w * 0.11, h * 0.17);
  ctx.lineTo(w * 0.10, h * 0.19);
  ctx.closePath();
  ctx.fill();

  // Jaw teeth
  ctx.fillStyle = '#eee';
  for (let i = 0; i < 4; i++) {
    const tx = 0.04 + i * 0.02;
    ctx.beginPath();
    ctx.moveTo(w * tx, h * 0.23);
    ctx.lineTo(w * (tx + 0.005), h * 0.26);
    ctx.lineTo(w * (tx + 0.01), h * 0.23);
    ctx.fill();
  }

  // Legs — powerful but short (drake, not full dragon)
  drawLimb(ctx, w * 0.40, h * 0.60, w * 0.38, h * 0.74, w * 0.34, h * 0.86, w * 0.022, '#bbb');
  drawLimb(ctx, w * 0.58, h * 0.58, w * 0.60, h * 0.72, w * 0.58, h * 0.84, w * 0.020, '#aaa');
  // Clawed feet
  for (const fx of [0.34, 0.58]) {
    ctx.fillStyle = '#ccc';
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(w * fx, h * 0.86);
      ctx.lineTo(w * (fx - 0.02 + i * 0.02), h * 0.92);
      ctx.lineTo(w * (fx - 0.01 + i * 0.02), h * 0.88);
      ctx.fill();
    }
  }

  // Belly scales hint
  ctx.strokeStyle = '#aaa';
  ctx.lineWidth = w * 0.003;
  for (let i = 0; i < 6; i++) {
    const sx = 0.36 + i * 0.05;
    ctx.beginPath();
    ctx.moveTo(w * sx, h * 0.58);
    ctx.quadraticCurveTo(w * (sx + 0.025), h * 0.60, w * (sx + 0.05), h * 0.58);
    ctx.stroke();
  }
}

// ---------------------------------------------------------------------------
// 11. Basilisk — L12, Boss, Warrior
// Side view: massive serpent king, enormous head, crowned, coiling body
// ---------------------------------------------------------------------------
function drawBasilisk(ctx: CanvasRenderingContext2D, w: number, h: number) {
  // Coiling body — massive serpentine form
  ctx.fillStyle = bodyGrad(ctx, w * 0.55, h * 0.55, w * 0.25, '#eee', '#ccc');

  // Lower coil
  ctx.beginPath();
  ctx.moveTo(w * 0.30, h * 0.60);
  ctx.bezierCurveTo(w * 0.40, h * 0.75, w * 0.60, h * 0.80, w * 0.75, h * 0.72);
  ctx.bezierCurveTo(w * 0.85, h * 0.66, w * 0.88, h * 0.55, w * 0.82, h * 0.48);
  ctx.bezierCurveTo(w * 0.75, h * 0.42, w * 0.60, h * 0.44, w * 0.50, h * 0.50);
  ctx.bezierCurveTo(w * 0.42, h * 0.55, w * 0.35, h * 0.56, w * 0.30, h * 0.52);
  ctx.closePath();
  ctx.fill();

  // Upper body — rising from coil
  ctx.fillStyle = bodyGrad(ctx, w * 0.30, h * 0.30, w * 0.18, '#fff', '#ddd');
  ctx.beginPath();
  ctx.moveTo(w * 0.34, h * 0.52);
  ctx.bezierCurveTo(w * 0.28, h * 0.45, w * 0.22, h * 0.35, w * 0.20, h * 0.25);
  ctx.bezierCurveTo(w * 0.18, h * 0.18, w * 0.22, h * 0.14, w * 0.28, h * 0.16);
  ctx.bezierCurveTo(w * 0.34, h * 0.18, w * 0.38, h * 0.28, w * 0.40, h * 0.38);
  ctx.bezierCurveTo(w * 0.42, h * 0.44, w * 0.40, h * 0.50, w * 0.34, h * 0.52);
  ctx.closePath();
  ctx.fill();

  // Head — massive, crowned, the boss focal point
  ctx.fillStyle = bodyGrad(ctx, w * 0.18, h * 0.14, w * 0.12, '#fff', '#eee');
  ctx.beginPath();
  ctx.moveTo(w * 0.22, h * 0.10);
  ctx.bezierCurveTo(w * 0.16, h * 0.06, w * 0.08, h * 0.08, w * 0.04, h * 0.14);
  ctx.bezierCurveTo(w * 0.02, h * 0.18, w * 0.04, h * 0.24, w * 0.10, h * 0.26);
  ctx.bezierCurveTo(w * 0.16, h * 0.28, w * 0.24, h * 0.26, w * 0.28, h * 0.20);
  ctx.bezierCurveTo(w * 0.30, h * 0.16, w * 0.28, h * 0.12, w * 0.22, h * 0.10);
  ctx.fill();

  // Crown/crest — THREE spikes, boss marker
  ctx.fillStyle = '#eee';
  ctx.beginPath();
  ctx.moveTo(w * 0.12, h * 0.08);
  ctx.lineTo(w * 0.10, h * -0.02);
  ctx.lineTo(w * 0.14, h * 0.04);
  ctx.lineTo(w * 0.16, h * -0.04);
  ctx.lineTo(w * 0.20, h * 0.02);
  ctx.lineTo(w * 0.22, h * -0.02);
  ctx.lineTo(w * 0.24, h * 0.06);
  ctx.closePath();
  ctx.fill();

  // Eyes — large, menacing, glowing
  ctx.fillStyle = '#fff';
  fillCircle(ctx, w * 0.10, h * 0.14, w * 0.020);
  fillCircle(ctx, w * 0.18, h * 0.14, w * 0.020);
  // Vertical slit pupils
  ctx.fillStyle = '#222';
  ctx.fillRect(w * 0.098, h * 0.12, w * 0.005, h * 0.04);
  ctx.fillRect(w * 0.178, h * 0.12, w * 0.005, h * 0.04);

  // Jaw — massive, open, teeth
  ctx.fillStyle = '#ddd';
  ctx.beginPath();
  ctx.moveTo(w * 0.06, h * 0.20);
  ctx.bezierCurveTo(w * 0.02, h * 0.24, w * 0.02, h * 0.30, w * 0.06, h * 0.32);
  ctx.bezierCurveTo(w * 0.14, h * 0.34, w * 0.22, h * 0.30, w * 0.24, h * 0.26);
  ctx.closePath();
  ctx.fill();

  // Fangs — large
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.moveTo(w * 0.08, h * 0.22);
  ctx.lineTo(w * 0.06, h * 0.30);
  ctx.lineTo(w * 0.10, h * 0.24);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(w * 0.18, h * 0.22);
  ctx.lineTo(w * 0.20, h * 0.30);
  ctx.lineTo(w * 0.16, h * 0.24);
  ctx.fill();
  // Row of teeth
  ctx.fillStyle = '#eee';
  for (let i = 0; i < 5; i++) {
    const tx = 0.09 + i * 0.02;
    ctx.beginPath();
    ctx.moveTo(w * tx, h * 0.23);
    ctx.lineTo(w * (tx + 0.005), h * 0.27);
    ctx.lineTo(w * (tx + 0.01), h * 0.23);
    ctx.fill();
  }

  // Forked tongue
  ctx.strokeStyle = '#ccc';
  ctx.lineWidth = w * 0.004;
  ctx.beginPath();
  ctx.moveTo(w * 0.06, h * 0.26);
  ctx.bezierCurveTo(w * 0.02, h * 0.28, w * -0.01, h * 0.26, w * -0.02, h * 0.24);
  ctx.moveTo(w * 0.02, h * 0.27);
  ctx.bezierCurveTo(w * -0.01, h * 0.30, w * -0.03, h * 0.30, w * -0.04, h * 0.28);
  ctx.stroke();

  // Scale detail on body
  ctx.strokeStyle = '#aaa';
  ctx.lineWidth = w * 0.003;
  // Upper body scales
  for (let i = 0; i < 8; i++) {
    const sy = 0.22 + i * 0.04;
    const sx = 0.22 + Math.sin(i * 0.5) * 0.02;
    ctx.beginPath();
    ctx.moveTo(w * sx, h * sy);
    ctx.quadraticCurveTo(w * (sx + 0.04), h * (sy + 0.01), w * (sx + 0.08), h * sy);
    ctx.stroke();
  }
  // Lower coil scales
  for (let i = 0; i < 10; i++) {
    const sx = 0.35 + i * 0.05;
    const sy = 0.52 + Math.sin(i * 0.8) * 0.08;
    ctx.beginPath();
    ctx.moveTo(w * sx, h * sy);
    ctx.quadraticCurveTo(w * (sx + 0.025), h * (sy + 0.02), w * (sx + 0.05), h * sy);
    ctx.stroke();
  }

  // Tail tip — emerges from coil on right
  ctx.fillStyle = '#bbb';
  ctx.beginPath();
  ctx.moveTo(w * 0.85, h * 0.54);
  ctx.bezierCurveTo(w * 0.90, h * 0.50, w * 0.95, h * 0.48, w * 0.98, h * 0.44);
  ctx.bezierCurveTo(w * 0.96, h * 0.46, w * 0.92, h * 0.52, w * 0.85, h * 0.56);
  ctx.closePath();
  ctx.fill();

  // Belly pattern — lighter underbelly
  ctx.fillStyle = 'rgba(255,255,255,0.15)';
  ctx.beginPath();
  ctx.moveTo(w * 0.24, h * 0.22);
  ctx.bezierCurveTo(w * 0.26, h * 0.30, w * 0.30, h * 0.40, w * 0.34, h * 0.48);
  ctx.lineTo(w * 0.30, h * 0.48);
  ctx.bezierCurveTo(w * 0.26, h * 0.38, w * 0.22, h * 0.30, w * 0.20, h * 0.22);
  ctx.closePath();
  ctx.fill();
}

// ---------------------------------------------------------------------------
// Template registry
// ---------------------------------------------------------------------------

export const MONSTER_TEMPLATES: MonsterTemplate[] = [
  {
    id: 'dire-rat',
    name: 'Dire Rat',
    gridWidth: 14,
    gridHeight: 8,
    monsterClass: 1,
    level: 1,
    draw: drawDireRat,
  },
  {
    id: 'fungal-shaman',
    name: 'Fungal Shaman',
    gridWidth: 10,
    gridHeight: 12,
    monsterClass: 2,
    level: 2,
    draw: drawFungalShaman,
  },
  {
    id: 'cavern-brute',
    name: 'Cavern Brute',
    gridWidth: 10,
    gridHeight: 12,
    monsterClass: 0,
    level: 3,
    draw: drawCavernBrute,
  },
  {
    id: 'crystal-elemental',
    name: 'Crystal Elemental',
    gridWidth: 10,
    gridHeight: 12,
    monsterClass: 2,
    level: 4,
    draw: drawCrystalElemental,
  },
  {
    id: 'ironhide-troll',
    name: 'Ironhide Troll',
    gridWidth: 10,
    gridHeight: 12,
    monsterClass: 0,
    level: 5,
    draw: drawIronhideTroll,
  },
  {
    id: 'phase-spider',
    name: 'Phase Spider',
    gridWidth: 12,
    gridHeight: 11,
    monsterClass: 1,
    level: 6,
    draw: drawPhaseSpider,
  },
  {
    id: 'bonecaster',
    name: 'Bonecaster',
    gridWidth: 10,
    gridHeight: 14,
    monsterClass: 2,
    level: 7,
    draw: drawBonecaster,
  },
  {
    id: 'rock-golem',
    name: 'Rock Golem',
    gridWidth: 10,
    gridHeight: 12,
    monsterClass: 0,
    level: 8,
    draw: drawRockGolem,
  },
  {
    id: 'pale-stalker',
    name: 'Pale Stalker',
    gridWidth: 10,
    gridHeight: 13,
    monsterClass: 1,
    level: 9,
    draw: drawPaleStalker,
  },
  {
    id: 'dusk-drake',
    name: 'Dusk Drake',
    gridWidth: 14,
    gridHeight: 12,
    monsterClass: 2,
    level: 10,
    draw: drawDuskDrake,
  },
  {
    id: 'basilisk',
    name: 'Basilisk',
    gridWidth: 14,
    gridHeight: 12,
    monsterClass: 0,
    level: 12,
    isBoss: true,
    draw: drawBasilisk,
  },
];
