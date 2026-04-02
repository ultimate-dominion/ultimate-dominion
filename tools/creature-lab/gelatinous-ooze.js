import { fillEllipse, fillCircle, ambientOcclusion } from './helpers.js';
import { renderAscii } from './ascii-renderer.js';

// ==========================================================================
// GELATINOUS OOZE — translucent cube/blob with dissolved objects inside
// No skeleton system — this is a non-humanoid amorphous creature
// Identity: cube shape, semi-transparent teal, skull/bones/dagger inside,
//           dripping slime, eerie inner glow, no face
// ==========================================================================

// Dummy skeleton for harness compat (no skeleton debug panel needed)
export const gelatinousOozeSkeleton = {
  spine: [
    { id: 'center', x: 0.50, y: 0.50, radius: 0.25 },
  ],
  limbs: [],
};

// ==========================================================================
// CLEAN RENDER — translucent cube with dissolved contents
// ==========================================================================
export function drawGelatinousOozeClean(ctx, skeleton, w, h) {
  // --- PALETTE ---
  // Dark teal-green, paint dark for ASCII renderer
  const bodyDark  = [6, 22, 18];      // very dark teal
  const bodyMid   = [12, 38, 32];     // dark teal
  const bodyLight = [20, 58, 48];     // teal highlight
  const bodyBright= [32, 85, 68];     // bright edge
  const slimeGlow = [60, 210, 160];   // bright slime drip — POP
  const innerGlow = [40, 150, 110];   // eerie glow inside — stronger
  const boneColor = [220, 210, 170];  // skull/bones — BRIGHT accent (like eyes)
  const boneDark  = [140, 128, 95];   // bone shadow — still readable
  const metalBright=[230, 235, 245];  // dagger blade — near white
  const metalDark = [110, 115, 120];  // dagger handle/guard

  // --- CUBE GEOMETRY ---
  // Roughly square — wider and shorter than before
  const cubeL = 0.14;   // left edge
  const cubeR = 0.82;   // right edge
  const cubeT = 0.18;   // top edge (pushed down)
  const cubeB = 0.82;   // bottom edge (pulled up)

  // Top face vanishing points (3/4 perspective)
  const topTL = { x: 0.18, y: 0.18 };
  const topTR = { x: 0.86, y: 0.22 };
  const topBL = { x: 0.14, y: 0.24 };
  const topBR = { x: 0.82, y: 0.28 };

  // Front face corners (irregular — it's organic, alive, slightly melting)
  const fTL = { x: 0.15, y: 0.23 };
  const fTR = { x: 0.81, y: 0.27 };
  const fBR = { x: 0.78, y: 0.80 };
  const fBL = { x: 0.18, y: 0.82 };

  // --- 1. PUDDLE / BASE OOZE ---
  // Dark ooze spreading at the base
  const puddleGrad = ctx.createRadialGradient(
    w * 0.48, h * 0.86, 0,
    w * 0.48, h * 0.86, w * 0.38
  );
  puddleGrad.addColorStop(0, `rgba(${bodyMid},0.5)`);
  puddleGrad.addColorStop(0.6, `rgba(${bodyDark},0.3)`);
  puddleGrad.addColorStop(1, `rgba(0,0,0,0)`);
  ctx.fillStyle = puddleGrad;
  fillEllipse(ctx, w * 0.48, h * 0.86, w * 0.38, h * 0.06);

  // --- 2. MAIN CUBE BODY ---
  // Back shadow (depth)
  ctx.fillStyle = `rgba(${bodyDark},0.6)`;
  ctx.beginPath();
  ctx.moveTo(w * (fTL.x + 0.02), h * (fTL.y + 0.02));
  ctx.lineTo(w * (fTR.x + 0.02), h * (fTR.y + 0.02));
  ctx.lineTo(w * (fBR.x + 0.02), h * (fBR.y + 0.02));
  ctx.lineTo(w * (fBL.x + 0.02), h * (fBL.y + 0.02));
  ctx.closePath();
  ctx.fill();

  // Main cube body — dark fill with organic bezier edges
  const bodyGrad = ctx.createLinearGradient(w * cubeL, 0, w * cubeR, 0);
  bodyGrad.addColorStop(0, `rgb(${bodyMid})`);
  bodyGrad.addColorStop(0.3, `rgb(${bodyDark})`);
  bodyGrad.addColorStop(0.6, `rgb(${bodyMid})`);
  bodyGrad.addColorStop(1, `rgb(${bodyDark})`);
  ctx.fillStyle = bodyGrad;
  ctx.beginPath();
  ctx.moveTo(w * fTL.x, h * fTL.y);
  // Top edge — slight upward bulge
  ctx.bezierCurveTo(w * 0.35, h * (fTL.y - 0.015), w * 0.60, h * (fTR.y - 0.01), w * fTR.x, h * fTR.y);
  // Right edge — slight outward bulge
  ctx.bezierCurveTo(w * (fTR.x + 0.015), h * 0.40, w * (fBR.x + 0.02), h * 0.65, w * fBR.x, h * fBR.y);
  // Bottom edge — sagging/melting, curves down
  ctx.bezierCurveTo(w * 0.60, h * (fBR.y + 0.03), w * 0.38, h * (fBL.y + 0.04), w * fBL.x, h * fBL.y);
  // Left edge — slight outward bulge
  ctx.bezierCurveTo(w * (fBL.x - 0.015), h * 0.60, w * (fTL.x - 0.02), h * 0.35, w * fTL.x, h * fTL.y);
  ctx.closePath();
  ctx.fill();

  // Vertical gradient overlay for depth (darker at bottom, slightly lighter at top)
  const vertGrad = ctx.createLinearGradient(0, h * cubeT, 0, h * cubeB);
  vertGrad.addColorStop(0, `rgba(${bodyLight},0.15)`);
  vertGrad.addColorStop(0.3, `rgba(0,0,0,0)`);
  vertGrad.addColorStop(0.7, `rgba(0,0,0,0.1)`);
  vertGrad.addColorStop(1, `rgba(0,0,0,0.25)`);
  ctx.fillStyle = vertGrad;
  ctx.fillRect(w * fTL.x, h * fTL.y, w * (fTR.x - fTL.x), h * (fBL.y - fTL.y));

  // --- 3. TOP FACE (3/4 perspective) ---
  const topGrad = ctx.createLinearGradient(0, h * topTL.y, 0, h * topBR.y);
  topGrad.addColorStop(0, `rgb(${bodyLight})`);
  topGrad.addColorStop(1, `rgb(${bodyMid})`);
  ctx.fillStyle = topGrad;
  ctx.beginPath();
  ctx.moveTo(w * topTL.x, h * topTL.y);
  ctx.lineTo(w * topTR.x, h * topTR.y);
  ctx.lineTo(w * topBR.x, h * topBR.y);
  ctx.lineTo(w * topBL.x, h * topBL.y);
  ctx.closePath();
  ctx.fill();

  // --- 4. INNER GLOW — eerie light emanating from center ---
  const glowGrad = ctx.createRadialGradient(
    w * 0.46, h * 0.50, 0,
    w * 0.46, h * 0.50, w * 0.30
  );
  glowGrad.addColorStop(0, `rgba(${innerGlow},0.40)`);
  glowGrad.addColorStop(0.4, `rgba(${innerGlow},0.18)`);
  glowGrad.addColorStop(0.7, `rgba(${innerGlow},0.06)`);
  glowGrad.addColorStop(1, `rgba(0,0,0,0)`);
  ctx.fillStyle = glowGrad;
  ctx.beginPath();
  ctx.moveTo(w * fTL.x, h * fTL.y);
  ctx.lineTo(w * fTR.x, h * fTR.y);
  ctx.lineTo(w * fBR.x, h * fBR.y);
  ctx.lineTo(w * fBL.x, h * fBL.y);
  ctx.closePath();
  ctx.fill();

  // --- 5. DISSOLVED CONTENTS (inside the cube) ---

  // 5a. SKULL — the brightest internal element, center-left
  const skullX = 0.40, skullY = 0.52;
  // Skull glow halo — BIG and bright, this is the focal point
  const skullGlow = ctx.createRadialGradient(
    w * skullX, h * skullY, 0,
    w * skullX, h * skullY, w * 0.12
  );
  skullGlow.addColorStop(0, `rgba(${boneColor},0.50)`);
  skullGlow.addColorStop(0.4, `rgba(${innerGlow},0.25)`);
  skullGlow.addColorStop(1, `rgba(0,0,0,0)`);
  ctx.fillStyle = skullGlow;
  fillCircle(ctx, w * skullX, h * skullY, w * 0.12);

  // Skull cranium
  ctx.fillStyle = `rgb(${boneColor})`;
  fillEllipse(ctx, w * skullX, h * (skullY - 0.02), w * 0.055, h * 0.05);

  // Skull face — darker below cranium
  ctx.fillStyle = `rgb(${boneDark})`;
  fillEllipse(ctx, w * skullX, h * (skullY + 0.03), w * 0.04, h * 0.035);

  // Eye sockets — dark voids
  ctx.fillStyle = 'rgb(5,15,12)';
  fillEllipse(ctx, w * (skullX - 0.018), h * (skullY - 0.005), w * 0.014, h * 0.012);
  fillEllipse(ctx, w * (skullX + 0.015), h * (skullY - 0.003), w * 0.012, h * 0.010);

  // Socket glow — eerie light from inside sockets — BRIGHT
  ctx.fillStyle = `rgba(${slimeGlow},0.7)`;
  fillCircle(ctx, w * (skullX - 0.018), h * (skullY - 0.005), w * 0.008);
  fillCircle(ctx, w * (skullX + 0.015), h * (skullY - 0.003), w * 0.006);
  // Specular dot in each socket
  ctx.fillStyle = 'rgba(180,255,220,0.9)';
  fillCircle(ctx, w * (skullX - 0.020), h * (skullY - 0.007), w * 0.003);
  fillCircle(ctx, w * (skullX + 0.013), h * (skullY - 0.005), w * 0.002);

  // Nasal cavity
  ctx.fillStyle = 'rgb(5,15,12)';
  fillEllipse(ctx, w * skullX, h * (skullY + 0.015), w * 0.008, h * 0.008);

  // Jaw / teeth
  ctx.fillStyle = `rgb(${boneColor})`;
  ctx.beginPath();
  ctx.moveTo(w * (skullX - 0.028), h * (skullY + 0.04));
  ctx.lineTo(w * (skullX + 0.025), h * (skullY + 0.038));
  ctx.lineTo(w * (skullX + 0.020), h * (skullY + 0.055));
  ctx.lineTo(w * (skullX - 0.022), h * (skullY + 0.055));
  ctx.closePath();
  ctx.fill();
  // Tooth line
  ctx.strokeStyle = `rgb(${boneDark})`;
  ctx.lineWidth = w * 0.003;
  ctx.beginPath();
  ctx.moveTo(w * (skullX - 0.025), h * (skullY + 0.042));
  ctx.lineTo(w * (skullX + 0.022), h * (skullY + 0.040));
  ctx.stroke();
  // Individual teeth marks
  for (let t = 0; t < 5; t++) {
    const tx = skullX - 0.020 + t * 0.009;
    ctx.beginPath();
    ctx.moveTo(w * tx, h * (skullY + 0.040));
    ctx.lineTo(w * tx, h * (skullY + 0.052));
    ctx.stroke();
  }

  // 5b. BONES — scattered, partially dissolved
  // Long bone (femur) — diagonal, upper right area
  ctx.strokeStyle = `rgb(${boneColor})`;
  ctx.lineWidth = w * 0.014;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(w * 0.52, h * 0.30);
  ctx.lineTo(w * 0.65, h * 0.46);
  ctx.stroke();
  // Bone knobs — larger
  ctx.fillStyle = `rgb(${boneColor})`;
  fillCircle(ctx, w * 0.52, h * 0.30, w * 0.016);
  fillCircle(ctx, w * 0.65, h * 0.46, w * 0.014);

  // Smaller bone fragment — lower left
  ctx.strokeStyle = `rgb(${boneDark})`;
  ctx.lineWidth = w * 0.010;
  ctx.beginPath();
  ctx.moveTo(w * 0.28, h * 0.68);
  ctx.lineTo(w * 0.40, h * 0.73);
  ctx.stroke();
  ctx.fillStyle = `rgb(${boneDark})`;
  fillCircle(ctx, w * 0.28, h * 0.68, w * 0.011);
  fillCircle(ctx, w * 0.40, h * 0.73, w * 0.009);

  // Rib fragment — curved, mid-right
  ctx.strokeStyle = `rgb(${boneColor})`;
  ctx.lineWidth = w * 0.007;
  ctx.beginPath();
  ctx.moveTo(w * 0.56, h * 0.60);
  ctx.quadraticCurveTo(w * 0.66, h * 0.55, w * 0.63, h * 0.48);
  ctx.stroke();

  // Another bone fragment — upper left, slightly dissolved
  ctx.strokeStyle = `rgb(${boneDark})`;
  ctx.lineWidth = w * 0.008;
  ctx.beginPath();
  ctx.moveTo(w * 0.26, h * 0.36);
  ctx.lineTo(w * 0.32, h * 0.42);
  ctx.stroke();
  fillCircle(ctx, w * 0.26, h * 0.36, w * 0.008);
  fillCircle(ctx, w * 0.32, h * 0.42, w * 0.007);

  // 5c. DAGGER — bright metallic, embedded diagonally, WIDER for ASCII readability
  const dagX = 0.60, dagY = 0.36;
  // Blade — wider, more visible
  ctx.fillStyle = `rgb(${metalBright})`;
  ctx.beginPath();
  ctx.moveTo(w * (dagX - 0.004), h * dagY);
  ctx.lineTo(w * (dagX + 0.004), h * (dagY - 0.10));
  ctx.lineTo(w * (dagX + 0.022), h * (dagY - 0.09));
  ctx.lineTo(w * (dagX + 0.018), h * dagY);
  ctx.closePath();
  ctx.fill();
  // Blade edge highlight — bright line down center
  ctx.strokeStyle = 'rgb(240,245,255)';
  ctx.lineWidth = w * 0.003;
  ctx.beginPath();
  ctx.moveTo(w * (dagX + 0.004), h * (dagY - 0.005));
  ctx.lineTo(w * (dagX + 0.010), h * (dagY - 0.09));
  ctx.stroke();
  // Guard — wider
  ctx.fillStyle = `rgb(${metalDark})`;
  ctx.fillRect(w * (dagX - 0.012), h * dagY, w * 0.040, h * 0.012);
  // Handle
  ctx.fillStyle = 'rgb(55,30,15)';
  ctx.fillRect(w * (dagX + 0.002), h * (dagY + 0.012), w * 0.012, h * 0.040);
  // Pommel
  ctx.fillStyle = `rgb(${metalDark})`;
  fillCircle(ctx, w * (dagX + 0.008), h * (dagY + 0.058), w * 0.009);

  // 5d. DISSOLVED HAND — reaching out, lower right
  const handX = 0.62, handY = 0.68;
  // Palm
  ctx.fillStyle = `rgb(${boneDark})`;
  fillEllipse(ctx, w * handX, h * handY, w * 0.022, h * 0.018);
  // Fingers — splayed, reaching
  ctx.strokeStyle = `rgb(${boneColor})`;
  ctx.lineWidth = w * 0.005;
  ctx.lineCap = 'round';
  for (let f = 0; f < 4; f++) {
    const angle = -0.4 + f * 0.25;
    const fx = handX + Math.cos(angle) * 0.04;
    const fy = handY + Math.sin(angle) * 0.035 - 0.02;
    ctx.beginPath();
    ctx.moveTo(w * handX, h * (handY - 0.01));
    ctx.lineTo(w * fx, h * fy);
    ctx.stroke();
  }
  // Thumb
  ctx.beginPath();
  ctx.moveTo(w * (handX + 0.015), h * handY);
  ctx.lineTo(w * (handX + 0.035), h * (handY + 0.02));
  ctx.stroke();

  // --- 6. TRANSLUCENCY STREAKS — internal currents ---
  ctx.lineCap = 'round';
  // Vertical streaks suggesting internal flow — thicker, more visible
  for (let s = 0; s < 6; s++) {
    const sx = 0.22 + s * 0.10;
    ctx.globalAlpha = 0.10 + (s % 2) * 0.08;
    ctx.strokeStyle = s % 2 === 0 ? `rgb(${bodyBright})` : `rgb(${innerGlow})`;
    ctx.lineWidth = w * (0.006 + (s % 3) * 0.004);
    ctx.beginPath();
    ctx.moveTo(w * sx, h * 0.22);
    ctx.bezierCurveTo(
      w * (sx - 0.03), h * 0.38,
      w * (sx + 0.04), h * 0.58,
      w * (sx - 0.02), h * 0.80
    );
    ctx.stroke();
  }
  ctx.globalAlpha = 1.0;

  // Internal bubble/murk patches — suggest depth and transparency
  ctx.globalAlpha = 0.15;
  ctx.fillStyle = `rgb(${innerGlow})`;
  fillEllipse(ctx, w * 0.34, h * 0.35, w * 0.04, h * 0.03);
  fillEllipse(ctx, w * 0.58, h * 0.72, w * 0.035, h * 0.025);
  fillEllipse(ctx, w * 0.68, h * 0.35, w * 0.025, h * 0.02);
  ctx.globalAlpha = 1.0;

  // --- 7. EDGE HIGHLIGHTS — bright edges define the cube shape ---
  // Double-stroke edges: outer glow + inner bright line

  // Left edge (brightest — light hits here) — organic curve
  ctx.strokeStyle = `rgba(${slimeGlow},0.3)`;
  ctx.lineWidth = w * 0.014;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(w * fTL.x, h * fTL.y);
  ctx.bezierCurveTo(w * (fTL.x - 0.015), h * 0.35, w * (fBL.x - 0.02), h * 0.60, w * fBL.x, h * fBL.y);
  ctx.stroke();
  ctx.strokeStyle = `rgb(${slimeGlow})`;
  ctx.lineWidth = w * 0.006;
  ctx.beginPath();
  ctx.moveTo(w * fTL.x, h * fTL.y);
  ctx.bezierCurveTo(w * (fTL.x - 0.015), h * 0.35, w * (fBL.x - 0.02), h * 0.60, w * fBL.x, h * fBL.y);
  ctx.stroke();

  // Top edge — slight upward bulge
  ctx.strokeStyle = `rgba(${slimeGlow},0.2)`;
  ctx.lineWidth = w * 0.012;
  ctx.beginPath();
  ctx.moveTo(w * fTL.x, h * fTL.y);
  ctx.bezierCurveTo(w * 0.35, h * (fTL.y - 0.015), w * 0.60, h * (fTR.y - 0.01), w * fTR.x, h * fTR.y);
  ctx.stroke();
  ctx.strokeStyle = `rgb(${bodyBright})`;
  ctx.lineWidth = w * 0.005;
  ctx.beginPath();
  ctx.moveTo(w * fTL.x, h * fTL.y);
  ctx.bezierCurveTo(w * 0.35, h * (fTL.y - 0.015), w * 0.60, h * (fTR.y - 0.01), w * fTR.x, h * fTR.y);
  ctx.stroke();

  // Right edge (dimmer) — organic curve
  ctx.strokeStyle = `rgba(${bodyLight},0.4)`;
  ctx.lineWidth = w * 0.010;
  ctx.beginPath();
  ctx.moveTo(w * fTR.x, h * fTR.y);
  ctx.bezierCurveTo(w * (fTR.x + 0.015), h * 0.40, w * (fBR.x + 0.02), h * 0.65, w * fBR.x, h * fBR.y);
  ctx.stroke();
  ctx.strokeStyle = `rgba(${bodyBright},0.7)`;
  ctx.lineWidth = w * 0.004;
  ctx.beginPath();
  ctx.moveTo(w * fTR.x, h * fTR.y);
  ctx.bezierCurveTo(w * (fTR.x + 0.015), h * 0.40, w * (fBR.x + 0.02), h * 0.65, w * fBR.x, h * fBR.y);
  ctx.stroke();

  // Bottom edge — sagging, melting
  ctx.strokeStyle = `rgba(${bodyLight},0.3)`;
  ctx.lineWidth = w * 0.008;
  ctx.beginPath();
  ctx.moveTo(w * fBL.x, h * fBL.y);
  ctx.bezierCurveTo(w * 0.38, h * (fBL.y + 0.04), w * 0.60, h * (fBR.y + 0.03), w * fBR.x, h * fBR.y);
  ctx.stroke();
  ctx.strokeStyle = `rgba(${bodyBright},0.5)`;
  ctx.lineWidth = w * 0.003;
  ctx.beginPath();
  ctx.moveTo(w * fBL.x, h * fBL.y);
  ctx.bezierCurveTo(w * 0.38, h * (fBL.y + 0.04), w * 0.60, h * (fBR.y + 0.03), w * fBR.x, h * fBR.y);
  ctx.stroke();

  // --- 8. DRIPPING SLIME — from top edges ---
  ctx.fillStyle = `rgb(${slimeGlow})`;
  // Drip 1 — left side, long
  drawDrip(ctx, w * 0.22, h * 0.23, w * 0.006, h * 0.12);
  // Drip 2 — center-left
  drawDrip(ctx, w * 0.38, h * 0.22, w * 0.005, h * 0.08);
  // Drip 3 — center
  drawDrip(ctx, w * 0.52, h * 0.24, w * 0.007, h * 0.14);
  // Drip 4 — right side
  ctx.fillStyle = `rgb(${bodyBright})`;
  drawDrip(ctx, w * 0.70, h * 0.26, w * 0.005, h * 0.06);

  // Drip droplets at tips
  ctx.fillStyle = `rgb(${slimeGlow})`;
  fillCircle(ctx, w * 0.22, h * 0.36, w * 0.008);
  fillCircle(ctx, w * 0.52, h * 0.39, w * 0.009);
  fillCircle(ctx, w * 0.38, h * 0.31, w * 0.006);

  // --- 9. TOP SURFACE DRIPS ---
  // Slime running over the top face
  ctx.fillStyle = `rgba(${slimeGlow},0.35)`;
  fillEllipse(ctx, w * 0.32, h * 0.20, w * 0.06, h * 0.012);
  fillEllipse(ctx, w * 0.55, h * 0.23, w * 0.04, h * 0.008);
  fillEllipse(ctx, w * 0.74, h * 0.25, w * 0.03, h * 0.006);

  // --- 10. SURFACE REFLECTIONS — specular highlights on the front face ---
  // Large soft highlight upper-left (main light source)
  const reflGrad = ctx.createRadialGradient(
    w * 0.28, h * 0.34, 0,
    w * 0.28, h * 0.34, w * 0.10
  );
  reflGrad.addColorStop(0, `rgba(${slimeGlow},0.25)`);
  reflGrad.addColorStop(0.5, `rgba(${slimeGlow},0.08)`);
  reflGrad.addColorStop(1, `rgba(0,0,0,0)`);
  ctx.fillStyle = reflGrad;
  fillEllipse(ctx, w * 0.28, h * 0.34, w * 0.08, h * 0.05);

  // Smaller specular dot
  ctx.fillStyle = `rgba(180,255,220,0.20)`;
  fillCircle(ctx, w * 0.26, h * 0.31, w * 0.012);

  // --- 10b. MELTING BASE — ooze spreading at ground ---
  // Ooze tongue extending forward-left
  ctx.fillStyle = `rgb(${bodyMid})`;
  ctx.beginPath();
  ctx.moveTo(w * fBL.x, h * fBL.y);
  ctx.bezierCurveTo(w * 0.14, h * 0.86, w * 0.10, h * 0.88, w * 0.08, h * 0.90);
  ctx.bezierCurveTo(w * 0.10, h * 0.92, w * 0.16, h * 0.88, w * (fBL.x + 0.04), h * (fBL.y + 0.02));
  ctx.closePath();
  ctx.fill();
  // Ooze tongue right side
  ctx.fillStyle = `rgba(${bodyDark},0.8)`;
  ctx.beginPath();
  ctx.moveTo(w * fBR.x, h * fBR.y);
  ctx.bezierCurveTo(w * 0.82, h * 0.84, w * 0.84, h * 0.86, w * 0.86, h * 0.88);
  ctx.bezierCurveTo(w * 0.84, h * 0.90, w * 0.80, h * 0.86, w * (fBR.x - 0.02), h * (fBR.y + 0.02));
  ctx.closePath();
  ctx.fill();

  // --- 11. CORNER AMBIENT OCCLUSION ---
  // Dark corners where cube meets ground
  ambientOcclusion(ctx, w * fBL.x, h * fBL.y, w * 0.06, h * 0.04, 0.4);
  ambientOcclusion(ctx, w * fBR.x, h * fBR.y, w * 0.06, h * 0.04, 0.3);

  // Inner corners darkness
  ambientOcclusion(ctx, w * fTL.x, h * fTL.y, w * 0.04, h * 0.04, 0.2);
  ambientOcclusion(ctx, w * fTR.x, h * fTR.y, w * 0.04, h * 0.04, 0.15);
}

