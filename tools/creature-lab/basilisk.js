import { fillEllipse, fillCircle, ambientOcclusion, highlight, setSeed, rand } from './helpers.js';
import { drawBodyOutline, drawLimbChain, drawDebugSkeleton } from './skeleton.js';
import { renderAscii } from './ascii-renderer.js';

function bodyGrad3(ctx, cx, cy, r, midR, midG, midB, sR, sG, sB, hiR, hiG, hiB) {
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
  g.addColorStop(0,    `rgb(${hiR},${hiG},${hiB})`);
  g.addColorStop(0.25, `rgb(${midR},${midG},${midB})`);
  g.addColorStop(0.50, `rgb(${Math.floor(midR*0.85+sR*0.15)},${Math.floor(midG*0.85+sG*0.15)},${Math.floor(midB*0.85+sB*0.15)})`);
  g.addColorStop(0.75, `rgb(${Math.floor(midR*0.5+sR*0.5)},${Math.floor(midG*0.5+sG*0.5)},${Math.floor(midB*0.5+sB*0.5)})`);
  g.addColorStop(1,    `rgb(${sR},${sG},${sB})`);
  return g;
}

// ==========================================================================
// BASILISK SKELETON — low-slung wide quadruped, massive head, dorsal spines
// Facing LEFT, 3/4 view, stalking attack pose
// ==========================================================================
export const basiliskSkeleton = {
  spine: [
    { id: 'snout',    x: 0.14, y: 0.58, radius: 0.028 },  // jaw tip juts left
    { id: 'head',     x: 0.22, y: 0.42, radius: 0.094 },  // massive flat skull
    { id: 'neck',     x: 0.34, y: 0.44, radius: 0.072 },  // thick neck
    { id: 'shoulder', x: 0.47, y: 0.42, radius: 0.108 },  // front body mass
    { id: 'mid',      x: 0.60, y: 0.44, radius: 0.098 },  // mid body
    { id: 'hip',      x: 0.72, y: 0.48, radius: 0.088 },  // rear body
    { id: 'tail',     x: 0.84, y: 0.38, radius: 0.040 },  // tail starts up
    { id: 'tailtip',  x: 0.94, y: 0.28, radius: 0.016 },  // tip curves high
  ],
  limbs: [
    // Far front leg — behind body, right of center
    { attach: 'shoulder', side: 'far', segments: [
      { x: 0.52, y: 0.56, radius: 0.058 },
      { x: 0.57, y: 0.68, radius: 0.044 },
      { x: 0.60, y: 0.80, radius: 0.030 },
    ]},
    // Near front leg — forward and left, in attack stance
    { attach: 'shoulder', side: 'near', segments: [
      { x: 0.37, y: 0.56, radius: 0.066 },
      { x: 0.30, y: 0.68, radius: 0.050 },
      { x: 0.26, y: 0.80, radius: 0.034 },
    ]},
    // Far rear leg
    { attach: 'hip', side: 'far', segments: [
      { x: 0.78, y: 0.60, radius: 0.056 },
      { x: 0.83, y: 0.70, radius: 0.042 },
      { x: 0.86, y: 0.80, radius: 0.028 },
    ]},
    // Near rear leg
    { attach: 'hip', side: 'near', segments: [
      { x: 0.66, y: 0.60, radius: 0.062 },
      { x: 0.65, y: 0.72, radius: 0.046 },
      { x: 0.63, y: 0.82, radius: 0.030 },
    ]},
  ],
};

