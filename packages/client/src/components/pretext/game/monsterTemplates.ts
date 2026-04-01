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

// ---------------------------------------------------------------------------
// Surface texture helpers — the key to realism
// These draw directly into the 512px template canvas.
// ---------------------------------------------------------------------------

/** Reptile/dragon scale arcs — overlapping U-shapes covering a region */
function scaleTexture(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
  scaleSize: number,
  darkColor: string, lightColor: string,
  density = 1.0,
) {
  const cols = Math.ceil(w / scaleSize);
  const rows = Math.ceil(h / scaleSize);
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      if (Math.random() > density) continue;
      const offset = row % 2 === 0 ? 0 : scaleSize * 0.5;
      const sx = x + col * scaleSize + offset;
      const sy = y + row * scaleSize * 0.7;
      // Dark scale outline
      ctx.strokeStyle = darkColor;
      ctx.lineWidth = scaleSize * 0.12;
      ctx.beginPath();
      ctx.arc(sx, sy, scaleSize * 0.45, 0.2, Math.PI - 0.2);
      ctx.stroke();
      // Light highlight on top edge of each scale
      ctx.strokeStyle = lightColor;
      ctx.lineWidth = scaleSize * 0.08;
      ctx.beginPath();
      ctx.arc(sx, sy - scaleSize * 0.08, scaleSize * 0.35, 0.4, Math.PI - 0.4);
      ctx.stroke();
    }
  }
}

/** Fur/hair strokes — short curved marks covering a region */
function furTexture(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
  strokeLen: number,
  darkColor: string, lightColor: string,
  count: number,
  direction = 0, // angle in radians, 0 = downward
) {
  for (let i = 0; i < count; i++) {
    const fx = x + Math.random() * w;
    const fy = y + Math.random() * h;
    const angle = direction + (Math.random() - 0.5) * 0.8;
    const len = strokeLen * (0.6 + Math.random() * 0.8);
    const isLight = Math.random() < 0.3;
    ctx.strokeStyle = isLight ? lightColor : darkColor;
    ctx.lineWidth = strokeLen * 0.15;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(fx, fy);
    // Slight curve for organic feel
    const midX = fx + Math.sin(angle) * len * 0.5 + (Math.random() - 0.5) * len * 0.3;
    const midY = fy + Math.cos(angle) * len * 0.5;
    ctx.quadraticCurveTo(midX, midY, fx + Math.sin(angle) * len, fy + Math.cos(angle) * len);
    ctx.stroke();
  }
}

/** Stone crack/plate texture — irregular lines with depth */
function stoneTexture(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
  crackCount: number,
  darkColor: string, highlightColor: string,
) {
  for (let i = 0; i < crackCount; i++) {
    const sx = x + Math.random() * w;
    const sy = y + Math.random() * h;
    const segments = 3 + Math.floor(Math.random() * 4);
    let cx = sx, cy = sy;
    // Dark crack line
    ctx.strokeStyle = darkColor;
    ctx.lineWidth = w * 0.004 + Math.random() * w * 0.004;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    for (let s = 0; s < segments; s++) {
      cx += (Math.random() - 0.5) * w * 0.12;
      cy += (Math.random() - 0.3) * h * 0.08;
      ctx.lineTo(cx, cy);
    }
    ctx.stroke();
    // Highlight edge (offset up-left)
    ctx.strokeStyle = highlightColor;
    ctx.lineWidth = w * 0.002;
    cx = sx - w * 0.003;
    cy = sy - h * 0.003;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    for (let s = 0; s < segments; s++) {
      cx += (Math.random() - 0.5) * w * 0.12;
      cy += (Math.random() - 0.3) * h * 0.08;
      ctx.lineTo(cx, cy);
    }
    ctx.stroke();
  }
}

/** Chitin/armor plate segments — curved lines with highlights */
function chitinTexture(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, rx: number, ry: number,
  segments: number,
  darkColor: string, highlightColor: string,
) {
  for (let i = 0; i < segments; i++) {
    const angle = (i / segments) * Math.PI * 2;
    const nextAngle = ((i + 1) / segments) * Math.PI * 2;
    const midAngle = (angle + nextAngle) / 2;
    // Segment division line
    ctx.strokeStyle = darkColor;
    ctx.lineWidth = Math.max(rx, ry) * 0.04;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(angle) * rx * 0.3, cy + Math.sin(angle) * ry * 0.3);
    ctx.lineTo(cx + Math.cos(angle) * rx * 0.95, cy + Math.sin(angle) * ry * 0.95);
    ctx.stroke();
    // Highlight on each plate
    ctx.strokeStyle = highlightColor;
    ctx.lineWidth = Math.max(rx, ry) * 0.025;
    ctx.beginPath();
    ctx.arc(cx, cy, Math.max(rx, ry) * 0.7, angle + 0.1, midAngle);
    ctx.stroke();
  }
}

/** Ambient occlusion — dark transparent shape at body part junctions */
function ambientOcclusion(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, rx: number, ry: number,
  intensity = 0.25,
) {
  ctx.fillStyle = `rgba(0,0,0,${intensity})`;
  fillEllipse(ctx, cx, cy, rx, ry);
}

