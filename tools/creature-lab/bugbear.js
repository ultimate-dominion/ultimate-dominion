import { fillEllipse, fillCircle, ambientOcclusion, highlight, furTextureDirectional, setSeed } from './helpers.js';
import { drawBodyOutline, drawLimbChain, drawDebugSkeleton } from './skeleton.js';
import { renderAscii } from './ascii-renderer.js';

// -- 5-stop radial gradient (hi -> mid -> shadow) ----------------------------
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
// BUGBEAR SKELETON — hulking furry brute, morningstar low, reaching forward
// Massive chest, thick limbs, bear-like proportions
// ==========================================================================
export const bugbearSkeleton = {
  spine: [
    { id: 'snout',  x: 0.20, y: 0.25, radius: 0.035 },   // bear snout, juts forward-left
    { id: 'head',   x: 0.28, y: 0.20, radius: 0.088 },   // BIG skull, hunched forward
    { id: 'neck',   x: 0.36, y: 0.30, radius: 0.075 },   // thick bull neck — barely visible
    { id: 'chest',  x: 0.46, y: 0.42, radius: 0.140 },   // MASSIVE barrel chest — WIDE
    { id: 'belly',  x: 0.50, y: 0.58, radius: 0.125 },   // thick muscular gut
    { id: 'hip',    x: 0.52, y: 0.70, radius: 0.100 },   // wide hips, powerful base
  ],
  limbs: [
    // Near arm — extended forward/down, holding morningstar low
    { attach: 'chest', side: 'near', segments: [
      { x: 0.38, y: 0.40, radius: 0.052 },  // huge shoulder
      { x: 0.30, y: 0.52, radius: 0.042 },  // thick upper arm
      { x: 0.24, y: 0.64, radius: 0.034 },  // forearm
      { x: 0.20, y: 0.76, radius: 0.028 },  // wrist — morningstar grip
    ]},
    // Far arm — reaching out/forward with armored gauntlet
    { attach: 'chest', side: 'far', segments: [
      { x: 0.50, y: 0.38, radius: 0.044 },  // far shoulder
      { x: 0.42, y: 0.30, radius: 0.034 },  // elbow up and forward
      { x: 0.32, y: 0.26, radius: 0.028 },  // forearm reaching
      { x: 0.22, y: 0.30, radius: 0.026 },  // armored gauntlet extended
    ]},
    // Near leg — forward, planted wide, THICK
    { attach: 'hip', side: 'near', segments: [
      { x: 0.44, y: 0.76, radius: 0.054 },  // massive thigh
      { x: 0.40, y: 0.84, radius: 0.044 },  // thick knee
      { x: 0.38, y: 0.92, radius: 0.038 },  // shin with armor
      { x: 0.36, y: 0.98, radius: 0.034 },  // big foot
    ]},
    // Far leg — back, weight bearing
    { attach: 'hip', side: 'far', segments: [
      { x: 0.58, y: 0.76, radius: 0.048 },  // far thigh
      { x: 0.62, y: 0.84, radius: 0.038 },  // far knee
      { x: 0.64, y: 0.92, radius: 0.034 },  // far shin
      { x: 0.66, y: 0.98, radius: 0.030 },  // far foot
    ]},
  ],
};

