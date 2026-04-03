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
// BASILISK SKELETON — zone boss, low-slung wide quadruped, massive head
// Head RAISED in threat pose, weight forward, facing LEFT
// ==========================================================================
export const basiliskSkeleton = {
  spine: [
    { id: 'snout',    x: 0.10, y: 0.56, radius: 0.024 },  // jaw tip — far left, drops
    { id: 'head',     x: 0.20, y: 0.36, radius: 0.116 },  // MASSIVE raised skull
    { id: 'neck',     x: 0.34, y: 0.42, radius: 0.082 },  // thick neck, head cocked forward
    { id: 'shoulder', x: 0.47, y: 0.40, radius: 0.114 },  // heavy front body
    { id: 'mid',      x: 0.60, y: 0.43, radius: 0.102 },  // mid body
    { id: 'hip',      x: 0.73, y: 0.48, radius: 0.090 },  // rear body
    { id: 'tail',     x: 0.86, y: 0.36, radius: 0.042 },  // tail lifts
    { id: 'tailtip',  x: 0.96, y: 0.24, radius: 0.016 },  // tip curls high
  ],
  limbs: [
    // Far front leg
    { attach: 'shoulder', side: 'far', segments: [
      { x: 0.52, y: 0.54, radius: 0.054 },
      { x: 0.56, y: 0.67, radius: 0.040 },
      { x: 0.58, y: 0.80, radius: 0.026 },
    ]},
    // Near front leg — planted forward, supporting the forward lean
    { attach: 'shoulder', side: 'near', segments: [
      { x: 0.36, y: 0.56, radius: 0.064 },
      { x: 0.28, y: 0.68, radius: 0.048 },
      { x: 0.22, y: 0.80, radius: 0.032 },
    ]},
    // Far rear leg
    { attach: 'hip', side: 'far', segments: [
      { x: 0.79, y: 0.58, radius: 0.052 },
      { x: 0.84, y: 0.69, radius: 0.038 },
      { x: 0.87, y: 0.80, radius: 0.024 },
    ]},
    // Near rear leg
    { attach: 'hip', side: 'near', segments: [
      { x: 0.67, y: 0.58, radius: 0.060 },
      { x: 0.65, y: 0.71, radius: 0.044 },
      { x: 0.62, y: 0.82, radius: 0.028 },
    ]},
  ],
};