/** Bright highlight spot — for muscle peaks, bone ridges, wet surfaces */
function highlight(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, r: number,
  color: string,
  intensity = 0.4,
) {
  ctx.save();
  ctx.globalAlpha = intensity;
  ctx.fillStyle = color;
  fillCircle(ctx, cx, cy, r);
  ctx.restore();
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
  // === LAYER 1: Base shapes ===

  // Main body — horizontal mass, hunched
  ctx.fillStyle = bodyGrad(ctx, w * 0.45, h * 0.43, w * 0.24, 155, 120, 80, 130, 100, 65);
  ctx.beginPath();
  ctx.moveTo(w * 0.22, h * 0.28);
  ctx.bezierCurveTo(w * 0.32, h * 0.18, w * 0.55, h * 0.18, w * 0.68, h * 0.28);
  ctx.bezierCurveTo(w * 0.74, h * 0.34, w * 0.74, h * 0.56, w * 0.68, h * 0.62);
  ctx.bezierCurveTo(w * 0.56, h * 0.70, w * 0.34, h * 0.70, w * 0.22, h * 0.62);
  ctx.bezierCurveTo(w * 0.17, h * 0.56, w * 0.17, h * 0.34, w * 0.22, h * 0.28);
  ctx.fill();

  // Haunches — rear bulk
  ctx.fillStyle = bodyGrad(ctx, w * 0.62, h * 0.42, w * 0.16, 145, 110, 70);
  fillEllipse(ctx, w * 0.62, h * 0.42, w * 0.15, h * 0.18);

  // === LAYER 2: Ambient occlusion ===
  ambientOcclusion(ctx, w * 0.25, h * 0.42, w * 0.04, h * 0.06, 0.2);
  ambientOcclusion(ctx, w * 0.50, h * 0.42, w * 0.03, h * 0.04, 0.15);

  // === LAYER 3: Fur texture — DENSE, covers entire body ===
  // Back fur (darker, coarser)
  furTexture(ctx, w * 0.22, h * 0.20, w * 0.48, h * 0.25, w * 0.025,
    'rgb(70,50,30)', 'rgb(180,150,110)', 120, -0.3);
  // Side fur (medium)
  furTexture(ctx, w * 0.20, h * 0.35, w * 0.50, h * 0.20, w * 0.020,
    'rgb(80,60,38)', 'rgb(170,140,100)', 80, 0.2);
  // Belly fur (lighter, sparser)
  furTexture(ctx, w * 0.25, h * 0.52, w * 0.40, h * 0.12, w * 0.018,
    'rgb(100,78,52)', 'rgb(195,170,130)', 50, 0.5);
  // Haunch fur (thick matted)
  furTexture(ctx, w * 0.52, h * 0.28, w * 0.20, h * 0.28, w * 0.022,
    'rgb(75,55,35)', 'rgb(165,135,95)', 60, 0.1);

  // === LAYER 4: Body highlights — muscle definition ===
  highlight(ctx, w * 0.40, h * 0.32, w * 0.06, 'rgb(200,170,130)', 0.15);
  highlight(ctx, w * 0.60, h * 0.38, w * 0.05, 'rgb(190,160,120)', 0.12);
  highlight(ctx, w * 0.35, h * 0.50, w * 0.04, 'rgb(185,155,115)', 0.10);

  // === LAYER 5: Head ===
  ctx.fillStyle = bodyGrad(ctx, w * 0.16, h * 0.38, w * 0.12, 145, 110, 75);
  ctx.beginPath();
  ctx.moveTo(w * 0.22, h * 0.26);
  ctx.bezierCurveTo(w * 0.13, h * 0.24, w * 0.06, h * 0.30, w * 0.04, h * 0.37);
  ctx.bezierCurveTo(w * 0.02, h * 0.42, w * 0.04, h * 0.50, w * 0.10, h * 0.52);
  ctx.bezierCurveTo(w * 0.16, h * 0.54, w * 0.22, h * 0.52, w * 0.25, h * 0.46);
  ctx.bezierCurveTo(w * 0.27, h * 0.38, w * 0.27, h * 0.30, w * 0.22, h * 0.26);
  ctx.fill();
  // Head fur
  furTexture(ctx, w * 0.04, h * 0.26, w * 0.22, h * 0.26, w * 0.016,
    'rgb(65,48,28)', 'rgb(160,130,90)', 40, -0.1);

  // Snout — pointed
  ctx.fillStyle = 'rgb(85,65,45)';
  ctx.beginPath();
  ctx.moveTo(w * 0.06, h * 0.35);
  ctx.bezierCurveTo(w * 0.02, h * 0.36, w * -0.01, h * 0.39, w * -0.02, h * 0.40);
  ctx.bezierCurveTo(w * -0.01, h * 0.43, w * 0.02, h * 0.45, w * 0.06, h * 0.45);
  ctx.closePath();
  ctx.fill();

  // Nose (pinkish, bright)
  ctx.fillStyle = 'rgb(200,140,130)';
  fillCircle(ctx, w * 0.00, h * 0.405, w * 0.016);

  // Eye — LARGE, glowing red (key focal point)
  highlight(ctx, w * 0.13, h * 0.36, w * 0.025, 'rgb(255,80,60)', 0.3);
  ctx.fillStyle = 'rgb(230,50,40)';
  fillCircle(ctx, w * 0.13, h * 0.36, w * 0.018);
  ctx.fillStyle = '#000';
  fillCircle(ctx, w * 0.132, h * 0.36, w * 0.007);
  ctx.fillStyle = 'rgb(255,200,200)';
  fillCircle(ctx, w * 0.126, h * 0.354, w * 0.004);

  // Ears — large, prominent
  ctx.fillStyle = 'rgb(120,90,65)';
  ctx.beginPath();
  ctx.moveTo(w * 0.14, h * 0.26);
  ctx.bezierCurveTo(w * 0.11, h * 0.14, w * 0.13, h * 0.06, w * 0.17, h * 0.04);
  ctx.bezierCurveTo(w * 0.21, h * 0.06, w * 0.22, h * 0.16, w * 0.20, h * 0.24);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(w * 0.21, h * 0.24);
  ctx.bezierCurveTo(w * 0.19, h * 0.12, w * 0.22, h * 0.04, w * 0.26, h * 0.02);
  ctx.bezierCurveTo(w * 0.29, h * 0.05, w * 0.29, h * 0.16, w * 0.27, h * 0.24);
  ctx.closePath();
  ctx.fill();
  // Inner ear (flesh pink)
  ctx.fillStyle = 'rgb(175,120,110)';
  ctx.beginPath();
  ctx.moveTo(w * 0.16, h * 0.22);
  ctx.bezierCurveTo(w * 0.13, h * 0.14, w * 0.15, h * 0.08, w * 0.17, h * 0.07);
  ctx.bezierCurveTo(w * 0.19, h * 0.10, w * 0.20, h * 0.17, w * 0.19, h * 0.22);
  ctx.closePath();
  ctx.fill();

  // Teeth — exposed, yellowish (visible even at small sizes)
  ctx.fillStyle = 'rgb(230,220,190)';
  ctx.beginPath();
  ctx.moveTo(w * 0.03, h * 0.42);
  ctx.lineTo(w * 0.01, h * 0.47);
  ctx.lineTo(w * 0.04, h * 0.43);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(w * 0.06, h * 0.42);
  ctx.lineTo(w * 0.05, h * 0.47);
  ctx.lineTo(w * 0.07, h * 0.43);
  ctx.fill();

  // === LAYER 6: Tail — thick, curving, scabby ===
  ctx.strokeStyle = 'rgb(155,115,95)';
  ctx.lineCap = 'round';
  ctx.lineWidth = w * 0.038;
  ctx.beginPath();
  ctx.moveTo(w * 0.72, h * 0.40);
  ctx.bezierCurveTo(w * 0.80, h * 0.30, w * 0.88, h * 0.20, w * 0.95, h * 0.10);
  ctx.stroke();
  ctx.strokeStyle = 'rgb(140,100,80)';
  ctx.lineWidth = w * 0.020;
  ctx.beginPath();
  ctx.moveTo(w * 0.92, h * 0.14);
  ctx.bezierCurveTo(w * 0.96, h * 0.08, w * 0.98, h * 0.04, w * 1.00, h * 0.02);
  ctx.stroke();

  // === LAYER 7: Legs with mass ===
  drawLimb(ctx, w * 0.30, h * 0.58, w * 0.28, h * 0.68, w * 0.24, h * 0.78, w * 0.024, 'rgb(110,85,55)');
  drawLimb(ctx, w * 0.36, h * 0.60, w * 0.35, h * 0.70, w * 0.32, h * 0.80, w * 0.022, 'rgb(100,75,50)');
  drawLimb(ctx, w * 0.56, h * 0.58, w * 0.54, h * 0.70, w * 0.50, h * 0.82, w * 0.028, 'rgb(110,85,55)');
  drawLimb(ctx, w * 0.62, h * 0.56, w * 0.61, h * 0.68, w * 0.58, h * 0.80, w * 0.026, 'rgb(100,75,50)');

  // Claws (bright ivory — visible focal points)
  ctx.fillStyle = 'rgb(210,200,180)';
  for (const lx of [0.24, 0.32, 0.50, 0.58]) {
    const ly = lx < 0.40 ? 0.80 : 0.82;
    for (let c = 0; c < 3; c++) {
      ctx.beginPath();
      ctx.moveTo(w * (lx + c * 0.012 - 0.012), h * ly);
      ctx.lineTo(w * (lx + c * 0.012 - 0.018), h * (ly + 0.06));
      ctx.lineTo(w * (lx + c * 0.012 - 0.006), h * (ly + 0.04));
      ctx.fill();
    }
  }

  // Whiskers (thicker for visibility)
  ctx.strokeStyle = 'rgb(120,100,75)';
  ctx.lineWidth = w * 0.006;
  ctx.beginPath();
  ctx.moveTo(w * 0.03, h * 0.39);
  ctx.lineTo(w * -0.04, h * 0.33);
  ctx.moveTo(w * 0.03, h * 0.41);
  ctx.lineTo(w * -0.04, h * 0.39);
  ctx.moveTo(w * 0.03, h * 0.43);
  ctx.lineTo(w * -0.04, h * 0.47);
  ctx.stroke();
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

  // === TEXTURE PASS ===

  // 1. Ambient occlusion at body part junctions
  ambientOcclusion(ctx, w * 0.38, h * 0.32, w * 0.14, h * 0.04, 0.25); // cap meets body
  ambientOcclusion(ctx, w * 0.34, h * 0.76, w * 0.04, h * 0.03, 0.20); // left leg meets body
  ambientOcclusion(ctx, w * 0.44, h * 0.76, w * 0.04, h * 0.03, 0.20); // right leg meets body
  ambientOcclusion(ctx, w * 0.32, h * 0.45, w * 0.03, h * 0.03, 0.15); // left arm meets body
  ambientOcclusion(ctx, w * 0.48, h * 0.45, w * 0.03, h * 0.03, 0.15); // right arm meets body

  // 2. Surface texture — mushroom cap pores/spots (semi-transparent dark purple)
  ctx.fillStyle = 'rgba(80,30,90,0.35)';
  for (let i = 0; i < 18; i++) {
    const px = w * (0.20 + Math.random() * 0.38);
    const py = h * (0.06 + Math.random() * 0.22);
    const pr = w * (0.004 + Math.random() * 0.008);
    fillCircle(ctx, px, py, pr);
  }

  // 3. Staff knob glow — bigger and brighter with highlight
  highlight(ctx, w * 0.70, h * 0.08, w * 0.08, 'rgb(120,255,60)', 0.25); // outer glow halo
  highlight(ctx, w * 0.70, h * 0.08, w * 0.04, 'rgb(200,255,150)', 0.45); // inner bright core

  // 4. Brighter green eyes with glow halos
  ctx.save();
  ctx.globalAlpha = 0.35;
  ctx.fillStyle = 'rgb(80,255,40)';
  fillCircle(ctx, w * 0.34, h * 0.32, w * 0.03); // left eye halo
  fillCircle(ctx, w * 0.42, h * 0.32, w * 0.03); // right eye halo
  ctx.restore();
  // Brighter eye cores
  ctx.fillStyle = 'rgb(150,255,100)';
  fillCircle(ctx, w * 0.34, h * 0.32, w * 0.018);
  fillCircle(ctx, w * 0.42, h * 0.32, w * 0.018);
  ctx.fillStyle = 'rgb(220,255,200)';
  fillCircle(ctx, w * 0.34, h * 0.32, w * 0.008);
  fillCircle(ctx, w * 0.42, h * 0.32, w * 0.008);

  // 5. Spore particles — tiny bright green dots floating around the figure
  ctx.fillStyle = 'rgb(130,255,70)';
  for (let i = 0; i < 14; i++) {
    const sx = w * (0.15 + Math.random() * 0.60);
    const sy = h * (0.02 + Math.random() * 0.80);
    fillCircle(ctx, sx, sy, w * (0.002 + Math.random() * 0.004));
  }
  // Brighter spores closer to staff
  ctx.fillStyle = 'rgb(180,255,130)';
  for (let i = 0; i < 6; i++) {
    const angle = Math.random() * Math.PI * 2;
    const dist = w * (0.08 + Math.random() * 0.10);
    fillCircle(ctx, w * 0.70 + Math.cos(angle) * dist, h * 0.08 + Math.sin(angle) * dist * 0.8, w * 0.003);
  }
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

  // === TEXTURE PASS ===

  // 1. Ambient occlusion at body part junctions
  ambientOcclusion(ctx, w * 0.20, h * 0.26, w * 0.07, h * 0.06, 0.25); // left arm / shoulder
  ambientOcclusion(ctx, w * 0.62, h * 0.26, w * 0.06, h * 0.05, 0.25); // right arm / shoulder
  ambientOcclusion(ctx, w * 0.35, h * 0.72, w * 0.07, h * 0.05, 0.20); // left leg / body
  ambientOcclusion(ctx, w * 0.50, h * 0.72, w * 0.07, h * 0.05, 0.20); // right leg / body
  ambientOcclusion(ctx, w * 0.30, h * 0.16, w * 0.06, h * 0.04, 0.18); // neck / torso

  // 2. Stone texture on torso — rocky hide
  stoneTexture(ctx, w * 0.16, h * 0.20, w * 0.50, h * 0.46, 16,
    'rgb(65,52,35)', 'rgba(200,180,150,0.30)');
  stoneTexture(ctx, w * 0.06, h * 0.30, w * 0.18, h * 0.46, 6,
    'rgb(60,48,32)', 'rgba(190,170,140,0.25)'); // left arm
  stoneTexture(ctx, w * 0.60, h * 0.30, w * 0.16, h * 0.46, 6,
    'rgb(55,44,30)', 'rgba(180,160,130,0.25)'); // right arm

  // 3. Fur texture on shoulders/back — sparse wiry hair
  furTexture(ctx, w * 0.20, h * 0.16, w * 0.42, h * 0.18, w * 0.025,
    'rgb(60,48,30)', 'rgb(140,120,90)', 30, -0.3);
  furTexture(ctx, w * 0.35, h * 0.22, w * 0.20, h * 0.12, w * 0.02,
    'rgb(55,44,28)', 'rgb(130,110,80)', 15, -0.5); // upper back

  // 4. Highlight spots — shoulders, chest, arms
  highlight(ctx, w * 0.30, h * 0.20, w * 0.05, 'rgb(200,180,150)', 0.18); // left shoulder
  highlight(ctx, w * 0.55, h * 0.20, w * 0.04, 'rgb(190,170,140)', 0.15); // right shoulder
  highlight(ctx, w * 0.42, h * 0.32, w * 0.04, 'rgb(195,175,145)', 0.15); // chest center
  highlight(ctx, w * 0.12, h * 0.55, w * 0.03, 'rgb(160,140,110)', 0.12); // left bicep
  highlight(ctx, w * 0.68, h * 0.55, w * 0.025, 'rgb(145,125,95)', 0.10); // right bicep

  // 5. Bigger, brighter eyes with glow halos
  // Glow halo
  ctx.save();
  ctx.globalAlpha = 0.35;
  ctx.fillStyle = 'rgb(255,180,40)';
  fillCircle(ctx, w * 0.28, h * 0.08, w * 0.025);
  fillCircle(ctx, w * 0.34, h * 0.08, w * 0.025);
  ctx.restore();
  // Larger bright iris
  ctx.fillStyle = 'rgb(255,220,80)';
  fillCircle(ctx, w * 0.28, h * 0.08, w * 0.018);
  fillCircle(ctx, w * 0.34, h * 0.08, w * 0.018);
  // Hot white pupil core
  ctx.fillStyle = 'rgb(255,255,200)';
  fillCircle(ctx, w * 0.28, h * 0.08, w * 0.008);
  fillCircle(ctx, w * 0.34, h * 0.08, w * 0.008);

  // 6. Bigger, brighter tusks
  ctx.fillStyle = 'rgb(245,235,215)';
  ctx.beginPath();
  ctx.moveTo(w * 0.25, h * 0.13);
  ctx.lineTo(w * 0.22, h * 0.06);
  ctx.lineTo(w * 0.28, h * 0.12);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(w * 0.33, h * 0.13);
  ctx.lineTo(w * 0.36, h * 0.06);
  ctx.lineTo(w * 0.31, h * 0.12);
  ctx.fill();
  // Tusk highlights
  ctx.save();
  ctx.globalAlpha = 0.4;
  ctx.fillStyle = 'rgb(255,250,240)';
  ctx.beginPath();
  ctx.moveTo(w * 0.245, h * 0.11);
  ctx.lineTo(w * 0.225, h * 0.07);
  ctx.lineTo(w * 0.255, h * 0.10);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(w * 0.335, h * 0.11);
  ctx.lineTo(w * 0.355, h * 0.07);
  ctx.lineTo(w * 0.325, h * 0.10);
  ctx.fill();
  ctx.restore();
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

  // === TEXTURE PASS ===

  // 1. Additional internal fracture lines — thin bright cyan strokes
  ctx.strokeStyle = 'rgba(180,240,255,0.45)';
  ctx.lineWidth = w * 0.003;
  ctx.beginPath();
  // Diagonal fractures across body
  ctx.moveTo(w * 0.30, h * 0.25);
  ctx.lineTo(w * 0.50, h * 0.35);
  ctx.moveTo(w * 0.35, h * 0.50);
  ctx.lineTo(w * 0.55, h * 0.55);
  ctx.moveTo(w * 0.28, h * 0.40);
  ctx.lineTo(w * 0.38, h * 0.60);
  ctx.moveTo(w * 0.50, h * 0.20);
  ctx.lineTo(w * 0.60, h * 0.45);
  ctx.moveTo(w * 0.32, h * 0.55);
  ctx.lineTo(w * 0.48, h * 0.70);
  ctx.moveTo(w * 0.55, h * 0.30);
  ctx.lineTo(w * 0.42, h * 0.55);
  ctx.stroke();

  // 2. Highlight spots at facet edges — sparkle effect
  highlight(ctx, w * 0.42, h * 0.10, w * 0.015, 'rgb(255,255,255)', 0.55); // top facet
  highlight(ctx, w * 0.58, h * 0.20, w * 0.012, 'rgb(220,245,255)', 0.50); // upper right facet
  highlight(ctx, w * 0.65, h * 0.40, w * 0.012, 'rgb(200,240,255)', 0.45); // right facet
  highlight(ctx, w * 0.28, h * 0.22, w * 0.010, 'rgb(210,240,255)', 0.45); // upper left facet
  highlight(ctx, w * 0.22, h * 0.42, w * 0.010, 'rgb(190,230,250)', 0.40); // left facet
  highlight(ctx, w * 0.60, h * 0.65, w * 0.010, 'rgb(200,235,255)', 0.40); // lower right facet
  highlight(ctx, w * 0.30, h * 0.68, w * 0.010, 'rgb(190,230,250)', 0.40); // lower left facet

  // 3. Bigger/brighter core glow
  ctx.save();
  ctx.globalAlpha = 0.20;
  ctx.fillStyle = 'rgb(200,240,255)';
  fillCircle(ctx, w * 0.44, h * 0.40, w * 0.14); // outer glow halo
  ctx.restore();
  highlight(ctx, w * 0.44, h * 0.40, w * 0.06, 'rgb(240,252,255)', 0.50); // bright inner core

  // 4. Ambient occlusion at lower shard bases
  ambientOcclusion(ctx, w * 0.35, h * 0.78, w * 0.05, h * 0.04, 0.30); // left shard base
  ambientOcclusion(ctx, w * 0.50, h * 0.78, w * 0.05, h * 0.04, 0.30); // right shard base

  // 5. Brighter eye with glow halo
  ctx.save();
  ctx.globalAlpha = 0.40;
  ctx.fillStyle = 'rgb(220,245,255)';
  fillCircle(ctx, w * 0.44, h * 0.35, w * 0.04); // eye glow halo
  ctx.restore();
  ctx.fillStyle = 'rgb(255,255,255)';
  fillCircle(ctx, w * 0.44, h * 0.35, w * 0.025); // larger bright eye
  ctx.fillStyle = 'rgb(180,230,255)';
  fillCircle(ctx, w * 0.44, h * 0.35, w * 0.015); // blue inner pupil
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

  // === TEXTURE PASS ===

  // 1. Ambient occlusion at body part junctions
  ambientOcclusion(ctx, w * 0.20, h * 0.25, w * 0.07, h * 0.06, 0.25); // left arm / shoulder
  ambientOcclusion(ctx, w * 0.62, h * 0.25, w * 0.06, h * 0.05, 0.25); // right arm / shoulder
  ambientOcclusion(ctx, w * 0.32, h * 0.68, w * 0.07, h * 0.05, 0.20); // left leg / body
  ambientOcclusion(ctx, w * 0.52, h * 0.68, w * 0.07, h * 0.05, 0.20); // right leg / body

  // 2. Fur texture on torso — coarse, sparse hide hair
  furTexture(ctx, w * 0.18, h * 0.20, w * 0.46, h * 0.42, w * 0.03,
    'rgb(40,60,25)', 'rgb(90,130,65)', 40, 0.3);

  // 3. Stone texture on shoulders — iron plate texture
  stoneTexture(ctx, w * 0.28, h * 0.10, w * 0.32, h * 0.14, 10,
    'rgb(50,75,35)', 'rgba(160,200,130,0.30)');

  // 4. Veiny/muscle detail lines (thicker stroke)
  ctx.strokeStyle = 'rgba(35,55,22,0.45)';
  ctx.lineWidth = w * 0.006;
  ctx.lineCap = 'round';
  ctx.beginPath();
  // Left arm veins
  ctx.moveTo(w * 0.16, h * 0.32);
  ctx.quadraticCurveTo(w * 0.12, h * 0.45, w * 0.10, h * 0.60);
  ctx.moveTo(w * 0.18, h * 0.35);
  ctx.quadraticCurveTo(w * 0.15, h * 0.50, w * 0.14, h * 0.68);
  // Right arm veins
  ctx.moveTo(w * 0.64, h * 0.32);
  ctx.quadraticCurveTo(w * 0.70, h * 0.45, w * 0.72, h * 0.58);
  // Torso muscle lines
  ctx.moveTo(w * 0.32, h * 0.22);
  ctx.quadraticCurveTo(w * 0.35, h * 0.35, w * 0.34, h * 0.50);
  ctx.moveTo(w * 0.50, h * 0.22);
  ctx.quadraticCurveTo(w * 0.48, h * 0.35, w * 0.49, h * 0.50);
  ctx.stroke();

  // 5. Highlight spots — shoulders and muscle peaks
  highlight(ctx, w * 0.38, h * 0.15, w * 0.05, 'rgb(170,220,140)', 0.20); // shoulder hump center
  highlight(ctx, w * 0.28, h * 0.18, w * 0.03, 'rgb(160,210,130)', 0.15); // left shoulder
  highlight(ctx, w * 0.55, h * 0.18, w * 0.03, 'rgb(150,200,120)', 0.15); // right shoulder
  highlight(ctx, w * 0.14, h * 0.45, w * 0.03, 'rgb(145,195,115)', 0.15); // left bicep
  highlight(ctx, w * 0.68, h * 0.45, w * 0.025, 'rgb(130,175,100)', 0.12); // right bicep

  // 6. Brighter eyes with glow
  // Glow halo
  ctx.save();
  ctx.globalAlpha = 0.35;
  ctx.fillStyle = 'rgb(255,180,40)';
  fillCircle(ctx, w * 0.20, h * 0.08, w * 0.022);
  fillCircle(ctx, w * 0.26, h * 0.08, w * 0.022);
  ctx.restore();
  // Brighter iris
  ctx.fillStyle = 'rgb(255,230,100)';
  fillCircle(ctx, w * 0.20, h * 0.08, w * 0.012);
  fillCircle(ctx, w * 0.26, h * 0.08, w * 0.012);
  // Hot white pupil core
  ctx.fillStyle = 'rgb(255,255,210)';
  fillCircle(ctx, w * 0.20, h * 0.08, w * 0.005);
  fillCircle(ctx, w * 0.26, h * 0.08, w * 0.005);
}