// ==========================================================================
// BUGBEAR — clean render for ASCII pipeline
// Dark brown fur, metal armor, morningstar, fanged snout, glowing eyes
// ==========================================================================
export function drawBugbearClean(ctx, skeleton, w, h) {
  const snout = skeleton.spine.find(n => n.id === 'snout');
  const head = skeleton.spine.find(n => n.id === 'head');
  const neck = skeleton.spine.find(n => n.id === 'neck');
  const chest = skeleton.spine.find(n => n.id === 'chest');
  const belly = skeleton.spine.find(n => n.id === 'belly');
  const hip = skeleton.spine.find(n => n.id === 'hip');

  // PALETTE — dark brown fur, reddish undertones
  const furDark = [52, 34, 22];
  const furMid = [78, 52, 34];
  const furLight = [108, 76, 48];
  const furShadow = [30, 18, 12];
  const skinPink = [120, 68, 58];     // exposed skin (snout, palms)
  const metalDark = [68, 78, 82];
  const metalMid = [98, 108, 112];
  const metalLight = [148, 158, 162];
  const metalHighlight = [185, 195, 200];
  const leatherDark = [58, 42, 28];
  const leatherMid = [82, 62, 42];
  const clothBlue = [38, 52, 82];
  const clothRed = [110, 32, 28];
  const eyeOuter = [220, 160, 30];
  const eyeCore = [255, 230, 100];
  const teethColor = [210, 200, 180];
  const clawColor = [160, 148, 130];

  setSeed(42);

  // Direction function for fur: flows downward from spine
  const furDir = (fx, fy) => {
    const cx = w * chest.x;
    const cy = h * chest.y;
    return Math.atan2(fy - cy, fx - cx) + Math.PI * 0.15;
  };

  // 1. FAR LIMBS — dark shadow color
  for (const limb of skeleton.limbs) {
    if (limb.side === 'far') drawLimbChain(ctx, limb.segments, w, h, `rgb(${furShadow})`);
  }

  // 2. FAR ARM — armored gauntlet reaching forward
  const farHand = skeleton.limbs[1].segments[3];
  // Gauntlet armor on far hand
  ctx.fillStyle = bodyGrad3(ctx, w * farHand.x, h * farHand.y, w * 0.04,
    metalMid[0], metalMid[1], metalMid[2],
    metalDark[0], metalDark[1], metalDark[2],
    metalLight[0], metalLight[1], metalLight[2]);
  fillEllipse(ctx, w * farHand.x, h * farHand.y, w * 0.024, w * 0.020);
  // Gauntlet knuckle studs
  ctx.fillStyle = `rgb(${metalHighlight})`;
  fillCircle(ctx, w * (farHand.x - 0.010), h * (farHand.y - 0.005), w * 0.004);
  fillCircle(ctx, w * (farHand.x + 0.002), h * (farHand.y - 0.006), w * 0.004);
  // Far claws extending from gauntlet
  ctx.fillStyle = `rgb(${clawColor})`;
  for (let c = 0; c < 4; c++) {
    const cx_ = w * (farHand.x - 0.014 + c * 0.009);
    const cy_ = h * (farHand.y + 0.008);
    ctx.beginPath();
    ctx.moveTo(cx_, cy_);
    ctx.lineTo(cx_ - w * 0.004, cy_ + h * 0.030);
    ctx.lineTo(cx_ + w * 0.003, cy_ + h * 0.020);
    ctx.fill();
  }

  // 3. MORNINGSTAR — shaft + spiked ball, hanging low from near hand
  const mhx = 0.20, mhy = 0.76;  // near hand position (weapon grip)
  // Shaft
  ctx.strokeStyle = `rgb(${leatherDark})`;
  ctx.lineCap = 'round';
  ctx.lineWidth = w * 0.018;
  ctx.beginPath();
  ctx.moveTo(w * mhx, h * mhy);
  ctx.lineTo(w * (mhx - 0.04), h * (mhy + 0.16));
  ctx.stroke();
  // Shaft wood grain highlight
  ctx.strokeStyle = `rgba(100,75,48,0.3)`;
  ctx.lineWidth = w * 0.005;
  ctx.beginPath();
  ctx.moveTo(w * (mhx + 0.003), h * (mhy + 0.02));
  ctx.lineTo(w * (mhx - 0.035), h * (mhy + 0.14));
  ctx.stroke();
  // Spiked ball
  const ballX = mhx - 0.04, ballY = mhy + 0.18;
  ctx.fillStyle = bodyGrad3(ctx, w * ballX, h * ballY, w * 0.045,
    metalMid[0], metalMid[1], metalMid[2],
    metalDark[0], metalDark[1], metalDark[2],
    metalLight[0], metalLight[1], metalLight[2]);
  fillCircle(ctx, w * ballX, h * ballY, w * 0.036);
  // Metal highlight on ball
  ctx.fillStyle = `rgba(${metalHighlight},0.35)`;
  fillCircle(ctx, w * (ballX - 0.008), h * (ballY - 0.010), w * 0.014);
  // Spikes — 8 spikes radiating outward
  ctx.fillStyle = `rgb(${metalLight})`;
  const spikeCount = 8;
  for (let i = 0; i < spikeCount; i++) {
    const angle = (i / spikeCount) * Math.PI * 2 + 0.3;
    const baseR = w * 0.034;
    const spikeLen = w * 0.022;
    const bx = w * ballX + Math.cos(angle) * baseR;
    const by = h * ballY + Math.sin(angle) * baseR;
    const tx = w * ballX + Math.cos(angle) * (baseR + spikeLen);
    const ty = h * ballY + Math.sin(angle) * (baseR + spikeLen);
    const perpX = -Math.sin(angle) * w * 0.006;
    const perpY = Math.cos(angle) * w * 0.006;
    ctx.beginPath();
    ctx.moveTo(bx - perpX, by - perpY);
    ctx.lineTo(tx, ty);
    ctx.lineTo(bx + perpX, by + perpY);
    ctx.closePath();
    ctx.fill();
  }
  // Spike tips — bright
  ctx.fillStyle = `rgb(${metalHighlight})`;
  for (let i = 0; i < spikeCount; i++) {
    const angle = (i / spikeCount) * Math.PI * 2 + 0.3;
    const tipR = w * 0.034 + w * 0.020;
    fillCircle(ctx, w * ballX + Math.cos(angle) * tipR, h * ballY + Math.sin(angle) * tipR, w * 0.003);
  }

  // 4. BODY — massive torso with dark fur gradient
  const bodyFill = bodyGrad3(ctx, w * chest.x, h * chest.y, w * 0.28,
    furMid[0], furMid[1], furMid[2],
    furShadow[0], furShadow[1], furShadow[2],
    furLight[0], furLight[1], furLight[2]);
  drawBodyOutline(ctx, skeleton.spine, w, h, bodyFill);

  // 5. FUR TEXTURE — thick, shaggy coat over the body
  furTextureDirectional(ctx,
    w * 0.24, h * 0.16, w * 0.38, h * 0.58,
    w * 0.022,
    `rgb(${furShadow})`, `rgb(${furLight})`,
    180, furDir);

  // Chest/belly fur — longer, shaggier, hangs down
  furTextureDirectional(ctx,
    w * 0.32, h * 0.32, w * 0.28, h * 0.34,
    w * 0.028,
    `rgb(${furDark})`, `rgb(${furMid})`,
    90, () => Math.PI * 0.55);

  // Shoulder/back fur — mane-like tuft on upper back
  furTextureDirectional(ctx,
    w * 0.30, h * 0.20, w * 0.24, h * 0.18,
    w * 0.024,
    `rgb(${furShadow})`, `rgb(${furLight})`,
    50, () => -Math.PI * 0.3);  // bristles upward/outward

  // 6. SHOULDER PAULDRON — near side, BIG metal with studs and skull emblem
  const pauldronX = chest.x - 0.06, pauldronY = chest.y - 0.10;
  ctx.fillStyle = bodyGrad3(ctx, w * pauldronX, h * pauldronY, w * 0.09,
    metalMid[0], metalMid[1], metalMid[2],
    metalDark[0], metalDark[1], metalDark[2],
    metalLight[0], metalLight[1], metalLight[2]);
  ctx.beginPath();
  ctx.moveTo(w * (pauldronX - 0.05), h * (pauldronY + 0.05));
  ctx.bezierCurveTo(
    w * (pauldronX - 0.08), h * (pauldronY - 0.02),
    w * (pauldronX + 0.02), h * (pauldronY - 0.06),
    w * (pauldronX + 0.08), h * (pauldronY - 0.01));
  ctx.bezierCurveTo(
    w * (pauldronX + 0.08), h * (pauldronY + 0.05),
    w * (pauldronX + 0.03), h * (pauldronY + 0.08),
    w * (pauldronX - 0.05), h * (pauldronY + 0.05));
  ctx.closePath();
  ctx.fill();
  // Pauldron edge — rim
  ctx.strokeStyle = `rgb(${metalDark})`;
  ctx.lineWidth = w * 0.005;
  ctx.stroke();
  // Pauldron highlight
  ctx.fillStyle = `rgba(${metalHighlight},0.35)`;
  fillEllipse(ctx, w * (pauldronX - 0.01), h * (pauldronY - 0.01), w * 0.032, w * 0.020);
  // Studs on pauldron — row of rivets
  ctx.fillStyle = `rgb(${metalHighlight})`;
  fillCircle(ctx, w * (pauldronX - 0.03), h * (pauldronY + 0.02), w * 0.006);
  fillCircle(ctx, w * (pauldronX + 0.00), h * (pauldronY - 0.005), w * 0.006);
  fillCircle(ctx, w * (pauldronX + 0.04), h * (pauldronY + 0.01), w * 0.005);
  fillCircle(ctx, w * (pauldronX + 0.06), h * (pauldronY + 0.03), w * 0.005);

  // 7. BELT — thick leather with metal buckle
  const beltY = belly.y + 0.02;
  ctx.strokeStyle = `rgb(${leatherDark})`;
  ctx.lineWidth = w * 0.014;
  ctx.beginPath();
  ctx.moveTo(w * (belly.x - 0.10), h * beltY);
  ctx.bezierCurveTo(w * belly.x, h * (beltY + 0.03), w * (belly.x + 0.06), h * (beltY + 0.02), w * (belly.x + 0.10), h * (beltY - 0.01));
  ctx.stroke();
  // Belt buckle — diamond shaped
  ctx.fillStyle = `rgb(${metalLight})`;
  const buckX = belly.x - 0.02, buckY = beltY + 0.01;
  ctx.beginPath();
  ctx.moveTo(w * buckX, h * (buckY - 0.015));
  ctx.lineTo(w * (buckX + 0.012), h * buckY);
  ctx.lineTo(w * buckX, h * (buckY + 0.015));
  ctx.lineTo(w * (buckX - 0.012), h * buckY);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = `rgb(${metalDark})`;
  ctx.lineWidth = w * 0.002;
  ctx.stroke();

  // 8. LOINCLOTH — blue with red chevrons, hanging from belt
  const loinTop = beltY + 0.01;
  // Near panel
  ctx.fillStyle = `rgb(${clothBlue})`;
  ctx.beginPath();
  ctx.moveTo(w * (belly.x - 0.06), h * loinTop);
  ctx.lineTo(w * (belly.x - 0.08), h * (loinTop + 0.14));
  ctx.lineTo(w * (belly.x + 0.02), h * (loinTop + 0.12));
  ctx.lineTo(w * (belly.x + 0.01), h * loinTop);
  ctx.closePath();
  ctx.fill();
  // Red chevrons on loincloth
  ctx.strokeStyle = `rgb(${clothRed})`;
  ctx.lineWidth = w * 0.006;
  for (let i = 0; i < 3; i++) {
    const cy_ = loinTop + 0.03 + i * 0.035;
    ctx.beginPath();
    ctx.moveTo(w * (belly.x - 0.05), h * cy_);
    ctx.lineTo(w * (belly.x - 0.02), h * (cy_ + 0.018));
    ctx.lineTo(w * (belly.x + 0.01), h * cy_);
    ctx.stroke();
  }

  // 9. NEAR LIMBS — dark fur
  for (const limb of skeleton.limbs) {
    if (limb.side === 'near') drawLimbChain(ctx, limb.segments, w, h, `rgb(${furDark})`);
  }

  // Fur on near arm
  const nearArm = skeleton.limbs[0].segments;
  furTextureDirectional(ctx,
    w * (nearArm[1].x - 0.04), h * (nearArm[1].y - 0.04),
    w * 0.12, h * 0.20,
    w * 0.016,
    `rgb(${furShadow})`, `rgb(${furMid})`,
    30, furDir);

  // 10. SHIN GUARD — near leg, metal with studs
  const shin = skeleton.limbs[2].segments[2];
  ctx.fillStyle = bodyGrad3(ctx, w * shin.x, h * shin.y, w * 0.05,
    metalMid[0], metalMid[1], metalMid[2],
    metalDark[0], metalDark[1], metalDark[2],
    metalLight[0], metalLight[1], metalLight[2]);
  ctx.beginPath();
  ctx.moveTo(w * (shin.x - 0.03), h * (shin.y - 0.03));
  ctx.bezierCurveTo(w * (shin.x - 0.04), h * shin.y, w * (shin.x - 0.04), h * (shin.y + 0.04), w * (shin.x - 0.02), h * (shin.y + 0.05));
  ctx.lineTo(w * (shin.x + 0.02), h * (shin.y + 0.05));
  ctx.bezierCurveTo(w * (shin.x + 0.03), h * (shin.y + 0.03), w * (shin.x + 0.03), h * (shin.y - 0.01), w * (shin.x + 0.02), h * (shin.y - 0.03));
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = `rgb(${metalDark})`;
  ctx.lineWidth = w * 0.003;
  ctx.stroke();
  // Shin guard studs
  ctx.fillStyle = `rgb(${metalHighlight})`;
  fillCircle(ctx, w * (shin.x - 0.01), h * (shin.y - 0.01), w * 0.004);
  fillCircle(ctx, w * (shin.x - 0.015), h * (shin.y + 0.015), w * 0.004);
  fillCircle(ctx, w * (shin.x - 0.005), h * (shin.y + 0.035), w * 0.004);

  // 11. NEAR HAND gripping morningstar
  ctx.fillStyle = `rgb(${furDark})`;
  fillEllipse(ctx, w * mhx, h * mhy, w * 0.022, w * 0.018);
  // Fingers wrapped around shaft
  ctx.fillStyle = `rgb(${skinPink})`;
  for (let f = 0; f < 4; f++) {
    fillCircle(ctx, w * (mhx - 0.008 + f * 0.005), h * (mhy + 0.004 + f * 0.003), w * 0.006);
  }

  // 12. FEET — big clawed beast feet
  for (const limb of skeleton.limbs) {
    const foot = limb.segments[limb.segments.length - 1];
    if (foot.y < 0.92) continue;
    ctx.fillStyle = limb.side === 'near' ? `rgb(${furDark})` : `rgb(${furShadow})`;
    fillEllipse(ctx, w * foot.x, h * foot.y, w * (foot.radius + 0.010), h * 0.016);
    // Claws
    ctx.fillStyle = `rgb(${clawColor})`;
    for (let c = -1; c <= 1; c++) {
      const cx_ = w * foot.x + c * w * 0.010;
      const cy_ = h * foot.y + h * 0.008;
      ctx.beginPath();
      ctx.moveTo(cx_, cy_);
      ctx.lineTo(cx_ - w * 0.004, cy_ + h * 0.028);
      ctx.lineTo(cx_ + w * 0.004, cy_ + h * 0.018);
      ctx.fill();
    }
  }

  // 13. EARS — BIG, wide, rounded bear ears sitting on top of skull
  // Must render BEFORE head so they sit behind the head mass
  const hx = head.x, hy = head.y, hr = head.radius;

  // Far ear — behind head, dark, wide rounded shape
  const earFx = hx - hr * 0.2, earFy = hy - hr * 1.2;
  ctx.fillStyle = `rgb(${furShadow})`;
  ctx.beginPath();
  ctx.moveTo(w * (earFx - 0.025), h * (earFy + 0.025));
  ctx.bezierCurveTo(
    w * (earFx - 0.035), h * (earFy - 0.02),
    w * (earFx - 0.005), h * (earFy - 0.055),
    w * (earFx + 0.025), h * (earFy - 0.01));
  ctx.bezierCurveTo(
    w * (earFx + 0.025), h * (earFy + 0.015),
    w * (earFx + 0.010), h * (earFy + 0.030),
    w * (earFx - 0.025), h * (earFy + 0.025));
  ctx.closePath();
  ctx.fill();

  // Near ear — prominent, wide rounded shape sticking up-right
  const earNx = hx + hr * 0.6, earNy = hy - hr * 1.1;
  ctx.fillStyle = `rgb(${furMid})`;
  ctx.beginPath();
  ctx.moveTo(w * (earNx - 0.020), h * (earNy + 0.030));
  ctx.bezierCurveTo(
    w * (earNx - 0.035), h * (earNy - 0.01),
    w * (earNx - 0.010), h * (earNy - 0.060),
    w * (earNx + 0.025), h * (earNy - 0.020));
  ctx.bezierCurveTo(
    w * (earNx + 0.030), h * (earNy + 0.010),
    w * (earNx + 0.015), h * (earNy + 0.035),
    w * (earNx - 0.020), h * (earNy + 0.030));
  ctx.closePath();
  ctx.fill();
  // Ear inner — pink
  ctx.fillStyle = `rgb(${skinPink})`;
  ctx.beginPath();
  ctx.moveTo(w * (earNx - 0.010), h * (earNy + 0.020));
  ctx.bezierCurveTo(
    w * (earNx - 0.020), h * (earNy - 0.002),
    w * (earNx - 0.002), h * (earNy - 0.040),
    w * (earNx + 0.016), h * (earNy - 0.010));
  ctx.bezierCurveTo(
    w * (earNx + 0.018), h * (earNy + 0.008),
    w * (earNx + 0.008), h * (earNy + 0.024),
    w * (earNx - 0.010), h * (earNy + 0.020));
  ctx.closePath();
  ctx.fill();

  // 14. HEAD — bear-like skull, wide and powerful
  ctx.fillStyle = bodyGrad3(ctx, w * hx, h * hy, w * hr * 2.5,
    furMid[0], furMid[1], furMid[2],
    furShadow[0], furShadow[1], furShadow[2],
    furLight[0], furLight[1], furLight[2]);
  // Main head shape — wide, bear-like
  fillEllipse(ctx, w * hx, h * hy, w * hr * 1.5, h * hr * 1.3);
  // Head fur
  furTextureDirectional(ctx,
    w * (hx - hr * 1.2), h * (hy - hr * 1.0),
    w * hr * 3.0, h * hr * 2.5,
    w * 0.014,
    `rgb(${furShadow})`, `rgb(${furMid})`,
    50, (fx, fy) => Math.atan2(fy - h * hy, fx - w * hx) + 0.3);

  // 15. SNOUT — big bear muzzle, prominent, jutting forward-down
  const sx = snout.x, sy = snout.y;
  // Muzzle base — wide rectangular shape like a real bear
  ctx.fillStyle = bodyGrad3(ctx, w * sx, h * (sy + 0.02), w * 0.08,
    skinPink[0], skinPink[1], skinPink[2],
    furDark[0], furDark[1], furDark[2],
    furMid[0], furMid[1], furMid[2]);
  // Wide muzzle shape — NOT a small patch, a proper bear snout
  ctx.beginPath();
  ctx.moveTo(w * (hx - hr * 0.8), h * (hy + 0.01));       // left connection to head
  ctx.bezierCurveTo(
    w * (sx + 0.04), h * (sy - 0.06),               // top of muzzle curves up
    w * (sx - 0.06), h * (sy - 0.05),               // top ridge
    w * (sx - 0.08), h * (sy + 0.00));              // nose tip
  ctx.bezierCurveTo(
    w * (sx - 0.08), h * (sy + 0.06),               // bottom of nose
    w * (sx - 0.03), h * (sy + 0.09),               // jaw curve
    w * (hx - hr * 0.2), h * (hy + hr * 1.0));      // connects back to chin
  ctx.fill();
  // Fur on snout bridge
  furTextureDirectional(ctx,
    w * (sx - 0.04), h * (sy - 0.04),
    w * 0.10, h * 0.06,
    w * 0.010,
    `rgb(${furShadow})`, `rgb(${furDark})`,
    20, () => -0.3);

  // Big black nose — bear nose, prominent
  ctx.fillStyle = 'rgb(18,12,10)';
  fillEllipse(ctx, w * (sx - 0.06), h * (sy + 0.005), w * 0.022, w * 0.018);
  // Nose highlight
  ctx.fillStyle = 'rgba(80,60,50,0.4)';
  fillEllipse(ctx, w * (sx - 0.065), h * (sy - 0.002), w * 0.010, w * 0.008);
  // Nostrils
  ctx.fillStyle = 'rgb(8,4,3)';
  fillCircle(ctx, w * (sx - 0.072), h * (sy + 0.006), w * 0.006);
  fillCircle(ctx, w * (sx - 0.048), h * (sy + 0.008), w * 0.005);

  // 16. MOUTH — wide snarl, big fangs
  ctx.fillStyle = 'rgb(14,6,4)';
  ctx.beginPath();
  ctx.moveTo(w * (sx - 0.07), h * (sy + 0.025));
  ctx.bezierCurveTo(
    w * (sx - 0.04), h * (sy + 0.07),
    w * (sx + 0.02), h * (sy + 0.08),
    w * (hx - hr * 0.1), h * (hy + hr * 0.7));
  ctx.bezierCurveTo(
    w * (sx + 0.01), h * (sy + 0.05),
    w * (sx - 0.03), h * (sy + 0.035),
    w * (sx - 0.07), h * (sy + 0.025));
  ctx.fill();
  // Upper fangs — big, prominent
  ctx.fillStyle = `rgb(${teethColor})`;
  ctx.beginPath();
  ctx.moveTo(w * (sx - 0.055), h * (sy + 0.025));
  ctx.lineTo(w * (sx - 0.062), h * (sy + 0.060));
  ctx.lineTo(w * (sx - 0.045), h * (sy + 0.032));
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(w * (sx - 0.025), h * (sy + 0.035));
  ctx.lineTo(w * (sx - 0.032), h * (sy + 0.065));
  ctx.lineTo(w * (sx - 0.018), h * (sy + 0.042));
  ctx.fill();
  // Lower fangs — underbite, tusks sticking up
  ctx.beginPath();
  ctx.moveTo(w * (sx - 0.040), h * (sy + 0.052));
  ctx.lineTo(w * (sx - 0.038), h * (sy + 0.028));
  ctx.lineTo(w * (sx - 0.032), h * (sy + 0.050));
  ctx.fill();
  // Small teeth filling gap
  ctx.fillStyle = 'rgb(190,182,162)';
  for (let t = 0; t < 3; t++) {
    const tx = sx - 0.050 + t * 0.012;
    const ty = sy + 0.028 + t * 0.006;
    ctx.beginPath();
    ctx.moveTo(w * tx, h * ty);
    ctx.lineTo(w * (tx - 0.003), h * (ty + 0.020));
    ctx.lineTo(w * (tx + 0.003), h * (ty + 0.012));
    ctx.fill();
  }

  // 17. BROW RIDGE — heavy, dark, creates menacing shadow over eyes
  ctx.fillStyle = `rgb(${furShadow})`;
  ctx.beginPath();
  ctx.moveTo(w * (hx - hr * 1.0), h * (hy - 0.005));
  ctx.bezierCurveTo(
    w * (hx - hr * 0.5), h * (hy - 0.025),
    w * (hx + hr * 0.3), h * (hy - 0.025),
    w * (hx + hr * 0.8), h * (hy - 0.005));
  ctx.bezierCurveTo(
    w * (hx + hr * 0.6), h * (hy + 0.015),
    w * (hx - hr * 0.3), h * (hy + 0.015),
    w * (hx - hr * 1.0), h * (hy - 0.005));
  ctx.closePath();
  ctx.fill();
  // Brow highlight on top edge
  ctx.strokeStyle = `rgb(${furDark})`;
  ctx.lineWidth = w * 0.004;
  ctx.beginPath();
  ctx.moveTo(w * (hx - hr * 0.9), h * (hy - 0.005));
  ctx.bezierCurveTo(
    w * (hx - hr * 0.4), h * (hy - 0.022),
    w * (hx + hr * 0.2), h * (hy - 0.022),
    w * (hx + hr * 0.7), h * (hy - 0.005));
  ctx.stroke();

  // 18. EYES — BIG, glowing, menacing — the brightest things on the face
  // Near eye — large, wide, with heavy glow halo
  const eNx = hx - 0.04, eNy = hy + 0.005;
  // Deep socket shadow
  ambientOcclusion(ctx, w * eNx, h * eNy, w * 0.032, w * 0.026, 0.50);
  // Outer glow — wide halo
  ctx.save(); ctx.globalAlpha = 0.40;
  ctx.fillStyle = `rgb(${eyeOuter})`;
  fillCircle(ctx, w * eNx, h * eNy, w * 0.032);
  ctx.restore();
  // Eye body
  ctx.fillStyle = `rgb(${eyeOuter})`;
  fillCircle(ctx, w * eNx, h * eNy, w * 0.022);
  // Bright core
  ctx.fillStyle = `rgb(${eyeCore})`;
  fillCircle(ctx, w * eNx, h * eNy, w * 0.014);
  // Pupil — dark slit
  ctx.fillStyle = 'rgb(6,2,1)';
  fillEllipse(ctx, w * (eNx - 0.002), h * eNy, w * 0.005, w * 0.010);
  // Specular highlight — bright white
  ctx.fillStyle = 'rgb(255,255,255)';
  fillCircle(ctx, w * (eNx - 0.008), h * (eNy - 0.008), w * 0.006);
  // Second smaller specular
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  fillCircle(ctx, w * (eNx + 0.006), h * (eNy + 0.004), w * 0.003);

  // Far eye — slightly smaller, dimmer, partially under brow
  const eFx = hx + hr * 0.35, eFy = hy + 0.005;
  ambientOcclusion(ctx, w * eFx, h * eFy, w * 0.026, w * 0.022, 0.45);
  ctx.save(); ctx.globalAlpha = 0.30;
  ctx.fillStyle = `rgb(${eyeOuter})`;
  fillCircle(ctx, w * eFx, h * eFy, w * 0.026);
  ctx.restore();
  ctx.fillStyle = `rgb(${eyeOuter})`;
  fillCircle(ctx, w * eFx, h * eFy, w * 0.017);
  ctx.fillStyle = `rgb(${eyeCore})`;
  fillCircle(ctx, w * eFx, h * eFy, w * 0.010);
  ctx.fillStyle = 'rgb(6,2,1)';
  fillEllipse(ctx, w * (eFx - 0.001), h * eFy, w * 0.004, w * 0.008);
  ctx.fillStyle = 'rgb(255,255,255)';
  fillCircle(ctx, w * (eFx - 0.006), h * (eFy - 0.006), w * 0.004);
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  fillCircle(ctx, w * (eFx + 0.004), h * (eFy + 0.003), w * 0.002);

  // 19. BLOOD SPLATTER — on the ground near morningstar (from the ref)
  ctx.fillStyle = 'rgb(120, 18, 12)';
  ctx.beginPath();
  ctx.moveTo(w * 0.12, h * 0.96);
  ctx.bezierCurveTo(w * 0.10, h * 0.94, w * 0.08, h * 0.95, w * 0.07, h * 0.97);
  ctx.bezierCurveTo(w * 0.09, h * 0.98, w * 0.11, h * 0.98, w * 0.12, h * 0.96);
  ctx.fill();
}

