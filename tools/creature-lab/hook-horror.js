import { fillEllipse, fillCircle, ambientOcclusion, highlight } from './helpers.js';
import { drawBodyOutline, drawLimbChain, drawDebugSkeleton } from './skeleton.js';
import { renderAscii } from './ascii-renderer.js';

function bodyGrad3(ctx, cx, cy, r, midR, midG, midB, shadowR, shadowG, shadowB, hiR, hiG, hiB) {
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
  g.addColorStop(0, `rgb(${hiR},${hiG},${hiB})`);
  g.addColorStop(0.25, `rgb(${midR},${midG},${midB})`);
  g.addColorStop(0.50, `rgb(${Math.floor(midR * 0.85 + shadowR * 0.15)},${Math.floor(midG * 0.85 + shadowG * 0.15)},${Math.floor(midB * 0.85 + shadowB * 0.15)})`);
  g.addColorStop(0.75, `rgb(${Math.floor(midR * 0.5 + shadowR * 0.5)},${Math.floor(midG * 0.5 + shadowG * 0.5)},${Math.floor(midB * 0.5 + shadowB * 0.5)})`);
  g.addColorStop(1, `rgb(${shadowR},${shadowG},${shadowB})`);
  return g;
}

function rgb(parts) {
  return `rgb(${parts.join(',')})`;
}

function rgba(parts, alpha) {
  return `rgba(${parts.join(',')},${alpha})`;
}

export const hookHorrorSkeleton = {
  spine: [
    { id: 'beak',     x: 0.18, y: 0.14, radius: 0.024 },  // beak jutting forward-up
    { id: 'head',     x: 0.28, y: 0.12, radius: 0.066 },  // head RAISED — roaring upward
    { id: 'neck',     x: 0.38, y: 0.24, radius: 0.058 },  // short thick neck
    { id: 'shoulder', x: 0.50, y: 0.36, radius: 0.145 },  // massive muscular shoulders
    { id: 'belly',    x: 0.55, y: 0.56, radius: 0.126 },  // thick belly
    { id: 'hip',      x: 0.58, y: 0.72, radius: 0.100 },  // wide hips
  ],
  limbs: [
    // Far arm — rises from right shoulder, hook sweeps up-right
    { attach: 'shoulder', side: 'far', segments: [
      { x: 0.62, y: 0.30, radius: 0.044 },   // far shoulder
      { x: 0.74, y: 0.20, radius: 0.038 },   // arm rising up-right
      { x: 0.84, y: 0.16, radius: 0.030 },   // hook connection
    ]},
    // Near arm — exits from left shoulder, hook sweeps hard left
    { attach: 'shoulder', side: 'near', segments: [
      { x: 0.42, y: 0.40, radius: 0.050 },   // near shoulder
      { x: 0.28, y: 0.44, radius: 0.042 },   // arm going left
      { x: 0.16, y: 0.42, radius: 0.034 },   // hook connection
    ]},
    // Far leg — back-right stance
    { attach: 'hip', side: 'far', segments: [
      { x: 0.66, y: 0.80, radius: 0.050 },
      { x: 0.72, y: 0.90, radius: 0.038 },
      { x: 0.76, y: 0.98, radius: 0.026 },
    ]},
    // Near leg — forward-left, wide stance
    { attach: 'hip', side: 'near', segments: [
      { x: 0.50, y: 0.80, radius: 0.054 },
      { x: 0.44, y: 0.91, radius: 0.040 },
      { x: 0.40, y: 0.99, radius: 0.028 },
    ]},
  ],
};

