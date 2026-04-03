import { fillEllipse, fillCircle, ambientOcclusion, highlight } from './helpers.js';
import { drawBodyOutline, drawLimbChain, drawTail, drawDebugSkeleton } from './skeleton.js';
import { renderAscii } from './ascii-renderer.js';

// -- 5-stop radial gradient (hi → mid → shadow) ----------------------------
function bodyGrad3(ctx, cx, cy, r, midR, midG, midB, sR, sG, sB, hiR, hiG, hiB) {
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
  g.addColorStop(0, `rgb(${hiR},${hiG},${hiB})`);
  g.addColorStop(0.25, `rgb(${midR},${midG},${midB})`);
  g.addColorStop(0.50, `rgb(${Math.floor(midR * 0.85 + sR * 0.15)},${Math.floor(midG * 0.85 + sG * 0.15)},${Math.floor(midB * 0.85 + sB * 0.15)})`);
  g.addColorStop(0.75, `rgb(${Math.floor(midR * 0.5 + sR * 0.5)},${Math.floor(midG * 0.5 + sG * 0.5)},${Math.floor(midB * 0.5 + sB * 0.5)})`);
  g.addColorStop(1, `rgb(${sR},${sG},${sB})`);
  return g;
}

// ==========================================================================
// GOBLIN SKELETON — squat humanoid, 3/4 view, axe raised mid-swing
// Big head, huge ears, wiry body, short bowed legs
// ==========================================================================
export const goblinSkeleton = {
  // Action pose: leaning into a swing, axe raised behind/above
  // Body angled forward ~30 degrees, weight on front foot
  spine: [
    { id: 'jaw',    x: 0.30, y: 0.38, radius: 0.016 },
    { id: 'head',   x: 0.38, y: 0.28, radius: 0.082 },  // HUGE round head
    { id: 'neck',   x: 0.42, y: 0.42, radius: 0.050 },   // barely any neck — head sits on body
    { id: 'chest',  x: 0.46, y: 0.52, radius: 0.095 },  // BARREL chest — very fat
    { id: 'belly',  x: 0.48, y: 0.62, radius: 0.098 },  // pot belly — widest point
    { id: 'hip',    x: 0.48, y: 0.72, radius: 0.080 },   // wide hips
  ],
  limbs: [
    // Near arm — top grip on axe, raised behind/above head
    { attach: 'chest', side: 'near', segments: [
      { x: 0.44, y: 0.48, radius: 0.034 },  // beefy shoulder
      { x: 0.52, y: 0.36, radius: 0.024 },  // elbow — UP and back
      { x: 0.60, y: 0.24, radius: 0.018 },  // forearm
      { x: 0.64, y: 0.16, radius: 0.020 },  // hand — top of shaft
    ]},
    // Far arm — lower grip on axe shaft
    { attach: 'chest', side: 'far', segments: [
      { x: 0.50, y: 0.50, radius: 0.028 },  // shoulder
      { x: 0.54, y: 0.40, radius: 0.020 },  // elbow
      { x: 0.58, y: 0.30, radius: 0.015 },  // forearm
      { x: 0.60, y: 0.22, radius: 0.018 },  // hand — lower on shaft
    ]},
    // Near leg — VERY short stumpy, planted wide
    { attach: 'hip', side: 'near', segments: [
      { x: 0.40, y: 0.78, radius: 0.040 },  // FAT thigh
      { x: 0.36, y: 0.86, radius: 0.032 },  // thick knee
      { x: 0.34, y: 0.94, radius: 0.028 },  // stubby shin
    ]},
    // Far leg — BACK, stumpy
    { attach: 'hip', side: 'far', segments: [
      { x: 0.56, y: 0.78, radius: 0.034 },
      { x: 0.62, y: 0.86, radius: 0.026 },
      { x: 0.64, y: 0.94, radius: 0.024 },
    ]},
  ],
  // No tail — goblins are humanoid
};

