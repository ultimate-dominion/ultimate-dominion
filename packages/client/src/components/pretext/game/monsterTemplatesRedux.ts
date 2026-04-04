import type { MonsterTemplate } from './monsterTemplates';
import { makeGLBDrawFn } from './glbCreatureLoader';

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

function bodyGrad(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, r: number,
  coreR: number, coreG: number, coreB: number,
  edgeR: number, edgeG: number, edgeB: number,
): CanvasGradient {
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
  g.addColorStop(0, `rgb(${coreR},${coreG},${coreB})`);
  g.addColorStop(0.45, `rgb(${Math.floor(coreR * 0.88)},${Math.floor(coreG * 0.88)},${Math.floor(coreB * 0.88)})`);
  g.addColorStop(1, `rgb(${edgeR},${edgeG},${edgeB})`);
  return g;
}

function highlight(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, r: number,
  color: string, alpha = 0.2,
) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  fillCircle(ctx, x, y, r);
  ctx.restore();
}

function ambientOcclusion(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, rx: number, ry: number, alpha = 0.2,
) {
  ctx.fillStyle = `rgba(0,0,0,${alpha})`;
  fillEllipse(ctx, x, y, rx, ry);
}

function furTexture(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
  count: number,
  dark: string, light: string,
  angle = 0,
) {
  ctx.lineCap = 'round';
  for (let i = 0; i < count; i++) {
    const px = x + Math.random() * w;
    const py = y + Math.random() * h;
    const len = w * (0.012 + Math.random() * 0.018);
    const a = angle + (Math.random() - 0.5) * 0.8;
    ctx.strokeStyle = Math.random() < 0.25 ? light : dark;
    ctx.lineWidth = Math.max(1, w * 0.003);
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.quadraticCurveTo(
      px + Math.cos(a) * len * 0.3,
      py + Math.sin(a) * len * 0.3,
      px + Math.cos(a) * len,
      py + Math.sin(a) * len,
    );
    ctx.stroke();
  }
}

function scaleTexture(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
  size: number,
  dark: string, light: string,
  density = 0.8,
) {
  const cols = Math.ceil(w / size);
  const rows = Math.ceil(h / (size * 0.7));
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      if (Math.random() > density) continue;
      const ox = row % 2 === 0 ? 0 : size * 0.5;
      const px = x + col * size + ox;
      const py = y + row * size * 0.7;
      ctx.strokeStyle = dark;
      ctx.lineWidth = Math.max(1, size * 0.12);
      ctx.beginPath();
      ctx.arc(px, py, size * 0.42, 0.3, Math.PI - 0.3);
      ctx.stroke();
      ctx.strokeStyle = light;
      ctx.lineWidth = Math.max(1, size * 0.06);
      ctx.beginPath();
      ctx.arc(px, py - size * 0.08, size * 0.28, 0.45, Math.PI - 0.45);
      ctx.stroke();
    }
  }
}

function stoneTexture(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
  count: number,
  dark: string, light: string,
) {
  for (let i = 0; i < count; i++) {
    const sx = x + Math.random() * w;
    const sy = y + Math.random() * h;
    ctx.strokeStyle = dark;
    ctx.lineWidth = Math.max(1, w * 0.008 * Math.random());
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(sx + (Math.random() - 0.5) * w * 0.22, sy + (Math.random() - 0.5) * h * 0.16);
    ctx.lineTo(sx + (Math.random() - 0.5) * w * 0.28, sy + (Math.random() - 0.5) * h * 0.28);
    ctx.stroke();
    ctx.strokeStyle = light;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(sx - 1, sy - 1);
    ctx.lineTo(sx + (Math.random() - 0.5) * w * 0.22, sy + (Math.random() - 0.5) * h * 0.16);
    ctx.stroke();
  }
}

function drawLimb(
  ctx: CanvasRenderingContext2D,
  x0: number, y0: number,
  cx: number, cy: number,
  x1: number, y1: number,
  thickness: number,
  color: string,
) {
  ctx.fillStyle = color;
  for (let i = 0; i <= 10; i++) {
    const t = i / 10;
    const mt = 1 - t;
    const px = mt * mt * x0 + 2 * mt * t * cx + t * t * x1;
    const py = mt * mt * y0 + 2 * mt * t * cy + t * t * y1;
    const r = thickness * (1.5 - t * 0.45);
    fillCircle(ctx, px, py, r);
  }
}

// -- Skeleton infrastructure for dire rat (clean shapes approach) -----------
// Circle-chain spine → tangent-hull body outline with Catmull-Rom smoothing

interface SpineNode { id: string; x: number; y: number; radius: number }
interface LimbSegment { x: number; y: number; radius: number }
interface LimbDef { attach: string; side: 'near' | 'far'; segments: LimbSegment[] }
interface TailDef { points: { x: number; y: number }[]; startWidth: number; endWidth: number }
interface Skeleton { spine: SpineNode[]; limbs: LimbDef[]; tail: TailDef }

function catmullToBezierCP(
  p0: { x: number; y: number }, p1: { x: number; y: number },
  p2: { x: number; y: number }, p3: { x: number; y: number },
  tension = 0.35,
) {
  const t = tension;
  return {
    cp1x: p1.x + (p2.x - p0.x) * t / 3,
    cp1y: p1.y + (p2.y - p0.y) * t / 3,
    cp2x: p2.x - (p3.x - p1.x) * t / 3,
    cp2y: p2.y - (p3.y - p1.y) * t / 3,
  };
}

function drawSkeletonBodyOutline(
  ctx: CanvasRenderingContext2D, spine: SpineNode[],
  w: number, h: number, fill: string | CanvasGradient,
) {
  const n = spine.length;
  const top: { x: number; y: number }[] = [];
  const bot: { x: number; y: number }[] = [];
  for (let i = 0; i < n; i++) {
    const node = spine[i];
    const cx = w * node.x, cy = h * node.y, r = w * node.radius;
    let dx: number, dy: number;
    if (i === 0) { dx = spine[1].x - node.x; dy = spine[1].y - node.y; }
    else if (i === n - 1) { dx = node.x - spine[n - 2].x; dy = node.y - spine[n - 2].y; }
    else { dx = spine[i + 1].x - spine[i - 1].x; dy = spine[i + 1].y - spine[i - 1].y; }
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    const px = -dy / len, py = dx / len;
    top.push({ x: cx + px * r, y: cy + py * r });
    bot.push({ x: cx - px * r, y: cy - py * r });
  }
  const first = spine[0], last = spine[n - 1];
  ctx.beginPath();
  ctx.moveTo(top[0].x, top[0].y);
  for (let i = 0; i < top.length - 1; i++) {
    const p0 = top[Math.max(0, i - 1)], p1 = top[i];
    const p2 = top[i + 1], p3 = top[Math.min(top.length - 1, i + 2)];
    const cp = catmullToBezierCP(p0, p1, p2, p3);
    ctx.bezierCurveTo(cp.cp1x, cp.cp1y, cp.cp2x, cp.cp2y, p2.x, p2.y);
  }
  const lastCx = w * last.x, lastCy = h * last.y, lastR = w * last.radius;
  const lastTopA = Math.atan2(top[top.length - 1].y - lastCy, top[top.length - 1].x - lastCx);
  const lastBotA = Math.atan2(bot[bot.length - 1].y - lastCy, bot[bot.length - 1].x - lastCx);
  ctx.arc(lastCx, lastCy, lastR, lastTopA, lastBotA, false);
  for (let i = bot.length - 1; i > 0; i--) {
    const p0 = bot[Math.min(bot.length - 1, i + 1)], p1 = bot[i];
    const p2 = bot[i - 1], p3 = bot[Math.max(0, i - 2)];
    const cp = catmullToBezierCP(p0, p1, p2, p3);
    ctx.bezierCurveTo(cp.cp1x, cp.cp1y, cp.cp2x, cp.cp2y, p2.x, p2.y);
  }
  const firstCx = w * first.x, firstCy = h * first.y, firstR = w * first.radius;
  const firstBotA = Math.atan2(bot[0].y - firstCy, bot[0].x - firstCx);
  const firstTopA = Math.atan2(top[0].y - firstCy, top[0].x - firstCx);
  ctx.arc(firstCx, firstCy, firstR, firstBotA, firstTopA, false);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
}

function drawSkeletonLimbChain(
  ctx: CanvasRenderingContext2D, segments: LimbSegment[],
  w: number, h: number, color: string,
) {
  if (segments.length < 2) return;
  for (let i = 0; i < segments.length - 1; i++) {
    const s0 = segments[i], s1 = segments[i + 1];
    const x0 = w * s0.x, y0 = h * s0.y, r0 = w * s0.radius;
    const x1 = w * s1.x, y1 = h * s1.y, r1 = w * s1.radius;
    const dx = x1 - x0, dy = y1 - y0;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    const px = -dy / len, py = dx / len;
    ctx.beginPath();
    ctx.moveTo(x0 + px * r0, y0 + py * r0);
    ctx.lineTo(x1 + px * r1, y1 + py * r1);
    ctx.lineTo(x1 - px * r1, y1 - py * r1);
    ctx.lineTo(x0 - px * r0, y0 - py * r0);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
    ctx.beginPath(); ctx.arc(x0, y0, r0, 0, Math.PI * 2); ctx.fill();
  }
  const last = segments[segments.length - 1];
  ctx.beginPath(); ctx.arc(w * last.x, h * last.y, w * last.radius, 0, Math.PI * 2); ctx.fill();
}

function bodyGrad3(
  ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number,
  midR: number, midG: number, midB: number,
  shadowR: number, shadowG: number, shadowB: number,
  hiR: number, hiG: number, hiB: number,
): CanvasGradient {
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
  g.addColorStop(0, `rgb(${hiR},${hiG},${hiB})`);
  g.addColorStop(0.25, `rgb(${midR},${midG},${midB})`);
  g.addColorStop(0.50, `rgb(${Math.floor(midR * 0.85 + shadowR * 0.15)},${Math.floor(midG * 0.85 + shadowG * 0.15)},${Math.floor(midB * 0.85 + shadowB * 0.15)})`);
  g.addColorStop(0.75, `rgb(${Math.floor(midR * 0.5 + shadowR * 0.5)},${Math.floor(midG * 0.5 + shadowG * 0.5)},${Math.floor(midB * 0.5 + shadowB * 0.5)})`);
  g.addColorStop(1, `rgb(${shadowR},${shadowG},${shadowB})`);
  return g;
}

function rgb(parts: number[]) {
  return `rgb(${parts.join(',')})`;
}

function rgba(parts: number[], alpha: number) {
  return `rgba(${parts.join(',')},${alpha})`;
}

const DIRE_RAT_SKELETON: Skeleton = {
  spine: [
    { id: 'snout',   x: 0.10, y: 0.84, radius: 0.025 },
    { id: 'head',    x: 0.16, y: 0.78, radius: 0.065 },
    { id: 'neck',    x: 0.26, y: 0.72, radius: 0.074 },
    { id: 'chest',   x: 0.38, y: 0.64, radius: 0.120 },
    { id: 'belly',   x: 0.52, y: 0.60, radius: 0.140 },
    { id: 'hip',     x: 0.64, y: 0.64, radius: 0.125 },
    { id: 'rump',    x: 0.72, y: 0.70, radius: 0.058 },
  ],
  limbs: [
    { attach: 'chest', side: 'near', segments: [
      { x: 0.26, y: 0.78, radius: 0.040 },
      { x: 0.20, y: 0.86, radius: 0.018 },
      { x: 0.16, y: 0.92, radius: 0.012 },
      { x: 0.14, y: 0.97, radius: 0.018 },
    ]},
    { attach: 'chest', side: 'far', segments: [
      { x: 0.34, y: 0.76, radius: 0.032 },
      { x: 0.28, y: 0.84, radius: 0.014 },
      { x: 0.24, y: 0.92, radius: 0.010 },
      { x: 0.23, y: 0.97, radius: 0.014 },
    ]},
    { attach: 'hip', side: 'near', segments: [
      { x: 0.58, y: 0.64, radius: 0.100 },
      { x: 0.60, y: 0.76, radius: 0.026 },
      { x: 0.65, y: 0.86, radius: 0.013 },
      { x: 0.59, y: 0.92, radius: 0.010 },
      { x: 0.55, y: 0.97, radius: 0.016 },
    ]},
    { attach: 'hip', side: 'far', segments: [
      { x: 0.66, y: 0.64, radius: 0.085 },
      { x: 0.68, y: 0.76, radius: 0.020 },
      { x: 0.72, y: 0.86, radius: 0.011 },
      { x: 0.68, y: 0.92, radius: 0.008 },
      { x: 0.66, y: 0.97, radius: 0.013 },
    ]},
  ],
  tail: {
    points: [
      { x: 0.74, y: 0.72 }, { x: 0.82, y: 0.64 }, { x: 0.90, y: 0.58 },
      { x: 0.94, y: 0.50 }, { x: 0.93, y: 0.42 }, { x: 0.88, y: 0.38 },
    ],
    startWidth: 0.018, endWidth: 0.003,
  },
};

// -- Kobold skeleton: extreme crouch, 3/4 view, spear lunge, digitigrade legs --
// Reference: D&D 2e Monster Manual kobold — spring-loaded reptilian, about to strike
// Body nearly horizontal, landscape aspect (7:5), S-curve tail counterbalance
const KOBOLD_SKELETON: Skeleton = {
  spine: [
    { id: 'snout',  x: 0.08, y: 0.42, radius: 0.012 },
    { id: 'head',   x: 0.17, y: 0.36, radius: 0.042 },
    { id: 'neck',   x: 0.27, y: 0.32, radius: 0.028 },
    { id: 'chest',  x: 0.38, y: 0.34, radius: 0.055 },
    { id: 'belly',  x: 0.50, y: 0.38, radius: 0.048 },
    { id: 'hip',    x: 0.60, y: 0.36, radius: 0.042 },
  ],
  limbs: [
    // Near arm — spear arm, reaching FAR forward and down
    { attach: 'chest', side: 'near', segments: [
      { x: 0.32, y: 0.38, radius: 0.022 },
      { x: 0.22, y: 0.48, radius: 0.012 },
      { x: 0.14, y: 0.46, radius: 0.008 },
      { x: 0.08, y: 0.48, radius: 0.012 },
    ]},
    // Far arm — tucked back, claws spread for balance
    { attach: 'chest', side: 'far', segments: [
      { x: 0.42, y: 0.38, radius: 0.018 },
      { x: 0.38, y: 0.50, radius: 0.010 },
      { x: 0.34, y: 0.54, radius: 0.007 },
      { x: 0.30, y: 0.56, radius: 0.010 },
    ]},
    // Near leg — FORWARD stride, 5-segment digitigrade zigzag
    { attach: 'hip', side: 'near', segments: [
      { x: 0.52, y: 0.42, radius: 0.028 },
      { x: 0.44, y: 0.56, radius: 0.016 },
      { x: 0.50, y: 0.68, radius: 0.010 },  // ankle — BACK (digitigrade!)
      { x: 0.42, y: 0.76, radius: 0.008 },
      { x: 0.38, y: 0.84, radius: 0.014 },
    ]},
    // Far leg — BACK stride, coiled, ready to push off
    { attach: 'hip', side: 'far', segments: [
      { x: 0.62, y: 0.42, radius: 0.024 },
      { x: 0.66, y: 0.54, radius: 0.013 },
      { x: 0.62, y: 0.66, radius: 0.009 },  // ankle — digitigrade back-bend
      { x: 0.66, y: 0.74, radius: 0.007 },
      { x: 0.68, y: 0.82, radius: 0.012 },
    ]},
  ],
  tail: {
    // S-curve tail — sweeps up, dips, then curls back up at tip
    points: [
      { x: 0.64, y: 0.38 }, { x: 0.72, y: 0.28 }, { x: 0.80, y: 0.24 },
      { x: 0.87, y: 0.30 }, { x: 0.92, y: 0.22 }, { x: 0.96, y: 0.14 },
    ],
    startWidth: 0.014, endWidth: 0.003,
  },
};