function drawHookBlade(ctx, w, h, baseX, baseY, outerX, outerY, tipX, tipY, width, hookMid, hookDark, hookLight) {
  const bx = w * baseX;
  const by = h * baseY;
  const ox = w * outerX;
  const oy = h * outerY;
  const tx = w * tipX;
  const ty = h * tipY;
  const dx = ox - bx;
  const dy = oy - by;
  const len = Math.hypot(dx, dy) || 1;
  const px = -dy / len;
  const py = dx / len;
  const root = w * width;

  ctx.fillStyle = bodyGrad3(
    ctx,
    (bx + ox + tx) / 3,
    (by + oy + ty) / 3,
    w * 0.22,
    hookMid[0], hookMid[1], hookMid[2],
    hookDark[0], hookDark[1], hookDark[2],
    hookLight[0], hookLight[1], hookLight[2],
  );
  ctx.beginPath();
  ctx.moveTo(bx + px * root, by + py * root);
  ctx.bezierCurveTo(
    bx + (ox - bx) * 0.45 + px * root * 1.6,
    by + (oy - by) * 0.45 + py * root * 1.6,
    ox + (tx - ox) * 0.10 + px * root * 1.0,
    oy + (ty - oy) * 0.10 + py * root * 1.0,
    tx,
    ty,
  );
  ctx.bezierCurveTo(
    ox + (tx - ox) * 0.35 - px * root * 1.25,
    oy + (ty - oy) * 0.35 - py * root * 1.25,
    bx + (ox - bx) * 0.18 - px * root * 0.85,
    by + (oy - by) * 0.18 - py * root * 0.85,
    bx - px * root,
    by - py * root,
  );
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = rgba(hookDark, 0.45);
  ctx.lineWidth = Math.max(1, w * 0.004);
  ctx.stroke();

  ctx.strokeStyle = rgba(hookLight, 0.32);
  ctx.lineWidth = Math.max(1, w * 0.003);
  ctx.beginPath();
  ctx.moveTo(bx + px * root * 0.4, by + py * root * 0.4);
  ctx.quadraticCurveTo(ox + px * root * 0.8, oy + py * root * 0.8, tx - px * root * 0.12, ty - py * root * 0.12);
  ctx.stroke();
}

function drawFootClaws(ctx, foot, prev, w, h, clawColor, alpha = 1) {
  const dx = foot.x - prev.x;
  const dy = foot.y - prev.y;
  const len = Math.hypot(dx, dy) || 1;
  const nx = dx / len;
  const ny = dy / len;
  const px = -ny;
  const py = nx;

  ctx.fillStyle = rgba(clawColor, alpha);
  for (const offset of [-0.012, 0.0, 0.012]) {
    const bx = foot.x + px * offset;
    const by = foot.y + py * offset;
    ctx.beginPath();
    ctx.moveTo(w * bx, h * by);
    ctx.lineTo(w * (bx + nx * 0.030 + px * offset * 0.2), h * (by + ny * 0.030 + py * offset * 0.2));
    ctx.lineTo(w * (bx + nx * 0.014 + px * 0.006), h * (by + ny * 0.012 + py * 0.006));
    ctx.closePath();
    ctx.fill();
  }
}

function drawEye(ctx, x, y, r, outerColor, coreColor, glowColor) {
  const glow = ctx.createRadialGradient(x, y, 0, x, y, r * 2.8);
  glow.addColorStop(0, glowColor);
  glow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glow;
  fillCircle(ctx, x, y, r * 2.8);

  ctx.fillStyle = outerColor;
  fillCircle(ctx, x, y, r);
  ctx.fillStyle = coreColor;
  fillCircle(ctx, x, y, r * 0.46);
  ctx.fillStyle = 'rgb(255,252,244)';
  fillCircle(ctx, x - r * 0.22, y - r * 0.22, r * 0.18);
}

