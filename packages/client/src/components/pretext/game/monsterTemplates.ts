/**
 * Monster silhouette templates for ASCII rendering.
 *
 * Each template defines a draw function that paints a brightness field
 * (white shapes on black) to a small canvas. The MonsterAsciiRenderer
 * samples this field to pick characters, weights, and colors.
 *
 * Draw functions receive (ctx, w, h) where w and h are the canvas
 * dimensions in pixels — typically matching the character grid resolution.
 * Use relative coordinates (fractions of w/h) so shapes scale.
 */

export type MonsterTemplate = {
  id: string;
  name: string;
  /** Natural grid width in character cells */
  gridWidth: number;
  /** Natural grid height in character cells */
  gridHeight: number;
  /** 0=Warrior(STR), 1=Rogue(AGI), 2=Mage(INT) */
  monsterClass: 0 | 1 | 2;
  level: number;
  isBoss?: boolean;
  /** Draw silhouette in white/gray on a pre-filled black canvas */
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void;
};

// ---------------------------------------------------------------------------
// Draw helpers
// ---------------------------------------------------------------------------

/** Draw a filled ellipse (works on small canvases where single-pixel matters) */
function ellipse(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
) {
  ctx.beginPath();
  ctx.ellipse(cx, cy, Math.max(0.5, rx), Math.max(0.5, ry), 0, 0, Math.PI * 2);
  ctx.fill();
}

function circle(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  ellipse(ctx, cx, cy, r, r);
}

// ---------------------------------------------------------------------------
// 1. Dire Rat — L1, Rogue (class 1)
// Side profile: horizontal body, pointed snout, thin tail, stub legs
// ---------------------------------------------------------------------------
function drawDireRat(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.fillStyle = '#fff';

  // Body — fat horizontal ellipse
  ellipse(ctx, w * 0.44, h * 0.5, w * 0.2, h * 0.2);

  // Head
  circle(ctx, w * 0.18, h * 0.44, w * 0.1);

  // Neck bridge
  ctx.fillRect(w * 0.24, h * 0.36, w * 0.12, h * 0.24);

  // Snout
  ctx.beginPath();
  ctx.moveTo(w * 0.1, h * 0.43);
  ctx.lineTo(w * 0.02, h * 0.42);
  ctx.lineTo(w * 0.1, h * 0.5);
  ctx.closePath();
  ctx.fill();

  // Ears (slightly dimmer)
  ctx.fillStyle = '#ccc';
  ctx.beginPath();
  ctx.moveTo(w * 0.14, h * 0.35);
  ctx.lineTo(w * 0.11, h * 0.18);
  ctx.lineTo(w * 0.2, h * 0.32);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(w * 0.22, h * 0.33);
  ctx.lineTo(w * 0.2, h * 0.15);
  ctx.lineTo(w * 0.27, h * 0.3);
  ctx.closePath();
  ctx.fill();

  // Tail — thin, curving upward
  ctx.strokeStyle = '#888';
  ctx.lineWidth = Math.max(0.8, h * 0.04);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(w * 0.64, h * 0.48);
  ctx.quadraticCurveTo(w * 0.78, h * 0.32, w * 0.95, h * 0.2);
  ctx.stroke();

  // Legs — thin stubs
  ctx.strokeStyle = '#aaa';
  ctx.lineWidth = Math.max(0.8, w * 0.03);
  for (const lx of [0.3, 0.37, 0.48, 0.55]) {
    ctx.beginPath();
    ctx.moveTo(w * lx, h * 0.65);
    ctx.lineTo(w * (lx + 0.01), h * 0.85);
    ctx.stroke();
  }

  // Eye highlight
  ctx.fillStyle = '#fff';
  circle(ctx, w * 0.13, h * 0.41, Math.max(0.5, w * 0.015));
}

