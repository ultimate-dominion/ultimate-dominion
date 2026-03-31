/**
 * Monster silhouette templates for ASCII rendering — v5 (Bright Color)
 *
 * All monsters in side/3/4 profile facing RIGHT (Pokemon battle style).
 * Each template draws in BRIGHT, saturated colors — the renderer's
 * lighting and gamma curve handles the mood. Paint bright, display moody.
 *
 * Design principles (from D&D Monster Manual study):
 * - Paint bright: let the renderer darken. Dark templates → invisible on black bg.
 * - Rim highlights: bright edges define the silhouette (renderer adds rim lighting)
 * - Accent anchors: eyes, teeth, claws are NEAR-WHITE for readability
 * - Saturated colors even in shadow: hue-shift shadows, don't just darken to gray
 * - High contrast: deepest darks AND brightest whites in the same creature
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
  /** Atmospheric background glow — colored radial gradient behind creature */
  atmosphere?: { r: number; g: number; b: number; intensity: number };
  /** Draw silhouette on a pre-filled black canvas at (w x h) pixels */
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void;
};

// ---------------------------------------------------------------------------
// Shading helpers — now color-aware
// ---------------------------------------------------------------------------

/** Colored radial gradient — slow falloff retains brightness for ASCII visibility */
function bodyGrad(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, r: number,
  coreR: number, coreG: number, coreB: number,
  midR?: number, midG?: number, midB?: number,
): CanvasGradient {
  const mR = midR ?? Math.floor(coreR * 0.9);
  const mG = midG ?? Math.floor(coreG * 0.9);
  const mB = midB ?? Math.floor(coreB * 0.9);
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
  g.addColorStop(0, `rgb(${coreR},${coreG},${coreB})`);
  g.addColorStop(0.4, `rgb(${mR},${mG},${mB})`);
  g.addColorStop(0.7, `rgb(${Math.floor(coreR * 0.70)},${Math.floor(coreG * 0.70)},${Math.floor(coreB * 0.70)})`);
  g.addColorStop(0.85, `rgb(${Math.floor(coreR * 0.50)},${Math.floor(coreG * 0.50)},${Math.floor(coreB * 0.50)})`);
  g.addColorStop(1, `rgb(${Math.floor(coreR * 0.30)},${Math.floor(coreG * 0.30)},${Math.floor(coreB * 0.30)})`);
  return g;
}

/** Colored side-light linear gradient overlay */
function sideLight(
  ctx: CanvasRenderingContext2D,
  x0: number, y0: number, x1: number, y1: number,
  r = 200, g = 180, b = 150,
): CanvasGradient {
  const grad = ctx.createLinearGradient(x0, y0, x1, y1);
  grad.addColorStop(0, `rgba(${r},${g},${b},0.25)`);
  grad.addColorStop(0.5, 'rgba(128,128,128,0)');
  grad.addColorStop(1, 'rgba(0,0,0,0.25)');
  return grad;
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

/** Organic filled limb — overlapping circles along bezier for mass and taper.
 * ASCII rendering needs substantial filled area, not thin strokes.
 * The `thickness` param matches old API but produces 4-6 char wide limbs. */
function drawLimb(
  ctx: CanvasRenderingContext2D,
  x0: number, y0: number,
  cx: number, cy: number,
  x1: number, y1: number,
  thickness: number,
  color: string,
) {
  ctx.fillStyle = color;
  const startR = thickness * 2.0;  // start radius — 4x the old stroke
  const endR = thickness * 1.2;    // end radius — taper
  const steps = 12;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const mt = 1 - t;
    // Quadratic bezier point
    const px = mt * mt * x0 + 2 * mt * t * cx + t * t * x1;
    const py = mt * mt * y0 + 2 * mt * t * cy + t * t * y1;
    const r = startR + (endR - startR) * t;
    ctx.beginPath();
    ctx.arc(px, py, Math.max(1, r), 0, Math.PI * 2);
    ctx.fill();
  }
  // Joint shadow at control point for depth
  ctx.fillStyle = 'rgba(0,0,0,0.12)';
  ctx.beginPath();
  ctx.arc(cx, cy, startR * 0.5, 0, Math.PI * 2);
  ctx.fill();
}

