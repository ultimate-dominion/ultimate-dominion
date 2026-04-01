// ==========================================================================
// Autonomous skeleton optimizer v2
// Uses a CLEAN programmatic rat silhouette as reference (not noisy photo)
// + strong structural constraints for rat anatomy
// Run: node optimize.mjs
// ==========================================================================
import { createCanvas } from 'canvas';
import { writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// -- Inlined skeleton rendering (same as skeleton.js, for Node) -----------

function computeContour(spine, w, h) {
  const n = spine.length;
  const top = [], bot = [];
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

function catmullCP(p0, p1, p2, p3) {
  const t = 0.35;
  return {
    cp1x: p1.x + (p2.x - p0.x) * t / 3, cp1y: p1.y + (p2.y - p0.y) * t / 3,
    cp2x: p2.x - (p3.x - p1.x) * t / 3, cp2y: p2.y - (p3.y - p1.y) * t / 3,
  };
}

function drawBodyOutline(ctx, spine, w, h) {
  const { top, bot } = computeContour(spine, w, h);
  const first = spine[0], last = spine[spine.length - 1];
  ctx.beginPath();
  ctx.moveTo(top[0].x, top[0].y);
  for (let i = 0; i < top.length - 1; i++) {
    const cp = catmullCP(top[Math.max(0,i-1)], top[i], top[i+1], top[Math.min(top.length-1,i+2)]);
    ctx.bezierCurveTo(cp.cp1x, cp.cp1y, cp.cp2x, cp.cp2y, top[i+1].x, top[i+1].y);
  }
  const lx = w*last.x, ly = h*last.y, lr = w*last.radius;
  ctx.arc(lx, ly, lr, Math.atan2(top[top.length-1].y-ly, top[top.length-1].x-lx),
    Math.atan2(bot[bot.length-1].y-ly, bot[bot.length-1].x-lx), false);
  for (let i = bot.length-1; i > 0; i--) {
    const cp = catmullCP(bot[Math.min(bot.length-1,i+1)], bot[i], bot[i-1], bot[Math.max(0,i-2)]);
    ctx.bezierCurveTo(cp.cp1x, cp.cp1y, cp.cp2x, cp.cp2y, bot[i-1].x, bot[i-1].y);
  }
  const fx = w*first.x, fy = h*first.y, fr = w*first.radius;
  ctx.arc(fx, fy, fr, Math.atan2(bot[0].y-fy, bot[0].x-fx), Math.atan2(top[0].y-fy, top[0].x-fx), false);
  ctx.closePath();
  ctx.fillStyle = '#fff'; ctx.fill();
}

function drawLimbChain(ctx, segments, w, h) {
  ctx.fillStyle = '#fff';
  for (let i = 0; i < segments.length - 1; i++) {
    const s0 = segments[i], s1 = segments[i+1];
    const x0 = w*s0.x, y0 = h*s0.y, r0 = w*s0.radius;
    const x1 = w*s1.x, y1 = h*s1.y, r1 = w*s1.radius;
    const dx = x1-x0, dy = y1-y0;
    const len = Math.sqrt(dx*dx+dy*dy)||1;
    const px = -dy/len, py = dx/len;
    ctx.beginPath();
    ctx.moveTo(x0+px*r0, y0+py*r0); ctx.lineTo(x1+px*r1, y1+py*r1);
    ctx.lineTo(x1-px*r1, y1-py*r1); ctx.lineTo(x0-px*r0, y0-py*r0);
    ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.arc(x0, y0, r0, 0, Math.PI*2); ctx.fill();
  }
  const last = segments[segments.length-1];
  ctx.beginPath(); ctx.arc(w*last.x, h*last.y, w*last.radius, 0, Math.PI*2); ctx.fill();
}

function drawTailShape(ctx, points, sw, ew, w, h) {
  ctx.fillStyle = '#fff';
  for (let i = 0; i < points.length-1; i++) {
    const t0 = i/(points.length-1), t1 = (i+1)/(points.length-1);
    const r0 = w*(sw+(ew-sw)*t0), r1 = w*(sw+(ew-sw)*t1);
    const x0 = w*points[i].x, y0 = h*points[i].y;
    const x1 = w*points[i+1].x, y1 = h*points[i+1].y;
    const dx = x1-x0, dy = y1-y0, len = Math.sqrt(dx*dx+dy*dy)||1;
    const px = -dy/len, py = dx/len;
    ctx.beginPath();
    ctx.moveTo(x0+px*r0, y0+py*r0); ctx.lineTo(x1+px*r1, y1+py*r1);
    ctx.lineTo(x1-px*r1, y1-py*r1); ctx.lineTo(x0-px*r0, y0-py*r0);
    ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.arc(x0, y0, r0, 0, Math.PI*2); ctx.fill();
  }
}

// -- Render skeleton to binary mask ----------------------------------------
function renderMask(skeleton, w, h) {
  const canvas = createCanvas(w, h);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h);
  if (skeleton.tail) drawTailShape(ctx, skeleton.tail.points, skeleton.tail.startWidth, skeleton.tail.endWidth, w, h);
  for (const limb of skeleton.limbs) drawLimbChain(ctx, limb.segments, w, h);
  drawBodyOutline(ctx, skeleton.spine, w, h);
  const data = ctx.getImageData(0, 0, w, h).data;
  const mask = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) mask[i] = data[i * 4] > 128 ? 1 : 0;
  return { mask, canvas };
}