export function drawHookHorrorClean(ctx, skeleton, w, h) {
  const head = skeleton.spine.find((node) => node.id === 'head');
  const neck = skeleton.spine.find((node) => node.id === 'neck');
  const shoulder = skeleton.spine.find((node) => node.id === 'shoulder');
  const belly = skeleton.spine.find((node) => node.id === 'belly');
  const hip = skeleton.spine.find((node) => node.id === 'hip');
  const farArm = skeleton.limbs[0];
  const nearArm = skeleton.limbs[1];
  const farLeg = skeleton.limbs[2];
  const nearLeg = skeleton.limbs[3];

  const bodyDark = [26, 20, 44];
  const bodyMid = [62, 48, 102];
  const bodyLight = [108, 86, 162];
  const bodyHi = [155, 130, 210];
  const hideDark = [70, 50, 96];
  const hideMid = [96, 72, 138];
  const hideLight = [140, 112, 188];
  const hookDark = [52, 36, 18];
  const hookMid = [128, 96, 58];    // lighter, sandier
  const hookLight = [198, 165, 114]; // bone/sandy highlight
  const clawColor = [185, 158, 124];
  const mouthDark = [18, 8, 12];
  const mouthRed = [112, 28, 36];
  const boneDark = [130, 96, 66];
  const boneLight = [218, 192, 156];
  const eyeGreen = 'rgb(88,200,80)';
  const eyeCore = 'rgb(14,38,12)';
  const eyeGlow = 'rgba(100,255,80,0.30)';

  ambientOcclusion(ctx, w * 0.56, h * 0.96, w * 0.28, h * 0.05, 0.34);
  ambientOcclusion(ctx, w * 0.48, h * 0.70, w * 0.16, h * 0.05, 0.22);

  drawLimbChain(ctx, farLeg.segments, w, h, rgb([26, 18, 38]));
  drawLimbChain(ctx, farArm.segments, w, h, rgb([42, 28, 52]));

  ctx.fillStyle = bodyGrad3(
    ctx,
    w * 0.54,
    h * 0.52,
    w * 0.34,
    bodyMid[0], bodyMid[1], bodyMid[2],
    bodyDark[0], bodyDark[1], bodyDark[2],
    bodyLight[0], bodyLight[1], bodyLight[2],
  );
  drawBodyOutline(ctx, skeleton.spine, w, h, ctx.fillStyle);

  ctx.fillStyle = bodyGrad3(
    ctx,
    w * 0.62,
    h * 0.33,
    w * 0.22,
    hideMid[0], hideMid[1], hideMid[2],
    bodyDark[0], bodyDark[1], bodyDark[2],
    hideLight[0], hideLight[1], hideLight[2],
  );
  fillEllipse(ctx, w * 0.65, h * 0.33, w * 0.19, h * 0.14);

  ctx.fillStyle = bodyGrad3(
    ctx,
    w * 0.46,
    h * 0.49,
    w * 0.17,
    hideMid[0], hideMid[1], hideMid[2],
    bodyDark[0], bodyDark[1], bodyDark[2],
    hideLight[0], hideLight[1], hideLight[2],
  );
  fillEllipse(ctx, w * 0.46, h * 0.49, w * 0.15, h * 0.17);

  ctx.fillStyle = bodyGrad3(
    ctx,
    w * hip.x,
    h * hip.y,
    w * 0.16,
    bodyMid[0], bodyMid[1], bodyMid[2],
    bodyDark[0], bodyDark[1], bodyDark[2],
    bodyHi[0], bodyHi[1], bodyHi[2],
  );
  fillEllipse(ctx, w * hip.x, h * hip.y, w * 0.14, h * 0.11);

  ctx.strokeStyle = rgba(bodyHi, 0.18);
  ctx.lineWidth = Math.max(1, w * 0.004);
  for (const ridge of [
    [0.46, 0.43, 0.58, 0.32, 0.69, 0.34],
    [0.44, 0.52, 0.57, 0.43, 0.68, 0.46],
    [0.46, 0.63, 0.58, 0.56, 0.67, 0.60],
  ]) {
    ctx.beginPath();
    ctx.moveTo(w * ridge[0], h * ridge[1]);
    ctx.quadraticCurveTo(w * ridge[2], h * ridge[3], w * ridge[4], h * ridge[5]);
    ctx.stroke();
  }

  ctx.strokeStyle = rgba(bodyDark, 0.45);
  ctx.lineWidth = Math.max(1, w * 0.005);
  for (const rib of [0.48, 0.54, 0.60]) {
    ctx.beginPath();
    ctx.moveTo(w * 0.40, h * rib);
    ctx.quadraticCurveTo(w * 0.49, h * (rib + 0.04), w * 0.58, h * (rib + 0.02));
    ctx.stroke();
  }

  ctx.fillStyle = bodyGrad3(
    ctx,
    w * head.x,
    h * head.y,
    w * 0.14,
    hideMid[0], hideMid[1], hideMid[2],
    bodyDark[0], bodyDark[1], bodyDark[2],
    bodyHi[0], bodyHi[1], bodyHi[2],
  );
  fillEllipse(ctx, w * head.x, h * head.y, w * 0.09, h * 0.08);

  ctx.fillStyle = bodyGrad3(
    ctx,
    w * neck.x,
    h * neck.y,
    w * 0.12,
    bodyMid[0], bodyMid[1], bodyMid[2],
    bodyDark[0], bodyDark[1], bodyDark[2],
    bodyLight[0], bodyLight[1], bodyLight[2],
  );
  fillEllipse(ctx, w * neck.x, h * neck.y, w * 0.08, h * 0.07);

  // HEAD FIN — dark jagged spines projecting UP from top of skull
  ctx.fillStyle = rgba([18, 12, 30], 0.95);
  for (const [bx, by, tx, ty] of [
    [0.26, 0.10, 0.24, 0.02],
    [0.30, 0.09, 0.29, 0.01],
    [0.34, 0.10, 0.35, 0.02],
    [0.38, 0.12, 0.40, 0.04],
  ]) {
    ctx.beginPath();
    ctx.moveTo(w * (bx - 0.012), h * by);
    ctx.lineTo(w * tx, h * ty);
    ctx.lineTo(w * (bx + 0.012), h * by);
    ctx.closePath();
    ctx.fill();
  }

  // OPEN MOUTH — upper jaw going up-left, lower jaw drooping down
  // Throat cavity
  ctx.fillStyle = rgb(mouthDark);
  ctx.beginPath();
  ctx.moveTo(w * 0.28, h * 0.09);  // upper jaw root
  ctx.bezierCurveTo(w * 0.20, h * 0.06, w * 0.14, h * 0.06, w * 0.12, h * 0.10);  // upper jaw tip
  ctx.bezierCurveTo(w * 0.14, h * 0.16, w * 0.20, h * 0.18, w * 0.26, h * 0.19);  // lower jaw
  ctx.bezierCurveTo(w * 0.30, h * 0.18, w * 0.32, h * 0.16, w * 0.28, h * 0.09);
  ctx.fill();
  // Throat glow
  ctx.fillStyle = rgba([mouthRed[0], mouthRed[1], mouthRed[2]], 0.55);
  fillEllipse(ctx, w * 0.22, h * 0.14, w * 0.06, h * 0.04);

  // Upper jaw — bone-colored beak shape
  ctx.fillStyle = bodyGrad3(ctx, w * 0.20, h * 0.09, w * 0.12,
    hookMid[0], hookMid[1], hookMid[2],
    hookDark[0], hookDark[1], hookDark[2],
    hookLight[0], hookLight[1], hookLight[2]);
  ctx.beginPath();
  ctx.moveTo(w * 0.30, h * 0.09);
  ctx.bezierCurveTo(w * 0.22, h * 0.05, w * 0.16, h * 0.04, w * 0.11, h * 0.10);  // upper edge
  ctx.bezierCurveTo(w * 0.14, h * 0.13, w * 0.18, h * 0.13, w * 0.26, h * 0.12);  // lower edge
  ctx.bezierCurveTo(w * 0.28, h * 0.11, w * 0.30, h * 0.10, w * 0.30, h * 0.09);
  ctx.fill();

  // Lower jaw — shorter, hangs down
  ctx.fillStyle = bodyGrad3(ctx, w * 0.20, h * 0.18, w * 0.10,
    hookMid[0], hookMid[1], hookMid[2],
    hookDark[0], hookDark[1], hookDark[2],
    hookLight[0], hookLight[1], hookLight[2]);
  ctx.beginPath();
  ctx.moveTo(w * 0.28, h * 0.18);
  ctx.bezierCurveTo(w * 0.22, h * 0.19, w * 0.16, h * 0.18, w * 0.13, h * 0.14);  // lower edge
  ctx.bezierCurveTo(w * 0.14, h * 0.12, w * 0.18, h * 0.12, w * 0.26, h * 0.15);  // upper edge
  ctx.bezierCurveTo(w * 0.28, h * 0.16, w * 0.28, h * 0.17, w * 0.28, h * 0.18);
  ctx.fill();

  // Teeth — upper row (pointing down into cavity)
  ctx.fillStyle = rgb(boneLight);
  for (const [tx, ty, len] of [[0.19, 0.12, 0.018], [0.23, 0.11, 0.020], [0.27, 0.11, 0.016]]) {
    ctx.beginPath();
    ctx.moveTo(w * tx, h * ty);
    ctx.lineTo(w * (tx + 0.005), h * (ty + len));
    ctx.lineTo(w * (tx + 0.011), h * ty);
    ctx.closePath();
    ctx.fill();
  }
  // Teeth — lower row (pointing up)
  for (const [tx, ty, len] of [[0.18, 0.16, 0.016], [0.22, 0.16, 0.018], [0.26, 0.16, 0.014]]) {
    ctx.beginPath();
    ctx.moveTo(w * tx, h * ty);
    ctx.lineTo(w * (tx + 0.005), h * (ty - len));
    ctx.lineTo(w * (tx + 0.010), h * ty);
    ctx.closePath();
    ctx.fill();
  }

  // CAT WHISKERS — thin white lines from snout area
  ctx.strokeStyle = 'rgba(230,225,210,0.80)';
  ctx.lineWidth = w * 0.003;
  ctx.lineCap = 'round';
  for (const [ox, oy, ex, ey] of [
    [0.20, 0.10, 0.04, 0.07],
    [0.20, 0.12, 0.03, 0.12],
    [0.20, 0.14, 0.04, 0.17],
    [0.22, 0.10, 0.06, 0.06],
    [0.22, 0.14, 0.06, 0.18],
  ]) {
    ctx.beginPath();
    ctx.moveTo(w * ox, h * oy);
    ctx.lineTo(w * ex, h * ey);
    ctx.stroke();
  }

  // SINGLE GREEN EYE — large, prominent, glowing
  drawEye(ctx, w * 0.30, h * 0.10, w * 0.018, eyeGreen, eyeCore, eyeGlow);

  // BACK SPINE FINS — dark jagged spines projecting upward from the back
  ctx.fillStyle = rgba([18, 12, 30], 0.92);
  for (const [bx, by, tx, ty] of [
    [0.56, 0.28, 0.54, 0.18],
    [0.62, 0.26, 0.62, 0.15],
    [0.67, 0.28, 0.68, 0.17],
    [0.72, 0.30, 0.74, 0.20],
  ]) {
    ctx.beginPath();
    ctx.moveTo(w * (bx - 0.016), h * by);
    ctx.lineTo(w * tx, h * ty);
    ctx.lineTo(w * (bx + 0.016), h * by);
    ctx.closePath();
    ctx.fill();
  }
  // Side membrane webbing — behind left arm, dark
  ctx.fillStyle = rgba([18, 14, 32], 0.68);
  ctx.beginPath();
  ctx.moveTo(w * 0.40, h * 0.34);
  ctx.bezierCurveTo(w * 0.30, h * 0.28, w * 0.20, h * 0.32, w * 0.16, h * 0.40);
  ctx.bezierCurveTo(w * 0.22, h * 0.46, w * 0.32, h * 0.44, w * 0.42, h * 0.42);
  ctx.closePath();
  ctx.fill();

  // MUSCLE RIDGES — prominent on chest and abdomen
  ctx.strokeStyle = rgba(bodyHi, 0.28);
  ctx.lineWidth = Math.max(1.5, w * 0.005);
  for (const ridge of [
    [0.44, 0.38, 0.56, 0.28, 0.68, 0.32],
    [0.42, 0.48, 0.55, 0.38, 0.66, 0.42],
    [0.44, 0.58, 0.56, 0.50, 0.65, 0.54],
    [0.46, 0.66, 0.57, 0.60, 0.63, 0.64],
  ]) {
    ctx.beginPath();
    ctx.moveTo(w * ridge[0], h * ridge[1]);
    ctx.quadraticCurveTo(w * ridge[2], h * ridge[3], w * ridge[4], h * ridge[5]);
    ctx.stroke();
  }
  // Vertical center muscle divider
  ctx.strokeStyle = rgba(bodyDark, 0.40);
  ctx.lineWidth = Math.max(1, w * 0.004);
  ctx.beginPath();
  ctx.moveTo(w * 0.50, h * 0.36);
  ctx.bezierCurveTo(w * 0.50, h * 0.48, w * 0.52, h * 0.58, w * 0.54, h * 0.66);
  ctx.stroke();

  // NEAR ARM LIMBS + NEAR HOOK (drawn last, in front)
  drawLimbChain(ctx, nearLeg.segments, w, h, rgb([72, 56, 108]));
  drawLimbChain(ctx, nearArm.segments, w, h, rgb([86, 68, 124]));
  // Arm connection bulge (thick shoulder)
  ctx.fillStyle = bodyGrad3(ctx, w * 0.42, h * 0.40, w * 0.06,
    hideMid[0], hideMid[1], hideMid[2],
    bodyDark[0], bodyDark[1], bodyDark[2],
    hideLight[0], hideLight[1], hideLight[2]);
  fillEllipse(ctx, w * 0.42, h * 0.40, w * 0.052, h * 0.044);

  // FEET CLAWS
  const farFoot = farLeg.segments[farLeg.segments.length - 1];
  const farPrev = farLeg.segments[farLeg.segments.length - 2];
  drawFootClaws(ctx, farFoot, farPrev, w, h, clawColor, 0.55);

  const nearFoot = nearLeg.segments[nearLeg.segments.length - 1];
  const nearPrev = nearLeg.segments[nearLeg.segments.length - 2];
  drawFootClaws(ctx, nearFoot, nearPrev, w, h, clawColor, 1);

  // FAR HOOK — thin scythe blade, rises up-right then curls back left
  // Outer (convex) spine: long elegant curve
  // Inner (concave) edge: closely parallels spine — THIN blade, not a plate
  const farHookGrad = bodyGrad3(ctx, w * 0.86, h * 0.10, w * 0.20,
    hookMid[0], hookMid[1], hookMid[2],
    hookDark[0], hookDark[1], hookDark[2],
    hookLight[0], hookLight[1], hookLight[2]);
  ctx.fillStyle = farHookGrad;
  ctx.beginPath();
  // outer edge (convex back of blade)
  ctx.moveTo(w * 0.82, h * 0.22);
  ctx.bezierCurveTo(w * 0.90, h * 0.18, w * 0.98, h * 0.12, w * 0.97, h * 0.03);
  ctx.bezierCurveTo(w * 0.96, h * -0.04, w * 0.85, h * -0.05, w * 0.66, h * 0.01);
  // sharp tip
  ctx.lineTo(w * 0.68, h * 0.05);
  // inner edge (concave cutting edge) — closely parallel, THIN blade
  ctx.bezierCurveTo(w * 0.82, h * 0.03, w * 0.90, h * 0.04, w * 0.92, h * 0.10);
  ctx.bezierCurveTo(w * 0.93, h * 0.16, w * 0.86, h * 0.20, w * 0.80, h * 0.22);
  ctx.closePath();
  ctx.fill();
  // Serrations on inner (concave) edge
  ctx.fillStyle = rgba(hookDark, 0.85);
  for (let t = 0.1; t < 1.0; t += 0.22) {
    const sx = 0.80 + t * (0.68 - 0.80);
    const sy = 0.22 + t * (0.05 - 0.22);
    ctx.beginPath();
    ctx.moveTo(w * sx, h * sy);
    ctx.lineTo(w * (sx - 0.016), h * (sy + 0.025));
    ctx.lineTo(w * (sx + 0.010), h * (sy + 0.018));
    ctx.closePath();
    ctx.fill();
  }
  // Highlight along outer spine
  ctx.strokeStyle = rgba(hookLight, 0.50);
  ctx.lineWidth = Math.max(1.5, w * 0.005);
  ctx.beginPath();
  ctx.moveTo(w * 0.82, h * 0.22);
  ctx.bezierCurveTo(w * 0.90, h * 0.18, w * 0.97, h * 0.12, w * 0.96, h * 0.03);
  ctx.bezierCurveTo(w * 0.95, h * -0.03, w * 0.84, h * -0.04, w * 0.67, h * 0.02);
  ctx.stroke();
  // Arm connection nub
  ctx.fillStyle = bodyGrad3(ctx, w * 0.82, h * 0.20, w * 0.05,
    hookMid[0], hookMid[1], hookMid[2],
    hookDark[0], hookDark[1], hookDark[2],
    hookLight[0], hookLight[1], hookLight[2]);
  fillEllipse(ctx, w * 0.82, h * 0.20, w * 0.038, h * 0.028);

  // NEAR HOOK — thin scythe blade, sweeps far left then curls tip downward
  // Same pattern: outer convex spine, inner concave edge closely parallel
  ctx.fillStyle = bodyGrad3(ctx, w * 0.08, h * 0.44, w * 0.20,
    hookMid[0], hookMid[1], hookMid[2],
    hookDark[0], hookDark[1], hookDark[2],
    hookLight[0], hookLight[1], hookLight[2]);
  ctx.beginPath();
  // outer edge (convex back of blade)
  ctx.moveTo(w * 0.20, h * 0.36);
  ctx.bezierCurveTo(w * 0.08, h * 0.28, w * -0.02, h * 0.34, w * -0.02, h * 0.50);
  ctx.bezierCurveTo(w * -0.02, h * 0.60, w * 0.06, h * 0.68, w * 0.16, h * 0.68);
  // sharp tip
  ctx.lineTo(w * 0.18, h * 0.64);
  // inner edge (concave cutting edge) — closely parallel, THIN blade
  ctx.bezierCurveTo(w * 0.10, h * 0.62, w * 0.06, h * 0.54, w * 0.06, h * 0.46);
  ctx.bezierCurveTo(w * 0.06, h * 0.36, w * 0.12, h * 0.32, w * 0.20, h * 0.40);
  ctx.closePath();
  ctx.fill();
  // Serrations on inner (concave) cutting edge
  ctx.fillStyle = rgba(hookDark, 0.85);
  for (let t = 0.1; t < 1.0; t += 0.22) {
    const sx = 0.20 + t * (0.18 - 0.20);
    const sy = 0.40 + t * (0.64 - 0.40);
    ctx.beginPath();
    ctx.moveTo(w * sx, h * sy);
    ctx.lineTo(w * (sx + 0.022), h * (sy + 0.012));
    ctx.lineTo(w * (sx + 0.014), h * (sy - 0.016));
    ctx.closePath();
    ctx.fill();
  }
  // Highlight along outer spine
  ctx.strokeStyle = rgba(hookLight, 0.50);
  ctx.lineWidth = Math.max(1.5, w * 0.005);
  ctx.beginPath();
  ctx.moveTo(w * 0.20, h * 0.36);
  ctx.bezierCurveTo(w * 0.08, h * 0.28, w * -0.01, h * 0.34, w * -0.01, h * 0.50);
  ctx.bezierCurveTo(w * -0.01, h * 0.60, w * 0.07, h * 0.67, w * 0.16, h * 0.67);
  ctx.stroke();
  // Arm connection nub
  ctx.fillStyle = bodyGrad3(ctx, w * 0.16, h * 0.40, w * 0.05,
    hookMid[0], hookMid[1], hookMid[2],
    hookDark[0], hookDark[1], hookDark[2],
    hookLight[0], hookLight[1], hookLight[2]);
  fillEllipse(ctx, w * 0.16, h * 0.40, w * 0.040, h * 0.030);

  // HIGHLIGHTS
  highlight(ctx, w * 0.52, h * 0.34, w * 0.09, rgba(bodyHi, 0.20), 0.28);
  highlight(ctx, w * 0.40, h * 0.44, w * 0.07, rgba(bodyHi, 0.16), 0.24);
  highlight(ctx, w * 0.82, h * 0.10, w * 0.06, rgba([224, 195, 145], 0.22), 0.30);
  highlight(ctx, w * 0.10, h * 0.38, w * 0.06, rgba([224, 195, 145], 0.22), 0.30);
  ambientOcclusion(ctx, w * 0.50, h * 0.66, w * 0.18, h * 0.05, 0.26);
  ambientOcclusion(ctx, w * 0.38, h * 0.82, w * 0.14, h * 0.04, 0.24);
}