// ---------------------------------------------------------------------------
// 6. Phase Spider — L6, Rogue — Dark midnight blue, purple
// Side/3/4 view: large abdomen, thorax, 8 legs radiating, fangs
// ---------------------------------------------------------------------------
function drawPhaseSpider(ctx: CanvasRenderingContext2D, w: number, h: number) {
  // === LAYER 1: Far-side legs (behind body) ===
  const farLegColor = 'rgb(90,70,140)';
  const farLegs: [number, number, number, number, number, number][] = [
    [0.42, 0.38, 0.52, 0.20, 0.64, 0.06],
    [0.48, 0.40, 0.62, 0.28, 0.74, 0.16],
    [0.52, 0.44, 0.66, 0.52, 0.78, 0.64],
    [0.50, 0.48, 0.60, 0.64, 0.70, 0.80],
  ];
  for (const [x0, y0, cx, cy, x1, y1] of farLegs) {
    drawLimb(ctx, w * x0, h * y0, w * cx, h * cy, w * x1, h * y1, w * 0.016, farLegColor);
  }

  // === LAYER 2: Abdomen — large, armored ===
  ctx.fillStyle = bodyGrad(ctx, w * 0.58, h * 0.44, w * 0.20, 130, 95, 210, 105, 75, 180);
  ctx.beginPath();
  ctx.moveTo(w * 0.43, h * 0.30);
  ctx.bezierCurveTo(w * 0.48, h * 0.22, w * 0.70, h * 0.22, w * 0.77, h * 0.34);
  ctx.bezierCurveTo(w * 0.82, h * 0.44, w * 0.80, h * 0.60, w * 0.73, h * 0.64);
  ctx.bezierCurveTo(w * 0.65, h * 0.68, w * 0.48, h * 0.66, w * 0.42, h * 0.56);
  ctx.bezierCurveTo(w * 0.38, h * 0.46, w * 0.40, h * 0.34, w * 0.43, h * 0.30);
  ctx.fill();

  // Abdomen chitin plate texture
  chitinTexture(ctx, w * 0.60, h * 0.44, w * 0.16, h * 0.16, 8,
    'rgb(50,35,90)', 'rgb(170,150,230)');

  // Abdomen AO at waist
  ambientOcclusion(ctx, w * 0.43, h * 0.44, w * 0.05, h * 0.06, 0.25);

  // Hourglass marking — RED (bright, distinctive)
  ctx.fillStyle = 'rgb(210,40,35)';
  ctx.beginPath();
  ctx.moveTo(w * 0.60, h * 0.34);
  ctx.lineTo(w * 0.64, h * 0.43);
  ctx.lineTo(w * 0.60, h * 0.53);
  ctx.lineTo(w * 0.56, h * 0.43);
  ctx.closePath();
  ctx.fill();
  // Highlight on hourglass
  highlight(ctx, w * 0.60, h * 0.40, w * 0.02, 'rgb(255,120,100)', 0.4);

  // Abdomen highlights (chitin sheen)
  highlight(ctx, w * 0.56, h * 0.34, w * 0.05, 'rgb(180,160,240)', 0.2);
  highlight(ctx, w * 0.66, h * 0.48, w * 0.04, 'rgb(170,150,230)', 0.15);

  // === LAYER 3: Thorax — armored ===
  ctx.fillStyle = bodyGrad(ctx, w * 0.32, h * 0.40, w * 0.12, 145, 125, 220, 120, 100, 190);
  fillEllipse(ctx, w * 0.32, h * 0.40, w * 0.12, h * 0.09);
  // Thorax chitin
  chitinTexture(ctx, w * 0.32, h * 0.40, w * 0.08, h * 0.06, 6,
    'rgb(55,40,100)', 'rgb(180,165,240)');
  highlight(ctx, w * 0.30, h * 0.36, w * 0.04, 'rgb(190,175,250)', 0.2);

  // === LAYER 4: Head ===
  ctx.fillStyle = bodyGrad(ctx, w * 0.19, h * 0.38, w * 0.07, 150, 135, 225, 125, 110, 195);
  fillEllipse(ctx, w * 0.19, h * 0.38, w * 0.07, h * 0.055);

  // Eyes — cluster of 8 (BRIGHT eerie green)
  highlight(ctx, w * 0.17, h * 0.35, w * 0.02, 'rgb(120,255,120)', 0.4);
  ctx.fillStyle = 'rgb(160,255,160)';
  fillCircle(ctx, w * 0.14, h * 0.35, w * 0.009);
  fillCircle(ctx, w * 0.17, h * 0.34, w * 0.012);
  fillCircle(ctx, w * 0.15, h * 0.38, w * 0.008);
  fillCircle(ctx, w * 0.18, h * 0.36, w * 0.010);
  ctx.fillStyle = 'rgb(200,255,200)';
  fillCircle(ctx, w * 0.20, h * 0.35, w * 0.008);
  fillCircle(ctx, w * 0.21, h * 0.37, w * 0.006);
  fillCircle(ctx, w * 0.19, h * 0.39, w * 0.007);
  fillCircle(ctx, w * 0.22, h * 0.38, w * 0.005);

  // === LAYER 5: Chelicerae / Fangs — LARGE, menacing ===
  ctx.fillStyle = 'rgb(60,45,100)';
  ctx.beginPath();
  ctx.moveTo(w * 0.14, h * 0.39);
  ctx.bezierCurveTo(w * 0.10, h * 0.42, w * 0.07, h * 0.50, w * 0.08, h * 0.55);
  ctx.lineTo(w * 0.11, h * 0.52);
  ctx.bezierCurveTo(w * 0.11, h * 0.46, w * 0.12, h * 0.42, w * 0.15, h * 0.40);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(w * 0.16, h * 0.41);
  ctx.bezierCurveTo(w * 0.13, h * 0.46, w * 0.11, h * 0.54, w * 0.12, h * 0.58);
  ctx.lineTo(w * 0.15, h * 0.54);
  ctx.bezierCurveTo(w * 0.15, h * 0.48, w * 0.16, h * 0.44, w * 0.18, h * 0.42);
  ctx.closePath();
  ctx.fill();
  // Fang tips (bright — ivory)
  ctx.fillStyle = 'rgb(220,210,195)';
  fillCircle(ctx, w * 0.08, h * 0.55, w * 0.006);
  fillCircle(ctx, w * 0.12, h * 0.58, w * 0.006);

  // Pedipalps
  drawLimb(ctx, w * 0.15, h * 0.36, w * 0.10, h * 0.32, w * 0.06, h * 0.28, w * 0.008, 'rgb(120,105,170)');
  drawLimb(ctx, w * 0.17, h * 0.37, w * 0.12, h * 0.34, w * 0.07, h * 0.32, w * 0.008, 'rgb(120,105,170)');

  // === LAYER 6: Near-side legs (on top of body) ===
  const nearLegColor = 'rgb(150,135,215)';
  const nearLegs: [number, number, number, number, number, number][] = [
    [0.26, 0.46, 0.16, 0.28, 0.06, 0.12],
    [0.30, 0.48, 0.20, 0.38, 0.08, 0.26],
    [0.40, 0.52, 0.30, 0.66, 0.18, 0.80],
    [0.42, 0.55, 0.38, 0.72, 0.32, 0.90],
  ];
  for (const [x0, y0, cx, cy, x1, y1] of nearLegs) {
    drawLimb(ctx, w * x0, h * y0, w * cx, h * cy, w * x1, h * y1, w * 0.020, nearLegColor);
  }

  // Leg hair bristles (short marks along near legs)
  for (const [x0, y0, cx, cy, x1, y1] of nearLegs) {
    for (let t = 0.2; t < 0.9; t += 0.15) {
      const mt = 1 - t;
      const px = mt * mt * x0 + 2 * mt * t * cx + t * t * x1;
      const py = mt * mt * y0 + 2 * mt * t * cy + t * t * y1;
      ctx.strokeStyle = 'rgb(100,85,155)';
      ctx.lineWidth = w * 0.003;
      ctx.beginPath();
      ctx.moveTo(w * px, h * py);
      ctx.lineTo(w * (px + 0.015), h * (py - 0.02));
      ctx.moveTo(w * px, h * py);
      ctx.lineTo(w * (px - 0.015), h * (py + 0.02));
      ctx.stroke();
    }
  }

  // Leg tips
  ctx.fillStyle = 'rgb(120,105,170)';
  for (const [,,,, x1, y1] of nearLegs) {
    fillCircle(ctx, w * x1, h * y1, w * 0.010);
  }

  // Spinnerets — silk thread
  ctx.strokeStyle = 'rgba(160,150,210,0.35)';
  ctx.lineWidth = w * 0.004;
  ctx.beginPath();
  ctx.moveTo(w * 0.78, h * 0.56);
  ctx.bezierCurveTo(w * 0.84, h * 0.60, w * 0.90, h * 0.65, w * 0.96, h * 0.72);
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

  // === TEXTURE PASS ===

  // 1. Vertical fold lines on robe (dark cloth texture)
  ctx.strokeStyle = 'rgba(30,20,15,0.30)';
  ctx.lineWidth = w * 0.003;
  for (let i = 0; i < 8; i++) {
    const fx = w * (0.20 + i * 0.05);
    const startY = h * (0.35 + i * 0.02);
    const endY = h * (0.90 + Math.random() * 0.06);
    ctx.beginPath();
    ctx.moveTo(fx, startY);
    ctx.bezierCurveTo(fx - w * 0.005, startY + (endY - startY) * 0.4,
                       fx + w * 0.005, startY + (endY - startY) * 0.7,
                       fx - w * 0.003, endY);
    ctx.stroke();
  }

  // 2. Bone texture on skull — thin crack lines
  ctx.strokeStyle = 'rgba(140,130,100,0.40)';
  ctx.lineWidth = w * 0.002;
  ctx.beginPath();
  // Forehead cracks
  ctx.moveTo(w * 0.33, h * 0.10);
  ctx.lineTo(w * 0.36, h * 0.14);
  ctx.moveTo(w * 0.38, h * 0.09);
  ctx.lineTo(w * 0.40, h * 0.13);
  ctx.moveTo(w * 0.35, h * 0.12);
  ctx.lineTo(w * 0.38, h * 0.15);
  // Cheek cracks
  ctx.moveTo(w * 0.30, h * 0.18);
  ctx.lineTo(w * 0.32, h * 0.20);
  ctx.moveTo(w * 0.40, h * 0.18);
  ctx.lineTo(w * 0.42, h * 0.20);
  ctx.stroke();

  // 3. Necrotic green eyes — MUCH brighter with large glow halos
  ctx.save();
  ctx.globalAlpha = 0.30;
  ctx.fillStyle = 'rgb(80,255,40)';
  fillCircle(ctx, w * 0.32, h * 0.16, w * 0.04); // left eye outer halo
  fillCircle(ctx, w * 0.40, h * 0.16, w * 0.04); // right eye outer halo
  ctx.restore();
  ctx.save();
  ctx.globalAlpha = 0.50;
  ctx.fillStyle = 'rgb(120,255,80)';
  fillCircle(ctx, w * 0.32, h * 0.16, w * 0.025); // left eye inner halo
  fillCircle(ctx, w * 0.40, h * 0.16, w * 0.025); // right eye inner halo
  ctx.restore();
  // Hot bright core
  ctx.fillStyle = 'rgb(180,255,150)';
  fillCircle(ctx, w * 0.32, h * 0.16, w * 0.008);
  fillCircle(ctx, w * 0.40, h * 0.16, w * 0.008);
  ctx.fillStyle = 'rgb(230,255,220)';
  fillCircle(ctx, w * 0.32, h * 0.16, w * 0.004);
  fillCircle(ctx, w * 0.40, h * 0.16, w * 0.004);

  // 4. Highlight on staff skull
  highlight(ctx, w * 0.71, h * 0.04, w * 0.02, 'rgb(255,255,230)', 0.35);
  // Staff skull eye glow (bigger)
  ctx.save();
  ctx.globalAlpha = 0.35;
  ctx.fillStyle = 'rgb(100,255,60)';
  fillCircle(ctx, w * 0.70, h * 0.05, w * 0.015);
  fillCircle(ctx, w * 0.74, h * 0.05, w * 0.015);
  ctx.restore();

  // 5. Ambient occlusion — hood meets robe, hand extends
  ambientOcclusion(ctx, w * 0.35, h * 0.28, w * 0.08, h * 0.03, 0.25); // hood meets robe
  ambientOcclusion(ctx, w * 0.28, h * 0.38, w * 0.04, h * 0.03, 0.20); // left hand extends from robe
  ambientOcclusion(ctx, w * 0.48, h * 0.38, w * 0.04, h * 0.03, 0.18); // right arm extends
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

  // === TEXTURE PASS ===

  // 1. Ambient occlusion at body part junctions
  ambientOcclusion(ctx, w * 0.18, h * 0.22, w * 0.06, h * 0.08, 0.20); // left arm / torso
  ambientOcclusion(ctx, w * 0.66, h * 0.22, w * 0.06, h * 0.08, 0.20); // right arm / torso
  ambientOcclusion(ctx, w * 0.34, h * 0.65, w * 0.07, h * 0.06, 0.25); // left leg / body
  ambientOcclusion(ctx, w * 0.52, h * 0.65, w * 0.07, h * 0.06, 0.25); // right leg / body

  // 2. Stone texture — cracks and plate lines across torso and limbs
  stoneTexture(ctx, w * 0.20, h * 0.14, w * 0.44, h * 0.48, 18,
    'rgb(60,55,45)', 'rgba(210,205,190,0.35)');
  stoneTexture(ctx, w * 0.04, h * 0.22, w * 0.14, h * 0.46, 8,
    'rgb(55,50,40)', 'rgba(200,195,175,0.30)'); // left arm
  stoneTexture(ctx, w * 0.66, h * 0.22, w * 0.14, h * 0.46, 8,
    'rgb(50,45,38)', 'rgba(190,185,165,0.30)'); // right arm
  stoneTexture(ctx, w * 0.28, h * 0.64, w * 0.12, h * 0.24, 5,
    'rgb(55,50,40)', 'rgba(195,190,170,0.25)'); // left leg
  stoneTexture(ctx, w * 0.46, h * 0.64, w * 0.12, h * 0.24, 5,
    'rgb(50,45,38)', 'rgba(185,180,160,0.25)'); // right leg

  // 3. Highlight spots — shoulders, chest plates
  highlight(ctx, w * 0.24, h * 0.16, w * 0.04, 'rgb(220,215,200)', 0.25); // left shoulder
  highlight(ctx, w * 0.60, h * 0.16, w * 0.04, 'rgb(210,205,190)', 0.20); // right shoulder
  highlight(ctx, w * 0.42, h * 0.28, w * 0.05, 'rgb(215,210,195)', 0.18); // chest plate center
  highlight(ctx, w * 0.34, h * 0.22, w * 0.03, 'rgb(210,205,190)', 0.15); // chest plate left
  highlight(ctx, w * 0.50, h * 0.22, w * 0.03, 'rgb(210,205,190)', 0.15); // chest plate right

  // 4. Brighter eyes with glow halos
  // Glow halo behind eye slits
  ctx.save();
  ctx.globalAlpha = 0.35;
  ctx.fillStyle = 'rgb(255,180,40)';
  fillEllipse(ctx, w * 0.365, h * 0.06, w * 0.05, h * 0.03);
  fillEllipse(ctx, w * 0.475, h * 0.06, w * 0.05, h * 0.03);
  ctx.restore();
  // Brighter eye slits on top
  ctx.fillStyle = 'rgb(255,230,120)';
  ctx.fillRect(w * 0.345, h * 0.052, w * 0.045, h * 0.016);
  ctx.fillRect(w * 0.455, h * 0.052, w * 0.045, h * 0.016);
  // Hot white core
  ctx.fillStyle = 'rgb(255,255,220)';
  ctx.fillRect(w * 0.35, h * 0.055, w * 0.035, h * 0.010);
  ctx.fillRect(w * 0.46, h * 0.055, w * 0.035, h * 0.010);
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

  // === TEXTURE PASS ===

  // 1. Veiny/sinew lines across the lean torso (thin semi-transparent dark strokes)
  ctx.strokeStyle = 'rgba(100,110,140,0.35)';
  ctx.lineWidth = w * 0.002;
  ctx.beginPath();
  // Sinew lines across chest/torso
  ctx.moveTo(w * 0.28, h * 0.30);
  ctx.quadraticCurveTo(w * 0.36, h * 0.28, w * 0.44, h * 0.30);
  ctx.moveTo(w * 0.26, h * 0.38);
  ctx.quadraticCurveTo(w * 0.34, h * 0.36, w * 0.46, h * 0.38);
  ctx.moveTo(w * 0.27, h * 0.46);
  ctx.quadraticCurveTo(w * 0.35, h * 0.44, w * 0.48, h * 0.46);
  ctx.moveTo(w * 0.30, h * 0.26);
  ctx.bezierCurveTo(w * 0.32, h * 0.32, w * 0.30, h * 0.40, w * 0.28, h * 0.48);
  ctx.moveTo(w * 0.42, h * 0.26);
  ctx.bezierCurveTo(w * 0.44, h * 0.34, w * 0.46, h * 0.42, w * 0.48, h * 0.50);
  ctx.stroke();

  // 2. Ribs more prominent — thicker, brighter strokes over existing ribs
  ctx.strokeStyle = 'rgba(200,210,230,0.40)';
  ctx.lineWidth = w * 0.005;
  for (let i = 0; i < 5; i++) {
    const ry = 0.32 + i * 0.05;
    ctx.beginPath();
    ctx.moveTo(w * 0.28, h * ry);
    ctx.quadraticCurveTo(w * 0.38, h * (ry + 0.012), w * 0.48, h * ry);
    ctx.stroke();
  }
  // Highlight ridges on ribs
  ctx.strokeStyle = 'rgba(230,240,255,0.25)';
  ctx.lineWidth = w * 0.002;
  for (let i = 0; i < 5; i++) {
    const ry = 0.317 + i * 0.05;
    ctx.beginPath();
    ctx.moveTo(w * 0.30, h * ry);
    ctx.quadraticCurveTo(w * 0.38, h * (ry + 0.008), w * 0.46, h * ry);
    ctx.stroke();
  }

  // 3. Icy blue eyes — MUCH brighter with cold glow halos
  ctx.save();
  ctx.globalAlpha = 0.30;
  ctx.fillStyle = 'rgb(150,220,255)';
  fillCircle(ctx, w * 0.14, h * 0.17, w * 0.035); // left eye outer halo
  fillCircle(ctx, w * 0.20, h * 0.17, w * 0.035); // right eye outer halo
  ctx.restore();
  ctx.save();
  ctx.globalAlpha = 0.50;
  ctx.fillStyle = 'rgb(180,240,255)';
  fillCircle(ctx, w * 0.14, h * 0.17, w * 0.020); // left eye inner halo
  fillCircle(ctx, w * 0.20, h * 0.17, w * 0.020); // right eye inner halo
  ctx.restore();
  // Hot white eye cores
  ctx.fillStyle = 'rgb(230,250,255)';
  fillCircle(ctx, w * 0.14, h * 0.17, w * 0.010);
  fillCircle(ctx, w * 0.20, h * 0.17, w * 0.010);
  ctx.fillStyle = 'rgb(255,255,255)';
  fillCircle(ctx, w * 0.14, h * 0.17, w * 0.005);
  fillCircle(ctx, w * 0.20, h * 0.17, w * 0.005);

  // 4. Highlight on claws
  highlight(ctx, w * 0.14, h * 0.72, w * 0.015, 'rgb(240,248,255)', 0.45); // left claw tips
  highlight(ctx, w * 0.62, h * 0.68, w * 0.015, 'rgb(240,248,255)', 0.45); // right claw tips
  // Foot claw highlights
  highlight(ctx, w * 0.28, h * 0.94, w * 0.010, 'rgb(235,245,255)', 0.35);
  highlight(ctx, w * 0.50, h * 0.94, w * 0.010, 'rgb(235,245,255)', 0.35);

  // 5. Ambient occlusion — arms meet torso, hip joints
  ambientOcclusion(ctx, w * 0.28, h * 0.40, w * 0.04, h * 0.04, 0.22); // left arm/torso
  ambientOcclusion(ctx, w * 0.48, h * 0.38, w * 0.04, h * 0.04, 0.22); // right arm/torso
  ambientOcclusion(ctx, w * 0.32, h * 0.56, w * 0.05, h * 0.04, 0.25); // left hip joint
  ambientOcclusion(ctx, w * 0.44, h * 0.56, w * 0.05, h * 0.04, 0.25); // right hip joint
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

  // === TEXTURE PASS ===

  // 1. Scale texture across body and neck — reptile scales
  scaleTexture(ctx, w * 0.30, h * 0.34, w * 0.40, h * 0.28, w * 0.025,
    'rgba(55,30,70,0.45)', 'rgba(210,150,240,0.25)', 0.7); // body scales
  scaleTexture(ctx, w * 0.14, h * 0.18, w * 0.18, h * 0.22, w * 0.018,
    'rgba(60,35,75,0.40)', 'rgba(200,140,230,0.22)', 0.8); // neck scales
  scaleTexture(ctx, w * 0.68, h * 0.44, w * 0.24, h * 0.16, w * 0.020,
    'rgba(50,28,65,0.40)', 'rgba(180,120,210,0.20)', 0.6); // tail scales

  // 2. Wing vein detail — dark purple lines across wing membrane
  ctx.strokeStyle = 'rgba(50,25,65,0.40)';
  ctx.lineWidth = w * 0.003;
  ctx.beginPath();
  // Near wing veins between bone structure
  ctx.moveTo(w * 0.30, h * 0.15);
  ctx.quadraticCurveTo(w * 0.25, h * 0.20, w * 0.22, h * 0.22);
  ctx.moveTo(w * 0.28, h * 0.10);
  ctx.quadraticCurveTo(w * 0.22, h * 0.14, w * 0.18, h * 0.12);
  ctx.moveTo(w * 0.34, h * 0.22);
  ctx.quadraticCurveTo(w * 0.30, h * 0.26, w * 0.28, h * 0.28);
  ctx.moveTo(w * 0.25, h * 0.08);
  ctx.quadraticCurveTo(w * 0.20, h * 0.12, w * 0.15, h * 0.10);
  ctx.moveTo(w * 0.32, h * 0.18);
  ctx.quadraticCurveTo(w * 0.27, h * 0.22, w * 0.24, h * 0.20);
  ctx.stroke();
  // Far wing veins
  ctx.strokeStyle = 'rgba(45,22,58,0.30)';
  ctx.lineWidth = w * 0.002;
  ctx.beginPath();
  ctx.moveTo(w * 0.58, h * 0.18);
  ctx.quadraticCurveTo(w * 0.62, h * 0.14, w * 0.64, h * 0.10);
  ctx.moveTo(w * 0.57, h * 0.24);
  ctx.quadraticCurveTo(w * 0.60, h * 0.20, w * 0.62, h * 0.18);
  ctx.stroke();

  // 3. Wing membrane internal highlights — translucent look
  ctx.save();
  ctx.globalAlpha = 0.12;
  ctx.fillStyle = 'rgb(200,160,230)';
  fillEllipse(ctx, w * 0.28, h * 0.16, w * 0.06, h * 0.04);
  fillEllipse(ctx, w * 0.22, h * 0.10, w * 0.04, h * 0.03);
  fillEllipse(ctx, w * 0.34, h * 0.28, w * 0.03, h * 0.03);
  ctx.restore();

  // 4. Amber eye — bigger and brighter with glow
  ctx.save();
  ctx.globalAlpha = 0.35;
  ctx.fillStyle = 'rgb(255,200,60)';
  fillCircle(ctx, w * 0.095, h * 0.18, w * 0.03); // outer glow halo
  ctx.restore();
  ctx.save();
  ctx.globalAlpha = 0.55;
  ctx.fillStyle = 'rgb(255,220,100)';
  fillCircle(ctx, w * 0.095, h * 0.18, w * 0.018); // inner glow
  ctx.restore();
  ctx.fillStyle = 'rgb(255,240,160)';
  fillCircle(ctx, w * 0.095, h * 0.18, w * 0.010); // bright core
  ctx.fillStyle = 'rgb(255,255,220)';
  fillCircle(ctx, w * 0.095, h * 0.18, w * 0.005); // hot center
  // Vertical slit pupil
  ctx.strokeStyle = 'rgb(40,20,10)';
  ctx.lineWidth = w * 0.003;
  ctx.beginPath();
  ctx.moveTo(w * 0.095, h * 0.170);
  ctx.lineTo(w * 0.095, h * 0.190);
  ctx.stroke();

  // 5. Ambient occlusion — wing attach points, neck meets body
  ambientOcclusion(ctx, w * 0.40, h * 0.38, w * 0.06, h * 0.04, 0.25); // near wing base
  ambientOcclusion(ctx, w * 0.55, h * 0.36, w * 0.05, h * 0.03, 0.20); // far wing base
  ambientOcclusion(ctx, w * 0.32, h * 0.40, w * 0.05, h * 0.04, 0.22); // neck meets body

  // 6. Highlight on horns and teeth
  highlight(ctx, w * 0.18, h * 0.08, w * 0.012, 'rgb(255,230,150)', 0.40); // left horn tip
  highlight(ctx, w * 0.22, h * 0.06, w * 0.012, 'rgb(255,225,140)', 0.40); // right horn tip
  highlight(ctx, w * 0.06, h * 0.23, w * 0.008, 'rgb(255,245,220)', 0.35); // teeth highlights
  highlight(ctx, w * 0.08, h * 0.23, w * 0.008, 'rgb(255,245,220)', 0.35);
}