// Helper: draw a tapered drip
function drawDrip(ctx, x, y, width, height) {
  ctx.beginPath();
  ctx.moveTo(x - width, y);
  ctx.bezierCurveTo(
    x - width * 0.8, y + height * 0.4,
    x - width * 0.3, y + height * 0.8,
    x, y + height
  );
  ctx.bezierCurveTo(
    x + width * 0.3, y + height * 0.8,
    x + width * 0.8, y + height * 0.4,
    x + width, y
  );
  ctx.closePath();
  ctx.fill();
}

// ==========================================================================
// Harness
// ==========================================================================
const GRID_W = 7;
const GRID_H = 7;

function render(elapsed = 0) {
  const size = parseInt(document.getElementById('canvas-size').value);
  const cellSize = parseInt(document.getElementById('cell-size').value);
  const showGrid = document.getElementById('show-grid').checked;
  const sk = gelatinousOozeSkeleton;

  const canvasW = size;
  const canvasH = Math.round(size * GRID_H / GRID_W);
  const maxDisplay = 420;
  const displayW = `${Math.min(canvasW, maxDisplay)}px`;
  const displayH = `${Math.min(canvasH, Math.round(maxDisplay * GRID_H / GRID_W))}px`;

  const asciiOpts = { elapsed, cellSize, level: 7, gridWidth: GRID_W, gridHeight: GRID_H };

  // -- Skeleton view (just shows the cube outline for this creature) --
  const c1 = document.getElementById('skel-raw');
  c1.width = canvasW; c1.height = canvasH;
  c1.style.width = displayW; c1.style.height = displayH;
  const ctx1 = c1.getContext('2d');
  ctx1.fillStyle = '#000'; ctx1.fillRect(0, 0, canvasW, canvasH);
  // Simple cube outline for debug
  ctx1.strokeStyle = 'rgb(30,80,60)';
  ctx1.lineWidth = 2;
  ctx1.strokeRect(canvasW * 0.14, canvasH * 0.23, canvasW * 0.68, canvasH * 0.58);
  ctx1.fillStyle = 'rgb(10,30,25)';
  ctx1.font = '11px monospace';
  ctx1.fillText('No skeleton — amorphous', canvasW * 0.25, canvasH * 0.52);

  // -- ASCII --
  const c2 = document.getElementById('next-ascii');
  c2.width = canvasW; c2.height = canvasH;
  c2.style.width = displayW; c2.style.height = displayH;
  const ctx2 = c2.getContext('2d');
  ctx2.fillStyle = '#000'; ctx2.fillRect(0, 0, canvasW, canvasH);
  renderAscii(ctx2, (tctx, tw, th) => {
    drawGelatinousOozeClean(tctx, sk, tw, th);
  }, 0, 0, canvasW, canvasH, asciiOpts);

  // -- Painted --
  const c3 = document.getElementById('next-raw');
  c3.width = canvasW; c3.height = canvasH;
  c3.style.width = displayW; c3.style.height = displayH;
  const ctx3 = c3.getContext('2d');
  ctx3.fillStyle = '#000'; ctx3.fillRect(0, 0, canvasW, canvasH);
  drawGelatinousOozeClean(ctx3, sk, canvasW, canvasH);

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
