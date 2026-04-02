import { fillEllipse, fillCircle, ambientOcclusion, highlight } from './helpers.js';
import { drawBodyOutline, drawLimbChain, drawDebugSkeleton } from './skeleton.js';
import { renderAscii } from './ascii-renderer.js';

// -- 5-stop radial gradient -------------------------------------------------
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
// SKELETON — undead warrior, FACES LEFT, mid-sword-swing action pose
// Identity features: skull w/ hollow sockets, prominent ribcage,
// exposed spine/vertebrae, knobby joints, no flesh — just bone
// ==========================================================================
export const skeletonSkeleton = {
  // Aggressive forward lean into sword swing, weight on front (left) foot
  // Head faces left, body extends rightward
  // Scaled up ~30% vs v1 — bones need to fill the canvas for ASCII legibility
  spine: [
    { id: 'jaw',    x: 0.20, y: 0.20, radius: 0.020 },
    { id: 'head',   x: 0.26, y: 0.12, radius: 0.072 },   // skull — BIG, it's the focal point
    { id: 'neck',   x: 0.32, y: 0.24, radius: 0.018 },   // thin vertebrae — visible but narrow
    { id: 'chest',  x: 0.38, y: 0.36, radius: 0.065 },   // ribcage — widest torso point
    { id: 'belly',  x: 0.40, y: 0.48, radius: 0.025 },   // just spine — no flesh, pinched waist
    { id: 'hip',    x: 0.42, y: 0.56, radius: 0.045 },   // pelvis — flared bone
  ],
  limbs: [
    // Near arm (LEFT side) — sword arm, swinging DOWN in a slash
    { attach: 'chest', side: 'near', segments: [
      { x: 0.30, y: 0.32, radius: 0.018 },  // shoulder ball joint — knobby
      { x: 0.20, y: 0.38, radius: 0.014 },  // elbow — bent, forward
      { x: 0.14, y: 0.44, radius: 0.011 },  // forearm
      { x: 0.08, y: 0.48, radius: 0.015 },  // hand gripping sword
    ]},
    // Far arm — hanging back, slightly raised for balance
    { attach: 'chest', side: 'far', segments: [
      { x: 0.46, y: 0.34, radius: 0.016 },  // shoulder
      { x: 0.52, y: 0.42, radius: 0.012 },  // elbow
      { x: 0.54, y: 0.50, radius: 0.010 },  // forearm
      { x: 0.54, y: 0.56, radius: 0.013 },  // bony hand
    ]},
    // Near leg — forward stride, knee bent (lunging into swing)
    { attach: 'hip', side: 'near', segments: [
      { x: 0.36, y: 0.60, radius: 0.020 },  // femur head
      { x: 0.30, y: 0.72, radius: 0.016 },  // knee knob — prominent
      { x: 0.28, y: 0.83, radius: 0.012 },  // tibia
      { x: 0.26, y: 0.93, radius: 0.016 },  // foot bones
    ]},
    // Far leg — planted back, straighter
    { attach: 'hip', side: 'far', segments: [
      { x: 0.48, y: 0.60, radius: 0.018 },  // femur
      { x: 0.54, y: 0.72, radius: 0.014 },  // knee
      { x: 0.58, y: 0.83, radius: 0.010 },  // tibia
      { x: 0.60, y: 0.93, radius: 0.014 },  // foot
    ]},
  ],
};

