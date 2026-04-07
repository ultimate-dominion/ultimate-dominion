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
// GOBLIN SHAMAN SKELETON — squat humanoid, hunched forward over staff
// Variant of goblin — more upright caster stance, leaning on tall staff
// Facing LEFT, 3/4 view
// ==========================================================================
export const goblinShamanSkeleton = {
  spine: [
    { id: 'jaw',    x: 0.30, y: 0.40, radius: 0.014 },
    { id: 'head',   x: 0.36, y: 0.30, radius: 0.074 },  // big goblin head
    { id: 'neck',   x: 0.40, y: 0.44, radius: 0.042 },
    { id: 'chest',  x: 0.44, y: 0.54, radius: 0.082 },   // hunched torso
    { id: 'belly',  x: 0.46, y: 0.64, radius: 0.078 },   // pot belly under robes
    { id: 'hip',    x: 0.46, y: 0.74, radius: 0.065 },
  ],
  limbs: [
    // Near arm — reaching forward/down, dangling (free hand)
    { attach: 'chest', side: 'near', segments: [
      { x: 0.40, y: 0.52, radius: 0.028 },
      { x: 0.34, y: 0.58, radius: 0.020 },  // elbow — low
      { x: 0.28, y: 0.64, radius: 0.016 },  // forearm
      { x: 0.24, y: 0.68, radius: 0.018 },  // hand — large, dangling
    ]},
    // Far arm — gripping staff, extended up
    { attach: 'chest', side: 'far', segments: [
      { x: 0.48, y: 0.50, radius: 0.024 },
      { x: 0.52, y: 0.42, radius: 0.018 },
      { x: 0.54, y: 0.36, radius: 0.014 },
      { x: 0.56, y: 0.32, radius: 0.016 },  // hand on staff
    ]},
    // Near leg — forward, weight planted
    { attach: 'hip', side: 'near', segments: [
      { x: 0.38, y: 0.78, radius: 0.036 },
      { x: 0.34, y: 0.86, radius: 0.028 },
      { x: 0.32, y: 0.94, radius: 0.024 },
    ]},
    // Far leg — back
    { attach: 'hip', side: 'far', segments: [
      { x: 0.54, y: 0.78, radius: 0.030 },
      { x: 0.58, y: 0.86, radius: 0.022 },
      { x: 0.60, y: 0.94, radius: 0.020 },
    ]},
  ],
};