// ---------------------------------------------------------------------------
// 2. Fungal Shaman — L2, Mage (class 2)
// Front view: mushroom cap dome, thin stem, staff, base tendrils
// ---------------------------------------------------------------------------
function drawFungalShaman(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.fillStyle = '#fff';

  // Mushroom cap — large dome
  ctx.beginPath();
  ctx.ellipse(w * 0.45, h * 0.3, w * 0.32, h * 0.2, 0, Math.PI, Math.PI * 2);
  ctx.fill();
  // Cap underside — slightly dimmer
  ctx.fillStyle = '#bbb';
  ctx.fillRect(w * 0.2, h * 0.28, w * 0.5, h * 0.06);

  // Stem / body — thin
  ctx.fillStyle = '#ddd';
  ctx.fillRect(w * 0.38, h * 0.34, w * 0.14, h * 0.35);

  // Face area — small eyes in shadow under cap
  ctx.fillStyle = '#fff';
  circle(ctx, w * 0.4, h * 0.38, w * 0.02);
  circle(ctx, w * 0.5, h * 0.38, w * 0.02);

  // Staff — to the right
  ctx.strokeStyle = '#aaa';
  ctx.lineWidth = Math.max(0.8, w * 0.025);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(w * 0.7, h * 0.25);
  ctx.lineTo(w * 0.72, h * 0.78);
  ctx.stroke();

  // Staff orb
  ctx.fillStyle = '#ddd';
  circle(ctx, w * 0.7, h * 0.22, w * 0.04);

  // Base tendrils — wispy roots
  ctx.strokeStyle = '#666';
  ctx.lineWidth = Math.max(0.5, w * 0.02);
  for (const [sx, ex, ey] of [
    [0.35, 0.2, 0.88],
    [0.38, 0.28, 0.92],
    [0.52, 0.62, 0.9],
    [0.48, 0.7, 0.86],
  ] as [number, number, number][]) {
    ctx.beginPath();
    ctx.moveTo(w * sx, h * 0.7);
    ctx.quadraticCurveTo(w * ((sx + ex) / 2), h * 0.82, w * ex, h * ey);
    ctx.stroke();
  }

  // Spore dots — atmospheric
  ctx.fillStyle = '#555';
  for (const [px, py] of [
    [0.15, 0.5], [0.75, 0.45], [0.25, 0.6], [0.65, 0.55],
    [0.1, 0.35], [0.8, 0.3],
  ]) {
    circle(ctx, w * px, h * py, Math.max(0.4, w * 0.012));
  }
}

// ---------------------------------------------------------------------------
// 3. Cavern Brute — L3, Warrior (class 0)
// Front view: wide, squat, thick arms, blocky
// ---------------------------------------------------------------------------
function drawCavernBrute(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.fillStyle = '#fff';

  // Head — blocky
  ctx.fillRect(w * 0.38, h * 0.08, w * 0.24, h * 0.14);
  // Jaw — wider
  ctx.fillRect(w * 0.35, h * 0.16, w * 0.3, h * 0.08);

  // Torso — wide rectangle
  ctx.fillRect(w * 0.22, h * 0.24, w * 0.56, h * 0.36);

  // Arms — thick, hanging
  ctx.fillStyle = '#ddd';
  ctx.fillRect(w * 0.08, h * 0.26, w * 0.14, h * 0.38);
  ctx.fillRect(w * 0.78, h * 0.26, w * 0.14, h * 0.38);

  // Fists
  ctx.fillStyle = '#eee';
  ctx.fillRect(w * 0.06, h * 0.62, w * 0.16, h * 0.1);
  ctx.fillRect(w * 0.78, h * 0.62, w * 0.16, h * 0.1);

  // Legs — thick
  ctx.fillStyle = '#ccc';
  ctx.fillRect(w * 0.28, h * 0.6, w * 0.16, h * 0.3);
  ctx.fillRect(w * 0.56, h * 0.6, w * 0.16, h * 0.3);

  // Eyes — dark holes (drawn as black on the white head)
  ctx.fillStyle = '#000';
  ctx.fillRect(w * 0.4, h * 0.12, w * 0.06, h * 0.04);
  ctx.fillRect(w * 0.54, h * 0.12, w * 0.06, h * 0.04);

  // Brow ridge
  ctx.fillStyle = '#fff';
  ctx.fillRect(w * 0.36, h * 0.1, w * 0.28, h * 0.03);
}

