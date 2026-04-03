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

export const carrionCrawlerSkeleton = {
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
      { x: 0.22, y: 0.84, radius: 0.026 },
      { x: 0.19, y: 0.89, radius: 0.016 },
      { x: 0.18, y: 0.93, radius: 0.010 },
    ]},
    { attach: 'rump', side: 'far', segments: [
      { x: 0.34, y: 0.79, radius: 0.028 },
      { x: 0.34, y: 0.86, radius: 0.017 },
      { x: 0.35, y: 0.91, radius: 0.010 },
    ]},
    { attach: 'mid', side: 'far', segments: [
      { x: 0.45, y: 0.70, radius: 0.026 },
      { x: 0.48, y: 0.78, radius: 0.016 },
      { x: 0.50, y: 0.86, radius: 0.010 },
    ]},
    { attach: 'chest', side: 'far', segments: [
      { x: 0.56, y: 0.60, radius: 0.024 },
      { x: 0.61, y: 0.69, radius: 0.015 },
      { x: 0.64, y: 0.79, radius: 0.010 },
    ]},
    { attach: 'tail', side: 'near', segments: [
      { x: 0.29, y: 0.82, radius: 0.030 },
      { x: 0.30, y: 0.89, radius: 0.018 },
      { x: 0.31, y: 0.93, radius: 0.011 },
    ]},
    { attach: 'rump', side: 'near', segments: [
      { x: 0.42, y: 0.78, radius: 0.032 },
      { x: 0.47, y: 0.86, radius: 0.018 },
      { x: 0.50, y: 0.92, radius: 0.011 },
    ]},
    { attach: 'mid', side: 'near', segments: [
      { x: 0.53, y: 0.68, radius: 0.030 },
      { x: 0.58, y: 0.78, radius: 0.017 },
      { x: 0.61, y: 0.87, radius: 0.011 },
    ]},
    { attach: 'chest', side: 'near', segments: [
      { x: 0.63, y: 0.58, radius: 0.028 },
      { x: 0.69, y: 0.67, radius: 0.016 },
      { x: 0.74, y: 0.79, radius: 0.010 },
    ]},
  ],
};

function drawPlate(ctx, w, h, x, y, rx, ry, shellMid, shellDark, shellHi) {
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
  ctx.bezierCurveTo(
    w * (x - rx * 0.84), h * (y - ry * 0.74),
    w * (x - rx * 0.16), h * (y - ry * 1.18),
    w * (x + rx * 0.42), h * (y - ry * 0.88),
  );
  ctx.bezierCurveTo(
    w * (x + rx * 0.92), h * (y - ry * 0.50),
    w * (x + rx * 0.96), h * (y + ry * 0.10),
    w * (x + rx * 0.46), h * (y + ry * 0.28),
  );
  ctx.bezierCurveTo(
    w * (x + rx * 0.04), h * (y + ry * 0.42),
    w * (x - rx * 0.54), h * (y + ry * 0.42),
    w * (x - rx * 0.92), h * (y + ry * 0.18),
  );
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = rgba(shellDark, 0.45);
  ctx.lineWidth = Math.max(1, w * 0.004);
  ctx.stroke();

  ctx.strokeStyle = rgba(shellHi, 0.35);
  ctx.lineWidth = Math.max(1, w * 0.0025);
  ctx.beginPath();
  ctx.moveTo(w * (x - rx * 0.58), h * (y - ry * 0.08));
  ctx.quadraticCurveTo(
    w * (x - rx * 0.04),
    h * (y - ry * 0.72),
    w * (x + rx * 0.46),
    h * (y - ry * 0.18),
  );
  ctx.stroke();
}

