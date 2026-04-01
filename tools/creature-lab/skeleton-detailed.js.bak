// ==========================================================================
// Skeleton-based creature system
// Circle-chain spine + tangent-hull outline + limb chains
// ==========================================================================

// -- Contour generation: spine circles → top/bottom outline points ----------
export function computeContour(spine, w, h) {
  const n = spine.length;
  const top = [];
  const bot = [];

  for (let i = 0; i < n; i++) {
    const node = spine[i];
    const cx = w * node.x;
    const cy = h * node.y;
    const r = w * node.radius;

    // Spine direction at this node (average of prev→next)
    let dx, dy;
    if (i === 0) {
      dx = spine[1].x - node.x;
      dy = spine[1].y - node.y;
    } else if (i === n - 1) {
      dx = node.x - spine[n - 2].x;
      dy = node.y - spine[n - 2].y;
    } else {
      dx = spine[i + 1].x - spine[i - 1].x;
      dy = spine[i + 1].y - spine[i - 1].y;
    }

    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    // Perpendicular to spine direction
    const px = -dy / len;
    const py = dx / len;

    top.push({ x: cx + px * r, y: cy + py * r });
    bot.push({ x: cx - px * r, y: cy - py * r });
  }

  return { top, bot };
}

// -- Smooth path through points using Catmull-Rom → cubic bezier -----------
function catmullToBezierCP(p0, p1, p2, p3, tension) {
  const t = tension || 0.35;
  return {
    cp1x: p1.x + (p2.x - p0.x) * t / 3,
    cp1y: p1.y + (p2.y - p0.y) * t / 3,
    cp2x: p2.x - (p3.x - p1.x) * t / 3,
    cp2y: p2.y - (p3.y - p1.y) * t / 3,
  };
}

export function drawSmoothPath(ctx, points, closed) {
  if (points.length < 2) return;
  const n = points.length;

  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);

  for (let i = 0; i < n - 1; i++) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(n - 1, i + 2)];
    const cp = catmullToBezierCP(p0, p1, p2, p3);
    ctx.bezierCurveTo(cp.cp1x, cp.cp1y, cp.cp2x, cp.cp2y, p2.x, p2.y);
  }

  if (closed) ctx.closePath();
}

// -- Draw body outline from spine ------------------------------------------
export function drawBodyOutline(ctx, spine, w, h, fillStyle) {
  const { top, bot } = computeContour(spine, w, h);

  // Build a closed path: top left→right, arc around last circle,
  // bottom right→left, arc around first circle
  const first = spine[0];
  const last = spine[spine.length - 1];

  ctx.beginPath();

  // Start at first top point
  ctx.moveTo(top[0].x, top[0].y);

  // Top contour: left to right
  for (let i = 0; i < top.length - 1; i++) {
    const p0 = top[Math.max(0, i - 1)];
    const p1 = top[i];
    const p2 = top[i + 1];
    const p3 = top[Math.min(top.length - 1, i + 2)];
    const cp = catmullToBezierCP(p0, p1, p2, p3);
    ctx.bezierCurveTo(cp.cp1x, cp.cp1y, cp.cp2x, cp.cp2y, p2.x, p2.y);
  }

  // Arc around the last (rump) circle
  const lastCx = w * last.x;
  const lastCy = h * last.y;
  const lastR = w * last.radius;
  const lastTopAngle = Math.atan2(top[top.length - 1].y - lastCy, top[top.length - 1].x - lastCx);
  const lastBotAngle = Math.atan2(bot[bot.length - 1].y - lastCy, bot[bot.length - 1].x - lastCx);
  ctx.arc(lastCx, lastCy, lastR, lastTopAngle, lastBotAngle, false);

  // Bottom contour: right to left
  for (let i = bot.length - 1; i > 0; i--) {
    const p0 = bot[Math.min(bot.length - 1, i + 1)];
    const p1 = bot[i];
    const p2 = bot[i - 1];
    const p3 = bot[Math.max(0, i - 2)];
    const cp = catmullToBezierCP(p0, p1, p2, p3);
    ctx.bezierCurveTo(cp.cp1x, cp.cp1y, cp.cp2x, cp.cp2y, p2.x, p2.y);
  }

  // Arc around the first (head) circle to close
  const firstCx = w * first.x;
  const firstCy = h * first.y;
  const firstR = w * first.radius;
  const firstBotAngle = Math.atan2(bot[0].y - firstCy, bot[0].x - firstCx);
  const firstTopAngle = Math.atan2(top[0].y - firstCy, top[0].x - firstCx);
  ctx.arc(firstCx, firstCy, firstR, firstBotAngle, firstTopAngle, false);

  ctx.closePath();
  if (fillStyle) {
    ctx.fillStyle = fillStyle;
    ctx.fill();
  }
}