function drawDireRatRedux(ctx: CanvasRenderingContext2D, w: number, h: number) {
  // Skeleton-based clean renderer — bold shapes, no noise, let ASCII add texture
  const sk = DIRE_RAT_SKELETON;
  const snout = sk.spine.find(n => n.id === 'snout')!;
  const head = sk.spine.find(n => n.id === 'head')!;
  const belly = sk.spine.find(n => n.id === 'belly')!;

  // 1. Tail — single thick stroke
  const tp = sk.tail.points;
  ctx.strokeStyle = 'rgb(110,70,65)';
  ctx.lineCap = 'round'; ctx.lineWidth = w * 0.020;
  ctx.beginPath();
  ctx.moveTo(w * tp[0].x, h * tp[0].y);
  ctx.bezierCurveTo(w * tp[1].x, h * tp[1].y, w * tp[2].x, h * tp[2].y, w * tp[3].x, h * tp[3].y);
  ctx.stroke();
  ctx.lineWidth = w * 0.010;
  ctx.beginPath();
  ctx.moveTo(w * tp[3].x, h * tp[3].y);
  ctx.bezierCurveTo(w * tp[4].x, h * tp[4].y, w * tp[5].x, h * tp[5].y, w * (tp[5].x - 0.04), h * (tp[5].y + 0.04));
  ctx.stroke();

  // 2. Far limbs — solid dark
  for (const limb of sk.limbs) {
    if (limb.side === 'far') drawSkeletonLimbChain(ctx, limb.segments, w, h, 'rgb(24,16,12)');
  }

  // 3. Body — ONE gradient, clean
  const bodyFill = bodyGrad3(ctx, w * belly.x, h * belly.y, w * 0.30,
    90, 68, 50, 30, 22, 16, 130, 105, 80);
  drawSkeletonBodyOutline(ctx, sk.spine, w, h, bodyFill);

  // 4. Near limbs — slightly lighter
  for (const limb of sk.limbs) {
    if (limb.side === 'near') drawSkeletonLimbChain(ctx, limb.segments, w, h, 'rgb(42,30,22)');
  }

  // 5. Paw pads
  for (const limb of sk.limbs) {
    const paw = limb.segments[limb.segments.length - 1];
    ctx.fillStyle = limb.side === 'near' ? 'rgb(60,40,35)' : 'rgb(35,24,18)';
    fillEllipse(ctx, w * paw.x, h * paw.y, w * (paw.radius + 0.005), h * 0.012);
  }

  // 6. Head shape
  const hx = head.x, hy = head.y, hr = head.radius;
  const sx = snout.x, sy = snout.y;
  ctx.fillStyle = bodyGrad3(ctx, w * hx, h * hy, w * hr * 2,
    82, 62, 46, 28, 20, 14, 120, 95, 72);
  ctx.beginPath();
  ctx.moveTo(w * (hx + hr * 0.7), h * (hy - hr * 0.8));
  ctx.bezierCurveTo(w * (hx - 0.01), h * (hy - hr * 1.1), w * (sx + 0.01), h * (sy - 0.06), w * (sx - 0.03), h * sy);
  ctx.bezierCurveTo(w * (sx - 0.05), h * (sy + 0.06), w * (sx - 0.02), h * (sy + 0.12), w * (hx - 0.01), h * (hy + hr * 1.0));
  ctx.bezierCurveTo(w * (hx + hr * 0.5), h * (hy + hr * 0.6), w * (hx + hr * 0.9), h * (hy + hr * 0.1), w * (hx + hr * 0.7), h * (hy - hr * 0.8));
  ctx.fill();

  // 7. Snout nub
  ctx.fillStyle = 'rgb(55,35,30)';
  ctx.beginPath(); ctx.arc(w * (sx - 0.03), h * (sy + 0.01), w * 0.022, 0, Math.PI * 2); ctx.fill();

  // 8. Nose
  ctx.fillStyle = 'rgb(150,80,75)';
  fillCircle(ctx, w * (sx - 0.045), h * (sy + 0.005), w * 0.008);

  // 9. Mouth slit
  ctx.strokeStyle = 'rgb(10,5,5)'; ctx.lineWidth = w * 0.004;
  ctx.beginPath();
  ctx.moveTo(w * (sx - 0.04), h * (sy + 0.03));
  ctx.quadraticCurveTo(w * (sx - 0.01), h * (sy + 0.06), w * (sx + 0.02), h * (sy + 0.05));
  ctx.stroke();

  // 10. Big fangs
  ctx.fillStyle = 'rgb(235,225,205)';
  ctx.beginPath();
  ctx.moveTo(w * (sx - 0.03), h * (sy + 0.02));
  ctx.lineTo(w * (sx - 0.04), h * (sy + 0.12));
  ctx.lineTo(w * (sx - 0.018), h * (sy + 0.03));
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(w * (sx - 0.005), h * (sy + 0.03));
  ctx.lineTo(w * (sx - 0.015), h * (sy + 0.12));
  ctx.lineTo(w * (sx + 0.008), h * (sy + 0.045));
  ctx.fill();
  ctx.fillStyle = 'rgb(210,200,180)';
  ctx.beginPath();
  ctx.moveTo(w * (sx - 0.018), h * (sy + 0.03));
  ctx.lineTo(w * (sx - 0.022), h * (sy + 0.08));
  ctx.lineTo(w * (sx - 0.012), h * (sy + 0.035));
  ctx.fill();

  // 11. Eyes
  ctx.fillStyle = 'rgb(200,50,30)';
  fillCircle(ctx, w * (hx - 0.01), h * (hy - 0.01), w * 0.012);
  ctx.fillStyle = 'rgb(255,120,40)';
  fillCircle(ctx, w * (hx - 0.01), h * (hy - 0.01), w * 0.007);
  ctx.fillStyle = '#000';
  fillCircle(ctx, w * (hx - 0.009), h * (hy - 0.01), w * 0.003);
  ctx.fillStyle = 'rgb(160,40,25)';
  fillCircle(ctx, w * (sx + 0.005), h * (sy - 0.05), w * 0.008);

  // 12. Ears
  ctx.fillStyle = 'rgb(50,36,28)';
  fillEllipse(ctx, w * (hx + 0.06), h * (hy - hr * 0.9), w * 0.020, h * 0.030);
  ctx.fillStyle = 'rgb(38,26,20)';
  fillEllipse(ctx, w * (hx - 0.01), h * (hy - hr * 0.8), w * 0.016, h * 0.024);
  ctx.fillStyle = 'rgba(140,60,70,0.5)';
  fillEllipse(ctx, w * (hx + 0.06), h * (hy - hr * 0.9), w * 0.012, h * 0.018);

  // 13. Hackle spikes along spine
  const sp = sk.spine;
  for (let i = 0; i < 14; i++) {
    const t = i / 14;
    const si = 2 + t * (sp.length - 3);
    const idx = Math.floor(si);
    const f = si - idx;
    const a = sp[Math.min(idx, sp.length - 1)];
    const b = sp[Math.min(idx + 1, sp.length - 1)];
    const px = w * (a.x + (b.x - a.x) * f);
    const py = h * (a.y + (b.y - a.y) * f - (a.radius + (b.radius - a.radius) * f));
    const sizeMult = 1.0 - Math.abs(t - 0.4) * 1.2;
    const len = w * (0.030 + sizeMult * 0.025);
    const baseW = w * 0.006;
    const lean = -0.15;
    ctx.fillStyle = 'rgb(50,36,26)';
    ctx.beginPath();
    ctx.moveTo(px - baseW, py);
    ctx.lineTo(px + Math.sin(lean) * len, py - Math.cos(lean) * len);
    ctx.lineTo(px + baseW, py);
    ctx.fill();
    ctx.fillStyle = 'rgb(140,110,80)';
    ctx.beginPath();
    const tipX = px + Math.sin(lean) * len;
    const tipY = py - Math.cos(lean) * len;
    ctx.moveTo(tipX - w * 0.002, tipY + len * 0.3);
    ctx.lineTo(tipX, tipY);
    ctx.lineTo(tipX + w * 0.002, tipY + len * 0.3);
    ctx.fill();
  }
}