// ==========================================================================
// GOBLIN — clean render for ASCII pipeline
// Olive-green skin, crude leather, yellow-red eyes, HUGE ears
// ==========================================================================
export function drawGoblinClean(ctx, skeleton, w, h) {
  const jaw = skeleton.spine.find(n => n.id === 'jaw');
  const head = skeleton.spine.find(n => n.id === 'head');
  const neck = skeleton.spine.find(n => n.id === 'neck');
  const chest = skeleton.spine.find(n => n.id === 'chest');
  const belly = skeleton.spine.find(n => n.id === 'belly');
  const hip = skeleton.spine.find(n => n.id === 'hip');

  // PALETTE — green skin, brown leather, bright eyes
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

  // 1. FAR LIMBS — dark, behind body
  for (const limb of skeleton.limbs) {
    if (limb.side === 'far') drawLimbChain(ctx, limb.segments, w, h, `rgb(${skinShadow})`);
  }

  // 2. AXE — massive two-handed battle axe, raised behind head
  const handX = 0.64, handY = 0.16;
  // Shaft — ONLY from lower hand up past top hand to axe head
  const farHandY = 0.22;  // lower hand position
  ctx.strokeStyle = `rgb(${axeWood})`;
  ctx.lineCap = 'round';
  ctx.lineWidth = w * 0.022;
  ctx.beginPath();
  ctx.moveTo(w * 0.56, h * (farHandY + 0.02));  // just below lower hand
  ctx.lineTo(w * (handX + 0.06), h * (handY - 0.10)); // up past top hand to axe head
  ctx.stroke();
  // Shaft highlight
  ctx.strokeStyle = 'rgba(130,100,60,0.30)';
  ctx.lineWidth = w * 0.006;
  ctx.beginPath();
  ctx.moveTo(w * 0.57, h * farHandY);
  ctx.lineTo(w * (handX + 0.04), h * (handY - 0.06));
  ctx.stroke();
  // AXE HEAD — massive, heavy, crude double-bladed
  const ahx = handX + 0.06, ahy = handY - 0.12;
  // Near blade — big sweeping curve
  ctx.fillStyle = `rgb(${axeHead})`;
  ctx.beginPath();
  ctx.moveTo(w * ahx, h * (ahy + 0.03));  // socket top
  ctx.bezierCurveTo(w * (ahx + 0.08), h * (ahy - 0.06), w * (ahx + 0.16), h * (ahy - 0.04), w * (ahx + 0.16), h * (ahy + 0.03));
  ctx.bezierCurveTo(w * (ahx + 0.16), h * (ahy + 0.10), w * (ahx + 0.08), h * (ahy + 0.14), w * ahx, h * (ahy + 0.08));
  ctx.closePath();
  ctx.fill();
  // Far blade — smaller, behind shaft
  ctx.fillStyle = `rgba(${axeHead[0] - 30},${axeHead[1] - 30},${axeHead[2] - 30},0.85)`;
  ctx.beginPath();
  ctx.moveTo(w * ahx, h * (ahy + 0.03));
  ctx.bezierCurveTo(w * (ahx - 0.05), h * (ahy - 0.03), w * (ahx - 0.08), h * (ahy - 0.01), w * (ahx - 0.08), h * (ahy + 0.04));
  ctx.bezierCurveTo(w * (ahx - 0.07), h * (ahy + 0.09), w * (ahx - 0.03), h * (ahy + 0.10), w * ahx, h * (ahy + 0.08));
  ctx.closePath();
  ctx.fill();
  // Cutting edge — bright, catches light (near blade)
  ctx.strokeStyle = `rgb(${axeEdge})`;
  ctx.lineWidth = w * 0.006;
  ctx.beginPath();
  ctx.moveTo(w * (ahx + 0.16), h * (ahy - 0.02));
  ctx.bezierCurveTo(w * (ahx + 0.16), h * (ahy + 0.05), w * (ahx + 0.12), h * (ahy + 0.12), w * (ahx + 0.04), h * (ahy + 0.14));
  ctx.stroke();
  // Axe face highlight — bright reflection
  ctx.fillStyle = 'rgba(220,218,210,0.30)';
  fillEllipse(ctx, w * (ahx + 0.08), h * (ahy + 0.02), w * 0.035, w * 0.025);
  // Nicks and damage on edge
  ctx.fillStyle = `rgb(${axeHead})`;
  fillCircle(ctx, w * (ahx + 0.14), h * (ahy + 0.06), w * 0.004);
  fillCircle(ctx, w * (ahx + 0.12), h * (ahy + 0.10), w * 0.003);

  // 3. BODY — skeleton outline with green gradient
  const bodyFill = bodyGrad3(ctx, w * belly.x, h * belly.y, w * 0.22,
    skinMid[0], skinMid[1], skinMid[2],
    skinShadow[0], skinShadow[1], skinShadow[2],
    skinLight[0], skinLight[1], skinLight[2]);
  drawBodyOutline(ctx, skeleton.spine, w, h, bodyFill);

  // 4. LEATHER VEST — crude, strapped across chest
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
  ctx.strokeStyle = `rgb(${leatherDark})`;
  ctx.lineWidth = w * 0.003;
  ctx.stroke();
  // Belt
  ctx.strokeStyle = `rgb(${leatherDark})`;
  ctx.lineWidth = w * 0.008;
  ctx.beginPath();
  ctx.moveTo(w * (belly.x - 0.05), h * (belly.y + 0.01));
  ctx.bezierCurveTo(w * belly.x, h * (belly.y + 0.03), w * (belly.x + 0.04), h * (belly.y + 0.02), w * (belly.x + 0.05), h * belly.y);
  ctx.stroke();
  // Belt buckle
  ctx.fillStyle = `rgb(${axeHead})`;
  fillCircle(ctx, w * belly.x, h * (belly.y + 0.02), w * 0.008);
  // Vest highlight
  highlight(ctx, w * (chest.x - 0.01), h * (chest.y + 0.01), w * 0.018, `rgb(${leatherLight})`, 0.15);
  ambientOcclusion(ctx, w * belly.x, h * (belly.y + 0.03), w * 0.04, h * 0.008, 0.22);

  // 5. NEAR LIMBS — green, slightly lighter
  for (const limb of skeleton.limbs) {
    if (limb.side === 'near') drawLimbChain(ctx, limb.segments, w, h, `rgb(${skinDark})`);
  }

  // 6. FEET — big flat goblin feet
  for (const limb of skeleton.limbs) {
    const foot = limb.segments[limb.segments.length - 1];
    if (foot.y < 0.88) continue;
    ctx.fillStyle = limb.side === 'near' ? `rgb(${skinDark})` : `rgb(${skinShadow})`;
    fillEllipse(ctx, w * foot.x, h * foot.y, w * (foot.radius + 0.006), h * 0.012);
    // Toenails
    ctx.fillStyle = `rgb(${teethColor})`;
    for (let c = -1; c <= 1; c++) {
      const cx = w * foot.x + c * w * 0.007;
      ctx.beginPath();
      ctx.moveTo(cx, h * foot.y + h * 0.006);
      ctx.lineTo(cx - w * 0.002, h * foot.y + h * 0.020);
      ctx.lineTo(cx + w * 0.002, h * foot.y + h * 0.014);
      ctx.fill();
    }
  }

  // 7. BOTH HANDS gripping axe shaft
  // Near hand (top grip)
  ctx.fillStyle = `rgb(${skinMid})`;
  fillEllipse(ctx, w * handX, h * handY, w * 0.016, w * 0.014);
  ctx.fillStyle = `rgb(${skinDark})`;
  for (let f = 0; f < 4; f++) {
    fillCircle(ctx, w * (handX - 0.005 + f * 0.004), h * (handY + 0.002 + f * 0.003), w * 0.005);
  }
  // Far hand (lower grip on shaft)
  const farHand = skeleton.limbs[1].segments[3];
  ctx.fillStyle = `rgb(${skinShadow})`;
  fillEllipse(ctx, w * farHand.x, h * farHand.y, w * 0.014, w * 0.012);
  ctx.fillStyle = `rgb(${skinShadow})`;
  for (let f = 0; f < 4; f++) {
    fillCircle(ctx, w * (farHand.x - 0.004 + f * 0.003), h * (farHand.y + 0.002 + f * 0.003), w * 0.004);
  }

  // 8. HEAD — WIDE round goblin skull, almost as wide as it is tall
  const hx = head.x, hy = head.y, hr = head.radius;
  const jx = jaw.x, jy = jaw.y;
  ctx.fillStyle = bodyGrad3(ctx, w * hx, h * hy, w * hr * 2.5,
    skinMid[0], skinMid[1], skinMid[2],
    skinShadow[0], skinShadow[1], skinShadow[2],
    skinLight[0], skinLight[1], skinLight[2]);
  // Wide round head — like a squashed pumpkin, not an egg
  fillEllipse(ctx, w * hx, h * hy, w * hr * 1.4, h * hr * 1.2);
  // Lower face / jaw — wide, juts forward
  ctx.fillStyle = bodyGrad3(ctx, w * jx, h * jy, w * 0.06,
    skinMid[0], skinMid[1], skinMid[2],
    skinShadow[0], skinShadow[1], skinShadow[2],
    skinLight[0], skinLight[1], skinLight[2]);
  ctx.beginPath();
  ctx.moveTo(w * (hx - hr * 0.8), h * (hy + hr * 0.2));
  ctx.bezierCurveTo(w * (jx - 0.06), h * (jy - 0.02), w * (jx - 0.06), h * (jy + 0.04), w * (jx - 0.02), h * (jy + 0.06));
  ctx.bezierCurveTo(w * (jx + 0.02), h * (jy + 0.06), w * (hx + 0.02), h * (hy + hr * 0.6), w * (hx + hr * 0.6), h * (hy + hr * 0.3));
  ctx.fill();
  // Brow ridge — heavy, shadowed
  ambientOcclusion(ctx, w * (hx - 0.02), h * (hy + 0.01), w * 0.06, h * 0.015, 0.35);

  // 9. EARS — THICK base, SHARP tip. Goblin signature.
  // Near ear — fat fleshy root, narrows to a wicked point
  const earNx = hx + hr * 0.6, earNy = hy - hr * 0.1;
  ctx.fillStyle = `rgb(${skinMid})`;
  ctx.beginPath();
  // Wide thick base attached to head
  ctx.moveTo(w * earNx, h * (earNy + 0.025));       // bottom of base
  ctx.lineTo(w * earNx, h * (earNy - 0.025));        // top of base — THICK root
  // Tapers to sharp point
  ctx.bezierCurveTo(w * (earNx + 0.06), h * (earNy - 0.04), w * (earNx + 0.12), h * (earNy - 0.06), w * (earNx + 0.16), h * (earNy - 0.04));
  // Sharp tip, then back down — bottom edge curves back
  ctx.bezierCurveTo(w * (earNx + 0.12), h * (earNy + 0.00), w * (earNx + 0.06), h * (earNy + 0.02), w * earNx, h * (earNy + 0.025));
  ctx.fill();
  // Ear inner — reddish-pink, follows the taper
  ctx.fillStyle = `rgb(${earInner})`;
  ctx.beginPath();
  ctx.moveTo(w * (earNx + 0.01), h * (earNy + 0.015));
  ctx.lineTo(w * (earNx + 0.01), h * (earNy - 0.015));
  ctx.bezierCurveTo(w * (earNx + 0.05), h * (earNy - 0.03), w * (earNx + 0.10), h * (earNy - 0.04), w * (earNx + 0.13), h * (earNy - 0.03));
  ctx.bezierCurveTo(w * (earNx + 0.10), h * (earNy + 0.00), w * (earNx + 0.05), h * (earNy + 0.01), w * (earNx + 0.01), h * (earNy + 0.015));
  ctx.fill();
  // Ear edge highlight — top ridge
  ctx.strokeStyle = `rgb(${skinLight})`;
  ctx.lineWidth = w * 0.004;
  ctx.beginPath();
  ctx.moveTo(w * earNx, h * (earNy - 0.025));
  ctx.bezierCurveTo(w * (earNx + 0.06), h * (earNy - 0.04), w * (earNx + 0.12), h * (earNy - 0.06), w * (earNx + 0.16), h * (earNy - 0.04));
  ctx.stroke();
  // Ear veins
  ctx.strokeStyle = `rgba(${earInner},0.4)`;
  ctx.lineWidth = w * 0.002;
  ctx.beginPath();
  ctx.moveTo(w * (earNx + 0.02), h * earNy);
  ctx.lineTo(w * (earNx + 0.10), h * (earNy - 0.02));
  ctx.stroke();

  // Far ear — behind head, thick base to sharp point going left
  const earFx = hx - 0.02, earFy = hy - hr * 0.3;
  ctx.fillStyle = `rgb(${skinShadow})`;
  ctx.beginPath();
  ctx.moveTo(w * earFx, h * (earFy + 0.020));
  ctx.lineTo(w * earFx, h * (earFy - 0.020));
  ctx.bezierCurveTo(w * (earFx - 0.05), h * (earFy - 0.04), w * (earFx - 0.10), h * (earFy - 0.06), w * (earFx - 0.14), h * (earFy - 0.05));
  ctx.bezierCurveTo(w * (earFx - 0.10), h * (earFy - 0.01), w * (earFx - 0.05), h * (earFy + 0.01), w * earFx, h * (earFy + 0.020));
  ctx.fill();
  // Far ear inner
  ctx.fillStyle = `rgba(${earInner},0.4)`;
  ctx.beginPath();
  ctx.moveTo(w * (earFx - 0.01), h * (earFy + 0.012));
  ctx.lineTo(w * (earFx - 0.01), h * (earFy - 0.012));
  ctx.bezierCurveTo(w * (earFx - 0.04), h * (earFy - 0.03), w * (earFx - 0.08), h * (earFy - 0.04), w * (earFx - 0.11), h * (earFy - 0.04));
  ctx.bezierCurveTo(w * (earFx - 0.08), h * (earFy - 0.01), w * (earFx - 0.04), h * (earFy + 0.00), w * (earFx - 0.01), h * (earFy + 0.012));
  ctx.fill();

  // 10. NOSE — big bulbous goblin snout
  ctx.fillStyle = `rgb(${skinDark})`;
  fillEllipse(ctx, w * (jx - 0.01), h * (jy - 0.02), w * 0.018, w * 0.014);
  // Nostrils
  ctx.fillStyle = `rgb(${skinShadow})`;
  fillCircle(ctx, w * (jx - 0.022), h * (jy - 0.018), w * 0.005);
  fillCircle(ctx, w * (jx - 0.008), h * (jy - 0.014), w * 0.004);

  // 11. MOUTH — wide snarl, toothy, aggressive
  ctx.fillStyle = 'rgb(18,10,8)';
  ctx.beginPath();
  ctx.moveTo(w * (jx - 0.035), h * (jy + 0.005));
  ctx.quadraticCurveTo(w * (jx + 0.01), h * (jy + 0.06), w * (hx + 0.01), h * (hy + hr * 0.3));
  ctx.quadraticCurveTo(w * jx, h * (jy + 0.04), w * (jx - 0.035), h * (jy + 0.005));
  ctx.fill();
  // Upper fangs — crooked, prominent
  ctx.fillStyle = `rgb(${teethColor})`;
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
  // Lower fang — underbite, sticking up
  ctx.beginPath();
  ctx.moveTo(w * (jx - 0.018), h * (jy + 0.040));
  ctx.lineTo(w * (jx - 0.014), h * (jy + 0.015));
  ctx.lineTo(w * (jx - 0.008), h * (jy + 0.038));
  ctx.fill();
  // Small teeth filling the snarl
  ctx.fillStyle = 'rgb(190,182,162)';
  for (let t = 0; t < 3; t++) {
    const tx = jx - 0.022 + t * 0.010;
    const ty = jy + 0.008 + t * 0.005;
    ctx.beginPath();
    ctx.moveTo(w * tx, h * ty);
    ctx.lineTo(w * (tx - 0.003), h * (ty + 0.018));
    ctx.lineTo(w * (tx + 0.003), h * (ty + 0.010));
    ctx.fill();
  }

  // 12. EYES — TWO clearly visible, bright yellow-orange, wide-set on the broad face
  // Near eye (right side of face, closer to viewer) — big
  const eNx = hx - 0.01, eNy = hy - 0.01;
  ambientOcclusion(ctx, w * eNx, h * eNy, w * 0.026, w * 0.022, 0.35);
  ctx.save(); ctx.globalAlpha = 0.28;
  ctx.fillStyle = `rgb(${eyeOuter})`;
  fillCircle(ctx, w * eNx, h * eNy, w * 0.026);
  ctx.restore();
  ctx.fillStyle = `rgb(${eyeOuter})`;
  fillCircle(ctx, w * eNx, h * eNy, w * 0.018);
  ctx.fillStyle = `rgb(${eyeCore})`;
  fillCircle(ctx, w * eNx, h * eNy, w * 0.010);
  ctx.fillStyle = 'rgb(8,4,2)';
  fillCircle(ctx, w * (eNx - 0.003), h * eNy, w * 0.006);
  ctx.fillStyle = 'rgb(255,255,255)';
  fillCircle(ctx, w * (eNx - 0.007), h * (eNy - 0.007), w * 0.005);

  // Far eye (left side, slightly smaller for 3/4 perspective) — still clearly visible
  const eFx = hx + hr * 0.5, eFy = hy - 0.01;
  ambientOcclusion(ctx, w * eFx, h * eFy, w * 0.020, w * 0.018, 0.30);
  ctx.save(); ctx.globalAlpha = 0.22;
  ctx.fillStyle = `rgb(${eyeOuter})`;
  fillCircle(ctx, w * eFx, h * eFy, w * 0.020);
  ctx.restore();
  ctx.fillStyle = `rgb(${eyeOuter})`;
  fillCircle(ctx, w * eFx, h * eFy, w * 0.014);
  ctx.fillStyle = `rgb(${eyeCore})`;
  fillCircle(ctx, w * eFx, h * eFy, w * 0.008);
  ctx.fillStyle = 'rgb(8,4,2)';
  fillCircle(ctx, w * (eFx - 0.002), h * eFy, w * 0.005);
  ctx.fillStyle = 'rgb(255,255,255)';
  fillCircle(ctx, w * (eFx - 0.005), h * (eFy - 0.005), w * 0.003);

  // 13. BROW WRINKLES — angry, furrowed, across the wide brow
  ctx.strokeStyle = `rgb(${skinShadow})`;
  ctx.lineWidth = w * 0.005;
  ctx.beginPath();
  ctx.moveTo(w * (eNx - 0.015), h * (eNy - 0.022));
  ctx.quadraticCurveTo(w * ((eNx + eFx) / 2), h * (eNy - 0.032), w * (eFx + 0.015), h * (eFy - 0.020));
  ctx.stroke();
  // Second wrinkle
  ctx.lineWidth = w * 0.003;
  ctx.beginPath();
  ctx.moveTo(w * (eNx - 0.010), h * (eNy - 0.030));
  ctx.quadraticCurveTo(w * ((eNx + eFx) / 2), h * (eNy - 0.038), w * (eFx + 0.010), h * (eFy - 0.028));
  ctx.stroke();

  // 14. WARTS/BUMPS — goblin skin texture
  ctx.fillStyle = `rgb(${skinDark})`;
  // Face warts
  fillCircle(ctx, w * (hx + 0.02), h * (hy + 0.01), w * 0.005);
  fillCircle(ctx, w * (jx - 0.01), h * (jy + 0.005), w * 0.004);
  fillCircle(ctx, w * (hx + hr * 0.3), h * (hy + hr * 0.2), w * 0.003);
  // Body skin texture — rough bumpy skin
  for (let i = 0; i < 8; i++) {
    const bx = chest.x - 0.04 + Math.random() * 0.10;
    const by = chest.y + Math.random() * 0.14;
    ctx.fillStyle = Math.random() > 0.5 ? `rgba(${skinShadow},0.3)` : `rgba(${skinLight},0.15)`;
    fillCircle(ctx, w * bx, h * by, w * (0.003 + Math.random() * 0.003));
  }

  // 15. CRANIUM BUMPS — lumpy goblin head
  ctx.fillStyle = `rgb(${skinLight})`;
  fillCircle(ctx, w * (hx + 0.01), h * (hy - hr * 0.8), w * 0.008);
  ctx.fillStyle = `rgb(${skinMid})`;
  fillCircle(ctx, w * (hx + hr * 0.3), h * (hy - hr * 0.6), w * 0.006);
}

