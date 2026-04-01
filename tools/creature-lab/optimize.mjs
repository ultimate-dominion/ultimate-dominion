// ==========================================================================
// Autonomous skeleton optimizer
// Renders creature + reference, computes silhouette IoU, hill-climbs params
// Run: node optimize.mjs
// ==========================================================================
import { createCanvas, loadImage } from 'canvas';
import { writeFileSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// -- Import skeleton system (re-implement for Node since ES modules differ) --
// We inline the core functions to avoid import issues with browser modules

function computeContour(spine, w, h) {
  const n = spine.length;
  const top = [];
  const bot = [];
  for (let i = 0; i < n; i++) {
    const node = spine[i];
    const cx = w * node.x, cy = h * node.y, r = w * node.radius;
    let dx, dy;
    if (i === 0) { dx = spine[1].x - node.x; dy = spine[1].y - node.y; }
    else if (i === n - 1) { dx = node.x - spine[n - 2].x; dy = node.y - spine[n - 2].y; }
    else { dx = spine[i + 1].x - spine[i - 1].x; dy = spine[i + 1].y - spine[i - 1].y; }
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    const px = -dy / len, py = dx / len;
    top.push({ x: cx + px * r, y: cy + py * r });
    bot.push({ x: cx - px * r, y: cy - py * r });
  }
  return { top, bot };
}

function catmullToBezierCP(p0, p1, p2, p3, tension) {
  const t = tension || 0.35;
  return {
    cp1x: p1.x + (p2.x - p0.x) * t / 3,
    cp1y: p1.y + (p2.y - p0.y) * t / 3,
    cp2x: p2.x - (p3.x - p1.x) * t / 3,
    cp2y: p2.y - (p3.y - p1.y) * t / 3,
  };
}

function drawBodyOutline(ctx, spine, w, h, fillStyle) {
  const { top, bot } = computeContour(spine, w, h);
  const first = spine[0], last = spine[spine.length - 1];

  ctx.beginPath();
  ctx.moveTo(top[0].x, top[0].y);
  for (let i = 0; i < top.length - 1; i++) {
    const p0 = top[Math.max(0, i - 1)], p1 = top[i];
    const p2 = top[i + 1], p3 = top[Math.min(top.length - 1, i + 2)];
    const cp = catmullToBezierCP(p0, p1, p2, p3);
    ctx.bezierCurveTo(cp.cp1x, cp.cp1y, cp.cp2x, cp.cp2y, p2.x, p2.y);
  }
  const lastCx = w * last.x, lastCy = h * last.y, lastR = w * last.radius;
  const lastTopAngle = Math.atan2(top[top.length - 1].y - lastCy, top[top.length - 1].x - lastCx);
  const lastBotAngle = Math.atan2(bot[bot.length - 1].y - lastCy, bot[bot.length - 1].x - lastCx);
  ctx.arc(lastCx, lastCy, lastR, lastTopAngle, lastBotAngle, false);
  for (let i = bot.length - 1; i > 0; i--) {
    const p0 = bot[Math.min(bot.length - 1, i + 1)], p1 = bot[i];
    const p2 = bot[i - 1], p3 = bot[Math.max(0, i - 2)];
    const cp = catmullToBezierCP(p0, p1, p2, p3);
    ctx.bezierCurveTo(cp.cp1x, cp.cp1y, cp.cp2x, cp.cp2y, p2.x, p2.y);
  }
  const firstCx = w * first.x, firstCy = h * first.y, firstR = w * first.radius;
  const firstBotAngle = Math.atan2(bot[0].y - firstCy, bot[0].x - firstCx);
  const firstTopAngle = Math.atan2(top[0].y - firstCy, top[0].x - firstCx);
  ctx.arc(firstCx, firstCy, firstR, firstBotAngle, firstTopAngle, false);
  ctx.closePath();
  if (fillStyle) { ctx.fillStyle = fillStyle; ctx.fill(); }
}

function drawLimbChain(ctx, segments, w, h, color) {
  for (let i = 0; i < segments.length - 1; i++) {
    const s0 = segments[i], s1 = segments[i + 1];
    const x0 = w * s0.x, y0 = h * s0.y, r0 = w * s0.radius;
    const x1 = w * s1.x, y1 = h * s1.y, r1 = w * s1.radius;
    const dx = x1 - x0, dy = y1 - y0;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    const px = -dy / len, py = dx / len;
    ctx.beginPath();
    ctx.moveTo(x0 + px * r0, y0 + py * r0);
    ctx.lineTo(x1 + px * r1, y1 + py * r1);
    ctx.lineTo(x1 - px * r1, y1 - py * r1);
    ctx.lineTo(x0 - px * r0, y0 - py * r0);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
    ctx.beginPath(); ctx.arc(x0, y0, r0, 0, Math.PI * 2); ctx.fill();
  }
  const last = segments[segments.length - 1];
  ctx.beginPath(); ctx.arc(w * last.x, h * last.y, w * last.radius, 0, Math.PI * 2); ctx.fill();
}

function drawTailShape(ctx, points, startWidth, endWidth, w, h, color) {
  const n = points.length;
  for (let i = 0; i < n - 1; i++) {
    const t0 = i / (n - 1), t1 = (i + 1) / (n - 1);
    const r0 = w * (startWidth + (endWidth - startWidth) * t0);
    const r1 = w * (startWidth + (endWidth - startWidth) * t1);
    const x0 = w * points[i].x, y0 = h * points[i].y;
    const x1 = w * points[i + 1].x, y1 = h * points[i + 1].y;
    const dx = x1 - x0, dy = y1 - y0;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    const px = -dy / len, py = dx / len;
    ctx.beginPath();
    ctx.moveTo(x0 + px * r0, y0 + py * r0);
    ctx.lineTo(x1 + px * r1, y1 + py * r1);
    ctx.lineTo(x1 - px * r1, y1 - py * r1);
    ctx.lineTo(x0 - px * r0, y0 - py * r0);
    ctx.closePath();
    ctx.fillStyle = color; ctx.fill();
    ctx.beginPath(); ctx.arc(x0, y0, r0, 0, Math.PI * 2); ctx.fill();
  }
}

// -- Render a skeleton to binary silhouette --------------------------------
function renderSilhouette(skeleton, w, h) {
  const canvas = createCanvas(w, h);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, w, h);

  const white = '#fff';

  // Tail
  if (skeleton.tail) {
    drawTailShape(ctx, skeleton.tail.points, skeleton.tail.startWidth, skeleton.tail.endWidth, w, h, white);
  }

  // All limbs
  for (const limb of skeleton.limbs) {
    drawLimbChain(ctx, limb.segments, w, h, white);
  }

  // Body
  drawBodyOutline(ctx, skeleton.spine, w, h, white);

  // Extract binary mask
  const data = ctx.getImageData(0, 0, w, h).data;
  const mask = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) {
    mask[i] = data[i * 4] > 128 ? 1 : 0;
  }
  return { mask, canvas };
}