function drawKoboldRedux(ctx: CanvasRenderingContext2D, w: number, h: number) {
  // Extreme crouch kobold — nearly horizontal, lunging with spear, S-curve tail
  // HIGH CONTRAST: dark olive-brown scales, bright orange vest, glowing yellow eyes
  const sk = KOBOLD_SKELETON;
  const snout = sk.spine.find(n => n.id === 'snout')!;
  const head = sk.spine.find(n => n.id === 'head')!;
  const neck = sk.spine.find(n => n.id === 'neck')!;
  const chest = sk.spine.find(n => n.id === 'chest')!;
  const belly = sk.spine.find(n => n.id === 'belly')!;
  const hip = sk.spine.find(n => n.id === 'hip')!;

  // PALETTE
  const scaleDark = [52, 42, 32];
  const scaleMid = [78, 64, 48];
  const scaleLight = [108, 90, 66];
  const scaleShadow = [26, 20, 14];
  const vestDark = [148, 58, 18];
  const vestMid = [190, 95, 35];
  const vestLight = [222, 138, 52];
  const eyeGlow = [255, 210, 40];
  const eyeCore = [255, 248, 150];
  const teethColor = [215, 205, 185];
  const spearWood = [108, 80, 48];
  const spearTip = [185, 178, 162];
  const hornColor = [72, 58, 42];

  // 1. TAIL — S-curve, sweeps up then dips then curls back
  const tp = sk.tail.points;
  ctx.lineCap = 'round';
  // Thick base segment (points 0-3)
  ctx.strokeStyle = `rgb(${scaleDark.join(',')})`;
  ctx.lineWidth = w * 0.018;
  ctx.beginPath();
  ctx.moveTo(w * tp[0].x, h * tp[0].y);
  ctx.bezierCurveTo(w * tp[1].x, h * tp[1].y, w * tp[2].x, h * tp[2].y, w * tp[3].x, h * tp[3].y);
  ctx.stroke();
  // Mid segment (points 3-5) — tapers
  ctx.strokeStyle = `rgb(${scaleMid.join(',')})`;
  ctx.lineWidth = w * 0.010;
  ctx.beginPath();
  ctx.moveTo(w * tp[3].x, h * tp[3].y);
  ctx.bezierCurveTo(w * tp[4].x, h * tp[4].y, w * tp[5].x, h * (tp[5].y + 0.02), w * (tp[5].x + 0.01), h * (tp[5].y - 0.02));
  ctx.stroke();
  // Tail tip whip
  ctx.strokeStyle = `rgb(${scaleLight.join(',')})`;
  ctx.lineWidth = w * 0.004;
  ctx.beginPath();
  ctx.moveTo(w * (tp[5].x + 0.01), h * (tp[5].y - 0.02));
  ctx.lineTo(w * (tp[5].x + 0.03), h * (tp[5].y - 0.05));
  ctx.stroke();
  // Underside highlight along the S-curve
  ctx.strokeStyle = `rgba(${scaleLight.join(',')},0.20)`;
  ctx.lineWidth = w * 0.003;
  ctx.beginPath();
  ctx.moveTo(w * tp[0].x, h * (tp[0].y + 0.012));
  ctx.bezierCurveTo(w * tp[1].x, h * (tp[1].y + 0.010), w * tp[2].x, h * (tp[2].y + 0.008), w * tp[3].x, h * (tp[3].y + 0.008));
  ctx.bezierCurveTo(w * tp[4].x, h * (tp[4].y + 0.006), w * tp[5].x, h * (tp[5].y + 0.004), w * (tp[5].x + 0.01), h * (tp[5].y - 0.01));
  ctx.stroke();

  // 2. FAR LIMBS — dark, behind body
  for (const limb of sk.limbs) {
    if (limb.side === 'far') drawSkeletonLimbChain(ctx, limb.segments, w, h, `rgb(${scaleShadow.join(',')})`);
  }

  // 3. SPEAR — thick shaft, longer reach, lunging forward
  const handX = 0.08, handY = 0.48;
  ctx.strokeStyle = `rgb(${spearWood.join(',')})`;
  ctx.lineCap = 'round';
  ctx.lineWidth = w * 0.016;
  ctx.beginPath();
  ctx.moveTo(w * 0.48, h * 0.60); // butt end — behind body
  ctx.lineTo(w * handX, h * handY); // through hand
  ctx.stroke();
  ctx.lineWidth = w * 0.013;
  ctx.beginPath();
  ctx.moveTo(w * handX, h * handY);
  ctx.lineTo(w * -0.10, h * 0.36); // extends past hand to tip
  ctx.stroke();
  // Shaft wood grain highlight
  ctx.strokeStyle = 'rgba(140,110,70,0.30)';
  ctx.lineWidth = w * 0.004;
  ctx.beginPath();
  ctx.moveTo(w * 0.40, h * 0.57);
  ctx.lineTo(w * -0.06, h * 0.38);
  ctx.stroke();
  // Spear tip — larger leaf-shaped head
  ctx.fillStyle = `rgb(${spearTip.join(',')})`;
  ctx.beginPath();
  ctx.moveTo(w * -0.10, h * 0.36);
  ctx.bezierCurveTo(w * -0.12, h * 0.30, w * -0.14, h * 0.24, w * -0.13, h * 0.18);
  ctx.bezierCurveTo(w * -0.10, h * 0.24, w * -0.07, h * 0.30, w * -0.10, h * 0.36);
  ctx.fill();
  // Tip edge highlight
  ctx.strokeStyle = 'rgba(230,225,210,0.50)';
  ctx.lineWidth = w * 0.004;
  ctx.beginPath();
  ctx.moveTo(w * -0.12, h * 0.30);
  ctx.lineTo(w * -0.13, h * 0.18);
  ctx.stroke();
  // Binding wrap where tip meets shaft
  ctx.strokeStyle = `rgb(${vestDark.join(',')})`;
  ctx.lineWidth = w * 0.006;
  ctx.beginPath();
  ctx.moveTo(w * -0.09, h * 0.37);
  ctx.lineTo(w * -0.11, h * 0.35);
  ctx.stroke();

  // 4. BODY — skeleton outline with gradient
  const bodyFill = bodyGrad3(ctx, w * belly.x, h * belly.y, w * 0.22,
    scaleMid[0], scaleMid[1], scaleMid[2],
    scaleShadow[0], scaleShadow[1], scaleShadow[2],
    scaleLight[0], scaleLight[1], scaleLight[2]);
  drawSkeletonBodyOutline(ctx, sk.spine, w, h, bodyFill);

  // 5. VEST — crude orange cloth over chest/belly
  ctx.fillStyle = bodyGrad3(ctx, w * chest.x, h * (chest.y - 0.02), w * 0.14,
    vestMid[0], vestMid[1], vestMid[2],
    vestDark[0], vestDark[1], vestDark[2],
    vestLight[0], vestLight[1], vestLight[2]);
  ctx.beginPath();
  // Vest follows the horizontal body — wider than tall
  ctx.moveTo(w * (neck.x + 0.02), h * (neck.y - 0.03));
  ctx.bezierCurveTo(w * (neck.x - 0.02), h * (neck.y + 0.02), w * (chest.x - 0.06), h * (chest.y + 0.04), w * (chest.x - 0.04), h * (belly.y + 0.04));
  ctx.bezierCurveTo(w * chest.x, h * (belly.y + 0.06), w * (belly.x + 0.02), h * (belly.y + 0.04), w * (belly.x + 0.04), h * (belly.y + 0.02));
  ctx.bezierCurveTo(w * (belly.x + 0.06), h * belly.y, w * (belly.x + 0.04), h * (chest.y - 0.02), w * (hip.x - 0.04), h * (hip.y - 0.04));
  ctx.bezierCurveTo(w * (chest.x + 0.04), h * (chest.y - 0.06), w * (neck.x + 0.06), h * (neck.y - 0.04), w * (neck.x + 0.02), h * (neck.y - 0.03));
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = `rgb(${vestDark.join(',')})`;
  ctx.lineWidth = w * 0.003;
  ctx.stroke();
  // Vest AO — bottom edge
  ambientOcclusion(ctx, w * chest.x, h * (chest.y + 0.05), w * 0.06, h * 0.012, 0.25);
  highlight(ctx, w * (chest.x - 0.02), h * (chest.y - 0.02), w * 0.02, `rgb(${vestLight.join(',')})`, 0.18);

  // 6. NEAR LIMBS
  for (const limb of sk.limbs) {
    if (limb.side === 'near') drawSkeletonLimbChain(ctx, limb.segments, w, h, `rgb(${scaleDark.join(',')})`);
  }

  // 7. CLAWED FEET — on all leg endpoints
  for (const limb of sk.limbs) {
    const foot = limb.segments[limb.segments.length - 1];
    if (foot.y < 0.75) continue;
    ctx.fillStyle = limb.side === 'near' ? `rgb(${scaleDark.join(',')})` : `rgb(${scaleShadow.join(',')})`;
    fillEllipse(ctx, w * foot.x, h * foot.y, w * (foot.radius + 0.004), h * 0.010);
    ctx.fillStyle = `rgb(${teethColor.join(',')})`;
    for (let c = -1; c <= 1; c++) {
      const cx = w * foot.x + c * w * 0.006;
      ctx.beginPath();
      ctx.moveTo(cx, h * foot.y + h * 0.004);
      ctx.lineTo(cx - w * 0.003, h * foot.y + h * 0.030);
      ctx.lineTo(cx + w * 0.003, h * foot.y + h * 0.020);
      ctx.fill();
    }
  }

  // 8. NEAR HAND gripping spear
  ctx.fillStyle = `rgb(${scaleMid.join(',')})`;
  fillEllipse(ctx, w * handX, h * handY, w * 0.012, w * 0.009);
  ctx.fillStyle = `rgb(${scaleDark.join(',')})`;
  for (let f = 0; f < 3; f++) {
    fillCircle(ctx, w * (handX - 0.004 + f * 0.004), h * (handY - 0.004 + f * 0.004), w * 0.004);
  }
  // Far hand claws spread for balance
  ctx.fillStyle = `rgb(${scaleShadow.join(',')})`;
  const farHand = sk.limbs[1].segments[3];
  for (let c = -1; c <= 1; c++) {
    ctx.beginPath();
    ctx.moveTo(w * farHand.x, h * farHand.y);
    ctx.lineTo(w * (farHand.x - 0.008 + c * 0.006), h * (farHand.y + 0.030));
    ctx.lineTo(w * (farHand.x + 0.002 + c * 0.006), h * (farHand.y + 0.020));
    ctx.fill();
  }

  // 9. HEAD — angular lizard skull, thrust forward low
  const hx = head.x, hy = head.y, hr = head.radius;
  const sx = snout.x, sy = snout.y;
  ctx.fillStyle = bodyGrad3(ctx, w * hx, h * hy, w * hr * 2.4,
    scaleMid[0], scaleMid[1], scaleMid[2],
    scaleShadow[0], scaleShadow[1], scaleShadow[2],
    scaleLight[0], scaleLight[1], scaleLight[2]);
  ctx.beginPath();
  // Wider, flatter skull for horizontal pose
  ctx.moveTo(w * (hx + hr * 0.8), h * (hy - hr * 0.7));
  ctx.bezierCurveTo(w * (hx + 0.01), h * (hy - hr * 1.1), w * (sx + 0.04), h * (sy - 0.06), w * (sx - 0.02), h * (sy - 0.01));
  ctx.bezierCurveTo(w * (sx - 0.04), h * (sy + 0.04), w * (sx - 0.02), h * (sy + 0.10), w * (hx - 0.01), h * (hy + hr * 0.8));
  ctx.bezierCurveTo(w * (hx + hr * 0.3), h * (hy + hr * 0.6), w * (hx + hr * 0.8), h * (hy + hr * 0.2), w * (hx + hr * 0.8), h * (hy - hr * 0.7));
  ctx.fill();
  // Brow ridge shadow
  ambientOcclusion(ctx, w * (hx - 0.005), h * (hy + 0.01), w * 0.035, h * 0.010, 0.35);

  // 10. HORNS — swept back, aggressive
  ctx.fillStyle = `rgb(${hornColor.join(',')})`;
  // Center horn
  ctx.beginPath();
  ctx.moveTo(w * (hx + 0.01), h * (hy - hr * 0.7));
  ctx.lineTo(w * (hx + 0.03), h * (hy - hr - 0.05));
  ctx.lineTo(w * (hx + 0.02), h * (hy - hr * 0.5));
  ctx.fill();
  // Side horn — sweeps back
  ctx.beginPath();
  ctx.moveTo(w * (hx + hr * 0.5), h * (hy - hr * 0.4));
  ctx.lineTo(w * (hx + hr + 0.02), h * (hy - hr - 0.02));
  ctx.lineTo(w * (hx + hr * 0.5), h * (hy - hr * 0.2));
  ctx.fill();
  // Horn tips bright
  ctx.fillStyle = `rgb(${scaleLight.join(',')})`;
  ctx.beginPath();
  ctx.moveTo(w * (hx + 0.025), h * (hy - hr - 0.03));
  ctx.lineTo(w * (hx + 0.03), h * (hy - hr - 0.05));
  ctx.lineTo(w * (hx + 0.035), h * (hy - hr - 0.03));
  ctx.fill();
  // Back-of-head ridge spines — along the spine toward neck
  for (let i = 0; i < 4; i++) {
    const t = i / 4;
    const spx = hx + hr * 0.6 + t * (neck.x - hx - hr * 0.2);
    const spy = hy - hr * 0.2 + t * (neck.y - hy + hr * 0.2);
    ctx.fillStyle = `rgb(${hornColor.join(',')})`;
    ctx.beginPath();
    ctx.moveTo(w * spx, h * spy);
    ctx.lineTo(w * (spx + 0.004), h * (spy - 0.022 + i * 0.003));
    ctx.lineTo(w * (spx + 0.010), h * spy);
    ctx.fill();
  }

  // 11. SNOUT — dark nub
  ctx.fillStyle = `rgb(${scaleDark.join(',')})`;
  ctx.beginPath(); ctx.arc(w * (sx - 0.015), h * (sy + 0.005), w * 0.014, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = `rgb(${scaleShadow.join(',')})`;
  fillCircle(ctx, w * (sx - 0.025), h * sy, w * 0.004);
  fillCircle(ctx, w * (sx - 0.020), h * (sy + 0.010), w * 0.003);

  // 12. MOUTH — wide snarl, aggressive
  ctx.fillStyle = 'rgb(15,8,5)';
  ctx.beginPath();
  ctx.moveTo(w * (sx - 0.025), h * (sy + 0.018));
  ctx.quadraticCurveTo(w * sx, h * (sy + 0.06), w * (hx - 0.01), h * (hy + hr * 0.5));
  ctx.quadraticCurveTo(w * (sx + 0.01), h * (sy + 0.04), w * (sx - 0.025), h * (sy + 0.018));
  ctx.fill();
  // Upper fangs — BIG, prominent
  ctx.fillStyle = `rgb(${teethColor.join(',')})`;
  ctx.beginPath();
  ctx.moveTo(w * (sx - 0.018), h * (sy + 0.018));
  ctx.lineTo(w * (sx - 0.025), h * (sy + 0.065));
  ctx.lineTo(w * (sx - 0.012), h * (sy + 0.025));
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(w * (sx - 0.002), h * (sy + 0.025));
  ctx.lineTo(w * (sx - 0.008), h * (sy + 0.058));
  ctx.lineTo(w * (sx + 0.006), h * (sy + 0.032));
  ctx.fill();
  // Smaller teeth
  ctx.fillStyle = 'rgb(195,185,168)';
  ctx.beginPath();
  ctx.moveTo(w * (sx - 0.010), h * (sy + 0.024));
  ctx.lineTo(w * (sx - 0.014), h * (sy + 0.045));
  ctx.lineTo(w * (sx - 0.006), h * (sy + 0.028));
  ctx.fill();
  // Lower fang
  ctx.fillStyle = `rgb(${teethColor.join(',')})`;
  ctx.beginPath();
  ctx.moveTo(w * (sx - 0.012), h * (sy + 0.050));
  ctx.lineTo(w * (sx - 0.008), h * (sy + 0.030));
  ctx.lineTo(w * (sx - 0.002), h * (sy + 0.048));
  ctx.fill();

  // 13. EYES — THE BRIGHTEST THING
  // Near eye — big, burning yellow
  const eNx = hx - 0.005, eNy = hy - 0.010;
  ambientOcclusion(ctx, w * eNx, h * eNy, w * 0.024, w * 0.020, 0.40);
  ctx.save(); ctx.globalAlpha = 0.30;
  ctx.fillStyle = `rgb(${eyeGlow.join(',')})`;
  fillCircle(ctx, w * eNx, h * eNy, w * 0.026);
  ctx.restore();
  ctx.fillStyle = `rgb(${eyeGlow.join(',')})`;
  fillCircle(ctx, w * eNx, h * eNy, w * 0.016);
  ctx.fillStyle = `rgb(${eyeCore.join(',')})`;
  fillCircle(ctx, w * eNx, h * eNy, w * 0.010);
  // Vertical slit pupil
  ctx.fillStyle = 'rgb(10,5,2)';
  ctx.beginPath();
  ctx.ellipse(w * (eNx + 0.002), h * eNy, w * 0.002, w * 0.011, 0, 0, Math.PI * 2);
  ctx.fill();
  // Specular — alive moment
  ctx.fillStyle = 'rgb(255,255,255)';
  fillCircle(ctx, w * (eNx - 0.007), h * (eNy - 0.007), w * 0.005);
  ctx.fillStyle = 'rgba(255,252,235,0.5)';
  fillCircle(ctx, w * (eNx + 0.005), h * (eNy + 0.004), w * 0.002);

  // Far eye — dimmer, partially behind snout
  const eFx = sx + 0.010, eFy = sy - 0.032;
  ctx.save(); ctx.globalAlpha = 0.50;
  ctx.fillStyle = `rgba(${eyeGlow.join(',')},0.22)`;
  fillCircle(ctx, w * eFx, h * eFy, w * 0.016);
  ctx.fillStyle = `rgb(${eyeGlow.join(',')})`;
  fillCircle(ctx, w * eFx, h * eFy, w * 0.010);
  ctx.fillStyle = `rgb(${eyeCore.join(',')})`;
  fillCircle(ctx, w * eFx, h * eFy, w * 0.006);
  ctx.restore();

  // 14. Scale texture on body
  scaleTexture(ctx, w * (chest.x - 0.06), h * (chest.y - 0.02), w * 0.18, h * 0.12,
    w * 0.010, `rgba(${scaleShadow.join(',')},0.35)`, `rgba(${scaleLight.join(',')},0.15)`, 0.50);
  // Head scales
  scaleTexture(ctx, w * (hx - 0.02), h * (hy - 0.02), w * 0.05, h * 0.04,
    w * 0.006, `rgba(${scaleShadow.join(',')},0.30)`, `rgba(${scaleLight.join(',')},0.12)`, 0.65);

  // 15. Spine ridge — small bumps along the back from neck to tail
  ctx.fillStyle = `rgb(${scaleDark.join(',')})`;
  for (let i = 0; i < 6; i++) {
    const t = i / 6;
    const rx = neck.x + t * (hip.x - neck.x);
    const ry = neck.y + t * (hip.y - neck.y) - 0.04;
    const sz = 0.006 + (1 - Math.abs(t - 0.5) * 2) * 0.004;
    ctx.beginPath();
    ctx.moveTo(w * (rx - sz * 0.5), h * ry);
    ctx.lineTo(w * rx, h * (ry - sz * 3));
    ctx.lineTo(w * (rx + sz * 0.5), h * ry);
    ctx.fill();
  }
}

// -- Goblin skeleton: squat barrel-body, two-handed axe raised, huge ears ------
const GOBLIN_SKELETON: Skeleton = {
  spine: [
    { id: 'jaw',    x: 0.30, y: 0.38, radius: 0.016 },
    { id: 'head',   x: 0.38, y: 0.28, radius: 0.082 },
    { id: 'neck',   x: 0.42, y: 0.42, radius: 0.050 },
    { id: 'chest',  x: 0.46, y: 0.52, radius: 0.095 },
    { id: 'belly',  x: 0.48, y: 0.62, radius: 0.098 },
    { id: 'hip',    x: 0.48, y: 0.72, radius: 0.080 },
  ],
  tail: { points: [], startWidth: 0, endWidth: 0 },
  limbs: [
    { attach: 'chest', side: 'near', segments: [
      { x: 0.44, y: 0.48, radius: 0.034 },
      { x: 0.52, y: 0.36, radius: 0.024 },
      { x: 0.60, y: 0.24, radius: 0.018 },
      { x: 0.64, y: 0.16, radius: 0.020 },
    ]},
    { attach: 'chest', side: 'far', segments: [
      { x: 0.50, y: 0.50, radius: 0.028 },
      { x: 0.54, y: 0.40, radius: 0.020 },
      { x: 0.58, y: 0.30, radius: 0.015 },
      { x: 0.60, y: 0.22, radius: 0.018 },
    ]},
    { attach: 'hip', side: 'near', segments: [
      { x: 0.40, y: 0.78, radius: 0.040 },
      { x: 0.36, y: 0.86, radius: 0.032 },
      { x: 0.34, y: 0.94, radius: 0.028 },
    ]},
    { attach: 'hip', side: 'far', segments: [
      { x: 0.56, y: 0.78, radius: 0.034 },
      { x: 0.62, y: 0.86, radius: 0.026 },
      { x: 0.64, y: 0.94, radius: 0.024 },
    ]},
  ],
};

function drawGoblinRedux(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const sk = GOBLIN_SKELETON;
  const jaw = sk.spine.find(n => n.id === 'jaw')!;
  const head = sk.spine.find(n => n.id === 'head')!;
  const neck = sk.spine.find(n => n.id === 'neck')!;
  const chest = sk.spine.find(n => n.id === 'chest')!;
  const belly = sk.spine.find(n => n.id === 'belly')!;
  const hip = sk.spine.find(n => n.id === 'hip')!;

  const skinDark = [58, 72, 28];
  const skinMid = [88, 108, 42];
  const skinLight = [118, 142, 58];
  const skinShadow = [32, 40, 16];
  const leatherDark = [62, 44, 28];
  const leatherMid = [92, 68, 42];
  const leatherLight = [118, 90, 56];
  const eyeOuter = [255, 160, 20];
  const eyeCore = [255, 240, 120];
  const teethColor = [210, 200, 175];
  const axeWood = [95, 68, 38];
  const axeHead = [155, 148, 138];
  const axeEdge = [200, 195, 185];
  const earInner = [120, 65, 50];

  // 1. FAR LIMBS
  for (const limb of sk.limbs) {
    if (limb.side === 'far') drawSkeletonLimbChain(ctx, limb.segments, w, h, `rgb(${skinShadow.join(',')})`);
  }

  // 2. AXE — two-handed, shaft only from hands up to head
  const handX = 0.64, handY = 0.16;
  const farHandY = 0.22;
  ctx.strokeStyle = `rgb(${axeWood.join(',')})`;
  ctx.lineCap = 'round';
  ctx.lineWidth = w * 0.022;
  ctx.beginPath();
  ctx.moveTo(w * 0.56, h * (farHandY + 0.02));
  ctx.lineTo(w * (handX + 0.06), h * (handY - 0.10));
  ctx.stroke();
  ctx.strokeStyle = 'rgba(130,100,60,0.30)';
  ctx.lineWidth = w * 0.006;
  ctx.beginPath();
  ctx.moveTo(w * 0.57, h * farHandY);
  ctx.lineTo(w * (handX + 0.04), h * (handY - 0.06));
  ctx.stroke();
  const ahx = handX + 0.06, ahy = handY - 0.12;
  ctx.fillStyle = `rgb(${axeHead.join(',')})`;
  ctx.beginPath();
  ctx.moveTo(w * ahx, h * (ahy + 0.03));
  ctx.bezierCurveTo(w * (ahx + 0.08), h * (ahy - 0.06), w * (ahx + 0.16), h * (ahy - 0.04), w * (ahx + 0.16), h * (ahy + 0.03));
  ctx.bezierCurveTo(w * (ahx + 0.16), h * (ahy + 0.10), w * (ahx + 0.08), h * (ahy + 0.14), w * ahx, h * (ahy + 0.08));
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = `rgba(${axeHead[0] - 30},${axeHead[1] - 30},${axeHead[2] - 30},0.85)`;
  ctx.beginPath();
  ctx.moveTo(w * ahx, h * (ahy + 0.03));
  ctx.bezierCurveTo(w * (ahx - 0.05), h * (ahy - 0.03), w * (ahx - 0.08), h * (ahy - 0.01), w * (ahx - 0.08), h * (ahy + 0.04));
  ctx.bezierCurveTo(w * (ahx - 0.07), h * (ahy + 0.09), w * (ahx - 0.03), h * (ahy + 0.10), w * ahx, h * (ahy + 0.08));
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = `rgb(${axeEdge.join(',')})`;
  ctx.lineWidth = w * 0.006;
  ctx.beginPath();
  ctx.moveTo(w * (ahx + 0.16), h * (ahy - 0.02));
  ctx.bezierCurveTo(w * (ahx + 0.16), h * (ahy + 0.05), w * (ahx + 0.12), h * (ahy + 0.12), w * (ahx + 0.04), h * (ahy + 0.14));
  ctx.stroke();
  ctx.fillStyle = 'rgba(220,218,210,0.30)';
  fillEllipse(ctx, w * (ahx + 0.08), h * (ahy + 0.02), w * 0.035, w * 0.025);
  ctx.fillStyle = `rgb(${axeHead.join(',')})`;
  fillCircle(ctx, w * (ahx + 0.14), h * (ahy + 0.06), w * 0.004);
  fillCircle(ctx, w * (ahx + 0.12), h * (ahy + 0.10), w * 0.003);

  // 3. BODY
  const bodyFill = bodyGrad3(ctx, w * belly.x, h * belly.y, w * 0.22,
    skinMid[0], skinMid[1], skinMid[2],
    skinShadow[0], skinShadow[1], skinShadow[2],
    skinLight[0], skinLight[1], skinLight[2]);
  drawSkeletonBodyOutline(ctx, sk.spine, w, h, bodyFill);

  // 4. LEATHER VEST
  ctx.fillStyle = bodyGrad3(ctx, w * chest.x, h * chest.y, w * 0.12,
    leatherMid[0], leatherMid[1], leatherMid[2],
    leatherDark[0], leatherDark[1], leatherDark[2],
    leatherLight[0], leatherLight[1], leatherLight[2]);
  ctx.beginPath();
  ctx.moveTo(w * (neck.x - 0.02), h * (neck.y + 0.02));
  ctx.bezierCurveTo(w * (chest.x - 0.06), h * (chest.y - 0.02), w * (chest.x - 0.07), h * (chest.y + 0.08), w * (belly.x - 0.04), h * (belly.y + 0.02));
  ctx.bezierCurveTo(w * belly.x, h * (belly.y + 0.04), w * (belly.x + 0.04), h * (belly.y + 0.02), w * (belly.x + 0.05), h * belly.y);
  ctx.bezierCurveTo(w * (chest.x + 0.06), h * (chest.y + 0.02), w * (chest.x + 0.04), h * (chest.y - 0.04), w * (neck.x + 0.04), h * (neck.y + 0.01));
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = `rgb(${leatherDark.join(',')})`;
  ctx.lineWidth = w * 0.003;
  ctx.stroke();
  ctx.strokeStyle = `rgb(${leatherDark.join(',')})`;
  ctx.lineWidth = w * 0.008;
  ctx.beginPath();
  ctx.moveTo(w * (belly.x - 0.05), h * (belly.y + 0.01));
  ctx.bezierCurveTo(w * belly.x, h * (belly.y + 0.03), w * (belly.x + 0.04), h * (belly.y + 0.02), w * (belly.x + 0.05), h * belly.y);
  ctx.stroke();
  ctx.fillStyle = `rgb(${axeHead.join(',')})`;
  fillCircle(ctx, w * belly.x, h * (belly.y + 0.02), w * 0.008);
  highlight(ctx, w * (chest.x - 0.01), h * (chest.y + 0.01), w * 0.018, `rgb(${leatherLight.join(',')})`, 0.15);
  ambientOcclusion(ctx, w * belly.x, h * (belly.y + 0.03), w * 0.04, h * 0.008, 0.22);

  // 5. NEAR LIMBS
  for (const limb of sk.limbs) {
    if (limb.side === 'near') drawSkeletonLimbChain(ctx, limb.segments, w, h, `rgb(${skinDark.join(',')})`);
  }

  // 6. FEET
  for (const limb of sk.limbs) {
    const foot = limb.segments[limb.segments.length - 1];
    if (foot.y < 0.88) continue;
    ctx.fillStyle = limb.side === 'near' ? `rgb(${skinDark.join(',')})` : `rgb(${skinShadow.join(',')})`;
    fillEllipse(ctx, w * foot.x, h * foot.y, w * (foot.radius + 0.006), h * 0.012);
    ctx.fillStyle = `rgb(${teethColor.join(',')})`;
    for (let c = -1; c <= 1; c++) {
      const cx = w * foot.x + c * w * 0.007;
      ctx.beginPath();
      ctx.moveTo(cx, h * foot.y + h * 0.006);
      ctx.lineTo(cx - w * 0.002, h * foot.y + h * 0.020);
      ctx.lineTo(cx + w * 0.002, h * foot.y + h * 0.014);
      ctx.fill();
    }
  }

  // 7. HANDS on axe shaft
  ctx.fillStyle = `rgb(${skinMid.join(',')})`;
  fillEllipse(ctx, w * handX, h * handY, w * 0.016, w * 0.014);
  ctx.fillStyle = `rgb(${skinDark.join(',')})`;
  for (let f = 0; f < 4; f++) {
    fillCircle(ctx, w * (handX - 0.005 + f * 0.004), h * (handY + 0.002 + f * 0.003), w * 0.005);
  }
  const farHand = sk.limbs[1].segments[3];
  ctx.fillStyle = `rgb(${skinShadow.join(',')})`;
  fillEllipse(ctx, w * farHand.x, h * farHand.y, w * 0.014, w * 0.012);
  for (let f = 0; f < 4; f++) {
    fillCircle(ctx, w * (farHand.x - 0.004 + f * 0.003), h * (farHand.y + 0.002 + f * 0.003), w * 0.004);
  }

  // 8. HEAD — wide round
  const hx = head.x, hy = head.y, hr = head.radius;
  const jx = jaw.x, jy = jaw.y;
  ctx.fillStyle = bodyGrad3(ctx, w * hx, h * hy, w * hr * 2.5,
    skinMid[0], skinMid[1], skinMid[2],
    skinShadow[0], skinShadow[1], skinShadow[2],
    skinLight[0], skinLight[1], skinLight[2]);
  fillEllipse(ctx, w * hx, h * hy, w * hr * 1.4, h * hr * 1.2);
  ctx.fillStyle = bodyGrad3(ctx, w * jx, h * jy, w * 0.06,
    skinMid[0], skinMid[1], skinMid[2],
    skinShadow[0], skinShadow[1], skinShadow[2],
    skinLight[0], skinLight[1], skinLight[2]);
  ctx.beginPath();
  ctx.moveTo(w * (hx - hr * 0.8), h * (hy + hr * 0.2));
  ctx.bezierCurveTo(w * (jx - 0.06), h * (jy - 0.02), w * (jx - 0.06), h * (jy + 0.04), w * (jx - 0.02), h * (jy + 0.06));
  ctx.bezierCurveTo(w * (jx + 0.02), h * (jy + 0.06), w * (hx + 0.02), h * (hy + hr * 0.6), w * (hx + hr * 0.6), h * (hy + hr * 0.3));
  ctx.fill();
  ambientOcclusion(ctx, w * (hx - 0.02), h * (hy + 0.01), w * 0.06, h * 0.015, 0.35);

  // 9. EARS — thick base, sharp tip
  const earNx = hx + hr * 0.6, earNy = hy - hr * 0.1;
  ctx.fillStyle = `rgb(${skinMid.join(',')})`;
  ctx.beginPath();
  ctx.moveTo(w * earNx, h * (earNy + 0.025));
  ctx.lineTo(w * earNx, h * (earNy - 0.025));
  ctx.bezierCurveTo(w * (earNx + 0.06), h * (earNy - 0.04), w * (earNx + 0.12), h * (earNy - 0.06), w * (earNx + 0.16), h * (earNy - 0.04));
  ctx.bezierCurveTo(w * (earNx + 0.12), h * (earNy + 0.00), w * (earNx + 0.06), h * (earNy + 0.02), w * earNx, h * (earNy + 0.025));
  ctx.fill();
  ctx.fillStyle = `rgb(${earInner.join(',')})`;
  ctx.beginPath();
  ctx.moveTo(w * (earNx + 0.01), h * (earNy + 0.015));
  ctx.lineTo(w * (earNx + 0.01), h * (earNy - 0.015));
  ctx.bezierCurveTo(w * (earNx + 0.05), h * (earNy - 0.03), w * (earNx + 0.10), h * (earNy - 0.04), w * (earNx + 0.13), h * (earNy - 0.03));
  ctx.bezierCurveTo(w * (earNx + 0.10), h * (earNy + 0.00), w * (earNx + 0.05), h * (earNy + 0.01), w * (earNx + 0.01), h * (earNy + 0.015));
  ctx.fill();
  ctx.strokeStyle = `rgb(${skinLight.join(',')})`;
  ctx.lineWidth = w * 0.004;
  ctx.beginPath();
  ctx.moveTo(w * earNx, h * (earNy - 0.025));
  ctx.bezierCurveTo(w * (earNx + 0.06), h * (earNy - 0.04), w * (earNx + 0.12), h * (earNy - 0.06), w * (earNx + 0.16), h * (earNy - 0.04));
  ctx.stroke();
  const earFx = hx - 0.02, earFy = hy - hr * 0.3;
  ctx.fillStyle = `rgb(${skinShadow.join(',')})`;
  ctx.beginPath();
  ctx.moveTo(w * earFx, h * (earFy + 0.020));
  ctx.lineTo(w * earFx, h * (earFy - 0.020));
  ctx.bezierCurveTo(w * (earFx - 0.05), h * (earFy - 0.04), w * (earFx - 0.10), h * (earFy - 0.06), w * (earFx - 0.14), h * (earFy - 0.05));
  ctx.bezierCurveTo(w * (earFx - 0.10), h * (earFy - 0.01), w * (earFx - 0.05), h * (earFy + 0.01), w * earFx, h * (earFy + 0.020));
  ctx.fill();
  ctx.fillStyle = `rgba(${earInner.join(',')},0.4)`;
  ctx.beginPath();
  ctx.moveTo(w * (earFx - 0.01), h * (earFy + 0.012));
  ctx.lineTo(w * (earFx - 0.01), h * (earFy - 0.012));
  ctx.bezierCurveTo(w * (earFx - 0.04), h * (earFy - 0.03), w * (earFx - 0.08), h * (earFy - 0.04), w * (earFx - 0.11), h * (earFy - 0.04));
  ctx.bezierCurveTo(w * (earFx - 0.08), h * (earFy - 0.01), w * (earFx - 0.04), h * (earFy + 0.00), w * (earFx - 0.01), h * (earFy + 0.012));
  ctx.fill();

  // 10. NOSE
  ctx.fillStyle = `rgb(${skinDark.join(',')})`;
  fillEllipse(ctx, w * (jx - 0.01), h * (jy - 0.02), w * 0.018, w * 0.014);
  ctx.fillStyle = `rgb(${skinShadow.join(',')})`;
  fillCircle(ctx, w * (jx - 0.022), h * (jy - 0.018), w * 0.005);
  fillCircle(ctx, w * (jx - 0.008), h * (jy - 0.014), w * 0.004);

  // 11. MOUTH
  ctx.fillStyle = 'rgb(18,10,8)';
  ctx.beginPath();
  ctx.moveTo(w * (jx - 0.035), h * (jy + 0.005));
  ctx.quadraticCurveTo(w * (jx + 0.01), h * (jy + 0.06), w * (hx + 0.01), h * (hy + hr * 0.3));
  ctx.quadraticCurveTo(w * jx, h * (jy + 0.04), w * (jx - 0.035), h * (jy + 0.005));
  ctx.fill();
  ctx.fillStyle = `rgb(${teethColor.join(',')})`;
  ctx.beginPath();
  ctx.moveTo(w * (jx - 0.025), h * (jy + 0.005));
  ctx.lineTo(w * (jx - 0.030), h * (jy + 0.050));
  ctx.lineTo(w * (jx - 0.018), h * (jy + 0.012));
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(w * (jx - 0.005), h * (jy + 0.015));
  ctx.lineTo(w * (jx - 0.012), h * (jy + 0.048));
  ctx.lineTo(w * (jx + 0.004), h * (jy + 0.022));
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(w * (jx - 0.018), h * (jy + 0.040));
  ctx.lineTo(w * (jx - 0.014), h * (jy + 0.015));
  ctx.lineTo(w * (jx - 0.008), h * (jy + 0.038));
  ctx.fill();

  // 12. EYES — two clearly visible
  const eNx = hx - 0.01, eNy = hy - 0.01;
  ambientOcclusion(ctx, w * eNx, h * eNy, w * 0.026, w * 0.022, 0.35);
  ctx.save(); ctx.globalAlpha = 0.28;
  ctx.fillStyle = `rgb(${eyeOuter.join(',')})`;
  fillCircle(ctx, w * eNx, h * eNy, w * 0.026);
  ctx.restore();
  ctx.fillStyle = `rgb(${eyeOuter.join(',')})`;
  fillCircle(ctx, w * eNx, h * eNy, w * 0.018);
  ctx.fillStyle = `rgb(${eyeCore.join(',')})`;
  fillCircle(ctx, w * eNx, h * eNy, w * 0.010);
  ctx.fillStyle = 'rgb(8,4,2)';
  fillCircle(ctx, w * (eNx - 0.003), h * eNy, w * 0.006);
  ctx.fillStyle = 'rgb(255,255,255)';
  fillCircle(ctx, w * (eNx - 0.007), h * (eNy - 0.007), w * 0.005);

  const eFx = hx + hr * 0.5, eFy = hy - 0.01;
  ambientOcclusion(ctx, w * eFx, h * eFy, w * 0.020, w * 0.018, 0.30);
  ctx.save(); ctx.globalAlpha = 0.22;
  ctx.fillStyle = `rgb(${eyeOuter.join(',')})`;
  fillCircle(ctx, w * eFx, h * eFy, w * 0.020);
  ctx.restore();
  ctx.fillStyle = `rgb(${eyeOuter.join(',')})`;
  fillCircle(ctx, w * eFx, h * eFy, w * 0.014);
  ctx.fillStyle = `rgb(${eyeCore.join(',')})`;
  fillCircle(ctx, w * eFx, h * eFy, w * 0.008);
  ctx.fillStyle = 'rgb(8,4,2)';
  fillCircle(ctx, w * (eFx - 0.002), h * eFy, w * 0.005);
  ctx.fillStyle = 'rgb(255,255,255)';
  fillCircle(ctx, w * (eFx - 0.005), h * (eFy - 0.005), w * 0.003);

  // 13. BROW WRINKLES
  ctx.strokeStyle = `rgb(${skinShadow.join(',')})`;
  ctx.lineWidth = w * 0.005;
  ctx.beginPath();
  ctx.moveTo(w * (eNx - 0.015), h * (eNy - 0.022));
  ctx.quadraticCurveTo(w * ((eNx + eFx) / 2), h * (eNy - 0.032), w * (eFx + 0.015), h * (eFy - 0.020));
  ctx.stroke();

  // 14. WARTS
  ctx.fillStyle = `rgb(${skinDark.join(',')})`;
  fillCircle(ctx, w * (hx + 0.02), h * (hy + 0.01), w * 0.005);
  fillCircle(ctx, w * (jx - 0.01), h * (jy + 0.005), w * 0.004);
  ctx.fillStyle = `rgb(${skinLight.join(',')})`;
  fillCircle(ctx, w * (hx + 0.01), h * (hy - hr * 0.8), w * 0.008);
}

function furTextureDirectional(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
  length: number,
  dark: string, light: string,
  count: number,
  direction: (fx: number, fy: number) => number,
) {
  ctx.lineCap = 'round';
  for (let i = 0; i < count; i++) {
    const px = x + Math.random() * w;
    const py = y + Math.random() * h;
    const len = length * (0.7 + Math.random() * 0.6);
    const angle = direction(px, py) + (Math.random() - 0.5) * 0.6;
    ctx.strokeStyle = Math.random() < 0.28 ? light : dark;
    ctx.lineWidth = Math.max(1, w * 0.02);
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.quadraticCurveTo(
      px + Math.cos(angle) * len * 0.35,
      py + Math.sin(angle) * len * 0.35,
      px + Math.cos(angle) * len,
      py + Math.sin(angle) * len,
    );
    ctx.stroke();
  }
}

const SKELETON_CLEAN_SKELETON: Skeleton = {
  spine: [
    { id: 'jaw', x: 0.20, y: 0.20, radius: 0.020 },
    { id: 'head', x: 0.26, y: 0.12, radius: 0.072 },
    { id: 'neck', x: 0.32, y: 0.24, radius: 0.018 },
    { id: 'chest', x: 0.38, y: 0.36, radius: 0.065 },
    { id: 'belly', x: 0.40, y: 0.48, radius: 0.025 },
    { id: 'hip', x: 0.42, y: 0.56, radius: 0.045 },
  ],
  tail: { points: [], startWidth: 0, endWidth: 0 },
  limbs: [
    { attach: 'chest', side: 'near', segments: [
      { x: 0.30, y: 0.32, radius: 0.018 },
      { x: 0.20, y: 0.38, radius: 0.014 },
      { x: 0.14, y: 0.44, radius: 0.011 },
      { x: 0.08, y: 0.48, radius: 0.015 },
    ]},
    { attach: 'chest', side: 'far', segments: [
      { x: 0.46, y: 0.34, radius: 0.016 },
      { x: 0.52, y: 0.42, radius: 0.012 },
      { x: 0.54, y: 0.50, radius: 0.010 },
      { x: 0.54, y: 0.56, radius: 0.013 },
    ]},
    { attach: 'hip', side: 'near', segments: [
      { x: 0.36, y: 0.60, radius: 0.020 },
      { x: 0.30, y: 0.72, radius: 0.016 },
      { x: 0.28, y: 0.83, radius: 0.012 },
      { x: 0.26, y: 0.93, radius: 0.016 },
    ]},
    { attach: 'hip', side: 'far', segments: [
      { x: 0.48, y: 0.60, radius: 0.018 },
      { x: 0.54, y: 0.72, radius: 0.014 },
      { x: 0.58, y: 0.83, radius: 0.010 },
      { x: 0.60, y: 0.93, radius: 0.014 },
    ]},
  ],
};

function drawSkeletonRedux(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const sk = SKELETON_CLEAN_SKELETON;
  const jaw = sk.spine.find(n => n.id === 'jaw')!;
  const head = sk.spine.find(n => n.id === 'head')!;
  const neck = sk.spine.find(n => n.id === 'neck')!;
  const chest = sk.spine.find(n => n.id === 'chest')!;
  const belly = sk.spine.find(n => n.id === 'belly')!;
  const hip = sk.spine.find(n => n.id === 'hip')!;
  const boneDark = [55, 48, 38];
  const boneMid = [95, 82, 66];
  const boneLight = [145, 128, 105];
  const boneShadow = [28, 22, 16];
  const eyeGlow = [70, 225, 100];
  const eyeCore = [160, 255, 180];
  const swordBlade = [110, 102, 88];
  const swordEdge = [155, 145, 128];

  for (const limb of sk.limbs) {
    if (limb.side === 'far') drawSkeletonLimbChain(ctx, limb.segments, w, h, `rgb(${boneShadow.join(',')})`);
  }

  const handX = 0.08; const handY = 0.48;
  ctx.strokeStyle = `rgb(${swordBlade.join(',')})`;
  ctx.lineCap = 'round';
  ctx.lineWidth = w * 0.016;
  ctx.beginPath();
  ctx.moveTo(w * handX, h * handY);
  ctx.bezierCurveTo(w * 0.10, h * 0.34, w * 0.13, h * 0.20, w * 0.18, h * 0.10);
  ctx.stroke();
  ctx.strokeStyle = `rgb(${swordEdge.join(',')})`;
  ctx.lineWidth = w * 0.004;
  ctx.beginPath();
  ctx.moveTo(w * (handX - 0.004), h * (handY - 0.004));
  ctx.bezierCurveTo(w * 0.095, h * 0.34, w * 0.125, h * 0.20, w * 0.175, h * 0.10);
  ctx.stroke();

  drawSkeletonBodyOutline(ctx, sk.spine, w, h, bodyGrad3(
    ctx, w * chest.x, h * chest.y, w * 0.16,
    boneMid[0], boneMid[1], boneMid[2],
    boneShadow[0], boneShadow[1], boneShadow[2],
    boneLight[0], boneLight[1], boneLight[2],
  ));

  ctx.strokeStyle = 'rgba(0,0,0,0.65)';
  ctx.lineWidth = w * 0.004;
  for (let i = 0; i < 6; i++) {
    const t = i / 6;
    const ry = chest.y - 0.07 + t * 0.16;
    ctx.beginPath();
    ctx.moveTo(w * (chest.x + 0.005), h * ry);
    ctx.bezierCurveTo(w * (chest.x - 0.018), h * (ry + 0.01), w * (chest.x - 0.040), h * (ry + 0.02), w * (chest.x - 0.054), h * (ry + 0.026));
    ctx.stroke();
  }

  ctx.strokeStyle = `rgb(${boneShadow.join(',')})`;
  ctx.lineWidth = w * 0.007;
  ctx.beginPath();
  ctx.moveTo(w * neck.x, h * (neck.y + 0.02));
  ctx.bezierCurveTo(w * (chest.x - 0.01), h * chest.y, w * belly.x, h * belly.y, w * hip.x, h * (hip.y - 0.01));
  ctx.stroke();
  for (let i = 0; i < 10; i++) {
    const t = i / 10;
    const vx = neck.x + t * (hip.x - neck.x);
    const vy = neck.y + 0.03 + t * (hip.y - neck.y - 0.04);
    ctx.fillStyle = t > 0.5 && t < 0.85 ? `rgb(${boneLight.join(',')})` : `rgb(${boneMid.join(',')})`;
    fillCircle(ctx, w * vx, h * vy, w * (t > 0.5 && t < 0.85 ? 0.007 : 0.005));
  }

  for (const limb of sk.limbs) {
    if (limb.side === 'near') drawSkeletonLimbChain(ctx, limb.segments, w, h, `rgb(${boneDark.join(',')})`);
  }

  const hx = head.x; const hy = head.y; const hr = head.radius;
  ctx.fillStyle = bodyGrad3(ctx, w * hx, h * hy, w * hr * 2.4,
    boneMid[0], boneMid[1], boneMid[2],
    boneShadow[0], boneShadow[1], boneShadow[2],
    boneLight[0], boneLight[1], boneLight[2]);
  fillEllipse(ctx, w * hx, h * hy, w * hr * 1.15, h * hr * 1.0);
  ctx.fillStyle = 'rgba(0,0,0,0.7)';
  fillEllipse(ctx, w * (hx - hr * 0.25), h * (hy + hr * 0.12), w * 0.040, h * 0.018);
  fillEllipse(ctx, w * (hx + hr * 0.10), h * (hy + hr * 0.15), w * 0.030, h * 0.014);
  ctx.fillStyle = `rgb(${eyeGlow.join(',')})`;
  fillCircle(ctx, w * (hx - hr * 0.28), h * (hy + hr * 0.10), w * 0.010);
  ctx.fillStyle = `rgb(${eyeCore.join(',')})`;
  fillCircle(ctx, w * (hx - hr * 0.28), h * (hy + hr * 0.10), w * 0.005);
  ctx.fillStyle = 'rgb(6,4,3)';
  ctx.beginPath();
  ctx.moveTo(w * (jaw.x - 0.030), h * (jaw.y + 0.003));
  ctx.quadraticCurveTo(w * jaw.x, h * (jaw.y + 0.018), w * (hx + hr * 0.1), h * (jaw.y + 0.006));
  ctx.strokeStyle = `rgb(${boneLight.join(',')})`;
  ctx.lineWidth = w * 0.003;
  ctx.stroke();
}

const GOBLIN_SHAMAN_SKELETON: Skeleton = {
  spine: [
    { id: 'jaw', x: 0.30, y: 0.40, radius: 0.014 },
    { id: 'head', x: 0.36, y: 0.30, radius: 0.074 },
    { id: 'neck', x: 0.40, y: 0.44, radius: 0.042 },
    { id: 'chest', x: 0.44, y: 0.54, radius: 0.082 },
    { id: 'belly', x: 0.46, y: 0.64, radius: 0.078 },
    { id: 'hip', x: 0.46, y: 0.74, radius: 0.065 },
  ],
  tail: { points: [], startWidth: 0, endWidth: 0 },
  limbs: [
    { attach: 'chest', side: 'near', segments: [
      { x: 0.40, y: 0.52, radius: 0.028 },
      { x: 0.34, y: 0.58, radius: 0.020 },
      { x: 0.28, y: 0.64, radius: 0.016 },
      { x: 0.24, y: 0.68, radius: 0.018 },
    ]},
    { attach: 'chest', side: 'far', segments: [
      { x: 0.48, y: 0.50, radius: 0.024 },
      { x: 0.52, y: 0.42, radius: 0.018 },
      { x: 0.54, y: 0.36, radius: 0.014 },
      { x: 0.56, y: 0.32, radius: 0.016 },
    ]},
    { attach: 'hip', side: 'near', segments: [
      { x: 0.38, y: 0.78, radius: 0.036 },
      { x: 0.34, y: 0.86, radius: 0.028 },
      { x: 0.32, y: 0.94, radius: 0.024 },
    ]},
    { attach: 'hip', side: 'far', segments: [
      { x: 0.54, y: 0.78, radius: 0.030 },
      { x: 0.58, y: 0.86, radius: 0.022 },
      { x: 0.60, y: 0.94, radius: 0.020 },
    ]},
  ],
};

function drawGoblinShamanRedux(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const sk = GOBLIN_SHAMAN_SKELETON;
  const head = sk.spine.find(n => n.id === 'head')!;
  const chest = sk.spine.find(n => n.id === 'chest')!;
  const belly = sk.spine.find(n => n.id === 'belly')!;
  const hip = sk.spine.find(n => n.id === 'hip')!;
  const skinDark = [52, 58, 28];
  const skinMid = [72, 82, 38];
  const skinShadow = [28, 32, 14];
  const robeDark = [42, 18, 12];
  const robeMid = [68, 28, 18];
  const robeLight = [88, 40, 24];
  const hatMid = [72, 30, 18];
  const hatDark = [48, 20, 14];
  const orbGlow = [255, 180, 40];
  const orbCore = [255, 220, 100];
  const eyeOuter = [200, 160, 30];
  const eyeCore = [255, 200, 50];
  const staffX = 0.56;

  for (const limb of sk.limbs) {
    if (limb.side === 'far') drawSkeletonLimbChain(ctx, limb.segments, w, h, `rgb(${skinShadow.join(',')})`);
  }

  ctx.strokeStyle = 'rgb(120,105,80)';
  ctx.lineWidth = w * 0.014;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(w * staffX, h * 0.92);
  ctx.bezierCurveTo(w * 0.55, h * 0.60, w * 0.57, h * 0.28, w * 0.555, h * 0.06);
  ctx.stroke();

  drawSkeletonBodyOutline(ctx, sk.spine, w, h, `rgb(${robeDark.join(',')})`);
  ctx.fillStyle = bodyGrad3(ctx, w * chest.x, h * chest.y, w * 0.12,
    robeMid[0], robeMid[1], robeMid[2], 22, 10, 8, robeLight[0], robeLight[1], robeLight[2]);
  fillEllipse(ctx, w * chest.x, h * chest.y, w * chest.radius * 1.2, h * chest.radius * 1.1);
  ctx.fillStyle = `rgba(22,10,8,0.55)`;
  for (let f = 0; f < 4; f++) {
    const fx = chest.x - 0.04 + f * 0.025;
    ctx.beginPath();
    ctx.moveTo(w * fx, h * (chest.y - 0.02));
    ctx.bezierCurveTo(w * (fx - 0.005), h * belly.y, w * (fx + 0.005), h * hip.y, w * fx, h * (hip.y + 0.04));
    ctx.stroke();
  }

  for (const limb of sk.limbs) {
    if (limb.side === 'near') drawSkeletonLimbChain(ctx, limb.segments, w, h, `rgb(${skinDark.join(',')})`);
  }

  const hx = head.x; const hy = head.y; const hr = head.radius;
  ctx.fillStyle = bodyGrad3(ctx, w * hx, h * hy, w * hr,
    skinMid[0], skinMid[1], skinMid[2], skinShadow[0], skinShadow[1], skinShadow[2], skinDark[0], skinDark[1], skinDark[2]);
  fillEllipse(ctx, w * hx, h * hy, w * hr, h * hr * 0.9);
  ctx.fillStyle = `rgb(${hatDark.join(',')})`;
  ctx.beginPath();
  ctx.moveTo(w * (hx - hr * 1.2), h * (hy - hr * 0.2));
  ctx.quadraticCurveTo(w * hx, h * (hy - hr * 0.6), w * (hx + hr * 1.4), h * (hy - hr * 0.1));
  ctx.quadraticCurveTo(w * hx, h * (hy - hr * 0.1), w * (hx - hr * 1.2), h * (hy - hr * 0.2));
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = `rgb(${hatMid.join(',')})`;
  ctx.beginPath();
  ctx.moveTo(w * (hx - hr * 0.8), h * (hy - hr * 0.3));
  ctx.quadraticCurveTo(w * (hx + 0.02), h * (hy - hr * 3.0), w * (hx + hr * 1.0), h * (hy - hr * 3.4));
  ctx.quadraticCurveTo(w * (hx + hr * 0.5), h * (hy - hr * 1.6), w * (hx + hr * 1.0), h * (hy - hr * 0.2));
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = `rgb(${eyeOuter.join(',')})`;
  fillCircle(ctx, w * (hx - 0.01), h * (hy + 0.005), w * 0.015);
  ctx.fillStyle = `rgb(${eyeCore.join(',')})`;
  fillCircle(ctx, w * (hx - 0.01), h * (hy + 0.005), w * 0.009);

  const orbX = staffX - 0.005; const orbY = 0.07;
  const halo = ctx.createRadialGradient(w * orbX, h * orbY, 0, w * orbX, h * orbY, w * 0.08);
  halo.addColorStop(0, `rgba(${orbGlow.join(',')},0.5)`);
  halo.addColorStop(0.4, `rgba(${orbGlow.join(',')},0.15)`);
  halo.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = halo;
  fillCircle(ctx, w * orbX, h * orbY, w * 0.08);
  ctx.fillStyle = `rgb(${orbGlow.join(',')})`;
  fillCircle(ctx, w * orbX, h * orbY, w * 0.022);
  ctx.fillStyle = `rgb(${orbCore.join(',')})`;
  fillCircle(ctx, w * orbX, h * orbY, w * 0.014);
}

function drawDrip(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number) {
  ctx.beginPath();
  ctx.moveTo(x - width, y);
  ctx.bezierCurveTo(x - width * 0.8, y + height * 0.4, x - width * 0.3, y + height * 0.8, x, y + height);
  ctx.bezierCurveTo(x + width * 0.3, y + height * 0.8, x + width * 0.8, y + height * 0.4, x + width, y);
  ctx.closePath();
  ctx.fill();
}

function drawGelatinousOozeRedux(ctx: CanvasRenderingContext2D, _w: number, _h: number) {
  const w = _w; const h = _h;
  const bodyDark = [6, 22, 18];
  const bodyMid = [12, 38, 32];
  const bodyLight = [20, 58, 48];
  const bodyBright = [32, 85, 68];
  const slimeGlow = [60, 210, 160];
  const innerGlow = [40, 150, 110];
  const boneColor = [220, 210, 170];
  const metalBright = [230, 235, 245];
  const fTL = { x: 0.15, y: 0.23 };
  const fTR = { x: 0.81, y: 0.27 };
  const fBR = { x: 0.78, y: 0.80 };
  const fBL = { x: 0.18, y: 0.82 };

  const puddleGrad = ctx.createRadialGradient(w * 0.48, h * 0.86, 0, w * 0.48, h * 0.86, w * 0.38);
  puddleGrad.addColorStop(0, `rgba(${bodyMid.join(',')},0.5)`);
  puddleGrad.addColorStop(0.6, `rgba(${bodyDark.join(',')},0.3)`);
  puddleGrad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = puddleGrad;
  fillEllipse(ctx, w * 0.48, h * 0.86, w * 0.38, h * 0.06);

  const bodyGradLocal = ctx.createLinearGradient(w * 0.14, 0, w * 0.82, 0);
  bodyGradLocal.addColorStop(0, `rgb(${bodyMid.join(',')})`);
  bodyGradLocal.addColorStop(0.3, `rgb(${bodyDark.join(',')})`);
  bodyGradLocal.addColorStop(0.6, `rgb(${bodyMid.join(',')})`);
  bodyGradLocal.addColorStop(1, `rgb(${bodyDark.join(',')})`);
  ctx.fillStyle = bodyGradLocal;
  ctx.beginPath();
  ctx.moveTo(w * fTL.x, h * fTL.y);
  ctx.bezierCurveTo(w * 0.35, h * 0.215, w * 0.60, h * 0.26, w * fTR.x, h * fTR.y);
  ctx.bezierCurveTo(w * 0.825, h * 0.40, w * 0.80, h * 0.65, w * fBR.x, h * fBR.y);
  ctx.bezierCurveTo(w * 0.60, h * 0.83, w * 0.38, h * 0.86, w * fBL.x, h * fBL.y);
  ctx.bezierCurveTo(w * 0.155, h * 0.60, w * 0.13, h * 0.35, w * fTL.x, h * fTL.y);
  ctx.closePath();
  ctx.fill();

  const glowGrad = ctx.createRadialGradient(w * 0.46, h * 0.50, 0, w * 0.46, h * 0.50, w * 0.30);
  glowGrad.addColorStop(0, `rgba(${innerGlow.join(',')},0.40)`);
  glowGrad.addColorStop(0.4, `rgba(${innerGlow.join(',')},0.18)`);
  glowGrad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glowGrad;
  fillEllipse(ctx, w * 0.46, h * 0.50, w * 0.28, h * 0.24);

  ctx.fillStyle = `rgb(${boneColor.join(',')})`;
  fillEllipse(ctx, w * 0.40, h * 0.50, w * 0.055, h * 0.05);
  ctx.fillStyle = 'rgb(5,15,12)';
  fillEllipse(ctx, w * 0.382, h * 0.515, w * 0.014, h * 0.012);
  fillEllipse(ctx, w * 0.415, h * 0.517, w * 0.012, h * 0.010);

  ctx.fillStyle = `rgb(${metalBright.join(',')})`;
  ctx.beginPath();
  ctx.moveTo(w * 0.596, h * 0.36);
  ctx.lineTo(w * 0.604, h * 0.26);
  ctx.lineTo(w * 0.622, h * 0.27);
  ctx.lineTo(w * 0.618, h * 0.36);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = `rgb(${slimeGlow.join(',')})`;
  ctx.lineCap = 'round';
  ctx.lineWidth = w * 0.006;
  ctx.beginPath();
  ctx.moveTo(w * fTL.x, h * fTL.y);
  ctx.bezierCurveTo(w * 0.135, h * 0.35, w * 0.16, h * 0.60, w * fBL.x, h * fBL.y);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(w * fTL.x, h * fTL.y);
  ctx.bezierCurveTo(w * 0.35, h * 0.215, w * 0.60, h * 0.26, w * fTR.x, h * fTR.y);
  ctx.stroke();

  ctx.fillStyle = `rgb(${slimeGlow.join(',')})`;
  drawDrip(ctx, w * 0.22, h * 0.23, w * 0.006, h * 0.12);
  drawDrip(ctx, w * 0.52, h * 0.24, w * 0.007, h * 0.14);
  fillCircle(ctx, w * 0.22, h * 0.36, w * 0.008);
  fillCircle(ctx, w * 0.52, h * 0.39, w * 0.009);
  ambientOcclusion(ctx, w * fBL.x, h * fBL.y, w * 0.06, h * 0.04, 0.4);
  highlight(ctx, w * 0.28, h * 0.34, w * 0.08, `rgba(${bodyBright.join(',')},0.25)`, 0.35);
  ctx.fillStyle = `rgba(${bodyLight.join(',')},0.18)`;
  fillEllipse(ctx, w * 0.28, h * 0.34, w * 0.08, h * 0.05);
}

const BUGBEAR_SKELETON: Skeleton = {
  spine: [
    { id: 'snout', x: 0.20, y: 0.25, radius: 0.035 },
    { id: 'head', x: 0.28, y: 0.20, radius: 0.088 },
    { id: 'neck', x: 0.36, y: 0.30, radius: 0.075 },
    { id: 'chest', x: 0.46, y: 0.42, radius: 0.140 },
    { id: 'belly', x: 0.50, y: 0.58, radius: 0.125 },
    { id: 'hip', x: 0.52, y: 0.70, radius: 0.100 },
  ],
  tail: { points: [], startWidth: 0, endWidth: 0 },
  limbs: [
    { attach: 'chest', side: 'near', segments: [
      { x: 0.38, y: 0.40, radius: 0.052 }, { x: 0.30, y: 0.52, radius: 0.042 }, { x: 0.24, y: 0.64, radius: 0.034 }, { x: 0.20, y: 0.76, radius: 0.028 },
    ]},
    { attach: 'chest', side: 'far', segments: [
      { x: 0.50, y: 0.38, radius: 0.044 }, { x: 0.42, y: 0.30, radius: 0.034 }, { x: 0.32, y: 0.26, radius: 0.028 }, { x: 0.22, y: 0.30, radius: 0.026 },
    ]},
    { attach: 'hip', side: 'near', segments: [
      { x: 0.44, y: 0.76, radius: 0.054 }, { x: 0.40, y: 0.84, radius: 0.044 }, { x: 0.38, y: 0.92, radius: 0.038 }, { x: 0.36, y: 0.98, radius: 0.034 },
    ]},
    { attach: 'hip', side: 'far', segments: [
      { x: 0.58, y: 0.76, radius: 0.048 }, { x: 0.62, y: 0.84, radius: 0.038 }, { x: 0.64, y: 0.92, radius: 0.034 }, { x: 0.66, y: 0.98, radius: 0.030 },
    ]},
  ],
};

function drawBugbearRedux(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const sk = BUGBEAR_SKELETON;
  const snout = sk.spine.find(n => n.id === 'snout')!;
  const head = sk.spine.find(n => n.id === 'head')!;
  const chest = sk.spine.find(n => n.id === 'chest')!;
  const belly = sk.spine.find(n => n.id === 'belly')!;
  const furDark = [52, 34, 22];
  const furMid = [78, 52, 34];
  const furLight = [108, 76, 48];
  const furShadow = [30, 18, 12];
  const skinPink = [120, 68, 58];
  const metalMid = [98, 108, 112];
  const metalDark = [68, 78, 82];
  const metalLight = [148, 158, 162];
  const eyeOuter = [220, 160, 30];
  const eyeCore = [255, 230, 100];
  const clawColor = [160, 148, 130];

  const furDir = (fx: number, fy: number) => Math.atan2(fy - h * chest.y, fx - w * chest.x) + Math.PI * 0.15;

  for (const limb of sk.limbs) {
    if (limb.side === 'far') drawSkeletonLimbChain(ctx, limb.segments, w, h, `rgb(${furShadow.join(',')})`);
  }

  ctx.strokeStyle = 'rgb(58,42,28)';
  ctx.lineCap = 'round';
  ctx.lineWidth = w * 0.018;
  ctx.beginPath();
  ctx.moveTo(w * 0.20, h * 0.76);
  ctx.lineTo(w * 0.16, h * 0.92);
  ctx.stroke();
  ctx.fillStyle = bodyGrad3(ctx, w * 0.16, h * 0.94, w * 0.045, metalMid[0], metalMid[1], metalMid[2], metalDark[0], metalDark[1], metalDark[2], metalLight[0], metalLight[1], metalLight[2]);
  fillCircle(ctx, w * 0.16, h * 0.94, w * 0.036);
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2 + 0.3;
    const bx = w * 0.16 + Math.cos(angle) * w * 0.034;
    const by = h * 0.94 + Math.sin(angle) * w * 0.034;
    const tx = w * 0.16 + Math.cos(angle) * w * 0.056;
    const ty = h * 0.94 + Math.sin(angle) * w * 0.056;
    ctx.fillStyle = `rgb(${metalLight.join(',')})`;
    ctx.beginPath();
    ctx.moveTo(bx, by);
    ctx.lineTo(tx, ty);
    ctx.lineTo(bx + 2, by + 2);
    ctx.fill();
  }

  drawSkeletonBodyOutline(ctx, sk.spine, w, h, bodyGrad3(
    ctx, w * chest.x, h * chest.y, w * 0.28,
    furMid[0], furMid[1], furMid[2],
    furShadow[0], furShadow[1], furShadow[2],
    furLight[0], furLight[1], furLight[2],
  ));
  furTextureDirectional(ctx, w * 0.24, h * 0.16, w * 0.38, h * 0.58, w * 0.022, `rgb(${furShadow.join(',')})`, `rgb(${furLight.join(',')})`, 140, furDir);

  const pauldronX = chest.x - 0.06; const pauldronY = chest.y - 0.10;
  ctx.fillStyle = bodyGrad3(ctx, w * pauldronX, h * pauldronY, w * 0.09, metalMid[0], metalMid[1], metalMid[2], metalDark[0], metalDark[1], metalDark[2], metalLight[0], metalLight[1], metalLight[2]);
  fillEllipse(ctx, w * pauldronX, h * pauldronY, w * 0.08, h * 0.06);

  for (const limb of sk.limbs) {
    if (limb.side === 'near') drawSkeletonLimbChain(ctx, limb.segments, w, h, `rgb(${furDark.join(',')})`);
  }

  const hx = head.x; const hy = head.y; const hr = head.radius;
  ctx.fillStyle = bodyGrad3(ctx, w * hx, h * hy, w * hr * 2.5,
    furMid[0], furMid[1], furMid[2], furShadow[0], furShadow[1], furShadow[2], furLight[0], furLight[1], furLight[2]);
  fillEllipse(ctx, w * hx, h * hy, w * hr * 1.5, h * hr * 1.3);
  const sx = snout.x; const sy = snout.y;
  ctx.fillStyle = bodyGrad3(ctx, w * sx, h * (sy + 0.02), w * 0.08, skinPink[0], skinPink[1], skinPink[2], furDark[0], furDark[1], furDark[2], furMid[0], furMid[1], furMid[2]);
  fillEllipse(ctx, w * (sx - 0.02), h * (sy + 0.03), w * 0.080, h * 0.060);
  ctx.fillStyle = 'rgb(18,12,10)';
  fillEllipse(ctx, w * (sx - 0.06), h * (sy + 0.005), w * 0.022, w * 0.018);
  ctx.fillStyle = `rgb(${eyeOuter.join(',')})`;
  fillCircle(ctx, w * (hx - 0.04), h * (hy + 0.005), w * 0.022);
  ctx.fillStyle = `rgb(${eyeCore.join(',')})`;
  fillCircle(ctx, w * (hx - 0.04), h * (hy + 0.005), w * 0.014);

  for (const limb of sk.limbs) {
    const foot = limb.segments[limb.segments.length - 1];
    if (foot.y < 0.92) continue;
    ctx.fillStyle = limb.side === 'near' ? `rgb(${furDark.join(',')})` : `rgb(${furShadow.join(',')})`;
    fillEllipse(ctx, w * foot.x, h * foot.y, w * (foot.radius + 0.010), h * 0.016);
    ctx.fillStyle = `rgb(${clawColor.join(',')})`;
    for (let c = -1; c <= 1; c++) {
      const cx = w * foot.x + c * w * 0.010;
      const cy = h * foot.y + h * 0.008;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx - w * 0.004, cy + h * 0.028);
      ctx.lineTo(cx + w * 0.004, cy + h * 0.018);
      ctx.fill();
    }
  }
}