// ==========================================================================
// CLEAN REFERENCE: programmatic rat silhouette
// Drawn from known rat anatomy — no photo noise
// ==========================================================================
function drawRatReference(w, h) {
  const canvas = createCanvas(w, h);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#fff';

  // Body — elongated oval, slightly angled (front lower, rear higher)
  ctx.beginPath();
  ctx.ellipse(w * 0.45, h * 0.45, w * 0.28, h * 0.18, -0.08, 0, Math.PI * 2);
  ctx.fill();

  // Haunch bulge — rear
  ctx.beginPath();
  ctx.ellipse(w * 0.65, h * 0.42, w * 0.12, h * 0.16, -0.1, 0, Math.PI * 2);
  ctx.fill();

  // Head — smaller oval, forward and slightly down
  ctx.beginPath();
  ctx.ellipse(w * 0.15, h * 0.44, w * 0.10, h * 0.10, -0.15, 0, Math.PI * 2);
  ctx.fill();

  // Snout — small elongated oval
  ctx.beginPath();
  ctx.ellipse(w * 0.06, h * 0.46, w * 0.06, h * 0.05, -0.1, 0, Math.PI * 2);
  ctx.fill();

  // Neck connection
  ctx.beginPath();
  ctx.ellipse(w * 0.24, h * 0.43, w * 0.06, h * 0.09, 0, 0, Math.PI * 2);
  ctx.fill();

  // Near front leg — thin, from shoulder down
  ctx.fillRect(w * 0.22, h * 0.55, w * 0.025, h * 0.30);
  // Paw
  ctx.beginPath(); ctx.ellipse(w * 0.23, h * 0.85, w * 0.018, h * 0.015, 0, 0, Math.PI*2); ctx.fill();

  // Far front leg
  ctx.fillRect(w * 0.30, h * 0.55, w * 0.020, h * 0.28);
  ctx.beginPath(); ctx.ellipse(w * 0.31, h * 0.83, w * 0.015, h * 0.012, 0, 0, Math.PI*2); ctx.fill();

  // Near rear leg — haunch thick, shin thin
  // Upper haunch (part of body)
  ctx.beginPath();
  ctx.ellipse(w * 0.58, h * 0.52, w * 0.04, h * 0.10, 0.1, 0, Math.PI * 2);
  ctx.fill();
  // Lower leg
  ctx.fillRect(w * 0.55, h * 0.62, w * 0.022, h * 0.22);
  ctx.beginPath(); ctx.ellipse(w * 0.56, h * 0.84, w * 0.018, h * 0.015, 0, 0, Math.PI*2); ctx.fill();

  // Far rear leg
  ctx.beginPath();
  ctx.ellipse(w * 0.64, h * 0.52, w * 0.035, h * 0.08, 0.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(w * 0.63, h * 0.60, w * 0.018, h * 0.22);
  ctx.beginPath(); ctx.ellipse(w * 0.64, h * 0.82, w * 0.015, h * 0.012, 0, 0, Math.PI*2); ctx.fill();

  // Tail — long, thin, S-curve upward
  ctx.lineWidth = w * 0.014;
  ctx.strokeStyle = '#fff'; ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(w * 0.73, h * 0.40);
  ctx.bezierCurveTo(w * 0.80, h * 0.30, w * 0.88, h * 0.25, w * 0.93, h * 0.35);
  ctx.stroke();
  // Thinner tip
  ctx.lineWidth = w * 0.006;
  ctx.beginPath();
  ctx.moveTo(w * 0.93, h * 0.35);
  ctx.bezierCurveTo(w * 0.95, h * 0.42, w * 0.92, h * 0.48, w * 0.88, h * 0.46);
  ctx.stroke();

  // Ears — small rounded bumps on top of head
  ctx.beginPath();
  ctx.ellipse(w * 0.18, h * 0.34, w * 0.022, h * 0.025, -0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(w * 0.14, h * 0.35, w * 0.018, h * 0.020, -0.2, 0, Math.PI * 2);
  ctx.fill();

  const data = ctx.getImageData(0, 0, w, h).data;
  const mask = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) mask[i] = data[i * 4] > 128 ? 1 : 0;
  return { mask, canvas };
}

// -- Compute IoU -----------------------------------------------------------
function computeIoU(m1, m2) {
  let inter = 0, union = 0;
  for (let i = 0; i < m1.length; i++) {
    if (m1[i] || m2[i]) union++;
    if (m1[i] && m2[i]) inter++;
  }
  return union > 0 ? inter / union : 0;
}

// -- Vertical profile comparison (width at each row) -----------------------
function verticalProfile(mask, w, h) {
  const profile = new Float32Array(h);
  for (let y = 0; y < h; y++) {
    let minX = w, maxX = 0;
    for (let x = 0; x < w; x++) {
      if (mask[y * w + x]) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
      }
    }
    profile[y] = maxX > minX ? (maxX - minX) / w : 0;
  }
  return profile;
}

