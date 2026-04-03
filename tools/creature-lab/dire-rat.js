import {
  setSeed, rand, randRange,
  fillEllipse, fillCircle, organicEllipse,
  bodyGrad, bodyGradHueShift,
  furTexture, furTextureDirectional,
  ambientOcclusion, highlight, drawLimb, drawOrganicLimb,
  sssEdgeGlow,
} from './helpers.js';
import { renderAscii } from './ascii-renderer.js';
import {
  drawCreatureFromSkeleton, drawDetailedCreature, drawCleanCreature, drawDebugSkeleton, direRatSkeleton,
} from './skeleton.js';

// ==========================================================================
// CURRENT Dire Rat — exact port from monsterTemplates.ts (side profile)
// ==========================================================================
function drawCurrentDireRat(ctx, w, h) {
  ctx.fillStyle = bodyGradHueShift(ctx, w * 0.48, h * 0.46, w * 0.28, 150, 124, 88, 70, 56, 40, 188, 162, 122);
  ctx.beginPath();
  ctx.moveTo(w * 0.24, h * 0.33);
  ctx.bezierCurveTo(w * 0.34, h * 0.22, w * 0.56, h * 0.21, w * 0.70, h * 0.32);
  ctx.bezierCurveTo(w * 0.77, h * 0.38, w * 0.78, h * 0.57, w * 0.69, h * 0.65);
  ctx.bezierCurveTo(w * 0.58, h * 0.73, w * 0.38, h * 0.74, w * 0.24, h * 0.67);
  ctx.bezierCurveTo(w * 0.18, h * 0.60, w * 0.17, h * 0.40, w * 0.24, h * 0.33);
  ctx.fill();
  ctx.fillStyle = bodyGrad(ctx, w * 0.66, h * 0.46, w * 0.16, 132, 106, 72, 102, 82, 56);
  fillEllipse(ctx, w * 0.66, h * 0.47, w * 0.16, h * 0.18);
  ctx.fillStyle = bodyGrad(ctx, w * 0.38, h * 0.54, w * 0.16, 128, 108, 82, 98, 82, 60);
  fillEllipse(ctx, w * 0.42, h * 0.60, w * 0.18, h * 0.08);
  ambientOcclusion(ctx, w * 0.28, h * 0.47, w * 0.05, h * 0.07, 0.24);
  ambientOcclusion(ctx, w * 0.53, h * 0.48, w * 0.05, h * 0.06, 0.18);
  ambientOcclusion(ctx, w * 0.40, h * 0.62, w * 0.12, h * 0.04, 0.18);
  ctx.strokeStyle = 'rgba(85,62,42,0.55)';
  ctx.lineWidth = w * 0.010;
  ctx.beginPath();
  ctx.moveTo(w * 0.28, h * 0.35);
  ctx.quadraticCurveTo(w * 0.48, h * 0.28, w * 0.69, h * 0.36);
  ctx.moveTo(w * 0.30, h * 0.43);
  ctx.quadraticCurveTo(w * 0.48, h * 0.36, w * 0.66, h * 0.42);
  ctx.moveTo(w * 0.32, h * 0.53);
  ctx.quadraticCurveTo(w * 0.48, h * 0.50, w * 0.62, h * 0.55);
  ctx.stroke();
  furTexture(ctx, w * 0.22, h * 0.24, w * 0.52, h * 0.28, w * 0.022, 'rgb(74,56,36)', 'rgb(175,145,108)', 95, -0.2);
  furTexture(ctx, w * 0.22, h * 0.46, w * 0.46, h * 0.18, w * 0.017, 'rgb(92,72,48)', 'rgb(185,160,122)', 55, 0.5);
  furTexture(ctx, w * 0.53, h * 0.28, w * 0.20, h * 0.26, w * 0.019, 'rgb(68,52,34)', 'rgb(154,126,92)', 42, 0.15);
  highlight(ctx, w * 0.42, h * 0.34, w * 0.05, 'rgb(200,172,132)', 0.10);
  highlight(ctx, w * 0.58, h * 0.44, w * 0.04, 'rgb(182,154,116)', 0.10);
  // Head
  ctx.fillStyle = bodyGradHueShift(ctx, w * 0.17, h * 0.43, w * 0.14, 148, 120, 88, 66, 50, 38, 186, 156, 122);
  ctx.beginPath();
  ctx.moveTo(w * 0.26, h * 0.33);
  ctx.bezierCurveTo(w * 0.20, h * 0.27, w * 0.10, h * 0.30, w * 0.05, h * 0.38);
  ctx.bezierCurveTo(w * 0.02, h * 0.44, w * 0.03, h * 0.52, w * 0.10, h * 0.56);
  ctx.bezierCurveTo(w * 0.17, h * 0.58, w * 0.24, h * 0.54, w * 0.28, h * 0.48);
  ctx.bezierCurveTo(w * 0.31, h * 0.40, w * 0.30, h * 0.35, w * 0.26, h * 0.33);
  ctx.fill();
  furTexture(ctx, w * 0.05, h * 0.31, w * 0.21, h * 0.24, w * 0.014, 'rgb(66,48,30)', 'rgb(156,126,90)', 36, 0.0);
  ctx.fillStyle = 'rgb(118,92,72)';
  ctx.beginPath();
  ctx.moveTo(w * 0.08, h * 0.41);
  ctx.bezierCurveTo(w * 0.02, h * 0.40, w * -0.03, h * 0.42, w * -0.04, h * 0.45);
  ctx.bezierCurveTo(w * -0.03, h * 0.49, w * 0.01, h * 0.51, w * 0.08, h * 0.50);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgb(176,128,120)';
  fillCircle(ctx, w * -0.005, h * 0.455, w * 0.014);
  ctx.save();
  ctx.globalAlpha = 0.16;
  ctx.fillStyle = 'rgb(165,60,44)';
  fillCircle(ctx, w * 0.145, h * 0.405, w * 0.020);
  ctx.restore();
  ctx.fillStyle = 'rgb(142,44,32)';
  fillCircle(ctx, w * 0.145, h * 0.405, w * 0.013);
  ctx.fillStyle = '#000';
  fillCircle(ctx, w * 0.149, h * 0.406, w * 0.005);
  ctx.fillStyle = 'rgb(240,210,200)';
  fillCircle(ctx, w * 0.140, h * 0.399, w * 0.003);
  // Ears
  ctx.fillStyle = 'rgb(120,95,72)';
  ctx.beginPath();
  ctx.moveTo(w * 0.18, h * 0.31);
  ctx.bezierCurveTo(w * 0.15, h * 0.18, w * 0.17, h * 0.12, w * 0.21, h * 0.11);
  ctx.bezierCurveTo(w * 0.24, h * 0.14, w * 0.24, h * 0.22, w * 0.22, h * 0.29);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(w * 0.24, h * 0.30);
  ctx.bezierCurveTo(w * 0.22, h * 0.18, w * 0.25, h * 0.11, w * 0.28, h * 0.10);
  ctx.bezierCurveTo(w * 0.31, h * 0.14, w * 0.31, h * 0.22, w * 0.28, h * 0.30);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgb(162,118,110)';
  ctx.beginPath();
  ctx.moveTo(w * 0.19, h * 0.28);
  ctx.bezierCurveTo(w * 0.17, h * 0.22, w * 0.18, h * 0.16, w * 0.20, h * 0.15);
  ctx.bezierCurveTo(w * 0.22, h * 0.18, w * 0.22, h * 0.23, w * 0.21, h * 0.28);
  ctx.closePath();
  ctx.fill();
  // Teeth
  ctx.fillStyle = 'rgb(214,206,182)';
  ctx.beginPath(); ctx.moveTo(w * 0.04, h * 0.47); ctx.lineTo(w * 0.02, h * 0.52); ctx.lineTo(w * 0.05, h * 0.48); ctx.fill();
  ctx.beginPath(); ctx.moveTo(w * 0.07, h * 0.47); ctx.lineTo(w * 0.06, h * 0.52); ctx.lineTo(w * 0.08, h * 0.48); ctx.fill();
  // Tail
  ctx.strokeStyle = 'rgb(152,116,98)'; ctx.lineCap = 'round'; ctx.lineWidth = w * 0.030;
  ctx.beginPath(); ctx.moveTo(w * 0.76, h * 0.45); ctx.bezierCurveTo(w * 0.83, h * 0.35, w * 0.92, h * 0.24, w * 1.00, h * 0.10); ctx.stroke();
  ctx.strokeStyle = 'rgba(98,70,56,0.45)'; ctx.lineWidth = w * 0.008;
  ctx.beginPath(); ctx.moveTo(w * 0.80, h * 0.42); ctx.bezierCurveTo(w * 0.88, h * 0.33, w * 0.95, h * 0.23, w * 0.99, h * 0.15); ctx.stroke();
  // Legs
  drawLimb(ctx, w * 0.31, h * 0.62, w * 0.29, h * 0.72, w * 0.26, h * 0.82, w * 0.020, 'rgb(108,82,56)');
  drawLimb(ctx, w * 0.40, h * 0.63, w * 0.39, h * 0.73, w * 0.37, h * 0.83, w * 0.019, 'rgb(102,78,54)');
  drawLimb(ctx, w * 0.58, h * 0.61, w * 0.56, h * 0.73, w * 0.53, h * 0.84, w * 0.023, 'rgb(108,82,56)');
  drawLimb(ctx, w * 0.66, h * 0.60, w * 0.64, h * 0.72, w * 0.62, h * 0.83, w * 0.021, 'rgb(100,76,52)');
  ctx.fillStyle = 'rgb(200,192,172)';
  for (const lx of [0.26, 0.37, 0.53, 0.62]) {
    const ly = lx < 0.45 ? 0.83 : 0.84;
    for (let c = 0; c < 3; c++) {
      ctx.beginPath(); ctx.moveTo(w * (lx + c * 0.012 - 0.012), h * ly);
      ctx.lineTo(w * (lx + c * 0.012 - 0.018), h * (ly + 0.045));
      ctx.lineTo(w * (lx + c * 0.012 - 0.005), h * (ly + 0.03)); ctx.fill();
    }
  }
  // Whiskers
  ctx.strokeStyle = 'rgba(138,116,84,0.75)'; ctx.lineWidth = w * 0.004;
  ctx.beginPath();
  ctx.moveTo(w * 0.05, h * 0.43); ctx.lineTo(w * -0.02, h * 0.39);
  ctx.moveTo(w * 0.05, h * 0.45); ctx.lineTo(w * -0.03, h * 0.45);
  ctx.moveTo(w * 0.05, h * 0.47); ctx.lineTo(w * -0.02, h * 0.52);
  ctx.stroke();
}