const CARRION_CRAWLER_SKELETON: Skeleton = {
  spine: [
    { id: 'snout', x: 0.80, y: 0.25, radius: 0.050 },
    { id: 'head', x: 0.72, y: 0.23, radius: 0.100 },
    { id: 'neck', x: 0.66, y: 0.34, radius: 0.116 },
    { id: 'chest', x: 0.58, y: 0.46, radius: 0.134 },
    { id: 'mid', x: 0.47, y: 0.58, radius: 0.148 },
    { id: 'rump', x: 0.35, y: 0.69, radius: 0.156 },
    { id: 'tail', x: 0.24, y: 0.79, radius: 0.144 },
  ],
  limbs: [
    { attach: 'tail', side: 'far', segments: [
      { x: 0.22, y: 0.84, radius: 0.026 }, { x: 0.19, y: 0.89, radius: 0.016 }, { x: 0.18, y: 0.93, radius: 0.010 },
    ]},
    { attach: 'rump', side: 'far', segments: [
      { x: 0.34, y: 0.79, radius: 0.028 }, { x: 0.34, y: 0.86, radius: 0.017 }, { x: 0.35, y: 0.91, radius: 0.010 },
    ]},
    { attach: 'mid', side: 'far', segments: [
      { x: 0.45, y: 0.70, radius: 0.026 }, { x: 0.48, y: 0.78, radius: 0.016 }, { x: 0.50, y: 0.86, radius: 0.010 },
    ]},
    { attach: 'chest', side: 'far', segments: [
      { x: 0.56, y: 0.60, radius: 0.024 }, { x: 0.61, y: 0.69, radius: 0.015 }, { x: 0.64, y: 0.79, radius: 0.010 },
    ]},
    { attach: 'tail', side: 'near', segments: [
      { x: 0.29, y: 0.82, radius: 0.030 }, { x: 0.30, y: 0.89, radius: 0.018 }, { x: 0.31, y: 0.93, radius: 0.011 },
    ]},
    { attach: 'rump', side: 'near', segments: [
      { x: 0.42, y: 0.78, radius: 0.032 }, { x: 0.47, y: 0.86, radius: 0.018 }, { x: 0.50, y: 0.92, radius: 0.011 },
    ]},
    { attach: 'mid', side: 'near', segments: [
      { x: 0.53, y: 0.68, radius: 0.030 }, { x: 0.58, y: 0.78, radius: 0.017 }, { x: 0.61, y: 0.87, radius: 0.011 },
    ]},
    { attach: 'chest', side: 'near', segments: [
      { x: 0.63, y: 0.58, radius: 0.028 }, { x: 0.69, y: 0.67, radius: 0.016 }, { x: 0.74, y: 0.79, radius: 0.010 },
    ]},
  ],
  tail: { points: [], startWidth: 0, endWidth: 0 },
};