// -- Draw a limb chain (upper → lower → paw) with taper -------------------
export function drawLimbChain(ctx, segments, w, h, color) {
  if (segments.length < 2) return;

  for (let i = 0; i < segments.length - 1; i++) {
    const s0 = segments[i];
    const s1 = segments[i + 1];
    const x0 = w * s0.x, y0 = h * s0.y, r0 = w * s0.radius;
    const x1 = w * s1.x, y1 = h * s1.y, r1 = w * s1.radius;

    const dx = x1 - x0, dy = y1 - y0;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    const px = -dy / len, py = dx / len;

    // Trapezoid connecting two circles
    ctx.beginPath();
    ctx.moveTo(x0 + px * r0, y0 + py * r0);
    ctx.lineTo(x1 + px * r1, y1 + py * r1);
    ctx.lineTo(x1 - px * r1, y1 - py * r1);
    ctx.lineTo(x0 - px * r0, y0 - py * r0);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();

    // Circles at joints for smooth junctions
    ctx.beginPath();
    ctx.arc(x0, y0, r0, 0, Math.PI * 2);
    ctx.fill();
  }
  // Final circle at end
  const last = segments[segments.length - 1];
  ctx.beginPath();
  ctx.arc(w * last.x, h * last.y, w * last.radius, 0, Math.PI * 2);
  ctx.fill();
}

// -- Draw tapered tail as a bezier stroke ----------------------------------
export function drawTail(ctx, points, startWidth, endWidth, w, h, color) {
  if (points.length < 2) return;
  const n = points.length;

  // Draw as a series of tapered segments
  for (let i = 0; i < n - 1; i++) {
    const t0 = i / (n - 1);
    const t1 = (i + 1) / (n - 1);
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
    ctx.fillStyle = color;
    ctx.fill();

    ctx.beginPath();
    ctx.arc(x0, y0, r0, 0, Math.PI * 2);
    ctx.fill();
  }
  const last = points[n - 1];
  ctx.beginPath();
  ctx.arc(w * last.x, h * last.y, w * endWidth, 0, Math.PI * 2);
  ctx.fill();
}

