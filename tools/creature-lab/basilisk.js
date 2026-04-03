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
    { id: 'hip',      x: 0.73, y: 0.48, radius: 0.090 },  // rear body — body outline stops here
  ],
  // tail drawn explicitly for boss-level control
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
// DRAW — toon/cel shading for ASCII renderer
//
// Luminance targets (renderer glow fires at lum > 0.72):
//   DEEP    [12,6,2]       lum 0.025  → empty/sparse chars
//   SHADOW  [48,28,9]      lum 0.11   → sparse chars
//   MID     [108,67,22]    lum 0.27   → medium chars
//   LIGHT   [188,145,60]   lum 0.59   → dense chars
//   HI      [232,194,98]   lum 0.77   → dense + GLOW
//   RIM     [252,234,165]  lum 0.92   → very dense + STRONG GLOW
// ==========================================================================
export function drawBasiliskClean(ctx, skeleton, w, h) {
  const snout    = skeleton.spine.find(n => n.id === 'snout');
  const head     = skeleton.spine.find(n => n.id === 'head');
  const neck     = skeleton.spine.find(n => n.id === 'neck');
  const shoulder = skeleton.spine.find(n => n.id === 'shoulder');
  const mid      = skeleton.spine.find(n => n.id === 'mid');
  const hip      = skeleton.spine.find(n => n.id === 'hip');

  // TOON PALETTE — discrete bands, not smooth gradients
  const DEEP   = 'rgb(12,6,2)';
  const SHADOW = 'rgb(48,28,9)';
  const MID    = 'rgb(108,67,22)';
  const LIGHT  = 'rgb(188,145,60)';
  const HI     = 'rgb(232,194,98)';
  const RIM    = 'rgb(252,234,165)';

  // Accent colors
  const SPINE_SHADOW = 'rgb(36,20,6)';
  const SPINE_RIM    = 'rgb(245,228,155)';
  const MOUTH_DEEP   = 'rgb(18,4,4)';
  const MOUTH_RED    = 'rgb(160,32,18)';   // vivid — glow-adjacent
  const TEETH        = 'rgb(228,216,185)';
  const TONGUE       = 'rgb(195,38,28)';
  const EYE_IRIS     = 'rgb(255,185,18)';  // lum 0.75 — triggers glow
  const EYE_HI       = 'rgb(255,240,120)'; // lum 0.93 — strong glow
  const EYE_DEEP     = 'rgb(8,3,1)';
  const CLAW         = 'rgb(195,178,142)';

  setSeed(77);

  // Helpers
  function lit(stops) {
    // Build a top-to-bottom toon gradient over the body height
    const g = ctx.createLinearGradient(0, h*0.20, 0, h*0.88);
    for (const [t, col] of stops) g.addColorStop(t, col);
    return g;
  }

  // -------------------------------------------------------------------------
  // 1. GROUND SHADOW
  // -------------------------------------------------------------------------
  ambientOcclusion(ctx, w*0.52, h*0.89, w*0.52, h*0.07, 0.60);
  ambientOcclusion(ctx, w*0.52, h*0.89, w*0.38, h*0.04, 0.40);

  // -------------------------------------------------------------------------
  // SHARED LEG HELPER — tapered polygon, toon-shaded
  // -------------------------------------------------------------------------
  function drawLeg(pts, baseCol, litCol) {
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

    // Toon: two-stop, hard transition between shadow and lit face
    const g = ctx.createLinearGradient(w*a[0], h*a[1], w*(a[0]+c[0])*0.5, h*(a[1]+c[1])*0.5);
    g.addColorStop(0,    litCol);
    g.addColorStop(0.55, baseCol);
    g.addColorStop(1,    baseCol);

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

  const farFLeg  = [[0.52,0.54],[0.56,0.67],[0.58,0.80]];
  const farRLeg  = [[0.79,0.58],[0.84,0.69],[0.87,0.80]];
  const nearFLeg = [[0.36,0.56],[0.28,0.68],[0.22,0.80]];
  const nearRLeg = [[0.67,0.58],[0.65,0.71],[0.62,0.82]];

  // -------------------------------------------------------------------------
  // 2. FAR LEGS — deep shadow, barely differentiated from black
  // -------------------------------------------------------------------------
  drawLeg(farFLeg,  DEEP,   SHADOW);
  drawLeg(farRLeg,  DEEP,   SHADOW);

  for (const [fx, fy] of [[0.58,0.80],[0.87,0.80]]) {
    ctx.fillStyle = SHADOW;
    for (let c2 = -1; c2 <= 1; c2++) {
      ctx.beginPath();
      ctx.moveTo(w*fx + c2*w*0.009, h*fy);
      ctx.lineTo(w*fx + c2*w*0.005 - w*0.022, h*fy + h*0.028);
      ctx.lineTo(w*fx + c2*w*0.012, h*fy + h*0.013);
      ctx.closePath(); ctx.fill();
    }
  }

  // -------------------------------------------------------------------------
  // 3. BODY — shadow base, then toon lit-face overlay from top
  // -------------------------------------------------------------------------
  drawBodyOutline(ctx, skeleton.spine, w, h, SHADOW);

  // Dorsal toon bands: RIM at very top → HI → LIGHT → transparent
  // This is the key: three discrete bright bands that give the renderer real contrast
  const dorsalLit = ctx.createLinearGradient(0, h*0.22, 0, h*0.62);
  dorsalLit.addColorStop(0,    RIM);     // lum 0.92 — strong glow
  dorsalLit.addColorStop(0.12, HI);      // lum 0.77 — glow
  dorsalLit.addColorStop(0.28, LIGHT);   // lum 0.59
  dorsalLit.addColorStop(0.50, MID);     // lum 0.27
  dorsalLit.addColorStop(0.70, 'rgba(0,0,0,0)');
  ctx.fillStyle = dorsalLit;
  ctx.beginPath();
  ctx.moveTo(w*0.34, h*0.44);
  ctx.bezierCurveTo(w*0.34, h*0.28, w*0.76, h*0.26, w*0.80, h*0.46);
  ctx.bezierCurveTo(w*0.76, h*0.54, w*0.34, h*0.56, w*0.34, h*0.44);
  ctx.closePath();
  ctx.fill();

  // Side flank — lit from upper-left, 3/4 view catch
  const flankLit = ctx.createLinearGradient(w*0.18, h*0.38, w*0.50, h*0.62);
  flankLit.addColorStop(0,    HI);
  flankLit.addColorStop(0.35, LIGHT);
  flankLit.addColorStop(0.65, MID);
  flankLit.addColorStop(1,    'rgba(0,0,0,0)');
  ctx.fillStyle = flankLit;
  ctx.beginPath();
  ctx.moveTo(w*0.34, h*0.40);
  ctx.bezierCurveTo(w*0.26, h*0.42, w*0.20, h*0.50, w*0.24, h*0.62);
  ctx.bezierCurveTo(w*0.32, h*0.66, w*0.46, h*0.64, w*0.50, h*0.58);
  ctx.bezierCurveTo(w*0.46, h*0.48, w*0.38, h*0.42, w*0.34, h*0.40);
  ctx.closePath();
  ctx.fill();

  // Under-belly — near-black, creates weight
  ctx.fillStyle = DEEP;
  ctx.beginPath();
  ctx.moveTo(w*0.22, h*0.60);
  ctx.bezierCurveTo(w*0.36, h*0.68, w*0.58, h*0.70, w*0.78, h*0.66);
  ctx.bezierCurveTo(w*0.82, h*0.62, w*0.82, h*0.58, w*0.78, h*0.56);
  ctx.bezierCurveTo(w*0.58, h*0.62, w*0.36, h*0.62, w*0.22, h*0.58);
  ctx.closePath();
  ctx.fill();

  // -------------------------------------------------------------------------
  // 4. SCALE PLATES — alternating MID/SHADOW strips give texture for normals
  // -------------------------------------------------------------------------
  setSeed(77);
  for (let i = 0; i < 56; i++) {
    const sx2 = 0.26 + rand()*0.52, sy2 = 0.34 + rand()*0.22;
    const sr = 0.010 + rand()*0.014;
    ctx.fillStyle = (i % 3 === 0) ? SHADOW : MID;
    ctx.globalAlpha = 0.35 + rand()*0.20;
    fillEllipse(ctx, w*sx2, h*sy2, w*sr, h*(sr*0.55));
  }
  ctx.globalAlpha = 1;

  // -------------------------------------------------------------------------
  // 5. DORSAL SPINES — SPINE_SHADOW body, SPINE_RIM leading edge (glows!)
  // -------------------------------------------------------------------------
  const spineData = [
    [neck.x-0.02,  neck.y-0.04,    0.026, 0.118],
    [0.40,         0.290,          0.023, 0.110],
    [shoulder.x,   shoulder.y-0.07,0.021, 0.100],
    [0.53,         0.270,          0.019, 0.090],
    [mid.x,        mid.y-0.07,     0.017, 0.080],
    [0.67,         0.295,          0.015, 0.068],
    [hip.x,        hip.y-0.09,     0.013, 0.056],
    [0.84,         0.320,          0.010, 0.042],
    [0.91,         0.215,          0.007, 0.028],
  ];

  for (const [qx, qy, hw, qh] of spineData) {
    // Shadow body
    ctx.fillStyle = SPINE_SHADOW;
    ctx.beginPath();
    ctx.moveTo(w*(qx-hw*0.9), h*(qy+qh*0.25));
    ctx.bezierCurveTo(w*(qx-hw*0.4),h*(qy-qh*0.2),w*(qx-hw*0.1),h*(qy-qh),w*qx,h*(qy-qh));
    ctx.bezierCurveTo(w*(qx+hw*0.1),h*(qy-qh),w*(qx+hw*0.4),h*(qy-qh*0.2),w*(qx+hw*0.9),h*(qy+qh*0.25));
    ctx.bezierCurveTo(w*(qx+hw*0.4),h*(qy+qh*0.5),w*(qx-hw*0.4),h*(qy+qh*0.5),w*(qx-hw*0.9),h*(qy+qh*0.25));
    ctx.closePath(); ctx.fill();

    // RIM highlight streak — this is the key, lum 0.92 triggers strong glow
    ctx.strokeStyle = SPINE_RIM;
    ctx.lineWidth = Math.max(1.5, w*0.004);
    ctx.beginPath();
    ctx.moveTo(w*(qx-hw*0.06), h*(qy+qh*0.08));
    ctx.lineTo(w*qx, h*(qy-qh*0.94));
    ctx.stroke();
  }

  // -------------------------------------------------------------------------
  // 6. TAIL — toon shaded, prominent
  // -------------------------------------------------------------------------
  // Shadow base
  ctx.fillStyle = SHADOW;
  ctx.beginPath();
  ctx.moveTo(w*0.76, h*0.44);
  ctx.bezierCurveTo(w*0.84,h*0.32,w*0.90,h*0.22,w*0.94,h*0.16);
  ctx.lineTo(w*0.96, h*0.18);
  ctx.bezierCurveTo(w*0.90,h*0.26,w*0.85,h*0.36,w*0.80,h*0.52);
  ctx.closePath(); ctx.fill();

  // Lit top ridge — HI band
  ctx.strokeStyle = HI;
  ctx.lineWidth = Math.max(3, w*0.008);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(w*0.77, h*0.44);
  ctx.bezierCurveTo(w*0.84,h*0.33,w*0.90,h*0.23,w*0.94,h*0.16);
  ctx.stroke();

  // Rim on very tip
  ctx.strokeStyle = RIM;
  ctx.lineWidth = Math.max(2, w*0.005);
  ctx.beginPath();
  ctx.moveTo(w*0.90, h*0.21);
  ctx.lineTo(w*0.94, h*0.16);
  ctx.stroke();

  // Tail spines — same rim treatment
  for (const [tx, ty, tsz] of [[0.80,0.38,0.058],[0.86,0.28,0.046],[0.91,0.20,0.034]]) {
    ctx.fillStyle = SPINE_SHADOW;
    ctx.beginPath();
    ctx.moveTo(w*(tx-tsz*0.4),h*(ty+tsz*0.3));
    ctx.lineTo(w*tx,h*(ty-tsz));
    ctx.lineTo(w*(tx+tsz*0.4),h*(ty+tsz*0.3));
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = SPINE_RIM;
    ctx.lineWidth = Math.max(1, w*0.003);
    ctx.beginPath(); ctx.moveTo(w*(tx-tsz*0.05),h*(ty+tsz*0.1)); ctx.lineTo(w*tx,h*(ty-tsz*0.93)); ctx.stroke();
  }

  // Barbed tip
  ctx.fillStyle = SPINE_SHADOW;
  ctx.beginPath();
  ctx.moveTo(w*0.94,h*0.16); ctx.lineTo(w*0.985,h*0.09); ctx.lineTo(w*0.96,h*0.18);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = RIM;
  ctx.lineWidth = Math.max(1.5, w*0.003);
  ctx.beginPath(); ctx.moveTo(w*0.94,h*0.165); ctx.lineTo(w*0.98,h*0.095); ctx.stroke();

  // -------------------------------------------------------------------------
  // 7. HEAD — wide croc skull, toon shading
  // -------------------------------------------------------------------------
  const hx = head.x, hy = head.y, hr = head.radius;

  // Base — SHADOW
  ctx.fillStyle = SHADOW;
  ctx.beginPath();
  ctx.moveTo(w*(hx+hr*1.6), h*(hy-hr*0.30));
  ctx.bezierCurveTo(w*(hx+hr*0.8),h*(hy-hr*0.80),w*(hx-hr*0.4),h*(hy-hr*0.90),w*(hx-hr*1.0),h*(hy-hr*0.50));
  ctx.bezierCurveTo(w*(hx-hr*1.4),h*(hy-hr*0.10),w*(hx-hr*1.3),h*(hy+hr*0.50),w*(hx-hr*0.8),h*(hy+hr*0.75));
  ctx.bezierCurveTo(w*(hx+hr*0.3),h*(hy+hr*0.85),w*(hx+hr*1.3),h*(hy+hr*0.65),w*(hx+hr*1.6),h*(hy+hr*0.20));
  ctx.closePath(); ctx.fill();

  // Lit top face of skull — HI band
  const headLit = ctx.createLinearGradient(w*(hx-hr*1.1), h*(hy-hr*0.9), w*(hx+hr*0.6), h*(hy+hr*0.2));
  headLit.addColorStop(0,    RIM);
  headLit.addColorStop(0.20, HI);
  headLit.addColorStop(0.50, LIGHT);
  headLit.addColorStop(0.80, 'rgba(0,0,0,0)');
  ctx.fillStyle = headLit;
  ctx.beginPath();
  ctx.moveTo(w*(hx+hr*1.5),h*(hy-hr*0.28));
  ctx.bezierCurveTo(w*(hx+hr*0.6),h*(hy-hr*0.75),w*(hx-hr*0.3),h*(hy-hr*0.88),w*(hx-hr*0.95),h*(hy-hr*0.48));
  ctx.bezierCurveTo(w*(hx-hr*0.5),h*(hy-hr*0.16),w*(hx+hr*0.6),h*(hy-hr*0.22),w*(hx+hr*1.5),h*(hy-hr*0.12));
  ctx.closePath(); ctx.fill();

  // Under-jaw shadow — very dark
  ctx.fillStyle = DEEP;
  ctx.beginPath();
  ctx.moveTo(w*(hx-hr*1.3),h*(hy+hr*0.45));
  ctx.bezierCurveTo(w*(hx-hr*0.6),h*(hy+hr*0.85),w*(hx+hr*0.5),h*(hy+hr*0.88),w*(hx+hr*1.4),h*(hy+hr*0.30));
  ctx.bezierCurveTo(w*(hx+hr*1.2),h*(hy+hr*0.55),w*(hx+hr*0.2),h*(hy+hr*0.70),w*(hx-hr*0.8),h*(hy+hr*0.68));
  ctx.closePath(); ctx.fill();

  // Head armor bumps — MID on SHADOW for normal map interest
  setSeed(88);
  for (let i = 0; i < 20; i++) {
    const bx = (hx-hr*1.0) + rand()*hr*2.1;
    const by = (hy-hr*0.70) + rand()*hr*1.3;
    ctx.fillStyle = (i%2===0) ? MID : DEEP;
    ctx.globalAlpha = 0.40 + rand()*0.20;
    fillEllipse(ctx, w*bx, h*by, w*0.013, h*0.008);
  }
  ctx.globalAlpha = 1;

  // Head spines — rim treatment
  for (const [ox, oy, ow2, oh2] of [
    [hx-hr*0.80, hy-hr*0.86, 0.026, 0.088],
    [hx-hr*0.26, hy-hr*0.95, 0.030, 0.098],
    [hx+hr*0.30, hy-hr*0.80, 0.026, 0.080],
    [hx+hr*0.84, hy-hr*0.56, 0.020, 0.064],
  ]) {
    ctx.fillStyle = SPINE_SHADOW;
    ctx.beginPath();
    ctx.moveTo(w*(ox-ow2),h*(oy+oh2*0.4));
    ctx.lineTo(w*ox,h*(oy-oh2));
    ctx.lineTo(w*(ox+ow2),h*(oy+oh2*0.4));
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = SPINE_RIM;
    ctx.lineWidth = Math.max(1.5, w*0.003);
    ctx.beginPath(); ctx.moveTo(w*(ox-ow2*0.06),h*(oy+oh2*0.18)); ctx.lineTo(w*ox,h*(oy-oh2*0.92)); ctx.stroke();
  }

  // -------------------------------------------------------------------------
  // 8. JAWS — deep cavity, vivid red interior (glow-adjacent), toon jaws
  // -------------------------------------------------------------------------
  const sx = snout.x, sy = snout.y;

  // Cavity — DEEP
  ctx.fillStyle = MOUTH_DEEP;
  ctx.beginPath();
  ctx.moveTo(w*(hx-hr*0.55),h*(hy+hr*0.15));
  ctx.bezierCurveTo(w*(sx+0.08),h*(hy+0.00),w*(sx-0.02),h*(sy-0.06),w*sx,h*sy);
  ctx.bezierCurveTo(w*(sx-0.02),h*(sy+0.06),w*(sx+0.04),h*(sy+0.10),w*(hx-hr*0.25),h*(hy+hr*0.90));
  ctx.bezierCurveTo(w*(hx+hr*0.25),h*(hy+hr*0.80),w*(hx+hr*0.30),h*(hy+hr*0.30),w*(hx-hr*0.55),h*(hy+hr*0.15));
  ctx.fill();

  // Vivid red glow at throat — MOUTH_RED hits lum ~0.22, contrast against DEEP
  ctx.fillStyle = MOUTH_RED;
  ctx.globalAlpha = 0.75;
  fillEllipse(ctx, w*(sx+0.05), h*(sy+0.03), w*0.10, h*0.055);
  ctx.globalAlpha = 1;

  // Upper jaw — MID base, LIGHT on top
  ctx.fillStyle = MID;
  ctx.beginPath();
  ctx.moveTo(w*(hx-hr*0.62),h*(hy-hr*0.25));
  ctx.bezierCurveTo(w*(sx+0.06),h*(hy-0.04),w*(sx-0.01),h*(sy-0.08),w*(sx-0.03),h*sy);
  ctx.bezierCurveTo(w*(sx+0.02),h*(sy+0.02),w*(sx+0.08),h*(sy-0.02),w*(hx-hr*0.40),h*(hy+hr*0.20));
  ctx.bezierCurveTo(w*(hx+hr*0.10),h*(hy+hr*0.15),w*(hx+hr*0.10),h*(hy-hr*0.25),w*(hx-hr*0.62),h*(hy-hr*0.25));
  ctx.fill();

  // Upper jaw lit top band
  ctx.fillStyle = LIGHT;
  ctx.beginPath();
  ctx.moveTo(w*(hx-hr*0.62),h*(hy-hr*0.25));
  ctx.bezierCurveTo(w*(sx+0.05),h*(hy-0.06),w*(sx-0.02),h*(sy-0.10),w*(sx-0.05),h*(sy-0.01));
  ctx.bezierCurveTo(w*(sx+0.01),h*(sy+0.01),w*(sx+0.06),h*(sy-0.04),w*(hx-hr*0.42),h*(hy+hr*0.10));
  ctx.bezierCurveTo(w*(hx-hr*0.10),h*(hy-hr*0.06),w*(hx-hr*0.10),h*(hy-hr*0.26),w*(hx-hr*0.62),h*(hy-hr*0.25));
  ctx.fill();

  // Lower jaw — SHADOW base
  ctx.fillStyle = SHADOW;
  ctx.beginPath();
  ctx.moveTo(w*(hx-hr*0.35),h*(hy+hr*0.50));
  ctx.bezierCurveTo(w*(sx+0.08),h*(sy+0.02),w*(sx-0.01),h*(sy+0.06),w*(sx-0.03),h*(sy+0.08));
  ctx.bezierCurveTo(w*(sx-0.01),h*(sy+0.14),w*(sx+0.08),h*(sy+0.12),w*(hx-hr*0.22),h*(hy+hr*0.88));
  ctx.bezierCurveTo(w*(hx+hr*0.22),h*(hy+hr*0.80),w*(hx+hr*0.22),h*(hy+hr*0.50),w*(hx-hr*0.35),h*(hy+hr*0.50));
  ctx.fill();

  // Teeth — near-white, high luminance, glow from rim lighting
  ctx.fillStyle = TEETH;
  const upperT = [[sx-0.03,sy+0.00,0.034],[sx+0.02,sy+0.01,0.030],[sx+0.07,sy+0.01,0.025],
                   [sx+0.12,sy+0.01,0.022],[sx+0.17,sy+0.01,0.020],[sx+0.22,sy+0.01,0.018]];
  for (const [tx,ty,tlen] of upperT) {
    ctx.beginPath(); ctx.moveTo(w*tx,h*ty); ctx.lineTo(w*(tx+0.008),h*(ty+tlen)); ctx.lineTo(w*(tx+0.016),h*ty); ctx.closePath(); ctx.fill();
  }
  const lowerT = [[sx+0.00,sy+0.08,0.025],[sx+0.05,sy+0.09,0.023],[sx+0.10,sy+0.09,0.021],
                   [sx+0.15,sy+0.09,0.019],[sx+0.20,sy+0.09,0.017]];
  for (const [tx,ty,tlen] of lowerT) {
    ctx.beginPath(); ctx.moveTo(w*tx,h*ty); ctx.lineTo(w*(tx+0.008),h*(ty-tlen)); ctx.lineTo(w*(tx+0.016),h*ty); ctx.closePath(); ctx.fill();
  }

  // Tongue — vivid red
  ctx.strokeStyle = TONGUE; ctx.lineWidth = Math.max(2,w*0.007); ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(w*(sx+0.02),h*(sy+0.05)); ctx.lineTo(w*(sx-0.08),h*(sy+0.04)); ctx.stroke();
  ctx.lineWidth = Math.max(1.5,w*0.004);
  ctx.beginPath(); ctx.moveTo(w*(sx-0.08),h*(sy+0.04)); ctx.lineTo(w*(sx-0.14),h*(sy+0.00)); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(w*(sx-0.08),h*(sy+0.04)); ctx.lineTo(w*(sx-0.14),h*(sy+0.08)); ctx.stroke();

  // -------------------------------------------------------------------------
  // 9. EYE — petrifying gaze. Dominates the face. Three luminance zones.
  // -------------------------------------------------------------------------
  const eyeX = hx - hr*0.42, eyeY = hy - hr*0.14;
  const eyeR = w * 0.044;  // even bigger

  // Outer ambient glow halo
  const halo = ctx.createRadialGradient(w*eyeX,h*eyeY,0,w*eyeX,h*eyeY,eyeR*3.5);
  halo.addColorStop(0,   'rgba(255,200,40,0.50)');
  halo.addColorStop(0.45,'rgba(200,140,10,0.20)');
  halo.addColorStop(1,   'rgba(0,0,0,0)');
  ctx.fillStyle = halo;
  ctx.beginPath(); ctx.arc(w*eyeX,h*eyeY,eyeR*3.5,0,Math.PI*2); ctx.fill();

  // Socket — DEEP
  ctx.fillStyle = EYE_DEEP;
  ctx.beginPath(); ctx.ellipse(w*eyeX,h*eyeY,eyeR*1.40,eyeR*1.25,0,0,Math.PI*2); ctx.fill();

  // Iris — EYE_IRIS lum 0.75, triggers glow pass
  ctx.fillStyle = EYE_IRIS;
  ctx.beginPath(); ctx.arc(w*eyeX,h*eyeY,eyeR,0,Math.PI*2); ctx.fill();

  // Hot center — EYE_HI lum 0.93, strong glow
  const hotG = ctx.createRadialGradient(w*(eyeX-0.005),h*(eyeY-0.006),0,w*eyeX,h*eyeY,eyeR*0.55);
  hotG.addColorStop(0, EYE_HI);
  hotG.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = hotG;
  ctx.beginPath(); ctx.arc(w*eyeX,h*eyeY,eyeR*0.55,0,Math.PI*2); ctx.fill();

  // Slit pupil
  ctx.fillStyle = EYE_DEEP;
  ctx.beginPath(); ctx.ellipse(w*eyeX,h*eyeY,eyeR*0.17,eyeR*0.80,0,0,Math.PI*2); ctx.fill();

  // Rim ring
  ctx.strokeStyle = EYE_HI; ctx.lineWidth = Math.max(2,w*0.004);
  ctx.beginPath(); ctx.arc(w*eyeX,h*eyeY,eyeR*1.03,0,Math.PI*2); ctx.stroke();

  // Catch-light
  ctx.fillStyle = 'rgba(255,252,230,0.80)';
  fillCircle(ctx, w*(eyeX-0.011),h*(eyeY-0.013),w*0.010);

  // -------------------------------------------------------------------------
  // 10. NEAR LEGS — MID base, LIGHT lit face, claws in TEETH color
  // -------------------------------------------------------------------------
  drawLeg(nearFLeg, MID, LIGHT);
  drawLeg(nearRLeg, MID, LIGHT);

  for (const [fx, fy, isFront] of [[0.22,0.80,true],[0.62,0.82,false]]) {
    ctx.fillStyle = CLAW;
    const dx = isFront ? -0.026 : -0.020;
    for (let c2 = -1; c2 <= 1; c2++) {
      ctx.beginPath();
      ctx.moveTo(w*fx+c2*w*0.010,h*fy);
      ctx.lineTo(w*fx+c2*w*0.006+w*dx,h*fy+h*0.033);
      ctx.lineTo(w*fx+c2*w*0.013,h*fy+h*0.016);
      ctx.closePath(); ctx.fill();
    }
  }
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