function drawCarrionCrawlerPlateRedux(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  x: number,
  y: number,
  rx: number,
  ry: number,
  shellMid: number[],
  shellDark: number[],
  shellHi: number[],
) {
  ctx.fillStyle = bodyGrad3(
    ctx,
    w * x,
    h * (y - ry * 0.25),
    w * rx * 1.2,
    shellMid[0], shellMid[1], shellMid[2],
    shellDark[0], shellDark[1], shellDark[2],
    shellHi[0], shellHi[1], shellHi[2],
  );
  ctx.beginPath();
  ctx.moveTo(w * (x - rx * 0.92), h * (y + ry * 0.18));
  ctx.bezierCurveTo(w * (x - rx * 0.84), h * (y - ry * 0.74), w * (x - rx * 0.16), h * (y - ry * 1.18), w * (x + rx * 0.42), h * (y - ry * 0.88));
  ctx.bezierCurveTo(w * (x + rx * 0.92), h * (y - ry * 0.50), w * (x + rx * 0.96), h * (y + ry * 0.10), w * (x + rx * 0.46), h * (y + ry * 0.28));
  ctx.bezierCurveTo(w * (x + rx * 0.04), h * (y + ry * 0.42), w * (x - rx * 0.54), h * (y + ry * 0.42), w * (x - rx * 0.92), h * (y + ry * 0.18));
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = rgba(shellDark, 0.45);
  ctx.lineWidth = Math.max(1, w * 0.004);
  ctx.stroke();

  ctx.strokeStyle = rgba(shellHi, 0.35);
  ctx.lineWidth = Math.max(1, w * 0.0025);
  ctx.beginPath();
  ctx.moveTo(w * (x - rx * 0.58), h * (y - ry * 0.08));
  ctx.quadraticCurveTo(w * (x - rx * 0.04), h * (y - ry * 0.72), w * (x + rx * 0.46), h * (y - ry * 0.18));
  ctx.stroke();
}