// ==========================================================================
// DRAW — dark amber-brown scales, quill dorsal ridge, massive jaw, amber eyes
// ==========================================================================
export function drawBasiliskClean(ctx, skeleton, w, h) {
  const snout    = skeleton.spine.find(n => n.id === 'snout');
  const head     = skeleton.spine.find(n => n.id === 'head');
  const neck     = skeleton.spine.find(n => n.id === 'neck');
  const shoulder = skeleton.spine.find(n => n.id === 'shoulder');
  const mid      = skeleton.spine.find(n => n.id === 'mid');
  const hip      = skeleton.spine.find(n => n.id === 'hip');
  const tail     = skeleton.spine.find(n => n.id === 'tail');
  const tailtip  = skeleton.spine.find(n => n.id === 'tailtip');

  // PALETTE — dark amber-brown from reference
  const bodyDark  = [38, 22, 10];
  const bodyMid   = [90, 54, 24];
  const bodyLight = [136, 90, 44];
  const bodyHi    = [176, 128, 68];
  const scaleAcc  = [62, 38, 16];   // scale groove accent
  const spineDark = [58, 38, 16];   // dorsal quill dark
  const spineLight= [118, 88, 44];  // dorsal quill highlight
  const mouthDark = [28, 12, 12];
  const mouthRed  = [90, 32, 32];
  const teethCol  = [208, 196, 168];
  const tongueCol = [180, 48, 48];
  const eyeAmber  = [230, 160, 30];
  const eyePupil  = [12, 6, 2];
  const clawCol   = [155, 138, 110];

  setSeed(77);

  // 1. GROUND SHADOW
  ambientOcclusion(ctx, w * 0.50, h * 0.86, w * 0.42, h * 0.06, 0.40);
  ambientOcclusion(ctx, w * 0.28, h * 0.82, w * 0.14, h * 0.04, 0.28);

  // 2. FAR LIMBS — behind body, slightly lighter so they read against dark bg
  const farFrontLeg = skeleton.limbs[0];
  const farRearLeg  = skeleton.limbs[2];
  drawLimbChain(ctx, farFrontLeg.segments, w, h, `rgb(62,38,16)`);
  drawLimbChain(ctx, farRearLeg.segments,  w, h, `rgb(62,38,16)`);

  // Far leg claws
  for (const limb of [farFrontLeg, farRearLeg]) {
    const foot = limb.segments[limb.segments.length - 1];
    ctx.fillStyle = `rgba(${clawCol},0.55)`;
    for (let c = -1; c <= 1; c++) {
      ctx.beginPath();
      ctx.moveTo(w * foot.x + c * w * 0.010, h * foot.y);
      ctx.lineTo(w * foot.x + c * w * 0.008 - w * 0.020, h * foot.y + h * 0.028);
      ctx.lineTo(w * foot.x + c * w * 0.012, h * foot.y + h * 0.016);
      ctx.closePath();
      ctx.fill();
    }
  }

  // 3. BODY — wide sausage shape
  const bodyFill = bodyGrad3(ctx, w * 0.52, h * 0.44, w * 0.32,
    bodyMid[0], bodyMid[1], bodyMid[2],
    bodyDark[0], bodyDark[1], bodyDark[2],
    bodyLight[0], bodyLight[1], bodyLight[2]);
  drawBodyOutline(ctx, skeleton.spine, w, h, bodyFill);

  // Belly underside — lighter, warmer
  ctx.fillStyle = bodyGrad3(ctx, w * 0.52, h * 0.58, w * 0.28,
    Math.floor(bodyMid[0]*1.2), Math.floor(bodyMid[1]*1.1), Math.floor(bodyMid[2]*0.9),
    bodyDark[0], bodyDark[1], bodyDark[2],
    Math.floor(bodyLight[0]*1.1), Math.floor(bodyLight[1]*1.05), Math.floor(bodyLight[2]*0.9));
  ctx.beginPath();
  ctx.moveTo(w * 0.20, h * 0.62);
  ctx.bezierCurveTo(w * 0.32, h * 0.68, w * 0.52, h * 0.68, w * 0.72, h * 0.66);
  ctx.bezierCurveTo(w * 0.80, h * 0.62, w * 0.84, h * 0.58, w * 0.84, h * 0.54);
  ctx.bezierCurveTo(w * 0.72, h * 0.56, w * 0.52, h * 0.58, w * 0.26, h * 0.58);
  ctx.closePath();
  ctx.fill();

  // 4. SCALE TEXTURE — irregular scale marks
  setSeed(77);
  ctx.fillStyle = `rgba(${scaleAcc},0.45)`;
  for (let i = 0; i < 80; i++) {
    const sx = 0.20 + rand() * 0.60;
    const sy = 0.36 + rand() * 0.26;
    const sr = 0.008 + rand() * 0.012;
    // Only draw scales in body region
    if (Math.abs(sx - 0.52) + Math.abs(sy - 0.46) * 1.5 > 0.40) continue;
    fillEllipse(ctx, w * sx, h * sy, w * sr, h * (sr * 0.6));
  }
  // Scale highlight row
  ctx.strokeStyle = `rgba(${bodyHi},0.18)`;
  ctx.lineWidth = Math.max(1, w * 0.003);
  for (const [x1, y1, x2, y2] of [
    [0.36, 0.38, 0.55, 0.36], [0.55, 0.38, 0.72, 0.40],
    [0.36, 0.46, 0.56, 0.44], [0.56, 0.44, 0.74, 0.46],
    [0.38, 0.54, 0.58, 0.52], [0.58, 0.52, 0.76, 0.54],
  ]) {
    ctx.beginPath(); ctx.moveTo(w*x1, h*y1); ctx.lineTo(w*x2, h*y2); ctx.stroke();
  }

  // 5. DORSAL QUILL SPINES — row of triangular spines from neck to tail
  // Spine positions follow the spine nodes
  const quillPoints = [
    [neck.x,     neck.y - 0.04,     0.048, 0.100],  // neck start
    [0.41,       0.36,              0.042, 0.095],
    [shoulder.x, shoulder.y - 0.06, 0.038, 0.090],
    [0.53,       0.34,              0.034, 0.082],
    [mid.x,      mid.y - 0.06,      0.030, 0.076],
    [0.66,       0.34,              0.026, 0.068],
    [hip.x,      hip.y - 0.08,      0.022, 0.060],
    [tail.x,     tail.y - 0.06,     0.018, 0.050],
    [tailtip.x,  tailtip.y - 0.03,  0.012, 0.036],
  ];

  // Draw quills back-to-front (shadow pass)
  for (const [qx, qy, hw, qh] of quillPoints) {
    ctx.fillStyle = `rgb(${spineDark})`;
    ctx.beginPath();
    ctx.moveTo(w * (qx - hw), h * (qy + qh * 0.3));
    ctx.bezierCurveTo(
      w * (qx - hw * 0.5), h * (qy - qh * 0.1),
      w * (qx + hw * 0.2), h * (qy - qh),
      w * qx,              h * (qy - qh)
    );
    ctx.bezierCurveTo(
      w * (qx - hw * 0.1), h * (qy - qh),
      w * (qx + hw * 0.3), h * (qy - qh * 0.1),
      w * (qx + hw),       h * (qy + qh * 0.3)
    );
    ctx.bezierCurveTo(
      w * (qx + hw * 0.4), h * (qy + qh * 0.5),
      w * (qx - hw * 0.4), h * (qy + qh * 0.5),
      w * (qx - hw),       h * (qy + qh * 0.3)
    );
    ctx.closePath();
    ctx.fill();
    // Quill highlight
    ctx.strokeStyle = `rgba(${spineLight},0.60)`;
    ctx.lineWidth = Math.max(1, w * 0.003);
    ctx.beginPath();
    ctx.moveTo(w * (qx - hw * 0.1), h * (qy + qh * 0.1));
    ctx.lineTo(w * qx, h * (qy - qh * 0.95));
    ctx.stroke();
  }

  // 6. HEAD — massive flat rectangular skull
  const hx = head.x, hy = head.y, hr = head.radius;
  ctx.fillStyle = bodyGrad3(ctx, w * hx, h * (hy - hr * 0.2), w * hr * 2.2,
    bodyMid[0], bodyMid[1], bodyMid[2],
    bodyDark[0], bodyDark[1], bodyDark[2],
    bodyLight[0], bodyLight[1], bodyLight[2]);
  // Wide flat head shape — rectangular with rounded front
  ctx.beginPath();
  ctx.moveTo(w * (hx + hr * 1.3), h * (hy - hr * 0.5));  // right top
  ctx.bezierCurveTo(
    w * (hx + hr * 0.8), h * (hy - hr * 0.9),
    w * (hx - hr * 0.6), h * (hy - hr * 0.8),
    w * (hx - hr * 1.1), h * (hy - hr * 0.2) // left upper corner
  );
  ctx.bezierCurveTo(
    w * (hx - hr * 1.4), h * (hy + hr * 0.2),
    w * (hx - hr * 1.2), h * (hy + hr * 0.7),
    w * (hx - hr * 0.7), h * (hy + hr * 0.9) // left lower corner
  );
  ctx.bezierCurveTo(
    w * (hx + hr * 0.2), h * (hy + hr * 1.0),
    w * (hx + hr * 1.0), h * (hy + hr * 0.7),
    w * (hx + hr * 1.3), h * (hy + hr * 0.3) // right bottom
  );
  ctx.closePath();
  ctx.fill();

  // Head scale texture bumps
  ctx.fillStyle = `rgba(${scaleAcc},0.50)`;
  setSeed(88);
  for (let i = 0; i < 18; i++) {
    const bx = (hx - hr * 1.0) + rand() * hr * 2.2;
    const by = (hy - hr * 0.7) + rand() * hr * 1.4;
    fillEllipse(ctx, w*bx, h*by, w*0.012, h*0.008);
  }

  // Head ridges — raised brow ridges
  ctx.strokeStyle = `rgba(${bodyHi},0.35)`;
  ctx.lineWidth = Math.max(2, w * 0.007);
  ctx.beginPath();
  ctx.moveTo(w * (hx + hr * 0.8), h * (hy - hr * 0.4));
  ctx.bezierCurveTo(w * (hx - hr * 0.1), h * (hy - hr * 0.6), w * (hx - hr * 0.8), h * (hy - hr * 0.4), w * (hx - hr * 1.0), h * (hy - hr * 0.1));
  ctx.stroke();

  // Head quill spines (3 on top of skull)
  for (const [ox, oy, ow, oh] of [
    [hx - hr * 0.6, hy - hr * 0.8, 0.022, 0.065],
    [hx - hr * 0.1, hy - hr * 0.9, 0.024, 0.075],
    [hx + hr * 0.4, hy - hr * 0.7, 0.020, 0.058],
  ]) {
    ctx.fillStyle = `rgb(${spineDark})`;
    ctx.beginPath();
    ctx.moveTo(w * (ox - ow), h * (oy + oh * 0.4));
    ctx.lineTo(w * ox, h * (oy - oh));
    ctx.lineTo(w * (ox + ow), h * (oy + oh * 0.4));
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = `rgba(${spineLight},0.5)`;
    ctx.lineWidth = Math.max(1, w * 0.002);
    ctx.beginPath(); ctx.moveTo(w*(ox-ow*0.1), h*(oy+oh*0.2)); ctx.lineTo(w*ox, h*(oy-oh*0.9)); ctx.stroke();
  }

  // 7. OPEN JAWS — upper and lower jaw, mouth cavity, teeth
  const sx = snout.x, sy = snout.y;
  // Mouth cavity
  ctx.fillStyle = `rgb(${mouthDark})`;
  ctx.beginPath();
  ctx.moveTo(w * (hx - hr * 0.4), h * (hy + hr * 0.1));  // upper jaw root
  ctx.bezierCurveTo(
    w * (sx + 0.06), h * (hy - 0.02),
    w * (sx - 0.04), h * (sy - 0.04),
    w * (sx - 0.04), h * sy
  );
  ctx.bezierCurveTo(
    w * (sx - 0.04), h * (sy + 0.04),
    w * (sx + 0.04), h * (sy + 0.08),
    w * (hx - hr * 0.2), h * (hy + hr * 0.8)
  );
  ctx.bezierCurveTo(
    w * (hx + hr * 0.2), h * (hy + hr * 0.7),
    w * (hx + hr * 0.3), h * (hy + hr * 0.3),
    w * (hx - hr * 0.4), h * (hy + hr * 0.1)
  );
  ctx.fill();
  // Mouth red interior
  ctx.fillStyle = `rgba(${mouthRed},0.60)`;
  fillEllipse(ctx, w * (sx + 0.02), h * (sy + 0.02), w * 0.06, h * 0.035);

  // Upper jaw
  ctx.fillStyle = bodyGrad3(ctx, w*(sx+0.04), h*(hy+0.02), w*0.10,
    bodyMid[0], bodyMid[1], bodyMid[2],
    bodyDark[0], bodyDark[1], bodyDark[2],
    bodyLight[0], bodyLight[1], bodyLight[2]);
  ctx.beginPath();
  ctx.moveTo(w * (hx - hr * 0.5), h * (hy - hr * 0.2)); // jaw root top
  ctx.bezierCurveTo(w*(sx+0.05), h*(hy-0.04), w*(sx-0.02), h*(sy-0.06), w*(sx-0.05), h*sy); // upper edge
  ctx.bezierCurveTo(w*(sx+0.00), h*(sy+0.02), w*(sx+0.06), h*(sy-0.02), w*(hx-hr*0.3), h*(hy+hr*0.15)); // lower edge
  ctx.bezierCurveTo(w*(hx+hr*0.1), h*(hy+hr*0.1), w*(hx+hr*0.1), h*(hy-hr*0.2), w*(hx-hr*0.5), h*(hy-hr*0.2));
  ctx.fill();

  // Lower jaw hangs open
  ctx.fillStyle = bodyGrad3(ctx, w*(sx+0.04), h*(sy+0.06), w*0.09,
    bodyMid[0], bodyMid[1], bodyMid[2],
    bodyDark[0], bodyDark[1], bodyDark[2],
    bodyLight[0], bodyLight[1], bodyLight[2]);
  ctx.beginPath();
  ctx.moveTo(w*(hx-hr*0.3), h*(hy+hr*0.4));  // jaw root
  ctx.bezierCurveTo(w*(sx+0.06), h*(sy+0.02), w*(sx-0.02), h*(sy+0.04), w*(sx-0.04), h*(sy+0.06));
  ctx.bezierCurveTo(w*(sx-0.01), h*(sy+0.12), w*(sx+0.06), h*(sy+0.10), w*(hx-hr*0.2), h*(hy+hr*0.80));
  ctx.bezierCurveTo(w*(hx+hr*0.2), h*(hy+hr*0.72), w*(hx+hr*0.2), h*(hy+hr*0.4), w*(hx-hr*0.3), h*(hy+hr*0.4));
  ctx.fill();

  // Upper teeth — multiple rows, prominent
  ctx.fillStyle = `rgb(${teethCol})`;
  for (let t = 0; t < 6; t++) {
    const tx = (sx - 0.04) + t * 0.035;
    const ty = sy + 0.01;
    const tlen = t < 2 ? 0.028 : 0.020;
    ctx.beginPath();
    ctx.moveTo(w * tx, h * ty);
    ctx.lineTo(w * (tx + 0.007), h * (ty + tlen));
    ctx.lineTo(w * (tx + 0.015), h * ty);
    ctx.closePath();
    ctx.fill();
  }
  // Lower teeth
  for (let t = 0; t < 5; t++) {
    const tx = (sx - 0.02) + t * 0.036;
    const ty = sy + 0.06;
    const tlen = 0.022;
    ctx.beginPath();
    ctx.moveTo(w * tx, h * ty);
    ctx.lineTo(w * (tx + 0.007), h * (ty - tlen));
    ctx.lineTo(w * (tx + 0.015), h * ty);
    ctx.closePath();
    ctx.fill();
  }

  // Forked tongue
  ctx.strokeStyle = `rgb(${tongueCol})`;
  ctx.lineWidth = Math.max(2, w * 0.006);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(w * (sx + 0.01), h * (sy + 0.04));
  ctx.lineTo(w * (sx - 0.08), h * (sy + 0.03));
  ctx.stroke();
  ctx.lineWidth = Math.max(1.5, w * 0.004);
  ctx.beginPath(); // fork top
  ctx.moveTo(w*(sx-0.08), h*(sy+0.03));
  ctx.lineTo(w*(sx-0.13), h*(sy));
  ctx.stroke();
  ctx.beginPath(); // fork bottom
  ctx.moveTo(w*(sx-0.08), h*(sy+0.03));
  ctx.lineTo(w*(sx-0.13), h*(sy+0.06));
  ctx.stroke();

  // 8. EYES — large amber with vertical slit pupil
  const eyeX = hx - hr * 0.38, eyeY = hy - hr * 0.10;
  // Eye glow
  const glow = ctx.createRadialGradient(w*eyeX, h*eyeY, 0, w*eyeX, h*eyeY, w*0.055);
  glow.addColorStop(0, `rgba(${eyeAmber},0.50)`);
  glow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glow;
  fillCircle(ctx, w*eyeX, h*eyeY, w*0.055);
  // Outer eye
  ctx.fillStyle = `rgb(${eyeAmber})`;
  fillCircle(ctx, w*eyeX, h*eyeY, w*0.026);
  // Vertical slit pupil
  ctx.fillStyle = `rgb(${eyePupil})`;
  ctx.beginPath();
  ctx.ellipse(w*eyeX, h*eyeY, w*0.007, h*0.018, 0, 0, Math.PI*2);
  ctx.fill();
  // Eye highlight
  ctx.fillStyle = 'rgba(255,240,200,0.55)';
  fillCircle(ctx, w*(eyeX-0.006), h*(eyeY-0.008), w*0.006);

  // 9. NEAR LIMBS — in front of body, warmer than far legs
  const nearFrontLeg = skeleton.limbs[1];
  const nearRearLeg  = skeleton.limbs[3];
  drawLimbChain(ctx, nearFrontLeg.segments, w, h, `rgb(${bodyLight})`);
  drawLimbChain(ctx, nearRearLeg.segments,  w, h, `rgb(${bodyLight})`);

  // Near leg claws — pointing forward (left)
  for (const limb of [nearFrontLeg, nearRearLeg]) {
    const foot = limb.segments[limb.segments.length - 1];
    const isFront = limb === nearFrontLeg;
    ctx.fillStyle = `rgb(${clawCol})`;
    for (let c = -1; c <= 1; c++) {
      const clawDirX = isFront ? -0.022 : -0.018;
      ctx.beginPath();
      ctx.moveTo(w * foot.x + c * w * 0.010, h * foot.y);
      ctx.lineTo(w * foot.x + c * w * 0.008 + w * clawDirX, h * foot.y + h * 0.028);
      ctx.lineTo(w * foot.x + c * w * 0.012, h * foot.y + h * 0.016);
      ctx.closePath();
      ctx.fill();
    }
  }

  // 10. HIGHLIGHTS
  highlight(ctx, w * 0.48, h * 0.38, w * 0.10, `rgba(${bodyHi},0.20)`, 0.28);
  highlight(ctx, w * 0.62, h * 0.40, w * 0.08, `rgba(${bodyHi},0.16)`, 0.24);
  ambientOcclusion(ctx, w * 0.42, h * 0.64, w * 0.16, h * 0.04, 0.26);
}