// -- Extract reference silhouette from image -------------------------------
async function extractReferenceSilhouette(imagePath, w, h) {
  const img = await loadImage(imagePath);
  const canvas = createCanvas(w, h);
  const ctx = canvas.getContext('2d');

  // Fit reference image into canvas, centered
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, w, h);

  // Scale to fit width, vertically center
  const scale = Math.min(w / img.width, h / img.height) * 0.85;
  const sw = img.width * scale;
  const sh = img.height * scale;
  const ox = (w - sw) / 2;
  const oy = (h - sh) / 2;
  ctx.drawImage(img, ox, oy, sw, sh);

  const data = ctx.getImageData(0, 0, w, h).data;
  const mask = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const idx = i * 4;
    const lum = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
    // Reference has dark creature on dark-ish background — threshold carefully
    // The rat is the non-black part
    mask[i] = lum > 25 ? 1 : 0;
  }
  return { mask, canvas };
}

// -- Compute IoU (intersection over union) ---------------------------------
function computeIoU(mask1, mask2) {
  let intersection = 0, union = 0;
  for (let i = 0; i < mask1.length; i++) {
    const a = mask1[i], b = mask2[i];
    if (a || b) union++;
    if (a && b) intersection++;
  }
  return union > 0 ? intersection / union : 0;
}

// -- Additional structural scores -----------------------------------------
function computeStructuralScore(skeleton) {
  let score = 0;
  const spine = skeleton.spine;

  // Aspect ratio: rat should be ~1.8x wider than tall
  const xs = spine.map(s => s.x);
  const bodyWidth = Math.max(...xs) - Math.min(...xs);
  const maxRadius = Math.max(...spine.map(s => s.radius));
  const bodyHeight = maxRadius * 2;
  const aspect = bodyWidth / bodyHeight;
  // Target aspect ~3.0 for the spine (excluding legs)
  score += 1.0 - Math.abs(aspect - 3.0) / 3.0;

  // Spine should dip in the middle or rise at haunches
  const midY = spine[Math.floor(spine.length / 2)].y;
  const endAvgY = (spine[0].y + spine[spine.length - 1].y) / 2;
  if (midY >= endAvgY) score += 0.3; // belly hangs lower

  // Head should be smaller than belly
  const headR = spine.find(s => s.id === 'head')?.radius || 0;
  const bellyR = spine.find(s => s.id === 'belly')?.radius || 0;
  if (headR < bellyR) score += 0.3;

  // Haunches: hip radius should be close to belly
  const hipR = spine.find(s => s.id === 'hip')?.radius || 0;
  if (hipR > bellyR * 0.7) score += 0.3;

  // Legs should be thin relative to body
  for (const limb of skeleton.limbs) {
    const pawR = limb.segments[limb.segments.length - 1].radius;
    if (pawR < bellyR * 0.2) score += 0.1;
  }

  return score;
}

