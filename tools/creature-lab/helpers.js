// ==========================================================================
// Shared drawing helpers — ported from monsterTemplates.ts
// ==========================================================================

// -- Seeded PRNG (mulberry32) for reproducible randomness ------------------
let _seed = 0;
export function setSeed(s) { _seed = s; }
export function rand() {
  _seed |= 0;
  _seed = (_seed + 0x6D2B79F5) | 0;
  let t = Math.imul(_seed ^ (_seed >>> 15), 1 | _seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
export function randRange(a, b) { return a + rand() * (b - a); }

// -- Basic shapes ----------------------------------------------------------
export function fillEllipse(ctx, cx, cy, rx, ry) {
  ctx.beginPath();
  ctx.ellipse(cx, cy, Math.max(1, rx), Math.max(1, ry), 0, 0, Math.PI * 2);
  ctx.fill();
}

export function fillCircle(ctx, cx, cy, r) {
  fillEllipse(ctx, cx, cy, r, r);
}

// -- Organic shape (perturbed ellipse) ------------------------------------
export function organicEllipse(ctx, cx, cy, rx, ry, seed = 0, amp = 0.06) {
  ctx.beginPath();
  const steps = 64;
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * Math.PI * 2;
    // Two-frequency noise for natural wobble
    const n = Math.sin(a * 3 + seed) * 0.4 + Math.sin(a * 7 + seed * 2.3) * 0.3 + Math.sin(a * 13 + seed * 0.7) * 0.3;
    const r = 1 + n * amp;
    const x = cx + Math.cos(a) * rx * r;
    const y = cy + Math.sin(a) * ry * r;
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  }
  ctx.closePath();
}

// -- Gradients -------------------------------------------------------------
export function bodyGrad(ctx, cx, cy, r, coreR, coreG, coreB, midR, midG, midB) {
  const mR = midR ?? Math.floor(coreR * 0.9);
  const mG = midG ?? Math.floor(coreG * 0.9);
  const mB = midB ?? Math.floor(coreB * 0.9);
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
  g.addColorStop(0, `rgb(${coreR},${coreG},${coreB})`);
  g.addColorStop(0.4, `rgb(${mR},${mG},${mB})`);
  g.addColorStop(0.7, `rgb(${Math.floor(coreR * 0.70)},${Math.floor(coreG * 0.70)},${Math.floor(coreB * 0.70)})`);
  g.addColorStop(0.85, `rgb(${Math.floor(coreR * 0.50)},${Math.floor(coreG * 0.50)},${Math.floor(coreB * 0.50)})`);
  g.addColorStop(1, `rgb(${Math.floor(coreR * 0.30)},${Math.floor(coreG * 0.30)},${Math.floor(coreB * 0.30)})`);
  return g;
}

export function bodyGradHueShift(ctx, cx, cy, r, coreR, coreG, coreB, shadowR, shadowG, shadowB, highR, highG, highB) {
  const hR = highR ?? Math.min(255, coreR + 30);
  const hG = highG ?? Math.min(255, coreG + 10);
  const hB = highB ?? Math.max(0, coreB - 15);
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
  g.addColorStop(0, `rgb(${hR},${hG},${hB})`);
  g.addColorStop(0.25, `rgb(${coreR},${coreG},${coreB})`);
  g.addColorStop(0.50, `rgb(${Math.floor(coreR * 0.85 + shadowR * 0.15)},${Math.floor(coreG * 0.85 + shadowG * 0.15)},${Math.floor(coreB * 0.85 + shadowB * 0.15)})`);
  g.addColorStop(0.75, `rgb(${Math.floor(coreR * 0.5 + shadowR * 0.5)},${Math.floor(coreG * 0.5 + shadowG * 0.5)},${Math.floor(coreB * 0.5 + shadowB * 0.5)})`);
  g.addColorStop(1, `rgb(${shadowR},${shadowG},${shadowB})`);
  return g;
}

// -- Texture helpers -------------------------------------------------------
export function furTexture(ctx, x, y, w, h, strokeLen, darkColor, lightColor, count, direction = 0) {
  for (let i = 0; i < count; i++) {
    const fx = x + rand() * w;
    const fy = y + rand() * h;
    const angle = direction + (rand() - 0.5) * 0.8;
    const len = strokeLen * (0.6 + rand() * 0.8);
    const isLight = rand() < 0.3;
    ctx.strokeStyle = isLight ? lightColor : darkColor;
    ctx.lineWidth = strokeLen * 0.15;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(fx, fy);
    const midX = fx + Math.sin(angle) * len * 0.5 + (rand() - 0.5) * len * 0.3;
    const midY = fy + Math.cos(angle) * len * 0.5;
    ctx.quadraticCurveTo(midX, midY, fx + Math.sin(angle) * len, fy + Math.cos(angle) * len);
    ctx.stroke();
  }
}

// -- Form-following fur (new) — strokes follow a direction field -----------
export function furTextureDirectional(ctx, x, y, w, h, strokeLen, darkColor, lightColor, count, directionFn) {
  for (let i = 0; i < count; i++) {
    const fx = x + rand() * w;
    const fy = y + rand() * h;
    // Direction comes from a function of position — follows the body form
    const baseAngle = directionFn(fx, fy);
    const angle = baseAngle + (rand() - 0.5) * 0.5;
    const len = strokeLen * (0.5 + rand() * 1.0);
    const isLight = rand() < 0.25;

    // Multi-bristle: 3-5 sub-strokes per fur mark
    const bristles = 3 + Math.floor(rand() * 3);
    for (let b = 0; b < bristles; b++) {
      const offsetPerp = (rand() - 0.5) * strokeLen * 0.3;
      const perpX = Math.cos(angle + Math.PI / 2) * offsetPerp;
      const perpY = Math.sin(angle + Math.PI / 2) * offsetPerp;
      const bx = fx + perpX;
      const by = fy + perpY;

      // Vary brightness per bristle
      const bright = rand() < 0.15;
      ctx.strokeStyle = (isLight || bright) ? lightColor : darkColor;
      ctx.lineWidth = strokeLen * (0.05 + rand() * 0.1);
      ctx.globalAlpha = 0.6 + rand() * 0.4;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(bx, by);
      const midX = bx + Math.sin(angle) * len * 0.5 + (rand() - 0.5) * len * 0.15;
      const midY = by + Math.cos(angle) * len * 0.5;
      ctx.quadraticCurveTo(midX, midY, bx + Math.sin(angle) * len, by + Math.cos(angle) * len);
      ctx.stroke();
    }
    ctx.globalAlpha = 1.0;
  }
}

export function ambientOcclusion(ctx, cx, cy, rx, ry, intensity = 0.25) {
  ctx.fillStyle = `rgba(0,0,0,${intensity})`;
  fillEllipse(ctx, cx, cy, rx, ry);
}

export function highlight(ctx, cx, cy, r, color, intensity = 0.4) {
  ctx.save();
  ctx.globalAlpha = intensity;
  ctx.fillStyle = color;
  fillCircle(ctx, cx, cy, r);
  ctx.restore();
}

export function drawLimb(ctx, x0, y0, cx, cy, x1, y1, thickness, color) {
  ctx.fillStyle = color;
  const startR = thickness * 2.0;
  const endR = thickness * 1.2;
  const steps = 12;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const mt = 1 - t;
    const px = mt * mt * x0 + 2 * mt * t * cx + t * t * x1;
    const py = mt * mt * y0 + 2 * mt * t * cy + t * t * y1;
    const r = startR + (endR - startR) * t;
    ctx.beginPath();
    ctx.arc(px, py, Math.max(1, r), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = 'rgba(0,0,0,0.12)';
  ctx.beginPath();
  ctx.arc(cx, cy, startR * 0.5, 0, Math.PI * 2);
  ctx.fill();
}

// -- Organic limb (new) — perturbed, with joint bulge and taper -----------
export function drawOrganicLimb(ctx, x0, y0, cx, cy, x1, y1, thickness, color, seed = 0) {
  const startR = thickness * 2.2;
  const endR = thickness * 0.9;
  const jointR = thickness * 2.6; // bulge at joint
  const steps = 16;

  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const mt = 1 - t;
    const px = mt * mt * x0 + 2 * mt * t * cx + t * t * x1;
    const py = mt * mt * y0 + 2 * mt * t * cy + t * t * y1;

    // Radius: smooth taper with joint bulge at t=0.5
    const baseLerp = startR + (endR - startR) * t;
    const jointBulge = Math.exp(-((t - 0.45) ** 2) / 0.02) * (jointR - baseLerp);
    const wobble = Math.sin(t * 17 + seed) * thickness * 0.15;
    const r = baseLerp + jointBulge + wobble;

    // Slightly different color per segment for depth
    const shade = 0.85 + 0.15 * Math.sin(t * Math.PI);
    ctx.fillStyle = color;
    ctx.globalAlpha = shade;
    ctx.beginPath();
    ctx.arc(px, py, Math.max(1, r), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1.0;

  // Joint shadow
  ambientOcclusion(ctx, cx, cy, startR * 0.6, startR * 0.4, 0.18);
}

// -- Warm SSS edge glow ----------------------------------------------------
export function sssEdgeGlow(ctx, cx, cy, rx, ry, intensity = 0.12) {
  ctx.save();
  ctx.globalCompositeOperation = 'soft-light';
  const g = ctx.createRadialGradient(cx, cy, Math.min(rx, ry) * 0.5, cx, cy, Math.max(rx, ry));
  g.addColorStop(0, 'rgba(180,80,40,0)');
  g.addColorStop(0.7, `rgba(180,80,40,${intensity})`);
  g.addColorStop(1, 'rgba(180,80,40,0)');
  ctx.fillStyle = g;
  fillEllipse(ctx, cx, cy, rx * 1.1, ry * 1.1);
  ctx.restore();
}