// ---------------------------------------------------------------------------
// 1. Dire Rat — L1, Rogue — Dark browns, dirty grays
// Side profile: hunched rodent, long snout, big ears, bald tail, clawed feet
// ---------------------------------------------------------------------------
function drawDireRat(ctx: CanvasRenderingContext2D, w: number, h: number) {
  // Main body — horizontal mass, hunched (warm brown fur)
  ctx.fillStyle = bodyGrad(ctx, w * 0.45, h * 0.45, w * 0.22, 185, 150, 110);
  ctx.beginPath();
  ctx.moveTo(w * 0.25, h * 0.30);
  ctx.bezierCurveTo(w * 0.35, h * 0.22, w * 0.55, h * 0.22, w * 0.65, h * 0.30);
  ctx.bezierCurveTo(w * 0.72, h * 0.35, w * 0.72, h * 0.55, w * 0.65, h * 0.60);
  ctx.bezierCurveTo(w * 0.55, h * 0.68, w * 0.35, h * 0.68, w * 0.25, h * 0.60);
  ctx.bezierCurveTo(w * 0.20, h * 0.55, w * 0.20, h * 0.35, w * 0.25, h * 0.30);
  ctx.fill();

  // Side-light overlay
  ctx.fillStyle = sideLight(ctx, w * 0.25, h * 0.30, w * 0.65, h * 0.60, 180, 150, 110);
  ctx.fill();

  // Haunches — rear bulk
  ctx.fillStyle = bodyGrad(ctx, w * 0.60, h * 0.42, w * 0.14, 170, 135, 95);
  fillEllipse(ctx, w * 0.60, h * 0.42, w * 0.13, h * 0.16);

  // Head — angular, rodent skull
  ctx.fillStyle = bodyGrad(ctx, w * 0.18, h * 0.38, w * 0.10, 165, 130, 95);
  ctx.beginPath();
  ctx.moveTo(w * 0.22, h * 0.28);
  ctx.bezierCurveTo(w * 0.14, h * 0.26, w * 0.08, h * 0.32, w * 0.06, h * 0.38);
  ctx.bezierCurveTo(w * 0.04, h * 0.42, w * 0.06, h * 0.48, w * 0.10, h * 0.50);
  ctx.bezierCurveTo(w * 0.16, h * 0.52, w * 0.22, h * 0.50, w * 0.25, h * 0.45);
  ctx.bezierCurveTo(w * 0.26, h * 0.38, w * 0.26, h * 0.32, w * 0.22, h * 0.28);
  ctx.fill();

  // Snout — pointed, extends left
  ctx.fillStyle = 'rgb(100,80,60)';
  ctx.beginPath();
  ctx.moveTo(w * 0.08, h * 0.36);
  ctx.bezierCurveTo(w * 0.04, h * 0.37, w * 0.01, h * 0.39, w * 0.00, h * 0.40);
  ctx.bezierCurveTo(w * 0.01, h * 0.42, w * 0.04, h * 0.44, w * 0.08, h * 0.44);
  ctx.closePath();
  ctx.fill();

  // Nose (pinkish)
  ctx.fillStyle = 'rgb(180,130,120)';
  fillCircle(ctx, w * 0.015, h * 0.405, w * 0.012);

  // Eye — sharp, bright
  ctx.fillStyle = 'rgb(200,40,40)';
  fillCircle(ctx, w * 0.13, h * 0.36, w * 0.015);
  ctx.fillStyle = '#000';
  fillCircle(ctx, w * 0.132, h * 0.36, w * 0.006);

  // Ears — two large triangular ears (pinkish inner)
  ctx.fillStyle = 'rgb(130,100,75)';
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

  // Inner ear detail (flesh pink)
  ctx.fillStyle = 'rgb(160,110,100)';
  ctx.beginPath();
  ctx.moveTo(w * 0.165, h * 0.24);
  ctx.bezierCurveTo(w * 0.14, h * 0.16, w * 0.155, h * 0.12, w * 0.17, h * 0.11);
  ctx.bezierCurveTo(w * 0.185, h * 0.13, w * 0.19, h * 0.19, w * 0.185, h * 0.24);
  ctx.closePath();
  ctx.fill();

  // Tail — curving upward (pinkish-brown) — thick for ASCII visibility
  ctx.strokeStyle = 'rgb(160,120,100)';
  ctx.lineCap = 'round';
  ctx.lineWidth = w * 0.035;
  ctx.beginPath();
  ctx.moveTo(w * 0.70, h * 0.40);
  ctx.bezierCurveTo(w * 0.78, h * 0.32, w * 0.86, h * 0.22, w * 0.94, h * 0.12);
  ctx.stroke();
  // Taper
  ctx.strokeStyle = 'rgb(140,105,85)';
  ctx.lineWidth = w * 0.018;
  ctx.beginPath();
  ctx.moveTo(w * 0.90, h * 0.16);
  ctx.bezierCurveTo(w * 0.95, h * 0.10, w * 0.98, h * 0.06, w * 0.99, h * 0.04);
  ctx.stroke();

  // Front legs — bent, clawed
  drawLimb(ctx, w * 0.30, h * 0.58, w * 0.28, h * 0.68, w * 0.26, h * 0.78, w * 0.020, 'rgb(120,95,70)');
  drawLimb(ctx, w * 0.35, h * 0.60, w * 0.34, h * 0.70, w * 0.32, h * 0.80, w * 0.018, 'rgb(110,85,60)');
  // Claws (bone/ivory)
  for (const lx of [0.26, 0.32]) {
    ctx.fillStyle = 'rgb(200,190,170)';
    ctx.beginPath();
    ctx.moveTo(w * lx, h * 0.80);
    ctx.lineTo(w * (lx - 0.015), h * 0.85);
    ctx.lineTo(w * (lx + 0.01), h * 0.84);
    ctx.lineTo(w * (lx + 0.02), h * 0.85);
    ctx.closePath();
    ctx.fill();
  }

  // Hind legs — thicker, powerful
  drawLimb(ctx, w * 0.55, h * 0.58, w * 0.54, h * 0.70, w * 0.50, h * 0.82, w * 0.024, 'rgb(120,95,70)');
  drawLimb(ctx, w * 0.60, h * 0.56, w * 0.60, h * 0.68, w * 0.57, h * 0.80, w * 0.022, 'rgb(110,85,60)');
  // Hind claws
  for (const lx of [0.50, 0.57]) {
    ctx.fillStyle = 'rgb(200,190,170)';
    ctx.beginPath();
    ctx.moveTo(w * lx, h * 0.82);
    ctx.lineTo(w * (lx - 0.012), h * 0.87);
    ctx.lineTo(w * (lx + 0.008), h * 0.86);
    ctx.lineTo(w * (lx + 0.018), h * 0.87);
    ctx.closePath();
    ctx.fill();
  }

  // Whiskers
  ctx.strokeStyle = 'rgb(80,65,50)';
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
  ctx.strokeStyle = 'rgb(90,70,50)';
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
// 2. Fungal Shaman — L2, Mage — Sickly purples, greens, mushroom browns
// 3/4 view: mushroom cap head, thin humanoid body, gnarled staff, spore cloud
// ---------------------------------------------------------------------------
function drawFungalShaman(ctx: CanvasRenderingContext2D, w: number, h: number) {
  // Staff — gnarled stick, held in right hand (woody brown)
  ctx.strokeStyle = 'rgb(90,65,35)';
  ctx.lineWidth = w * 0.045;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(w * 0.70, h * 0.10);
  ctx.bezierCurveTo(w * 0.68, h * 0.30, w * 0.66, h * 0.55, w * 0.62, h * 0.90);
  ctx.stroke();
  // Staff knob (bioluminescent green)
  ctx.fillStyle = 'rgb(120,200,60)';
  fillCircle(ctx, w * 0.70, h * 0.08, w * 0.05);

  // Spore cloud around staff top (green glow)
  ctx.fillStyle = 'rgba(100,200,60,0.15)';
  for (let i = 0; i < 5; i++) {
    const angle = (i / 5) * Math.PI * 2;
    fillCircle(ctx, w * 0.70 + Math.cos(angle) * w * 0.06, h * 0.08 + Math.sin(angle) * h * 0.05, w * 0.025);
  }

  // Body — thin, slight hunch (mushroom flesh — brighter)
  ctx.fillStyle = bodyGrad(ctx, w * 0.40, h * 0.55, w * 0.12, 175, 140, 95, 150, 115, 75);
  ctx.beginPath();
  ctx.moveTo(w * 0.35, h * 0.35);
  ctx.bezierCurveTo(w * 0.30, h * 0.40, w * 0.28, h * 0.55, w * 0.30, h * 0.70);
  ctx.bezierCurveTo(w * 0.32, h * 0.78, w * 0.42, h * 0.80, w * 0.50, h * 0.78);
  ctx.bezierCurveTo(w * 0.55, h * 0.70, w * 0.52, h * 0.50, w * 0.48, h * 0.38);
  ctx.bezierCurveTo(w * 0.44, h * 0.34, w * 0.38, h * 0.33, w * 0.35, h * 0.35);
  ctx.fill();

  // Mushroom cap — large dome, distinctive (vivid purple)
  ctx.fillStyle = bodyGrad(ctx, w * 0.38, h * 0.18, w * 0.22, 180, 75, 195, 145, 55, 160);
  ctx.beginPath();
  ctx.moveTo(w * 0.18, h * 0.30);
  ctx.bezierCurveTo(w * 0.15, h * 0.20, w * 0.18, h * 0.08, w * 0.28, h * 0.04);
  ctx.bezierCurveTo(w * 0.38, h * 0.00, w * 0.50, h * 0.02, w * 0.58, h * 0.08);
  ctx.bezierCurveTo(w * 0.64, h * 0.14, w * 0.62, h * 0.26, w * 0.58, h * 0.30);
  ctx.bezierCurveTo(w * 0.50, h * 0.34, w * 0.26, h * 0.34, w * 0.18, h * 0.30);
  ctx.fill();

  // Cap spots (sickly yellow-green bioluminescent)
  ctx.fillStyle = 'rgb(180,210,70)';
  fillCircle(ctx, w * 0.30, h * 0.14, w * 0.025);
  fillCircle(ctx, w * 0.42, h * 0.10, w * 0.03);
  fillCircle(ctx, w * 0.52, h * 0.16, w * 0.02);
  fillCircle(ctx, w * 0.36, h * 0.22, w * 0.018);

  // Gill lines under cap (dark purple)
  ctx.strokeStyle = 'rgb(80,35,90)';
  ctx.lineWidth = w * 0.004;
  for (let i = 0; i < 10; i++) {
    const gx = w * (0.22 + i * 0.04);
    ctx.beginPath();
    ctx.moveTo(gx, h * 0.30);
    ctx.lineTo(gx + w * 0.003, h * 0.34);
    ctx.stroke();
  }

  // Face — small, shadowed under cap (glowing green eyes)
  ctx.fillStyle = 'rgb(100,200,60)';
  fillCircle(ctx, w * 0.34, h * 0.32, w * 0.015);
  fillCircle(ctx, w * 0.42, h * 0.32, w * 0.015);
  // Mouth slit
  ctx.strokeStyle = 'rgb(80,60,40)';
  ctx.lineWidth = w * 0.005;
  ctx.beginPath();
  ctx.moveTo(w * 0.35, h * 0.36);
  ctx.lineTo(w * 0.41, h * 0.36);
  ctx.stroke();

  // Arms — left arm down, right arm extended toward staff (woody brown)
  drawLimb(ctx, w * 0.32, h * 0.45, w * 0.25, h * 0.55, w * 0.22, h * 0.65, w * 0.016, 'rgb(110,85,55)');
  drawLimb(ctx, w * 0.48, h * 0.45, w * 0.56, h * 0.48, w * 0.64, h * 0.50, w * 0.016, 'rgb(110,85,55)');
  // Fingers gripping staff
  ctx.fillStyle = 'rgb(120,95,65)';
  fillCircle(ctx, w * 0.64, h * 0.50, w * 0.012);

  // Legs — thin, rooted feel
  drawLimb(ctx, w * 0.34, h * 0.76, w * 0.32, h * 0.85, w * 0.28, h * 0.94, w * 0.020, 'rgb(90,70,45)');
  drawLimb(ctx, w * 0.44, h * 0.76, w * 0.46, h * 0.86, w * 0.44, h * 0.95, w * 0.020, 'rgb(90,70,45)');
  // Feet — root-like (dark brown)
  ctx.strokeStyle = 'rgb(70,50,30)';
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
// 3. Cavern Brute — L3, Warrior — Earth tones, stone gray
// 3/4 view: gorilla-like, massive arms, broad hunched shoulders, small head
// ---------------------------------------------------------------------------
function drawCavernBrute(ctx: CanvasRenderingContext2D, w: number, h: number) {
  // Massive torso — hunched, broad shoulders (warm stone/earth)
  ctx.fillStyle = bodyGrad(ctx, w * 0.42, h * 0.38, w * 0.26, 185, 160, 125, 160, 140, 105);
  ctx.beginPath();
  ctx.moveTo(w * 0.25, h * 0.18);
  ctx.bezierCurveTo(w * 0.15, h * 0.22, w * 0.12, h * 0.35, w * 0.15, h * 0.55);
  ctx.bezierCurveTo(w * 0.18, h * 0.68, w * 0.30, h * 0.72, w * 0.42, h * 0.70);
  ctx.bezierCurveTo(w * 0.55, h * 0.72, w * 0.65, h * 0.68, w * 0.68, h * 0.55);
  ctx.bezierCurveTo(w * 0.70, h * 0.35, w * 0.65, h * 0.20, w * 0.55, h * 0.16);
  ctx.bezierCurveTo(w * 0.45, h * 0.14, w * 0.32, h * 0.15, w * 0.25, h * 0.18);
  ctx.fill();

  // Side light
  ctx.fillStyle = sideLight(ctx, w * 0.15, h * 0.20, w * 0.68, h * 0.55, 160, 140, 110);
  ctx.fill();

  // Small head — jutting forward from hunched shoulders
  ctx.fillStyle = bodyGrad(ctx, w * 0.30, h * 0.12, w * 0.10, 120, 100, 75);
  ctx.beginPath();
  ctx.moveTo(w * 0.25, h * 0.10);
  ctx.bezierCurveTo(w * 0.22, h * 0.06, w * 0.26, h * 0.02, w * 0.32, h * 0.02);
  ctx.bezierCurveTo(w * 0.38, h * 0.02, w * 0.40, h * 0.06, w * 0.38, h * 0.12);
  ctx.bezierCurveTo(w * 0.36, h * 0.16, w * 0.28, h * 0.16, w * 0.25, h * 0.10);
  ctx.fill();

  // Brow ridge — menacing
  ctx.fillStyle = 'rgb(100,85,65)';
  ctx.beginPath();
  ctx.moveTo(w * 0.24, h * 0.06);
  ctx.bezierCurveTo(w * 0.28, h * 0.04, w * 0.36, h * 0.04, w * 0.38, h * 0.06);
  ctx.lineTo(w * 0.36, h * 0.08);
  ctx.bezierCurveTo(w * 0.32, h * 0.06, w * 0.28, h * 0.06, w * 0.26, h * 0.08);
  ctx.closePath();
  ctx.fill();

  // Eyes — deep set, glowing amber
  ctx.fillStyle = 'rgb(255,200,60)';
  fillCircle(ctx, w * 0.28, h * 0.08, w * 0.012);
  fillCircle(ctx, w * 0.34, h * 0.08, w * 0.012);

  // Jaw — heavy, underbite
  ctx.fillStyle = 'rgb(95,80,60)';
  ctx.beginPath();
  ctx.moveTo(w * 0.24, h * 0.12);
  ctx.bezierCurveTo(w * 0.22, h * 0.15, w * 0.28, h * 0.18, w * 0.36, h * 0.16);
  ctx.lineTo(w * 0.34, h * 0.12);
  ctx.closePath();
  ctx.fill();
  // Tusks (ivory)
  ctx.fillStyle = 'rgb(220,210,190)';
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
  ctx.fillStyle = bodyGrad(ctx, w * 0.15, h * 0.50, w * 0.10, 130, 110, 85, 110, 95, 70);
  ctx.beginPath();
  ctx.moveTo(w * 0.18, h * 0.28);
  ctx.bezierCurveTo(w * 0.10, h * 0.35, w * 0.06, h * 0.50, w * 0.08, h * 0.65);
  ctx.bezierCurveTo(w * 0.10, h * 0.75, w * 0.15, h * 0.80, w * 0.18, h * 0.82);
  ctx.bezierCurveTo(w * 0.22, h * 0.80, w * 0.24, h * 0.70, w * 0.22, h * 0.55);
  ctx.bezierCurveTo(w * 0.21, h * 0.40, w * 0.22, h * 0.32, w * 0.18, h * 0.28);
  ctx.fill();

  // Massive right arm (far side, darker)
  ctx.fillStyle = bodyGrad(ctx, w * 0.65, h * 0.50, w * 0.10, 110, 95, 70, 90, 75, 55);
  ctx.beginPath();
  ctx.moveTo(w * 0.62, h * 0.28);
  ctx.bezierCurveTo(w * 0.70, h * 0.35, w * 0.75, h * 0.50, w * 0.73, h * 0.65);
  ctx.bezierCurveTo(w * 0.72, h * 0.75, w * 0.68, h * 0.80, w * 0.65, h * 0.82);
  ctx.bezierCurveTo(w * 0.62, h * 0.78, w * 0.60, h * 0.65, w * 0.60, h * 0.50);
  ctx.bezierCurveTo(w * 0.60, h * 0.38, w * 0.60, h * 0.30, w * 0.62, h * 0.28);
  ctx.fill();

  // Fists — massive, knuckle-dragging
  ctx.fillStyle = 'rgb(130,110,85)';
  fillEllipse(ctx, w * 0.14, h * 0.83, w * 0.05, h * 0.04);
  fillEllipse(ctx, w * 0.68, h * 0.83, w * 0.05, h * 0.04);

  // Short thick legs
  ctx.fillStyle = bodyGrad(ctx, w * 0.35, h * 0.80, w * 0.08, 120, 105, 80, 100, 85, 65);
  fillEllipse(ctx, w * 0.35, h * 0.82, w * 0.07, h * 0.10);
  ctx.fillStyle = bodyGrad(ctx, w * 0.50, h * 0.80, w * 0.08, 110, 95, 70, 90, 75, 55);
  fillEllipse(ctx, w * 0.50, h * 0.82, w * 0.07, h * 0.10);

  // Feet
  ctx.fillStyle = 'rgb(100,85,65)';
  fillEllipse(ctx, w * 0.33, h * 0.92, w * 0.06, h * 0.03);
  fillEllipse(ctx, w * 0.52, h * 0.92, w * 0.06, h * 0.03);

  // Muscle detail lines on chest
  ctx.strokeStyle = 'rgb(80,65,45)';
  ctx.lineWidth = w * 0.004;
  ctx.beginPath();
  ctx.moveTo(w * 0.35, h * 0.30);
  ctx.quadraticCurveTo(w * 0.40, h * 0.40, w * 0.38, h * 0.50);
  ctx.moveTo(w * 0.48, h * 0.30);
  ctx.quadraticCurveTo(w * 0.44, h * 0.40, w * 0.46, h * 0.50);
  ctx.stroke();
}

// ---------------------------------------------------------------------------
// 4. Crystal Elemental — L4, Mage — Cyan, ice blue, crystalline white
// Side view: angular crystalline body, sharp geometric facets, floating shards
// ---------------------------------------------------------------------------
function drawCrystalElemental(ctx: CanvasRenderingContext2D, w: number, h: number) {
  // Floating crystal shards around body (deep blue)
  ctx.fillStyle = 'rgb(60,130,180)';
  for (const [sx, sy, sr] of [[0.15, 0.20, 0.02], [0.70, 0.15, 0.025], [0.75, 0.55, 0.02], [0.10, 0.60, 0.018]] as [number, number, number][]) {
    ctx.beginPath();
    ctx.moveTo(w * sx, h * (sy - sr * 2));
    ctx.lineTo(w * (sx + sr), h * sy);
    ctx.lineTo(w * sx, h * (sy + sr * 2));
    ctx.lineTo(w * (sx - sr), h * sy);
    ctx.closePath();
    ctx.fill();
  }

  // Main crystal body — large angular diamond shape (ice blue gradient)
  const grad = ctx.createLinearGradient(w * 0.25, h * 0.15, w * 0.65, h * 0.75);
  grad.addColorStop(0, 'rgb(200,240,255)');
  grad.addColorStop(0.3, 'rgb(120,200,235)');
  grad.addColorStop(0.6, 'rgb(60,140,180)');
  grad.addColorStop(1, 'rgb(20,60,90)');
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

  // Internal facet lines — creates crystalline structure (bright cyan)
  ctx.strokeStyle = 'rgb(150,220,245)';
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

  // Bright core glow (white-blue)
  ctx.fillStyle = bodyGrad(ctx, w * 0.44, h * 0.40, w * 0.10, 230, 250, 255, 180, 230, 250);
  fillCircle(ctx, w * 0.44, h * 0.40, w * 0.08);

  // Eye — central glowing point (pure white)
  ctx.fillStyle = 'rgb(255,255,255)';
  fillCircle(ctx, w * 0.44, h * 0.35, w * 0.02);

  // Lower shard extensions (legs — medium blue)
  ctx.fillStyle = 'rgb(80,160,200)';
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

  // Upper spike extensions (bright cyan)
  ctx.fillStyle = 'rgb(160,230,250)';
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
// 5. Ironhide Troll — L5, Warrior — Moss green, gray-green (D&D troll)
// 3/4 side view: hulking, hunched, long arms, thick hide, angry face
// ---------------------------------------------------------------------------
function drawIronhideTroll(ctx: CanvasRenderingContext2D, w: number, h: number) {
  // Massive torso — heavily hunched (vivid moss green)
  ctx.fillStyle = bodyGrad(ctx, w * 0.40, h * 0.40, w * 0.25, 125, 190, 95, 105, 165, 75);
  ctx.beginPath();
  ctx.moveTo(w * 0.30, h * 0.15);
  ctx.bezierCurveTo(w * 0.20, h * 0.18, w * 0.14, h * 0.30, w * 0.16, h * 0.50);
  ctx.bezierCurveTo(w * 0.18, h * 0.62, w * 0.28, h * 0.68, w * 0.40, h * 0.68);
  ctx.bezierCurveTo(w * 0.55, h * 0.68, w * 0.65, h * 0.62, w * 0.66, h * 0.48);
  ctx.bezierCurveTo(w * 0.68, h * 0.30, w * 0.60, h * 0.16, w * 0.48, h * 0.13);
  ctx.bezierCurveTo(w * 0.40, h * 0.12, w * 0.34, h * 0.13, w * 0.30, h * 0.15);
  ctx.fill();

  // Hunch/shoulder mass (lighter green)
  ctx.fillStyle = bodyGrad(ctx, w * 0.45, h * 0.18, w * 0.18, 140, 200, 110, 115, 175, 85);
  fillEllipse(ctx, w * 0.45, h * 0.18, w * 0.18, h * 0.10);

  // Head — small, forward-jutting
  ctx.fillStyle = bodyGrad(ctx, w * 0.25, h * 0.08, w * 0.08, 110, 170, 80, 90, 140, 60);
  ctx.beginPath();
  ctx.moveTo(w * 0.22, h * 0.04);
  ctx.bezierCurveTo(w * 0.18, h * 0.02, w * 0.15, h * 0.05, w * 0.15, h * 0.10);
  ctx.bezierCurveTo(w * 0.15, h * 0.15, w * 0.20, h * 0.18, w * 0.26, h * 0.16);
  ctx.bezierCurveTo(w * 0.32, h * 0.14, w * 0.33, h * 0.08, w * 0.30, h * 0.04);
  ctx.bezierCurveTo(w * 0.27, h * 0.02, w * 0.24, h * 0.02, w * 0.22, h * 0.04);
  ctx.fill();

  // Eyes — angry, glowing amber
  ctx.fillStyle = 'rgb(255,200,60)';
  fillCircle(ctx, w * 0.20, h * 0.08, w * 0.010);
  fillCircle(ctx, w * 0.26, h * 0.08, w * 0.010);

  // Jaw / mouth — wide, tusks
  ctx.fillStyle = 'rgb(55,85,40)';
  ctx.beginPath();
  ctx.moveTo(w * 0.16, h * 0.12);
  ctx.bezierCurveTo(w * 0.14, h * 0.16, w * 0.22, h * 0.20, w * 0.30, h * 0.16);
  ctx.lineTo(w * 0.28, h * 0.12);
  ctx.closePath();
  ctx.fill();
  // Tusks (yellowish ivory)
  ctx.fillStyle = 'rgb(220,210,180)';
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

  // Left arm — massive, reaching down/forward (moss green)
  ctx.fillStyle = bodyGrad(ctx, w * 0.12, h * 0.45, w * 0.10, 120, 180, 90, 100, 155, 70);
  ctx.beginPath();
  ctx.moveTo(w * 0.18, h * 0.25);
  ctx.bezierCurveTo(w * 0.10, h * 0.30, w * 0.04, h * 0.50, w * 0.06, h * 0.68);
  ctx.bezierCurveTo(w * 0.08, h * 0.78, w * 0.14, h * 0.82, w * 0.18, h * 0.80);
  ctx.bezierCurveTo(w * 0.22, h * 0.75, w * 0.20, h * 0.55, w * 0.22, h * 0.40);
  ctx.closePath();
  ctx.fill();

  // Right arm (far side, darker green)
  ctx.fillStyle = bodyGrad(ctx, w * 0.68, h * 0.45, w * 0.08, 95, 150, 70, 75, 120, 50);
  ctx.beginPath();
  ctx.moveTo(w * 0.62, h * 0.25);
  ctx.bezierCurveTo(w * 0.72, h * 0.35, w * 0.76, h * 0.50, w * 0.74, h * 0.65);
  ctx.bezierCurveTo(w * 0.73, h * 0.75, w * 0.68, h * 0.78, w * 0.65, h * 0.76);
  ctx.bezierCurveTo(w * 0.62, h * 0.70, w * 0.62, h * 0.50, w * 0.62, h * 0.35);
  ctx.closePath();
  ctx.fill();

  // Clawed hands (bone/ivory)
  ctx.fillStyle = 'rgb(200,195,175)';
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
  ctx.fillStyle = bodyGrad(ctx, w * 0.32, h * 0.78, w * 0.08, 70, 110, 50, 55, 90, 35);
  fillEllipse(ctx, w * 0.32, h * 0.78, w * 0.07, h * 0.12);
  ctx.fillStyle = bodyGrad(ctx, w * 0.52, h * 0.78, w * 0.08, 60, 95, 40, 45, 75, 30);
  fillEllipse(ctx, w * 0.52, h * 0.78, w * 0.07, h * 0.12);

  // Feet — wide, clawed
  ctx.fillStyle = 'rgb(60,95,40)';
  fillEllipse(ctx, w * 0.30, h * 0.92, w * 0.06, h * 0.025);
  fillEllipse(ctx, w * 0.54, h * 0.92, w * 0.06, h * 0.025);

  // Hide/plate texture (dark green)
  ctx.strokeStyle = 'rgb(45,70,30)';
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
// 6. Phase Spider — L6, Rogue — Dark midnight blue, purple
// Side/3/4 view: large abdomen, thorax, 8 legs radiating, fangs
// ---------------------------------------------------------------------------
function drawPhaseSpider(ctx: CanvasRenderingContext2D, w: number, h: number) {
  // Far-side legs (drawn first, behind body — dark purple)
  const farLegColor = 'rgb(100,85,150)';
  const farLegs: [number, number, number, number, number, number][] = [
    [0.42, 0.38, 0.52, 0.22, 0.62, 0.08],
    [0.48, 0.40, 0.60, 0.30, 0.72, 0.18],
    [0.52, 0.44, 0.64, 0.50, 0.76, 0.62],
    [0.50, 0.48, 0.58, 0.62, 0.68, 0.78],
  ];
  for (const [x0, y0, cx, cy, x1, y1] of farLegs) {
    drawLimb(ctx, w * x0, h * y0, w * cx, h * cy, w * x1, h * y1, w * 0.014, farLegColor);
  }

  // Abdomen — large, round, rear (rich purple-blue)
  ctx.fillStyle = bodyGrad(ctx, w * 0.58, h * 0.45, w * 0.18, 115, 90, 200, 95, 70, 170);
  ctx.beginPath();
  ctx.moveTo(w * 0.45, h * 0.32);
  ctx.bezierCurveTo(w * 0.50, h * 0.24, w * 0.68, h * 0.24, w * 0.75, h * 0.35);
  ctx.bezierCurveTo(w * 0.80, h * 0.45, w * 0.78, h * 0.58, w * 0.72, h * 0.62);
  ctx.bezierCurveTo(w * 0.65, h * 0.66, w * 0.50, h * 0.64, w * 0.44, h * 0.55);
  ctx.bezierCurveTo(w * 0.40, h * 0.45, w * 0.42, h * 0.36, w * 0.45, h * 0.32);
  ctx.fill();

  // Abdomen pattern (hourglass marking — RED, classic spider)
  ctx.fillStyle = 'rgb(180,35,35)';
  ctx.beginPath();
  ctx.moveTo(w * 0.58, h * 0.36);
  ctx.lineTo(w * 0.62, h * 0.44);
  ctx.lineTo(w * 0.58, h * 0.52);
  ctx.lineTo(w * 0.54, h * 0.44);
  ctx.closePath();
  ctx.fill();

  // Thorax — smaller, front (blue-purple)
  ctx.fillStyle = bodyGrad(ctx, w * 0.32, h * 0.40, w * 0.10, 130, 115, 210, 105, 90, 180);
  fillEllipse(ctx, w * 0.32, h * 0.40, w * 0.10, h * 0.08);

  // Head — small, with fangs
  ctx.fillStyle = bodyGrad(ctx, w * 0.20, h * 0.38, w * 0.06, 140, 125, 215, 115, 100, 185);
  fillEllipse(ctx, w * 0.20, h * 0.38, w * 0.06, h * 0.05);

  // Eyes — cluster of 8 (eerie green glow)
  ctx.fillStyle = 'rgb(180,255,180)';
  fillCircle(ctx, w * 0.16, h * 0.35, w * 0.008);
  fillCircle(ctx, w * 0.18, h * 0.34, w * 0.010);
  fillCircle(ctx, w * 0.17, h * 0.37, w * 0.007);
  fillCircle(ctx, w * 0.19, h * 0.36, w * 0.009);

  // Chelicerae / Fangs — distinctive (dark purple-blue)
  ctx.fillStyle = 'rgb(100,85,140)';
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
  ctx.strokeStyle = 'rgb(85,75,115)';
  ctx.lineWidth = w * 0.006;
  ctx.beginPath();
  ctx.moveTo(w * 0.16, h * 0.36);
  ctx.quadraticCurveTo(w * 0.10, h * 0.32, w * 0.08, h * 0.30);
  ctx.moveTo(w * 0.17, h * 0.37);
  ctx.quadraticCurveTo(w * 0.12, h * 0.35, w * 0.09, h * 0.34);
  ctx.stroke();

  // Near-side legs (drawn on top of body — lighter purple)
  const nearLegColor = 'rgb(145,130,210)';
  const nearLegs: [number, number, number, number, number, number][] = [
    [0.28, 0.46, 0.18, 0.30, 0.08, 0.14],
    [0.32, 0.48, 0.22, 0.40, 0.10, 0.28],
    [0.42, 0.52, 0.32, 0.64, 0.20, 0.78],
    [0.44, 0.55, 0.40, 0.70, 0.34, 0.88],
  ];
  for (const [x0, y0, cx, cy, x1, y1] of nearLegs) {
    drawLimb(ctx, w * x0, h * y0, w * cx, h * cy, w * x1, h * y1, w * 0.018, nearLegColor);
  }

  // Leg tips (tarsi) — small
  ctx.fillStyle = 'rgb(110,100,155)';
  for (const [,,,, x1, y1] of nearLegs) {
    fillCircle(ctx, w * x1, h * y1, w * 0.008);
  }

  // Spinnerets — silk thread trailing (pale lavender)
  ctx.strokeStyle = 'rgba(140,130,180,0.4)';
  ctx.lineWidth = w * 0.003;
  ctx.beginPath();
  ctx.moveTo(w * 0.76, h * 0.55);
  ctx.bezierCurveTo(w * 0.82, h * 0.58, w * 0.88, h * 0.62, w * 0.95, h * 0.68);
  ctx.stroke();
}

// ---------------------------------------------------------------------------
// 7. Bonecaster — L7, Mage — Bone white, dark robe, necrotic green
// Side view: skeletal robed figure, skull head, staff with floating bone
// ---------------------------------------------------------------------------
function drawBonecaster(ctx: CanvasRenderingContext2D, w: number, h: number) {
  // Robe — flowing, tattered bottom (dark brown with visible folds)
  ctx.fillStyle = bodyGrad(ctx, w * 0.40, h * 0.55, w * 0.18, 85, 60, 50, 65, 45, 35);
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
  ctx.fillStyle = sideLight(ctx, w * 0.20, h * 0.30, w * 0.60, h * 0.70, 60, 45, 35);
  ctx.fill();

  // Hood (dark brown)
  ctx.fillStyle = bodyGrad(ctx, w * 0.35, h * 0.18, w * 0.12, 75, 52, 42, 55, 38, 28);
  ctx.beginPath();
  ctx.moveTo(w * 0.28, h * 0.28);
  ctx.bezierCurveTo(w * 0.22, h * 0.22, w * 0.22, h * 0.10, w * 0.30, h * 0.05);
  ctx.bezierCurveTo(w * 0.38, h * 0.01, w * 0.48, h * 0.04, w * 0.50, h * 0.12);
  ctx.bezierCurveTo(w * 0.52, h * 0.20, w * 0.48, h * 0.28, w * 0.42, h * 0.30);
  ctx.closePath();
  ctx.fill();

  // Skull face inside hood — visible features (bone)
  ctx.fillStyle = 'rgb(220,210,180)';
  // Eye sockets
  fillCircle(ctx, w * 0.32, h * 0.16, w * 0.018);
  fillCircle(ctx, w * 0.40, h * 0.16, w * 0.018);
  // Dark eye interiors
  ctx.fillStyle = 'rgb(10,10,10)';
  fillCircle(ctx, w * 0.32, h * 0.16, w * 0.010);
  fillCircle(ctx, w * 0.40, h * 0.16, w * 0.010);
  // Glowing pupils (NECROTIC GREEN)
  ctx.fillStyle = 'rgb(110,255,80)';
  fillCircle(ctx, w * 0.32, h * 0.16, w * 0.005);
  fillCircle(ctx, w * 0.40, h * 0.16, w * 0.005);
  // Nasal cavity (bone)
  ctx.fillStyle = 'rgb(180,170,140)';
  ctx.beginPath();
  ctx.moveTo(w * 0.35, h * 0.19);
  ctx.lineTo(w * 0.37, h * 0.22);
  ctx.lineTo(w * 0.36, h * 0.19);
  ctx.fill();
  // Jaw — skeletal grin (bone)
  ctx.strokeStyle = 'rgb(200,190,160)';
  ctx.lineWidth = w * 0.004;
  ctx.beginPath();
  ctx.moveTo(w * 0.30, h * 0.22);
  ctx.bezierCurveTo(w * 0.34, h * 0.24, w * 0.38, h * 0.24, w * 0.42, h * 0.22);
  ctx.stroke();
  // Teeth
  for (let i = 0; i < 5; i++) {
    const tx = 0.31 + i * 0.025;
    ctx.strokeStyle = 'rgb(210,200,170)';
    ctx.lineWidth = w * 0.003;
    ctx.beginPath();
    ctx.moveTo(w * tx, h * 0.22);
    ctx.lineTo(w * tx, h * 0.24);
    ctx.stroke();
  }

  // Staff — bone staff with skull topper (bone white)
  ctx.strokeStyle = 'rgb(190,180,150)';
  ctx.lineWidth = w * 0.038;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(w * 0.72, h * 0.06);
  ctx.bezierCurveTo(w * 0.70, h * 0.30, w * 0.68, h * 0.60, w * 0.65, h * 0.90);
  ctx.stroke();

  // Staff skull topper (bone)
  ctx.fillStyle = 'rgb(210,200,170)';
  fillCircle(ctx, w * 0.72, h * 0.06, w * 0.035);
  ctx.fillStyle = 'rgb(10,10,10)';
  fillCircle(ctx, w * 0.70, h * 0.05, w * 0.008);
  fillCircle(ctx, w * 0.74, h * 0.05, w * 0.008);
  // Staff skull glowing eyes (necrotic green)
  ctx.fillStyle = 'rgb(110,255,80)';
  fillCircle(ctx, w * 0.70, h * 0.05, w * 0.004);
  fillCircle(ctx, w * 0.74, h * 0.05, w * 0.004);

  // Floating bone orbiting staff (bone)
  ctx.fillStyle = 'rgb(180,170,140)';
  fillEllipse(ctx, w * 0.78, h * 0.12, w * 0.025, h * 0.008);
  fillEllipse(ctx, w * 0.66, h * 0.14, w * 0.02, h * 0.007);

  // Skeletal hand extended (casting) — bone white
  ctx.fillStyle = 'rgb(200,190,160)';
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
  drawLimb(ctx, w * 0.48, h * 0.38, w * 0.58, h * 0.40, w * 0.68, h * 0.38, w * 0.012, 'rgb(190,180,150)');
}

// ---------------------------------------------------------------------------
// 8. Rock Golem — L8, Warrior — Stone gray, lichen green, brown
// 3/4 view: massive stone humanoid, chunky angular, cracks, mossy
// ---------------------------------------------------------------------------
function drawRockGolem(ctx: CanvasRenderingContext2D, w: number, h: number) {
  // Massive torso — rectangular, stone (bright stone gray)
  ctx.fillStyle = bodyGrad(ctx, w * 0.42, h * 0.35, w * 0.25, 185, 180, 160, 160, 155, 135);
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
  ctx.fillStyle = sideLight(ctx, w * 0.16, h * 0.12, w * 0.70, h * 0.55, 160, 155, 140);
  ctx.fill();

  // Head — angular, flat-topped (lighter stone)
  ctx.fillStyle = bodyGrad(ctx, w * 0.40, h * 0.06, w * 0.12, 195, 190, 175, 175, 170, 155);
  ctx.beginPath();
  ctx.moveTo(w * 0.30, h * 0.12);
  ctx.lineTo(w * 0.28, h * 0.04);
  ctx.lineTo(w * 0.34, h * 0.00);
  ctx.lineTo(w * 0.50, h * 0.00);
  ctx.lineTo(w * 0.56, h * 0.04);
  ctx.lineTo(w * 0.54, h * 0.12);
  ctx.closePath();
  ctx.fill();

  // Eyes — glowing amber slits in stone
  ctx.fillStyle = 'rgb(255,200,60)';
  ctx.fillRect(w * 0.34, h * 0.05, w * 0.05, h * 0.02);
  ctx.fillRect(w * 0.45, h * 0.05, w * 0.05, h * 0.02);

  // Jaw line (darker stone)
  ctx.strokeStyle = 'rgb(95,90,80)';
  ctx.lineWidth = w * 0.005;
  ctx.beginPath();
  ctx.moveTo(w * 0.32, h * 0.10);
  ctx.lineTo(w * 0.42, h * 0.12);
  ctx.lineTo(w * 0.52, h * 0.10);
  ctx.stroke();

  // Massive left arm — blocky (stone)
  ctx.fillStyle = bodyGrad(ctx, w * 0.10, h * 0.40, w * 0.10, 135, 130, 115, 115, 110, 95);
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

  // Massive right arm (far side, darker stone)
  ctx.fillStyle = bodyGrad(ctx, w * 0.72, h * 0.40, w * 0.08, 115, 110, 95, 90, 85, 70);
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
  ctx.fillStyle = 'rgb(130,125,110)';
  fillEllipse(ctx, w * 0.06, h * 0.72, w * 0.05, h * 0.04);
  fillEllipse(ctx, w * 0.78, h * 0.72, w * 0.04, h * 0.035);

  // Legs — thick columns
  ctx.fillStyle = bodyGrad(ctx, w * 0.34, h * 0.78, w * 0.08, 125, 120, 105, 105, 100, 85);
  ctx.fillRect(w * 0.28, h * 0.64, w * 0.12, h * 0.24);
  ctx.fillStyle = bodyGrad(ctx, w * 0.52, h * 0.78, w * 0.08, 110, 105, 90, 90, 85, 70);
  ctx.fillRect(w * 0.46, h * 0.64, w * 0.12, h * 0.24);

  // Feet — wide stone blocks
  ctx.fillStyle = 'rgb(105,100,85)';
  ctx.fillRect(w * 0.24, h * 0.88, w * 0.18, h * 0.06);
  ctx.fillRect(w * 0.44, h * 0.88, w * 0.18, h * 0.06);

  // Crack details in stone (dark)
  ctx.strokeStyle = 'rgb(70,65,55)';
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

  // Moss/lichen spots (green!)
  ctx.fillStyle = 'rgb(55,90,35)';
  fillCircle(ctx, w * 0.26, h * 0.28, w * 0.015);
  fillCircle(ctx, w * 0.55, h * 0.48, w * 0.012);
  fillCircle(ctx, w * 0.38, h * 0.58, w * 0.010);
}

// ---------------------------------------------------------------------------
// 9. Pale Stalker — L9, Rogue — Pale blue-white, ghostly
// Side view: lean, elongated, ghostly predator, long limbs, hunched
// ---------------------------------------------------------------------------
function drawPaleStalker(ctx: CanvasRenderingContext2D, w: number, h: number) {
  // Lean torso — elongated, hunched forward (pale blue-white)
  ctx.fillStyle = bodyGrad(ctx, w * 0.40, h * 0.38, w * 0.14, 185, 195, 215, 165, 175, 200);
  ctx.beginPath();
  ctx.moveTo(w * 0.30, h * 0.22);
  ctx.bezierCurveTo(w * 0.25, h * 0.25, w * 0.22, h * 0.35, w * 0.24, h * 0.50);
  ctx.bezierCurveTo(w * 0.26, h * 0.58, w * 0.36, h * 0.60, w * 0.46, h * 0.58);
  ctx.bezierCurveTo(w * 0.54, h * 0.55, w * 0.56, h * 0.42, w * 0.52, h * 0.30);
  ctx.bezierCurveTo(w * 0.48, h * 0.24, w * 0.38, h * 0.20, w * 0.30, h * 0.22);
  ctx.fill();

  // Head — elongated skull, predatory (lighter)
  ctx.fillStyle = bodyGrad(ctx, w * 0.20, h * 0.18, w * 0.10, 210, 220, 240, 190, 200, 225);
  ctx.beginPath();
  ctx.moveTo(w * 0.26, h * 0.16);
  ctx.bezierCurveTo(w * 0.20, h * 0.12, w * 0.12, h * 0.14, w * 0.08, h * 0.18);
  ctx.bezierCurveTo(w * 0.05, h * 0.20, w * 0.06, h * 0.25, w * 0.10, h * 0.27);
  ctx.bezierCurveTo(w * 0.16, h * 0.28, w * 0.24, h * 0.26, w * 0.28, h * 0.22);
  ctx.closePath();
  ctx.fill();

  // Jaw — long, filled with teeth
  ctx.fillStyle = 'rgb(175,185,205)';
  ctx.beginPath();
  ctx.moveTo(w * 0.08, h * 0.22);
  ctx.bezierCurveTo(w * 0.04, h * 0.24, w * 0.03, h * 0.28, w * 0.06, h * 0.30);
  ctx.bezierCurveTo(w * 0.12, h * 0.32, w * 0.20, h * 0.30, w * 0.24, h * 0.26);
  ctx.closePath();
  ctx.fill();
  // Teeth (icy white)
  ctx.fillStyle = 'rgb(230,240,250)';
  for (let i = 0; i < 6; i++) {
    const tx = 0.07 + i * 0.025;
    ctx.beginPath();
    ctx.moveTo(w * tx, h * 0.25);
    ctx.lineTo(w * (tx + 0.005), h * 0.28);
    ctx.lineTo(w * (tx + 0.01), h * 0.25);
    ctx.fill();
  }

  // Eyes — narrow, glowing icy blue
  ctx.fillStyle = 'rgb(180,230,255)';
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
  drawLimb(ctx, w * 0.28, h * 0.40, w * 0.20, h * 0.55, w * 0.14, h * 0.72, w * 0.014, 'rgb(180,190,210)');
  drawLimb(ctx, w * 0.48, h * 0.38, w * 0.56, h * 0.52, w * 0.62, h * 0.68, w * 0.012, 'rgb(160,170,190)');

  // Long claws (icy white)
  ctx.fillStyle = 'rgb(220,230,245)';
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
  // Left leg — upper segment
  drawLimb(ctx, w * 0.32, h * 0.56, w * 0.28, h * 0.62, w * 0.32, h * 0.76, w * 0.020, 'rgb(170,180,200)');
  // Left leg — lower segment
  drawLimb(ctx, w * 0.32, h * 0.76, w * 0.34, h * 0.84, w * 0.28, h * 0.92, w * 0.016, 'rgb(160,170,190)');
  // Right leg — upper segment
  drawLimb(ctx, w * 0.44, h * 0.56, w * 0.48, h * 0.62, w * 0.46, h * 0.76, w * 0.018, 'rgb(155,165,185)');
  // Right leg — lower segment
  drawLimb(ctx, w * 0.46, h * 0.76, w * 0.45, h * 0.84, w * 0.50, h * 0.92, w * 0.014, 'rgb(145,155,175)');

  // Clawed feet
  ctx.fillStyle = 'rgb(190,200,220)';
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
  ctx.strokeStyle = 'rgb(145,155,175)';
  ctx.lineWidth = w * 0.003;
  for (let i = 0; i < 5; i++) {
    const ry = 0.32 + i * 0.05;
    ctx.beginPath();
    ctx.moveTo(w * 0.28, h * ry);
    ctx.quadraticCurveTo(w * 0.38, h * (ry + 0.01), w * 0.48, h * ry);
    ctx.stroke();
  }

  // Wispy trailing energy (ghostly blue)
  ctx.strokeStyle = 'rgba(150,175,220,0.3)';
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
// 10. Dusk Drake — L10, Mage — Deep purple, amber, dark wing membranes
// Side view: winged drake, serpentine neck, spread wings, powerful tail
// ---------------------------------------------------------------------------
function drawDuskDrake(ctx: CanvasRenderingContext2D, w: number, h: number) {
  // Tail — thick, trailing left (deep purple)
  ctx.fillStyle = bodyGrad(ctx, w * 0.78, h * 0.55, w * 0.10, 85, 55, 105, 70, 40, 85);
  ctx.beginPath();
  ctx.moveTo(w * 0.68, h * 0.48);
  ctx.bezierCurveTo(w * 0.78, h * 0.45, w * 0.88, h * 0.50, w * 0.95, h * 0.58);
  ctx.bezierCurveTo(w * 0.98, h * 0.62, w * 0.96, h * 0.66, w * 0.92, h * 0.64);
  ctx.bezierCurveTo(w * 0.84, h * 0.58, w * 0.76, h * 0.56, w * 0.68, h * 0.56);
  ctx.closePath();
  ctx.fill();
  // Tail spade
  ctx.fillStyle = 'rgb(75,48,95)';
  ctx.beginPath();
  ctx.moveTo(w * 0.95, h * 0.58);
  ctx.lineTo(w * 0.99, h * 0.54);
  ctx.lineTo(w * 1.00, h * 0.60);
  ctx.lineTo(w * 0.99, h * 0.66);
  ctx.closePath();
  ctx.fill();

  // Body — muscular, horizontal (vivid purple)
  ctx.fillStyle = bodyGrad(ctx, w * 0.48, h * 0.48, w * 0.20, 175, 105, 205, 150, 85, 180);
  ctx.beginPath();
  ctx.moveTo(w * 0.32, h * 0.38);
  ctx.bezierCurveTo(w * 0.40, h * 0.32, w * 0.56, h * 0.32, w * 0.68, h * 0.38);
  ctx.bezierCurveTo(w * 0.74, h * 0.42, w * 0.74, h * 0.56, w * 0.68, h * 0.60);
  ctx.bezierCurveTo(w * 0.56, h * 0.66, w * 0.40, h * 0.66, w * 0.32, h * 0.58);
  ctx.bezierCurveTo(w * 0.28, h * 0.52, w * 0.28, h * 0.42, w * 0.32, h * 0.38);
  ctx.fill();

  // Side light
  ctx.fillStyle = sideLight(ctx, w * 0.28, h * 0.32, w * 0.74, h * 0.60, 160, 100, 180);
  ctx.fill();

  // Wings — large, spread upward (the defining feature)
  // Near wing (detailed — purple membrane)
  ctx.fillStyle = bodyGrad(ctx, w * 0.40, h * 0.20, w * 0.22, 155, 90, 185, 125, 65, 150);
  ctx.beginPath();
  ctx.moveTo(w * 0.40, h * 0.38);
  ctx.bezierCurveTo(w * 0.35, h * 0.28, w * 0.28, h * 0.14, w * 0.20, h * 0.04);
  ctx.bezierCurveTo(w * 0.18, h * 0.02, w * 0.14, h * 0.01, w * 0.10, h * 0.03);
  // Wing membrane scallops
  ctx.bezierCurveTo(w * 0.18, h * 0.10, w * 0.24, h * 0.16, w * 0.22, h * 0.22);
  ctx.bezierCurveTo(w * 0.28, h * 0.18, w * 0.32, h * 0.22, w * 0.30, h * 0.28);
  ctx.bezierCurveTo(w * 0.34, h * 0.24, w * 0.38, h * 0.28, w * 0.36, h * 0.34);
  ctx.closePath();
  ctx.fill();

  // Wing bone structure (dark purple)
  ctx.strokeStyle = 'rgb(70,40,85)';
  ctx.lineWidth = w * 0.006;
  ctx.beginPath();
  ctx.moveTo(w * 0.40, h * 0.38);
  ctx.lineTo(w * 0.20, h * 0.04);
  ctx.moveTo(w * 0.35, h * 0.25);
  ctx.lineTo(w * 0.22, h * 0.22);
  ctx.moveTo(w * 0.37, h * 0.30);
  ctx.lineTo(w * 0.30, h * 0.28);
  ctx.stroke();

  // Far wing (simpler, behind body — very dark purple)
  ctx.fillStyle = 'rgb(90,55,120)';
  ctx.beginPath();
  ctx.moveTo(w * 0.55, h * 0.36);
  ctx.bezierCurveTo(w * 0.58, h * 0.22, w * 0.62, h * 0.10, w * 0.68, h * 0.02);
  ctx.bezierCurveTo(w * 0.64, h * 0.08, w * 0.60, h * 0.16, w * 0.58, h * 0.24);
  ctx.bezierCurveTo(w * 0.62, h * 0.20, w * 0.64, h * 0.28, w * 0.60, h * 0.32);
  ctx.closePath();
  ctx.fill();

  // Neck — serpentine S-curve (bright purple)
  ctx.fillStyle = bodyGrad(ctx, w * 0.22, h * 0.32, w * 0.08, 185, 120, 215, 160, 100, 190);
  ctx.beginPath();
  ctx.moveTo(w * 0.32, h * 0.40);
  ctx.bezierCurveTo(w * 0.26, h * 0.38, w * 0.18, h * 0.34, w * 0.14, h * 0.28);
  ctx.bezierCurveTo(w * 0.12, h * 0.24, w * 0.14, h * 0.20, w * 0.18, h * 0.18);
  ctx.bezierCurveTo(w * 0.22, h * 0.22, w * 0.26, h * 0.28, w * 0.30, h * 0.34);
  ctx.bezierCurveTo(w * 0.32, h * 0.36, w * 0.34, h * 0.38, w * 0.36, h * 0.40);
  ctx.closePath();
  ctx.fill();

  // Head — angular, reptilian, jaws (lighter purple)
  ctx.fillStyle = bodyGrad(ctx, w * 0.12, h * 0.18, w * 0.07, 195, 130, 225, 170, 110, 200);
  ctx.beginPath();
  ctx.moveTo(w * 0.14, h * 0.16);
  ctx.bezierCurveTo(w * 0.10, h * 0.14, w * 0.04, h * 0.15, w * 0.02, h * 0.18);
  ctx.bezierCurveTo(w * 0.01, h * 0.20, w * 0.03, h * 0.24, w * 0.06, h * 0.25);
  ctx.bezierCurveTo(w * 0.10, h * 0.26, w * 0.16, h * 0.24, w * 0.18, h * 0.20);
  ctx.closePath();
  ctx.fill();

  // Horns — two swept back (amber/gold!)
  ctx.fillStyle = 'rgb(200,165,80)';
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

  // Eye — bright amber, reptilian slit
  ctx.fillStyle = 'rgb(255,200,60)';
  ctx.beginPath();
  ctx.moveTo(w * 0.08, h * 0.18);
  ctx.lineTo(w * 0.11, h * 0.17);
  ctx.lineTo(w * 0.10, h * 0.19);
  ctx.closePath();
  ctx.fill();

  // Jaw teeth (ivory)
  ctx.fillStyle = 'rgb(230,220,200)';
  for (let i = 0; i < 4; i++) {
    const tx = 0.04 + i * 0.02;
    ctx.beginPath();
    ctx.moveTo(w * tx, h * 0.23);
    ctx.lineTo(w * (tx + 0.005), h * 0.26);
    ctx.lineTo(w * (tx + 0.01), h * 0.23);
    ctx.fill();
  }

  // Legs — powerful but short (drake, not full dragon)
  drawLimb(ctx, w * 0.40, h * 0.60, w * 0.38, h * 0.74, w * 0.34, h * 0.86, w * 0.022, 'rgb(105,65,120)');
  drawLimb(ctx, w * 0.58, h * 0.58, w * 0.60, h * 0.72, w * 0.58, h * 0.84, w * 0.020, 'rgb(90,55,105)');
  // Clawed feet (bone/amber)
  for (const fx of [0.34, 0.58]) {
    ctx.fillStyle = 'rgb(180,155,100)';
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(w * fx, h * 0.86);
      ctx.lineTo(w * (fx - 0.02 + i * 0.02), h * 0.92);
      ctx.lineTo(w * (fx - 0.01 + i * 0.02), h * 0.88);
      ctx.fill();
    }
  }

  // Belly scales hint (dark purple)
  ctx.strokeStyle = 'rgb(95,58,110)';
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
// 11. Basilisk — L12, Boss, Warrior — Earthy brown, yellow belly, red accents
// Side view: massive serpent king, enormous head, crowned, coiling body
// ---------------------------------------------------------------------------
function drawBasilisk(ctx: CanvasRenderingContext2D, w: number, h: number) {
  // Coiling body — massive serpentine form (rich warm brown)
  ctx.fillStyle = bodyGrad(ctx, w * 0.55, h * 0.55, w * 0.25, 190, 135, 65, 165, 115, 50);

  // Lower coil
  ctx.beginPath();
  ctx.moveTo(w * 0.30, h * 0.60);
  ctx.bezierCurveTo(w * 0.40, h * 0.75, w * 0.60, h * 0.80, w * 0.75, h * 0.72);
  ctx.bezierCurveTo(w * 0.85, h * 0.66, w * 0.88, h * 0.55, w * 0.82, h * 0.48);
  ctx.bezierCurveTo(w * 0.75, h * 0.42, w * 0.60, h * 0.44, w * 0.50, h * 0.50);
  ctx.bezierCurveTo(w * 0.42, h * 0.55, w * 0.35, h * 0.56, w * 0.30, h * 0.52);
  ctx.closePath();
  ctx.fill();

  // Upper body — rising from coil (lighter brown)
  ctx.fillStyle = bodyGrad(ctx, w * 0.30, h * 0.30, w * 0.18, 210, 155, 80, 185, 130, 65);
  ctx.beginPath();
  ctx.moveTo(w * 0.34, h * 0.52);
  ctx.bezierCurveTo(w * 0.28, h * 0.45, w * 0.22, h * 0.35, w * 0.20, h * 0.25);
  ctx.bezierCurveTo(w * 0.18, h * 0.18, w * 0.22, h * 0.14, w * 0.28, h * 0.16);
  ctx.bezierCurveTo(w * 0.34, h * 0.18, w * 0.38, h * 0.28, w * 0.40, h * 0.38);
  ctx.bezierCurveTo(w * 0.42, h * 0.44, w * 0.40, h * 0.50, w * 0.34, h * 0.52);
  ctx.closePath();
  ctx.fill();

  // Head — massive, crowned, the boss focal point (warm brown)
  ctx.fillStyle = bodyGrad(ctx, w * 0.18, h * 0.14, w * 0.12, 200, 145, 75, 175, 125, 60);
  ctx.beginPath();
  ctx.moveTo(w * 0.22, h * 0.10);
  ctx.bezierCurveTo(w * 0.16, h * 0.06, w * 0.08, h * 0.08, w * 0.04, h * 0.14);
  ctx.bezierCurveTo(w * 0.02, h * 0.18, w * 0.04, h * 0.24, w * 0.10, h * 0.26);
  ctx.bezierCurveTo(w * 0.16, h * 0.28, w * 0.24, h * 0.26, w * 0.28, h * 0.20);
  ctx.bezierCurveTo(w * 0.30, h * 0.16, w * 0.28, h * 0.12, w * 0.22, h * 0.10);
  ctx.fill();

  // Crown/crest — THREE spikes, boss marker (VIVID RED — boss accent)
  ctx.fillStyle = 'rgb(240,60,45)';
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

  // Eyes — large, menacing, bright gold
  ctx.fillStyle = 'rgb(255,220,50)';
  fillCircle(ctx, w * 0.10, h * 0.14, w * 0.020);
  fillCircle(ctx, w * 0.18, h * 0.14, w * 0.020);
  // Vertical slit pupils (dark red-black)
  ctx.fillStyle = 'rgb(30,10,10)';
  ctx.fillRect(w * 0.098, h * 0.12, w * 0.005, h * 0.04);
  ctx.fillRect(w * 0.178, h * 0.12, w * 0.005, h * 0.04);

  // Jaw — massive, open, teeth
  ctx.fillStyle = 'rgb(135,90,45)';
  ctx.beginPath();
  ctx.moveTo(w * 0.06, h * 0.20);
  ctx.bezierCurveTo(w * 0.02, h * 0.24, w * 0.02, h * 0.30, w * 0.06, h * 0.32);
  ctx.bezierCurveTo(w * 0.14, h * 0.34, w * 0.22, h * 0.30, w * 0.24, h * 0.26);
  ctx.closePath();
  ctx.fill();

  // Fangs — large (ivory)
  ctx.fillStyle = 'rgb(240,230,210)';
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
  ctx.fillStyle = 'rgb(220,210,190)';
  for (let i = 0; i < 5; i++) {
    const tx = 0.09 + i * 0.02;
    ctx.beginPath();
    ctx.moveTo(w * tx, h * 0.23);
    ctx.lineTo(w * (tx + 0.005), h * 0.27);
    ctx.lineTo(w * (tx + 0.01), h * 0.23);
    ctx.fill();
  }

  // Forked tongue (red)
  ctx.strokeStyle = 'rgb(180,40,40)';
  ctx.lineWidth = w * 0.004;
  ctx.beginPath();
  ctx.moveTo(w * 0.06, h * 0.26);
  ctx.bezierCurveTo(w * 0.02, h * 0.28, w * -0.01, h * 0.26, w * -0.02, h * 0.24);
  ctx.moveTo(w * 0.02, h * 0.27);
  ctx.bezierCurveTo(w * -0.01, h * 0.30, w * -0.03, h * 0.30, w * -0.04, h * 0.28);
  ctx.stroke();

  // Scale detail on body (dark brown)
  ctx.strokeStyle = 'rgb(95,65,25)';
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
  ctx.fillStyle = 'rgb(115,78,35)';
  ctx.beginPath();
  ctx.moveTo(w * 0.85, h * 0.54);
  ctx.bezierCurveTo(w * 0.90, h * 0.50, w * 0.95, h * 0.48, w * 0.98, h * 0.44);
  ctx.bezierCurveTo(w * 0.96, h * 0.46, w * 0.92, h * 0.52, w * 0.85, h * 0.56);
  ctx.closePath();
  ctx.fill();

  // Belly pattern — lighter yellowish underbelly
  ctx.fillStyle = 'rgba(200,180,90,0.2)';
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
    atmosphere: { r: 140, g: 110, b: 70, intensity: 0.12 },
    draw: drawDireRat,
  },
  {
    id: 'fungal-shaman',
    name: 'Fungal Shaman',
    gridWidth: 10,
    gridHeight: 12,
    monsterClass: 2,
    level: 2,
    atmosphere: { r: 60, g: 160, b: 40, intensity: 0.14 },
    draw: drawFungalShaman,
  },
  {
    id: 'cavern-brute',
    name: 'Cavern Brute',
    gridWidth: 10,
    gridHeight: 12,
    monsterClass: 0,
    level: 3,
    atmosphere: { r: 160, g: 120, b: 60, intensity: 0.12 },
    draw: drawCavernBrute,
  },
  {
    id: 'crystal-elemental',
    name: 'Crystal Elemental',
    gridWidth: 10,
    gridHeight: 12,
    monsterClass: 2,
    level: 4,
    atmosphere: { r: 60, g: 160, b: 220, intensity: 0.16 },
    draw: drawCrystalElemental,
  },
  {
    id: 'ironhide-troll',
    name: 'Ironhide Troll',
    gridWidth: 10,
    gridHeight: 12,
    monsterClass: 0,
    level: 5,
    atmosphere: { r: 100, g: 150, b: 60, intensity: 0.12 },
    draw: drawIronhideTroll,
  },
  {
    id: 'phase-spider',
    name: 'Phase Spider',
    gridWidth: 12,
    gridHeight: 11,
    monsterClass: 1,
    level: 6,
    atmosphere: { r: 100, g: 70, b: 160, intensity: 0.14 },
    draw: drawPhaseSpider,
  },
  {
    id: 'bonecaster',
    name: 'Bonecaster',
    gridWidth: 10,
    gridHeight: 14,
    monsterClass: 2,
    level: 7,
    atmosphere: { r: 60, g: 180, b: 50, intensity: 0.14 },
    draw: drawBonecaster,
  },
  {
    id: 'rock-golem',
    name: 'Rock Golem',
    gridWidth: 10,
    gridHeight: 12,
    monsterClass: 0,
    level: 8,
    atmosphere: { r: 180, g: 140, b: 60, intensity: 0.12 },
    draw: drawRockGolem,
  },
  {
    id: 'pale-stalker',
    name: 'Pale Stalker',
    gridWidth: 10,
    gridHeight: 13,
    monsterClass: 1,
    level: 9,
    atmosphere: { r: 120, g: 150, b: 200, intensity: 0.16 },
    draw: drawPaleStalker,
  },
  {
    id: 'dusk-drake',
    name: 'Dusk Drake',
    gridWidth: 14,
    gridHeight: 12,
    monsterClass: 2,
    level: 10,
    atmosphere: { r: 140, g: 80, b: 180, intensity: 0.14 },
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
    atmosphere: { r: 200, g: 80, b: 40, intensity: 0.18 },
    draw: drawBasilisk,
  },
];
