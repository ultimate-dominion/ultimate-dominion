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

// -- The Dire Rat skeleton -------------------------------------------------
export const direRatSkeleton = {
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
    // Near front leg (visible, forward)
    { attach: 'chest', side: 'near', segments: [
      { x: 0.30, y: 0.52, radius: 0.030 },  // shoulder (overlaps body)
      { x: 0.27, y: 0.64, radius: 0.016 },  // forearm
      { x: 0.25, y: 0.76, radius: 0.012 },  // lower
      { x: 0.24, y: 0.84, radius: 0.016 },  // paw
    ]},
    // Far front leg (behind, slightly offset)
    { attach: 'chest', side: 'far', segments: [
      { x: 0.35, y: 0.52, radius: 0.025 },
      { x: 0.34, y: 0.64, radius: 0.013 },
      { x: 0.33, y: 0.76, radius: 0.010 },
      { x: 0.33, y: 0.84, radius: 0.013 },
    ]},
    // Near rear leg (visible, powerful haunch)
    { attach: 'hip', side: 'near', segments: [
      { x: 0.58, y: 0.52, radius: 0.038 },  // haunch (BIG, overlaps body)
      { x: 0.56, y: 0.64, radius: 0.018 },  // shin
      { x: 0.55, y: 0.76, radius: 0.012 },  // lower
      { x: 0.54, y: 0.84, radius: 0.016 },  // paw
    ]},
    // Far rear leg
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

// -- Full creature render from skeleton ------------------------------------
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