// ---------------------------------------------------------------------------
// 4. Crystal Elemental — L4, Mage (class 2)
// Angular geometric diamond with radiating crystal spikes
// ---------------------------------------------------------------------------
function drawCrystalElemental(ctx: CanvasRenderingContext2D, w: number, h: number) {
  // Central diamond
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.moveTo(w * 0.5, h * 0.15);
  ctx.lineTo(w * 0.72, h * 0.5);
  ctx.lineTo(w * 0.5, h * 0.85);
  ctx.lineTo(w * 0.28, h * 0.5);
  ctx.closePath();
  ctx.fill();

  // Inner facet lines (dimmer)
  ctx.strokeStyle = '#888';
  ctx.lineWidth = Math.max(0.5, w * 0.02);
  ctx.beginPath();
  ctx.moveTo(w * 0.5, h * 0.15);
  ctx.lineTo(w * 0.5, h * 0.85);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(w * 0.28, h * 0.5);
  ctx.lineTo(w * 0.72, h * 0.5);
  ctx.stroke();

  // Radiating crystal spikes
  ctx.fillStyle = '#bbb';
  // Top-left spike
  ctx.beginPath();
  ctx.moveTo(w * 0.35, h * 0.3);
  ctx.lineTo(w * 0.15, h * 0.08);
  ctx.lineTo(w * 0.28, h * 0.35);
  ctx.closePath();
  ctx.fill();
  // Top-right spike
  ctx.beginPath();
  ctx.moveTo(w * 0.65, h * 0.3);
  ctx.lineTo(w * 0.85, h * 0.08);
  ctx.lineTo(w * 0.72, h * 0.35);
  ctx.closePath();
  ctx.fill();
  // Left spike
  ctx.beginPath();
  ctx.moveTo(w * 0.28, h * 0.42);
  ctx.lineTo(w * 0.08, h * 0.38);
  ctx.lineTo(w * 0.28, h * 0.52);
  ctx.closePath();
  ctx.fill();
  // Right spike
  ctx.beginPath();
  ctx.moveTo(w * 0.72, h * 0.42);
  ctx.lineTo(w * 0.92, h * 0.38);
  ctx.lineTo(w * 0.72, h * 0.52);
  ctx.closePath();
  ctx.fill();

  // Floating fragments (dimmer)
  ctx.fillStyle = '#777';
  ctx.beginPath();
  ctx.moveTo(w * 0.12, h * 0.6);
  ctx.lineTo(w * 0.18, h * 0.55);
  ctx.lineTo(w * 0.2, h * 0.65);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(w * 0.82, h * 0.62);
  ctx.lineTo(w * 0.88, h * 0.56);
  ctx.lineTo(w * 0.86, h * 0.68);
  ctx.closePath();
  ctx.fill();

  // Core glow — bright center
  ctx.fillStyle = '#fff';
  circle(ctx, w * 0.5, h * 0.48, w * 0.06);
}

// ---------------------------------------------------------------------------
// 5. Ironhide Troll — L5, Warrior (class 0)
// Front view: very wide, hunched, dense, massive arms
// ---------------------------------------------------------------------------
function drawIronhideTroll(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.fillStyle = '#eee';

  // Head — small, forward/low (hunched)
  circle(ctx, w * 0.5, h * 0.14, w * 0.08);

  // Massive shoulders
  ctx.fillStyle = '#fff';
  ellipse(ctx, w * 0.5, h * 0.28, w * 0.4, h * 0.12);

  // Torso — wide, tapering
  ctx.beginPath();
  ctx.moveTo(w * 0.15, h * 0.22);
  ctx.lineTo(w * 0.85, h * 0.22);
  ctx.lineTo(w * 0.72, h * 0.6);
  ctx.lineTo(w * 0.28, h * 0.6);
  ctx.closePath();
  ctx.fill();

  // Arms — very thick, reaching down
  ctx.fillStyle = '#ddd';
  // Left arm
  ctx.beginPath();
  ctx.moveTo(w * 0.15, h * 0.22);
  ctx.lineTo(w * 0.04, h * 0.3);
  ctx.lineTo(w * 0.06, h * 0.65);
  ctx.lineTo(w * 0.18, h * 0.58);
  ctx.closePath();
  ctx.fill();
  // Right arm
  ctx.beginPath();
  ctx.moveTo(w * 0.85, h * 0.22);
  ctx.lineTo(w * 0.96, h * 0.3);
  ctx.lineTo(w * 0.94, h * 0.65);
  ctx.lineTo(w * 0.82, h * 0.58);
  ctx.closePath();
  ctx.fill();

  // Fists
  ctx.fillStyle = '#eee';
  circle(ctx, w * 0.07, h * 0.67, w * 0.06);
  circle(ctx, w * 0.93, h * 0.67, w * 0.06);

  // Legs — short and thick
  ctx.fillStyle = '#ccc';
  ctx.fillRect(w * 0.3, h * 0.58, w * 0.14, h * 0.32);
  ctx.fillRect(w * 0.56, h * 0.58, w * 0.14, h * 0.32);

  // Eyes — glowing
  ctx.fillStyle = '#fff';
  circle(ctx, w * 0.44, h * 0.13, w * 0.02);
  circle(ctx, w * 0.56, h * 0.13, w * 0.02);
}

