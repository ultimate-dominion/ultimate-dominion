import { fillEllipse, fillCircle, ambientOcclusion, highlight } from './helpers.js';
import { drawBodyOutline, drawLimbChain, drawDebugSkeleton } from './skeleton.js';
import { renderAscii } from './ascii-renderer.js';

// -- gradient helper --
function bodyGrad3(ctx, cx, cy, r, midR, midG, midB, sR, sG, sB, hiR, hiG, hiB) {
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
  g.addColorStop(0, `rgb(${hiR},${hiG},${hiB})`);
  g.addColorStop(0.25, `rgb(${midR},${midG},${midB})`);
  g.addColorStop(0.50, `rgb(${Math.floor(midR*0.85+sR*0.15)},${Math.floor(midG*0.85+sG*0.15)},${Math.floor(midB*0.85+sB*0.15)})`);
  g.addColorStop(0.75, `rgb(${Math.floor(midR*0.5+sR*0.5)},${Math.floor(midG*0.5+sG*0.5)},${Math.floor(midB*0.5+sB*0.5)})`);
  g.addColorStop(1, `rgb(${sR},${sG},${sB})`);
  return g;
}

// ==========================================================================
// GIANT SPIDER SKELETON — 8 legs, two body segments, facing LEFT
// Cephalothorax (front/left) + abdomen (back/right)
// Crouched, aggressive pose — front legs reaching forward
// ==========================================================================
export const giantSpiderSkeleton = {
  spine: [
    { id: 'fangs',   x: 0.16, y: 0.52, radius: 0.020 },
    { id: 'head',    x: 0.24, y: 0.48, radius: 0.070 },  // cephalothorax
    { id: 'waist',   x: 0.38, y: 0.50, radius: 0.045 },  // narrow waist (pedicel)
    { id: 'abdomen', x: 0.58, y: 0.46, radius: 0.140 },  // BIG round abdomen
    { id: 'rear',    x: 0.72, y: 0.50, radius: 0.100 },  // rear of abdomen
  ],
  limbs: [
    // === NEAR SIDE (4 legs) — facing viewer, SPREAD WIDE ===
    // Near leg 1 — front-most, reaching FAR forward
    { attach: 'head', side: 'near', segments: [
      { x: 0.18, y: 0.44, radius: 0.024 },
      { x: 0.08, y: 0.26, radius: 0.018 },  // knee HIGH up, far forward
      { x: 0.02, y: 0.44, radius: 0.014 },   // angled down
      { x: -0.04, y: 0.66, radius: 0.012 },  // foot — very far forward
    ]},
    // Near leg 2 — second pair, angled forward-down
    { attach: 'head', side: 'near', segments: [
      { x: 0.22, y: 0.42, radius: 0.024 },
      { x: 0.14, y: 0.24, radius: 0.018 },
      { x: 0.08, y: 0.48, radius: 0.014 },
      { x: 0.04, y: 0.72, radius: 0.012 },
    ]},
    // Near leg 3 — third pair, angled slightly back
    { attach: 'waist', side: 'near', segments: [
      { x: 0.34, y: 0.44, radius: 0.024 },
      { x: 0.28, y: 0.22, radius: 0.018 },
      { x: 0.22, y: 0.50, radius: 0.014 },
      { x: 0.16, y: 0.74, radius: 0.012 },
    ]},
    // Near leg 4 — rear pair, angled backward
    { attach: 'abdomen', side: 'near', segments: [
      { x: 0.50, y: 0.46, radius: 0.024 },
      { x: 0.48, y: 0.24, radius: 0.018 },
      { x: 0.44, y: 0.52, radius: 0.014 },
      { x: 0.38, y: 0.76, radius: 0.012 },
    ]},
    // === FAR SIDE (4 legs) — behind body, slightly less spread ===
    // Far leg 1 — front
    { attach: 'head', side: 'far', segments: [
      { x: 0.20, y: 0.50, radius: 0.020 },
      { x: 0.12, y: 0.32, radius: 0.015 },
      { x: 0.06, y: 0.50, radius: 0.011 },
      { x: 0.00, y: 0.70, radius: 0.009 },
    ]},
    // Far leg 2
    { attach: 'head', side: 'far', segments: [
      { x: 0.26, y: 0.50, radius: 0.020 },
      { x: 0.20, y: 0.30, radius: 0.015 },
      { x: 0.14, y: 0.54, radius: 0.011 },
      { x: 0.08, y: 0.74, radius: 0.009 },
    ]},
    // Far leg 3
    { attach: 'waist', side: 'far', segments: [
      { x: 0.38, y: 0.52, radius: 0.020 },
      { x: 0.34, y: 0.28, radius: 0.015 },
      { x: 0.30, y: 0.56, radius: 0.011 },
      { x: 0.24, y: 0.76, radius: 0.009 },
    ]},
    // Far leg 4 — rear
    { attach: 'abdomen', side: 'far', segments: [
      { x: 0.54, y: 0.52, radius: 0.020 },
      { x: 0.54, y: 0.30, radius: 0.015 },
      { x: 0.50, y: 0.58, radius: 0.011 },
      { x: 0.44, y: 0.78, radius: 0.009 },
    ]},
  ],
};