function drawCarrionCrawlerFootClawsRedux(
  ctx: CanvasRenderingContext2D,
  foot: LimbSegment,
  w: number,
  h: number,
  clawColor: number[],
  lift = 1,
) {
  ctx.fillStyle = rgb(clawColor);
  for (let i = -1; i <= 1; i++) {
    const cx = w * foot.x + i * w * 0.010;
    const cy = h * foot.y - h * 0.006 * lift;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx - w * 0.006, cy + h * 0.028);
    ctx.lineTo(cx + w * 0.004, cy + h * 0.018);
    ctx.closePath();
    ctx.fill();
  }
}

function drawCarrionCrawlerMandibleRedux(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  originX: number,
  originY: number,
  side: number,
  hookDark: number[],
  hookLight: number[],
) {
  ctx.fillStyle = bodyGrad3(
    ctx,
    w * (originX + side * 0.012),
    h * (originY + 0.02),
    w * 0.10,
    hookLight[0], hookLight[1], hookLight[2],
    hookDark[0], hookDark[1], hookDark[2],
    194, 198, 204,
  );
  ctx.beginPath();
  ctx.moveTo(w * originX, h * originY);
  ctx.quadraticCurveTo(w * (originX + side * 0.14), h * (originY + 0.02), w * (originX + side * 0.18), h * (originY + 0.13));
  ctx.quadraticCurveTo(w * (originX + side * 0.09), h * (originY + 0.09), w * (originX + side * 0.03), h * (originY + 0.03));
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = rgba(hookLight, 0.35);
  ctx.lineWidth = Math.max(1, w * 0.003);
  ctx.beginPath();
  ctx.moveTo(w * (originX + side * 0.03), h * (originY + 0.02));
  ctx.quadraticCurveTo(w * (originX + side * 0.12), h * (originY + 0.03), w * (originX + side * 0.15), h * (originY + 0.10));
  ctx.stroke();
}

function drawCarrionCrawlerTentacleRedux(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  startX: number,
  startY: number,
  c1x: number,
  c1y: number,
  endX: number,
  endY: number,
  width: number,
  tentacleDark: number[],
  tentacleLight: number[],
  tipColor: number[],
) {
  ctx.strokeStyle = rgb(tentacleDark);
  ctx.lineWidth = w * width;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(w * startX, h * startY);
  ctx.bezierCurveTo(w * c1x, h * c1y, w * (endX * 0.7 + c1x * 0.3), h * (endY * 0.7 + c1y * 0.3), w * endX, h * endY);
  ctx.stroke();

  ctx.strokeStyle = rgba(tentacleLight, 0.35);
  ctx.lineWidth = Math.max(1, w * width * 0.32);
  ctx.beginPath();
  ctx.moveTo(w * (startX + 0.004), h * (startY - 0.004));
  ctx.bezierCurveTo(
    w * (c1x + 0.004),
    h * (c1y - 0.004),
    w * (endX * 0.7 + c1x * 0.3 + 0.004),
    h * (endY * 0.7 + c1y * 0.3 - 0.004),
    w * (endX + 0.004),
    h * (endY - 0.004),
  );
  ctx.stroke();

  const dx = endX - c1x;
  const dy = endY - c1y;
  const len = Math.hypot(dx, dy) || 1;
  const nx = dx / len;
  const ny = dy / len;
  const px = -ny;
  const py = nx;

  ctx.fillStyle = rgb(tipColor);
  ctx.beginPath();
  ctx.moveTo(w * (endX + nx * 0.012), h * (endY + ny * 0.012));
  ctx.lineTo(w * (endX - nx * 0.006 + px * 0.018), h * (endY - ny * 0.006 + py * 0.018));
  ctx.lineTo(w * (endX - nx * 0.010), h * (endY - ny * 0.014));
  ctx.lineTo(w * (endX - nx * 0.006 - px * 0.018), h * (endY - ny * 0.006 - py * 0.018));
  ctx.closePath();
  ctx.fill();
}

