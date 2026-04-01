import type { MonsterTemplate } from './monsterTemplates';

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

function drawFungalShamanRedux(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.strokeStyle = 'rgb(98,74,44)';
  ctx.lineWidth = w * 0.04;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(w * 0.72, h * 0.10);
  ctx.bezierCurveTo(w * 0.69, h * 0.34, w * 0.66, h * 0.60, w * 0.63, h * 0.92);
  ctx.stroke();
  ctx.fillStyle = bodyGrad(ctx, w * 0.42, h * 0.22, w * 0.24, 188, 84, 160, 90, 44, 90);
  ctx.beginPath();
  ctx.moveTo(w * 0.18, h * 0.30);
  ctx.bezierCurveTo(w * 0.12, h * 0.14, w * 0.22, h * 0.04, w * 0.40, h * 0.03);
  ctx.bezierCurveTo(w * 0.58, h * 0.04, w * 0.66, h * 0.16, w * 0.60, h * 0.30);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = bodyGrad(ctx, w * 0.40, h * 0.57, w * 0.16, 164, 142, 102, 82, 62, 42);
  ctx.beginPath();
  ctx.moveTo(w * 0.34, h * 0.34);
  ctx.bezierCurveTo(w * 0.28, h * 0.44, w * 0.26, h * 0.62, w * 0.32, h * 0.80);
  ctx.bezierCurveTo(w * 0.40, h * 0.84, w * 0.50, h * 0.82, w * 0.54, h * 0.76);
  ctx.bezierCurveTo(w * 0.54, h * 0.58, w * 0.52, h * 0.44, w * 0.48, h * 0.34);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgb(170,208,86)';
  fillCircle(ctx, w * 0.31, h * 0.16, w * 0.02);
  fillCircle(ctx, w * 0.42, h * 0.11, w * 0.025);
  fillCircle(ctx, w * 0.53, h * 0.17, w * 0.016);
  ctx.fillStyle = 'rgb(112,255,78)';
  fillCircle(ctx, w * 0.36, h * 0.33, w * 0.012);
  fillCircle(ctx, w * 0.43, h * 0.33, w * 0.012);
  drawLimb(ctx, w * 0.33, h * 0.47, w * 0.26, h * 0.58, w * 0.22, h * 0.70, w * 0.012, 'rgb(104,84,58)');
  drawLimb(ctx, w * 0.48, h * 0.48, w * 0.56, h * 0.50, w * 0.64, h * 0.50, w * 0.012, 'rgb(104,84,58)');
  drawLimb(ctx, w * 0.36, h * 0.78, w * 0.34, h * 0.88, w * 0.31, h * 0.96, w * 0.015, 'rgb(92,72,50)');
  drawLimb(ctx, w * 0.46, h * 0.78, w * 0.46, h * 0.89, w * 0.46, h * 0.97, w * 0.015, 'rgb(92,72,50)');
  highlight(ctx, w * 0.70, h * 0.08, w * 0.05, 'rgb(142,255,94)', 0.25);
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
  { id: 'redux-dire-rat', name: 'Dire Rat', gridWidth: 14, gridHeight: 8, monsterClass: 1, level: 1, atmosphere: { r: 140, g: 110, b: 70, intensity: 0.10 }, draw: drawDireRatRedux },
  { id: 'redux-fungal-shaman', name: 'Fungal Shaman', gridWidth: 10, gridHeight: 12, monsterClass: 2, level: 2, atmosphere: { r: 78, g: 148, b: 52, intensity: 0.12 }, draw: drawFungalShamanRedux },
  { id: 'redux-cavern-brute', name: 'Cavern Brute', gridWidth: 10, gridHeight: 12, monsterClass: 0, level: 3, atmosphere: { r: 156, g: 116, b: 58, intensity: 0.10 }, draw: drawCavernBruteRedux },
  { id: 'redux-crystal-elemental', name: 'Crystal Elemental', gridWidth: 10, gridHeight: 12, monsterClass: 2, level: 4, atmosphere: { r: 72, g: 164, b: 226, intensity: 0.15 }, draw: drawCrystalElementalRedux },
  { id: 'redux-ironhide-troll', name: 'Ironhide Troll', gridWidth: 10, gridHeight: 12, monsterClass: 0, level: 5, atmosphere: { r: 96, g: 156, b: 70, intensity: 0.12 }, draw: drawIronhideTrollRedux },
  { id: 'redux-phase-spider', name: 'Phase Spider', gridWidth: 12, gridHeight: 11, monsterClass: 1, level: 6, atmosphere: { r: 106, g: 70, b: 164, intensity: 0.12 }, draw: drawPhaseSpiderRedux },
  { id: 'redux-bonecaster', name: 'Bonecaster', gridWidth: 10, gridHeight: 14, monsterClass: 2, level: 7, atmosphere: { r: 66, g: 182, b: 56, intensity: 0.12 }, draw: drawBonecasterRedux },
  { id: 'redux-rock-golem', name: 'Rock Golem', gridWidth: 10, gridHeight: 12, monsterClass: 0, level: 8, atmosphere: { r: 172, g: 138, b: 72, intensity: 0.10 }, draw: drawRockGolemRedux },
  { id: 'redux-pale-stalker', name: 'Pale Stalker', gridWidth: 10, gridHeight: 13, monsterClass: 1, level: 9, atmosphere: { r: 144, g: 168, b: 208, intensity: 0.14 }, draw: drawPaleStalkerRedux },
  { id: 'redux-dusk-drake', name: 'Dusk Drake', gridWidth: 14, gridHeight: 12, monsterClass: 2, level: 10, atmosphere: { r: 136, g: 82, b: 178, intensity: 0.12 }, draw: drawDuskDrakeRedux },
  { id: 'redux-basilisk', name: 'Basilisk', gridWidth: 26, gridHeight: 9, monsterClass: 0, level: 12, isBoss: true, atmosphere: { r: 52, g: 86, b: 36, intensity: 0.10 }, renderOverrides: { gamma: 0.72, ambient: 0.45, brightnessBoost: 1.15, charDensityFloor: 0.14 }, draw: drawBasiliskRedux },
];