// ==========================================================================
// DRAW — zone boss. Heavy armored plates, dominant amber gaze, raised threat pose.
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

  // PALETTE
  const bodyDark   = [28, 16, 6];
  const bodyMid    = [82, 48, 18];
  const bodyLight  = [128, 84, 36];
  const bodyHi     = [168, 120, 58];
  const plateLight = [148, 104, 50];
  const plateDark  = [44, 26, 10];
  const spineDark  = [52, 32, 12];
  const spineLight = [110, 80, 38];
  const mouthDark  = [22, 8, 8];
  const mouthRed   = [80, 28, 20];
  const teethCol   = [210, 198, 172];
  const tongueCol  = [170, 40, 40];
  const eyeAmber   = [240, 168, 20];
  const eyeGlow    = [255, 200, 50];
  const eyePupil   = [10, 4, 2];
  const clawCol    = [148, 132, 104];

  setSeed(77);

  // -------------------------------------------------------------------------
  // 1. HEAVY GROUND SHADOW — boss should feel anchored, massive
  // -------------------------------------------------------------------------
  ambientOcclusion(ctx, w * 0.52, h * 0.88, w * 0.50, h * 0.07, 0.55);
  ambientOcclusion(ctx, w * 0.52, h * 0.88, w * 0.36, h * 0.04, 0.35);
  ambientOcclusion(ctx, w * 0.24, h * 0.84, w * 0.16, h * 0.04, 0.32);

  // -------------------------------------------------------------------------
  // 2. FAR LIMBS — draw as tapered shapes, not just circles
  // -------------------------------------------------------------------------
  function drawLeg(pts, darkCol, lightCol) {
    // pts: [[x,y], [x,y], [x,y]] in 0-1 coords
    const [a, b, c] = pts;
    const thighW = 0.052, kneeW = 0.036, ankleW = 0.022;

    // Perpendicular helper
    function perp(p1, p2, len) {
      const dx = p2[0]-p1[0], dy = p2[1]-p1[1];
      const d = Math.sqrt(dx*dx+dy*dy) || 0.001;
      return [-dy/d*len, dx/d*len];
    }

    const pa = perp(a, b, thighW);
    const pb = perp(a, b, kneeW);
    const pc = perp(b, c, kneeW);
    const pd = perp(b, c, ankleW);

    const g = ctx.createLinearGradient(w*a[0], h*a[1], w*c[0], h*c[1]);
    g.addColorStop(0,   `rgb(${lightCol})`);
    g.addColorStop(0.5, `rgb(${darkCol})`);
    g.addColorStop(1,   `rgba(${darkCol},0.7)`);

    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(w*(a[0]+pa[0]), h*(a[1]+pa[1]));
    ctx.lineTo(w*(b[0]+pb[0]), h*(b[1]+pb[1]));
    ctx.lineTo(w*(c[0]+pd[0]), h*(c[1]+pd[1]));
    ctx.lineTo(w*(c[0]-pd[0]), h*(c[1]-pd[1]));
    ctx.lineTo(w*(b[0]-pc[0]), h*(b[1]-pc[1]));
    ctx.lineTo(w*(a[0]-pa[0]), h*(a[1]-pa[1]));
    ctx.closePath();
    ctx.fill();
  }

  const farFLeg = [[0.52,0.54],[0.56,0.67],[0.58,0.80]];
  const farRLeg = [[0.79,0.58],[0.84,0.69],[0.87,0.80]];
  const nearFLeg = [[0.36,0.56],[0.28,0.68],[0.22,0.80]];
  const nearRLeg = [[0.67,0.58],[0.65,0.71],[0.62,0.82]];

  drawLeg(farFLeg,  `${plateDark}`, `${bodyMid}`);
  drawLeg(farRLeg,  `${plateDark}`, `${bodyMid}`);

  // Far leg claws
  for (const foot of [[0.58,0.80],[0.87,0.80]]) {
    ctx.fillStyle = `rgba(${clawCol},0.50)`;
    for (let c2 = -1; c2 <= 1; c2++) {
      ctx.beginPath();
      ctx.moveTo(w*foot[0]+c2*w*0.010, h*foot[1]);
      ctx.lineTo(w*foot[0]+c2*w*0.006 - w*0.022, h*foot[1]+h*0.030);
      ctx.lineTo(w*foot[0]+c2*w*0.012, h*foot[1]+h*0.014);
      ctx.closePath();
      ctx.fill();
    }
  }

  // -------------------------------------------------------------------------
  // 3. BODY MASS — with strong dorsal/ventral gradient
  // -------------------------------------------------------------------------
  const bodyFill = bodyGrad3(ctx, w*0.50, h*0.38, w*0.34,
    bodyLight[0], bodyLight[1], bodyLight[2],
    bodyDark[0],  bodyDark[1],  bodyDark[2],
    bodyHi[0],    bodyHi[1],    bodyHi[2]);
  drawBodyOutline(ctx, skeleton.spine, w, h, bodyFill);

  // Belly — warmer, lighter underside
  const bellyG = ctx.createLinearGradient(w*0.20, h*0.60, w*0.20, h*0.80);
  bellyG.addColorStop(0,   `rgba(${bodyMid},0.9)`);
  bellyG.addColorStop(0.6, `rgba(${bodyDark},0.5)`);
  bellyG.addColorStop(1,   'rgba(0,0,0,0)');
  ctx.fillStyle = bellyG;
  ctx.beginPath();
  ctx.moveTo(w*0.16, h*0.62);
  ctx.bezierCurveTo(w*0.28, h*0.70, w*0.50, h*0.72, w*0.74, h*0.68);
  ctx.bezierCurveTo(w*0.82, h*0.64, w*0.86, h*0.58, w*0.84, h*0.54);
  ctx.bezierCurveTo(w*0.72, h*0.58, w*0.50, h*0.62, w*0.22, h*0.60);
  ctx.closePath();
  ctx.fill();

  // -------------------------------------------------------------------------
  // 4. ARMORED PLATE RIDGES — rows of overlapping plates across back
  // -------------------------------------------------------------------------
  // Each row: series of overlapping teardrop/scale shapes
  const plateRows = [
    // [centerY, xStart, xEnd, scaleHeight, count, alpha]
    [0.34, 0.36, 0.74, 0.048, 9, 0.70],   // top dorsal ridge plates
    [0.38, 0.32, 0.76, 0.036, 10, 0.55],  // second row
    [0.44, 0.28, 0.78, 0.028, 11, 0.40],  // mid flank
    [0.50, 0.26, 0.76, 0.020, 10, 0.28],  // lower flank
  ];

  for (const [py, x0, x1, sh, count, alpha] of plateRows) {
    const step = (x1 - x0) / count;
    for (let i = 0; i < count; i++) {
      const px = x0 + i * step;
      const isDark = i % 2 === 0;
      ctx.fillStyle = `rgba(${isDark ? plateDark : plateLight},${alpha})`;
      ctx.beginPath();
      ctx.moveTo(w*(px - step*0.30), h*py);
      ctx.bezierCurveTo(
        w*(px - step*0.10), h*(py - sh),
        w*(px + step*0.10), h*(py - sh),
        w*(px + step*0.30), h*py
      );
      ctx.bezierCurveTo(
        w*(px + step*0.20), h*(py + sh*0.3),
        w*(px - step*0.20), h*(py + sh*0.3),
        w*(px - step*0.30), h*py
      );
      ctx.closePath();
      ctx.fill();
    }
  }

  // Ridge highlight line down center of back
  ctx.strokeStyle = `rgba(${bodyHi},0.28)`;
  ctx.lineWidth = Math.max(2, w*0.005);
  ctx.beginPath();
  ctx.moveTo(w*0.34, h*0.30);
  ctx.bezierCurveTo(w*0.50, h*0.28, w*0.65, h*0.30, w*0.82, h*0.30);
  ctx.stroke();

  // -------------------------------------------------------------------------
  // 5. DORSAL QUILL SPINES — graduated size, biggest at neck, tapering to tail
  // -------------------------------------------------------------------------
  const quillData = [
    // [x, y_base, halfW, height]  — bigger at neck/shoulder, smaller toward tail
    [neck.x - 0.02,    neck.y - 0.04,      0.026, 0.115],
    [0.40,             0.30,               0.023, 0.108],
    [shoulder.x,       shoulder.y - 0.07,  0.021, 0.098],
    [0.53,             0.28,               0.019, 0.088],
    [mid.x,            mid.y - 0.07,       0.017, 0.078],
    [0.67,             0.30,               0.015, 0.066],
    [hip.x,            hip.y - 0.09,       0.013, 0.054],
    [tail.x,           tail.y - 0.06,      0.010, 0.042],
    [tailtip.x - 0.04, tailtip.y - 0.02,   0.007, 0.028],
  ];

  for (const [qx, qy, hw, qh] of quillData) {
    // Dark base
    ctx.fillStyle = `rgb(${spineDark})`;
    ctx.beginPath();
    ctx.moveTo(w*(qx - hw*0.9), h*(qy + qh*0.25));
    ctx.bezierCurveTo(
      w*(qx - hw*0.4), h*(qy - qh*0.2),
      w*(qx - hw*0.1), h*(qy - qh),
      w*qx,            h*(qy - qh)
    );
    ctx.bezierCurveTo(
      w*(qx + hw*0.1), h*(qy - qh),
      w*(qx + hw*0.4), h*(qy - qh*0.2),
      w*(qx + hw*0.9), h*(qy + qh*0.25)
    );
    ctx.bezierCurveTo(
      w*(qx + hw*0.4), h*(qy + qh*0.5),
      w*(qx - hw*0.4), h*(qy + qh*0.5),
      w*(qx - hw*0.9), h*(qy + qh*0.25)
    );
    ctx.closePath();
    ctx.fill();
    // Highlight streak
    ctx.strokeStyle = `rgba(${spineLight},0.65)`;
    ctx.lineWidth = Math.max(1, w*0.003);
    ctx.beginPath();
    ctx.moveTo(w*(qx - hw*0.05), h*(qy + qh*0.1));
    ctx.lineTo(w*qx, h*(qy - qh*0.92));
    ctx.stroke();
  }

  // -------------------------------------------------------------------------
  // 6. MASSIVE HEAD — wide flat croc skull, raised in threat pose
  // -------------------------------------------------------------------------
  const hx = head.x, hy = head.y, hr = head.radius;

  // Head base gradient — lit from above left
  const headG = bodyGrad3(ctx, w*(hx - hr*0.4), h*(hy - hr*0.5), w*hr*2.4,
    bodyLight[0], bodyLight[1], bodyLight[2],
    bodyDark[0],  bodyDark[1],  bodyDark[2],
    bodyHi[0],    bodyHi[1],    bodyHi[2]);

  // Wide flat skull shape — much wider than tall, like komodo/croc
  ctx.fillStyle = headG;
  ctx.beginPath();
  ctx.moveTo(w*(hx + hr*1.6), h*(hy - hr*0.30));  // right back top
  ctx.bezierCurveTo(
    w*(hx + hr*0.8), h*(hy - hr*0.80),
    w*(hx - hr*0.4), h*(hy - hr*0.90),
    w*(hx - hr*1.0), h*(hy - hr*0.50)   // left upper
  );
  ctx.bezierCurveTo(
    w*(hx - hr*1.4), h*(hy - hr*0.10),
    w*(hx - hr*1.3), h*(hy + hr*0.50),
    w*(hx - hr*0.8), h*(hy + hr*0.75)   // jaw hinge left
  );
  ctx.bezierCurveTo(
    w*(hx + hr*0.3), h*(hy + hr*0.85),
    w*(hx + hr*1.3), h*(hy + hr*0.65),
    w*(hx + hr*1.6), h*(hy + hr*0.20)   // right back bottom
  );
  ctx.closePath();
  ctx.fill();

  // Strong brow ridge — angular, boss-like
  const browG = ctx.createLinearGradient(w*(hx+hr*1.4), h*(hy-hr*0.4), w*(hx-hr*1.0), h*(hy+hr*0.1));
  browG.addColorStop(0, `rgba(${bodyHi},0.0)`);
  browG.addColorStop(0.3, `rgba(${bodyHi},0.45)`);
  browG.addColorStop(1, `rgba(${bodyHi},0.0)`);
  ctx.fillStyle = browG;
  ctx.beginPath();
  ctx.moveTo(w*(hx + hr*1.5), h*(hy - hr*0.28));
  ctx.bezierCurveTo(w*(hx + hr*0.6), h*(hy - hr*0.60), w*(hx - hr*0.2), h*(hy - hr*0.70), w*(hx - hr*0.9), h*(hy - hr*0.38));
  ctx.bezierCurveTo(w*(hx - hr*0.5), h*(hy - hr*0.22), w*(hx + hr*0.5), h*(hy - hr*0.32), w*(hx + hr*1.5), h*(hy - hr*0.14));
  ctx.closePath();
  ctx.fill();

  // Head armor plates — irregular raised lumps
  setSeed(88);
  ctx.fillStyle = `rgba(${plateDark},0.50)`;
  for (let i = 0; i < 22; i++) {
    const bx = (hx - hr*1.1) + rand() * hr * 2.3;
    const by = (hy - hr*0.75) + rand() * hr * 1.4;
    fillEllipse(ctx, w*bx, h*by, w*0.014, h*0.009);
  }

  // Head quill spines (4 — bigger on a boss head)
  for (const [ox, oy, ow, oh] of [
    [hx - hr*0.80, hy - hr*0.86, 0.026, 0.085],
    [hx - hr*0.28, hy - hr*0.94, 0.030, 0.096],
    [hx + hr*0.28, hy - hr*0.80, 0.026, 0.078],
    [hx + hr*0.82, hy - hr*0.55, 0.020, 0.062],
  ]) {
    ctx.fillStyle = `rgb(${spineDark})`;
    ctx.beginPath();
    ctx.moveTo(w*(ox - ow), h*(oy + oh*0.4));
    ctx.lineTo(w*ox, h*(oy - oh));
    ctx.lineTo(w*(ox + ow), h*(oy + oh*0.4));
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = `rgba(${spineLight},0.55)`;
    ctx.lineWidth = Math.max(1, w*0.002);
    ctx.beginPath(); ctx.moveTo(w*(ox-ow*0.08), h*(oy+oh*0.2)); ctx.lineTo(w*ox, h*(oy-oh*0.92)); ctx.stroke();
  }

  // -------------------------------------------------------------------------
  // 7. OPEN JAWS — wide open, showing cavity depth
  // -------------------------------------------------------------------------
  const sx = snout.x, sy = snout.y;

  // Deep mouth cavity
  ctx.fillStyle = `rgb(${mouthDark})`;
  ctx.beginPath();
  ctx.moveTo(w*(hx - hr*0.55), h*(hy + hr*0.15));  // upper jaw root
  ctx.bezierCurveTo(
    w*(sx + 0.08), h*(hy + 0.00),
    w*(sx - 0.02), h*(sy - 0.06),
    w*sx,          h*sy
  );
  ctx.bezierCurveTo(
    w*(sx - 0.02), h*(sy + 0.06),
    w*(sx + 0.04), h*(sy + 0.10),
    w*(hx - hr*0.25), h*(hy + hr*0.90)
  );
  ctx.bezierCurveTo(
    w*(hx + hr*0.25), h*(hy + hr*0.80),
    w*(hx + hr*0.30), h*(hy + hr*0.30),
    w*(hx - hr*0.55), h*(hy + hr*0.15)
  );
  ctx.fill();

  // Mouth interior red glow
  const mouthG = ctx.createRadialGradient(w*(sx+0.04), h*(sy+0.02), 0, w*(sx+0.04), h*(sy+0.02), w*0.10);
  mouthG.addColorStop(0, `rgba(${mouthRed},0.80)`);
  mouthG.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = mouthG;
  fillEllipse(ctx, w*(sx+0.04), h*(sy+0.02), w*0.10, h*0.06);

  // Upper jaw
  ctx.fillStyle = bodyGrad3(ctx, w*(sx+0.05), h*(hy+0.02), w*0.12,
    bodyMid[0], bodyMid[1], bodyMid[2],
    bodyDark[0], bodyDark[1], bodyDark[2],
    bodyLight[0], bodyLight[1], bodyLight[2]);
  ctx.beginPath();
  ctx.moveTo(w*(hx - hr*0.62), h*(hy - hr*0.25));
  ctx.bezierCurveTo(w*(sx+0.06), h*(hy-0.04), w*(sx-0.01), h*(sy-0.08), w*(sx-0.03), h*sy);
  ctx.bezierCurveTo(w*(sx+0.02), h*(sy+0.02), w*(sx+0.08), h*(sy-0.02), w*(hx-hr*0.40), h*(hy+hr*0.20));
  ctx.bezierCurveTo(w*(hx+hr*0.10), h*(hy+hr*0.15), w*(hx+hr*0.10), h*(hy-hr*0.25), w*(hx-hr*0.62), h*(hy-hr*0.25));
  ctx.fill();

  // Lower jaw hangs open
  ctx.fillStyle = bodyGrad3(ctx, w*(sx+0.04), h*(sy+0.07), w*0.11,
    bodyMid[0], bodyMid[1], bodyMid[2],
    bodyDark[0], bodyDark[1], bodyDark[2],
    bodyLight[0], bodyLight[1], bodyLight[2]);
  ctx.beginPath();
  ctx.moveTo(w*(hx-hr*0.35), h*(hy+hr*0.50));
  ctx.bezierCurveTo(w*(sx+0.08), h*(sy+0.02), w*(sx-0.01), h*(sy+0.06), w*(sx-0.03), h*(sy+0.08));
  ctx.bezierCurveTo(w*(sx-0.01), h*(sy+0.14), w*(sx+0.08), h*(sy+0.12), w*(hx-hr*0.22), h*(hy+hr*0.88));
  ctx.bezierCurveTo(w*(hx+hr*0.22), h*(hy+hr*0.80), w*(hx+hr*0.22), h*(hy+hr*0.50), w*(hx-hr*0.35), h*(hy+hr*0.50));
  ctx.fill();

  // Upper teeth — boss has bigger, more irregular fangs
  ctx.fillStyle = `rgb(${teethCol})`;
  const upperTeeth = [
    [sx-0.03, sy+0.00, 0.035],
    [sx+0.02, sy+0.01, 0.030],
    [sx+0.07, sy+0.01, 0.025],
    [sx+0.12, sy+0.01, 0.022],
    [sx+0.17, sy+0.01, 0.020],
    [sx+0.22, sy+0.01, 0.018],
  ];
  for (const [tx, ty, tlen] of upperTeeth) {
    ctx.beginPath();
    ctx.moveTo(w*tx, h*ty);
    ctx.lineTo(w*(tx+0.008), h*(ty+tlen));
    ctx.lineTo(w*(tx+0.016), h*ty);
    ctx.closePath();
    ctx.fill();
  }
  // Lower teeth
  const lowerTeeth = [
    [sx+0.00, sy+0.08, 0.026],
    [sx+0.05, sy+0.09, 0.024],
    [sx+0.10, sy+0.09, 0.022],
    [sx+0.15, sy+0.09, 0.020],
    [sx+0.20, sy+0.09, 0.018],
  ];
  for (const [tx, ty, tlen] of lowerTeeth) {
    ctx.beginPath();
    ctx.moveTo(w*tx, h*ty);
    ctx.lineTo(w*(tx+0.008), h*(ty-tlen));
    ctx.lineTo(w*(tx+0.016), h*ty);
    ctx.closePath();
    ctx.fill();
  }

  // Forked tongue
  ctx.strokeStyle = `rgb(${tongueCol})`;
  ctx.lineWidth = Math.max(2, w*0.007);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(w*(sx+0.02), h*(sy+0.05));
  ctx.lineTo(w*(sx-0.08), h*(sy+0.04));
  ctx.stroke();
  ctx.lineWidth = Math.max(1.5, w*0.004);
  ctx.beginPath();
  ctx.moveTo(w*(sx-0.08), h*(sy+0.04));
  ctx.lineTo(w*(sx-0.14), h*(sy+0.00));
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(w*(sx-0.08), h*(sy+0.04));
  ctx.lineTo(w*(sx-0.14), h*(sy+0.08));
  ctx.stroke();

  // -------------------------------------------------------------------------
  // 8. THE BASILISK EYE — dominant, petrifying gaze, fills much of the face
  //    This is THE signature feature. Make it unmistakable.
  // -------------------------------------------------------------------------
  const eyeX = hx - hr*0.42, eyeY = hy - hr*0.14;
  const eyeR = w * 0.040;  // BIG — boss feature

  // Outer glow halo — amber light emanating from the petrifying gaze
  const outerGlow = ctx.createRadialGradient(w*eyeX, h*eyeY, 0, w*eyeX, h*eyeY, eyeR*3.2);
  outerGlow.addColorStop(0,   `rgba(${eyeGlow},0.55)`);
  outerGlow.addColorStop(0.4, `rgba(${eyeAmber},0.25)`);
  outerGlow.addColorStop(1,   'rgba(0,0,0,0)');
  ctx.fillStyle = outerGlow;
  ctx.beginPath();
  ctx.arc(w*eyeX, h*eyeY, eyeR*3.2, 0, Math.PI*2);
  ctx.fill();

  // Eye socket — dark recess
  ctx.fillStyle = `rgb(${bodyDark})`;
  ctx.beginPath();
  ctx.ellipse(w*eyeX, h*eyeY, eyeR*1.35, eyeR*1.2, 0, 0, Math.PI*2);
  ctx.fill();

  // Iris — amber
  const irisG = ctx.createRadialGradient(w*(eyeX-0.005), h*(eyeY-0.005), 0, w*eyeX, h*eyeY, eyeR);
  irisG.addColorStop(0,   `rgb(${eyeGlow})`);
  irisG.addColorStop(0.6, `rgb(${eyeAmber})`);
  irisG.addColorStop(1,   `rgb(178,108,10)`);
  ctx.fillStyle = irisG;
  ctx.beginPath();
  ctx.arc(w*eyeX, h*eyeY, eyeR, 0, Math.PI*2);
  ctx.fill();

  // Vertical slit pupil
  ctx.fillStyle = `rgb(${eyePupil})`;
  ctx.beginPath();
  ctx.ellipse(w*eyeX, h*eyeY, eyeR*0.18, eyeR*0.78, 0, 0, Math.PI*2);
  ctx.fill();

  // Eye rim catch-light
  ctx.strokeStyle = `rgba(${eyeGlow},0.60)`;
  ctx.lineWidth = Math.max(1.5, w*0.003);
  ctx.beginPath();
  ctx.arc(w*eyeX, h*eyeY, eyeR*1.02, 0, Math.PI*2);
  ctx.stroke();

  // Specular highlights on eye
  ctx.fillStyle = 'rgba(255,248,220,0.70)';
  fillCircle(ctx, w*(eyeX-0.010), h*(eyeY-0.012), w*0.009);
  ctx.fillStyle = 'rgba(255,248,220,0.30)';
  fillCircle(ctx, w*(eyeX+0.008), h*(eyeY+0.010), w*0.004);

  // -------------------------------------------------------------------------
  // 9. NEAR LIMBS — tapered shapes, brighter than far
  // -------------------------------------------------------------------------
  drawLeg(nearFLeg, `${bodyMid}`,  `${bodyLight}`);
  drawLeg(nearRLeg, `${bodyMid}`,  `${bodyLight}`);

  // Near leg claws
  for (const [footX, footY, isFront] of [[0.22,0.80,true],[0.62,0.82,false]]) {
    ctx.fillStyle = `rgb(${clawCol})`;
    const dirX = isFront ? -0.026 : -0.020;
    for (let c2 = -1; c2 <= 1; c2++) {
      ctx.beginPath();
      ctx.moveTo(w*footX + c2*w*0.010, h*footY);
      ctx.lineTo(w*footX + c2*w*0.006 + w*dirX, h*footY + h*0.032);
      ctx.lineTo(w*footX + c2*w*0.013, h*footY + h*0.016);
      ctx.closePath();
      ctx.fill();
    }
  }

  // -------------------------------------------------------------------------
  // 10. FINAL HIGHLIGHTS + AO
  // -------------------------------------------------------------------------
  // Dorsal lighting — top of back catches overhead cave light
  highlight(ctx, w*0.48, h*0.34, w*0.14, `rgba(${bodyHi},0.30)`, 0.30);
  highlight(ctx, w*0.62, h*0.36, w*0.10, `rgba(${bodyHi},0.22)`, 0.26);
  // Neck highlight
  highlight(ctx, w*0.34, h*0.36, w*0.08, `rgba(${bodyHi},0.25)`, 0.24);
  // Leg joint shadow
  ambientOcclusion(ctx, w*0.40, h*0.66, w*0.12, h*0.03, 0.24);
  ambientOcclusion(ctx, w*0.65, h*0.68, w*0.10, h*0.03, 0.22);
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

  const asciiOpts = { elapsed, cellSize, level: 11, gridWidth: GRID_W, gridHeight: GRID_H };

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