// ==========================================================================
// GIANT SPIDER — clean render for ASCII pipeline
// Dark blue-black, hairy abdomen, cluster of red eyes, large fangs
// ==========================================================================
export function drawGiantSpiderClean(ctx, skeleton, w, h) {
  const fangs = skeleton.spine.find(n => n.id === 'fangs');
  const head = skeleton.spine.find(n => n.id === 'head');
  const waist = skeleton.spine.find(n => n.id === 'waist');
  const abdomen = skeleton.spine.find(n => n.id === 'abdomen');
  const rear = skeleton.spine.find(n => n.id === 'rear');

  // --- PALETTE --- dark blue-black, needs contrast against black bg
  const bodyDark   = [22, 22, 38];     // dark blue-black
  const bodyMid    = [38, 36, 58];     // dark blue
  const bodyLight  = [55, 52, 82];     // blue highlight
  const bodyBright = [72, 68, 100];    // brightest body tone
  const legDark    = [28, 28, 48];     // leg base — brighter for visibility
  const legShadow  = [16, 16, 30];     // far-side legs
  const abdomenDark = [26, 20, 36];    // abdomen darker, brownish-purple
  const abdomenMid  = [42, 34, 56];    // abdomen mid
  const abdomenHi   = [60, 50, 78];    // abdomen highlight
  const eyeRed     = [220, 40, 30];    // bright red eyes
  const eyeGlow    = [255, 80, 50];    // eye glow
  const fangColor  = [180, 170, 150];  // bright fangs — accent
  const fangDark   = [90, 85, 72];

  const hx = head.x, hy = head.y, hr = head.radius;
  const ax = abdomen.x, ay = abdomen.y, ar = abdomen.radius;

  // --- 1. FAR LEGS (shadow color) ---
  for (const limb of skeleton.limbs) {
    if (limb.side === 'far') {
      drawLimbChain(ctx, limb.segments, w, h, `rgb(${legShadow})`);
    }
  }

  // --- 2. ABDOMEN — large, round, hairy ---
  // Abdomen gradient
  const abdGrad = bodyGrad3(ctx, w * ax, h * ay, w * ar * 1.2,
    ...abdomenMid, ...abdomenDark, ...abdomenHi);
  ctx.fillStyle = abdGrad;
  // Slightly elongated horizontally
  fillEllipse(ctx, w * ax, h * ay, w * ar * 1.3, h * ar * 1.1);

  // Abdomen rear bulge
  const rearGrad = bodyGrad3(ctx, w * rear.x, h * rear.y, w * rear.radius,
    ...abdomenDark, ...abdomenDark, ...abdomenMid);
  ctx.fillStyle = rearGrad;
  fillEllipse(ctx, w * rear.x, h * rear.y, w * rear.radius * 1.1, h * rear.radius * 0.9);

  // Hair texture on abdomen — short strokes radiating outward, VISIBLE
  ctx.strokeStyle = `rgba(${abdomenHi},0.5)`;
  ctx.lineWidth = w * 0.004;
  ctx.lineCap = 'round';
  for (let i = 0; i < 40; i++) {
    const angle = (i / 30) * Math.PI * 2;
    const dist = ar * (0.7 + Math.random() * 0.4);
    const sx = ax + Math.cos(angle) * dist * 0.9;
    const sy = ay + Math.sin(angle) * dist * 0.7;
    const len = 0.02 + Math.random() * 0.02;
    ctx.beginPath();
    ctx.moveTo(w * sx, h * sy);
    ctx.lineTo(w * (sx + Math.cos(angle) * len), h * (sy + Math.sin(angle) * len * 0.8));
    ctx.stroke();
  }

  // Abdomen markings — darker chevron/stripe pattern
  ctx.strokeStyle = `rgba(${abdomenDark},0.5)`;
  ctx.lineWidth = w * 0.006;
  for (let m = 0; m < 3; m++) {
    const mx = ax - 0.04 + m * 0.08;
    ctx.beginPath();
    ctx.moveTo(w * (mx - 0.03), h * (ay - 0.02));
    ctx.lineTo(w * mx, h * (ay - 0.06));
    ctx.lineTo(w * (mx + 0.03), h * (ay - 0.02));
    ctx.stroke();
  }

  // --- 3. WAIST (pedicel) — narrow connection ---
  ctx.fillStyle = `rgb(${bodyDark})`;
  fillEllipse(ctx, w * waist.x, h * waist.y, w * waist.radius, h * waist.radius * 0.8);

  // --- 4. CEPHALOTHORAX (head segment) ---
  const headGrad = bodyGrad3(ctx, w * hx, h * hy, w * hr * 1.2,
    ...bodyMid, ...bodyDark, ...bodyLight);
  ctx.fillStyle = headGrad;
  fillEllipse(ctx, w * hx, h * hy, w * hr * 1.1, h * hr * 0.9);

  // Carapace ridge — subtle highlight line
  ctx.strokeStyle = `rgba(${bodyBright},0.4)`;
  ctx.lineWidth = w * 0.004;
  ctx.beginPath();
  ctx.moveTo(w * (hx - hr * 0.6), h * (hy - 0.01));
  ctx.quadraticCurveTo(w * hx, h * (hy - hr * 0.5), w * (hx + hr * 0.8), h * hy);
  ctx.stroke();

  // --- 5. NEAR LEGS ---
  for (const limb of skeleton.limbs) {
    if (limb.side === 'near') {
      drawLimbChain(ctx, limb.segments, w, h, `rgb(${legDark})`);
    }
  }

  // Leg joint highlights — small bright circles at each knee
  for (const limb of skeleton.limbs) {
    if (limb.side === 'near' && limb.segments.length >= 2) {
      const knee = limb.segments[1];
      ctx.fillStyle = `rgba(${bodyLight},0.4)`;
      fillCircle(ctx, w * knee.x, h * knee.y, w * knee.radius * 0.8);
    }
  }

  // Leg tips — small claws/hooks at each foot
  for (const limb of skeleton.limbs) {
    const foot = limb.segments[limb.segments.length - 1];
    const prev = limb.segments[limb.segments.length - 2];
    const dx = foot.x - prev.x;
    const dy = foot.y - prev.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len > 0) {
      const nx = dx / len, ny = dy / len;
      ctx.strokeStyle = limb.side === 'near' ? `rgb(${fangDark})` : `rgba(${fangDark},0.5)`;
      ctx.lineWidth = w * 0.004;
      ctx.lineCap = 'round';
      // Two small claw hooks
      ctx.beginPath();
      ctx.moveTo(w * foot.x, h * foot.y);
      ctx.lineTo(w * (foot.x + nx * 0.02 - ny * 0.008), h * (foot.y + ny * 0.02 + nx * 0.008));
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(w * foot.x, h * foot.y);
      ctx.lineTo(w * (foot.x + nx * 0.02 + ny * 0.008), h * (foot.y + ny * 0.02 - nx * 0.008));
      ctx.stroke();
    }
  }

  // --- 6. FANGS / CHELICERAE --- bright accent, reaching forward, BIG
  // Near fang (larger, closer to viewer) — curves down like a hook
  ctx.fillStyle = `rgb(${fangColor})`;
  ctx.beginPath();
  ctx.moveTo(w * (hx - hr * 0.5), h * (hy + 0.01));
  ctx.quadraticCurveTo(w * (hx - hr * 1.2), h * (hy + 0.04), w * (hx - hr * 1.6), h * (hy + 0.12));
  ctx.quadraticCurveTo(w * (hx - hr * 1.2), h * (hy + 0.02), w * (hx - hr * 0.5), h * (hy - 0.02));
  ctx.closePath();
  ctx.fill();
  // Fang tip highlight — bright point
  ctx.fillStyle = 'rgb(240,235,220)';
  fillCircle(ctx, w * (hx - hr * 1.55), h * (hy + 0.12), w * 0.006);
  // Fang venom drip
  ctx.fillStyle = `rgba(${eyeRed},0.5)`;
  fillCircle(ctx, w * (hx - hr * 1.50), h * (hy + 0.15), w * 0.004);

  // Far fang (smaller, behind) — also curves down
  ctx.fillStyle = `rgb(${fangDark})`;
  ctx.beginPath();
  ctx.moveTo(w * (hx - hr * 0.4), h * (hy + 0.03));
  ctx.quadraticCurveTo(w * (hx - hr * 1.0), h * (hy + 0.07), w * (hx - hr * 1.4), h * (hy + 0.16));
  ctx.quadraticCurveTo(w * (hx - hr * 1.0), h * (hy + 0.05), w * (hx - hr * 0.4), h * (hy + 0.01));
  ctx.closePath();
  ctx.fill();

  // Pedipalps — small arm-like appendages flanking the fangs
  ctx.strokeStyle = `rgb(${legDark})`;
  ctx.lineWidth = w * 0.008;
  ctx.lineCap = 'round';
  // Near pedipalp
  ctx.beginPath();
  ctx.moveTo(w * (hx - hr * 0.5), h * (hy - 0.02));
  ctx.quadraticCurveTo(w * (hx - hr * 1.0), h * (hy - 0.04), w * (hx - hr * 1.1), h * (hy + 0.02));
  ctx.stroke();
  // Far pedipalp
  ctx.strokeStyle = `rgb(${legShadow})`;
  ctx.lineWidth = w * 0.006;
  ctx.beginPath();
  ctx.moveTo(w * (hx - hr * 0.4), h * (hy + 0.05));
  ctx.quadraticCurveTo(w * (hx - hr * 0.8), h * (hy + 0.02), w * (hx - hr * 0.9), h * (hy + 0.08));
  ctx.stroke();

  // --- 7. EYES — cluster of 8 small red eyes, THE focal point ---
  const eyeCx = hx - hr * 0.5, eyeCy = hy - hr * 0.1;

  // Subtle ambient glow — NOT too spread (keep individual eyes distinct)
  const eyeClusterGlow = ctx.createRadialGradient(
    w * eyeCx, h * eyeCy, 0,
    w * eyeCx, h * eyeCy, w * 0.035
  );
  eyeClusterGlow.addColorStop(0, `rgba(${eyeGlow},0.15)`);
  eyeClusterGlow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = eyeClusterGlow;
  fillCircle(ctx, w * eyeCx, h * eyeCy, w * 0.035);

  // Main pair (largest) — front center, spread wider
  drawSpiderEye(ctx, w * (eyeCx - 0.016), h * (eyeCy + 0.006), w * 0.009, eyeRed, eyeGlow);
  drawSpiderEye(ctx, w * (eyeCx + 0.014), h * (eyeCy + 0.008), w * 0.008, eyeRed, eyeGlow);

  // Secondary pair — wider apart, slightly above
  drawSpiderEye(ctx, w * (eyeCx - 0.030), h * (eyeCy - 0.002), w * 0.006, eyeRed, eyeGlow);
  drawSpiderEye(ctx, w * (eyeCx + 0.026), h * (eyeCy + 0.000), w * 0.006, eyeRed, eyeGlow);

  // Tertiary pair — smaller, higher, wider
  drawSpiderEye(ctx, w * (eyeCx - 0.022), h * (eyeCy - 0.016), w * 0.005, eyeRed, eyeGlow);
  drawSpiderEye(ctx, w * (eyeCx + 0.018), h * (eyeCy - 0.014), w * 0.005, eyeRed, eyeGlow);

  // Tiny rear pair — top of head
  drawSpiderEye(ctx, w * (eyeCx - 0.008), h * (eyeCy - 0.024), w * 0.004, eyeRed, eyeGlow);
  drawSpiderEye(ctx, w * (eyeCx + 0.006), h * (eyeCy - 0.022), w * 0.003, eyeRed, eyeGlow);

  // --- 8. AMBIENT OCCLUSION ---
  // Under the body where it meets the ground
  ambientOcclusion(ctx, w * 0.30, h * 0.72, w * 0.30, h * 0.04, 0.3);
  // Between cephalothorax and abdomen
  ambientOcclusion(ctx, w * waist.x, h * waist.y, w * 0.04, h * 0.03, 0.4);
}