// -- Debug: draw skeleton circles ------------------------------------------
export function drawDebugSkeleton(ctx, skeleton, w, h) {
  ctx.strokeStyle = 'rgba(0,255,0,0.4)';
  ctx.lineWidth = 1;
  for (const node of skeleton.spine) {
    ctx.beginPath();
    ctx.arc(w * node.x, h * node.y, w * node.radius, 0, Math.PI * 2);
    ctx.stroke();
  }
  // Limbs
  ctx.strokeStyle = 'rgba(0,150,255,0.4)';
  for (const limb of skeleton.limbs) {
    for (const seg of limb.segments) {
      ctx.beginPath();
      ctx.arc(w * seg.x, h * seg.y, w * seg.radius, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
  // Spine line
  ctx.strokeStyle = 'rgba(255,255,0,0.3)';
  ctx.beginPath();
  for (let i = 0; i < skeleton.spine.length; i++) {
    const s = skeleton.spine[i];
    i === 0 ? ctx.moveTo(w * s.x, h * s.y) : ctx.lineTo(w * s.x, h * s.y);
  }
  ctx.stroke();
}

// -- The Dire Rat skeleton --------------------------------------------------
// Reference: Hunched dark blob, head thrust low-forward, arched back,
// haunches invisible (merged into body mass), only thin lower legs visible.
// Compact and round, NOT elongated. Think "angry dark boulder with a face."
export const direRatSkeleton = {
  spine: [
    // FULLY CROUCHED — belly near ground, stubby legs, head low
    { id: 'snout',   x: 0.10, y: 0.70, radius: 0.025 },
    { id: 'head',    x: 0.16, y: 0.64, radius: 0.065 },
    { id: 'neck',    x: 0.26, y: 0.56, radius: 0.074 },
    { id: 'chest',   x: 0.38, y: 0.48, radius: 0.120 },
    { id: 'belly',   x: 0.52, y: 0.44, radius: 0.140 },
    { id: 'hip',     x: 0.64, y: 0.48, radius: 0.125 },
    { id: 'rump',    x: 0.72, y: 0.56, radius: 0.058 },
  ],
  limbs: [
    // Near front leg — stubby, crouched, paw reaching forward
    { attach: 'chest', side: 'near', segments: [
      { x: 0.26, y: 0.62, radius: 0.040 },  // shoulder — in body
      { x: 0.20, y: 0.70, radius: 0.018 },  // elbow
      { x: 0.16, y: 0.76, radius: 0.012 },  // forearm
      { x: 0.14, y: 0.84, radius: 0.018 },  // paw
    ]},
    // Far front leg
    { attach: 'chest', side: 'far', segments: [
      { x: 0.34, y: 0.60, radius: 0.032 },
      { x: 0.28, y: 0.68, radius: 0.014 },
      { x: 0.24, y: 0.76, radius: 0.010 },
      { x: 0.23, y: 0.84, radius: 0.014 },
    ]},
    // Near rear leg — stubby zig-zag, compressed
    { attach: 'hip', side: 'near', segments: [
      { x: 0.58, y: 0.48, radius: 0.100 },  // haunch — hidden in body
      { x: 0.60, y: 0.60, radius: 0.026 },  // thigh emerges back
      { x: 0.65, y: 0.70, radius: 0.013 },  // knee — behind
      { x: 0.59, y: 0.78, radius: 0.010 },  // shin — forward
      { x: 0.55, y: 0.84, radius: 0.016 },  // paw
    ]},
    // Far rear leg
    { attach: 'hip', side: 'far', segments: [
      { x: 0.66, y: 0.48, radius: 0.085 },  // haunch — hidden
      { x: 0.68, y: 0.60, radius: 0.020 },  // thigh
      { x: 0.72, y: 0.70, radius: 0.011 },  // knee — behind
      { x: 0.68, y: 0.78, radius: 0.008 },  // shin
      { x: 0.66, y: 0.84, radius: 0.013 },  // paw
    ]},
  ],
  tail: {
    points: [
      { x: 0.74, y: 0.58 },
      { x: 0.82, y: 0.50 },
      { x: 0.90, y: 0.48 },
      { x: 0.94, y: 0.56 },
      { x: 0.93, y: 0.66 },
      { x: 0.88, y: 0.72 },
    ],
    startWidth: 0.018,
    endWidth: 0.003,
  },
};

// -- Full creature render from skeleton (flat color) -----------------------
export function drawCreatureFromSkeleton(ctx, skeleton, w, h, palette) {
  const {
    furDark = 'rgb(28,20,16)',
    furMid = 'rgb(52,38,28)',
    furShadow = 'rgb(14,10,8)',
    skinDark = 'rgb(48,28,24)',
  } = palette || {};

  // 1. Tail (behind everything)
  if (skeleton.tail) {
    drawTail(ctx, skeleton.tail.points,
      skeleton.tail.startWidth, skeleton.tail.endWidth,
      w, h, skinDark);
  }

  // 2. Far limbs (behind body)
  for (const limb of skeleton.limbs) {
    if (limb.side === 'far') {
      drawLimbChain(ctx, limb.segments, w, h, furShadow);
    }
  }

  // 3. Body
  drawBodyOutline(ctx, skeleton.spine, w, h, furMid);

  // 4. Near limbs (in front of body)
  for (const limb of skeleton.limbs) {
    if (limb.side === 'near') {
      drawLimbChain(ctx, limb.segments, w, h, furDark);
    }
  }
}

// -- Lookup a spine node by id ---------------------------------------------
function spineNode(skeleton, id) {
  return skeleton.spine.find(n => n.id === id);
}

// -- Detailed creature render (skeleton body + painted detail layers) -------
// Uses skeleton for body silhouette, limbs, tail positioning,
// then layers fur, lighting, eyes, teeth, ears, hackles on top.
export function drawDetailedCreature(ctx, skeleton, w, h, helpers) {
  const {
    setSeed: _setSeed, rand: _rand,
    fillEllipse: _fillEllipse, fillCircle: _fillCircle,
    organicEllipse: _organicEllipse,
    bodyGradHueShift: _bodyGradHueShift,
    furTextureDirectional: _furTextureDirectional,
    ambientOcclusion: _ao, highlight: _highlight,
    sssEdgeGlow: _sssEdgeGlow,
    seed,
  } = helpers;

  _setSeed(seed);

  // Palette
  const furDark = [28, 20, 16];
  const furMid = [52, 38, 28];
  const furLight = [82, 62, 44];
  const furShadow = [14, 10, 8];
  const skinDark = [48, 28, 24];
  const skinMid = [72, 42, 36];
  const skinLight = [95, 58, 48];
  const eyeGlow = [220, 60, 30];
  const eyeCore = [255, 120, 40];
  const teethColor = [240, 230, 210];
  const earPink = [160, 70, 80];
  const noseWet = [140, 70, 65];

  // Spine landmarks
  const snout = spineNode(skeleton, 'snout');
  const head = spineNode(skeleton, 'head');
  const neck = spineNode(skeleton, 'neck');
  const chest = spineNode(skeleton, 'chest');
  const belly = spineNode(skeleton, 'belly');
  const hip = spineNode(skeleton, 'hip');
  const rump = spineNode(skeleton, 'rump');

  // === TAIL ===
  if (skeleton.tail) {
    const tp = skeleton.tail.points;
    // Thick base
    ctx.strokeStyle = `rgb(${skinDark.join(',')})`;
    ctx.lineCap = 'round'; ctx.lineWidth = w * 0.018;
    ctx.beginPath();
    ctx.moveTo(w * tp[0].x, h * tp[0].y);
    ctx.bezierCurveTo(w * tp[1].x, h * tp[1].y, w * tp[2].x, h * tp[2].y, w * tp[3].x, h * tp[3].y);
    ctx.stroke();
    // Mid-section
    ctx.strokeStyle = `rgb(${skinMid.join(',')})`;
    ctx.lineWidth = w * 0.012;
    ctx.beginPath();
    ctx.moveTo(w * tp[3].x, h * tp[3].y);
    ctx.bezierCurveTo(w * (tp[3].x + 0.02), h * (tp[3].y + 0.06), w * tp[4].x, h * tp[4].y, w * tp[5].x, h * tp[5].y);
    ctx.stroke();
    // Thin tip
    ctx.lineWidth = w * 0.006;
    ctx.beginPath();
    ctx.moveTo(w * tp[5].x, h * tp[5].y);
    ctx.quadraticCurveTo(w * (tp[5].x - 0.04), h * (tp[5].y + 0.08), w * (tp[5].x - 0.06), h * (tp[5].y + 0.06));
    ctx.stroke();
    // Top-edge highlight
    ctx.strokeStyle = `rgba(${skinLight.join(',')},0.22)`;
    ctx.lineWidth = w * 0.004;
    ctx.beginPath();
    ctx.moveTo(w * tp[0].x, h * (tp[0].y - 0.02));
    ctx.bezierCurveTo(w * tp[1].x, h * (tp[1].y - 0.02), w * tp[2].x, h * (tp[2].y - 0.02), w * tp[3].x, h * (tp[3].y - 0.02));
    ctx.stroke();
  }

  // === FAR LIMBS (behind body) ===
  for (const limb of skeleton.limbs) {
    if (limb.side === 'far') {
      drawLimbChain(ctx, limb.segments, w, h, `rgb(${furShadow.join(',')})`);
    }
  }

  // === BODY — skeleton-derived outline with gradient fill ===
  const bodyFill = _bodyGradHueShift(ctx, w * belly.x, h * belly.y, w * 0.30,
    furMid[0], furMid[1], furMid[2],
    furShadow[0], furShadow[1], furShadow[2],
    furLight[0], furLight[1], furLight[2]
  );
  drawBodyOutline(ctx, skeleton.spine, w, h, bodyFill);

  // Haunch bulge — muscular rear
  ctx.fillStyle = _bodyGradHueShift(ctx, w * hip.x, h * hip.y, w * 0.12,
    furMid[0], furMid[1], furMid[2],
    furShadow[0], furShadow[1], furShadow[2],
    furLight[0], furLight[1], furLight[2]
  );
  _fillEllipse(ctx, w * hip.x, h * (hip.y + 0.02), w * hip.radius * 1.1, h * 0.14);

  // Shoulder hump
  _highlight(ctx, w * (chest.x + 0.04), h * (chest.y - 0.08), w * 0.05, `rgb(${furLight.join(',')})`, 0.12);

  // Side lighting
  ctx.save();
  ctx.globalCompositeOperation = 'overlay'; ctx.globalAlpha = 0.12;
  const sideGrad = ctx.createLinearGradient(w * 0.10, h * 0.15, w * 0.85, h * 0.75);
  sideGrad.addColorStop(0, 'rgb(140,120,90)');
  sideGrad.addColorStop(0.35, 'rgba(60,50,40,0)');
  sideGrad.addColorStop(1, 'rgb(5,3,2)');
  ctx.fillStyle = sideGrad;
  ctx.fillRect(w * snout.x, h * 0.15, w * (rump.x - snout.x), h * 0.65);
  ctx.restore();

  // AO under belly and at joints
  _ao(ctx, w * belly.x, h * (belly.y + belly.radius * 5), w * 0.16, h * 0.04, 0.35);
  _ao(ctx, w * neck.x, h * (neck.y + 0.08), w * 0.05, h * 0.06, 0.30);
  _ao(ctx, w * hip.x, h * (hip.y + 0.10), w * 0.06, h * 0.06, 0.28);

  // === FUR ===
  const spineMinY = Math.min(...skeleton.spine.map(n => n.y - n.radius));
  // Spine fur
  _furTextureDirectional(ctx, w * neck.x, h * (spineMinY - 0.02), w * (hip.x - neck.x), h * 0.18, w * 0.022,
    `rgb(${furShadow.join(',')})`, `rgb(${furLight.join(',')})`, 60,
    (fx, fy) => { const t = (fx - w * neck.x) / (w * (hip.x - neck.x)); return -0.5 + t * 0.4; }
  );
  // Belly fur
  _furTextureDirectional(ctx, w * chest.x, h * (belly.y + 0.06), w * (hip.x - chest.x - 0.04), h * 0.12, w * 0.014,
    `rgb(${furShadow.join(',')})`, `rgb(${furMid.join(',')})`, 35, () => 0.6
  );
  // Haunch fur
  _furTextureDirectional(ctx, w * (hip.x - 0.10), h * (hip.y - 0.08), w * 0.20, h * 0.24, w * 0.018,
    `rgb(${furShadow.join(',')})`, `rgb(${furMid.join(',')})`, 40,
    (fx, fy) => Math.atan2(fy - h * hip.y, fx - w * hip.x) + 0.3
  );

  // SSS warm edge
  _sssEdgeGlow(ctx, w * belly.x, h * belly.y, w * 0.28, h * 0.20, 0.08);

  // === NEAR LIMBS (in front of body) ===
  for (const limb of skeleton.limbs) {
    if (limb.side === 'near') {
      drawLimbChain(ctx, limb.segments, w, h, `rgb(${furDark.join(',')})`);
    }
  }

  // === PAWS + CLAWS ===
  const allPaws = skeleton.limbs.map(l => {
    const paw = l.segments[l.segments.length - 1];
    return { x: paw.x, y: paw.y, r: paw.radius, near: l.side === 'near' };
  });
  for (const p of allPaws) {
    ctx.globalAlpha = p.near ? 1.0 : 0.75;
    ctx.fillStyle = `rgb(${skinDark.join(',')})`;
    _organicEllipse(ctx, w * p.x, h * p.y, w * (p.r + 0.006), h * 0.013, p.x * 100, 0.1);
    ctx.fill();
    // Claws
    ctx.fillStyle = 'rgb(200,190,170)';
    for (let c = -1; c <= 1; c++) {
      const clawX = w * p.x + c * w * 0.009;
      ctx.beginPath();
      ctx.moveTo(clawX, h * p.y + h * 0.005);
      ctx.quadraticCurveTo(clawX - w * 0.006, h * p.y + h * 0.038, clawX - w * 0.002, h * p.y + h * 0.042);
      ctx.quadraticCurveTo(clawX + w * 0.003, h * p.y + h * 0.028, clawX, h * p.y + h * 0.005);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1.0;

  // === HEAD ===
  // Skeleton nodes: snout (0.094, 0.489 r=0.025), head (0.135, 0.443 r=0.064)
  const hx = head.x, hy = head.y, hr = head.radius;
  const sx = snout.x, sy = snout.y;
  // Midpoint between head center and snout — anchor for facial features
  const faceMidX = (hx + sx) / 2;
  const faceMidY = (hy + sy) / 2;

  // Skull — compact, wraps tightly around head+snout nodes
  ctx.fillStyle = _bodyGradHueShift(ctx, w * hx, h * hy, w * (hr * 2),
    furMid[0], furMid[1], furMid[2],
    furShadow[0], furShadow[1], furShadow[2],
    furLight[0], furLight[1], furLight[2]
  );
  ctx.beginPath();
  // Start at back-top of skull
  ctx.moveTo(w * (hx + hr * 0.8), h * (hy - hr * 0.6));
  // Brow — forward over eyes
  ctx.bezierCurveTo(w * (hx + hr * 0.2), h * (hy - hr * 1.2), w * (sx + 0.03), h * (hy - hr * 0.8), w * (sx - 0.01), h * (hy - 0.02));
  // Down to snout tip
  ctx.bezierCurveTo(w * (sx - 0.04), h * sy, w * (sx - 0.05), h * (sy + 0.03), w * (sx - 0.04), h * (sy + 0.06));
  // Jaw — curves back under head
  ctx.bezierCurveTo(w * (sx - 0.01), h * (sy + 0.12), w * (hx), h * (hy + hr * 1.4), w * (hx + hr * 0.6), h * (hy + hr * 0.8));
  // Back of head — returns to top
  ctx.bezierCurveTo(w * (hx + hr * 1.0), h * (hy + hr * 0.3), w * (hx + hr * 1.0), h * (hy - hr * 0.2), w * (hx + hr * 0.8), h * (hy - hr * 0.6));
  ctx.fill();

  // Head fur — tighter zone
  _furTextureDirectional(ctx, w * (sx - 0.03), h * (hy - hr), w * (hr * 2 + 0.04), h * (hr * 2 + 0.08), w * 0.012,
    `rgb(${furShadow.join(',')})`, `rgb(${furMid.join(',')})`, 30,
    (fx, fy) => Math.atan2(fy - h * hy, fx - w * hx) + 0.5
  );

  // Brow shadow — above the eyes
  _ao(ctx, w * faceMidX, h * (hy - hr * 0.3), w * 0.06, h * 0.02, 0.30);

  // Snout — small, dark, at snout node
  ctx.fillStyle = `rgb(${skinDark.join(',')})`;
  ctx.beginPath();
  ctx.moveTo(w * sx, h * (sy - 0.02));
  ctx.bezierCurveTo(w * (sx - 0.03), h * (sy - 0.02), w * (sx - 0.05), h * sy, w * (sx - 0.045), h * (sy + 0.03));
  ctx.bezierCurveTo(w * (sx - 0.03), h * (sy + 0.05), w * (sx + 0.01), h * (sy + 0.05), w * (sx + 0.02), h * (sy + 0.03));
  ctx.closePath(); ctx.fill();
  _highlight(ctx, w * (sx - 0.025), h * (sy - 0.01), w * 0.015, `rgb(${skinLight.join(',')})`, 0.12);

  // Mouth cavity — tight snarl under snout
  ctx.fillStyle = 'rgb(15,5,5)';
  ctx.beginPath();
  ctx.moveTo(w * (sx - 0.045), h * (sy + 0.03));
  ctx.bezierCurveTo(w * (sx - 0.055), h * (sy + 0.05), w * (sx - 0.03), h * (sy + 0.09), w * (sx + 0.02), h * (sy + 0.08));
  ctx.bezierCurveTo(w * (sx + 0.01), h * (sy + 0.06), w * (sx - 0.02), h * (sy + 0.04), w * (sx - 0.045), h * (sy + 0.03));
  ctx.fill();
  // Upper gum
  ctx.fillStyle = 'rgb(90,25,25)';
  ctx.beginPath();
  ctx.moveTo(w * (sx - 0.04), h * (sy + 0.035));
  ctx.quadraticCurveTo(w * (sx - 0.01), h * (sy + 0.03), w * (sx + 0.015), h * (sy + 0.05));
  ctx.quadraticCurveTo(w * (sx - 0.01), h * (sy + 0.04), w * (sx - 0.04), h * (sy + 0.035));
  ctx.fill();

  // Teeth — proportional to snout, not oversized
  ctx.fillStyle = `rgb(${teethColor.join(',')})`;
  // Upper left fang
  ctx.beginPath();
  ctx.moveTo(w * (sx - 0.03), h * (sy + 0.03));
  ctx.lineTo(w * (sx - 0.038), h * (sy + 0.08));
  ctx.lineTo(w * (sx - 0.02), h * (sy + 0.035));
  ctx.fill();
  // Upper right fang
  ctx.beginPath();
  ctx.moveTo(w * (sx + 0.005), h * (sy + 0.035));
  ctx.lineTo(w * (sx - 0.003), h * (sy + 0.08));
  ctx.lineTo(w * (sx + 0.015), h * (sy + 0.05));
  ctx.fill();
  // Small teeth between
  ctx.fillStyle = 'rgb(225,215,195)';
  ctx.beginPath();
  ctx.moveTo(w * (sx - 0.015), h * (sy + 0.035));
  ctx.lineTo(w * (sx - 0.02), h * (sy + 0.065));
  ctx.lineTo(w * (sx - 0.008), h * (sy + 0.04));
  ctx.fill();
  // Lower fangs — small, pointing up
  ctx.fillStyle = `rgb(${teethColor.join(',')})`;
  ctx.beginPath();
  ctx.moveTo(w * (sx - 0.025), h * (sy + 0.065));
  ctx.lineTo(w * (sx - 0.03), h * (sy + 0.04));
  ctx.lineTo(w * (sx - 0.015), h * (sy + 0.06));
  ctx.fill();

  // Nose — at tip of snout
  ctx.fillStyle = `rgb(${noseWet.join(',')})`;
  _organicEllipse(ctx, w * (sx - 0.04), h * (sy + 0.01), w * 0.012, w * 0.010, 42, 0.08);
  ctx.fill();
  _highlight(ctx, w * (sx - 0.043), h * sy, w * 0.004, 'rgb(255,240,230)', 0.40);

  // === EYES — beady, bright but small ===
  // Near eye — on the head node, slightly forward-up
  const eyeX = hx - 0.015, eyeY = hy - 0.015;
  // Socket shadow
  _ao(ctx, w * eyeX, h * eyeY, w * 0.018, w * 0.015, 0.35);
  // Outer glow — subtle
  ctx.save(); ctx.globalAlpha = 0.20;
  ctx.fillStyle = `rgb(${eyeGlow.join(',')})`;
  _fillCircle(ctx, w * eyeX, h * eyeY, w * 0.016);
  ctx.restore();
  // Iris — small
  ctx.fillStyle = `rgb(${eyeGlow.join(',')})`;
  _fillCircle(ctx, w * eyeX, h * eyeY, w * 0.010);
  // Core — hot center
  ctx.fillStyle = `rgb(${eyeCore.join(',')})`;
  _fillCircle(ctx, w * eyeX, h * eyeY, w * 0.006);
  // Pupil slit
  ctx.fillStyle = 'rgb(10,2,2)';
  ctx.beginPath();
  ctx.ellipse(w * (eyeX + 0.001), h * eyeY, w * 0.002, w * 0.007, 0, 0, Math.PI * 2);
  ctx.fill();
  // Speculars — tiny but sharp
  ctx.fillStyle = 'rgb(255,255,255)';
  _fillCircle(ctx, w * (eyeX - 0.004), h * (eyeY - 0.004), w * 0.003);
  ctx.fillStyle = 'rgba(255,250,240,0.5)';
  _fillCircle(ctx, w * (eyeX + 0.005), h * (eyeY + 0.004), w * 0.002);

  // Far eye — smaller, dimmer, partially hidden
  const farEyeX = faceMidX - 0.025, farEyeY = faceMidY - 0.04;
  ctx.save(); ctx.globalAlpha = 0.5;
  ctx.fillStyle = `rgba(${eyeGlow.join(',')},0.15)`;
  _fillCircle(ctx, w * farEyeX, h * farEyeY, w * 0.010);
  ctx.fillStyle = `rgb(${eyeGlow[0] - 40},${eyeGlow[1] - 20},${eyeGlow[2]})`;
  _fillCircle(ctx, w * farEyeX, h * farEyeY, w * 0.007);
  ctx.fillStyle = 'rgb(10,2,2)';
  ctx.beginPath();
  ctx.ellipse(w * farEyeX, h * farEyeY, w * 0.001, w * 0.005, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  _fillCircle(ctx, w * (farEyeX - 0.003), h * (farEyeY - 0.003), w * 0.002);
  ctx.restore();

  // === EARS — small, round, laid-back rat ears ===
  const earBase = hy - hr * 0.7;  // Sits on top of skull
  // Near ear — round nub, tilted back
  ctx.fillStyle = `rgb(${furDark.join(',')})`;
  ctx.beginPath();
  ctx.moveTo(w * (hx + 0.04), h * earBase);
  ctx.bezierCurveTo(w * (hx + 0.05), h * (earBase - 0.04), w * (hx + 0.08), h * (earBase - 0.055), w * (hx + 0.10), h * (earBase - 0.045));
  ctx.bezierCurveTo(w * (hx + 0.10), h * (earBase - 0.02), w * (hx + 0.08), h * (earBase + 0.005), w * (hx + 0.06), h * (earBase + 0.01));
  ctx.closePath(); ctx.fill();
  // Ear interior — subtle pink
  ctx.fillStyle = `rgba(${earPink.join(',')},0.7)`;
  ctx.beginPath();
  ctx.moveTo(w * (hx + 0.055), h * (earBase - 0.005));
  ctx.bezierCurveTo(w * (hx + 0.06), h * (earBase - 0.03), w * (hx + 0.08), h * (earBase - 0.04), w * (hx + 0.09), h * (earBase - 0.035));
  ctx.bezierCurveTo(w * (hx + 0.09), h * (earBase - 0.015), w * (hx + 0.075), h * (earBase + 0.002), w * (hx + 0.06), h * (earBase + 0.005));
  ctx.closePath(); ctx.fill();

  // Far ear — smaller, darker
  ctx.fillStyle = `rgb(${furShadow.join(',')})`;
  ctx.beginPath();
  ctx.moveTo(w * (hx - 0.01), h * (earBase + 0.005));
  ctx.bezierCurveTo(w * (hx - 0.01), h * (earBase - 0.03), w * (hx + 0.01), h * (earBase - 0.05), w * (hx + 0.03), h * (earBase - 0.04));
  ctx.bezierCurveTo(w * (hx + 0.03), h * (earBase - 0.02), w * (hx + 0.015), h * (earBase + 0.005), w * (hx - 0.005), h * (earBase + 0.01));
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = `rgba(${earPink.join(',')},0.35)`;
  ctx.beginPath();
  ctx.moveTo(w * (hx + 0.00), h * (earBase));
  ctx.bezierCurveTo(w * (hx + 0.00), h * (earBase - 0.02), w * (hx + 0.015), h * (earBase - 0.035), w * (hx + 0.025), h * (earBase - 0.03));
  ctx.bezierCurveTo(w * (hx + 0.025), h * (earBase - 0.015), w * (hx + 0.012), h * (earBase + 0.002), w * (hx + 0.003), h * (earBase + 0.005));
  ctx.closePath(); ctx.fill();

  // === WHISKERS — from snout, short ===
  ctx.strokeStyle = 'rgba(120,100,80,0.35)'; ctx.lineWidth = w * 0.002; ctx.lineCap = 'round';
  for (const [dx, dy] of [[-0.03, -0.005], [-0.03, 0.01], [-0.03, 0.025]]) {
    const bx = sx + dx, by = sy + dy;
    const droop = _rand() * 0.015;
    ctx.beginPath(); ctx.moveTo(w * bx, h * by);
    ctx.quadraticCurveTo(w * (bx - 0.03), h * (by - 0.005 + droop), w * (bx - 0.05), h * (by + droop)); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(w * (bx + 0.01), h * (by - 0.005));
    ctx.quadraticCurveTo(w * (bx - 0.015), h * (by - 0.02 + droop), w * (bx - 0.035), h * (by - 0.015 + droop)); ctx.stroke();
  }

  // === HACKLES ===
  ctx.fillStyle = `rgb(${furDark.join(',')})`;
  const spineNodes = skeleton.spine;
  for (let i = 0; i < 18; i++) {
    const t = i / 18;
    // Interpolate along spine (skip snout, start from neck)
    const spineT = 2 + t * (spineNodes.length - 3);  // neck → rump
    const idx = Math.floor(spineT);
    const frac = spineT - idx;
    const n0 = spineNodes[Math.min(idx, spineNodes.length - 1)];
    const n1 = spineNodes[Math.min(idx + 1, spineNodes.length - 1)];
    const hkX = w * (n0.x + (n1.x - n0.x) * frac);
    const hkY = h * (n0.y + (n1.y - n0.y) * frac - (n0.radius + (n1.radius - n0.radius) * frac));
    const hLen = w * (0.016 + _rand() * 0.012);
    const angle = -1.3 + t * 0.5 + (_rand() - 0.5) * 0.3;
    ctx.beginPath();
    ctx.moveTo(hkX - w * 0.004, hkY);
    ctx.lineTo(hkX + Math.cos(angle) * hLen, hkY + Math.sin(angle) * hLen);
    ctx.lineTo(hkX + w * 0.004, hkY); ctx.fill();
  }
  // Hackle tip highlights
  ctx.fillStyle = `rgba(${furLight.join(',')},0.3)`;
  _setSeed(seed); // Reset for consistent placement
  for (let i = 0; i < 10; i++) {
    _rand(); _rand(); // Skip to match hackle positions
    const t = i / 10;
    const spineT = 2 + t * (spineNodes.length - 3);
    const idx = Math.floor(spineT);
    const frac = spineT - idx;
    const n0 = spineNodes[Math.min(idx, spineNodes.length - 1)];
    const n1 = spineNodes[Math.min(idx + 1, spineNodes.length - 1)];
    const hkX = w * (n0.x + (n1.x - n0.x) * frac);
    const hkY = h * (n0.y + (n1.y - n0.y) * frac - (n0.radius + (n1.radius - n0.radius) * frac));
    _fillCircle(ctx, hkX, hkY - w * 0.007, w * 0.003);
  }

  // === GROUND SHADOW ===
  ctx.save();
  ctx.globalCompositeOperation = 'multiply';
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  _fillEllipse(ctx, w * belly.x, h * 0.90, w * 0.30, h * 0.025);
  ctx.restore();
}
