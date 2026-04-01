import { fillEllipse, fillCircle, ambientOcclusion, highlight } from './helpers.js';
import { drawBodyOutline, drawLimbChain, drawTail, drawDebugSkeleton } from './skeleton.js';
import { renderAscii } from './ascii-renderer.js';

// -- 3-stop radial gradient (hi → mid → shadow) ----------------------------
function bodyGrad3(ctx, cx, cy, r, midR, midG, midB, sR, sG, sB, hiR, hiG, hiB) {
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
  g.addColorStop(0, `rgb(${hiR},${hiG},${hiB})`);
  g.addColorStop(0.25, `rgb(${midR},${midG},${midB})`);
  g.addColorStop(0.50, `rgb(${Math.floor(midR * 0.85 + sR * 0.15)},${Math.floor(midG * 0.85 + sG * 0.15)},${Math.floor(midB * 0.85 + sB * 0.15)})`);
  g.addColorStop(0.75, `rgb(${Math.floor(midR * 0.5 + sR * 0.5)},${Math.floor(midG * 0.5 + sG * 0.5)},${Math.floor(midB * 0.5 + sB * 0.5)})`);
  g.addColorStop(1, `rgb(${sR},${sG},${sB})`);
  return g;
}

// -- Scale texture -----------------------------------------------------------
function scaleTexture(ctx, x, y, w, h, size, dark, light, density = 0.8) {
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

// ==========================================================================
// KOBOLD SKELETON — hunched bipedal, 3/4 view, spear arm, digitigrade legs
// ==========================================================================
export const koboldSkeleton = {
  // EXTREME CROUCH — body nearly horizontal, lunging forward
  // Like the 2e MM reference: spring-loaded, about to strike
  spine: [
    // Head BELOW shoulder line, thrust forward aggressively
    { id: 'snout',  x: 0.08, y: 0.42, radius: 0.012 },
    { id: 'head',   x: 0.17, y: 0.36, radius: 0.042 },
    // Neck dips, shoulders are the highest point (hunched)
    { id: 'neck',   x: 0.27, y: 0.32, radius: 0.028 },
    { id: 'chest',  x: 0.38, y: 0.34, radius: 0.055 },
    { id: 'belly',  x: 0.50, y: 0.38, radius: 0.048 },
    // Hip slightly higher — haunches coiled to spring
    { id: 'hip',    x: 0.60, y: 0.36, radius: 0.042 },
  ],
  limbs: [
    // Near arm — spear arm, reaching FAR forward and down
    { attach: 'chest', side: 'near', segments: [
      { x: 0.32, y: 0.38, radius: 0.022 },  // shoulder
      { x: 0.22, y: 0.48, radius: 0.012 },  // elbow — down and forward
      { x: 0.14, y: 0.46, radius: 0.008 },  // forearm — reaching
      { x: 0.08, y: 0.48, radius: 0.012 },  // hand gripping spear
    ]},
    // Far arm — tucked back, claws spread for balance
    { attach: 'chest', side: 'far', segments: [
      { x: 0.42, y: 0.38, radius: 0.018 },
      { x: 0.38, y: 0.50, radius: 0.010 },
      { x: 0.34, y: 0.54, radius: 0.007 },
      { x: 0.30, y: 0.56, radius: 0.010 },
    ]},
    // Near leg — FORWARD stride, extreme digitigrade zigzag
    // thigh forward → knee down → ankle BACK (the "backward knee") → foot forward
    { attach: 'hip', side: 'near', segments: [
      { x: 0.52, y: 0.42, radius: 0.028 },  // thigh root (in body)
      { x: 0.44, y: 0.56, radius: 0.016 },  // knee — forward and down
      { x: 0.50, y: 0.68, radius: 0.010 },  // ankle — BACK (digitigrade!)
      { x: 0.42, y: 0.76, radius: 0.008 },  // metatarsal — forward
      { x: 0.38, y: 0.84, radius: 0.014 },  // foot — splayed toes
    ]},
    // Far leg — BACK stride, coiled, ready to push off
    { attach: 'hip', side: 'far', segments: [
      { x: 0.62, y: 0.42, radius: 0.024 },  // thigh root
      { x: 0.66, y: 0.54, radius: 0.013 },  // knee — behind body
      { x: 0.62, y: 0.66, radius: 0.009 },  // ankle — digitigrade back-bend
      { x: 0.66, y: 0.74, radius: 0.007 },  // metatarsal
      { x: 0.68, y: 0.82, radius: 0.012 },  // foot — pushing off
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

// ==========================================================================
// KOBOLD — clean render for ASCII pipeline
// Dark olive-brown scales, bright orange vest, glowing yellow eyes
// ==========================================================================
export function drawKoboldClean(ctx, skeleton, w, h) {
  const snout = skeleton.spine.find(n => n.id === 'snout');
  const head = skeleton.spine.find(n => n.id === 'head');
  const neck = skeleton.spine.find(n => n.id === 'neck');
  const chest = skeleton.spine.find(n => n.id === 'chest');
  const belly = skeleton.spine.find(n => n.id === 'belly');
  const hip = skeleton.spine.find(n => n.id === 'hip');

  // PALETTE — dark reptilian, bright vest + eyes
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
  const tp = skeleton.tail.points;
  ctx.lineCap = 'round';
  // Thick base segment (points 0-3)
  ctx.strokeStyle = `rgb(${scaleDark})`;
  ctx.lineWidth = w * 0.018;
  ctx.beginPath();
  ctx.moveTo(w * tp[0].x, h * tp[0].y);
  ctx.bezierCurveTo(w * tp[1].x, h * tp[1].y, w * tp[2].x, h * tp[2].y, w * tp[3].x, h * tp[3].y);
  ctx.stroke();
  // Mid segment (points 3-5) — tapers
  ctx.strokeStyle = `rgb(${scaleMid})`;
  ctx.lineWidth = w * 0.010;
  ctx.beginPath();
  ctx.moveTo(w * tp[3].x, h * tp[3].y);
  ctx.bezierCurveTo(w * tp[4].x, h * tp[4].y, w * tp[5].x, h * (tp[5].y + 0.02), w * (tp[5].x + 0.01), h * (tp[5].y - 0.02));
  ctx.stroke();
  // Tail tip whip
  ctx.strokeStyle = `rgb(${scaleLight})`;
  ctx.lineWidth = w * 0.004;
  ctx.beginPath();
  ctx.moveTo(w * (tp[5].x + 0.01), h * (tp[5].y - 0.02));
  ctx.lineTo(w * (tp[5].x + 0.03), h * (tp[5].y - 0.05));
  ctx.stroke();
  // Underside highlight along the S-curve
  ctx.strokeStyle = `rgba(${scaleLight},0.20)`;
  ctx.lineWidth = w * 0.003;
  ctx.beginPath();
  ctx.moveTo(w * tp[0].x, h * (tp[0].y + 0.012));
  ctx.bezierCurveTo(w * tp[1].x, h * (tp[1].y + 0.010), w * tp[2].x, h * (tp[2].y + 0.008), w * tp[3].x, h * (tp[3].y + 0.008));
  ctx.bezierCurveTo(w * tp[4].x, h * (tp[4].y + 0.006), w * tp[5].x, h * (tp[5].y + 0.004), w * (tp[5].x + 0.01), h * (tp[5].y - 0.01));
  ctx.stroke();

  // 2. FAR LIMBS — dark, behind body
  for (const limb of skeleton.limbs) {
    if (limb.side === 'far') drawLimbChain(ctx, limb.segments, w, h, `rgb(${scaleShadow})`);
  }

  // 3. SPEAR — thick shaft, longer reach, lunging forward
  const handX = 0.08, handY = 0.48;
  // Shaft — thick, from well behind body to past hand
  ctx.strokeStyle = `rgb(${spearWood})`;
  ctx.lineCap = 'round';
  ctx.lineWidth = w * 0.016;
  ctx.beginPath();
  ctx.moveTo(w * 0.48, h * 0.60); // butt end — further behind body
  ctx.lineTo(w * handX, h * handY); // through hand
  ctx.stroke();
  ctx.lineWidth = w * 0.013;
  ctx.beginPath();
  ctx.moveTo(w * handX, h * handY);
  ctx.lineTo(w * -0.10, h * 0.36); // extends further past hand
  ctx.stroke();
  // Shaft wood grain highlight
  ctx.strokeStyle = 'rgba(140,110,70,0.30)';
  ctx.lineWidth = w * 0.004;
  ctx.beginPath();
  ctx.moveTo(w * 0.40, h * 0.57);
  ctx.lineTo(w * -0.06, h * 0.38);
  ctx.stroke();
  // Spear tip — larger leaf-shaped head, bright
  ctx.fillStyle = `rgb(${spearTip})`;
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
  ctx.strokeStyle = `rgb(${vestDark})`;
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
  drawBodyOutline(ctx, skeleton.spine, w, h, bodyFill);

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
  ctx.strokeStyle = `rgb(${vestDark})`;
  ctx.lineWidth = w * 0.003;
  ctx.stroke();
  // Vest AO — bottom edge
  ambientOcclusion(ctx, w * chest.x, h * (chest.y + 0.05), w * 0.06, h * 0.012, 0.25);
  highlight(ctx, w * (chest.x - 0.02), h * (chest.y - 0.02), w * 0.02, `rgb(${vestLight})`, 0.18);

  // 6. NEAR LIMBS
  for (const limb of skeleton.limbs) {
    if (limb.side === 'near') drawLimbChain(ctx, limb.segments, w, h, `rgb(${scaleDark})`);
  }

  // 7. CLAWED FEET — on all leg endpoints
  for (const limb of skeleton.limbs) {
    const foot = limb.segments[limb.segments.length - 1];
    if (foot.y < 0.75) continue; // only feet
    ctx.fillStyle = limb.side === 'near' ? `rgb(${scaleDark})` : `rgb(${scaleShadow})`;
    fillEllipse(ctx, w * foot.x, h * foot.y, w * (foot.radius + 0.004), h * 0.010);
    // Claw tips — bright
    ctx.fillStyle = `rgb(${teethColor})`;
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
  ctx.fillStyle = `rgb(${scaleMid})`;
  fillEllipse(ctx, w * handX, h * handY, w * 0.012, w * 0.009);
  ctx.fillStyle = `rgb(${scaleDark})`;
  for (let f = 0; f < 3; f++) {
    fillCircle(ctx, w * (handX - 0.004 + f * 0.004), h * (handY - 0.004 + f * 0.004), w * 0.004);
  }
  // Far hand claws spread for balance
  ctx.fillStyle = `rgb(${scaleShadow})`;
  const farHand = skeleton.limbs[1].segments[3];
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
  ctx.fillStyle = `rgb(${hornColor})`;
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
  ctx.fillStyle = `rgb(${scaleLight})`;
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
    ctx.fillStyle = `rgb(${hornColor})`;
    ctx.beginPath();
    ctx.moveTo(w * spx, h * spy);
    ctx.lineTo(w * (spx + 0.004), h * (spy - 0.022 + i * 0.003));
    ctx.lineTo(w * (spx + 0.010), h * spy);
    ctx.fill();
  }

  // 11. SNOUT — dark nub
  ctx.fillStyle = `rgb(${scaleDark})`;
  ctx.beginPath();
  ctx.arc(w * (sx - 0.015), h * (sy + 0.005), w * 0.014, 0, Math.PI * 2);
  ctx.fill();
  // Nostrils
  ctx.fillStyle = `rgb(${scaleShadow})`;
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
  ctx.fillStyle = `rgb(${teethColor})`;
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
  ctx.fillStyle = `rgb(${teethColor})`;
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
  ctx.fillStyle = `rgb(${eyeGlow})`;
  fillCircle(ctx, w * eNx, h * eNy, w * 0.026);
  ctx.restore();
  ctx.fillStyle = `rgb(${eyeGlow})`;
  fillCircle(ctx, w * eNx, h * eNy, w * 0.016);
  ctx.fillStyle = `rgb(${eyeCore})`;
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
  ctx.fillStyle = `rgba(${eyeGlow},0.22)`;
  fillCircle(ctx, w * eFx, h * eFy, w * 0.016);
  ctx.fillStyle = `rgb(${eyeGlow})`;
  fillCircle(ctx, w * eFx, h * eFy, w * 0.010);
  ctx.fillStyle = `rgb(${eyeCore})`;
  fillCircle(ctx, w * eFx, h * eFy, w * 0.006);
  ctx.restore();

  // 14. Scale texture on body
  scaleTexture(ctx, w * (chest.x - 0.06), h * (chest.y - 0.02), w * 0.18, h * 0.12,
    w * 0.010, `rgba(${scaleShadow},0.35)`, `rgba(${scaleLight},0.15)`, 0.50);
  // Head scales
  scaleTexture(ctx, w * (hx - 0.02), h * (hy - 0.02), w * 0.05, h * 0.04,
    w * 0.005, `rgba(${scaleShadow},0.30)`, `rgba(${scaleLight},0.12)`, 0.65);

  // 15. Spine ridge — small bumps along the back from neck to tail
  ctx.fillStyle = `rgb(${scaleDark})`;
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

// ==========================================================================
// Harness
// ==========================================================================
const GRID_W = 7;
const GRID_H = 5;

function render(elapsed = 0) {
  const size = parseInt(document.getElementById('canvas-size').value);
  const cellSize = parseInt(document.getElementById('cell-size').value);
  const showGrid = document.getElementById('show-grid').checked;
  const showDebug = document.getElementById('show-debug').checked;
  const sk = koboldSkeleton;

  const canvasW = size;
  const canvasH = Math.round(size * GRID_H / GRID_W);
  const maxDisplay = 420;
  const displayW = `${Math.min(canvasW, maxDisplay)}px`;
  const displayH = `${Math.min(canvasH, Math.round(maxDisplay * GRID_H / GRID_W))}px`;

  const asciiOpts = { elapsed, cellSize, level: 2, gridWidth: GRID_W, gridHeight: GRID_H };

  // -- Skeleton view --
  const c1 = document.getElementById('skel-raw');
  c1.width = canvasW; c1.height = canvasH;
  c1.style.width = displayW; c1.style.height = displayH;
  const ctx1 = c1.getContext('2d');
  ctx1.fillStyle = '#000'; ctx1.fillRect(0, 0, canvasW, canvasH);
  // Flat skeleton
  const palette = {
    furDark: 'rgb(52,42,32)', furMid: 'rgb(78,64,48)',
    furShadow: 'rgb(26,20,14)', skinDark: 'rgb(48,28,24)',
  };
  // Draw flat body
  if (sk.tail) drawTail(ctx1, sk.tail.points, sk.tail.startWidth, sk.tail.endWidth, canvasW, canvasH, palette.skinDark);
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
    drawKoboldClean(tctx, sk, tw, th);
  }, 0, 0, canvasW, canvasH, asciiOpts);

  // -- Painted --
  const c3 = document.getElementById('next-raw');
  c3.width = canvasW; c3.height = canvasH;
  c3.style.width = displayW; c3.style.height = displayH;
  const ctx3 = c3.getContext('2d');
  ctx3.fillStyle = '#000'; ctx3.fillRect(0, 0, canvasW, canvasH);
  drawKoboldClean(ctx3, sk, canvasW, canvasH);

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
