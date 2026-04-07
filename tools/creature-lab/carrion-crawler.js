import { fillEllipse, fillCircle, ambientOcclusion } from './helpers.js';
import { renderAscii } from './ascii-renderer.js';

// ==========================================================================
// CARRION CRAWLER — segmented centipede-worm with paralytic face tentacles
// Canvas-painted creature (no GLB — too many legs for Meshy rig)
// Identity: segmented body rearing up, face tentacles, legs underneath,
//           green-brown carapace, pale underbelly, pinkish tentacles
// ==========================================================================

export const carrionCrawlerSkeleton = {
  spine: [{ id: 'center', x: 0.45, y: 0.50, radius: 0.25 }],
  limbs: [],
};

export const CLIP_DURATIONS = { idle: 2.0, attack: 1.2, hit: 0.8, death: 1.5, walk: 1.5 };

// --------------------------------------------------------------------------
// Body plan — BIGGER segments, fills more canvas, reared-up and menacing
// --------------------------------------------------------------------------
const SEGMENTS = [
  { x: 0.18, y: 0.20, rx: 0.14, ry: 0.12, isHead: true  },  // 0: HEAD — massive
  { x: 0.28, y: 0.28, rx: 0.11, ry: 0.10, legs: true     },  // 1: neck (legs now)
  { x: 0.37, y: 0.38, rx: 0.11, ry: 0.10, legs: true     },  // 2
  { x: 0.46, y: 0.47, rx: 0.11, ry: 0.10, legs: true     },  // 3
  { x: 0.55, y: 0.55, rx: 0.11, ry: 0.10, legs: true     },  // 4
  { x: 0.63, y: 0.62, rx: 0.10, ry: 0.09, legs: true     },  // 5
  { x: 0.71, y: 0.68, rx: 0.10, ry: 0.08, legs: true     },  // 6
  { x: 0.78, y: 0.73, rx: 0.09, ry: 0.07, legs: true     },  // 7
  { x: 0.85, y: 0.76, rx: 0.07, ry: 0.06                },  // 8: tail tip
];

// Tentacles extend LEFT — thicker, longer, more menacing
const TENTACLES = [
  { angle: -0.70, len: 0.20, thick: 0.009, wigFreq: 3.5 },
  { angle: -0.40, len: 0.28, thick: 0.012, wigFreq: 2.8 },
  { angle: -0.12, len: 0.34, thick: 0.014, wigFreq: 2.2 },
  { angle:  0.05, len: 0.32, thick: 0.014, wigFreq: 2.5 },
  { angle:  0.25, len: 0.28, thick: 0.012, wigFreq: 3.0 },
  { angle:  0.50, len: 0.24, thick: 0.010, wigFreq: 3.3 },
  { angle:  0.75, len: 0.18, thick: 0.008, wigFreq: 3.8 },
  { angle:  1.00, len: 0.14, thick: 0.007, wigFreq: 4.0 },
];

// --------------------------------------------------------------------------
// Animation helpers
// --------------------------------------------------------------------------
function lerp(a, b, t) { return a + (b - a) * t; }