// ---------------------------------------------------------------------------
// 6. Phase Spider — L6, Rogue (class 1)
// Top-down view: bilateral symmetry, 8 radiating legs with joints
// ---------------------------------------------------------------------------
function drawPhaseSpider(ctx: CanvasRenderingContext2D, w: number, h: number) {
  // Abdomen (rear body)
  ctx.fillStyle = '#fff';
  ellipse(ctx, w * 0.5, h * 0.58, w * 0.12, h * 0.16);

  // Cephalothorax (front body)
  ctx.fillStyle = '#eee';
  ellipse(ctx, w * 0.5, h * 0.38, w * 0.09, h * 0.1);

  // Connection
  ctx.fillStyle = '#ddd';
  ctx.fillRect(w * 0.44, h * 0.44, w * 0.12, h * 0.08);

  // 8 legs — 4 pairs, drawn as 2-segment strokes with joints
  ctx.strokeStyle = '#ccc';
  ctx.lineWidth = Math.max(0.8, w * 0.025);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // Leg data: [startY, jointX offset, jointY, endX offset, endY]
  // Left side — mirrored for right
  const legPairs: [number, number, number, number, number][] = [
    [0.38, 0.22, 0.22, 0.42, 0.12], // front legs — forward
    [0.42, 0.26, 0.38, 0.44, 0.3],  // mid-front — outward
    [0.52, 0.26, 0.55, 0.44, 0.52], // mid-back — outward
    [0.58, 0.2, 0.72, 0.38, 0.82],  // back legs — backward
  ];

  for (const [sy, jxOff, jy, exOff, ey] of legPairs) {
    // Left leg
    ctx.beginPath();
    ctx.moveTo(w * 0.42, h * sy);
    ctx.lineTo(w * (0.5 - jxOff), h * jy);
    ctx.lineTo(w * (0.5 - exOff), h * ey);
    ctx.stroke();
    // Right leg (mirrored)
    ctx.beginPath();
    ctx.moveTo(w * 0.58, h * sy);
    ctx.lineTo(w * (0.5 + jxOff), h * jy);
    ctx.lineTo(w * (0.5 + exOff), h * ey);
    ctx.stroke();
  }

  // Joint dots — slightly brighter
  ctx.fillStyle = '#bbb';
  for (const [, jxOff, jy] of legPairs) {
    circle(ctx, w * (0.5 - jxOff), h * jy, w * 0.015);
    circle(ctx, w * (0.5 + jxOff), h * jy, w * 0.015);
  }

  // Mandibles / fangs
  ctx.strokeStyle = '#aaa';
  ctx.lineWidth = Math.max(0.6, w * 0.02);
  ctx.beginPath();
  ctx.moveTo(w * 0.46, h * 0.3);
  ctx.lineTo(w * 0.42, h * 0.22);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(w * 0.54, h * 0.3);
  ctx.lineTo(w * 0.58, h * 0.22);
  ctx.stroke();

  // Eyes — cluster of small dots
  ctx.fillStyle = '#fff';
  circle(ctx, w * 0.47, h * 0.34, w * 0.015);
  circle(ctx, w * 0.53, h * 0.34, w * 0.015);
  circle(ctx, w * 0.45, h * 0.36, w * 0.01);
  circle(ctx, w * 0.55, h * 0.36, w * 0.01);
}