// ==========================================================================
// Harness
// ==========================================================================
const GRID_W = 7;
const GRID_H = 7;

export default { draw: drawGoblinClean, skeleton: goblinSkeleton, gridW: GRID_W, gridH: GRID_H };

if (typeof document !== 'undefined') {
function render(elapsed = 0) {
  const size = parseInt(document.getElementById('canvas-size').value);
  const cellSize = parseInt(document.getElementById('cell-size').value);
  const showGrid = document.getElementById('show-grid').checked;
  const showDebug = document.getElementById('show-debug').checked;
  const sk = goblinSkeleton;

  const canvasW = size;
  const canvasH = Math.round(size * GRID_H / GRID_W);
  const maxDisplay = 420;
  const displayW = `${Math.min(canvasW, maxDisplay)}px`;
  const displayH = `${Math.min(canvasH, Math.round(maxDisplay * GRID_H / GRID_W))}px`;

  const asciiOpts = { elapsed, cellSize, level: 3, gridWidth: GRID_W, gridHeight: GRID_H };

  // -- Skeleton view --
  const c1 = document.getElementById('skel-raw');
  c1.width = canvasW; c1.height = canvasH;
  c1.style.width = displayW; c1.style.height = displayH;
  const ctx1 = c1.getContext('2d');
  ctx1.fillStyle = '#000'; ctx1.fillRect(0, 0, canvasW, canvasH);
  const palette = {
    furDark: 'rgb(58,72,28)', furMid: 'rgb(88,108,42)',
    furShadow: 'rgb(32,40,16)', skinDark: 'rgb(42,52,22)',
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
    drawGoblinClean(tctx, sk, tw, th);
  }, 0, 0, canvasW, canvasH, asciiOpts);

  // -- Painted --
  const c3 = document.getElementById('next-raw');
  c3.width = canvasW; c3.height = canvasH;
  c3.style.width = displayW; c3.style.height = displayH;
  const ctx3 = c3.getContext('2d');
  ctx3.fillStyle = '#000'; ctx3.fillRect(0, 0, canvasW, canvasH);
  drawGoblinClean(ctx3, sk, canvasW, canvasH);

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