// ==========================================================================
// GOBLIN SHAMAN — clean render
// Red/brown tattered robes, pointed hat, staff with glowing orb,
// yellow-orange eyes under hat brim, bone trinkets
// ==========================================================================
export function drawGoblinShamanClean(ctx, skeleton, w, h) {
  const jaw = skeleton.spine.find(n => n.id === 'jaw');
  const head = skeleton.spine.find(n => n.id === 'head');
  const neck = skeleton.spine.find(n => n.id === 'neck');
  const chest = skeleton.spine.find(n => n.id === 'chest');
  const belly = skeleton.spine.find(n => n.id === 'belly');
  const hip = skeleton.spine.find(n => n.id === 'hip');

  // --- PALETTE ---
  const skinDark   = [52, 58, 28];
  const skinMid    = [72, 82, 38];
  const skinShadow = [28, 32, 14];
  const robeDark   = [42, 18, 12];     // dark red-brown robe
  const robeMid    = [68, 28, 18];     // red-brown
  const robeLight  = [88, 40, 24];     // robe highlight
  const robeShadow = [22, 10, 8];
  const hatDark    = [48, 20, 14];     // pointed hat — dark red
  const hatMid     = [72, 30, 18];
  const hatLight   = [95, 42, 25];
  const staffColor = [120, 105, 80];   // wood staff
  const staffDark  = [65, 55, 40];
  const orbGlow    = [255, 180, 40];   // bright amber orb — KEY accent
  const orbCore    = [255, 220, 100];
  const eyeOuter   = [200, 160, 30];   // yellow-orange eyes
  const eyeCore    = [255, 200, 50];
  const boneColor  = [170, 160, 130];  // trinket bones
  const teethColor = [200, 190, 165];

  const hx = head.x, hy = head.y, hr = head.radius;
  const jx = jaw.x, jy = jaw.y;

  // --- 1. FAR LIMBS (shadow) ---
  for (const limb of skeleton.limbs) {
    if (limb.side === 'far') drawLimbChain(ctx, limb.segments, w, h, `rgb(${skinShadow})`);
  }

  // --- 2. STAFF — tall, extends from hand up past head ---
  const staffX = 0.56;  // aligned with far hand
  const staffTop = 0.06;
  const staffBot = 0.92;
  // Staff shaft — wood colored
  ctx.strokeStyle = `rgb(${staffColor})`;
  ctx.lineWidth = w * 0.014;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(w * staffX, h * staffBot);
  ctx.bezierCurveTo(w * (staffX - 0.01), h * 0.60, w * (staffX + 0.01), h * 0.30, w * (staffX - 0.005), h * staffTop);
  ctx.stroke();
  // Staff shadow side
  ctx.strokeStyle = `rgb(${staffDark})`;
  ctx.lineWidth = w * 0.005;
  ctx.beginPath();
  ctx.moveTo(w * (staffX + 0.008), h * staffBot);
  ctx.bezierCurveTo(w * (staffX - 0.002), h * 0.60, w * (staffX + 0.018), h * 0.30, w * (staffX + 0.003), h * staffTop);
  ctx.stroke();

  // Staff trinkets — small bones/skulls hanging from near the top
  // Bone 1
  ctx.strokeStyle = `rgb(${boneColor})`;
  ctx.lineWidth = w * 0.004;
  ctx.beginPath();
  ctx.moveTo(w * (staffX - 0.005), h * 0.16);
  ctx.lineTo(w * (staffX - 0.025), h * 0.22);
  ctx.stroke();
  ctx.fillStyle = `rgb(${boneColor})`;
  fillCircle(ctx, w * (staffX - 0.025), h * 0.22, w * 0.006);
  // Bone 2
  ctx.beginPath();
  ctx.moveTo(w * (staffX + 0.005), h * 0.18);
  ctx.lineTo(w * (staffX + 0.020), h * 0.24);
  ctx.stroke();
  fillCircle(ctx, w * (staffX + 0.020), h * 0.24, w * 0.005);

  // --- 3. ROBE / BODY ---
  // Robe fills over the body outline — tattered, layered
  drawBodyOutline(ctx, skeleton.spine, w, h, `rgb(${robeDark})`);

  // Robe gradient overlay
  const robeGrad = bodyGrad3(ctx, w * chest.x, h * chest.y, w * 0.12,
    ...robeMid, ...robeShadow, ...robeLight);
  ctx.fillStyle = robeGrad;
  fillEllipse(ctx, w * chest.x, h * chest.y, w * chest.radius * 1.2, h * chest.radius * 1.1);

  // Belly robe
  const bellyGrad = bodyGrad3(ctx, w * belly.x, h * belly.y, w * 0.10,
    ...robeDark, ...robeShadow, ...robeMid);
  ctx.fillStyle = bellyGrad;
  fillEllipse(ctx, w * belly.x, h * belly.y, w * belly.radius * 1.1, h * belly.radius);

  // Robe tatter lines — ragged edges
  ctx.strokeStyle = `rgba(${robeShadow},0.6)`;
  ctx.lineWidth = w * 0.003;
  for (let t = 0; t < 6; t++) {
    const tx = hip.x - 0.06 + t * 0.022;
    const ty = hip.y + 0.02;
    ctx.beginPath();
    ctx.moveTo(w * tx, h * ty);
    ctx.lineTo(w * (tx + (Math.random() - 0.5) * 0.02), h * (ty + 0.04 + Math.random() * 0.04));
    ctx.stroke();
  }

  // Robe fold lines — vertical dark lines for cloth texture
  ctx.strokeStyle = `rgba(${robeShadow},0.4)`;
  ctx.lineWidth = w * 0.004;
  for (let f = 0; f < 4; f++) {
    const fx = chest.x - 0.04 + f * 0.025;
    ctx.beginPath();
    ctx.moveTo(w * fx, h * (chest.y - 0.02));
    ctx.bezierCurveTo(w * (fx - 0.005), h * belly.y, w * (fx + 0.005), h * hip.y, w * fx, h * (hip.y + 0.04));
    ctx.stroke();
  }

  // --- 4. NEAR LIMBS ---
  for (const limb of skeleton.limbs) {
    if (limb.side === 'near') drawLimbChain(ctx, limb.segments, w, h, `rgb(${skinDark})`);
  }

  // Near hand — large, clawed, dangling
  const nearHand = skeleton.limbs[0].segments[3];
  ctx.fillStyle = `rgb(${skinMid})`;
  fillEllipse(ctx, w * nearHand.x, h * nearHand.y, w * 0.020, h * 0.016);
  // Fingers
  ctx.strokeStyle = `rgb(${skinDark})`;
  ctx.lineWidth = w * 0.005;
  ctx.lineCap = 'round';
  for (let f = 0; f < 4; f++) {
    const angle = -0.8 + f * 0.35;
    ctx.beginPath();
    ctx.moveTo(w * nearHand.x, h * nearHand.y);
    ctx.lineTo(w * (nearHand.x + Math.cos(angle) * 0.025), h * (nearHand.y + Math.sin(angle) * 0.025 + 0.01));
    ctx.stroke();
  }
  // Claws
  ctx.strokeStyle = `rgb(${boneColor})`;
  ctx.lineWidth = w * 0.003;
  for (let f = 0; f < 4; f++) {
    const angle = -0.8 + f * 0.35;
    const fx = nearHand.x + Math.cos(angle) * 0.025;
    const fy = nearHand.y + Math.sin(angle) * 0.025 + 0.01;
    ctx.beginPath();
    ctx.moveTo(w * fx, h * fy);
    ctx.lineTo(w * (fx + Math.cos(angle) * 0.010), h * (fy + Math.sin(angle) * 0.010 + 0.005));
    ctx.stroke();
  }

  // --- 5. HEAD — goblin face under pointed hat ---
  // Skull shape — same big goblin head
  const headGrad = bodyGrad3(ctx, w * hx, h * hy, w * hr,
    ...skinMid, ...skinShadow, ...skinDark);
  ctx.fillStyle = headGrad;
  fillEllipse(ctx, w * hx, h * hy, w * hr * 1.0, h * hr * 0.9);

  // --- 5b. BIG GOBLIN EARS — wide, pointed, sticking out from under hat ---
  const earInner = '120,55,40';
  // Near ear — large, pointing right, thick base to sharp tip
  const earNx = hx + hr * 0.6, earNy = hy + hr * 0.1;
  ctx.fillStyle = `rgb(${skinDark})`;
  ctx.beginPath();
  ctx.moveTo(w * earNx, h * (earNy + 0.022));
  ctx.lineTo(w * earNx, h * (earNy - 0.022));
  ctx.bezierCurveTo(w * (earNx + 0.06), h * (earNy - 0.04), w * (earNx + 0.13), h * (earNy - 0.05), w * (earNx + 0.17), h * (earNy - 0.03));
  ctx.bezierCurveTo(w * (earNx + 0.13), h * (earNy + 0.00), w * (earNx + 0.06), h * (earNy + 0.02), w * earNx, h * (earNy + 0.022));
  ctx.fill();
  // Ear inner
  ctx.fillStyle = `rgb(${earInner})`;
  ctx.beginPath();
  ctx.moveTo(w * (earNx + 0.01), h * (earNy + 0.014));
  ctx.lineTo(w * (earNx + 0.01), h * (earNy - 0.014));
  ctx.bezierCurveTo(w * (earNx + 0.05), h * (earNy - 0.03), w * (earNx + 0.10), h * (earNy - 0.04), w * (earNx + 0.14), h * (earNy - 0.025));
  ctx.bezierCurveTo(w * (earNx + 0.10), h * (earNy + 0.00), w * (earNx + 0.05), h * (earNy + 0.01), w * (earNx + 0.01), h * (earNy + 0.014));
  ctx.fill();

  // Far ear — behind head, pointing left
  const earFx = hx - hr * 0.3, earFy = hy + hr * 0.15;
  ctx.fillStyle = `rgb(${skinShadow})`;
  ctx.beginPath();
  ctx.moveTo(w * earFx, h * (earFy + 0.018));
  ctx.lineTo(w * earFx, h * (earFy - 0.018));
  ctx.bezierCurveTo(w * (earFx - 0.05), h * (earFy - 0.04), w * (earFx - 0.11), h * (earFy - 0.05), w * (earFx - 0.15), h * (earFy - 0.04));
  ctx.bezierCurveTo(w * (earFx - 0.11), h * (earFy - 0.01), w * (earFx - 0.05), h * (earFy + 0.01), w * earFx, h * (earFy + 0.018));
  ctx.fill();
  // Far ear inner
  ctx.fillStyle = `rgba(${earInner},0.4)`;
  ctx.beginPath();
  ctx.moveTo(w * (earFx - 0.01), h * (earFy + 0.010));
  ctx.lineTo(w * (earFx - 0.01), h * (earFy - 0.010));
  ctx.bezierCurveTo(w * (earFx - 0.04), h * (earFy - 0.03), w * (earFx - 0.08), h * (earFy - 0.04), w * (earFx - 0.12), h * (earFy - 0.035));
  ctx.bezierCurveTo(w * (earFx - 0.08), h * (earFy - 0.01), w * (earFx - 0.04), h * (earFy + 0.00), w * (earFx - 0.01), h * (earFy + 0.010));
  ctx.fill();

  // --- 6. POINTED HAT — tall, drooping, dark red ---
  // Hat brim — wide, shadowing the face
  ctx.fillStyle = `rgb(${hatDark})`;
  ctx.beginPath();
  ctx.moveTo(w * (hx - hr * 1.2), h * (hy - hr * 0.2));
  ctx.quadraticCurveTo(w * hx, h * (hy - hr * 0.6), w * (hx + hr * 1.4), h * (hy - hr * 0.1));
  ctx.quadraticCurveTo(w * hx, h * (hy - hr * 0.1), w * (hx - hr * 1.2), h * (hy - hr * 0.2));
  ctx.closePath();
  ctx.fill();

  // Hat cone — tall, leans to the right (droopy wizard hat)
  ctx.fillStyle = `rgb(${hatMid})`;
  ctx.beginPath();
  ctx.moveTo(w * (hx - hr * 0.8), h * (hy - hr * 0.3));  // left base
  ctx.quadraticCurveTo(w * (hx + 0.02), h * (hy - hr * 3.0), w * (hx + hr * 1.0), h * (hy - hr * 3.4));  // tip droops right — TALLER
  ctx.quadraticCurveTo(w * (hx + hr * 0.5), h * (hy - hr * 1.6), w * (hx + hr * 1.0), h * (hy - hr * 0.2));  // right base
  ctx.closePath();
  ctx.fill();

  // Hat highlight — lighter stripe
  ctx.strokeStyle = `rgba(${hatLight},0.4)`;
  ctx.lineWidth = w * 0.006;
  ctx.beginPath();
  ctx.moveTo(w * (hx - hr * 0.4), h * (hy - hr * 0.4));
  ctx.quadraticCurveTo(w * (hx + 0.01), h * (hy - hr * 2.4), w * (hx + hr * 0.9), h * (hy - hr * 3.3));
  ctx.stroke();

  // Hat band — darker stripe at base
  ctx.strokeStyle = `rgb(${robeShadow})`;
  ctx.lineWidth = w * 0.008;
  ctx.beginPath();
  ctx.moveTo(w * (hx - hr * 0.7), h * (hy - hr * 0.35));
  ctx.quadraticCurveTo(w * hx, h * (hy - hr * 0.55), w * (hx + hr * 0.9), h * (hy - hr * 0.25));
  ctx.stroke();

  // --- 7. FACE DETAILS — under the hat brim ---
  // Brow shadow from hat
  ctx.fillStyle = `rgba(0,0,0,0.4)`;
  fillEllipse(ctx, w * hx, h * (hy - hr * 0.1), w * hr * 0.9, h * hr * 0.3);

  // Nose — bulbous
  ctx.fillStyle = `rgb(${skinDark})`;
  fillEllipse(ctx, w * (jx - 0.01), h * (jy - 0.02), w * 0.016, w * 0.012);
  ctx.fillStyle = `rgb(${skinShadow})`;
  fillCircle(ctx, w * (jx - 0.020), h * (jy - 0.016), w * 0.005);

  // Mouth — wide snarl with teeth
  ctx.fillStyle = 'rgb(14,8,6)';
  ctx.beginPath();
  ctx.moveTo(w * (jx - 0.030), h * (jy + 0.005));
  ctx.quadraticCurveTo(w * (jx + 0.01), h * (jy + 0.05), w * (hx + 0.005), h * (hy + hr * 0.25));
  ctx.quadraticCurveTo(w * jx, h * (jy + 0.03), w * (jx - 0.030), h * (jy + 0.005));
  ctx.fill();
  // Fangs
  ctx.fillStyle = `rgb(${teethColor})`;
  ctx.beginPath();
  ctx.moveTo(w * (jx - 0.022), h * (jy + 0.008));
  ctx.lineTo(w * (jx - 0.026), h * (jy + 0.040));
  ctx.lineTo(w * (jx - 0.016), h * (jy + 0.014));
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(w * (jx - 0.004), h * (jy + 0.016));
  ctx.lineTo(w * (jx - 0.010), h * (jy + 0.042));
  ctx.lineTo(w * (jx + 0.004), h * (jy + 0.022));
  ctx.fill();

  // --- 8. EYES — yellow-orange, peering from under hat ---
  const eNx = hx - 0.01, eNy = hy + 0.005;
  // Near eye
  ambientOcclusion(ctx, w * eNx, h * eNy, w * 0.022, w * 0.018, 0.35);
  ctx.save(); ctx.globalAlpha = 0.25;
  ctx.fillStyle = `rgb(${eyeOuter})`;
  fillCircle(ctx, w * eNx, h * eNy, w * 0.022);
  ctx.restore();
  ctx.fillStyle = `rgb(${eyeOuter})`;
  fillCircle(ctx, w * eNx, h * eNy, w * 0.015);
  ctx.fillStyle = `rgb(${eyeCore})`;
  fillCircle(ctx, w * eNx, h * eNy, w * 0.009);
  ctx.fillStyle = 'rgb(8,4,2)';
  fillCircle(ctx, w * (eNx - 0.003), h * eNy, w * 0.005);
  ctx.fillStyle = 'rgb(255,255,255)';
  fillCircle(ctx, w * (eNx - 0.006), h * (eNy - 0.005), w * 0.004);

  // Far eye — smaller, partially hidden by hat/nose bridge
  const eFx = hx + hr * 0.4, eFy = hy + 0.008;
  ambientOcclusion(ctx, w * eFx, h * eFy, w * 0.016, w * 0.014, 0.30);
  ctx.save(); ctx.globalAlpha = 0.20;
  ctx.fillStyle = `rgb(${eyeOuter})`;
  fillCircle(ctx, w * eFx, h * eFy, w * 0.016);
  ctx.restore();
  ctx.fillStyle = `rgb(${eyeOuter})`;
  fillCircle(ctx, w * eFx, h * eFy, w * 0.011);
  ctx.fillStyle = `rgb(${eyeCore})`;
  fillCircle(ctx, w * eFx, h * eFy, w * 0.007);
  ctx.fillStyle = 'rgb(8,4,2)';
  fillCircle(ctx, w * (eFx - 0.002), h * eFy, w * 0.004);
  ctx.fillStyle = 'rgb(255,255,255)';
  fillCircle(ctx, w * (eFx - 0.004), h * (eFy - 0.004), w * 0.003);

  // --- 9. STAFF ORB — glowing amber, THE brightest element ---
  const orbX = staffX - 0.005, orbY = staffTop + 0.01;
  // Wide glow halo
  const orbHaloGrad = ctx.createRadialGradient(
    w * orbX, h * orbY, 0,
    w * orbX, h * orbY, w * 0.08
  );
  orbHaloGrad.addColorStop(0, `rgba(${orbGlow},0.5)`);
  orbHaloGrad.addColorStop(0.4, `rgba(${orbGlow},0.15)`);
  orbHaloGrad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = orbHaloGrad;
  fillCircle(ctx, w * orbX, h * orbY, w * 0.08);

  // Orb body
  ctx.fillStyle = `rgb(${orbGlow})`;
  fillCircle(ctx, w * orbX, h * orbY, w * 0.022);
  // Orb bright core
  ctx.fillStyle = `rgb(${orbCore})`;
  fillCircle(ctx, w * orbX, h * orbY, w * 0.014);
  // Specular
  ctx.fillStyle = 'rgb(255,255,255)';
  fillCircle(ctx, w * (orbX - 0.005), h * (orbY - 0.005), w * 0.006);

  // Orb cradle — fork at top of staff holding the orb
  ctx.strokeStyle = `rgb(${staffDark})`;
  ctx.lineWidth = w * 0.006;
  ctx.beginPath();
  ctx.moveTo(w * (staffX - 0.005), h * (staffTop + 0.03));
  ctx.quadraticCurveTo(w * (staffX - 0.025), h * (staffTop + 0.005), w * (staffX - 0.018), h * (staffTop - 0.01));
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(w * (staffX - 0.005), h * (staffTop + 0.03));
  ctx.quadraticCurveTo(w * (staffX + 0.018), h * (staffTop + 0.005), w * (staffX + 0.012), h * (staffTop - 0.008));
  ctx.stroke();

  // --- 10. AMBIENT OCCLUSION ---
  ambientOcclusion(ctx, w * 0.40, h * 0.94, w * 0.16, h * 0.03, 0.3);
  ambientOcclusion(ctx, w * neck.x, h * neck.y, w * 0.04, h * 0.03, 0.3);
}