// ---------------------------------------------------------------------------
// 7. Bonecaster — L7, Mage (class 2)
// Front view: tall, thin, skeletal with skull head, staff, robes
// ---------------------------------------------------------------------------
function drawBonecaster(ctx: CanvasRenderingContext2D, w: number, h: number) {
  // Skull head
  ctx.fillStyle = '#fff';
  ellipse(ctx, w * 0.45, h * 0.1, w * 0.12, h * 0.07);
  // Jaw
  ctx.fillStyle = '#ddd';
  ctx.fillRect(w * 0.38, h * 0.14, w * 0.14, h * 0.04);

  // Eye sockets (black holes in skull)
  ctx.fillStyle = '#000';
  circle(ctx, w * 0.4, h * 0.09, w * 0.03);
  circle(ctx, w * 0.5, h * 0.09, w * 0.03);

  // Spine / torso — thin vertical
  ctx.fillStyle = '#bbb';
  ctx.fillRect(w * 0.42, h * 0.18, w * 0.06, h * 0.3);

  // Ribcage — horizontal lines
  ctx.strokeStyle = '#aaa';
  ctx.lineWidth = Math.max(0.5, w * 0.02);
  for (let i = 0; i < 4; i++) {
    const ry = h * (0.22 + i * 0.06);
    const spread = w * (0.1 + i * 0.02);
    ctx.beginPath();
    ctx.moveTo(w * 0.45 - spread, ry);
    ctx.quadraticCurveTo(w * 0.45, ry + h * 0.01, w * 0.45 + spread, ry);
    ctx.stroke();
  }

  // Staff — right side, full height
  ctx.strokeStyle = '#999';
  ctx.lineWidth = Math.max(0.8, w * 0.03);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(w * 0.75, h * 0.05);
  ctx.lineTo(w * 0.76, h * 0.85);
  ctx.stroke();

  // Staff skull ornament
  ctx.fillStyle = '#ccc';
  circle(ctx, w * 0.75, h * 0.05, w * 0.04);

  // Robes — flaring at bottom
  ctx.fillStyle = '#999';
  ctx.beginPath();
  ctx.moveTo(w * 0.36, h * 0.45);
  ctx.lineTo(w * 0.54, h * 0.45);
  ctx.lineTo(w * 0.65, h * 0.92);
  ctx.lineTo(w * 0.2, h * 0.92);
  ctx.closePath();
  ctx.fill();

  // Robe edge wisps
  ctx.strokeStyle = '#666';
  ctx.lineWidth = Math.max(0.5, w * 0.015);
  ctx.beginPath();
  ctx.moveTo(w * 0.2, h * 0.92);
  ctx.quadraticCurveTo(w * 0.15, h * 0.96, w * 0.12, h * 0.98);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(w * 0.65, h * 0.92);
  ctx.quadraticCurveTo(w * 0.7, h * 0.96, w * 0.74, h * 0.98);
  ctx.stroke();

  // Arm holding staff
  ctx.strokeStyle = '#aaa';
  ctx.lineWidth = Math.max(0.6, w * 0.02);
  ctx.beginPath();
  ctx.moveTo(w * 0.48, h * 0.3);
  ctx.lineTo(w * 0.62, h * 0.35);
  ctx.lineTo(w * 0.74, h * 0.3);
  ctx.stroke();
}

// ---------------------------------------------------------------------------
// 8. Rock Golem — L8, Warrior (class 0)
// Front view: massive blocky body, very dense fill, small angular head
// ---------------------------------------------------------------------------
function drawRockGolem(ctx: CanvasRenderingContext2D, w: number, h: number) {
  // Head — small, angular
  ctx.fillStyle = '#ddd';
  ctx.beginPath();
  ctx.moveTo(w * 0.4, h * 0.06);
  ctx.lineTo(w * 0.6, h * 0.06);
  ctx.lineTo(w * 0.62, h * 0.15);
  ctx.lineTo(w * 0.38, h * 0.15);
  ctx.closePath();
  ctx.fill();

  // Shoulders — massive wide block
  ctx.fillStyle = '#fff';
  ctx.fillRect(w * 0.1, h * 0.15, w * 0.8, h * 0.14);

  // Torso — very wide, very dense
  ctx.fillRect(w * 0.15, h * 0.29, w * 0.7, h * 0.3);

  // Arms — thick pillars at sides
  ctx.fillStyle = '#eee';
  ctx.fillRect(w * 0.02, h * 0.17, w * 0.14, h * 0.4);
  ctx.fillRect(w * 0.84, h * 0.17, w * 0.14, h * 0.4);

  // Fists — large blocks
  ctx.fillStyle = '#ddd';
  ctx.fillRect(w * 0.0, h * 0.55, w * 0.16, h * 0.12);
  ctx.fillRect(w * 0.84, h * 0.55, w * 0.16, h * 0.12);

  // Legs — thick pillars
  ctx.fillStyle = '#ccc';
  ctx.fillRect(w * 0.22, h * 0.59, w * 0.2, h * 0.34);
  ctx.fillRect(w * 0.58, h * 0.59, w * 0.2, h * 0.34);

  // Crack textures — black lines through the body
  ctx.strokeStyle = '#444';
  ctx.lineWidth = Math.max(0.5, w * 0.015);
  ctx.beginPath();
  ctx.moveTo(w * 0.35, h * 0.2);
  ctx.lineTo(w * 0.4, h * 0.35);
  ctx.lineTo(w * 0.38, h * 0.5);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(w * 0.65, h * 0.25);
  ctx.lineTo(w * 0.6, h * 0.4);
  ctx.stroke();

  // Eyes — glowing points
  ctx.fillStyle = '#fff';
  circle(ctx, w * 0.45, h * 0.1, w * 0.02);
  circle(ctx, w * 0.55, h * 0.1, w * 0.02);
}