// -- Deep clone skeleton for mutation -------------------------------------
function cloneSkeleton(s) {
  return JSON.parse(JSON.stringify(s));
}

// -- Random perturbation of skeleton parameters ---------------------------
function perturbSkeleton(skeleton, temperature) {
  const s = cloneSkeleton(skeleton);
  const t = temperature;

  // Pick a random thing to perturb
  const choice = Math.random();

  if (choice < 0.5) {
    // Perturb a spine node
    const idx = Math.floor(Math.random() * s.spine.length);
    const node = s.spine[idx];
    node.x += (Math.random() - 0.5) * 0.04 * t;
    node.y += (Math.random() - 0.5) * 0.04 * t;
    node.radius += (Math.random() - 0.5) * 0.02 * t;
    node.radius = Math.max(0.02, Math.min(0.18, node.radius));
    node.x = Math.max(0.02, Math.min(0.95, node.x));
    node.y = Math.max(0.15, Math.min(0.65, node.y));

    // Keep spine ordered left to right
    if (idx > 0 && node.x < s.spine[idx - 1].x + 0.03) {
      node.x = s.spine[idx - 1].x + 0.03;
    }
    if (idx < s.spine.length - 1 && node.x > s.spine[idx + 1].x - 0.03) {
      node.x = s.spine[idx + 1].x - 0.03;
    }
  } else if (choice < 0.85) {
    // Perturb a limb segment
    const limbIdx = Math.floor(Math.random() * s.limbs.length);
    const segIdx = Math.floor(Math.random() * s.limbs[limbIdx].segments.length);
    const seg = s.limbs[limbIdx].segments[segIdx];
    seg.x += (Math.random() - 0.5) * 0.03 * t;
    seg.y += (Math.random() - 0.5) * 0.04 * t;
    seg.radius += (Math.random() - 0.5) * 0.01 * t;
    seg.radius = Math.max(0.005, Math.min(0.06, seg.radius));
    seg.x = Math.max(0.02, Math.min(0.95, seg.x));
    seg.y = Math.max(0.30, Math.min(0.92, seg.y));

    // Keep limb segments ordered top to bottom
    if (segIdx > 0 && seg.y < s.limbs[limbIdx].segments[segIdx - 1].y + 0.02) {
      seg.y = s.limbs[limbIdx].segments[segIdx - 1].y + 0.02;
    }
    if (segIdx < s.limbs[limbIdx].segments.length - 1 && seg.y > s.limbs[limbIdx].segments[segIdx + 1].y - 0.02) {
      seg.y = s.limbs[limbIdx].segments[segIdx + 1].y - 0.02;
    }
  } else {
    // Perturb tail
    if (s.tail && s.tail.points.length > 0) {
      const ptIdx = Math.floor(Math.random() * s.tail.points.length);
      s.tail.points[ptIdx].x += (Math.random() - 0.5) * 0.04 * t;
      s.tail.points[ptIdx].y += (Math.random() - 0.5) * 0.04 * t;
    }
  }

  return s;
}

// -- Score function: weighted combo of IoU + structural --------------------
function scoreSkeleton(skeleton, refMask, w, h) {
  const { mask } = renderSilhouette(skeleton, w, h);
  const iou = computeIoU(mask, refMask);
  const structural = computeStructuralScore(skeleton);
  // IoU is the primary signal, structural is a regularizer
  return iou * 0.7 + (structural / 3.0) * 0.3;
}