function computeSegmentAnim(segIndex, anim) {
  const total = SEGMENTS.length;
  const phase = segIndex / (total - 1); // 0=head, 1=tail
  const o = { dx: 0, dy: 0, scaleX: 1, scaleY: 1 };
  if (!anim) return o;
  const { clip, t } = anim;

  switch (clip) {
    case 'idle': {
      // Visible undulating wave — front to back
      const wave = Math.sin(t * Math.PI * 2 - phase * Math.PI * 1.2);
      o.dy = wave * 0.025;
      o.dx = wave * 0.008 * (1 - phase);
      o.scaleX = 1 + wave * 0.02;
      o.scaleY = 1 - wave * 0.015;
      break;
    }
    case 'walk': {
      // Strong caterpillar wave — each segment lifts and compresses
      const wave = Math.sin(t * Math.PI * 4 - phase * Math.PI * 3);
      o.dx = wave * 0.025 * (1 - phase * 0.4);
      o.dy = -Math.abs(wave) * 0.03;  // segments lift UP on wave peaks
      o.scaleX = 1 + wave * 0.025;
      o.scaleY = 1 - wave * 0.018;
      break;
    }
    case 'attack': {
      // Head rears way up + lunges left, body compresses hard
      if (t < 0.25) {
        const p = t / 0.25;
        if (phase < 0.4) {
          o.dy = -p * 0.18 * (1 - phase / 0.4);  // head rises HIGH
          o.dx = -p * 0.06 * (1 - phase / 0.4);
        } else {
          o.dx = p * 0.03 * phase;  // tail pulls back
          o.scaleX = 1 + p * 0.04;
        }
      } else if (t < 0.5) {
        const p = (t - 0.25) / 0.25;
        if (phase < 0.4) {
          o.dy = lerp(-0.18, -0.06, p) * (1 - phase / 0.4);
          o.dx = lerp(-0.06, -0.14, p) * (1 - phase / 0.4);  // LUNGE forward
        } else {
          o.dx = 0.03 * phase * (1 - p * 0.5);
        }
      } else {
        const p = (t - 0.5) / 0.5;
        if (phase < 0.4) {
          o.dy = lerp(-0.06, 0, p) * (1 - phase / 0.4);
          o.dx = lerp(-0.14, 0, p) * (1 - phase / 0.4);
        }
      }
      break;
    }
    case 'hit': {
      // Hard shove right — whole body compresses
      if (t < 0.12) {
        const p = t / 0.12;
        o.dx = p * 0.10;
        o.scaleX = 1 + p * 0.12 * (1 - phase);
        o.scaleY = 1 - p * 0.10 * (1 - phase);
      } else if (t < 0.35) {
        const p = (t - 0.12) / 0.23;
        o.dx = lerp(0.10, -0.02, p);
        o.scaleX = 1 + lerp(0.12, -0.02, p) * (1 - phase);
        o.scaleY = 1 - lerp(0.10, -0.02, p) * (1 - phase);
      } else {
        const p = (t - 0.35) / 0.65;
        o.dx = lerp(-0.02, 0, p);
        o.scaleX = lerp(0.98, 1, p);
        o.scaleY = lerp(1.02, 1, p);
      }
      break;
    }
    case 'death': {
      // Dramatic collapse — head drops, everything flattens
      o.dy = t * 0.25 * (1 - phase * 0.2);
      o.scaleY = 1 - t * 0.6;
      o.scaleX = 1 + t * 0.25;
      break;
    }
  }
  return o;
}

function computeTentacleAnim(anim) {
  if (!anim) return { extension: 0.35, wave: 0 };
  const { clip, t } = anim;
  switch (clip) {
    case 'idle':
      return { extension: 0.45, wave: t * Math.PI * 2 };
    case 'attack':
      if (t < 0.2) return { extension: lerp(0.45, 0.7, t / 0.2), wave: t * Math.PI * 6 };
      if (t < 0.5)  return { extension: lerp(0.7, 1.0, (t - 0.2) / 0.3), wave: t * Math.PI * 10 };
      return { extension: lerp(1.0, 0.45, (t - 0.5) / 0.5), wave: t * Math.PI * 4 };
    case 'hit':
      return { extension: lerp(0.35, 0.12, Math.min(t * 3, 1)), wave: t * Math.PI * 10 };
    case 'death':
      return { extension: lerp(0.35, 0.05, t), wave: t * Math.PI * 0.5 };
    case 'walk':
      return { extension: 0.30, wave: t * Math.PI * 3 };
  }
  return { extension: 0.35, wave: 0 };
}

