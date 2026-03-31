/**
 * Monster silhouette templates for ASCII rendering.
 *
 * Each template draws a brightness field (white/gray on black) to a canvas.
 * The renderer evaluates these at 256px resolution, so use detailed shapes
 * with gradients for 3D shading. Smooth curves and gradient fills translate
 * into varied character densities in the ASCII output.
 *
 * Design notes:
 * - Radial gradients create 3D depth (bright center, dark edges)
 * - Multiple overlapping shapes build layered silhouettes
 * - Edge fade-off makes clean boundaries in the ASCII grid
 * - Internal details (eyes, markings) show as bright points
 */

export type MonsterTemplate = {
  id: string;
  name: string;
  /** Aspect ratio width — used to maintain proportions, NOT rendering resolution */
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

/** Radial gradient for 3D body shading: bright center, dark edges */
function bodyGradient(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, r: number,
  core?: string, mid?: string, edge?: string,
): CanvasGradient {
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
  g.addColorStop(0, core ?? '#fff');
  g.addColorStop(0.5, mid ?? '#ccc');
  g.addColorStop(0.85, edge ?? '#777');
  g.addColorStop(1, '#222');
  return g;
}

/** Fill an ellipse */
function fillEllipse(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, rx: number, ry: number,
) {
  ctx.beginPath();
  ctx.ellipse(cx, cy, Math.max(1, rx), Math.max(1, ry), 0, 0, Math.PI * 2);
  ctx.fill();
}

/** Fill a circle */
function fillCircle(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  fillEllipse(ctx, cx, cy, r, r);
}

// ---------------------------------------------------------------------------
// 1. Dire Rat — L1, Rogue (class 1)
// Side profile: hunched body, pointed snout, curving tail, stub legs
// ---------------------------------------------------------------------------
function drawDireRat(ctx: CanvasRenderingContext2D, w: number, h: number) {
  // Body — large horizontal mass with gradient shading
  ctx.fillStyle = bodyGradient(ctx, w * 0.42, h * 0.48, w * 0.25);
  fillEllipse(ctx, w * 0.42, h * 0.48, w * 0.24, h * 0.22);

  // Haunch — rear bump
  ctx.fillStyle = bodyGradient(ctx, w * 0.58, h * 0.46, w * 0.14);
  fillEllipse(ctx, w * 0.58, h * 0.46, w * 0.14, h * 0.18);

  // Head — rounded with gradient
  ctx.fillStyle = bodyGradient(ctx, w * 0.17, h * 0.4, w * 0.12);
  fillCircle(ctx, w * 0.17, h * 0.4, w * 0.11);

  // Neck/shoulder connection
  ctx.fillStyle = '#bbb';
  ctx.beginPath();
  ctx.moveTo(w * 0.24, h * 0.32);
  ctx.quadraticCurveTo(w * 0.32, h * 0.3, w * 0.36, h * 0.34);
  ctx.lineTo(w * 0.34, h * 0.58);
  ctx.quadraticCurveTo(w * 0.28, h * 0.6, w * 0.24, h * 0.54);
  ctx.closePath();
  ctx.fill();

  // Snout — tapered point
  ctx.fillStyle = '#ccc';
  ctx.beginPath();
  ctx.moveTo(w * 0.1, h * 0.38);
  ctx.quadraticCurveTo(w * 0.04, h * 0.39, w * 0.01, h * 0.4);
  ctx.quadraticCurveTo(w * 0.04, h * 0.44, w * 0.1, h * 0.46);
  ctx.closePath();
  ctx.fill();

  // Nose dot
  ctx.fillStyle = '#fff';
  fillCircle(ctx, w * 0.03, h * 0.41, w * 0.012);

  // Ears — two triangular peaks
  ctx.fillStyle = '#bbb';
  ctx.beginPath();
  ctx.moveTo(w * 0.12, h * 0.32);
  ctx.quadraticCurveTo(w * 0.1, h * 0.18, w * 0.14, h * 0.15);
  ctx.quadraticCurveTo(w * 0.18, h * 0.2, w * 0.19, h * 0.3);
  ctx.closePath();
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(w * 0.19, h * 0.3);
  ctx.quadraticCurveTo(w * 0.18, h * 0.14, w * 0.22, h * 0.12);
  ctx.quadraticCurveTo(w * 0.26, h * 0.18, w * 0.25, h * 0.28);
  ctx.closePath();
  ctx.fill();

  // Eye — bright
  ctx.fillStyle = '#fff';
  fillCircle(ctx, w * 0.13, h * 0.37, w * 0.018);

  // Tail — long, curving upward, thinning
  ctx.strokeStyle = '#999';
  ctx.lineCap = 'round';
  ctx.lineWidth = w * 0.025;
  ctx.beginPath();
  ctx.moveTo(w * 0.68, h * 0.44);
  ctx.bezierCurveTo(w * 0.76, h * 0.36, w * 0.84, h * 0.24, w * 0.96, h * 0.14);
  ctx.stroke();
  // Thinner tail tip
  ctx.strokeStyle = '#666';
  ctx.lineWidth = w * 0.012;
  ctx.beginPath();
  ctx.moveTo(w * 0.88, h * 0.2);
  ctx.quadraticCurveTo(w * 0.94, h * 0.12, w * 0.98, h * 0.08);
  ctx.stroke();

  // Legs — four stubs with gradient
  ctx.lineCap = 'round';
  for (const [lx, angle] of [[0.28, 0.05], [0.36, 0.02], [0.48, -0.02], [0.56, -0.04]] as [number, number][]) {
    ctx.strokeStyle = '#999';
    ctx.lineWidth = w * 0.022;
    ctx.beginPath();
    ctx.moveTo(w * lx, h * 0.64);
    ctx.lineTo(w * (lx + angle), h * 0.84);
    ctx.stroke();
    // Paw
    ctx.fillStyle = '#888';
    fillCircle(ctx, w * (lx + angle), h * 0.85, w * 0.015);
  }

  // Whiskers
  ctx.strokeStyle = '#555';
  ctx.lineWidth = w * 0.005;
  ctx.beginPath();
  ctx.moveTo(w * 0.08, h * 0.4);
  ctx.lineTo(w * 0.0, h * 0.35);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(w * 0.08, h * 0.42);
  ctx.lineTo(w * 0.0, h * 0.44);
  ctx.stroke();
}

// ---------------------------------------------------------------------------
// 2. Fungal Shaman — L2, Mage (class 2)
// Front view: large mushroom cap, thin stem, staff, base tendrils
// ---------------------------------------------------------------------------
function drawFungalShaman(ctx: CanvasRenderingContext2D, w: number, h: number) {
  // Mushroom cap — large dome with shading
  ctx.fillStyle = bodyGradient(ctx, w * 0.45, h * 0.22, w * 0.35, '#fff', '#ccc', '#666');
  ctx.beginPath();
  ctx.ellipse(w * 0.45, h * 0.25, w * 0.34, h * 0.2, 0, Math.PI, Math.PI * 2);
  ctx.fill();

  // Cap rim / gills — dimmer
  ctx.fillStyle = '#888';
  ctx.beginPath();
  ctx.ellipse(w * 0.45, h * 0.26, w * 0.34, h * 0.04, 0, 0, Math.PI);
  ctx.fill();

  // Gill lines
  ctx.strokeStyle = '#555';
  ctx.lineWidth = w * 0.005;
  for (let i = 0; i < 8; i++) {
    const t = (i + 0.5) / 8;
    const gx = w * (0.18 + t * 0.54);
    ctx.beginPath();
    ctx.moveTo(gx, h * 0.26);
    ctx.lineTo(gx + w * 0.005, h * 0.3);
    ctx.stroke();
  }

  // Stem / body — thin with gradient
  ctx.fillStyle = bodyGradient(ctx, w * 0.45, h * 0.5, w * 0.1, '#ddd', '#aaa', '#555');
  ctx.fillRect(w * 0.38, h * 0.3, w * 0.14, h * 0.38);

  // Eyes — glowing spots under cap shadow
  ctx.fillStyle = '#fff';
  fillCircle(ctx, w * 0.4, h * 0.35, w * 0.018);
  fillCircle(ctx, w * 0.5, h * 0.35, w * 0.018);

  // Staff — to the right
  ctx.strokeStyle = '#aaa';
  ctx.lineWidth = w * 0.018;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(w * 0.72, h * 0.18);
  ctx.lineTo(w * 0.73, h * 0.82);
  ctx.stroke();

  // Staff orb — glowing
  ctx.fillStyle = bodyGradient(ctx, w * 0.72, h * 0.16, w * 0.04, '#fff', '#ddd', '#888');
  fillCircle(ctx, w * 0.72, h * 0.16, w * 0.04);

  // Arm reaching to staff
  ctx.strokeStyle = '#999';
  ctx.lineWidth = w * 0.015;
  ctx.beginPath();
  ctx.moveTo(w * 0.5, h * 0.42);
  ctx.quadraticCurveTo(w * 0.6, h * 0.4, w * 0.71, h * 0.38);
  ctx.stroke();

  // Base tendrils — root-like
  ctx.strokeStyle = '#666';
  ctx.lineWidth = w * 0.012;
  ctx.lineCap = 'round';
  for (const [sx, ex, ey] of [
    [0.38, 0.2, 0.82], [0.4, 0.25, 0.88], [0.42, 0.3, 0.85],
    [0.48, 0.6, 0.86], [0.5, 0.65, 0.82], [0.52, 0.7, 0.88],
  ] as [number, number, number][]) {
    ctx.beginPath();
    ctx.moveTo(w * sx, h * 0.68);
    ctx.quadraticCurveTo(w * ((sx + ex) / 2), h * 0.78, w * ex, h * ey);
    ctx.stroke();
  }

  // Spore particles — atmospheric
  ctx.fillStyle = '#444';
  for (const [px, py, s] of [
    [0.15, 0.5, 0.008], [0.75, 0.45, 0.007], [0.25, 0.6, 0.009],
    [0.65, 0.55, 0.006], [0.1, 0.35, 0.005], [0.82, 0.3, 0.007],
    [0.3, 0.72, 0.006], [0.6, 0.7, 0.008],
  ] as [number, number, number][]) {
    fillCircle(ctx, w * px, h * py, w * s);
  }
}

// ---------------------------------------------------------------------------
// 3. Cavern Brute — L3, Warrior (class 0)
// Front view: wide, squat, thick arms, blocky
// ---------------------------------------------------------------------------
function drawCavernBrute(ctx: CanvasRenderingContext2D, w: number, h: number) {
  // Torso — massive central mass
  ctx.fillStyle = bodyGradient(ctx, w * 0.5, h * 0.42, w * 0.32, '#fff', '#ccc', '#666');
  ctx.beginPath();
  ctx.moveTo(w * 0.2, h * 0.22);
  ctx.lineTo(w * 0.8, h * 0.22);
  ctx.quadraticCurveTo(w * 0.85, h * 0.4, w * 0.78, h * 0.58);
  ctx.lineTo(w * 0.22, h * 0.58);
  ctx.quadraticCurveTo(w * 0.15, h * 0.4, w * 0.2, h * 0.22);
  ctx.closePath();
  ctx.fill();

  // Head — blocky with brow ridge
  ctx.fillStyle = bodyGradient(ctx, w * 0.5, h * 0.12, w * 0.14, '#eee', '#bbb', '#666');
  ctx.beginPath();
  ctx.moveTo(w * 0.36, h * 0.05);
  ctx.lineTo(w * 0.64, h * 0.05);
  ctx.quadraticCurveTo(w * 0.68, h * 0.12, w * 0.66, h * 0.22);
  ctx.lineTo(w * 0.34, h * 0.22);
  ctx.quadraticCurveTo(w * 0.32, h * 0.12, w * 0.36, h * 0.05);
  ctx.closePath();
  ctx.fill();

  // Brow ridge
  ctx.fillStyle = '#ddd';
  ctx.fillRect(w * 0.34, h * 0.1, w * 0.32, h * 0.03);

  // Eyes — deep set
  ctx.fillStyle = '#fff';
  fillCircle(ctx, w * 0.43, h * 0.13, w * 0.015);
  fillCircle(ctx, w * 0.57, h * 0.13, w * 0.015);

  // Jaw
  ctx.fillStyle = '#999';
  ctx.fillRect(w * 0.38, h * 0.18, w * 0.24, h * 0.06);

  // Arms — thick, hanging at sides
  ctx.fillStyle = bodyGradient(ctx, w * 0.12, h * 0.4, w * 0.1, '#ddd', '#aaa', '#555');
  ctx.beginPath();
  ctx.moveTo(w * 0.2, h * 0.24);
  ctx.quadraticCurveTo(w * 0.04, h * 0.3, w * 0.06, h * 0.55);
  ctx.quadraticCurveTo(w * 0.04, h * 0.62, w * 0.08, h * 0.68);
  ctx.lineTo(w * 0.18, h * 0.65);
  ctx.quadraticCurveTo(w * 0.16, h * 0.5, w * 0.2, h * 0.24);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = bodyGradient(ctx, w * 0.88, h * 0.4, w * 0.1, '#ddd', '#aaa', '#555');
  ctx.beginPath();
  ctx.moveTo(w * 0.8, h * 0.24);
  ctx.quadraticCurveTo(w * 0.96, h * 0.3, w * 0.94, h * 0.55);
  ctx.quadraticCurveTo(w * 0.96, h * 0.62, w * 0.92, h * 0.68);
  ctx.lineTo(w * 0.82, h * 0.65);
  ctx.quadraticCurveTo(w * 0.84, h * 0.5, w * 0.8, h * 0.24);
  ctx.closePath();
  ctx.fill();

  // Fists
  ctx.fillStyle = '#bbb';
  fillCircle(ctx, w * 0.08, h * 0.7, w * 0.05);
  fillCircle(ctx, w * 0.92, h * 0.7, w * 0.05);

  // Legs — thick stumps
  ctx.fillStyle = bodyGradient(ctx, w * 0.36, h * 0.72, w * 0.1, '#ccc', '#999', '#555');
  ctx.fillRect(w * 0.28, h * 0.56, w * 0.16, h * 0.36);
  ctx.fillStyle = bodyGradient(ctx, w * 0.64, h * 0.72, w * 0.1, '#ccc', '#999', '#555');
  ctx.fillRect(w * 0.56, h * 0.56, w * 0.16, h * 0.36);
}

// ---------------------------------------------------------------------------
// 4. Crystal Elemental — L4, Mage (class 2)
// Angular geometric diamond with radiating crystal spikes
// ---------------------------------------------------------------------------
function drawCrystalElemental(ctx: CanvasRenderingContext2D, w: number, h: number) {
  // Central diamond — bright core
  const coreGrad = ctx.createRadialGradient(w * 0.5, h * 0.48, 0, w * 0.5, h * 0.48, w * 0.28);
  coreGrad.addColorStop(0, '#fff');
  coreGrad.addColorStop(0.4, '#ddd');
  coreGrad.addColorStop(0.8, '#888');
  coreGrad.addColorStop(1, '#333');
  ctx.fillStyle = coreGrad;
  ctx.beginPath();
  ctx.moveTo(w * 0.5, h * 0.12);
  ctx.lineTo(w * 0.76, h * 0.48);
  ctx.lineTo(w * 0.5, h * 0.84);
  ctx.lineTo(w * 0.24, h * 0.48);
  ctx.closePath();
  ctx.fill();

  // Facet highlights
  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  ctx.beginPath();
  ctx.moveTo(w * 0.5, h * 0.12);
  ctx.lineTo(w * 0.5, h * 0.48);
  ctx.lineTo(w * 0.24, h * 0.48);
  ctx.closePath();
  ctx.fill();

  // Crystal spikes — 6 radiating
  const spikes: [number, number, number, number, number, number][] = [
    [0.38, 0.25, 0.12, 0.04, 0.32, 0.2],
    [0.62, 0.25, 0.88, 0.04, 0.68, 0.2],
    [0.24, 0.5, 0.04, 0.42, 0.2, 0.54],
    [0.76, 0.5, 0.96, 0.42, 0.8, 0.54],
    [0.35, 0.72, 0.14, 0.9, 0.3, 0.78],
    [0.65, 0.72, 0.86, 0.9, 0.7, 0.78],
  ];

  for (const [bx, by, tx, ty, rx, ry] of spikes) {
    ctx.fillStyle = '#999';
    ctx.beginPath();
    ctx.moveTo(w * bx, h * by);
    ctx.lineTo(w * tx, h * ty);
    ctx.lineTo(w * rx, h * ry);
    ctx.closePath();
    ctx.fill();
  }

  // Floating fragments
  ctx.fillStyle = '#666';
  for (const [fx, fy, fs] of [[0.08, 0.25, 0.025], [0.92, 0.3, 0.02], [0.1, 0.7, 0.02], [0.88, 0.72, 0.025]] as [number, number, number][]) {
    ctx.beginPath();
    ctx.moveTo(w * fx, h * (fy - fs));
    ctx.lineTo(w * (fx + fs), h * fy);
    ctx.lineTo(w * fx, h * (fy + fs));
    ctx.lineTo(w * (fx - fs), h * fy);
    ctx.closePath();
    ctx.fill();
  }

  // Core glow
  ctx.fillStyle = '#fff';
  fillCircle(ctx, w * 0.5, h * 0.46, w * 0.04);
}

// ---------------------------------------------------------------------------
// 5. Ironhide Troll — L5, Warrior (class 0)
// Front view: massive, hunched, dense, gorilla-like arms
// ---------------------------------------------------------------------------
function drawIronhideTroll(ctx: CanvasRenderingContext2D, w: number, h: number) {
  // Massive shoulder/torso mass
  ctx.fillStyle = bodyGradient(ctx, w * 0.5, h * 0.35, w * 0.4, '#fff', '#ccc', '#555');
  ctx.beginPath();
  ctx.moveTo(w * 0.1, h * 0.2);
  ctx.quadraticCurveTo(w * 0.5, h * 0.12, w * 0.9, h * 0.2);
  ctx.quadraticCurveTo(w * 0.88, h * 0.5, w * 0.72, h * 0.6);
  ctx.lineTo(w * 0.28, h * 0.6);
  ctx.quadraticCurveTo(w * 0.12, h * 0.5, w * 0.1, h * 0.2);
  ctx.closePath();
  ctx.fill();

  // Head — small, forward-hunched
  ctx.fillStyle = bodyGradient(ctx, w * 0.5, h * 0.12, w * 0.1, '#eee', '#bbb', '#666');
  fillEllipse(ctx, w * 0.5, h * 0.12, w * 0.09, h * 0.07);

  // Eyes
  ctx.fillStyle = '#fff';
  fillCircle(ctx, w * 0.46, h * 0.11, w * 0.015);
  fillCircle(ctx, w * 0.54, h * 0.11, w * 0.015);

  // Arms — very long, reaching down
  ctx.fillStyle = bodyGradient(ctx, w * 0.08, h * 0.45, w * 0.12, '#ddd', '#aaa', '#555');
  ctx.beginPath();
  ctx.moveTo(w * 0.12, h * 0.22);
  ctx.quadraticCurveTo(w * 0.0, h * 0.3, w * 0.02, h * 0.58);
  ctx.quadraticCurveTo(w * 0.01, h * 0.68, w * 0.06, h * 0.72);
  ctx.lineTo(w * 0.15, h * 0.68);
  ctx.quadraticCurveTo(w * 0.14, h * 0.4, w * 0.18, h * 0.28);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = bodyGradient(ctx, w * 0.92, h * 0.45, w * 0.12, '#ddd', '#aaa', '#555');
  ctx.beginPath();
  ctx.moveTo(w * 0.88, h * 0.22);
  ctx.quadraticCurveTo(w * 1.0, h * 0.3, w * 0.98, h * 0.58);
  ctx.quadraticCurveTo(w * 0.99, h * 0.68, w * 0.94, h * 0.72);
  ctx.lineTo(w * 0.85, h * 0.68);
  ctx.quadraticCurveTo(w * 0.86, h * 0.4, w * 0.82, h * 0.28);
  ctx.closePath();
  ctx.fill();

  // Fists
  ctx.fillStyle = '#bbb';
  fillCircle(ctx, w * 0.06, h * 0.74, w * 0.05);
  fillCircle(ctx, w * 0.94, h * 0.74, w * 0.05);

  // Legs
  ctx.fillStyle = bodyGradient(ctx, w * 0.36, h * 0.74, w * 0.09, '#bbb', '#888', '#444');
  ctx.fillRect(w * 0.3, h * 0.58, w * 0.14, h * 0.34);
  ctx.fillStyle = bodyGradient(ctx, w * 0.64, h * 0.74, w * 0.09, '#bbb', '#888', '#444');
  ctx.fillRect(w * 0.56, h * 0.58, w * 0.14, h * 0.34);
}

// ---------------------------------------------------------------------------
// 6. Phase Spider — L6, Rogue (class 1)
// Top-down: bilateral symmetry, 8 radiating legs with joints
// ---------------------------------------------------------------------------
function drawPhaseSpider(ctx: CanvasRenderingContext2D, w: number, h: number) {
  // Abdomen (rear body) — large oval
  ctx.fillStyle = bodyGradient(ctx, w * 0.5, h * 0.58, w * 0.14, '#fff', '#ccc', '#555');
  fillEllipse(ctx, w * 0.5, h * 0.58, w * 0.13, h * 0.17);

  // Cephalothorax (front body)
  ctx.fillStyle = bodyGradient(ctx, w * 0.5, h * 0.36, w * 0.1, '#eee', '#bbb', '#555');
  fillEllipse(ctx, w * 0.5, h * 0.36, w * 0.1, h * 0.1);

  // Pedicel connection
  ctx.fillStyle = '#aaa';
  fillEllipse(ctx, w * 0.5, h * 0.47, w * 0.05, h * 0.05);

  // 8 legs — bilateral symmetry
  const legSets: [number, number, number, number, number][] = [
    [0.36, 0.24, 0.2, 0.44, 0.1],
    [0.4, 0.36, 0.28, 0.46, 0.28],
    [0.52, 0.52, 0.28, 0.46, 0.52],
    [0.58, 0.68, 0.22, 0.4, 0.82],
  ];

  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  for (const [sy, jxOff, jy, exOff, ey] of legSets) {
    // Left leg
    ctx.strokeStyle = '#bbb';
    ctx.lineWidth = w * 0.018;
    ctx.beginPath();
    ctx.moveTo(w * 0.42, h * sy);
    ctx.lineTo(w * (0.5 - jxOff), h * jy);
    ctx.stroke();
    ctx.strokeStyle = '#888';
    ctx.lineWidth = w * 0.013;
    ctx.beginPath();
    ctx.moveTo(w * (0.5 - jxOff), h * jy);
    ctx.lineTo(w * (0.5 - exOff), h * ey);
    ctx.stroke();

    // Right leg (mirror)
    ctx.strokeStyle = '#bbb';
    ctx.lineWidth = w * 0.018;
    ctx.beginPath();
    ctx.moveTo(w * 0.58, h * sy);
    ctx.lineTo(w * (0.5 + jxOff), h * jy);
    ctx.stroke();
    ctx.strokeStyle = '#888';
    ctx.lineWidth = w * 0.013;
    ctx.beginPath();
    ctx.moveTo(w * (0.5 + jxOff), h * jy);
    ctx.lineTo(w * (0.5 + exOff), h * ey);
    ctx.stroke();

    // Joint dots
    ctx.fillStyle = '#ccc';
    fillCircle(ctx, w * (0.5 - jxOff), h * jy, w * 0.012);
    fillCircle(ctx, w * (0.5 + jxOff), h * jy, w * 0.012);

    // Foot dots
    ctx.fillStyle = '#777';
    fillCircle(ctx, w * (0.5 - exOff), h * ey, w * 0.008);
    fillCircle(ctx, w * (0.5 + exOff), h * ey, w * 0.008);
  }

  // Mandibles
  ctx.strokeStyle = '#aaa';
  ctx.lineWidth = w * 0.012;
  ctx.beginPath();
  ctx.moveTo(w * 0.46, h * 0.28);
  ctx.quadraticCurveTo(w * 0.44, h * 0.22, w * 0.42, h * 0.18);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(w * 0.54, h * 0.28);
  ctx.quadraticCurveTo(w * 0.56, h * 0.22, w * 0.58, h * 0.18);
  ctx.stroke();

  // Eyes — cluster
  ctx.fillStyle = '#fff';
  fillCircle(ctx, w * 0.47, h * 0.32, w * 0.014);
  fillCircle(ctx, w * 0.53, h * 0.32, w * 0.014);
  fillCircle(ctx, w * 0.45, h * 0.35, w * 0.01);
  fillCircle(ctx, w * 0.55, h * 0.35, w * 0.01);
  fillCircle(ctx, w * 0.47, h * 0.37, w * 0.008);
  fillCircle(ctx, w * 0.53, h * 0.37, w * 0.008);

  // Markings on abdomen
  ctx.strokeStyle = '#666';
  ctx.lineWidth = w * 0.006;
  ctx.beginPath();
  ctx.moveTo(w * 0.44, h * 0.52);
  ctx.quadraticCurveTo(w * 0.5, h * 0.5, w * 0.56, h * 0.52);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(w * 0.44, h * 0.56);
  ctx.quadraticCurveTo(w * 0.5, h * 0.54, w * 0.56, h * 0.56);
  ctx.stroke();
}

// ---------------------------------------------------------------------------
// 7. Bonecaster — L7, Mage (class 2)
// Tall, thin, skeletal with skull, staff, flowing robes
// ---------------------------------------------------------------------------
function drawBonecaster(ctx: CanvasRenderingContext2D, w: number, h: number) {
  // Robes — flowing, wider at bottom
  const robeGrad = ctx.createLinearGradient(w * 0.5, h * 0.4, w * 0.5, h * 0.95);
  robeGrad.addColorStop(0, '#aaa');
  robeGrad.addColorStop(0.5, '#888');
  robeGrad.addColorStop(1, '#333');
  ctx.fillStyle = robeGrad;
  ctx.beginPath();
  ctx.moveTo(w * 0.34, h * 0.4);
  ctx.lineTo(w * 0.56, h * 0.4);
  ctx.quadraticCurveTo(w * 0.72, h * 0.7, w * 0.7, h * 0.95);
  ctx.lineTo(w * 0.15, h * 0.95);
  ctx.quadraticCurveTo(w * 0.18, h * 0.7, w * 0.34, h * 0.4);
  ctx.closePath();
  ctx.fill();

  // Skull head
  ctx.fillStyle = bodyGradient(ctx, w * 0.45, h * 0.1, w * 0.12, '#fff', '#ddd', '#888');
  fillEllipse(ctx, w * 0.45, h * 0.1, w * 0.13, h * 0.08);

  // Jaw
  ctx.fillStyle = '#bbb';
  ctx.beginPath();
  ctx.moveTo(w * 0.36, h * 0.15);
  ctx.lineTo(w * 0.54, h * 0.15);
  ctx.lineTo(w * 0.52, h * 0.2);
  ctx.lineTo(w * 0.38, h * 0.2);
  ctx.closePath();
  ctx.fill();

  // Eye sockets — dark voids
  ctx.fillStyle = '#000';
  fillEllipse(ctx, w * 0.4, h * 0.09, w * 0.03, h * 0.025);
  fillEllipse(ctx, w * 0.5, h * 0.09, w * 0.03, h * 0.025);

  // Glowing eye points
  ctx.fillStyle = '#fff';
  fillCircle(ctx, w * 0.4, h * 0.09, w * 0.01);
  fillCircle(ctx, w * 0.5, h * 0.09, w * 0.01);

  // Spine
  ctx.strokeStyle = '#aaa';
  ctx.lineWidth = w * 0.03;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(w * 0.45, h * 0.18);
  ctx.lineTo(w * 0.45, h * 0.42);
  ctx.stroke();

  // Ribs
  ctx.strokeStyle = '#999';
  ctx.lineWidth = w * 0.012;
  for (let i = 0; i < 5; i++) {
    const ry = h * (0.22 + i * 0.04);
    const spread = w * (0.08 + i * 0.015);
    ctx.beginPath();
    ctx.moveTo(w * 0.45 - spread, ry);
    ctx.quadraticCurveTo(w * 0.45, ry + h * 0.008, w * 0.45 + spread, ry);
    ctx.stroke();
  }

  // Staff — full height, right side
  ctx.strokeStyle = '#aaa';
  ctx.lineWidth = w * 0.02;
  ctx.beginPath();
  ctx.moveTo(w * 0.78, h * 0.04);
  ctx.lineTo(w * 0.79, h * 0.88);
  ctx.stroke();

  // Staff skull ornament
  ctx.fillStyle = bodyGradient(ctx, w * 0.78, h * 0.04, w * 0.04, '#ddd', '#aaa', '#555');
  fillCircle(ctx, w * 0.78, h * 0.04, w * 0.04);

  // Arm holding staff
  ctx.strokeStyle = '#aaa';
  ctx.lineWidth = w * 0.015;
  ctx.beginPath();
  ctx.moveTo(w * 0.5, h * 0.3);
  ctx.quadraticCurveTo(w * 0.62, h * 0.32, w * 0.77, h * 0.28);
  ctx.stroke();
}

// ---------------------------------------------------------------------------
// 8. Rock Golem — L8, Warrior (class 0)
// Massive blocky body, very dense, small angular head
// ---------------------------------------------------------------------------
function drawRockGolem(ctx: CanvasRenderingContext2D, w: number, h: number) {
  // Shoulders — massive wide block
  ctx.fillStyle = bodyGradient(ctx, w * 0.5, h * 0.22, w * 0.42, '#fff', '#ccc', '#666');
  ctx.beginPath();
  ctx.moveTo(w * 0.06, h * 0.16);
  ctx.lineTo(w * 0.94, h * 0.16);
  ctx.quadraticCurveTo(w * 0.96, h * 0.24, w * 0.92, h * 0.3);
  ctx.lineTo(w * 0.08, h * 0.3);
  ctx.quadraticCurveTo(w * 0.04, h * 0.24, w * 0.06, h * 0.16);
  ctx.closePath();
  ctx.fill();

  // Torso — very wide, dense
  ctx.fillStyle = bodyGradient(ctx, w * 0.5, h * 0.42, w * 0.38, '#eee', '#bbb', '#666');
  ctx.fillRect(w * 0.14, h * 0.28, w * 0.72, h * 0.32);

  // Head — small, angular
  ctx.fillStyle = bodyGradient(ctx, w * 0.5, h * 0.1, w * 0.12, '#ddd', '#aaa', '#666');
  ctx.beginPath();
  ctx.moveTo(w * 0.38, h * 0.04);
  ctx.lineTo(w * 0.62, h * 0.04);
  ctx.lineTo(w * 0.64, h * 0.16);
  ctx.lineTo(w * 0.36, h * 0.16);
  ctx.closePath();
  ctx.fill();

  // Eyes
  ctx.fillStyle = '#fff';
  fillCircle(ctx, w * 0.45, h * 0.1, w * 0.015);
  fillCircle(ctx, w * 0.55, h * 0.1, w * 0.015);

  // Arms — thick pillars
  ctx.fillStyle = bodyGradient(ctx, w * 0.06, h * 0.38, w * 0.1, '#ddd', '#aaa', '#555');
  ctx.beginPath();
  ctx.moveTo(w * 0.08, h * 0.18);
  ctx.lineTo(w * 0.0, h * 0.22);
  ctx.lineTo(w * 0.0, h * 0.58);
  ctx.quadraticCurveTo(w * 0.02, h * 0.64, w * 0.1, h * 0.62);
  ctx.lineTo(w * 0.14, h * 0.3);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = bodyGradient(ctx, w * 0.94, h * 0.38, w * 0.1, '#ddd', '#aaa', '#555');
  ctx.beginPath();
  ctx.moveTo(w * 0.92, h * 0.18);
  ctx.lineTo(w * 1.0, h * 0.22);
  ctx.lineTo(w * 1.0, h * 0.58);
  ctx.quadraticCurveTo(w * 0.98, h * 0.64, w * 0.9, h * 0.62);
  ctx.lineTo(w * 0.86, h * 0.3);
  ctx.closePath();
  ctx.fill();

  // Fists
  ctx.fillStyle = '#ccc';
  ctx.fillRect(w * 0.0, h * 0.56, w * 0.12, h * 0.1);
  ctx.fillRect(w * 0.88, h * 0.56, w * 0.12, h * 0.1);

  // Legs — thick pillars
  ctx.fillStyle = bodyGradient(ctx, w * 0.34, h * 0.74, w * 0.12, '#ccc', '#999', '#555');
  ctx.fillRect(w * 0.22, h * 0.58, w * 0.22, h * 0.36);
  ctx.fillStyle = bodyGradient(ctx, w * 0.66, h * 0.74, w * 0.12, '#ccc', '#999', '#555');
  ctx.fillRect(w * 0.56, h * 0.58, w * 0.22, h * 0.36);

  // Crack texture
  ctx.strokeStyle = '#444';
  ctx.lineWidth = w * 0.008;
  ctx.beginPath();
  ctx.moveTo(w * 0.35, h * 0.2);
  ctx.lineTo(w * 0.4, h * 0.35);
  ctx.lineTo(w * 0.37, h * 0.5);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(w * 0.65, h * 0.25);
  ctx.lineTo(w * 0.6, h * 0.38);
  ctx.lineTo(w * 0.62, h * 0.48);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(w * 0.45, h * 0.42);
  ctx.lineTo(w * 0.55, h * 0.45);
  ctx.stroke();
}

// ---------------------------------------------------------------------------
// 9. Pale Stalker — L9, Rogue (class 1)
// Ghostly hooded figure, mostly negative space, fading cloak
// ---------------------------------------------------------------------------
function drawPaleStalker(ctx: CanvasRenderingContext2D, w: number, h: number) {
  // Hood — peaked arch
  const hoodGrad = ctx.createLinearGradient(w * 0.5, h * 0.0, w * 0.5, h * 0.25);
  hoodGrad.addColorStop(0, '#bbb');
  hoodGrad.addColorStop(0.6, '#888');
  hoodGrad.addColorStop(1, '#555');
  ctx.fillStyle = hoodGrad;
  ctx.beginPath();
  ctx.moveTo(w * 0.5, h * 0.0);
  ctx.quadraticCurveTo(w * 0.72, h * 0.06, w * 0.68, h * 0.24);
  ctx.lineTo(w * 0.32, h * 0.24);
  ctx.quadraticCurveTo(w * 0.28, h * 0.06, w * 0.5, h * 0.0);
  ctx.closePath();
  ctx.fill();

  // Face void under hood
  ctx.fillStyle = '#222';
  fillEllipse(ctx, w * 0.5, h * 0.18, w * 0.12, h * 0.05);

  // Eyes — piercing bright points
  ctx.fillStyle = '#fff';
  fillCircle(ctx, w * 0.45, h * 0.17, w * 0.012);
  fillCircle(ctx, w * 0.55, h * 0.17, w * 0.012);

  // Shoulders — faint
  ctx.fillStyle = '#777';
  ctx.beginPath();
  ctx.moveTo(w * 0.32, h * 0.24);
  ctx.lineTo(w * 0.68, h * 0.24);
  ctx.quadraticCurveTo(w * 0.74, h * 0.28, w * 0.72, h * 0.34);
  ctx.lineTo(w * 0.28, h * 0.34);
  ctx.quadraticCurveTo(w * 0.26, h * 0.28, w * 0.32, h * 0.24);
  ctx.closePath();
  ctx.fill();

  // Cloak body — fading gradient (dissolves downward)
  for (let i = 0; i < 12; i++) {
    const t = i / 12;
    const y = h * (0.32 + t * 0.55);
    const bh = h * 0.06;
    const spread = 0.2 + t * 0.06;
    const brightness = Math.floor(120 - t * 100);
    ctx.fillStyle = `rgb(${brightness},${brightness},${brightness})`;

    ctx.beginPath();
    ctx.moveTo(w * (0.5 - spread), y);
    ctx.quadraticCurveTo(w * 0.5, y - h * 0.01, w * (0.5 + spread), y);
    ctx.lineTo(w * (0.5 + spread + 0.01), y + bh);
    ctx.quadraticCurveTo(w * 0.5, y + bh + h * 0.01, w * (0.5 - spread - 0.01), y + bh);
    ctx.closePath();
    ctx.fill();
  }

  // Wispy dissolving edges
  ctx.strokeStyle = '#333';
  ctx.lineWidth = w * 0.008;
  ctx.lineCap = 'round';
  for (const [sx, sy, ex, ey] of [
    [0.3, 0.7, 0.22, 0.88], [0.7, 0.7, 0.78, 0.88],
    [0.34, 0.78, 0.28, 0.95], [0.66, 0.78, 0.72, 0.95],
    [0.38, 0.85, 0.34, 0.98], [0.62, 0.85, 0.66, 0.98],
  ] as [number, number, number, number][]) {
    ctx.beginPath();
    ctx.moveTo(w * sx, h * sy);
    ctx.lineTo(w * ex, h * ey);
    ctx.stroke();
  }
}

// ---------------------------------------------------------------------------
// 10. Dusk Drake — L10, Mage (class 2)
// Spread wings, serpentine neck, compact body, tail
// ---------------------------------------------------------------------------
function drawDuskDrake(ctx: CanvasRenderingContext2D, w: number, h: number) {
  // Wings — large triangular membranes with shading
  const wingGradL = ctx.createLinearGradient(w * 0.35, h * 0.3, w * 0.02, h * 0.1);
  wingGradL.addColorStop(0, '#bbb');
  wingGradL.addColorStop(0.5, '#888');
  wingGradL.addColorStop(1, '#444');
  ctx.fillStyle = wingGradL;
  ctx.beginPath();
  ctx.moveTo(w * 0.35, h * 0.38);
  ctx.lineTo(w * 0.02, h * 0.06);
  ctx.lineTo(w * 0.04, h * 0.14);
  ctx.lineTo(w * 0.1, h * 0.3);
  ctx.lineTo(w * 0.18, h * 0.46);
  ctx.closePath();
  ctx.fill();

  const wingGradR = ctx.createLinearGradient(w * 0.65, h * 0.3, w * 0.98, h * 0.1);
  wingGradR.addColorStop(0, '#bbb');
  wingGradR.addColorStop(0.5, '#888');
  wingGradR.addColorStop(1, '#444');
  ctx.fillStyle = wingGradR;
  ctx.beginPath();
  ctx.moveTo(w * 0.65, h * 0.38);
  ctx.lineTo(w * 0.98, h * 0.06);
  ctx.lineTo(w * 0.96, h * 0.14);
  ctx.lineTo(w * 0.9, h * 0.3);
  ctx.lineTo(w * 0.82, h * 0.46);
  ctx.closePath();
  ctx.fill();

  // Wing bone struts
  ctx.strokeStyle = '#999';
  ctx.lineWidth = w * 0.01;
  ctx.beginPath(); ctx.moveTo(w * 0.35, h * 0.4); ctx.lineTo(w * 0.06, h * 0.1); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(w * 0.3, h * 0.42); ctx.lineTo(w * 0.12, h * 0.26); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(w * 0.65, h * 0.4); ctx.lineTo(w * 0.94, h * 0.1); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(w * 0.7, h * 0.42); ctx.lineTo(w * 0.88, h * 0.26); ctx.stroke();

  // Body
  ctx.fillStyle = bodyGradient(ctx, w * 0.5, h * 0.5, w * 0.16, '#fff', '#ccc', '#666');
  fillEllipse(ctx, w * 0.5, h * 0.5, w * 0.16, h * 0.12);

  // Neck
  ctx.fillStyle = '#ddd';
  ctx.beginPath();
  ctx.moveTo(w * 0.43, h * 0.4);
  ctx.quadraticCurveTo(w * 0.38, h * 0.28, w * 0.4, h * 0.18);
  ctx.lineTo(w * 0.48, h * 0.18);
  ctx.quadraticCurveTo(w * 0.46, h * 0.28, w * 0.5, h * 0.4);
  ctx.closePath();
  ctx.fill();

  // Head — angular with horns
  ctx.fillStyle = bodyGradient(ctx, w * 0.44, h * 0.14, w * 0.08, '#eee', '#bbb', '#666');
  ctx.beginPath();
  ctx.moveTo(w * 0.36, h * 0.18);
  ctx.lineTo(w * 0.44, h * 0.08);
  ctx.lineTo(w * 0.52, h * 0.18);
  ctx.closePath();
  ctx.fill();

  // Horns
  ctx.strokeStyle = '#aaa';
  ctx.lineWidth = w * 0.01;
  ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(w * 0.38, h * 0.14); ctx.lineTo(w * 0.32, h * 0.04); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(w * 0.5, h * 0.14); ctx.lineTo(w * 0.56, h * 0.04); ctx.stroke();

  // Eye
  ctx.fillStyle = '#fff';
  fillCircle(ctx, w * 0.44, h * 0.14, w * 0.012);

  // Tail
  ctx.strokeStyle = '#aaa';
  ctx.lineWidth = w * 0.025;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(w * 0.58, h * 0.56);
  ctx.bezierCurveTo(w * 0.68, h * 0.68, w * 0.72, h * 0.78, w * 0.62, h * 0.9);
  ctx.stroke();
  ctx.fillStyle = '#888';
  ctx.beginPath();
  ctx.moveTo(w * 0.62, h * 0.9);
  ctx.lineTo(w * 0.56, h * 0.96);
  ctx.lineTo(w * 0.68, h * 0.96);
  ctx.closePath();
  ctx.fill();

  // Legs
  ctx.strokeStyle = '#888';
  ctx.lineWidth = w * 0.015;
  ctx.beginPath(); ctx.moveTo(w * 0.42, h * 0.58); ctx.lineTo(w * 0.38, h * 0.7); ctx.lineTo(w * 0.42, h * 0.74); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(w * 0.58, h * 0.58); ctx.lineTo(w * 0.62, h * 0.7); ctx.lineTo(w * 0.58, h * 0.74); ctx.stroke();
}

// ---------------------------------------------------------------------------
// 11. Basilisk — L12, Boss, Warrior (class 0)
// Coiled serpentine S-curve, massive head with fangs, fills frame
// ---------------------------------------------------------------------------
function drawBasilisk(ctx: CanvasRenderingContext2D, w: number, h: number) {
  // Body coil — thick S-curve with layered strokes for gradient effect
  // Outer stroke (darkest)
  ctx.strokeStyle = '#888';
  ctx.lineWidth = w * 0.13;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(w * 0.28, h * 0.12);
  ctx.bezierCurveTo(w * 0.82, h * 0.06, w * 0.88, h * 0.4, w * 0.38, h * 0.42);
  ctx.bezierCurveTo(w * 0.1, h * 0.42, w * 0.08, h * 0.68, w * 0.55, h * 0.68);
  ctx.bezierCurveTo(w * 0.88, h * 0.68, w * 0.92, h * 0.92, w * 0.52, h * 0.9);
  ctx.stroke();

  // Mid stroke
  ctx.strokeStyle = '#bbb';
  ctx.lineWidth = w * 0.09;
  ctx.beginPath();
  ctx.moveTo(w * 0.28, h * 0.12);
  ctx.bezierCurveTo(w * 0.82, h * 0.06, w * 0.88, h * 0.4, w * 0.38, h * 0.42);
  ctx.bezierCurveTo(w * 0.1, h * 0.42, w * 0.08, h * 0.68, w * 0.55, h * 0.68);
  ctx.bezierCurveTo(w * 0.88, h * 0.68, w * 0.92, h * 0.92, w * 0.52, h * 0.9);
  ctx.stroke();

  // Inner stroke (brightest)
  ctx.strokeStyle = '#eee';
  ctx.lineWidth = w * 0.04;
  ctx.beginPath();
  ctx.moveTo(w * 0.28, h * 0.12);
  ctx.bezierCurveTo(w * 0.82, h * 0.06, w * 0.88, h * 0.4, w * 0.38, h * 0.42);
  ctx.bezierCurveTo(w * 0.1, h * 0.42, w * 0.08, h * 0.68, w * 0.55, h * 0.68);
  ctx.bezierCurveTo(w * 0.88, h * 0.68, w * 0.92, h * 0.92, w * 0.52, h * 0.9);
  ctx.stroke();

  // Scale texture marks
  ctx.strokeStyle = '#555';
  ctx.lineWidth = w * 0.005;
  const spinePoints: [number, number][] = [
    [0.3, 0.12], [0.5, 0.1], [0.7, 0.12], [0.8, 0.2],
    [0.75, 0.32], [0.58, 0.4], [0.38, 0.42], [0.2, 0.44],
    [0.15, 0.54], [0.2, 0.64], [0.38, 0.68], [0.55, 0.68],
    [0.72, 0.7], [0.8, 0.78], [0.7, 0.86], [0.52, 0.9],
  ];
  for (const [sx, sy] of spinePoints) {
    ctx.beginPath();
    ctx.moveTo(w * (sx - 0.02), h * (sy - 0.015));
    ctx.lineTo(w * (sx + 0.02), h * (sy + 0.015));
    ctx.stroke();
  }

  // Head — large, angular
  ctx.fillStyle = bodyGradient(ctx, w * 0.22, h * 0.1, w * 0.12, '#fff', '#ddd', '#888');
  ctx.beginPath();
  ctx.moveTo(w * 0.14, h * 0.14);
  ctx.lineTo(w * 0.1, h * 0.04);
  ctx.lineTo(w * 0.28, h * 0.02);
  ctx.lineTo(w * 0.36, h * 0.1);
  ctx.lineTo(w * 0.3, h * 0.18);
  ctx.lineTo(w * 0.16, h * 0.18);
  ctx.closePath();
  ctx.fill();

  // Crown / horns
  ctx.fillStyle = '#ccc';
  ctx.beginPath();
  ctx.moveTo(w * 0.16, h * 0.06);
  ctx.lineTo(w * 0.12, h * 0.0);
  ctx.lineTo(w * 0.2, h * 0.04);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(w * 0.26, h * 0.04);
  ctx.lineTo(w * 0.28, h * 0.0);
  ctx.lineTo(w * 0.32, h * 0.04);
  ctx.closePath();
  ctx.fill();

  // Fangs
  ctx.strokeStyle = '#eee';
  ctx.lineWidth = w * 0.015;
  ctx.beginPath(); ctx.moveTo(w * 0.12, h * 0.1); ctx.lineTo(w * 0.08, h * 0.2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(w * 0.18, h * 0.12); ctx.lineTo(w * 0.15, h * 0.22); ctx.stroke();

  // Eyes — menacing glow
  ctx.fillStyle = '#fff';
  fillCircle(ctx, w * 0.18, h * 0.07, w * 0.02);
  fillCircle(ctx, w * 0.26, h * 0.06, w * 0.02);

  // Tail taper
  ctx.strokeStyle = '#888';
  ctx.lineWidth = w * 0.04;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(w * 0.52, h * 0.9);
  ctx.quadraticCurveTo(w * 0.42, h * 0.94, w * 0.38, h * 0.98);
  ctx.stroke();
  ctx.strokeStyle = '#555';
  ctx.lineWidth = w * 0.02;
  ctx.beginPath();
  ctx.moveTo(w * 0.42, h * 0.94);
  ctx.lineTo(w * 0.36, h * 0.99);
  ctx.stroke();
}

// ---------------------------------------------------------------------------
// Template registry
// ---------------------------------------------------------------------------

export const MONSTER_TEMPLATES: MonsterTemplate[] = [
  {
    id: 'dire_rat',
    name: 'Dire Rat',
    gridWidth: 14,
    gridHeight: 8,
    monsterClass: 1,
    level: 1,
    draw: drawDireRat,
  },
  {
    id: 'fungal_shaman',
    name: 'Fungal Shaman',
    gridWidth: 10,
    gridHeight: 10,
    monsterClass: 2,
    level: 2,
    draw: drawFungalShaman,
  },
  {
    id: 'cavern_brute',
    name: 'Cavern Brute',
    gridWidth: 11,
    gridHeight: 10,
    monsterClass: 0,
    level: 3,
    draw: drawCavernBrute,
  },
  {
    id: 'crystal_elemental',
    name: 'Crystal Elemental',
    gridWidth: 10,
    gridHeight: 12,
    monsterClass: 2,
    level: 4,
    draw: drawCrystalElemental,
  },
  {
    id: 'ironhide_troll',
    name: 'Ironhide Troll',
    gridWidth: 12,
    gridHeight: 11,
    monsterClass: 0,
    level: 5,
    draw: drawIronhideTroll,
  },
  {
    id: 'phase_spider',
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
    gridWidth: 8,
    gridHeight: 12,
    monsterClass: 2,
    level: 7,
    draw: drawBonecaster,
  },
  {
    id: 'rock_golem',
    name: 'Rock Golem',
    gridWidth: 11,
    gridHeight: 13,
    monsterClass: 0,
    level: 8,
    draw: drawRockGolem,
  },
  {
    id: 'pale_stalker',
    name: 'Pale Stalker',
    gridWidth: 10,
    gridHeight: 13,
    monsterClass: 1,
    level: 9,
    draw: drawPaleStalker,
  },
  {
    id: 'dusk_drake',
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
    gridHeight: 14,
    monsterClass: 0,
    level: 12,
    isBoss: true,
    draw: drawBasilisk,
  },
];

export function getTemplate(id: string): MonsterTemplate | undefined {
  return MONSTER_TEMPLATES.find(t => t.id === id);
}

export function getTemplateByName(name: string): MonsterTemplate | undefined {
  const lower = name.toLowerCase();
  return MONSTER_TEMPLATES.find(t => t.name.toLowerCase() === lower);
}