// ==========================================================================
// Harness
// ==========================================================================
const GRID_W = 7;
const GRID_H = 7;

export default { draw: drawGoblinShamanClean, skeleton: goblinShamanSkeleton, gridW: GRID_W, gridH: GRID_H };

if (typeof document !== 'undefined' && document.getElementById('canvas-size')) {
function render(elapsed = 0) {
  const size = parseInt(document.getElementById('canvas-size').value);
  const cellSize = parseInt(document.getElementById('cell-size').value);
  const showGrid = document.getElementById('show-grid').checked;
  const showDebug = document.getElementById('show-debug').checked;
  const sk = goblinShamanSkeleton;

  const canvasW = size;
  const canvasH = Math.round(size * GRID_H / GRID_W);
  const maxDisplay = 420;
  const displayW = `${Math.min(canvasW, maxDisplay)}px`;
  const displayH = `${Math.min(canvasH, Math.round(maxDisplay * GRID_H / GRID_W))}px`;

  const asciiOpts = { elapsed, cellSize, level: 6, gridWidth: GRID_W, gridHeight: GRID_H };

  // -- Skeleton view --
  const c1 = document.getElementById('canvas-size');
  c1.width = canvasW; c1.height = canvasH;
  c1.style.width = displayW; c1.style.height = displayH;
  const ctx1 = c1.getContext('2d');
  ctx1.fillStyle = '#000'; ctx1.fillRect(0, 0, canvasW, canvasH);
  const palette = {
    furDark: 'rgb(52,58,28)', furMid: 'rgb(72,82,38)',
    furShadow: 'rgb(28,32,14)', skinDark: 'rgb(42,18,12)',
  };
  for (const limb of sk.limbs) if (limb.side === 'far') drawLimbChain(ctx1, limb.segments, canvasW, canvasH, 'rgb(28,32,14)');
  drawBodyOutline(ctx1, sk.spine, canvasW, canvasH, 'rgb(72,82,38)');
  for (const limb of sk.limbs) if (limb.side === 'near') drawLimbChain(ctx1, limb.segments, canvasW, canvasH, 'rgb(52,58,28)');
  if (showDebug) drawDebugSkeleton(ctx1, sk, canvasW, canvasH);

  // -- ASCII --
  const c2 = document.getElementById('next-ascii');
  c2.width = canvasW; c2.height = canvasH;
  c2.style.width = displayW; c2.style.height = displayH;
  const ctx2 = c2.getContext('2d');
  ctx2.fillStyle = '#000'; ctx2.fillRect(0, 0, canvasW, canvasH);
  renderAscii(ctx2, (tctx, tw, th) => {
    drawGoblinShamanClean(tctx, sk, tw, th);
  }, 0, 0, canvasW, canvasH, asciiOpts);

  // -- Painted --
  const c3 = document.getElementById('next-raw');
  c3.width = canvasW; c3.height = canvasH;
  c3.style.width = displayW; c3.style.height = displayH;
  const ctx3 = c3.getContext('2d');
  ctx3.fillStyle = '#000'; ctx3.fillRect(0, 0, canvasW, canvasH);
  drawGoblinShamanClean(ctx3, sk, canvasW, canvasH);

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