// ==========================================================================
// Main optimization loop
// ==========================================================================
async function main() {
  const W = 256; // Render at lower res for speed
  const H = Math.round(256 * 4 / 7);

  const refPath = join(__dirname, 'rat-ref.png');
  if (!existsSync(refPath)) {
    console.error('Reference image not found:', refPath);
    process.exit(1);
  }

  console.log('Loading reference image...');
  const { mask: refMask, canvas: refCanvas } = await extractReferenceSilhouette(refPath, W, H);

  // Save reference silhouette for debugging
  writeFileSync(join(__dirname, 'debug-ref-silhouette.png'), refCanvas.toBuffer('image/png'));
  console.log('Saved debug-ref-silhouette.png');

  // Starting skeleton
  let best = {
    spine: [
      { id: 'snout',   x: 0.10, y: 0.44, radius: 0.045 },
      { id: 'head',    x: 0.17, y: 0.40, radius: 0.072 },
      { id: 'neck',    x: 0.25, y: 0.38, radius: 0.055 },
      { id: 'chest',   x: 0.34, y: 0.36, radius: 0.090 },
      { id: 'belly',   x: 0.48, y: 0.40, radius: 0.105 },
      { id: 'hip',     x: 0.62, y: 0.38, radius: 0.095 },
      { id: 'rump',    x: 0.73, y: 0.40, radius: 0.065 },
    ],
    limbs: [
      { attach: 'chest', side: 'near', segments: [
        { x: 0.30, y: 0.52, radius: 0.030 },
        { x: 0.27, y: 0.64, radius: 0.016 },
        { x: 0.25, y: 0.76, radius: 0.012 },
        { x: 0.24, y: 0.84, radius: 0.016 },
      ]},
      { attach: 'chest', side: 'far', segments: [
        { x: 0.35, y: 0.52, radius: 0.025 },
        { x: 0.34, y: 0.64, radius: 0.013 },
        { x: 0.33, y: 0.76, radius: 0.010 },
        { x: 0.33, y: 0.84, radius: 0.013 },
      ]},
      { attach: 'hip', side: 'near', segments: [
        { x: 0.58, y: 0.52, radius: 0.038 },
        { x: 0.56, y: 0.64, radius: 0.018 },
        { x: 0.55, y: 0.76, radius: 0.012 },
        { x: 0.54, y: 0.84, radius: 0.016 },
      ]},
      { attach: 'hip', side: 'far', segments: [
        { x: 0.65, y: 0.52, radius: 0.032 },
        { x: 0.66, y: 0.64, radius: 0.014 },
        { x: 0.66, y: 0.76, radius: 0.010 },
        { x: 0.66, y: 0.84, radius: 0.013 },
      ]},
    ],
    tail: {
      points: [
        { x: 0.75, y: 0.42 },
        { x: 0.82, y: 0.34 },
        { x: 0.88, y: 0.30 },
        { x: 0.92, y: 0.38 },
        { x: 0.90, y: 0.50 },
        { x: 0.86, y: 0.56 },
      ],
      startWidth: 0.016,
      endWidth: 0.004,
    },
  };

  let bestScore = scoreSkeleton(best, refMask, W, H);
  console.log(`\nInitial score: ${bestScore.toFixed(4)}`);

  // Save initial render
  const { canvas: initCanvas } = renderSilhouette(best, W, H);
  writeFileSync(join(__dirname, 'debug-initial.png'), initCanvas.toBuffer('image/png'));

  // -- Hill climbing with simulated annealing -------------------------------
  const ITERATIONS = 3000;
  const TEMP_START = 1.0;
  const TEMP_END = 0.1;
  let noImproveCount = 0;
  let accepted = 0;

  console.log(`\nRunning ${ITERATIONS} iterations...`);

  for (let iter = 0; iter < ITERATIONS; iter++) {
    const progress = iter / ITERATIONS;
    const temp = TEMP_START + (TEMP_END - TEMP_START) * progress;

    const candidate = perturbSkeleton(best, temp);
    const candidateScore = scoreSkeleton(candidate, refMask, W, H);

    // Accept if better, or with probability based on temperature (SA)
    const delta = candidateScore - bestScore;
    if (delta > 0 || Math.random() < Math.exp(delta * 20 / temp)) {
      best = candidate;
      bestScore = candidateScore;
      accepted++;
      noImproveCount = 0;
    } else {
      noImproveCount++;
    }

    // Log progress
    if (iter % 200 === 0 || iter === ITERATIONS - 1) {
      console.log(`  iter ${iter}/${ITERATIONS}  score=${bestScore.toFixed(4)}  temp=${temp.toFixed(2)}  accepted=${accepted}`);
    }

    // Save snapshots
    if (iter % 500 === 0) {
      const { canvas: snapCanvas } = renderSilhouette(best, W, H);
      writeFileSync(join(__dirname, `debug-iter-${iter}.png`), snapCanvas.toBuffer('image/png'));
    }
  }

  // -- Save final result ---------------------------------------------------
  const { canvas: finalCanvas } = renderSilhouette(best, W, H);
  writeFileSync(join(__dirname, 'debug-final.png'), finalCanvas.toBuffer('image/png'));

  console.log(`\n=== OPTIMIZATION COMPLETE ===`);
  console.log(`Final score: ${bestScore.toFixed(4)}  (accepted ${accepted}/${ITERATIONS})`);
  console.log(`\nOptimized skeleton (paste into skeleton.js):\n`);
  console.log(JSON.stringify(best, null, 2));

  // Also save to a file
  writeFileSync(join(__dirname, 'optimized-skeleton.json'), JSON.stringify(best, null, 2));
  console.log('\nSaved to optimized-skeleton.json');
}

main().catch(console.error);