const GRID_W = 14;
const GRID_H = 12;

export default { draw: drawHookHorrorClean, skeleton: hookHorrorSkeleton, gridW: GRID_W, gridH: GRID_H };

function render(elapsed = 0) {
  const size = parseInt(document.getElementById('canvas-size').value, 10);
  const cellSize = parseInt(document.getElementById('cell-size').value, 10);
  const showGrid = document.getElementById('show-grid').checked;
  const showDebug = document.getElementById('show-debug').checked;
  const sk = hookHorrorSkeleton;

  const canvasW = size;
  const canvasH = Math.round(size * GRID_H / GRID_W);
  const maxDisplay = 420;
  const displayW = `${Math.min(canvasW, maxDisplay)}px`;
  const displayH = `${Math.min(canvasH, Math.round(maxDisplay * GRID_H / GRID_W))}px`;

  const asciiOpts = { elapsed, cellSize, level: 10, gridWidth: GRID_W, gridHeight: GRID_H };

  const c1 = document.getElementById('canvas-size');
  c1.width = canvasW;
  c1.height = canvasH;
  c1.style.width = displayW;
  c1.style.height = displayH;
  const ctx1 = c1.getContext('2d');
  ctx1.fillStyle = '#000';
  ctx1.fillRect(0, 0, canvasW, canvasH);
  drawLimbChain(ctx1, sk.limbs[2].segments, canvasW, canvasH, 'rgb(26,18,38)');
  drawLimbChain(ctx1, sk.limbs[0].segments, canvasW, canvasH, 'rgb(42,28,52)');
  drawBodyOutline(ctx1, sk.spine, canvasW, canvasH, 'rgb(68,52,112)');
  drawLimbChain(ctx1, sk.limbs[3].segments, canvasW, canvasH, 'rgb(92,74,142)');
  drawLimbChain(ctx1, sk.limbs[1].segments, canvasW, canvasH, 'rgb(104,82,154)');
  if (showDebug) {
    drawDebugSkeleton(ctx1, sk, canvasW, canvasH);
  }

  const c2 = document.getElementById('next-ascii');
  c2.width = canvasW;
  c2.height = canvasH;
  c2.style.width = displayW;
  c2.style.height = displayH;
  const ctx2 = c2.getContext('2d');
  ctx2.fillStyle = '#000';
  ctx2.fillRect(0, 0, canvasW, canvasH);
  renderAscii(ctx2, (tctx, tw, th) => {
    drawHookHorrorClean(tctx, sk, tw, th);
  }, 0, 0, canvasW, canvasH, asciiOpts);

  const c3 = document.getElementById('next-raw');
  c3.width = canvasW;
  c3.height = canvasH;
  c3.style.width = displayW;
  c3.style.height = displayH;
  const ctx3 = c3.getContext('2d');
  ctx3.fillStyle = '#000';
  ctx3.fillRect(0, 0, canvasW, canvasH);
  drawHookHorrorClean(ctx3, sk, canvasW, canvasH);

  if (showGrid) {
    for (const canvas of [c1, c2, c3]) {
      const gctx = canvas.getContext('2d');
      gctx.strokeStyle = 'rgba(255,255,255,0.08)';
      gctx.lineWidth = 1;
      const step = canvasW / 10;
      for (let i = 0; i < canvasW; i += step) {
        gctx.beginPath();
        gctx.moveTo(i, 0);
        gctx.lineTo(i, canvasH);
        gctx.stroke();
      }
      for (let i = 0; i < canvasH; i += step) {
        gctx.beginPath();
        gctx.moveTo(0, i);
        gctx.lineTo(canvasW, i);
        gctx.stroke();
      }
    }
  }
}

if (typeof document !== 'undefined' && document.getElementById('canvas-size')) {
  let animating = false;
  let animStart = 0;
  let rafId = null;

  function animationLoop(ts) {
    if (!animating) {
      return;
    }
    render(ts - animStart);
    rafId = requestAnimationFrame(animationLoop);
  }

  document.getElementById('reseed').addEventListener('click', () => {
    render(animating ? performance.now() - animStart : 0);
  });
  document.getElementById('animate').addEventListener('change', (event) => {
    animating = event.target.checked;
    if (animating) {
      animStart = performance.now();
      rafId = requestAnimationFrame(animationLoop);
    } else if (rafId) {
      cancelAnimationFrame(rafId);
      render(0);
    }
  });
  for (const id of ['canvas-size', 'cell-size', 'show-grid', 'show-debug']) {
    document.getElementById(id).addEventListener('change', () => render(animating ? performance.now() - animStart : 0));
  }

  render();
}