// ==========================================================================
// SKELETON — clean render
// Dark aged bone, eerie green eye glow, rusty sword mid-swing
// ==========================================================================
export function drawSkeletonClean(ctx, skeleton, w, h) {
  const jaw = skeleton.spine.find(n => n.id === 'jaw');
  const head = skeleton.spine.find(n => n.id === 'head');
  const neck = skeleton.spine.find(n => n.id === 'neck');
  const chest = skeleton.spine.find(n => n.id === 'chest');
  const belly = skeleton.spine.find(n => n.id === 'belly');
  const hip = skeleton.spine.find(n => n.id === 'hip');

  // PALETTE — bone needs to be brighter than typical creatures because
  // there's no flesh/fur bulk — the bones ARE the silhouette.
  // Still dark overall but bright enough to read as shapes in ASCII.
  const boneDark = [55, 48, 38];
  const boneMid = [95, 82, 66];
  const boneLight = [145, 128, 105];
  const boneShadow = [28, 22, 16];
  const boneHighlight = [175, 158, 132];
  // Eye glow — sickly green, the undead signature — BRIGHT
  const eyeGlow = [70, 225, 100];
  const eyeCore = [160, 255, 180];
  // Rusty sword — brighter so it reads in ASCII
  const swordBlade = [110, 102, 88];
  const swordRust = [82, 48, 28];
  const swordEdge = [155, 145, 128];
  const swordHilt = [55, 40, 28];
  // Tattered cloth — subtle but visible
  const clothDark = [35, 28, 22];
  const clothMid = [58, 46, 36];
  const teethColor = [135, 118, 92];

  // === 1. FAR LIMBS (behind body) ===
  for (const limb of skeleton.limbs) {
    if (limb.side === 'far') drawLimbChain(ctx, limb.segments, w, h, `rgb(${boneShadow})`);
  }
  // Far knee knob highlight
  const farKnee = skeleton.limbs[3].segments[1];
  ctx.fillStyle = `rgb(${boneDark})`;
  fillCircle(ctx, w * farKnee.x, h * farKnee.y, w * 0.012);
  // Far hand — bony fingers dangling
  const farHand = skeleton.limbs[1].segments[3];
  ctx.fillStyle = `rgb(${boneShadow})`;
  for (let f = -1; f <= 1; f++) {
    ctx.beginPath();
    ctx.moveTo(w * farHand.x, h * farHand.y);
    ctx.lineTo(w * (farHand.x + f * 0.004), h * (farHand.y + 0.032));
    ctx.lineTo(w * (farHand.x + f * 0.004 + 0.003), h * (farHand.y + 0.024));
    ctx.fill();
  }

  // === 2. SWORD — blade UP from low hand, ready to slash ===
  // Arm stays low (hand at ~0.48y), blade extends UP past the head
  const handX = 0.08, handY = 0.48;
  // Blade — sweeping UP from hand, arcing back behind the skull
  ctx.strokeStyle = `rgb(${swordBlade})`;
  ctx.lineCap = 'round';
  ctx.lineWidth = w * 0.016;
  ctx.beginPath();
  ctx.moveTo(w * handX, h * handY);
  ctx.bezierCurveTo(
    w * (handX + 0.02), h * (handY - 0.14),
    w * (handX + 0.06), h * (handY - 0.28),
    w * (handX + 0.10), h * (handY - 0.38)
  );
  ctx.stroke();
  // Blade edge — bright catch on leading edge
  ctx.strokeStyle = `rgb(${swordEdge})`;
  ctx.lineWidth = w * 0.005;
  ctx.beginPath();
  ctx.moveTo(w * (handX - 0.005), h * (handY - 0.005));
  ctx.bezierCurveTo(
    w * (handX + 0.015), h * (handY - 0.14),
    w * (handX + 0.055), h * (handY - 0.28),
    w * (handX + 0.095), h * (handY - 0.38)
  );
  ctx.stroke();
  // Rust patches on blade
  ctx.strokeStyle = `rgb(${swordRust})`;
  ctx.lineWidth = w * 0.009;
  ctx.globalAlpha = 0.6;
  ctx.beginPath();
  ctx.moveTo(w * (handX + 0.03), h * (handY - 0.16));
  ctx.lineTo(w * (handX + 0.05), h * (handY - 0.22));
  ctx.stroke();
  ctx.globalAlpha = 1.0;
  // Blade tip — pointed
  ctx.fillStyle = `rgb(${swordEdge})`;
  ctx.beginPath();
  ctx.moveTo(w * (handX + 0.10), h * (handY - 0.38));
  ctx.lineTo(w * (handX + 0.11), h * (handY - 0.42));
  ctx.lineTo(w * (handX + 0.105), h * (handY - 0.39));
  ctx.fill();
  // Crossguard — perpendicular at hand
  ctx.strokeStyle = `rgb(${swordHilt})`;
  ctx.lineWidth = w * 0.008;
  ctx.beginPath();
  ctx.moveTo(w * (handX - 0.020), h * (handY + 0.008));
  ctx.lineTo(w * (handX + 0.025), h * (handY - 0.008));
  ctx.stroke();
  // Pommel — below hand (opposite blade direction)
  ctx.fillStyle = `rgb(${swordHilt})`;
  fillCircle(ctx, w * (handX - 0.008), h * (handY + 0.020), w * 0.006);

  // === 3. TATTERED CLOTH — hanging remnants from shoulders ===
  ctx.fillStyle = `rgb(${clothDark})`;
  ctx.globalAlpha = 0.65;
  // Near-side drape — torn, hanging from shoulder to below ribs
  ctx.beginPath();
  ctx.moveTo(w * (chest.x - 0.045), h * (chest.y - 0.07));
  ctx.bezierCurveTo(
    w * (chest.x - 0.065), h * (chest.y + 0.02),
    w * (chest.x - 0.070), h * (belly.y - 0.02),
    w * (chest.x - 0.055), h * (belly.y + 0.06)
  );
  // Torn ragged edge
  ctx.lineTo(w * (chest.x - 0.048), h * (belly.y + 0.04));
  ctx.lineTo(w * (chest.x - 0.058), h * (belly.y + 0.02));
  ctx.lineTo(w * (chest.x - 0.042), h * (belly.y - 0.01));
  ctx.bezierCurveTo(
    w * (chest.x - 0.035), h * chest.y,
    w * (chest.x - 0.030), h * (chest.y - 0.04),
    w * (chest.x - 0.035), h * (chest.y - 0.06)
  );
  ctx.fill();
  // Far-side drape — shorter, darker
  ctx.fillStyle = `rgb(${clothMid})`;
  ctx.globalAlpha = 0.45;
  ctx.beginPath();
  ctx.moveTo(w * (chest.x + 0.040), h * (chest.y - 0.05));
  ctx.bezierCurveTo(
    w * (chest.x + 0.055), h * (chest.y + 0.04),
    w * (chest.x + 0.050), h * (belly.y - 0.04),
    w * (chest.x + 0.060), h * (belly.y + 0.02)
  );
  ctx.lineTo(w * (chest.x + 0.048), h * (belly.y - 0.02));
  ctx.bezierCurveTo(
    w * (chest.x + 0.040), h * (chest.y + 0.02),
    w * (chest.x + 0.035), h * (chest.y - 0.02),
    w * (chest.x + 0.032), h * (chest.y - 0.04)
  );
  ctx.fill();
  ctx.globalAlpha = 1.0;

  // === 4. BODY — base torso silhouette ===
  const bodyFill = bodyGrad3(ctx, w * chest.x, h * chest.y, w * 0.16,
    boneMid[0], boneMid[1], boneMid[2],
    boneShadow[0], boneShadow[1], boneShadow[2],
    boneLight[0], boneLight[1], boneLight[2]);
  drawBodyOutline(ctx, skeleton.spine, w, h, bodyFill);

  // === 5. RIBCAGE — THE key identity feature ===
  // Strategy: draw DARK GAPS between ribs so the body fill reads as bone
  // and the dark horizontal striations read as ribcage in ASCII.
  // Then add bright rib-top highlights for the 3D effect.

  // Dark inter-rib gaps — these create the ribcage pattern
  for (let i = 0; i < 6; i++) {
    const t = i / 6;
    const ry = chest.y - 0.07 + t * 0.16;
    const gapWidth = 0.050 - Math.abs(t - 0.35) * 0.030;

    // Dark gap between ribs (near side)
    ctx.strokeStyle = `rgba(0,0,0, 0.65)`;
    ctx.lineWidth = w * 0.004;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(w * (chest.x + 0.005), h * ry);
    ctx.bezierCurveTo(
      w * (chest.x - gapWidth * 0.35), h * (ry + 0.005 + t * 0.004),
      w * (chest.x - gapWidth * 0.75), h * (ry + 0.012 + t * 0.006),
      w * (chest.x - gapWidth - 0.005), h * (ry + 0.018 + t * 0.008)
    );
    ctx.stroke();

    // Dark gap (far side — dimmer)
    ctx.strokeStyle = `rgba(0,0,0, 0.40)`;
    ctx.lineWidth = w * 0.003;
    ctx.beginPath();
    ctx.moveTo(w * (chest.x + 0.005), h * ry);
    ctx.bezierCurveTo(
      w * (chest.x + gapWidth * 0.25), h * (ry + 0.004 + t * 0.003),
      w * (chest.x + gapWidth * 0.50), h * (ry + 0.008 + t * 0.005),
      w * (chest.x + gapWidth * 0.55), h * (ry + 0.014 + t * 0.006)
    );
    ctx.stroke();
  }

  // Bright rib-top highlights — curved bone catching light
  for (let i = 0; i < 6; i++) {
    const t = i / 6;
    const ry = chest.y - 0.072 + t * 0.16;
    const ribWidth = 0.048 - Math.abs(t - 0.35) * 0.028;

    ctx.strokeStyle = `rgba(${boneHighlight}, 0.35)`;
    ctx.lineWidth = w * 0.005;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(w * (chest.x + 0.003), h * (ry + 0.008));
    ctx.bezierCurveTo(
      w * (chest.x - ribWidth * 0.3), h * (ry + 0.012 + t * 0.003),
      w * (chest.x - ribWidth * 0.65), h * (ry + 0.018 + t * 0.005),
      w * (chest.x - ribWidth - 0.003), h * (ry + 0.024 + t * 0.007)
    );
    ctx.stroke();
  }

  // === 5b. BELLY VOID — dark "see-through" patches flanking the spine ===
  // This is what makes a skeleton a skeleton: you can see THROUGH the body
  // between the ribcage and pelvis. Only the spine column is there.
  ctx.fillStyle = `rgba(0,0,0,0.55)`;
  // Near-side void (larger, more visible)
  fillEllipse(ctx, w * (belly.x - 0.018), h * belly.y, w * 0.018, h * 0.030);
  // Far-side void (smaller)
  ctx.fillStyle = `rgba(0,0,0,0.35)`;
  fillEllipse(ctx, w * (belly.x + 0.014), h * (belly.y + 0.005), w * 0.012, h * 0.025);

  // === 6. SPINE / VERTEBRAE — exposed column from neck to pelvis ===
  // The exposed spine below the ribs is critical — it shows "no flesh"
  // Dark central spine line
  ctx.strokeStyle = `rgb(${boneShadow})`;
  ctx.lineWidth = w * 0.008;
  ctx.beginPath();
  ctx.moveTo(w * neck.x, h * (neck.y + 0.02));
  ctx.bezierCurveTo(
    w * (chest.x - 0.01), h * chest.y,
    w * belly.x, h * belly.y,
    w * hip.x, h * (hip.y - 0.01)
  );
  ctx.stroke();
  // Individual vertebrae — PROMINENT, especially in the belly gap
  // These are more visible because there's no flesh covering them
  for (let i = 0; i < 10; i++) {
    const t = i / 10;
    const vx = neck.x + t * (hip.x - neck.x) + Math.sin(t * 3) * 0.003;
    const vy = neck.y + 0.03 + t * (hip.y - neck.y - 0.04);
    // Bigger vertebrae in the belly region (exposed, no ribs covering)
    const inBellyGap = t > 0.5 && t < 0.85;
    const vr = inBellyGap ? 0.007 : 0.005;
    ctx.fillStyle = inBellyGap ? `rgb(${boneLight})` : `rgb(${boneMid})`;
    fillCircle(ctx, w * vx, h * vy, w * vr);
    // Transverse process — little wings off each vertebra
    if (inBellyGap) {
      ctx.strokeStyle = `rgb(${boneMid})`;
      ctx.lineWidth = w * 0.003;
      ctx.beginPath();
      ctx.moveTo(w * (vx - 0.010), h * (vy + 0.002));
      ctx.lineTo(w * (vx + 0.010), h * (vy - 0.002));
      ctx.stroke();
    }
  }

  // === 7. PELVIS — flared iliac bones ===
  ctx.fillStyle = `rgb(${boneMid})`;
  ctx.globalAlpha = 0.7;
  // Near iliac wing
  ctx.beginPath();
  ctx.moveTo(w * hip.x, h * (hip.y - 0.01));
  ctx.bezierCurveTo(
    w * (hip.x - 0.02), h * (hip.y - 0.025),
    w * (hip.x - 0.035), h * (hip.y - 0.015),
    w * (hip.x - 0.030), h * (hip.y + 0.01)
  );
  ctx.bezierCurveTo(
    w * (hip.x - 0.020), h * (hip.y + 0.015),
    w * (hip.x - 0.005), h * (hip.y + 0.010),
    w * hip.x, h * (hip.y + 0.005)
  );
  ctx.fill();
  // Far iliac wing — dimmer
  ctx.fillStyle = `rgb(${boneDark})`;
  ctx.beginPath();
  ctx.moveTo(w * hip.x, h * (hip.y - 0.01));
  ctx.bezierCurveTo(
    w * (hip.x + 0.018), h * (hip.y - 0.020),
    w * (hip.x + 0.030), h * (hip.y - 0.010),
    w * (hip.x + 0.025), h * (hip.y + 0.008)
  );
  ctx.bezierCurveTo(
    w * (hip.x + 0.015), h * (hip.y + 0.012),
    w * (hip.x + 0.005), h * (hip.y + 0.008),
    w * hip.x, h * (hip.y + 0.005)
  );
  ctx.fill();
  ctx.globalAlpha = 1.0;

  // === 8. NEAR LIMBS ===
  for (const limb of skeleton.limbs) {
    if (limb.side === 'near') drawLimbChain(ctx, limb.segments, w, h, `rgb(${boneDark})`);
  }

  // === 9. KNOBBY JOINT HIGHLIGHTS — key skeletal detail ===
  // Joints are bulbous bone knobs — brighter than the shafts
  for (const limb of skeleton.limbs) {
    for (let i = 1; i < limb.segments.length - 1; i++) {
      const seg = limb.segments[i];
      const isNear = limb.side === 'near';
      // Joint knob — slightly larger than the segment radius
      ctx.fillStyle = isNear ? `rgb(${boneMid})` : `rgb(${boneDark})`;
      fillCircle(ctx, w * seg.x, h * seg.y, w * (seg.radius * 1.4));
      // Highlight on top of joint
      if (isNear) {
        ctx.fillStyle = `rgb(${boneLight})`;
        ctx.globalAlpha = 0.3;
        fillCircle(ctx, w * (seg.x - 0.003), h * (seg.y - 0.003), w * (seg.radius * 0.8));
        ctx.globalAlpha = 1.0;
      }
    }
  }

  // Near knee — extra prominent (big bony kneecap)
  const nearKnee = skeleton.limbs[2].segments[1];
  ctx.fillStyle = `rgb(${boneLight})`;
  ctx.globalAlpha = 0.35;
  fillCircle(ctx, w * nearKnee.x, h * nearKnee.y, w * 0.014);
  ctx.globalAlpha = 1.0;

  // === 10. HAND gripping sword ===
  ctx.fillStyle = `rgb(${boneMid})`;
  fillEllipse(ctx, w * handX, h * handY, w * 0.011, w * 0.008);
  // Bony fingers wrapped around hilt
  ctx.fillStyle = `rgb(${boneDark})`;
  for (let f = 0; f < 4; f++) {
    const fx = handX - 0.005 + f * 0.003;
    const fy = handY - 0.003 + f * 0.002;
    fillCircle(ctx, w * fx, h * fy, w * 0.003);
  }

  // === 11. SKULL — the focal point ===
  const hx = head.x, hy = head.y, hr = head.radius;

  // Cranium shape — round dome, angular jaw, facing left
  ctx.fillStyle = bodyGrad3(ctx, w * hx, h * hy, w * hr * 2.4,
    boneMid[0], boneMid[1], boneMid[2],
    boneShadow[0], boneShadow[1], boneShadow[2],
    boneLight[0], boneLight[1], boneLight[2]);
  ctx.beginPath();
  // Start at jaw, go up the back of skull, over the dome, down the face
  ctx.moveTo(w * (hx + hr * 0.2), h * (hy + hr * 0.9));
  // Back of skull
  ctx.bezierCurveTo(
    w * (hx + hr * 1.0), h * (hy + hr * 0.6),
    w * (hx + hr * 1.1), h * (hy - hr * 0.3),
    w * (hx + hr * 0.5), h * (hy - hr * 1.0)
  );
  // Crown/dome
  ctx.bezierCurveTo(
    w * (hx - hr * 0.1), h * (hy - hr * 1.15),
    w * (hx - hr * 0.9), h * (hy - hr * 0.9),
    w * (hx - hr * 1.0), h * (hy - hr * 0.2)
  );
  // Face — brow ridge to cheekbone
  ctx.bezierCurveTo(
    w * (hx - hr * 1.0), h * (hy + hr * 0.2),
    w * (hx - hr * 0.8), h * (hy + hr * 0.6),
    w * (hx - hr * 0.5), h * (hy + hr * 0.85)
  );
  // Jaw line
  ctx.bezierCurveTo(
    w * (hx - hr * 0.2), h * (hy + hr * 0.95),
    w * (hx + hr * 0.0), h * (hy + hr * 0.95),
    w * (hx + hr * 0.2), h * (hy + hr * 0.9)
  );
  ctx.closePath();
  ctx.fill();

  // Skull top highlight — cranium catch light
  highlight(ctx, w * (hx - hr * 0.1), h * (hy - hr * 0.55), w * hr * 0.5, `rgb(${boneHighlight})`, 0.22);

  // BROW RIDGE — thick, heavy shadow. This is what makes it a skull, not a round head.
  ctx.fillStyle = `rgba(0,0,0,0.7)`;
  ctx.beginPath();
  ctx.moveTo(w * (hx - hr * 1.0), h * (hy - hr * 0.05));
  ctx.bezierCurveTo(
    w * (hx - hr * 0.6), h * (hy + hr * 0.15),
    w * (hx + hr * 0.2), h * (hy + hr * 0.15),
    w * (hx + hr * 0.7), h * (hy + hr * 0.05)
  );
  ctx.bezierCurveTo(
    w * (hx + hr * 0.2), h * (hy - hr * 0.05),
    w * (hx - hr * 0.5), h * (hy - hr * 0.05),
    w * (hx - hr * 1.0), h * (hy - hr * 0.05)
  );
  ctx.fill();

  // Temporal bone — depression on the side
  ambientOcclusion(ctx, w * (hx + hr * 0.3), h * (hy + hr * 0.1), w * hr * 0.35, w * hr * 0.3, 0.25);

  // Zygomatic arch (cheekbone) — bright ridge
  ctx.strokeStyle = `rgb(${boneHighlight})`;
  ctx.lineWidth = w * 0.004;
  ctx.globalAlpha = 0.3;
  ctx.beginPath();
  ctx.moveTo(w * (hx - hr * 0.8), h * (hy + hr * 0.25));
  ctx.bezierCurveTo(
    w * (hx - hr * 0.5), h * (hy + hr * 0.35),
    w * (hx - hr * 0.2), h * (hy + hr * 0.40),
    w * (hx + hr * 0.1), h * (hy + hr * 0.35)
  );
  ctx.stroke();
  ctx.globalAlpha = 1.0;

  // === 12. EYE SOCKETS — hollow dark voids with eerie green glow ===
  // Near eye socket — large, prominent
  const eNx = hx - hr * 0.45, eNy = hy + hr * 0.1;
  // Deep black socket
  ctx.fillStyle = `rgb(3,2,1)`;
  fillEllipse(ctx, w * eNx, h * eNy, w * 0.024, w * 0.020);
  // Socket rim shadow — makes it look recessed
  ambientOcclusion(ctx, w * eNx, h * eNy, w * 0.028, w * 0.024, 0.4);
  // Green glow emanating from within
  ctx.save();
  ctx.globalAlpha = 0.30;
  ctx.fillStyle = `rgb(${eyeGlow})`;
  fillCircle(ctx, w * eNx, h * eNy, w * 0.028);
  ctx.restore();
  // Core eye light
  ctx.fillStyle = `rgb(${eyeGlow})`;
  fillCircle(ctx, w * eNx, h * eNy, w * 0.013);
  ctx.fillStyle = `rgb(${eyeCore})`;
  fillCircle(ctx, w * eNx, h * eNy, w * 0.007);
  // Specular — the alive moment
  ctx.fillStyle = 'rgb(255,255,255)';
  fillCircle(ctx, w * (eNx - 0.006), h * (eNy - 0.006), w * 0.004);
  ctx.fillStyle = 'rgba(255,252,235,0.5)';
  fillCircle(ctx, w * (eNx + 0.004), h * (eNy + 0.003), w * 0.002);

  // Far eye socket — dimmer, partially behind nasal ridge
  const eFx = hx - hr * 0.10, eFy = hy + hr * 0.15;
  ctx.fillStyle = `rgb(3,2,1)`;
  fillEllipse(ctx, w * eFx, h * eFy, w * 0.018, w * 0.015);
  ctx.save();
  ctx.globalAlpha = 0.45;
  ctx.fillStyle = `rgba(${eyeGlow}, 0.20)`;
  fillCircle(ctx, w * eFx, h * eFy, w * 0.018);
  ctx.fillStyle = `rgb(${eyeGlow})`;
  fillCircle(ctx, w * eFx, h * eFy, w * 0.009);
  ctx.restore();

  // === 13. NASAL CAVITY — dark triangular void ===
  const nx = hx - hr * 0.55, ny = hy + hr * 0.4;
  ctx.fillStyle = `rgb(5,3,2)`;
  ctx.beginPath();
  ctx.moveTo(w * (nx - 0.006), h * (ny + 0.012));
  ctx.lineTo(w * (nx + 0.002), h * (ny - 0.004));
  ctx.lineTo(w * (nx + 0.008), h * (ny + 0.012));
  ctx.closePath();
  ctx.fill();
  // Nasal septum — thin bone divider
  ctx.strokeStyle = `rgb(${boneDark})`;
  ctx.lineWidth = w * 0.002;
  ctx.beginPath();
  ctx.moveTo(w * (nx + 0.001), h * (ny - 0.002));
  ctx.lineTo(w * (nx + 0.001), h * (ny + 0.010));
  ctx.stroke();

  // === 14. TEETH — grinning death-rictus ===
  const mx = jaw.x, my = jaw.y;
  // Mouth gap — dark
  ctx.fillStyle = `rgb(6,4,3)`;
  ctx.beginPath();
  ctx.moveTo(w * (mx - 0.030), h * (my + 0.003));
  ctx.quadraticCurveTo(w * (mx + 0.005), h * (my + 0.018), w * (hx + hr * 0.1), h * (my + 0.006));
  ctx.quadraticCurveTo(w * mx, h * (my + 0.008), w * (mx - 0.030), h * (my + 0.003));
  ctx.fill();
  // Individual teeth — irregular, slightly different sizes
  ctx.fillStyle = `rgb(${teethColor})`;
  const teeth = [
    { x: -0.026, h: 0.013 },
    { x: -0.020, h: 0.015 },
    { x: -0.014, h: 0.012 },
    { x: -0.008, h: 0.014 },
    { x: -0.002, h: 0.011 },
    { x: 0.004, h: 0.013 },
    { x: 0.010, h: 0.010 },
    { x: 0.016, h: 0.008 },
  ];
  for (const tooth of teeth) {
    const tx = mx + tooth.x;
    const ty = my + 0.002;
    ctx.beginPath();
    ctx.moveTo(w * (tx - 0.002), h * ty);
    ctx.lineTo(w * (tx - 0.001), h * (ty + tooth.h));
    ctx.lineTo(w * (tx + 0.002), h * (ty + tooth.h * 0.9));
    ctx.lineTo(w * (tx + 0.003), h * ty);
    ctx.closePath();
    ctx.fill();
  }

  // === 15. CHEEKBONE / ZYGOMATIC ARCH — prominent bone structure ===
  ctx.fillStyle = `rgb(${boneLight})`;
  ctx.globalAlpha = 0.22;
  fillEllipse(ctx, w * (hx - hr * 0.65), h * (hy + hr * 0.35), w * 0.014, w * 0.008);
  ctx.globalAlpha = 1.0;

  // === 16. NECK VERTEBRAE — visible cervical spine ===
  ctx.fillStyle = `rgb(${boneDark})`;
  for (let i = 0; i < 3; i++) {
    const t = i / 3;
    const vx = head.x + hr * 0.3 + t * (neck.x - head.x - hr * 0.3 + 0.01);
    const vy = hy + hr * 0.8 + t * (neck.y - hy - hr * 0.7);
    fillCircle(ctx, w * vx, h * vy, w * 0.005);
    // Vertebra wing (transverse process)
    ctx.strokeStyle = `rgb(${boneShadow})`;
    ctx.lineWidth = w * 0.002;
    ctx.beginPath();
    ctx.moveTo(w * (vx - 0.006), h * vy);
    ctx.lineTo(w * (vx + 0.006), h * vy);
    ctx.stroke();
  }

  // === 17. FEET — bony metatarsals ===
  for (const limb of skeleton.limbs) {
    const foot = limb.segments[limb.segments.length - 1];
    if (foot.y < 0.85) continue;
    const isNear = limb.side === 'near';
    ctx.fillStyle = isNear ? `rgb(${boneDark})` : `rgb(${boneShadow})`;
    fillEllipse(ctx, w * foot.x, h * foot.y, w * (foot.radius + 0.005), h * 0.007);
    // Toe bones — splayed
    ctx.fillStyle = isNear ? `rgb(${boneMid})` : `rgb(${boneDark})`;
    for (let t = -1; t <= 1; t++) {
      const dir = isNear ? -1 : 1;  // toes point in walking direction
      ctx.beginPath();
      ctx.moveTo(w * (foot.x + t * 0.005), h * foot.y);
      ctx.lineTo(w * (foot.x + t * 0.007 + dir * 0.005), h * (foot.y + 0.022));
      ctx.lineTo(w * (foot.x + t * 0.003 + dir * 0.003), h * (foot.y + 0.016));
      ctx.fill();
    }
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
  const sk = skeletonSkeleton;

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
  const palette = {
    furDark: 'rgb(42,36,28)', furMid: 'rgb(72,62,50)',
    furShadow: 'rgb(20,16,12)', skinDark: 'rgb(28,22,18)',
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
    drawSkeletonClean(tctx, sk, tw, th);
  }, 0, 0, canvasW, canvasH, asciiOpts);

  // -- Painted --
  const c3 = document.getElementById('next-raw');
  c3.width = canvasW; c3.height = canvasH;
  c3.style.width = displayW; c3.style.height = displayH;
  const ctx3 = c3.getContext('2d');
  ctx3.fillStyle = '#000'; ctx3.fillRect(0, 0, canvasW, canvasH);
  drawSkeletonClean(ctx3, sk, canvasW, canvasH);

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