function drawFootClaws(ctx, foot, w, h, clawColor, lift = 1) {
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

function drawMandible(ctx, w, h, originX, originY, side, hookDark, hookLight) {
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
  ctx.quadraticCurveTo(
    w * (originX + side * 0.14),
    h * (originY + 0.02),
    w * (originX + side * 0.18),
    h * (originY + 0.13),
  );
  ctx.quadraticCurveTo(
    w * (originX + side * 0.09),
    h * (originY + 0.09),
    w * (originX + side * 0.03),
    h * (originY + 0.03),
  );
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = rgba(hookLight, 0.35);
  ctx.lineWidth = Math.max(1, w * 0.003);
  ctx.beginPath();
  ctx.moveTo(w * (originX + side * 0.03), h * (originY + 0.02));
  ctx.quadraticCurveTo(
    w * (originX + side * 0.12),
    h * (originY + 0.03),
    w * (originX + side * 0.15),
    h * (originY + 0.10),
  );
  ctx.stroke();
}

function drawTentacle(ctx, w, h, startX, startY, c1x, c1y, endX, endY, width, tentacleDark, tentacleLight, tipColor) {
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

export function drawCarrionCrawlerClean(ctx, skeleton, w, h) {
  ctx.save();
  ctx.translate(w, 0);
  ctx.scale(-1, 1);

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

  const snout = skeleton.spine.find((node) => node.id === 'snout');
  const head = skeleton.spine.find((node) => node.id === 'head');
  const neck = skeleton.spine.find((node) => node.id === 'neck');
  const chest = skeleton.spine.find((node) => node.id === 'chest');
  const mid = skeleton.spine.find((node) => node.id === 'mid');
  const rump = skeleton.spine.find((node) => node.id === 'rump');
  const tail = skeleton.spine.find((node) => node.id === 'tail');

  // Ground shadow
  ambientOcclusion(ctx, w * 0.50, h * 0.92, w * 0.36, h * 0.05, 0.34);
  ambientOcclusion(ctx, w * 0.68, h * 0.66, w * 0.16, h * 0.03, 0.22);

  // Far legs
  for (const limb of skeleton.limbs) {
    if (limb.side === 'far') {
      drawLimbChain(ctx, limb.segments, w, h, rgb([28, 44, 20]));
    }
  }

  // Main body silhouette
  drawBodyOutline(
    ctx,
    skeleton.spine,
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

  // Segment bulges
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

  // Pale belly segments
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

  // Shell plates running down the back
  for (const plate of [
    { x: 0.25, y: 0.72, rx: 0.115, ry: 0.130 },
    { x: 0.37, y: 0.61, rx: 0.118, ry: 0.135 },
    { x: 0.49, y: 0.49, rx: 0.115, ry: 0.130 },
    { x: 0.61, y: 0.36, rx: 0.100, ry: 0.112 },
    { x: 0.70, y: 0.24, rx: 0.082, ry: 0.094 },
  ]) {
    drawPlate(ctx, w, h, plate.x, plate.y, plate.rx, plate.ry, shellLight, shellDark, shellHi);
  }

  // Body ridges for segmentation
  ctx.strokeStyle = rgba(shellHi, 0.18);
  ctx.lineWidth = Math.max(1, w * 0.004);
  for (const ridge of [0.34, 0.46, 0.58, 0.68]) {
    ctx.beginPath();
    ctx.moveTo(w * (ridge - 0.03), h * (0.84 - ridge * 0.46));
    ctx.quadraticCurveTo(w * ridge, h * (0.72 - ridge * 0.44), w * (ridge + 0.05), h * (0.78 - ridge * 0.58));
    ctx.stroke();
  }

  // Head cap
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

  // Mouth cavity
  ctx.fillStyle = rgb(mawDark);
  fillEllipse(ctx, w * 0.79, h * 0.32, w * 0.13, h * 0.058);
  ctx.fillStyle = rgba([120, 32, 22], 0.45);
  fillEllipse(ctx, w * 0.79, h * 0.325, w * 0.088, h * 0.026);

  // Teeth
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

  // Hooks around the maw
  drawMandible(ctx, w, h, 0.74, 0.27, -1, hookDark, hookLight);
  drawMandible(ctx, w, h, 0.84, 0.27, 1, hookDark, hookLight);

  // Face tentacles
  drawTentacle(ctx, w, h, 0.71, 0.31, 0.63, 0.25, 0.57, 0.19, 0.014, tentacleDark, tentacleLight, tentacleTip);
  drawTentacle(ctx, w, h, 0.73, 0.34, 0.64, 0.38, 0.60, 0.42, 0.013, tentacleDark, tentacleLight, tentacleTip);
  drawTentacle(ctx, w, h, 0.76, 0.36, 0.72, 0.41, 0.71, 0.44, 0.011, tentacleDark, tentacleLight, tentacleTip);
  drawTentacle(ctx, w, h, 0.82, 0.36, 0.86, 0.41, 0.89, 0.44, 0.011, tentacleDark, tentacleLight, tentacleTip);
  drawTentacle(ctx, w, h, 0.85, 0.31, 0.91, 0.27, 0.95, 0.22, 0.012, tentacleDark, tentacleLight, tentacleTip);
  drawTentacle(ctx, w, h, 0.79, 0.37, 0.80, 0.41, 0.80, 0.45, 0.010, tentacleDark, tentacleLight, tentacleTip);

  // Eye stalks
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

  // Near legs
  for (const limb of skeleton.limbs) {
    if (limb.side === 'near') {
      drawLimbChain(ctx, limb.segments, w, h, rgb([48, 74, 34]));
    }
  }

  // Foot claws
  for (const limb of skeleton.limbs) {
    const foot = limb.segments[limb.segments.length - 1];
    drawFootClaws(ctx, foot, w, h, clawColor, limb.side === 'near' ? 1 : 0.8);
  }

  // Highlights and occlusion for depth
  highlight(ctx, w * 0.44, h * 0.48, w * 0.09, rgba(shellHi, 0.22), 0.28);
  highlight(ctx, w * 0.69, h * 0.20, w * 0.07, rgba(shellHi, 0.28), 0.28);
  ambientOcclusion(ctx, w * 0.55, h * 0.66, w * 0.16, h * 0.04, 0.28);
  ambientOcclusion(ctx, w * 0.78, h * 0.36, w * 0.10, h * 0.03, 0.20);

  ctx.restore();
}

const GRID_W = 10;
const GRID_H = 13;

export default { draw: drawCarrionCrawlerClean, skeleton: carrionCrawlerSkeleton, gridW: GRID_W, gridH: GRID_H };

function render(elapsed = 0) {
  const size = parseInt(document.getElementById('canvas-size').value);
  const cellSize = parseInt(document.getElementById('cell-size').value);
  const showGrid = document.getElementById('show-grid').checked;
  const showDebug = document.getElementById('show-debug').checked;
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
  ctx1.fillStyle = '#000';
  ctx1.fillRect(0, 0, canvasW, canvasH);
  for (const limb of sk.limbs) {
    if (limb.side === 'far') drawLimbChain(ctx1, limb.segments, canvasW, canvasH, 'rgb(22,40,18)');
  }
  drawBodyOutline(ctx1, sk.spine, canvasW, canvasH, 'rgb(42,66,30)');
  for (const limb of sk.limbs) {
    if (limb.side === 'near') drawLimbChain(ctx1, limb.segments, canvasW, canvasH, 'rgb(70,108,48)');
  }
  if (showDebug) drawDebugSkeleton(ctx1, sk, canvasW, canvasH);

  const c2 = document.getElementById('next-ascii');
  c2.width = canvasW; c2.height = canvasH;
  c2.style.width = displayW; c2.style.height = displayH;
  const ctx2 = c2.getContext('2d');
  ctx2.fillStyle = '#000';
  ctx2.fillRect(0, 0, canvasW, canvasH);
  renderAscii(ctx2, (tctx, tw, th) => {
    drawCarrionCrawlerClean(tctx, sk, tw, th);
  }, 0, 0, canvasW, canvasH, asciiOpts);

  const c3 = document.getElementById('next-raw');
  c3.width = canvasW; c3.height = canvasH;
  c3.style.width = displayW; c3.style.height = displayH;
  const ctx3 = c3.getContext('2d');
  ctx3.fillStyle = '#000';
  ctx3.fillRect(0, 0, canvasW, canvasH);
  drawCarrionCrawlerClean(ctx3, sk, canvasW, canvasH);

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
    if (!animating) return;
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
    document.getElementById(id).addEventListener('change', () => {
      render(animating ? performance.now() - animStart : 0);
    });
  }

  render();
}