// ---------------------------------------------------------------------------
// 9. Pale Stalker — L9, Rogue (class 1)
// Front view: ghostly, hooded, mostly negative space, fading cloak
// ---------------------------------------------------------------------------
function drawPaleStalker(ctx: CanvasRenderingContext2D, w: number, h: number) {
  // Hood — pointed arch
  ctx.fillStyle = '#999';
  ctx.beginPath();
  ctx.moveTo(w * 0.5, h * 0.02);
  ctx.quadraticCurveTo(w * 0.7, h * 0.08, w * 0.65, h * 0.22);
  ctx.lineTo(w * 0.35, h * 0.22);
  ctx.quadraticCurveTo(w * 0.3, h * 0.08, w * 0.5, h * 0.02);
  ctx.closePath();
  ctx.fill();

  // Face shadow under hood (dark void)
  ctx.fillStyle = '#333';
  ellipse(ctx, w * 0.5, h * 0.17, w * 0.1, h * 0.05);

  // Eyes — the only bright points, piercing
  ctx.fillStyle = '#fff';
  circle(ctx, w * 0.45, h * 0.16, w * 0.015);
  circle(ctx, w * 0.55, h * 0.16, w * 0.015);

  // Shoulders — faint
  ctx.fillStyle = '#666';
  ctx.beginPath();
  ctx.moveTo(w * 0.35, h * 0.22);
  ctx.lineTo(w * 0.65, h * 0.22);
  ctx.lineTo(w * 0.7, h * 0.3);
  ctx.lineTo(w * 0.3, h * 0.3);
  ctx.closePath();
  ctx.fill();

  // Cloak body — fading gradient (darker as it goes down)
  for (let i = 0; i < 8; i++) {
    const t = i / 8;
    const y = h * (0.3 + t * 0.55);
    const bh = h * 0.08;
    const spread = 0.18 + t * 0.08;
    const brightness = Math.floor(100 - t * 80);
    ctx.fillStyle = `rgb(${brightness},${brightness},${brightness})`;
    ctx.fillRect(w * (0.5 - spread), y, w * spread * 2, bh);
  }

  // Wispy edges — the cloak dissolves
  ctx.strokeStyle = '#333';
  ctx.lineWidth = Math.max(0.5, w * 0.015);
  ctx.lineCap = 'round';
  for (const [sx, sy, ex, ey] of [
    [0.32, 0.75, 0.25, 0.9],
    [0.68, 0.75, 0.75, 0.9],
    [0.36, 0.82, 0.3, 0.95],
    [0.64, 0.82, 0.7, 0.95],
  ] as [number, number, number, number][]) {
    ctx.beginPath();
    ctx.moveTo(w * sx, h * sy);
    ctx.lineTo(w * ex, h * ey);
    ctx.stroke();
  }
}