function drawCarrionCrawlerRedux(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.save();
  ctx.translate(w, 0);
  ctx.scale(-1, 1);

  const sk = CARRION_CRAWLER_SKELETON;
  const shellDark = [20, 32, 16];
  const shellMid = [40, 66, 30];
  const shellLight = [72, 106, 52];
  const shellHi = [108, 144, 80];
  const bellyBase = [172, 136, 112];
  const bellyLight = [204, 178, 148];
  const bellyShadow = [96, 64, 50];
  const mawDark = [16, 10, 8];
  const hookDark = [70, 72, 76];
  const hookLight = [134, 138, 146];
  const tentacleDark = [78, 110, 58];
  const tentacleLight = [132, 172, 96];
  const tentacleTip = [158, 88, 70];
  const eyeStem = [106, 138, 78];
  const eyeOuter = [214, 226, 186];
  const eyeCore = [22, 18, 12];
  const teethColor = [236, 224, 194];
  const clawColor = [186, 166, 140];

  const head = sk.spine.find((node) => node.id === 'head')!;
  const neck = sk.spine.find((node) => node.id === 'neck')!;
  const chest = sk.spine.find((node) => node.id === 'chest')!;
  const mid = sk.spine.find((node) => node.id === 'mid')!;
  const rump = sk.spine.find((node) => node.id === 'rump')!;
  const tail = sk.spine.find((node) => node.id === 'tail')!;

  ambientOcclusion(ctx, w * 0.50, h * 0.92, w * 0.36, h * 0.05, 0.34);
  ambientOcclusion(ctx, w * 0.68, h * 0.66, w * 0.16, h * 0.03, 0.22);

  for (const limb of sk.limbs) {
    if (limb.side === 'far') {
      drawSkeletonLimbChain(ctx, limb.segments, w, h, rgb([28, 44, 20]));
    }
  }

  drawSkeletonBodyOutline(
    ctx,
    sk.spine,
    w,
    h,
    bodyGrad3(
      ctx,
      w * mid.x,
      h * mid.y,
      w * 0.36,
      shellMid[0], shellMid[1], shellMid[2],
      shellDark[0], shellDark[1], shellDark[2],
      shellLight[0], shellLight[1], shellLight[2],
    ),
  );

  for (const node of [tail, rump, mid, chest, neck, head]) {
    ctx.fillStyle = bodyGrad3(
      ctx,
      w * node.x,
      h * (node.y - 0.01),
      w * node.radius * 1.3,
      shellMid[0], shellMid[1], shellMid[2],
      shellDark[0], shellDark[1], shellDark[2],
      shellLight[0], shellLight[1], shellLight[2],
    );
    fillEllipse(ctx, w * node.x, h * node.y, w * node.radius * 1.05, h * node.radius * 0.88);
  }

  const bellyPlates = [
    { x: 0.28, y: 0.86, rx: 0.075, ry: 0.050 },
    { x: 0.39, y: 0.75, rx: 0.078, ry: 0.052 },
    { x: 0.50, y: 0.63, rx: 0.078, ry: 0.052 },
    { x: 0.61, y: 0.51, rx: 0.072, ry: 0.048 },
    { x: 0.70, y: 0.38, rx: 0.060, ry: 0.044 },
  ];
  for (const plate of bellyPlates) {
    ctx.fillStyle = bodyGrad3(
      ctx,
      w * plate.x,
      h * plate.y,
      w * plate.rx * 1.2,
      bellyBase[0], bellyBase[1], bellyBase[2],
      bellyShadow[0], bellyShadow[1], bellyShadow[2],
      bellyLight[0], bellyLight[1], bellyLight[2],
    );
    fillEllipse(ctx, w * plate.x, h * plate.y, w * plate.rx, h * plate.ry);
    ctx.strokeStyle = rgba(bellyShadow, 0.34);
    ctx.lineWidth = Math.max(1, w * 0.003);
    ctx.beginPath();
    ctx.moveTo(w * (plate.x - plate.rx * 0.72), h * plate.y);
    ctx.quadraticCurveTo(w * plate.x, h * (plate.y + plate.ry * 0.46), w * (plate.x + plate.rx * 0.72), h * plate.y);
    ctx.stroke();
  }

  for (const plate of [
    { x: 0.25, y: 0.72, rx: 0.115, ry: 0.130 },
    { x: 0.37, y: 0.61, rx: 0.118, ry: 0.135 },
    { x: 0.49, y: 0.49, rx: 0.115, ry: 0.130 },
    { x: 0.61, y: 0.36, rx: 0.100, ry: 0.112 },
    { x: 0.70, y: 0.24, rx: 0.082, ry: 0.094 },
  ]) {
    drawCarrionCrawlerPlateRedux(ctx, w, h, plate.x, plate.y, plate.rx, plate.ry, shellLight, shellDark, shellHi);
  }

  ctx.strokeStyle = rgba(shellHi, 0.18);
  ctx.lineWidth = Math.max(1, w * 0.004);
  for (const ridge of [0.34, 0.46, 0.58, 0.68]) {
    ctx.beginPath();
    ctx.moveTo(w * (ridge - 0.03), h * (0.84 - ridge * 0.46));
    ctx.quadraticCurveTo(w * ridge, h * (0.72 - ridge * 0.44), w * (ridge + 0.05), h * (0.78 - ridge * 0.58));
    ctx.stroke();
  }

  ctx.fillStyle = bodyGrad3(
    ctx,
    w * head.x,
    h * (head.y - 0.02),
    w * 0.16,
    shellLight[0], shellLight[1], shellLight[2],
    shellDark[0], shellDark[1], shellDark[2],
    shellHi[0], shellHi[1], shellHi[2],
  );
  ctx.beginPath();
  ctx.moveTo(w * 0.64, h * 0.18);
  ctx.bezierCurveTo(w * 0.66, h * 0.08, w * 0.78, h * 0.09, w * 0.84, h * 0.18);
  ctx.bezierCurveTo(w * 0.86, h * 0.26, w * 0.82, h * 0.32, w * 0.74, h * 0.34);
  ctx.bezierCurveTo(w * 0.66, h * 0.31, w * 0.62, h * 0.24, w * 0.64, h * 0.18);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = rgb(mawDark);
  fillEllipse(ctx, w * 0.79, h * 0.32, w * 0.13, h * 0.058);
  ctx.fillStyle = rgba([120, 32, 22], 0.45);
  fillEllipse(ctx, w * 0.79, h * 0.325, w * 0.088, h * 0.026);

  ctx.fillStyle = rgb(teethColor);
  for (let i = 0; i < 9; i++) {
    const x = 0.70 + i * 0.018;
    const topSize = i % 2 === 0 ? 0.030 : 0.022;
    ctx.beginPath();
    ctx.moveTo(w * x, h * 0.278);
    ctx.lineTo(w * (x + 0.009), h * (0.278 + topSize));
    ctx.lineTo(w * (x + 0.018), h * 0.279);
    ctx.closePath();
    ctx.fill();
  }
  for (let i = 0; i < 9; i++) {
    const x = 0.70 + i * 0.018;
    const botSize = i % 2 === 0 ? 0.026 : 0.018;
    ctx.beginPath();
    ctx.moveTo(w * (x + 0.003), h * 0.362);
    ctx.lineTo(w * (x + 0.011), h * (0.362 - botSize));
    ctx.lineTo(w * (x + 0.019), h * 0.362);
    ctx.closePath();
    ctx.fill();
  }

  drawCarrionCrawlerMandibleRedux(ctx, w, h, 0.74, 0.27, -1, hookDark, hookLight);
  drawCarrionCrawlerMandibleRedux(ctx, w, h, 0.84, 0.27, 1, hookDark, hookLight);

  drawCarrionCrawlerTentacleRedux(ctx, w, h, 0.71, 0.31, 0.63, 0.25, 0.57, 0.19, 0.014, tentacleDark, tentacleLight, tentacleTip);
  drawCarrionCrawlerTentacleRedux(ctx, w, h, 0.73, 0.34, 0.64, 0.38, 0.60, 0.42, 0.013, tentacleDark, tentacleLight, tentacleTip);
  drawCarrionCrawlerTentacleRedux(ctx, w, h, 0.76, 0.36, 0.72, 0.41, 0.71, 0.44, 0.011, tentacleDark, tentacleLight, tentacleTip);
  drawCarrionCrawlerTentacleRedux(ctx, w, h, 0.82, 0.36, 0.86, 0.41, 0.89, 0.44, 0.011, tentacleDark, tentacleLight, tentacleTip);
  drawCarrionCrawlerTentacleRedux(ctx, w, h, 0.85, 0.31, 0.91, 0.27, 0.95, 0.22, 0.012, tentacleDark, tentacleLight, tentacleTip);
  drawCarrionCrawlerTentacleRedux(ctx, w, h, 0.79, 0.37, 0.80, 0.41, 0.80, 0.45, 0.010, tentacleDark, tentacleLight, tentacleTip);

  for (const eye of [
    { sx: 0.73, sy: 0.16, ex: 0.70, ey: 0.10 },
    { sx: 0.79, sy: 0.17, ex: 0.82, ey: 0.11 },
  ]) {
    ctx.strokeStyle = rgb(eyeStem);
    ctx.lineWidth = w * 0.010;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(w * eye.sx, h * eye.sy);
    ctx.quadraticCurveTo(w * ((eye.sx + eye.ex) / 2), h * (eye.sy - 0.03), w * eye.ex, h * eye.ey);
    ctx.stroke();
    ctx.fillStyle = rgb(eyeOuter);
    fillCircle(ctx, w * eye.ex, h * eye.ey, w * 0.018);
    ctx.fillStyle = rgb(eyeCore);
    fillCircle(ctx, w * eye.ex, h * eye.ey, w * 0.008);
    ctx.fillStyle = 'rgb(248,248,240)';
    fillCircle(ctx, w * (eye.ex - 0.004), h * (eye.ey - 0.004), w * 0.0035);
  }

  for (const limb of sk.limbs) {
    if (limb.side === 'near') {
      drawSkeletonLimbChain(ctx, limb.segments, w, h, rgb([48, 74, 34]));
    }
  }

  for (const limb of sk.limbs) {
    const foot = limb.segments[limb.segments.length - 1];
    drawCarrionCrawlerFootClawsRedux(ctx, foot, w, h, clawColor, limb.side === 'near' ? 1 : 0.8);
  }

  highlight(ctx, w * 0.44, h * 0.48, w * 0.09, rgba(shellHi, 0.22), 0.28);
  highlight(ctx, w * 0.69, h * 0.20, w * 0.07, rgba(shellHi, 0.28), 0.28);
  ambientOcclusion(ctx, w * 0.55, h * 0.66, w * 0.16, h * 0.04, 0.28);
  ambientOcclusion(ctx, w * 0.78, h * 0.36, w * 0.10, h * 0.03, 0.20);

  ctx.restore();
}

function drawCavernBruteRedux(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.fillStyle = bodyGrad(ctx, w * 0.44, h * 0.40, w * 0.28, 178, 152, 120, 82, 64, 44);
  ctx.beginPath();
  ctx.moveTo(w * 0.22, h * 0.18);
  ctx.bezierCurveTo(w * 0.12, h * 0.26, w * 0.12, h * 0.52, w * 0.20, h * 0.66);
  ctx.bezierCurveTo(w * 0.34, h * 0.76, w * 0.56, h * 0.76, w * 0.68, h * 0.64);
  ctx.bezierCurveTo(w * 0.72, h * 0.48, w * 0.70, h * 0.26, w * 0.56, h * 0.16);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = bodyGrad(ctx, w * 0.28, h * 0.12, w * 0.10, 126, 104, 78, 60, 44, 30);
  fillEllipse(ctx, w * 0.30, h * 0.12, w * 0.10, h * 0.08);
  ctx.fillStyle = 'rgb(252,206,96)';
  fillCircle(ctx, w * 0.27, h * 0.10, w * 0.012);
  fillCircle(ctx, w * 0.34, h * 0.10, w * 0.012);
  drawLimb(ctx, w * 0.22, h * 0.30, w * 0.08, h * 0.46, w * 0.12, h * 0.82, w * 0.030, 'rgb(120,98,72)');
  drawLimb(ctx, w * 0.64, h * 0.28, w * 0.74, h * 0.44, w * 0.68, h * 0.82, w * 0.026, 'rgb(104,82,60)');
  fillEllipse(ctx, w * 0.13, h * 0.83, w * 0.06, h * 0.05);
  fillEllipse(ctx, w * 0.69, h * 0.83, w * 0.05, h * 0.04);
  fillEllipse(ctx, w * 0.34, h * 0.84, w * 0.07, h * 0.11);
  fillEllipse(ctx, w * 0.52, h * 0.84, w * 0.07, h * 0.11);
  stoneTexture(ctx, w * 0.18, h * 0.22, w * 0.48, h * 0.42, 18, 'rgb(64,50,34)', 'rgba(224,204,172,0.24)');
  highlight(ctx, w * 0.38, h * 0.28, w * 0.06, 'rgb(210,184,152)', 0.12);
}