// ---------------------------------------------------------------------------
// 11. Basilisk — L12, Boss, Warrior — Earthy brown, yellow belly, red accents
// Side view: massive serpent king, enormous head, crowned, coiling body
// ---------------------------------------------------------------------------
function drawBasilisk(ctx: CanvasRenderingContext2D, w: number, h: number) {
  // === LAYER 1: Base shapes ===

  // Lower coil — massive serpentine form
  ctx.fillStyle = bodyGrad(ctx, w * 0.55, h * 0.58, w * 0.28, 170, 120, 55, 145, 100, 40);
  ctx.beginPath();
  ctx.moveTo(w * 0.28, h * 0.58);
  ctx.bezierCurveTo(w * 0.38, h * 0.76, w * 0.60, h * 0.82, w * 0.78, h * 0.72);
  ctx.bezierCurveTo(w * 0.88, h * 0.65, w * 0.90, h * 0.52, w * 0.82, h * 0.46);
  ctx.bezierCurveTo(w * 0.74, h * 0.40, w * 0.58, h * 0.42, w * 0.48, h * 0.48);
  ctx.bezierCurveTo(w * 0.40, h * 0.53, w * 0.33, h * 0.54, w * 0.28, h * 0.50);
  ctx.closePath();
  ctx.fill();

  // Upper body — rising from coil
  ctx.fillStyle = bodyGrad(ctx, w * 0.28, h * 0.30, w * 0.18, 195, 145, 70, 170, 120, 55);
  ctx.beginPath();
  ctx.moveTo(w * 0.32, h * 0.52);
  ctx.bezierCurveTo(w * 0.26, h * 0.44, w * 0.20, h * 0.34, w * 0.18, h * 0.24);
  ctx.bezierCurveTo(w * 0.16, h * 0.16, w * 0.20, h * 0.12, w * 0.28, h * 0.14);
  ctx.bezierCurveTo(w * 0.36, h * 0.16, w * 0.40, h * 0.28, w * 0.42, h * 0.38);
  ctx.bezierCurveTo(w * 0.44, h * 0.44, w * 0.40, h * 0.50, w * 0.32, h * 0.52);
  ctx.closePath();
  ctx.fill();

  // === LAYER 2: Ambient occlusion at overlaps ===
  ambientOcclusion(ctx, w * 0.34, h * 0.52, w * 0.08, h * 0.04, 0.3);
  ambientOcclusion(ctx, w * 0.48, h * 0.48, w * 0.06, h * 0.03, 0.25);
  ambientOcclusion(ctx, w * 0.82, h * 0.50, w * 0.05, h * 0.04, 0.2);

  // === LAYER 3: Scale texture — the detail that makes it real ===
  // Upper body scales
  scaleTexture(ctx, w * 0.18, h * 0.14, w * 0.24, h * 0.38, w * 0.025,
    'rgb(80,55,20)', 'rgb(210,165,80)', 0.8);
  // Lower coil scales
  scaleTexture(ctx, w * 0.30, h * 0.44, w * 0.56, h * 0.36, w * 0.028,
    'rgb(75,50,18)', 'rgb(200,155,70)', 0.75);

  // === LAYER 4: Belly — yellowish underbelly with horizontal bands ===
  ctx.fillStyle = 'rgba(220,200,100,0.25)';
  ctx.beginPath();
  ctx.moveTo(w * 0.22, h * 0.22);
  ctx.bezierCurveTo(w * 0.24, h * 0.32, w * 0.28, h * 0.42, w * 0.34, h * 0.50);
  ctx.lineTo(w * 0.28, h * 0.50);
  ctx.bezierCurveTo(w * 0.22, h * 0.40, w * 0.18, h * 0.30, w * 0.17, h * 0.22);
  ctx.closePath();
  ctx.fill();
  // Belly scute lines (lighter)
  ctx.strokeStyle = 'rgba(200,180,80,0.3)';
  ctx.lineWidth = w * 0.003;
  for (let i = 0; i < 10; i++) {
    const by = 0.20 + i * 0.03;
    ctx.beginPath();
    ctx.moveTo(w * (0.19 + i * 0.005), h * by);
    ctx.lineTo(w * (0.26 + i * 0.005), h * by);
    ctx.stroke();
  }

  // === LAYER 5: Dorsal spines — silhouette breakers ===
  for (let i = 0; i < 12; i++) {
    const t = i / 11;
    // Spine positions along the upper body curve
    const sx = 0.20 + t * 0.50;
    const sy = 0.16 + Math.sin(t * Math.PI * 0.7) * 0.25;
    const spineH = (0.04 + (1 - t) * 0.03) * (i < 5 ? 1.4 : 1.0);
    // Dark base
    ctx.fillStyle = 'rgb(60,40,15)';
    ctx.beginPath();
    ctx.moveTo(w * (sx - 0.008), h * sy);
    ctx.lineTo(w * sx, h * (sy - spineH));
    ctx.lineTo(w * (sx + 0.008), h * sy);
    ctx.closePath();
    ctx.fill();
    // Light edge
    ctx.fillStyle = 'rgb(160,120,50)';
    ctx.beginPath();
    ctx.moveTo(w * (sx + 0.002), h * sy);
    ctx.lineTo(w * (sx + 0.005), h * (sy - spineH * 0.8));
    ctx.lineTo(w * (sx + 0.008), h * sy);
    ctx.closePath();
    ctx.fill();
  }

  // === LAYER 6: Head — massive, angular ===
  ctx.fillStyle = bodyGrad(ctx, w * 0.16, h * 0.14, w * 0.13, 185, 135, 65, 160, 115, 50);
  ctx.beginPath();
  ctx.moveTo(w * 0.22, h * 0.08);
  ctx.bezierCurveTo(w * 0.16, h * 0.04, w * 0.06, h * 0.06, w * 0.02, h * 0.12);
  ctx.bezierCurveTo(w * 0.00, h * 0.18, w * 0.02, h * 0.24, w * 0.08, h * 0.27);
  ctx.bezierCurveTo(w * 0.14, h * 0.29, w * 0.24, h * 0.27, w * 0.28, h * 0.20);
  ctx.bezierCurveTo(w * 0.30, h * 0.14, w * 0.28, h * 0.10, w * 0.22, h * 0.08);
  ctx.fill();
  // Head scale texture
  scaleTexture(ctx, w * 0.04, h * 0.06, w * 0.22, h * 0.18, w * 0.018,
    'rgb(90,60,25)', 'rgb(220,175,85)', 0.7);

  // Brow ridge — heavy, menacing
  ctx.fillStyle = 'rgb(120,85,35)';
  ctx.beginPath();
  ctx.moveTo(w * 0.06, h * 0.10);
  ctx.bezierCurveTo(w * 0.10, h * 0.07, w * 0.20, h * 0.07, w * 0.24, h * 0.10);
  ctx.lineTo(w * 0.22, h * 0.12);
  ctx.bezierCurveTo(w * 0.16, h * 0.09, w * 0.10, h * 0.09, w * 0.08, h * 0.12);
  ctx.closePath();
  ctx.fill();

  // Crown/crest — FIVE spikes (VIVID RED boss marker)
  ctx.fillStyle = 'rgb(240,55,40)';
  ctx.beginPath();
  ctx.moveTo(w * 0.08, h * 0.08);
  ctx.lineTo(w * 0.07, h * -0.02);
  ctx.lineTo(w * 0.10, h * 0.04);
  ctx.lineTo(w * 0.12, h * -0.05);
  ctx.lineTo(w * 0.15, h * 0.02);
  ctx.lineTo(w * 0.17, h * -0.04);
  ctx.lineTo(w * 0.20, h * 0.01);
  ctx.lineTo(w * 0.22, h * -0.02);
  ctx.lineTo(w * 0.24, h * 0.06);
  ctx.closePath();
  ctx.fill();

  // === LAYER 7: Eyes — LARGE, glowing, the brightest thing ===
  // Eye glow halo
  highlight(ctx, w * 0.09, h * 0.14, w * 0.035, 'rgb(200,255,60)', 0.3);
  highlight(ctx, w * 0.19, h * 0.14, w * 0.035, 'rgb(200,255,60)', 0.3);
  // Eye orbs (bright green — like the reference basilisk!)
  ctx.fillStyle = 'rgb(140,255,50)';
  fillCircle(ctx, w * 0.09, h * 0.14, w * 0.024);
  fillCircle(ctx, w * 0.19, h * 0.14, w * 0.024);
  // Vertical slit pupils
  ctx.fillStyle = 'rgb(10,5,0)';
  ctx.fillRect(w * 0.087, h * 0.12, w * 0.006, h * 0.04);
  ctx.fillRect(w * 0.187, h * 0.12, w * 0.006, h * 0.04);
  // Eye highlights (white specular)
  ctx.fillStyle = 'rgb(255,255,240)';
  fillCircle(ctx, w * 0.085, h * 0.132, w * 0.006);
  fillCircle(ctx, w * 0.185, h * 0.132, w * 0.006);

  // === LAYER 8: Jaw — open, teeth, tongue ===
  ctx.fillStyle = 'rgb(120,75,35)';
  ctx.beginPath();
  ctx.moveTo(w * 0.04, h * 0.21);
  ctx.bezierCurveTo(w * -0.01, h * 0.26, w * -0.01, h * 0.33, w * 0.04, h * 0.35);
  ctx.bezierCurveTo(w * 0.12, h * 0.37, w * 0.22, h * 0.33, w * 0.25, h * 0.27);
  ctx.closePath();
  ctx.fill();
  // Mouth interior (dark red-black)
  ctx.fillStyle = 'rgb(40,10,10)';
  ctx.beginPath();
  ctx.moveTo(w * 0.06, h * 0.23);
  ctx.bezierCurveTo(w * 0.04, h * 0.27, w * 0.06, h * 0.31, w * 0.10, h * 0.32);
  ctx.bezierCurveTo(w * 0.16, h * 0.30, w * 0.20, h * 0.27, w * 0.18, h * 0.24);
  ctx.closePath();
  ctx.fill();

  // Large fangs (bright ivory — focal point)
  ctx.fillStyle = 'rgb(245,235,215)';
  ctx.beginPath();
  ctx.moveTo(w * 0.07, h * 0.21);
  ctx.lineTo(w * 0.04, h * 0.32);
  ctx.lineTo(w * 0.09, h * 0.23);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(w * 0.19, h * 0.21);
  ctx.lineTo(w * 0.22, h * 0.32);
  ctx.lineTo(w * 0.17, h * 0.23);
  ctx.fill();
  // Smaller teeth
  ctx.fillStyle = 'rgb(225,215,195)';
  for (let i = 0; i < 6; i++) {
    const tx = 0.08 + i * 0.018;
    ctx.beginPath();
    ctx.moveTo(w * tx, h * 0.22);
    ctx.lineTo(w * (tx + 0.004), h * 0.27);
    ctx.lineTo(w * (tx + 0.01), h * 0.22);
    ctx.fill();
  }

  // Forked tongue (deep red)
  ctx.strokeStyle = 'rgb(200,50,40)';
  ctx.lineWidth = w * 0.006;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(w * 0.05, h * 0.27);
  ctx.bezierCurveTo(w * 0.01, h * 0.30, w * -0.02, h * 0.28, w * -0.04, h * 0.25);
  ctx.moveTo(w * 0.01, h * 0.29);
  ctx.bezierCurveTo(w * -0.02, h * 0.33, w * -0.05, h * 0.32, w * -0.06, h * 0.30);
  ctx.stroke();

  // === LAYER 9: Tail tip ===
  ctx.fillStyle = bodyGrad(ctx, w * 0.90, h * 0.50, w * 0.08, 130, 90, 35, 100, 65, 25);
  ctx.beginPath();
  ctx.moveTo(w * 0.86, h * 0.52);
  ctx.bezierCurveTo(w * 0.92, h * 0.48, w * 0.96, h * 0.44, w * 1.00, h * 0.40);
  ctx.bezierCurveTo(w * 0.98, h * 0.44, w * 0.94, h * 0.52, w * 0.86, h * 0.56);
  ctx.closePath();
  ctx.fill();

  // === LAYER 10: Body highlights — muscle definition ===
  highlight(ctx, w * 0.26, h * 0.28, w * 0.04, 'rgb(240,200,100)', 0.2);
  highlight(ctx, w * 0.55, h * 0.56, w * 0.05, 'rgb(230,190,90)', 0.15);
  highlight(ctx, w * 0.72, h * 0.60, w * 0.04, 'rgb(220,180,80)', 0.15);
  highlight(ctx, w * 0.40, h * 0.70, w * 0.05, 'rgb(210,170,70)', 0.12);
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