// ==========================================================================
// Harness
// ==========================================================================
const GRID_W = 7;
const GRID_H = 7;

export default { draw: drawBugbearClean, skeleton: bugbearSkeleton, gridW: GRID_W, gridH: GRID_H };

if (typeof document !== 'undefined') {
function render(elapsed = 0) {
  const size = parseInt(document.getElementById('canvas-size').value);
  const cellSize = parseInt(document.getElementById('cell-size').value);
  const showGrid = document.getElementById('show-grid').checked;
  const showDebug = document.getElementById('show-debug').checked;
  const sk = bugbearSkeleton;

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
    furDark: 'rgb(52,34,22)', furMid: 'rgb(78,52,34)',
    furShadow: 'rgb(30,18,12)', skinDark: 'rgb(40,26,18)',
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
    drawBugbearClean(tctx, sk, tw, th);
  }, 0, 0, canvasW, canvasH, asciiOpts);

  // -- Painted --
  const c3 = document.getElementById('next-raw');
  c3.width = canvasW; c3.height = canvasH;
  c3.style.width = displayW; c3.style.height = displayH;
  const ctx3 = c3.getContext('2d');
  ctx3.fillStyle = '#000'; ctx3.fillRect(0, 0, canvasW, canvasH);
  drawBugbearClean(ctx3, sk, canvasW, canvasH);

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