function drawCrystalElementalRedux(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const grad = ctx.createLinearGradient(w * 0.24, h * 0.10, w * 0.64, h * 0.80);
  grad.addColorStop(0, 'rgb(220,248,255)');
  grad.addColorStop(0.35, 'rgb(130,210,240)');
  grad.addColorStop(0.7, 'rgb(60,140,180)');
  grad.addColorStop(1, 'rgb(18,60,88)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(w * 0.42, h * 0.05);
  ctx.lineTo(w * 0.60, h * 0.20);
  ctx.lineTo(w * 0.64, h * 0.46);
  ctx.lineTo(w * 0.54, h * 0.74);
  ctx.lineTo(w * 0.42, h * 0.86);
  ctx.lineTo(w * 0.28, h * 0.72);
  ctx.lineTo(w * 0.22, h * 0.42);
  ctx.lineTo(w * 0.29, h * 0.18);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(178,236,255,0.65)';
  ctx.lineWidth = w * 0.006;
  ctx.beginPath();
  ctx.moveTo(w * 0.42, h * 0.05); ctx.lineTo(w * 0.44, h * 0.44); ctx.lineTo(w * 0.42, h * 0.86);
  ctx.moveTo(w * 0.29, h * 0.18); ctx.lineTo(w * 0.44, h * 0.44); ctx.lineTo(w * 0.64, h * 0.46);
  ctx.moveTo(w * 0.22, h * 0.42); ctx.lineTo(w * 0.44, h * 0.44); ctx.lineTo(w * 0.60, h * 0.20);
  ctx.stroke();
  highlight(ctx, w * 0.44, h * 0.40, w * 0.09, 'rgb(232,252,255)', 0.30);
  fillCircle(ctx, w * 0.44, h * 0.34, w * 0.02);
}

function drawIronhideTrollRedux(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.fillStyle = bodyGrad(ctx, w * 0.42, h * 0.38, w * 0.28, 128, 184, 96, 50, 82, 34);
  ctx.beginPath();
  ctx.moveTo(w * 0.28, h * 0.14);
  ctx.bezierCurveTo(w * 0.14, h * 0.20, w * 0.12, h * 0.44, w * 0.18, h * 0.62);
  ctx.bezierCurveTo(w * 0.28, h * 0.72, w * 0.54, h * 0.72, w * 0.66, h * 0.58);
  ctx.bezierCurveTo(w * 0.68, h * 0.34, w * 0.60, h * 0.18, w * 0.48, h * 0.12);
  ctx.closePath();
  ctx.fill();
  fillEllipse(ctx, w * 0.44, h * 0.16, w * 0.18, h * 0.10);
  fillEllipse(ctx, w * 0.24, h * 0.10, w * 0.08, h * 0.07);
  ctx.fillStyle = 'rgb(252,210,98)';
  fillCircle(ctx, w * 0.20, h * 0.09, w * 0.010);
  fillCircle(ctx, w * 0.26, h * 0.09, w * 0.010);
  drawLimb(ctx, w * 0.18, h * 0.28, w * 0.08, h * 0.48, w * 0.11, h * 0.80, w * 0.028, 'rgb(92,142,66)');
  drawLimb(ctx, w * 0.60, h * 0.28, w * 0.72, h * 0.44, w * 0.69, h * 0.76, w * 0.023, 'rgb(78,124,58)');
  fillEllipse(ctx, w * 0.32, h * 0.82, w * 0.07, h * 0.12);
  fillEllipse(ctx, w * 0.52, h * 0.82, w * 0.07, h * 0.12);
  furTexture(ctx, w * 0.18, h * 0.18, w * 0.44, h * 0.36, 50, 'rgb(40,62,26)', 'rgb(132,186,96)', 0.4);
  stoneTexture(ctx, w * 0.26, h * 0.10, w * 0.32, h * 0.16, 10, 'rgb(42,72,30)', 'rgba(170,214,134,0.18)');
}

function drawPhaseSpiderRedux(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const far = 'rgb(92,74,148)';
  const near = 'rgb(148,128,214)';
  const farLegs = [[0.44,0.40,0.58,0.22,0.72,0.08],[0.50,0.42,0.64,0.30,0.78,0.18],[0.52,0.48,0.64,0.58,0.76,0.74],[0.48,0.52,0.58,0.68,0.68,0.86]] as [number,number,number,number,number,number][];
  for (const [x0,y0,cx,cy,x1,y1] of farLegs) drawLimb(ctx, w*x0,h*y0,w*cx,h*cy,w*x1,h*y1,w*0.012,far);
  ctx.fillStyle = bodyGrad(ctx, w * 0.58, h * 0.46, w * 0.20, 138, 110, 212, 50, 34, 82);
  fillEllipse(ctx, w * 0.58, h * 0.46, w * 0.20, h * 0.18);
  ctx.fillStyle = bodyGrad(ctx, w * 0.32, h * 0.42, w * 0.12, 152, 128, 224, 62, 42, 96);
  fillEllipse(ctx, w * 0.32, h * 0.42, w * 0.12, h * 0.09);
  scaleTexture(ctx, w * 0.45, h * 0.32, w * 0.28, h * 0.26, w * 0.020, 'rgba(42,24,76,0.5)', 'rgba(210,184,255,0.22)', 0.8);
  ctx.fillStyle = 'rgb(210,48,42)';
  ctx.beginPath();
  ctx.moveTo(w * 0.60, h * 0.34); ctx.lineTo(w * 0.64, h * 0.44); ctx.lineTo(w * 0.60, h * 0.56); ctx.lineTo(w * 0.56, h * 0.44); ctx.closePath();
  ctx.fill();
  for (const [x,y,r] of [[0.14,0.36,0.008],[0.17,0.34,0.010],[0.20,0.36,0.008],[0.15,0.39,0.007],[0.18,0.39,0.007],[0.21,0.39,0.006]] as [number,number,number][]) {
    ctx.fillStyle = 'rgb(170,255,168)';
    fillCircle(ctx, w * x, h * y, w * r);
  }
  const nearLegs = [[0.28,0.48,0.16,0.28,0.06,0.12],[0.32,0.50,0.18,0.40,0.08,0.30],[0.40,0.56,0.28,0.70,0.18,0.84],[0.46,0.58,0.42,0.74,0.38,0.92]] as [number,number,number,number,number,number][];
  for (const [x0,y0,cx,cy,x1,y1] of nearLegs) drawLimb(ctx, w*x0,h*y0,w*cx,h*cy,w*x1,h*y1,w*0.015,near);
}

function drawBonecasterRedux(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.fillStyle = bodyGrad(ctx, w * 0.38, h * 0.58, w * 0.20, 88, 62, 52, 26, 18, 14);
  ctx.beginPath();
  ctx.moveTo(w * 0.30, h * 0.28);
  ctx.bezierCurveTo(w * 0.22, h * 0.40, w * 0.18, h * 0.68, w * 0.16, h * 0.96);
  ctx.lineTo(w * 0.28, h * 0.94); ctx.lineTo(w * 0.36, h * 0.98); ctx.lineTo(w * 0.46, h * 0.92); ctx.lineTo(w * 0.56, h * 0.98); ctx.lineTo(w * 0.62, h * 0.90);
  ctx.bezierCurveTo(w * 0.61, h * 0.68, w * 0.58, h * 0.44, w * 0.52, h * 0.32);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = bodyGrad(ctx, w * 0.36, h * 0.18, w * 0.12, 74, 50, 40, 24, 18, 14);
  fillEllipse(ctx, w * 0.36, h * 0.18, w * 0.12, h * 0.12);
  ctx.fillStyle = 'rgb(224,212,182)';
  fillCircle(ctx, w * 0.32, h * 0.16, w * 0.018);
  fillCircle(ctx, w * 0.40, h * 0.16, w * 0.018);
  ctx.fillStyle = 'rgb(18,18,18)';
  fillCircle(ctx, w * 0.32, h * 0.16, w * 0.010);
  fillCircle(ctx, w * 0.40, h * 0.16, w * 0.010);
  highlight(ctx, w * 0.32, h * 0.16, w * 0.03, 'rgb(120,255,82)', 0.22);
  highlight(ctx, w * 0.40, h * 0.16, w * 0.03, 'rgb(120,255,82)', 0.22);
  ctx.strokeStyle = 'rgb(190,180,152)';
  ctx.lineWidth = w * 0.034;
  ctx.beginPath();
  ctx.moveTo(w * 0.72, h * 0.06); ctx.bezierCurveTo(w * 0.70, h * 0.34, w * 0.68, h * 0.62, w * 0.66, h * 0.92);
  ctx.stroke();
  drawLimb(ctx, w * 0.46, h * 0.40, w * 0.56, h * 0.42, w * 0.66, h * 0.40, w * 0.010, 'rgb(196,186,156)');
}

function drawRockGolemRedux(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.fillStyle = bodyGrad(ctx, w * 0.42, h * 0.38, w * 0.28, 194, 188, 168, 74, 68, 58);
  ctx.beginPath();
  ctx.moveTo(w * 0.22, h * 0.12); ctx.lineTo(w * 0.62, h * 0.12); ctx.lineTo(w * 0.70, h * 0.24); ctx.lineTo(w * 0.68, h * 0.60); ctx.lineTo(w * 0.58, h * 0.66); ctx.lineTo(w * 0.26, h * 0.66); ctx.lineTo(w * 0.16, h * 0.56); ctx.lineTo(w * 0.16, h * 0.22); ctx.closePath();
  ctx.fill();
  ctx.fillStyle = bodyGrad(ctx, w * 0.40, h * 0.06, w * 0.12, 202, 196, 178, 82, 76, 66);
  ctx.beginPath(); ctx.moveTo(w * 0.30, h * 0.12); ctx.lineTo(w * 0.28, h * 0.02); ctx.lineTo(w * 0.52, h * 0.02); ctx.lineTo(w * 0.56, h * 0.12); ctx.closePath(); ctx.fill();
  ctx.fillStyle = 'rgb(255,218,104)';
  ctx.fillRect(w * 0.34, h * 0.05, w * 0.05, h * 0.02); ctx.fillRect(w * 0.45, h * 0.05, w * 0.05, h * 0.02);
  ctx.fillStyle = 'rgb(132,126,110)';
  ctx.fillRect(w * 0.04, h * 0.22, w * 0.12, h * 0.50); ctx.fillRect(w * 0.68, h * 0.22, w * 0.10, h * 0.50);
  ctx.fillRect(w * 0.28, h * 0.66, w * 0.12, h * 0.24); ctx.fillRect(w * 0.46, h * 0.66, w * 0.12, h * 0.24);
  stoneTexture(ctx, w * 0.18, h * 0.14, w * 0.46, h * 0.48, 22, 'rgb(68,60,50)', 'rgba(236,226,206,0.18)');
  highlight(ctx, w * 0.40, h * 0.24, w * 0.06, 'rgb(226,220,204)', 0.14);
}

function drawPaleStalkerRedux(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.fillStyle = bodyGrad(ctx, w * 0.40, h * 0.40, w * 0.18, 206, 214, 232, 94, 102, 126);
  ctx.beginPath();
  ctx.moveTo(w * 0.30, h * 0.22); ctx.bezierCurveTo(w * 0.22, h * 0.28, w * 0.22, h * 0.48, w * 0.28, h * 0.58); ctx.bezierCurveTo(w * 0.38, h * 0.62, w * 0.48, h * 0.60, w * 0.54, h * 0.50); ctx.bezierCurveTo(w * 0.56, h * 0.36, w * 0.52, h * 0.26, w * 0.30, h * 0.22); ctx.fill();
  ctx.fillStyle = bodyGrad(ctx, w * 0.18, h * 0.20, w * 0.11, 222, 228, 242, 96, 104, 128);
  ctx.beginPath(); ctx.moveTo(w * 0.26, h * 0.18); ctx.bezierCurveTo(w * 0.18, h * 0.12, w * 0.08, h * 0.14, w * 0.04, h * 0.20); ctx.bezierCurveTo(w * 0.04, h * 0.26, w * 0.12, h * 0.28, w * 0.24, h * 0.26); ctx.closePath(); ctx.fill();
  ctx.fillStyle = 'rgb(188,236,255)'; fillCircle(ctx, w * 0.13, h * 0.18, w * 0.010); fillCircle(ctx, w * 0.20, h * 0.18, w * 0.010);
  drawLimb(ctx, w * 0.28, h * 0.40, w * 0.18, h * 0.56, w * 0.12, h * 0.76, w * 0.010, 'rgb(190,198,218)');
  drawLimb(ctx, w * 0.48, h * 0.40, w * 0.58, h * 0.56, w * 0.64, h * 0.74, w * 0.010, 'rgb(176,184,204)');
  drawLimb(ctx, w * 0.32, h * 0.58, w * 0.28, h * 0.68, w * 0.30, h * 0.92, w * 0.015, 'rgb(178,186,206)');
  drawLimb(ctx, w * 0.44, h * 0.58, w * 0.48, h * 0.70, w * 0.48, h * 0.92, w * 0.013, 'rgb(164,172,194)');
  ctx.strokeStyle = 'rgba(214,224,246,0.38)';
  ctx.lineWidth = w * 0.004;
  for (let i = 0; i < 5; i++) { const y = 0.32 + i * 0.05; ctx.beginPath(); ctx.moveTo(w * 0.30, h * y); ctx.quadraticCurveTo(w * 0.38, h * (y + 0.012), w * 0.48, h * y); ctx.stroke(); }
}

function drawDuskDrakeRedux(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.fillStyle = bodyGrad(ctx, w * 0.78, h * 0.56, w * 0.14, 98, 64, 118, 40, 24, 54);
  ctx.beginPath(); ctx.moveTo(w * 0.68, h * 0.50); ctx.bezierCurveTo(w * 0.84, h * 0.46, w * 0.96, h * 0.54, w * 1.00, h * 0.60); ctx.bezierCurveTo(w * 0.94, h * 0.66, w * 0.84, h * 0.62, w * 0.68, h * 0.58); ctx.closePath(); ctx.fill();
  ctx.fillStyle = bodyGrad(ctx, w * 0.48, h * 0.48, w * 0.22, 176, 110, 206, 58, 36, 82);
  ctx.beginPath(); ctx.moveTo(w * 0.32, h * 0.38); ctx.bezierCurveTo(w * 0.42, h * 0.30, w * 0.60, h * 0.32, w * 0.70, h * 0.40); ctx.bezierCurveTo(w * 0.74, h * 0.46, w * 0.74, h * 0.58, w * 0.66, h * 0.62); ctx.bezierCurveTo(w * 0.54, h * 0.68, w * 0.40, h * 0.66, w * 0.32, h * 0.58); ctx.closePath(); ctx.fill();
  ctx.fillStyle = bodyGrad(ctx, w * 0.30, h * 0.20, w * 0.22, 158, 92, 190, 48, 30, 68);
  ctx.beginPath(); ctx.moveTo(w * 0.40, h * 0.40); ctx.bezierCurveTo(w * 0.34, h * 0.24, w * 0.26, h * 0.12, w * 0.14, h * 0.02); ctx.bezierCurveTo(w * 0.18, h * 0.12, w * 0.22, h * 0.22, w * 0.22, h * 0.30); ctx.bezierCurveTo(w * 0.30, h * 0.24, w * 0.34, h * 0.28, w * 0.34, h * 0.36); ctx.closePath(); ctx.fill();
  ctx.fillStyle = 'rgb(100,62,126)';
  ctx.beginPath(); ctx.moveTo(w * 0.56, h * 0.38); ctx.bezierCurveTo(w * 0.58, h * 0.22, w * 0.64, h * 0.10, w * 0.72, h * 0.02); ctx.bezierCurveTo(w * 0.68, h * 0.14, w * 0.64, h * 0.22, w * 0.60, h * 0.30); ctx.closePath(); ctx.fill();
  ctx.fillStyle = bodyGrad(ctx, w * 0.16, h * 0.20, w * 0.10, 196, 132, 224, 62, 38, 86);
  ctx.beginPath(); ctx.moveTo(w * 0.18, h * 0.18); ctx.bezierCurveTo(w * 0.10, h * 0.14, w * 0.02, h * 0.16, w * 0.02, h * 0.22); ctx.bezierCurveTo(w * 0.08, h * 0.26, w * 0.16, h * 0.26, w * 0.22, h * 0.22); ctx.closePath(); ctx.fill();
  ctx.fillStyle = 'rgb(214,176,92)'; ctx.beginPath(); ctx.moveTo(w * 0.12, h * 0.16); ctx.lineTo(w * 0.18, h * 0.08); ctx.lineTo(w * 0.20, h * 0.14); ctx.closePath(); ctx.fill();
  fillCircle(ctx, w * 0.09, h * 0.19, w * 0.010);
  drawLimb(ctx, w * 0.40, h * 0.60, w * 0.36, h * 0.74, w * 0.34, h * 0.88, w * 0.016, 'rgb(106,64,122)');
  drawLimb(ctx, w * 0.58, h * 0.58, w * 0.60, h * 0.74, w * 0.58, h * 0.86, w * 0.015, 'rgb(92,56,108)');
  scaleTexture(ctx, w * 0.30, h * 0.34, w * 0.42, h * 0.26, w * 0.020, 'rgba(48,24,66,0.5)', 'rgba(212,152,240,0.18)', 0.72);
}

function drawBasiliskRedux(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.fillStyle = bodyGrad(ctx, w * 0.84, h * 0.42, w * 0.22, 118, 132, 90, 44, 50, 34);
  ctx.beginPath(); ctx.moveTo(w * 0.76, h * 0.48); ctx.bezierCurveTo(w * 0.88, h * 0.42, w * 0.96, h * 0.28, w * 1.02, h * 0.12); ctx.bezierCurveTo(w * 0.96, h * 0.22, w * 0.86, h * 0.34, w * 0.72, h * 0.44); ctx.closePath(); ctx.fill();
  ctx.fillStyle = bodyGrad(ctx, w * 0.52, h * 0.48, w * 0.34, 146, 158, 110, 50, 58, 38);
  ctx.beginPath(); ctx.moveTo(w * 0.24, h * 0.38); ctx.bezierCurveTo(w * 0.34, h * 0.24, w * 0.58, h * 0.22, w * 0.74, h * 0.34); ctx.bezierCurveTo(w * 0.80, h * 0.40, w * 0.80, h * 0.56, w * 0.72, h * 0.64); ctx.bezierCurveTo(w * 0.60, h * 0.76, w * 0.38, h * 0.77, w * 0.24, h * 0.65); ctx.bezierCurveTo(w * 0.18, h * 0.58, w * 0.18, h * 0.46, w * 0.24, h * 0.38); ctx.closePath(); ctx.fill();
  fillEllipse(ctx, w * 0.38, h * 0.42, w * 0.14, h * 0.13);
  fillEllipse(ctx, w * 0.66, h * 0.52, w * 0.14, h * 0.15);
  ctx.fillStyle = bodyGrad(ctx, w * 0.15, h * 0.42, w * 0.16, 156, 168, 120, 54, 60, 42);
  ctx.beginPath(); ctx.moveTo(w * 0.30, h * 0.42); ctx.bezierCurveTo(w * 0.24, h * 0.32, w * 0.14, h * 0.28, w * 0.08, h * 0.34); ctx.bezierCurveTo(w * 0.02, h * 0.40, w * 0.00, h * 0.49, w * 0.06, h * 0.56); ctx.bezierCurveTo(w * 0.14, h * 0.61, w * 0.24, h * 0.60, w * 0.28, h * 0.52); ctx.closePath(); ctx.fill();
  ctx.fillStyle = 'rgb(90,102,62)';
  for (const [x, hgt] of [[0.36,0.08],[0.42,0.11],[0.49,0.12],[0.56,0.11],[0.62,0.09]] as [number, number][]) {
    ctx.beginPath(); ctx.moveTo(w * (x - 0.02), h * 0.34); ctx.lineTo(w * x, h * (0.34 - hgt)); ctx.lineTo(w * (x + 0.02), h * 0.34); ctx.closePath(); ctx.fill();
  }
  ctx.fillStyle = 'rgb(168,255,112)'; fillEllipse(ctx, w * 0.13, h * 0.40, w * 0.016, h * 0.010); fillEllipse(ctx, w * 0.18, h * 0.38, w * 0.014, h * 0.010);
  ctx.strokeStyle = 'rgb(20,26,14)'; ctx.lineWidth = w * 0.004; ctx.beginPath(); ctx.moveTo(w * 0.13, h * 0.392); ctx.lineTo(w * 0.13, h * 0.408); ctx.moveTo(w * 0.18, h * 0.372); ctx.lineTo(w * 0.18, h * 0.388); ctx.stroke();
  ctx.fillStyle = 'rgb(212,198,152)'; for (const tx of [0.02,0.05,0.08]) { ctx.beginPath(); ctx.moveTo(w*tx,h*0.53); ctx.lineTo(w*(tx+0.01),h*0.58); ctx.lineTo(w*(tx+0.018),h*0.53); ctx.fill(); }
  scaleTexture(ctx, w * 0.24, h * 0.30, w * 0.50, h * 0.30, w * 0.022, 'rgba(56,66,40,0.48)', 'rgba(206,218,160,0.20)', 0.8);
  drawLimb(ctx, w * 0.36, h * 0.61, w * 0.34, h * 0.74, w * 0.30, h * 0.90, w * 0.018, 'rgb(108,116,78)');
  drawLimb(ctx, w * 0.48, h * 0.62, w * 0.49, h * 0.75, w * 0.47, h * 0.90, w * 0.017, 'rgb(100,108,72)');
  drawLimb(ctx, w * 0.64, h * 0.60, w * 0.66, h * 0.72, w * 0.64, h * 0.88, w * 0.019, 'rgb(92,100,66)');
  drawLimb(ctx, w * 0.73, h * 0.56, w * 0.76, h * 0.68, w * 0.75, h * 0.84, w * 0.018, 'rgb(84,92,60)');
  highlight(ctx, w * 0.40, h * 0.34, w * 0.06, 'rgb(214,224,166)', 0.16);
}

export const MONSTER_TEMPLATES_REDUX: MonsterTemplate[] = [
  // ── Zone 1: Dark Cave (Levels 1-12) ──
  { id: 'redux-dire-rat', name: 'Dire Rat', gridWidth: 10, gridHeight: 7, dynamic: true, monsterClass: 1, level: 1, atmosphere: { r: 140, g: 110, b: 70, intensity: 0.10 },
    draw: makeGLBDrawFn('/models/creatures/dire-rat.glb', 10, 7, drawDireRatRedux) },
  { id: 'redux-kobold', name: 'Kobold', gridWidth: 7, gridHeight: 7, dynamic: true, monsterClass: 2, level: 2, atmosphere: { r: 160, g: 120, b: 50, intensity: 0.10 },
    draw: makeGLBDrawFn('/models/creatures/kobold.glb', 7, 7, drawKoboldRedux) },
  { id: 'redux-goblin', name: 'Goblin', gridWidth: 7, gridHeight: 7, monsterClass: 0, level: 3, atmosphere: { r: 96, g: 120, b: 48, intensity: 0.10 }, draw: drawGoblinRedux },
  { id: 'redux-giant-spider', name: 'Giant Spider', gridWidth: 10, gridHeight: 12, monsterClass: 2, level: 4, atmosphere: { r: 72, g: 164, b: 226, intensity: 0.15 }, draw: drawPhaseSpiderRedux },
  { id: 'redux-skeleton', name: 'Skeleton', gridWidth: 10, gridHeight: 12, monsterClass: 0, level: 5, atmosphere: { r: 96, g: 156, b: 70, intensity: 0.12 }, draw: drawSkeletonRedux },
  { id: 'redux-goblin-shaman', name: 'Goblin Shaman', gridWidth: 12, gridHeight: 11, monsterClass: 1, level: 6, atmosphere: { r: 106, g: 70, b: 164, intensity: 0.12 }, draw: drawGoblinShamanRedux },
  { id: 'redux-gelatinous-ooze', name: 'Gelatinous Ooze', gridWidth: 10, gridHeight: 14, monsterClass: 2, level: 7, atmosphere: { r: 66, g: 182, b: 56, intensity: 0.12 }, draw: drawGelatinousOozeRedux },
  { id: 'redux-bugbear', name: 'Bugbear', gridWidth: 10, gridHeight: 12, monsterClass: 0, level: 8, atmosphere: { r: 172, g: 138, b: 72, intensity: 0.10 }, draw: drawBugbearRedux },
  { id: 'redux-carrion-crawler', name: 'Carrion Crawler', gridWidth: 10, gridHeight: 13, monsterClass: 1, level: 9, atmosphere: { r: 144, g: 168, b: 208, intensity: 0.14 }, draw: drawCarrionCrawlerRedux },
  { id: 'redux-hook-horror', name: 'Hook Horror', gridWidth: 14, gridHeight: 12, monsterClass: 2, level: 10, atmosphere: { r: 136, g: 82, b: 178, intensity: 0.12 }, draw: drawDuskDrakeRedux },
  { id: 'redux-basilisk', name: 'Basilisk', gridWidth: 26, gridHeight: 9, monsterClass: 0, level: 12, isBoss: true, atmosphere: { r: 52, g: 86, b: 36, intensity: 0.10 }, renderOverrides: { gamma: 0.72, ambient: 0.45, brightnessBoost: 1.15, charDensityFloor: 0.14 }, draw: drawBasiliskRedux },
];