// ---------------------------------------------------------------------------
// 10. Dusk Drake — L10, Mage (class 2)
// Side/three-quarter: spread wings, serpentine neck, compact body, tail
// ---------------------------------------------------------------------------
function drawDuskDrake(ctx: CanvasRenderingContext2D, w: number, h: number) {
  // Wings — large triangular shapes
  ctx.fillStyle = '#bbb';
  // Left wing
  ctx.beginPath();
  ctx.moveTo(w * 0.35, h * 0.4);
  ctx.lineTo(w * 0.02, h * 0.1);
  ctx.lineTo(w * 0.05, h * 0.35);
  ctx.lineTo(w * 0.2, h * 0.5);
  ctx.closePath();
  ctx.fill();
  // Right wing
  ctx.beginPath();
  ctx.moveTo(w * 0.65, h * 0.4);
  ctx.lineTo(w * 0.98, h * 0.1);
  ctx.lineTo(w * 0.95, h * 0.35);
  ctx.lineTo(w * 0.8, h * 0.5);
  ctx.closePath();
  ctx.fill();

  // Wing membrane detail (dimmer struts)
  ctx.strokeStyle = '#888';
  ctx.lineWidth = Math.max(0.5, w * 0.015);
  // Left wing struts
  ctx.beginPath();
  ctx.moveTo(w * 0.35, h * 0.42);
  ctx.lineTo(w * 0.08, h * 0.15);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(w * 0.3, h * 0.45);
  ctx.lineTo(w * 0.1, h * 0.3);
  ctx.stroke();
  // Right wing struts
  ctx.beginPath();
  ctx.moveTo(w * 0.65, h * 0.42);
  ctx.lineTo(w * 0.92, h * 0.15);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(w * 0.7, h * 0.45);
  ctx.lineTo(w * 0.9, h * 0.3);
  ctx.stroke();

  // Body — compact center mass
  ctx.fillStyle = '#fff';
  ellipse(ctx, w * 0.5, h * 0.52, w * 0.15, h * 0.12);

  // Neck — serpentine curve upward
  ctx.fillStyle = '#ddd';
  ctx.beginPath();
  ctx.moveTo(w * 0.42, h * 0.42);
  ctx.quadraticCurveTo(w * 0.38, h * 0.28, w * 0.42, h * 0.18);
  ctx.lineTo(w * 0.48, h * 0.18);
  ctx.quadraticCurveTo(w * 0.44, h * 0.28, w * 0.48, h * 0.42);
  ctx.closePath();
  ctx.fill();

  // Head — angular, small
  ctx.fillStyle = '#eee';
  ctx.beginPath();
  ctx.moveTo(w * 0.38, h * 0.18);
  ctx.lineTo(w * 0.45, h * 0.1);
  ctx.lineTo(w * 0.52, h * 0.18);
  ctx.closePath();
  ctx.fill();
  // Horns
  ctx.strokeStyle = '#aaa';
  ctx.lineWidth = Math.max(0.5, w * 0.015);
  ctx.beginPath();
  ctx.moveTo(w * 0.4, h * 0.14);
  ctx.lineTo(w * 0.34, h * 0.06);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(w * 0.5, h * 0.14);
  ctx.lineTo(w * 0.56, h * 0.06);
  ctx.stroke();

  // Tail — curving down and back
  ctx.strokeStyle = '#aaa';
  ctx.lineWidth = Math.max(0.8, w * 0.03);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(w * 0.58, h * 0.58);
  ctx.quadraticCurveTo(w * 0.7, h * 0.72, w * 0.6, h * 0.88);
  ctx.stroke();

  // Tail tip
  ctx.fillStyle = '#999';
  ctx.beginPath();
  ctx.moveTo(w * 0.6, h * 0.88);
  ctx.lineTo(w * 0.55, h * 0.94);
  ctx.lineTo(w * 0.65, h * 0.94);
  ctx.closePath();
  ctx.fill();

  // Legs — tucked under body
  ctx.strokeStyle = '#999';
  ctx.lineWidth = Math.max(0.6, w * 0.02);
  ctx.beginPath();
  ctx.moveTo(w * 0.42, h * 0.6);
  ctx.lineTo(w * 0.38, h * 0.72);
  ctx.lineTo(w * 0.42, h * 0.75);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(w * 0.58, h * 0.6);
  ctx.lineTo(w * 0.62, h * 0.72);
  ctx.lineTo(w * 0.58, h * 0.75);
  ctx.stroke();

  // Eye
  ctx.fillStyle = '#fff';
  circle(ctx, w * 0.45, h * 0.15, w * 0.015);
}