// ==========================================================================
// CLEAN RENDER
// ==========================================================================
export function drawCarrionCrawlerClean(ctx, skeleton, w, h, anim = null) {
  // --- PALETTE — darker, nastier, more horror ---
  const carapaceDark  = [10, 25, 8];
  const carapaceMid   = [22, 42, 16];
  const carapaceLight = [38, 62, 25];
  const carapaceHi    = [55, 85, 38];
  const bellyPale     = [55, 50, 35];     // sickly yellowish underbelly
  const segBorder     = [5, 14, 3];
  const tentacleBase  = [140, 80, 90];    // darker pinkish — raw flesh
  const tentacleTip   = [190, 120, 130];
  const tentacleGlow  = [220, 140, 155];
  const venomColor    = [120, 200, 80];   // bright toxic green venom
  const mandibleColor = [35, 20, 8];
  const mandibleEdge  = [80, 50, 20];     // chitin edge highlight
  const eyeColor      = [200, 40, 30];    // red compound eyes — menacing
  const eyeGlow       = [180, 30, 20];
  const spineColor    = [20, 15, 5];      // dark dorsal spines
  const legColor      = [18, 14, 6];
  const scarColor     = [60, 25, 15];     // wound/scar marks

  const tentAnim = computeTentacleAnim(anim);

  // --- GROUND SHADOW (larger) ---
  const shadowGrad = ctx.createRadialGradient(
    w * 0.52, h * 0.86, 0, w * 0.52, h * 0.86, w * 0.40
  );
  shadowGrad.addColorStop(0, 'rgba(0,0,0,0.5)');
  shadowGrad.addColorStop(0.6, 'rgba(0,0,0,0.2)');
  shadowGrad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = shadowGrad;
  fillEllipse(ctx, w * 0.52, h * 0.86, w * 0.40, h * 0.06);

  // --- SLIME TRAIL behind body ---
  ctx.fillStyle = `rgba(${venomColor},0.08)`;
  fillEllipse(ctx, w * 0.65, h * 0.82, w * 0.25, h * 0.02);

  // --- BODY SEGMENTS (back to front so head overlaps) ---
  for (let i = SEGMENTS.length - 1; i >= 0; i--) {
    const seg = SEGMENTS[i];
    const sa = computeSegmentAnim(i, anim);
    const cx = (seg.x + sa.dx) * w;
    const cy = (seg.y + sa.dy) * h;
    const rx = seg.rx * sa.scaleX * w;
    const ry = seg.ry * sa.scaleY * h;

    // --- Legs (drawn behind segment) — longer, with hooked claws ---
    if (seg.legs) {
      const legLen = 0.09;
      const legCurl = anim?.clip === 'death' ? anim.t * 0.7 : 0;
      for (const side of [-1, 1]) {
        const lx0 = cx + side * rx * 0.6;
        const ly0 = cy + ry * 0.65;
        const angle = (side === -1 ? Math.PI * 0.65 : Math.PI * 0.35) + legCurl * side * 0.5;
        const kneeX = lx0 + Math.cos(angle) * legLen * w * 0.5;
        const kneeY = ly0 + Math.sin(angle) * legLen * h * 0.4;
        const lx1 = lx0 + Math.cos(angle) * legLen * w;
        const ly1 = ly0 + Math.sin(angle) * legLen * h;

        ctx.strokeStyle = `rgb(${legColor})`;
        ctx.lineWidth = w * 0.007;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(lx0, ly0);
        ctx.quadraticCurveTo(kneeX, kneeY, lx1, ly1);
        ctx.stroke();

        // Hooked claw at foot tip
        const hookAngle = angle + side * 0.4;
        ctx.lineWidth = w * 0.004;
        ctx.beginPath();
        ctx.moveTo(lx1, ly1);
        ctx.lineTo(lx1 + Math.cos(hookAngle) * w * 0.012, ly1 + Math.sin(hookAngle) * h * 0.012);
        ctx.stroke();
      }
    }

    // --- Segment body ---
    const phase = i / (SEGMENTS.length - 1);
    const cR = lerp(carapaceMid[0], carapaceDark[0], phase * 0.5);
    const cG = lerp(carapaceMid[1], carapaceDark[1], phase * 0.5);
    const cB = lerp(carapaceMid[2], carapaceDark[2], phase * 0.5);

    // Main fill — dark radial gradient
    const segGrad = ctx.createRadialGradient(
      cx - rx * 0.2, cy - ry * 0.35, 0,
      cx, cy, Math.max(rx, ry)
    );
    segGrad.addColorStop(0, `rgb(${Math.round(cR * 1.4)},${Math.round(cG * 1.4)},${Math.round(cB * 1.4)})`);
    segGrad.addColorStop(0.4, `rgb(${Math.round(cR)},${Math.round(cG)},${Math.round(cB)})`);
    segGrad.addColorStop(1, `rgb(${Math.round(cR * 0.4)},${Math.round(cG * 0.4)},${Math.round(cB * 0.4)})`);
    ctx.fillStyle = segGrad;
    fillEllipse(ctx, cx, cy, rx, ry);

    // Segment border ridge — hard dark line
    ctx.strokeStyle = `rgb(${segBorder})`;
    ctx.lineWidth = w * 0.005;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx * 0.98, ry * 0.35, 0, Math.PI * 1.05, Math.PI * 1.95);
    ctx.stroke();

    // Underbelly — sickly pale
    ctx.fillStyle = `rgba(${bellyPale},0.30)`;
    fillEllipse(ctx, cx, cy + ry * 0.45, rx * 0.65, ry * 0.30);

    // Carapace plate highlight — upper left rim
    const hiGrad = ctx.createRadialGradient(
      cx - rx * 0.35, cy - ry * 0.35, 0,
      cx - rx * 0.35, cy - ry * 0.35, rx * 0.5
    );
    hiGrad.addColorStop(0, `rgba(${carapaceHi},0.40)`);
    hiGrad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = hiGrad;
    fillEllipse(ctx, cx - rx * 0.25, cy - ry * 0.2, rx * 0.45, ry * 0.35);

    // --- DORSAL SPINES — sharp ridges along the back ---
    if (i > 0 && i < SEGMENTS.length - 1) {
      const spineH = rx * 0.25;
      ctx.fillStyle = `rgb(${spineColor})`;
      // Center spine
      ctx.beginPath();
      ctx.moveTo(cx - w * 0.005, cy - ry * 0.85);
      ctx.lineTo(cx, cy - ry * 0.85 - spineH);
      ctx.lineTo(cx + w * 0.005, cy - ry * 0.85);
      ctx.closePath();
      ctx.fill();
      // Side spines (smaller)
      for (const side of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(cx + side * rx * 0.3 - w * 0.003, cy - ry * 0.75);
        ctx.lineTo(cx + side * rx * 0.3 + side * w * 0.003, cy - ry * 0.75 - spineH * 0.6);
        ctx.lineTo(cx + side * rx * 0.3 + w * 0.003, cy - ry * 0.75);
        ctx.closePath();
        ctx.fill();
      }
    }

    // --- SCAR / WOUND on a couple segments ---
    if (i === 3 || i === 6) {
      ctx.strokeStyle = `rgba(${scarColor},0.6)`;
      ctx.lineWidth = w * 0.004;
      ctx.beginPath();
      ctx.moveTo(cx - rx * 0.3, cy - ry * 0.1);
      ctx.quadraticCurveTo(cx, cy + ry * 0.1, cx + rx * 0.2, cy - ry * 0.2);
      ctx.stroke();
      // Wound glow
      ctx.fillStyle = `rgba(${scarColor},0.15)`;
      fillEllipse(ctx, cx - rx * 0.1, cy, rx * 0.15, ry * 0.1);
    }

    // Overlap shadow between segments
    if (i < SEGMENTS.length - 1) {
      const next = SEGMENTS[i + 1];
      const nsa = computeSegmentAnim(i + 1, anim);
      const nx = (next.x + nsa.dx) * w;
      const ny = (next.y + nsa.dy) * h;
      ambientOcclusion(ctx, (cx + nx) * 0.5, (cy + ny) * 0.5, rx * 0.6, ry * 0.5, 0.30);
    }
  }

  // --- HEAD DETAILS (massive, scary) ---
  const headSeg = SEGMENTS[0];
  const headA = computeSegmentAnim(0, anim);
  const headX = (headSeg.x + headA.dx) * w;
  const headY = (headSeg.y + headA.dy) * h;
  const headRX = headSeg.rx * headA.scaleX * w;
  const headRY = headSeg.ry * headA.scaleY * h;

  // --- MANDIBLES — large, dark, with chitin edge highlight ---
  for (const side of [-1, 1]) {
    const mx = headX - headRX * 0.65;
    const my = headY + side * headRY * 0.25;
    // Mandible body
    ctx.fillStyle = `rgb(${mandibleColor})`;
    ctx.beginPath();
    ctx.moveTo(mx, my);
    ctx.quadraticCurveTo(
      mx - w * 0.05, my + side * h * 0.025,
      mx - w * 0.07, my + side * h * 0.005
    );
    ctx.quadraticCurveTo(
      mx - w * 0.05, my - side * h * 0.01,
      mx, my - side * headRY * 0.15
    );
    ctx.closePath();
    ctx.fill();
    // Chitin edge highlight
    ctx.strokeStyle = `rgba(${mandibleEdge},0.6)`;
    ctx.lineWidth = w * 0.003;
    ctx.beginPath();
    ctx.moveTo(mx, my);
    ctx.quadraticCurveTo(
      mx - w * 0.05, my + side * h * 0.025,
      mx - w * 0.07, my + side * h * 0.005
    );
    ctx.stroke();
    // Fang tip
    ctx.fillStyle = `rgb(${mandibleEdge})`;
    fillCircle(ctx, mx - w * 0.068, my + side * h * 0.005, w * 0.005);
  }

  // Maw — dark gap between mandibles
  ctx.fillStyle = `rgba(5,2,0,0.7)`;
  fillEllipse(ctx, headX - headRX * 0.7, headY, w * 0.02, headRY * 0.3);

  // --- COMPOUND EYES — cluster of red dots, very menacing ---
  for (const side of [-1, 1]) {
    const eyeCX = headX - headRX * 0.35;
    const eyeCY = headY + side * headRY * 0.35;
    // Eye cluster glow
    const eGlow = ctx.createRadialGradient(eyeCX, eyeCY, 0, eyeCX, eyeCY, w * 0.025);
    eGlow.addColorStop(0, `rgba(${eyeGlow},0.6)`);
    eGlow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = eGlow;
    fillCircle(ctx, eyeCX, eyeCY, w * 0.025);
    // Compound eye facets — cluster of 5
    const facets = [
      { dx: 0, dy: 0, r: 0.010 },
      { dx: -0.010, dy: -0.005 * side, r: 0.007 },
      { dx: 0.008, dy: -0.006 * side, r: 0.006 },
      { dx: -0.005, dy: 0.008 * side, r: 0.006 },
      { dx: 0.009, dy: 0.005 * side, r: 0.005 },
    ];
    for (const f of facets) {
      ctx.fillStyle = `rgb(${eyeColor})`;
      fillCircle(ctx, eyeCX + w * f.dx, eyeCY + h * f.dy, w * f.r);
      // Dark pupil slit
      ctx.fillStyle = 'rgb(30,5,0)';
      fillCircle(ctx, eyeCX + w * f.dx - w * 0.002, eyeCY + h * f.dy, w * f.r * 0.35);
    }
  }

  // --- TENTACLES ---
  for (let ti = 0; ti < TENTACLES.length; ti++) {
    const tent = TENTACLES[ti];
    const ext = tentAnim.extension;
    const wavePhase = tentAnim.wave + ti * 1.3;

    const startX = headX - headRX * 0.55;
    const startY = headY + Math.sin(tent.angle) * headRY * 0.45;
    const reach = tent.len * ext * w;
    const endX = startX - Math.cos(tent.angle) * reach;
    const endY = startY + Math.sin(tent.angle) * reach;

    const wigAmp = w * 0.04 * ext;
    const perpX = Math.sin(tent.angle);
    const perpY = -Math.cos(tent.angle);
    const cpX = (startX + endX) * 0.5 + perpX * Math.sin(wavePhase * tent.wigFreq) * wigAmp;
    const cpY = (startY + endY) * 0.5 + perpY * Math.sin(wavePhase * tent.wigFreq) * wigAmp;

    const thick = tent.thick * w * (1 + ext * 0.4);

    // Fleshy gradient — raw pinkish to pale tips
    const tGrad = ctx.createLinearGradient(startX, startY, endX, endY);
    tGrad.addColorStop(0, `rgb(${tentacleBase})`);
    tGrad.addColorStop(0.6, `rgb(${tentacleTip})`);
    tGrad.addColorStop(1, `rgb(${tentacleGlow})`);

    ctx.strokeStyle = tGrad;
    ctx.lineWidth = thick;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.quadraticCurveTo(cpX, cpY, endX, endY);
    ctx.stroke();

    // Bright venom sheen center line
    ctx.strokeStyle = `rgba(${venomColor},0.35)`;
    ctx.lineWidth = thick * 0.35;
    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.quadraticCurveTo(cpX, cpY, endX, endY);
    ctx.stroke();

    // Tip — venom droplet
    if (ext > 0.25) {
      const glowR = thick * 1.8;
      const glow = ctx.createRadialGradient(endX, endY, 0, endX, endY, glowR);
      glow.addColorStop(0, `rgba(${venomColor},${ext * 0.4})`);
      glow.addColorStop(0.5, `rgba(${tentacleGlow},${ext * 0.2})`);
      glow.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = glow;
      fillCircle(ctx, endX, endY, glowR);
    }
  }

  // --- VENOM DRIPS from maw ---
  ctx.fillStyle = `rgba(${venomColor},0.4)`;
  fillEllipse(ctx, headX - headRX * 0.85, headY + h * 0.02, w * 0.008, h * 0.015);
  fillEllipse(ctx, headX - headRX * 0.9, headY - h * 0.01, w * 0.006, h * 0.012);
  // Drip streak
  ctx.strokeStyle = `rgba(${venomColor},0.25)`;
  ctx.lineWidth = w * 0.003;
  ctx.beginPath();
  ctx.moveTo(headX - headRX * 0.85, headY + h * 0.035);
  ctx.lineTo(headX - headRX * 0.83, headY + h * 0.08);
  ctx.stroke();

  // --- CARAPACE PLATE TEXTURE ---
  ctx.globalAlpha = 0.10;
  ctx.strokeStyle = `rgb(${carapaceLight})`;
  ctx.lineWidth = w * 0.003;
  for (let i = 1; i < 8; i++) {
    const seg = SEGMENTS[i];
    const sa = computeSegmentAnim(i, anim);
    const sx = (seg.x + sa.dx) * w;
    const sy = (seg.y + sa.dy) * h;
    const srx = seg.rx * sa.scaleX * w;
    const sry = seg.ry * sa.scaleY * h;
    // Curved plate lines
    for (let r = -1; r <= 1; r++) {
      ctx.beginPath();
      ctx.moveTo(sx - srx * 0.65, sy + sry * r * 0.3);
      ctx.quadraticCurveTo(sx, sy + sry * r * 0.25 - sry * 0.05, sx + srx * 0.65, sy + sry * r * 0.3);
      ctx.stroke();
    }
  }
  ctx.globalAlpha = 1.0;

  // --- GROUND CONTACT ---
  for (let i = 4; i < SEGMENTS.length; i++) {
    const seg = SEGMENTS[i];
    const sa = computeSegmentAnim(i, anim);
    ambientOcclusion(ctx, (seg.x + sa.dx) * w, (seg.y + sa.dy) * h + seg.ry * h, seg.rx * w * 0.7, h * 0.02, 0.35);
  }
}