function profileSimilarity(p1, p2) {
  let sum = 0;
  for (let i = 0; i < p1.length; i++) {
    sum += 1 - Math.abs(p1[i] - p2[i]);
  }
  return sum / p1.length;
}

// -- Horizontal profile (height at each column) ----------------------------
function horizontalProfile(mask, w, h) {
  const profile = new Float32Array(w);
  for (let x = 0; x < w; x++) {
    let minY = h, maxY = 0;
    for (let y = 0; y < h; y++) {
      if (mask[y * w + x]) {
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
    profile[x] = maxY > minY ? (maxY - minY) / h : 0;
  }
  return profile;
}

// -- Structural scoring (rat anatomy rules) --------------------------------
function structuralScore(skel) {
  let s = 0;
  const sp = skel.spine;
  const byId = {};
  for (const n of sp) byId[n.id] = n;

  // 1. Body elongation: spine should span 0.55-0.75 of width
  const xSpan = sp[sp.length-1].x - sp[0].x;
  s += 1.0 - Math.abs(xSpan - 0.65) * 4;

  // 2. Head smaller than belly
  if (byId.head && byId.belly && byId.head.radius < byId.belly.radius) s += 0.5;

  // 3. Snout smallest
  if (byId.snout && byId.head && byId.snout.radius < byId.head.radius * 0.7) s += 0.3;

  // 4. Belly is the largest segment
  const maxR = Math.max(...sp.map(n => n.radius));
  if (byId.belly && byId.belly.radius === maxR) s += 0.4;

  // 5. Neck is a pinch (smaller than head and chest)
  if (byId.neck && byId.head && byId.chest) {
    if (byId.neck.radius < byId.head.radius && byId.neck.radius < byId.chest.radius) s += 0.5;
  }

  // 6. Spine roughly horizontal (y values between 0.32-0.50)
  const ys = sp.map(n => n.y);
  const yRange = Math.max(...ys) - Math.min(...ys);
  if (yRange < 0.15) s += 0.4;

  // 7. Rump tapers (smaller than hip)
  if (byId.rump && byId.hip && byId.rump.radius < byId.hip.radius) s += 0.3;

  // 8. Legs: paws should be near y=0.82-0.88
  for (const limb of skel.limbs) {
    const paw = limb.segments[limb.segments.length - 1];
    if (paw.y > 0.80 && paw.y < 0.90) s += 0.15;
    // Upper segment should be thicker than lower
    if (limb.segments[0].radius > limb.segments[limb.segments.length-1].radius) s += 0.1;
    // Taper: each segment smaller than previous
    let tapers = true;
    for (let i = 1; i < limb.segments.length - 1; i++) {
      if (limb.segments[i].radius > limb.segments[i-1].radius) tapers = false;
    }
    if (tapers) s += 0.15;
  }

  // 9. Haunches (first rear leg segment) bigger than front leg first segment
  const frontLegs = skel.limbs.filter(l => l.attach === 'chest');
  const rearLegs = skel.limbs.filter(l => l.attach === 'hip');
  if (frontLegs.length && rearLegs.length) {
    const frontR = Math.max(...frontLegs.map(l => l.segments[0].radius));
    const rearR = Math.max(...rearLegs.map(l => l.segments[0].radius));
    if (rearR > frontR) s += 0.4;
  }

  return Math.max(0, s);
}

// -- Combined scoring ------------------------------------------------------
function score(skeleton, refMask, refVProfile, refHProfile, w, h) {
  const { mask } = renderMask(skeleton, w, h);
  const iou = computeIoU(mask, refMask);
  const vp = verticalProfile(mask, w, h);
  const hp = horizontalProfile(mask, w, h);
  const vpSim = profileSimilarity(vp, refVProfile);
  const hpSim = profileSimilarity(hp, refHProfile);
  const structural = structuralScore(skeleton);
  const maxStructural = 5.0; // rough max

  return iou * 0.35 + vpSim * 0.15 + hpSim * 0.15 + (structural / maxStructural) * 0.35;
}

// -- Clone + perturb -------------------------------------------------------
function clone(s) { return JSON.parse(JSON.stringify(s)); }

function perturb(skeleton, temp) {
  const s = clone(skeleton);
  const t = temp;
  const choice = Math.random();

  if (choice < 0.55) {
    // Perturb spine node
    const idx = Math.floor(Math.random() * s.spine.length);
    const node = s.spine[idx];
    const param = Math.random();
    if (param < 0.4) {
      node.x += (Math.random() - 0.5) * 0.03 * t;
      node.x = Math.max(0.03, Math.min(0.85, node.x));
    } else if (param < 0.8) {
      node.y += (Math.random() - 0.5) * 0.03 * t;
      node.y = Math.max(0.25, Math.min(0.55, node.y));
    } else {
      node.radius += (Math.random() - 0.5) * 0.015 * t;
      node.radius = Math.max(0.025, Math.min(0.15, node.radius));
    }
    // Keep ordered
    if (idx > 0 && node.x < s.spine[idx-1].x + 0.04) node.x = s.spine[idx-1].x + 0.04;
    if (idx < s.spine.length-1 && node.x > s.spine[idx+1].x - 0.04) node.x = s.spine[idx+1].x - 0.04;
  } else if (choice < 0.85) {
    // Perturb limb
    const li = Math.floor(Math.random() * s.limbs.length);
    const si = Math.floor(Math.random() * s.limbs[li].segments.length);
    const seg = s.limbs[li].segments[si];
    const param = Math.random();
    if (param < 0.35) {
      seg.x += (Math.random() - 0.5) * 0.02 * t;
      seg.x = Math.max(0.05, Math.min(0.85, seg.x));
    } else if (param < 0.7) {
      seg.y += (Math.random() - 0.5) * 0.03 * t;
      seg.y = Math.max(0.35, Math.min(0.92, seg.y));
    } else {
      seg.radius += (Math.random() - 0.5) * 0.008 * t;
      seg.radius = Math.max(0.005, Math.min(0.05, seg.radius));
    }
    if (si > 0 && seg.y < s.limbs[li].segments[si-1].y + 0.04) seg.y = s.limbs[li].segments[si-1].y + 0.04;
    if (si < s.limbs[li].segments.length-1 && seg.y > s.limbs[li].segments[si+1].y - 0.04) seg.y = s.limbs[li].segments[si+1].y - 0.04;
  } else {
    // Perturb tail
    if (s.tail?.points?.length) {
      const pi = Math.floor(Math.random() * s.tail.points.length);
      s.tail.points[pi].x += (Math.random() - 0.5) * 0.03 * t;
      s.tail.points[pi].y += (Math.random() - 0.5) * 0.03 * t;
      s.tail.points[pi].x = Math.max(0.5, Math.min(1.0, s.tail.points[pi].x));
      s.tail.points[pi].y = Math.max(0.10, Math.min(0.65, s.tail.points[pi].y));
    }
  }
  return s;
}

// ==========================================================================
// Main
// ==========================================================================
async function main() {
  const W = 256, H = Math.round(256 * 4 / 7);

  // Generate clean reference
  console.log('Generating clean rat reference silhouette...');
  const { mask: refMask, canvas: refCanvas } = drawRatReference(W, H);
  writeFileSync(join(__dirname, 'debug-ref-clean.png'), refCanvas.toBuffer('image/png'));
  console.log('Saved debug-ref-clean.png');

  const refVP = verticalProfile(refMask, W, H);
  const refHP = horizontalProfile(refMask, W, H);

  // Starting skeleton (hand-tuned rat proportions)
  let best = {
    spine: [
      { id: 'snout',   x: 0.08, y: 0.46, radius: 0.038 },
      { id: 'head',    x: 0.16, y: 0.42, radius: 0.068 },
      { id: 'neck',    x: 0.24, y: 0.40, radius: 0.048 },
      { id: 'chest',   x: 0.34, y: 0.38, radius: 0.085 },
      { id: 'belly',   x: 0.48, y: 0.40, radius: 0.100 },
      { id: 'hip',     x: 0.62, y: 0.38, radius: 0.090 },
      { id: 'rump',    x: 0.73, y: 0.40, radius: 0.058 },
    ],
    limbs: [
      { attach: 'chest', side: 'near', segments: [
        { x: 0.28, y: 0.52, radius: 0.028 },
        { x: 0.26, y: 0.64, radius: 0.014 },
        { x: 0.24, y: 0.76, radius: 0.010 },
        { x: 0.24, y: 0.84, radius: 0.014 },
      ]},
      { attach: 'chest', side: 'far', segments: [
        { x: 0.34, y: 0.52, radius: 0.022 },
        { x: 0.33, y: 0.64, radius: 0.012 },
        { x: 0.32, y: 0.76, radius: 0.008 },
        { x: 0.32, y: 0.84, radius: 0.012 },
      ]},
      { attach: 'hip', side: 'near', segments: [
        { x: 0.57, y: 0.52, radius: 0.035 },
        { x: 0.56, y: 0.64, radius: 0.016 },
        { x: 0.55, y: 0.76, radius: 0.010 },
        { x: 0.54, y: 0.84, radius: 0.014 },
      ]},
      { attach: 'hip', side: 'far', segments: [
        { x: 0.64, y: 0.52, radius: 0.028 },
        { x: 0.64, y: 0.64, radius: 0.012 },
        { x: 0.64, y: 0.76, radius: 0.008 },
        { x: 0.64, y: 0.84, radius: 0.012 },
      ]},
    ],
    tail: {
      points: [
        { x: 0.75, y: 0.40 },
        { x: 0.82, y: 0.32 },
        { x: 0.90, y: 0.28 },
        { x: 0.94, y: 0.36 },
        { x: 0.92, y: 0.46 },
        { x: 0.88, y: 0.50 },
      ],
      startWidth: 0.014,
      endWidth: 0.003,
    },
  };

  let bestScore = score(best, refMask, refVP, refHP, W, H);
  console.log(`Initial score: ${bestScore.toFixed(4)}`);
  const { canvas: initCanvas } = renderMask(best, W, H);
  writeFileSync(join(__dirname, 'debug-v2-initial.png'), initCanvas.toBuffer('image/png'));

  // Hill climbing — greedy only (no SA randomness that accepts worse moves)
  const ITERS = 5000;
  let improved = 0;

  console.log(`\nRunning ${ITERS} iterations (greedy hill climb)...`);

  for (let iter = 0; iter < ITERS; iter++) {
    const temp = 1.0 - (iter / ITERS) * 0.7; // cool from 1.0 to 0.3
    const candidate = perturb(best, temp);
    const candidateScore = score(candidate, refMask, refVP, refHP, W, H);

    if (candidateScore > bestScore) {
      best = candidate;
      bestScore = candidateScore;
      improved++;
    }

    if (iter % 500 === 0 || iter === ITERS - 1) {
      console.log(`  iter ${iter}  score=${bestScore.toFixed(4)}  improvements=${improved}`);
    }
    if (iter % 1000 === 0) {
      const { canvas: snap } = renderMask(best, W, H);
      writeFileSync(join(__dirname, `debug-v2-iter-${iter}.png`), snap.toBuffer('image/png'));
    }
  }

  // Save final
  const { canvas: finalCanvas } = renderMask(best, W, H);
  writeFileSync(join(__dirname, 'debug-v2-final.png'), finalCanvas.toBuffer('image/png'));

  console.log(`\n=== DONE === score=${bestScore.toFixed(4)} improvements=${improved}/${ITERS}`);
  console.log(JSON.stringify(best, null, 2));
  writeFileSync(join(__dirname, 'optimized-skeleton.json'), JSON.stringify(best, null, 2));
  console.log('\nSaved optimized-skeleton.json');
}

main().catch(console.error);