// Helper: draw a single spider eye — tight glow, distinct dots
function drawSpiderEye(ctx, x, y, r, eyeColor, glowColor) {
  // Socket shadow
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  fillCircle(ctx, x, y, r * 1.3);
  // Eye body — the main color
  ctx.fillStyle = `rgb(${eyeColor})`;
  fillCircle(ctx, x, y, r);
  // Bright core
  ctx.fillStyle = `rgb(${glowColor})`;
  fillCircle(ctx, x, y, r * 0.6);
  // Specular white dot
  ctx.fillStyle = 'rgb(255,255,255)';
  fillCircle(ctx, x - r * 0.25, y - r * 0.25, r * 0.3);
}

// ==========================================================================
// Harness
// ==========================================================================
const GRID_W = 7;
const GRID_H = 5;

export default { draw: drawGiantSpiderClean, skeleton: giantSpiderSkeleton, gridW: GRID_W, gridH: GRID_H };

if (typeof document !== 'undefined' && document.getElementById('canvas-size')) {
function render(elapsed = 0) {
  const size = parseInt(document.getElementById('canvas-size').value);
  const cellSize = parseInt(document.getElementById('cell-size').value);
  const showGrid = document.getElementById('show-grid').checked;
  const showDebug = document.getElementById('show-debug').checked;
  const sk = giantSpiderSkeleton;

  const canvasW = size;
  const canvasH = Math.round(size * GRID_H / GRID_W);
  const maxDisplay = 420;
  const displayW = `${Math.min(canvasW, maxDisplay)}px`;
  const displayH = `${Math.min(canvasH, Math.round(maxDisplay * GRID_H / GRID_W))}px`;

  const asciiOpts = { elapsed, cellSize, level: 4, gridWidth: GRID_W, gridHeight: GRID_H };

  // -- Skeleton view --
  const c1 = document.getElementById('canvas-size');
  c1.width = canvasW; c1.height = canvasH;
  c1.style.width = displayW; c1.style.height = displayH;
  const ctx1 = c1.getContext('2d');
  ctx1.fillStyle = '#000'; ctx1.fillRect(0, 0, canvasW, canvasH);
  const palette = {
    furDark: `rgb(22,24,40)`, furMid: `rgb(30,30,50)`,
    furShadow: `rgb(12,12,22)`, skinDark: `rgb(18,18,30)`,
  };
  for (const limb of sk.limbs) if (limb.side === 'far') drawLimbChain(ctx1, limb.segments, canvasW, canvasH, palette.furShadow);
  drawBodyOutline(ctx1, sk.spine, canvasW, canvasH, palette.furMid);
  for (const limb of sk.limbs) if (limb.side === 'near') drawLimbChain(ctx1, limb.segments, canvasW, canvasH, palette.furDark);
  if (showDebug) drawDebugSkeleton(ctx1, sk, canvasW, canvasH);

  // -- ASCII --
  const c2 = document.getElementById('next-ascii');
  c2.width = canvasW; c2.height = canvasH;
  c2.style.width = displayW; c2.style.height = displayH;
  const ctx2 = c2.getContext('2d');
  ctx2.fillStyle = '#000'; ctx2.fillRect(0, 0, canvasW, canvasH);
  renderAscii(ctx2, (tctx, tw, th) => {
    drawGiantSpiderClean(tctx, sk, tw, th);
  }, 0, 0, canvasW, canvasH, asciiOpts);

  // -- Painted --
  const c3 = document.getElementById('next-raw');
  c3.width = canvasW; c3.height = canvasH;
  c3.style.width = displayW; c3.style.height = displayH;
  const ctx3 = c3.getContext('2d');
  ctx3.fillStyle = '#000'; ctx3.fillRect(0, 0, canvasW, canvasH);
  drawGiantSpiderClean(ctx3, sk, canvasW, canvasH);

  if (showGrid) {
    for (const canvas of [c1, c2, c3]) {
      const gctx = canvas.getContext('2d');
      gctx.strokeStyle = 'rgba(255,255,255,0.08)'; gctx.lineWidth = 1;
      const step = canvasW / 10;
      for (let i = 0; i < canvasW; i += step) { gctx.beginPath(); gctx.moveTo(i, 0); gctx.lineTo(i, canvasH); gctx.stroke(); }
      for (let i = 0; i < canvasH; i += step) { gctx.beginPath(); gctx.moveTo(0, i); gctx.lineTo(canvasW, i); gctx.stroke(); }
    }
  }
}

let animating = false;
let animStart = 0;
let rafId = null;

function animationLoop(ts) {
  if (!animating) return;
  render(ts - animStart);
  rafId = requestAnimationFrame(animationLoop);
}

document.getElementById('reseed').addEventListener('click', () => {
  render(animating ? performance.now() - animStart : 0);
});
document.getElementById('animate').addEventListener('change', (e) => {
  animating = e.target.checked;
  if (animating) { animStart = performance.now(); rafId = requestAnimationFrame(animationLoop); }
  else if (rafId) { cancelAnimationFrame(rafId); render(0); }
});
for (const id of ['canvas-size', 'cell-size', 'show-grid', 'show-debug']) {
  document.getElementById(id).addEventListener('change', () => render(animating ? performance.now() - animStart : 0));
}

render();
}