// ==========================================================================
// NEW Dire Rat — 3/4 view, facing player, aggressive crouch
// HIGH CONTRAST: near-black fur, glowing accents (eyes, teeth, ears)
// Designed to survive ASCII conversion — contrast > color, silhouette > detail
// ==========================================================================
function drawNewDireRat(ctx, w, h) {
  // Shift everything right so snout/nose/whiskers don't clip left edge
  ctx.save();
  ctx.translate(w * 0.06, 0);

  // COLOR PALETTE — dark creature with hot accents
  // Fur: near-black with subtle warm undertone
  const furDark = [28, 20, 16];
  const furMid = [52, 38, 28];
  const furLight = [82, 62, 44];    // highlight peaks only
  const furShadow = [14, 10, 8];
  // Skin (snout, paws, tail): dark reddish-brown
  const skinDark = [48, 28, 24];
  const skinMid = [72, 42, 36];
  const skinLight = [95, 58, 48];
  // Accents — these need to POP in ASCII
  const eyeGlow = [220, 60, 30];     // hot red-orange
  const eyeCore = [255, 120, 40];    // burning center
  const teethColor = [240, 230, 210]; // near white
  const earPink = [160, 70, 80];      // warm pink interior
  const noseWet = [140, 70, 65];      // wet shine

  // -- TAIL -- S-curve, arcs up then curls toward the viewer
  ctx.strokeStyle = `rgb(${skinDark.join(',')})`;
  ctx.lineCap = 'round'; ctx.lineWidth = w * 0.018;
  ctx.beginPath();
  ctx.moveTo(w * 0.78, h * 0.44);
  // Rise up over the haunches
  ctx.bezierCurveTo(w * 0.84, h * 0.30, w * 0.90, h * 0.22, w * 0.92, h * 0.28);
  ctx.stroke();
  // Thinner mid-section curving toward viewer (down and right)
  ctx.strokeStyle = `rgb(${skinMid.join(',')})`;
  ctx.lineWidth = w * 0.012;
  ctx.beginPath();
  ctx.moveTo(w * 0.92, h * 0.28);
  ctx.bezierCurveTo(w * 0.95, h * 0.36, w * 0.96, h * 0.48, w * 0.93, h * 0.58);
  ctx.stroke();
  // Thin tip curling forward
  ctx.strokeStyle = `rgb(${skinMid.join(',')})`;
  ctx.lineWidth = w * 0.006;
  ctx.beginPath();
  ctx.moveTo(w * 0.93, h * 0.58);
  ctx.bezierCurveTo(w * 0.90, h * 0.66, w * 0.86, h * 0.70, w * 0.84, h * 0.68);
  ctx.stroke();
  // Tail highlight — top edge catches light
  ctx.strokeStyle = `rgba(${skinLight.join(',')},0.22)`;
  ctx.lineWidth = w * 0.004;
  ctx.beginPath();
  ctx.moveTo(w * 0.80, h * 0.42);
  ctx.bezierCurveTo(w * 0.85, h * 0.28, w * 0.90, h * 0.21, w * 0.92, h * 0.26);
  ctx.stroke();

  // -- REAR HAUNCHES -- thick, muscular, integrated into body
  // Near haunch — visible bulge merging with body
  ctx.fillStyle = bodyGradHueShift(ctx, w * 0.62, h * 0.50, w * 0.10,
    furMid[0], furMid[1], furMid[2],
    furShadow[0], furShadow[1], furShadow[2],
    furLight[0], furLight[1], furLight[2]
  );
  ctx.beginPath();
  ctx.moveTo(w * 0.56, h * 0.48);
  ctx.bezierCurveTo(w * 0.58, h * 0.42, w * 0.68, h * 0.40, w * 0.72, h * 0.46);
  ctx.bezierCurveTo(w * 0.74, h * 0.54, w * 0.70, h * 0.68, w * 0.62, h * 0.72);
  ctx.bezierCurveTo(w * 0.56, h * 0.70, w * 0.54, h * 0.56, w * 0.56, h * 0.48);
  ctx.fill();
  // Haunch AO — crease where haunch meets belly
  ambientOcclusion(ctx, w * 0.60, h * 0.62, w * 0.06, h * 0.04, 0.30);
  // Haunch highlight — top catches light
  highlight(ctx, w * 0.64, h * 0.46, w * 0.04, `rgb(${furLight.join(',')})`, 0.10);

  // Far haunch — darker, partially hidden behind body
  ctx.fillStyle = `rgb(${furShadow.join(',')})`;
  ctx.beginPath();
  ctx.moveTo(w * 0.62, h * 0.50);
  ctx.bezierCurveTo(w * 0.64, h * 0.44, w * 0.72, h * 0.44, w * 0.74, h * 0.50);
  ctx.bezierCurveTo(w * 0.75, h * 0.58, w * 0.72, h * 0.68, w * 0.66, h * 0.70);
  ctx.bezierCurveTo(w * 0.62, h * 0.66, w * 0.60, h * 0.56, w * 0.62, h * 0.50);
  ctx.fill();

  // Thin lower rear legs — only below the knee joint
  // Far rear lower leg
  drawOrganicLimb(ctx, w * 0.66, h * 0.68, w * 0.70, h * 0.76, w * 0.67, h * 0.84, w * 0.008, `rgb(${furShadow.join(',')})`, 1.0);
  // Near rear lower leg
  drawOrganicLimb(ctx, w * 0.60, h * 0.70, w * 0.63, h * 0.78, w * 0.58, h * 0.84, w * 0.010, `rgb(${furDark.join(',')})`, 2.0);

  // -- BODY -- elongated, low crouch, angled forward
  // Main body mass — longer, flatter
  ctx.fillStyle = bodyGradHueShift(ctx, w * 0.44, h * 0.42, w * 0.30,
    furMid[0], furMid[1], furMid[2],
    furShadow[0], furShadow[1], furShadow[2],
    furLight[0], furLight[1], furLight[2]
  );
  ctx.beginPath();
  ctx.moveTo(w * 0.26, h * 0.40);
  // Spine — long arc, higher at haunches
  ctx.bezierCurveTo(w * 0.34, h * 0.28, w * 0.54, h * 0.24, w * 0.68, h * 0.28);
  // Haunch — rises up
  ctx.bezierCurveTo(w * 0.78, h * 0.32, w * 0.80, h * 0.46, w * 0.76, h * 0.56);
  // Belly — long underline
  ctx.bezierCurveTo(w * 0.68, h * 0.64, w * 0.48, h * 0.66, w * 0.32, h * 0.62);
  // Chest — tucked
  ctx.bezierCurveTo(w * 0.24, h * 0.56, w * 0.22, h * 0.48, w * 0.26, h * 0.40);
  ctx.fill();

  // Haunch bulge — muscular rear
  ctx.fillStyle = bodyGradHueShift(ctx, w * 0.68, h * 0.40, w * 0.12,
    furMid[0], furMid[1], furMid[2],
    furShadow[0], furShadow[1], furShadow[2],
    furLight[0], furLight[1], furLight[2]
  );
  fillEllipse(ctx, w * 0.68, h * 0.42, w * 0.10, h * 0.14);

  // Shoulder hump — subtle highlight
  highlight(ctx, w * 0.40, h * 0.30, w * 0.05, `rgb(${furLight.join(',')})`, 0.12);

  // Side lighting — directional
  ctx.save();
  ctx.globalCompositeOperation = 'overlay'; ctx.globalAlpha = 0.12;
  const sideGrad = ctx.createLinearGradient(w * 0.10, h * 0.15, w * 0.85, h * 0.75);
  sideGrad.addColorStop(0, 'rgb(140,120,90)');
  sideGrad.addColorStop(0.35, 'rgba(60,50,40,0)');
  sideGrad.addColorStop(1, 'rgb(5,3,2)');
  ctx.fillStyle = sideGrad;
  ctx.fillRect(w * 0.10, h * 0.15, w * 0.75, h * 0.65);
  ctx.restore();

  // Deep AO under belly and at joints
  ambientOcclusion(ctx, w * 0.46, h * 0.62, w * 0.16, h * 0.04, 0.35);
  ambientOcclusion(ctx, w * 0.30, h * 0.50, w * 0.05, h * 0.06, 0.30);
  ambientOcclusion(ctx, w * 0.68, h * 0.50, w * 0.06, h * 0.06, 0.28);

  // -- FUR -- dark strokes, following the longer body
  // Spine fur — runs the length
  furTextureDirectional(ctx, w * 0.28, h * 0.24, w * 0.46, h * 0.18, w * 0.022,
    `rgb(${furShadow.join(',')})`, `rgb(${furLight.join(',')})`, 60,
    (fx, fy) => { const t = (fx - w * 0.28) / (w * 0.46); return -0.5 + t * 0.4; }
  );
  // Belly fur
  furTextureDirectional(ctx, w * 0.32, h * 0.52, w * 0.34, h * 0.12, w * 0.014,
    `rgb(${furShadow.join(',')})`, `rgb(${furMid.join(',')})`, 35, () => 0.6
  );
  // Haunch fur — radiating
  furTextureDirectional(ctx, w * 0.58, h * 0.30, w * 0.20, h * 0.24, w * 0.018,
    `rgb(${furShadow.join(',')})`, `rgb(${furMid.join(',')})`, 40,
    (fx, fy) => Math.atan2(fy - h * 0.42, fx - w * 0.68) + 0.3
  );

  // SSS warm edge
  sssEdgeGlow(ctx, w * 0.44, h * 0.46, w * 0.28, h * 0.20, 0.08);

  // -- FRONT SHOULDERS -- integrated into chest, then thin lower legs
  // Near shoulder mass — blends with chest
  ctx.fillStyle = bodyGradHueShift(ctx, w * 0.28, h * 0.52, w * 0.08,
    furMid[0], furMid[1], furMid[2],
    furShadow[0], furShadow[1], furShadow[2],
    furLight[0], furLight[1], furLight[2]
  );
  ctx.beginPath();
  ctx.moveTo(w * 0.24, h * 0.46);
  ctx.bezierCurveTo(w * 0.22, h * 0.50, w * 0.22, h * 0.60, w * 0.24, h * 0.66);
  ctx.bezierCurveTo(w * 0.28, h * 0.68, w * 0.32, h * 0.64, w * 0.32, h * 0.58);
  ctx.bezierCurveTo(w * 0.32, h * 0.52, w * 0.30, h * 0.46, w * 0.24, h * 0.46);
  ctx.fill();
  // Shoulder AO
  ambientOcclusion(ctx, w * 0.26, h * 0.60, w * 0.04, h * 0.04, 0.25);

  // Far shoulder — darker, behind
  ctx.fillStyle = `rgb(${furShadow.join(',')})`;
  ctx.beginPath();
  ctx.moveTo(w * 0.30, h * 0.48);
  ctx.bezierCurveTo(w * 0.28, h * 0.52, w * 0.28, h * 0.62, w * 0.30, h * 0.66);
  ctx.bezierCurveTo(w * 0.34, h * 0.67, w * 0.36, h * 0.62, w * 0.36, h * 0.56);
  ctx.bezierCurveTo(w * 0.36, h * 0.50, w * 0.34, h * 0.48, w * 0.30, h * 0.48);
  ctx.fill();

  // Thin lower front legs — below the elbow
  // Far front lower leg
  drawOrganicLimb(ctx, w * 0.32, h * 0.64, w * 0.30, h * 0.74, w * 0.32, h * 0.84, w * 0.007, `rgb(${furShadow.join(',')})`, 3.0);
  // Near front lower leg — reaching forward
  drawOrganicLimb(ctx, w * 0.24, h * 0.64, w * 0.20, h * 0.74, w * 0.20, h * 0.84, w * 0.009, `rgb(${furDark.join(',')})`, 4.0);

  // -- PAWS + CLAWS -- spread wider for active stance
  for (const [px, py, size, alpha] of [[0.20, 0.84, 0.022, 1.0], [0.32, 0.84, 0.016, 0.8], [0.58, 0.84, 0.020, 1.0], [0.66, 0.84, 0.015, 0.75]]) {
    ctx.globalAlpha = alpha;
    ctx.fillStyle = `rgb(${skinDark.join(',')})`;
    organicEllipse(ctx, w * px, h * py, w * size, h * 0.013, px * 100, 0.1);
    ctx.fill();
    // Bright claw tips
    ctx.fillStyle = 'rgb(200,190,170)';
    for (let c = -1; c <= 1; c++) {
      const clawX = w * px + c * w * 0.009;
      ctx.beginPath();
      ctx.moveTo(clawX, h * py + h * 0.005);
      ctx.quadraticCurveTo(clawX - w * 0.006, h * py + h * 0.038, clawX - w * 0.002, h * py + h * 0.042);
      ctx.quadraticCurveTo(clawX + w * 0.003, h * py + h * 0.028, clawX, h * py + h * 0.005);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1.0;

  // =====================================================================
  // HEAD — the soul of the creature. This must sell "alive" in ASCII.
  // =====================================================================

  // Skull shape — dark, angular, 3/4 view, heavier jaw
  ctx.fillStyle = bodyGradHueShift(ctx, w * 0.20, h * 0.40, w * 0.16,
    furMid[0], furMid[1], furMid[2],
    furShadow[0], furShadow[1], furShadow[2],
    furLight[0], furLight[1], furLight[2]
  );
  ctx.beginPath();
  ctx.moveTo(w * 0.30, h * 0.35);
  // Brow ridge — angular, not round
  ctx.bezierCurveTo(w * 0.26, h * 0.28, w * 0.14, h * 0.28, w * 0.08, h * 0.34);
  // Snout forward
  ctx.bezierCurveTo(w * 0.04, h * 0.38, w * 0.01, h * 0.44, w * 0.03, h * 0.51);
  // Jaw — heavier, lower, more aggressive
  ctx.bezierCurveTo(w * 0.08, h * 0.60, w * 0.18, h * 0.63, w * 0.28, h * 0.58);
  // Back to skull
  ctx.bezierCurveTo(w * 0.33, h * 0.50, w * 0.34, h * 0.40, w * 0.30, h * 0.35);
  ctx.fill();

  // Head fur — dark, radiating
  furTextureDirectional(ctx, w * 0.06, h * 0.28, w * 0.26, h * 0.28, w * 0.014,
    `rgb(${furShadow.join(',')})`, `rgb(${furMid.join(',')})`, 35,
    (fx, fy) => Math.atan2(fy - h * 0.38, fx - w * 0.18) + 0.5
  );

  // Brow ridge shadow — makes the eyes look deep-set
  ambientOcclusion(ctx, w * 0.15, h * 0.37, w * 0.10, h * 0.03, 0.35);

  // -- SNOUT -- dark with highlight on bridge
  ctx.fillStyle = `rgb(${skinDark.join(',')})`;
  ctx.beginPath();
  ctx.moveTo(w * 0.08, h * 0.42);
  ctx.bezierCurveTo(w * 0.02, h * 0.40, w * -0.02, h * 0.44, w * -0.03, h * 0.48);
  ctx.bezierCurveTo(w * -0.01, h * 0.53, w * 0.05, h * 0.55, w * 0.12, h * 0.53);
  ctx.closePath(); ctx.fill();
  // Snout bridge — slight highlight catches light
  highlight(ctx, w * 0.03, h * 0.43, w * 0.025, `rgb(${skinLight.join(',')})`, 0.15);

  // -- MOUTH CAVITY -- deep black, wide open aggressive snarl
  ctx.fillStyle = 'rgb(15,5,5)';
  ctx.beginPath();
  ctx.moveTo(w * -0.02, h * 0.49);
  ctx.bezierCurveTo(w * -0.04, h * 0.53, w * -0.01, h * 0.60, w * 0.14, h * 0.58);
  ctx.bezierCurveTo(w * 0.12, h * 0.55, w * 0.04, h * 0.51, w * -0.02, h * 0.49);
  ctx.fill();
  // Upper gum line — dark red
  ctx.fillStyle = 'rgb(90,25,25)';
  ctx.beginPath();
  ctx.moveTo(w * -0.01, h * 0.50);
  ctx.quadraticCurveTo(w * 0.04, h * 0.49, w * 0.12, h * 0.53);
  ctx.quadraticCurveTo(w * 0.04, h * 0.51, w * -0.01, h * 0.50);
  ctx.fill();
  // Lower gum line
  ctx.fillStyle = 'rgb(80,20,20)';
  ctx.beginPath();
  ctx.moveTo(w * -0.01, h * 0.55);
  ctx.quadraticCurveTo(w * 0.05, h * 0.57, w * 0.12, h * 0.56);
  ctx.quadraticCurveTo(w * 0.05, h * 0.55, w * -0.01, h * 0.55);
  ctx.fill();

  // -- TEETH -- BRIGHT, prominent fangs. Second-brightest after eyes.
  ctx.fillStyle = `rgb(${teethColor.join(',')})`;

  // Upper left fang — LARGE, prominent
  ctx.beginPath();
  ctx.moveTo(w * 0.01, h * 0.49);
  ctx.lineTo(w * -0.005, h * 0.575);
  ctx.lineTo(w * 0.03, h * 0.50);
  ctx.fill();

  // Upper right fang — large
  ctx.beginPath();
  ctx.moveTo(w * 0.07, h * 0.50);
  ctx.lineTo(w * 0.055, h * 0.575);
  ctx.lineTo(w * 0.085, h * 0.52);
  ctx.fill();

  // Upper small teeth between fangs
  ctx.fillStyle = 'rgb(225,215,195)';
  ctx.beginPath();
  ctx.moveTo(w * 0.035, h * 0.50);
  ctx.lineTo(w * 0.025, h * 0.555);
  ctx.lineTo(w * 0.045, h * 0.51);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(w * 0.052, h * 0.505);
  ctx.lineTo(w * 0.045, h * 0.555);
  ctx.lineTo(w * 0.062, h * 0.515);
  ctx.fill();

  // Lower fangs — pointing up, visible in the snarl
  ctx.fillStyle = `rgb(${teethColor.join(',')})`;
  ctx.beginPath();
  ctx.moveTo(w * 0.02, h * 0.56);
  ctx.lineTo(w * 0.01, h * 0.52);
  ctx.lineTo(w * 0.035, h * 0.555);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(w * 0.06, h * 0.555);
  ctx.lineTo(w * 0.055, h * 0.52);
  ctx.lineTo(w * 0.075, h * 0.545);
  ctx.fill();

  // Far-side fang — partially visible, adds depth
  ctx.fillStyle = 'rgb(200,190,170)';
  ctx.beginPath();
  ctx.moveTo(w * 0.095, h * 0.53);
  ctx.lineTo(w * 0.09, h * 0.57);
  ctx.lineTo(w * 0.11, h * 0.54);
  ctx.fill();

  // -- NOSE -- wet, glistening, catches bright highlight
  ctx.fillStyle = `rgb(${noseWet.join(',')})`;
  organicEllipse(ctx, w * -0.01, h * 0.47, w * 0.018, w * 0.015, 42, 0.08);
  ctx.fill();
  // Wet specular on nose — bright point
  highlight(ctx, w * -0.015, h * 0.465, w * 0.006, 'rgb(255,240,230)', 0.40);

  // =====================================================================
  // EYES — THE BRIGHTEST THING. Must glow in ASCII.
  // =====================================================================

  // Near eye (toward viewer) — large, burning
  // Deep socket shadow
  ambientOcclusion(ctx, w * 0.155, h * 0.40, w * 0.030, w * 0.025, 0.40);

  // Outer glow — this is what creates the glow halo in ASCII
  ctx.save();
  ctx.globalAlpha = 0.25;
  ctx.fillStyle = `rgb(${eyeGlow.join(',')})`;
  fillCircle(ctx, w * 0.155, h * 0.395, w * 0.028);
  ctx.restore();

  // Iris — bright red-orange
  ctx.fillStyle = `rgb(${eyeGlow.join(',')})`;
  fillCircle(ctx, w * 0.155, h * 0.395, w * 0.018);

  // Inner core — hottest point, near-white
  ctx.fillStyle = `rgb(${eyeCore.join(',')})`;
  fillCircle(ctx, w * 0.155, h * 0.395, w * 0.010);

  // Pupil — vertical slit
  ctx.fillStyle = 'rgb(10,2,2)';
  ctx.beginPath();
  ctx.ellipse(w * 0.157, h * 0.395, w * 0.003, w * 0.012, 0, 0, Math.PI * 2);
  ctx.fill();

  // Specular highlights — sharp, white, OFF-CENTER (this is the "alive" moment)
  ctx.fillStyle = 'rgb(255,255,255)';
  fillCircle(ctx, w * 0.148, h * 0.388, w * 0.005);
  // Secondary smaller highlight
  ctx.fillStyle = 'rgba(255,250,240,0.6)';
  fillCircle(ctx, w * 0.164, h * 0.402, w * 0.003);

  // Far eye (partially hidden, dimmer but still glowing)
  ctx.save(); ctx.globalAlpha = 0.6;
  // Glow
  ctx.fillStyle = `rgba(${eyeGlow.join(',')},0.20)`;
  fillCircle(ctx, w * 0.095, h * 0.39, w * 0.018);
  // Iris
  ctx.fillStyle = `rgb(${eyeGlow[0] - 40},${eyeGlow[1] - 20},${eyeGlow[2]})`;
  fillCircle(ctx, w * 0.095, h * 0.39, w * 0.012);
  // Pupil slit
  ctx.fillStyle = 'rgb(10,2,2)';
  ctx.beginPath();
  ctx.ellipse(w * 0.096, h * 0.39, w * 0.002, w * 0.008, 0, 0, Math.PI * 2);
  ctx.fill();
  // Far specular
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  fillCircle(ctx, w * 0.090, h * 0.384, w * 0.003);
  ctx.restore();

  // -- EARS -- short, round, laid-back rat ears (NOT bunny ears)
  // Near ear — round, low, tilted back
  ctx.fillStyle = `rgb(${furDark.join(',')})`;
  ctx.beginPath();
  ctx.moveTo(w * 0.23, h * 0.32);
  ctx.bezierCurveTo(w * 0.25, h * 0.26, w * 0.30, h * 0.23, w * 0.33, h * 0.24);
  ctx.bezierCurveTo(w * 0.33, h * 0.28, w * 0.30, h * 0.32, w * 0.26, h * 0.33);
  ctx.closePath();
  ctx.fill();
  // Ear interior — pink, visible but not dominant
  ctx.fillStyle = `rgb(${earPink.join(',')})`;
  ctx.beginPath();
  ctx.moveTo(w * 0.255, h * 0.31);
  ctx.bezierCurveTo(w * 0.27, h * 0.27, w * 0.305, h * 0.25, w * 0.32, h * 0.26);
  ctx.bezierCurveTo(w * 0.315, h * 0.29, w * 0.29, h * 0.315, w * 0.265, h * 0.32);
  ctx.closePath();
  ctx.fill();
  // Ear rim highlight
  highlight(ctx, w * 0.30, h * 0.26, w * 0.008, 'rgb(200,120,130)', 0.18);

  // Far ear — smaller, rounder, darker
  ctx.fillStyle = `rgb(${furShadow.join(',')})`;
  ctx.beginPath();
  ctx.moveTo(w * 0.14, h * 0.31);
  ctx.bezierCurveTo(w * 0.14, h * 0.25, w * 0.18, h * 0.22, w * 0.21, h * 0.24);
  ctx.bezierCurveTo(w * 0.21, h * 0.28, w * 0.18, h * 0.31, w * 0.15, h * 0.32);
  ctx.closePath();
  ctx.fill();
  // Far ear pink — dimmer
  ctx.fillStyle = `rgba(${earPink.join(',')},0.45)`;
  ctx.beginPath();
  ctx.moveTo(w * 0.155, h * 0.30);
  ctx.bezierCurveTo(w * 0.16, h * 0.26, w * 0.185, h * 0.24, w * 0.20, h * 0.25);
  ctx.bezierCurveTo(w * 0.195, h * 0.28, w * 0.175, h * 0.30, w * 0.16, h * 0.31);
  ctx.closePath();
  ctx.fill();

  // -- WHISKERS -- thin, catching light (shortened to stay in bounds)
  ctx.strokeStyle = 'rgba(120,100,80,0.40)'; ctx.lineWidth = w * 0.003; ctx.lineCap = 'round';
  for (const [bx, by] of [[0.03, 0.45], [0.04, 0.47], [0.03, 0.49]]) {
    const droop = rand() * 0.02;
    ctx.beginPath(); ctx.moveTo(w * bx, h * by);
    ctx.quadraticCurveTo(w * (bx - 0.04), h * (by - 0.01 + droop), w * (bx - 0.07), h * (by + droop)); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(w * (bx + 0.02), h * (by - 0.01));
    ctx.quadraticCurveTo(w * (bx - 0.02), h * (by - 0.03 + droop), w * (bx - 0.05), h * (by - 0.02 + droop)); ctx.stroke();
  }

  // -- HACKLES -- dark spikes along the longer spine
  ctx.fillStyle = `rgb(${furDark.join(',')})`;
  for (let i = 0; i < 18; i++) {
    const t = i / 18;
    const sx = w * (0.30 + t * 0.42);
    // Spine curve: dips at shoulders, rises at haunches
    const sy = h * (0.28 + Math.sin(t * Math.PI * 0.8) * -0.04 + t * 0.04);
    const hLen = w * (0.016 + rand() * 0.012);
    const angle = -1.3 + t * 0.5 + (rand() - 0.5) * 0.3;
    ctx.beginPath();
    ctx.moveTo(sx - w * 0.004, sy);
    ctx.lineTo(sx + Math.cos(angle) * hLen, sy + Math.sin(angle) * hLen);
    ctx.lineTo(sx + w * 0.004, sy); ctx.fill();
  }
  // Hackle highlight tips
  ctx.fillStyle = `rgba(${furLight.join(',')},0.3)`;
  for (let i = 0; i < 10; i++) {
    const t = i / 10;
    const sx = w * (0.32 + t * 0.38);
    const sy = h * (0.27 + Math.sin(t * Math.PI * 0.8) * -0.04 + t * 0.04);
    fillCircle(ctx, sx, sy - w * 0.007, w * 0.003);
  }

  // -- GROUND SHADOW -- wider for longer body
  ctx.save();
  ctx.globalCompositeOperation = 'multiply';
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  fillEllipse(ctx, w * 0.44, h * 0.90, w * 0.30, h * 0.025);
  ctx.restore();

  // Undo the initial translate
  ctx.restore();
}


// ==========================================================================
// Standard creature interface — used by viewer.html and render-creature.mjs
// ==========================================================================
export function drawDireRatClean(ctx, skeleton, w, h) {
  drawCleanCreature(ctx, skeleton, w, h, { bodyGradHueShift, fillCircle, fillEllipse });
}
export default { draw: drawDireRatClean, skeleton: direRatSkeleton, gridW: 7, gridH: 4 };

// ==========================================================================
// Harness
// ==========================================================================
let currentSeed = Math.floor(Math.random() * 100000);
let animating = false;
let animStart = 0;
let rafId = null;

// Use the in-code skeleton (hand-tuned active pose).
// To override, place optimized-skeleton.json in this directory.
let activeSkeleton = direRatSkeleton;
try {
  const resp = await fetch('./optimized-skeleton.json');
  if (resp.ok) {
    activeSkeleton = await resp.json();
    console.log('Loaded optimized skeleton from JSON');
  }
} catch (e) { /* use default */ }

function render(elapsed = 0) {
  const size = parseInt(document.getElementById('canvas-size').value);
  const cellSize = parseInt(document.getElementById('cell-size').value);
  const showGrid = document.getElementById('show-grid').checked;
  const showDebug = document.getElementById('show-debug').checked;
  const asciiOpts = {
    elapsed,
    cellSize,
    level: 1,
    gridWidth: 7,
    gridHeight: 4,
  };

  const canvasW = size;
  const canvasH = Math.round(size * 4 / 7);
  const maxDisplay = 420;
  const displayW = `${Math.min(canvasW, maxDisplay)}px`;
  const displayH = `${Math.min(canvasH, Math.round(maxDisplay * 4 / 7))}px`;

  // -- Skeleton view --
  const c1 = document.getElementById('skel-raw');
  c1.width = canvasW; c1.height = canvasH;
  c1.style.width = displayW; c1.style.height = displayH;
  const ctx1 = c1.getContext('2d');
  ctx1.fillStyle = '#000'; ctx1.fillRect(0, 0, canvasW, canvasH);
  drawCreatureFromSkeleton(ctx1, activeSkeleton, canvasW, canvasH);
  if (showDebug) drawDebugSkeleton(ctx1, activeSkeleton, canvasW, canvasH);

  // Helper bundles
  const detailHelpers = {
    setSeed, rand, fillEllipse, fillCircle, organicEllipse,
    bodyGradHueShift, furTextureDirectional,
    ambientOcclusion, highlight, sssEdgeGlow,
    seed: currentSeed,
  };
  const cleanHelpers = {
    bodyGradHueShift, fillCircle, fillEllipse,
  };

  // -- ASCII (clean version — bold shapes, let ASCII add texture) --
  const c2 = document.getElementById('next-ascii');
  c2.width = canvasW; c2.height = canvasH;
  c2.style.width = displayW; c2.style.height = displayH;
  const ctx2 = c2.getContext('2d');
  ctx2.fillStyle = '#000'; ctx2.fillRect(0, 0, canvasW, canvasH);
  renderAscii(ctx2, (tctx, tw, th) => {
    drawCleanCreature(tctx, activeSkeleton, tw, th, cleanHelpers);
  }, 0, 0, canvasW, canvasH, asciiOpts);

  // -- Painted (clean version — raw template before ASCII) --
  const c3 = document.getElementById('next-raw');
  c3.width = canvasW; c3.height = canvasH;
  c3.style.width = displayW; c3.style.height = displayH;
  const ctx3 = c3.getContext('2d');
  ctx3.fillStyle = '#000'; ctx3.fillRect(0, 0, canvasW, canvasH);
  drawCleanCreature(ctx3, activeSkeleton, canvasW, canvasH, cleanHelpers);

  if (showGrid) {
    for (const canvas of [c1, c2, c3]) {
      const gctx = canvas.getContext('2d');
      gctx.strokeStyle = 'rgba(255,255,255,0.08)'; gctx.lineWidth = 1;
      const step = canvasW / 10;
      for (let i = 0; i < canvasW; i += step) {
        gctx.beginPath(); gctx.moveTo(i, 0); gctx.lineTo(i, canvasH); gctx.stroke();
      }
      for (let i = 0; i < canvasH; i += step) {
        gctx.beginPath(); gctx.moveTo(0, i); gctx.lineTo(canvasW, i); gctx.stroke();
      }
    }
  }

  document.getElementById('seed-display').textContent = `seed: ${currentSeed}`;
}

function animationLoop(ts) {
  if (!animating) return;
  render(ts - animStart);
  rafId = requestAnimationFrame(animationLoop);
}

// Controls
document.getElementById('reseed').addEventListener('click', () => {
  currentSeed = Math.floor(Math.random() * 100000);
  render(animating ? performance.now() - animStart : 0);
});

document.getElementById('animate').addEventListener('change', (e) => {
  animating = e.target.checked;
  if (animating) {
    animStart = performance.now();
    rafId = requestAnimationFrame(animationLoop);
  } else if (rafId) {
    cancelAnimationFrame(rafId);
    render(0);
  }
});

for (const id of ['canvas-size', 'cell-size', 'show-grid', 'show-debug']) {
  document.getElementById(id).addEventListener('change', () => render(animating ? performance.now() - animStart : 0));
}

// Initial render
if (typeof document !== 'undefined') render();

// HMR
if (import.meta.hot) {
  import.meta.hot.accept(() => {
    render(animating ? performance.now() - animStart : 0);
  });
}