const GRID_W = 12;
const GRID_H = 8;

export default { draw: drawBasiliskClean, skeleton: basiliskSkeleton, gridW: GRID_W, gridH: GRID_H };

if (typeof document !== 'undefined' && document.getElementById('canvas-size')) {
function render(elapsed = 0) {
  const size = parseInt(document.getElementById('canvas-size').value, 10);
  const cellSize = parseInt(document.getElementById('cell-size').value, 10);
  const showGrid = document.getElementById('show-grid').checked;
  const showDebug = document.getElementById('show-debug').checked;
  const sk = basiliskSkeleton;

  const canvasW = size;
  const canvasH = Math.round(size * GRID_H / GRID_W);
  const maxDisplay = 420;
  const displayW = `${Math.min(canvasW, maxDisplay)}px`;
  const displayH = `${Math.min(canvasH, Math.round(maxDisplay * GRID_H / GRID_W))}px`;

  const asciiOpts = { elapsed, cellSize, level: 7, gridWidth: GRID_W, gridHeight: GRID_H };

  const c1 = document.getElementById('skel-raw');
  c1.width = canvasW; c1.height = canvasH;
  c1.style.width = displayW; c1.style.height = displayH;
  const ctx1 = c1.getContext('2d');
  ctx1.fillStyle = '#000'; ctx1.fillRect(0, 0, canvasW, canvasH);
  if (sk.limbs) {
    for (let i = 0; i < sk.limbs.length; i += 2) drawLimbChain(ctx1, sk.limbs[i].segments, canvasW, canvasH, 'rgb(42,28,52)');
  }
  drawBodyOutline(ctx1, sk.spine, canvasW, canvasH, 'rgb(68,52,112)');
  if (sk.limbs) {
    for (let i = 1; i < sk.limbs.length; i += 2) drawLimbChain(ctx1, sk.limbs[i].segments, canvasW, canvasH, 'rgb(92,74,142)');
  }
  if (showDebug) drawDebugSkeleton(ctx1, sk, canvasW, canvasH);

  const c2 = document.getElementById('next-ascii');
  c2.width = canvasW; c2.height = canvasH;
  c2.style.width = displayW; c2.style.height = displayH;
  const ctx2 = c2.getContext('2d');
  ctx2.fillStyle = '#000'; ctx2.fillRect(0, 0, canvasW, canvasH);
  renderAscii(ctx2, (tctx, tw, th) => {
    drawBasiliskClean(tctx, sk, tw, th);
  }, 0, 0, canvasW, canvasH, asciiOpts);

  const c3 = document.getElementById('next-raw');
  c3.width = canvasW; c3.height = canvasH;
  c3.style.width = displayW; c3.style.height = displayH;
  const ctx3 = c3.getContext('2d');
  ctx3.fillStyle = '#000'; ctx3.fillRect(0, 0, canvasW, canvasH);
  drawBasiliskClean(ctx3, sk, canvasW, canvasH);

  if (showGrid) {
    for (const canvas of [c1, c2, c3]) {
      const gctx = canvas.getContext('2d');
      gctx.strokeStyle = 'rgba(255,255,255,0.08)'; gctx.lineWidth = 1;
      const step = canvasW / 10;
      for (let x = 0; x <= canvasW; x += step) { gctx.beginPath(); gctx.moveTo(x, 0); gctx.lineTo(x, canvasH); gctx.stroke(); }
      for (let y = 0; y <= canvasH; y += step) { gctx.beginPath(); gctx.moveTo(0, y); gctx.lineTo(canvasW, y); gctx.stroke(); }
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

document.getElementById('reseed').addEventListener('click', () => render(animating ? performance.now() - animStart : 0));
document.getElementById('animate').addEventListener('change', (event) => {
  animating = event.target.checked;
  if (animating) { animStart = performance.now(); rafId = requestAnimationFrame(animationLoop); }
  else { if (rafId) { cancelAnimationFrame(rafId); render(0); } }
});
for (const id of ['canvas-size', 'cell-size', 'show-grid', 'show-debug']) {
  document.getElementById(id).addEventListener('change', () => render(animating ? performance.now() - animStart : 0));
}

render();
}