// ==========================================================================
// Harness
// ==========================================================================
const GRID_W = 8;
const GRID_H = 7;

export default { draw: drawCarrionCrawlerClean, skeleton: carrionCrawlerSkeleton, gridW: GRID_W, gridH: GRID_H };

if (typeof document !== 'undefined' && document.getElementById('canvas-size')) {
function render(elapsed = 0) {
  const size = parseInt(document.getElementById('canvas-size').value);
  const cellSize = parseInt(document.getElementById('cell-size').value);
  const showGrid = document.getElementById('show-grid').checked;
  const sk = carrionCrawlerSkeleton;

  const canvasW = size;
  const canvasH = Math.round(size * GRID_H / GRID_W);
  const maxDisplay = 420;
  const displayW = `${Math.min(canvasW, maxDisplay)}px`;
  const displayH = `${Math.min(canvasH, Math.round(maxDisplay * GRID_H / GRID_W))}px`;

  const asciiOpts = { elapsed, cellSize, level: 9, gridWidth: GRID_W, gridHeight: GRID_H };

  const c1 = document.getElementById('canvas-size');
  c1.width = canvasW; c1.height = canvasH;
  c1.style.width = displayW; c1.style.height = displayH;
  const ctx1 = c1.getContext('2d');
  ctx1.fillStyle = '#000'; ctx1.fillRect(0, 0, canvasW, canvasH);
  ctx1.fillStyle = 'rgb(10,30,15)';
  ctx1.font = '11px monospace';
  ctx1.fillText('No skeleton — segmented', canvasW * 0.25, canvasH * 0.52);

  const c2 = document.getElementById('next-ascii');
  c2.width = canvasW; c2.height = canvasH;
  c2.style.width = displayW; c2.style.height = displayH;
  const ctx2 = c2.getContext('2d');
  ctx2.fillStyle = '#000'; ctx2.fillRect(0, 0, canvasW, canvasH);
  const animState = elapsed > 0 ? { clip: 'idle', t: (elapsed % 2000) / 2000 } : null;
  renderAscii(ctx2, (tctx, tw, th) => {
    drawCarrionCrawlerClean(tctx, sk, tw, th, animState);
  }, 0, 0, canvasW, canvasH, asciiOpts);

  const c3 = document.getElementById('next-raw');
  c3.width = canvasW; c3.height = canvasH;
  c3.style.width = displayW; c3.style.height = displayH;
  const ctx3 = c3.getContext('2d');
  ctx3.fillStyle = '#000'; ctx3.fillRect(0, 0, canvasW, canvasH);
  drawCarrionCrawlerClean(ctx3, sk, canvasW, canvasH, animState);

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