// ---------------------------------------------------------------------------
// 11. Basilisk — L12, Boss, Warrior (class 0)
// Coiled serpentine S-curve filling the frame, large head with fangs
// ---------------------------------------------------------------------------
function drawBasilisk(ctx: CanvasRenderingContext2D, w: number, h: number) {
  // Coiled body — thick S-curve using multiple overlapping ellipses
  ctx.fillStyle = '#fff';

  // Main body coil as a thick path
  ctx.lineWidth = Math.max(2, w * 0.12);
  ctx.strokeStyle = '#fff';
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // S-curve body
  ctx.beginPath();
  ctx.moveTo(w * 0.3, h * 0.15);
  ctx.bezierCurveTo(
    w * 0.8, h * 0.1,
    w * 0.85, h * 0.45,
    w * 0.35, h * 0.45,
  );
  ctx.bezierCurveTo(
    w * 0.1, h * 0.45,
    w * 0.1, h * 0.7,
    w * 0.55, h * 0.7,
  );
  ctx.bezierCurveTo(
    w * 0.85, h * 0.7,
    w * 0.9, h * 0.92,
    w * 0.5, h * 0.9,
  );
  ctx.stroke();

  // Body fill — draw ellipses along the path for more density
  ctx.fillStyle = '#eee';
  for (const [cx, cy, rx, ry] of [
    [0.3, 0.15, 0.08, 0.06],
    [0.55, 0.13, 0.1, 0.07],
    [0.72, 0.18, 0.08, 0.07],
    [0.75, 0.3, 0.08, 0.08],
    [0.6, 0.42, 0.1, 0.07],
    [0.35, 0.45, 0.1, 0.07],
    [0.2, 0.5, 0.07, 0.07],
    [0.2, 0.62, 0.07, 0.07],
    [0.35, 0.68, 0.1, 0.07],
    [0.55, 0.7, 0.1, 0.07],
    [0.72, 0.72, 0.08, 0.07],
    [0.78, 0.8, 0.06, 0.06],
    [0.65, 0.88, 0.08, 0.05],
    [0.5, 0.9, 0.08, 0.05],
  ] as [number, number, number, number][]) {
    ellipse(ctx, w * cx, h * cy, w * rx, h * ry);
  }

  // Scale texture — faint crosshatch (dimmer lines within body)
  ctx.strokeStyle = '#888';
  ctx.lineWidth = Math.max(0.4, w * 0.01);
  for (let i = 0; i < 12; i++) {
    const t = i / 12;
    // Points along approximate spine
    const sx = w * (0.3 + Math.sin(t * Math.PI * 2.5) * 0.25);
    const sy = h * (0.15 + t * 0.75);
    ctx.beginPath();
    ctx.moveTo(sx - w * 0.03, sy - h * 0.02);
    ctx.lineTo(sx + w * 0.03, sy + h * 0.02);
    ctx.stroke();
  }

  // Head — large, angular, at top of S-curve
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.moveTo(w * 0.2, h * 0.15);
  ctx.lineTo(w * 0.12, h * 0.06);
  ctx.lineTo(w * 0.3, h * 0.04);
  ctx.lineTo(w * 0.38, h * 0.12);
  ctx.lineTo(w * 0.32, h * 0.2);
  ctx.closePath();
  ctx.fill();

  // Crown / horns
  ctx.fillStyle = '#ddd';
  ctx.beginPath();
  ctx.moveTo(w * 0.18, h * 0.08);
  ctx.lineTo(w * 0.14, h * 0.0);
  ctx.lineTo(w * 0.22, h * 0.06);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(w * 0.28, h * 0.06);
  ctx.lineTo(w * 0.3, h * 0.0);
  ctx.lineTo(w * 0.34, h * 0.06);
  ctx.closePath();
  ctx.fill();

  // Fangs
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = Math.max(0.6, w * 0.02);
  ctx.beginPath();
  ctx.moveTo(w * 0.14, h * 0.1);
  ctx.lineTo(w * 0.1, h * 0.18);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(w * 0.2, h * 0.12);
  ctx.lineTo(w * 0.17, h * 0.2);
  ctx.stroke();

  // Eyes — bright, menacing
  ctx.fillStyle = '#fff';
  circle(ctx, w * 0.2, h * 0.08, w * 0.025);
  circle(ctx, w * 0.28, h * 0.07, w * 0.025);

  // Tail tip — at end of S-curve
  ctx.strokeStyle = '#999';
  ctx.lineWidth = Math.max(0.6, w * 0.025);
  ctx.beginPath();
  ctx.moveTo(w * 0.5, h * 0.9);
  ctx.quadraticCurveTo(w * 0.4, h * 0.94, w * 0.38, h * 0.97);
  ctx.stroke();
}

// ---------------------------------------------------------------------------
// Template registry
// ---------------------------------------------------------------------------

export const MONSTER_TEMPLATES: MonsterTemplate[] = [
  {
    id: 'dire_rat',
    name: 'Dire Rat',
    gridWidth: 12,
    gridHeight: 7,
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
    gridWidth: 12,
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
    gridWidth: 14,
    gridHeight: 12,
    monsterClass: 0,
    level: 5,
    draw: drawIronhideTroll,
  },
  {
    id: 'phase_spider',
    name: 'Phase Spider',
    gridWidth: 14,
    gridHeight: 12,
    monsterClass: 1,
    level: 6,
    draw: drawPhaseSpider,
  },
  {
    id: 'bonecaster',
    name: 'Bonecaster',
    gridWidth: 8,
    gridHeight: 14,
    monsterClass: 2,
    level: 7,
    draw: drawBonecaster,
  },
  {
    id: 'rock_golem',
    name: 'Rock Golem',
    gridWidth: 12,
    gridHeight: 14,
    monsterClass: 0,
    level: 8,
    draw: drawRockGolem,
  },
  {
    id: 'pale_stalker',
    name: 'Pale Stalker',
    gridWidth: 12,
    gridHeight: 14,
    monsterClass: 1,
    level: 9,
    draw: drawPaleStalker,
  },
  {
    id: 'dusk_drake',
    name: 'Dusk Drake',
    gridWidth: 16,
    gridHeight: 14,
    monsterClass: 2,
    level: 10,
    draw: drawDuskDrake,
  },
  {
    id: 'basilisk',
    name: 'Basilisk',
    gridWidth: 16,
    gridHeight: 16,
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
