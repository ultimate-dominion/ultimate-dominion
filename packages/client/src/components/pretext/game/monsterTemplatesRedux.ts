import type { MonsterTemplate } from './monsterTemplates';

function fillEllipse(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, rx: number, ry: number,
) {
  ctx.beginPath();
  ctx.ellipse(cx, cy, Math.max(1, rx), Math.max(1, ry), 0, 0, Math.PI * 2);
  ctx.fill();
}

function fillCircle(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  fillEllipse(ctx, cx, cy, r, r);
}

function bodyGrad(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, r: number,
  coreR: number, coreG: number, coreB: number,
  edgeR: number, edgeG: number, edgeB: number,
): CanvasGradient {
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
  g.addColorStop(0, `rgb(${coreR},${coreG},${coreB})`);
  g.addColorStop(0.45, `rgb(${Math.floor(coreR * 0.88)},${Math.floor(coreG * 0.88)},${Math.floor(coreB * 0.88)})`);
  g.addColorStop(1, `rgb(${edgeR},${edgeG},${edgeB})`);
  return g;
}

function highlight(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, r: number,
  color: string, alpha = 0.2,
) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  fillCircle(ctx, x, y, r);
  ctx.restore();
}

function ambientOcclusion(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, rx: number, ry: number, alpha = 0.2,
) {
  ctx.fillStyle = `rgba(0,0,0,${alpha})`;
  fillEllipse(ctx, x, y, rx, ry);
}

function furTexture(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
  count: number,
  dark: string, light: string,
  angle = 0,
) {
  ctx.lineCap = 'round';
  for (let i = 0; i < count; i++) {
    const px = x + Math.random() * w;
    const py = y + Math.random() * h;
    const len = w * (0.012 + Math.random() * 0.018);
    const a = angle + (Math.random() - 0.5) * 0.8;
    ctx.strokeStyle = Math.random() < 0.25 ? light : dark;
    ctx.lineWidth = Math.max(1, w * 0.003);
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.quadraticCurveTo(
      px + Math.cos(a) * len * 0.3,
      py + Math.sin(a) * len * 0.3,
      px + Math.cos(a) * len,
      py + Math.sin(a) * len,
    );
    ctx.stroke();
  }
}

function scaleTexture(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
  size: number,
  dark: string, light: string,
  density = 0.8,
) {
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

function stoneTexture(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
  count: number,
  dark: string, light: string,
) {
  for (let i = 0; i < count; i++) {
    const sx = x + Math.random() * w;
    const sy = y + Math.random() * h;
    ctx.strokeStyle = dark;
    ctx.lineWidth = Math.max(1, w * 0.008 * Math.random());
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(sx + (Math.random() - 0.5) * w * 0.22, sy + (Math.random() - 0.5) * h * 0.16);
    ctx.lineTo(sx + (Math.random() - 0.5) * w * 0.28, sy + (Math.random() - 0.5) * h * 0.28);
    ctx.stroke();
    ctx.strokeStyle = light;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(sx - 1, sy - 1);
    ctx.lineTo(sx + (Math.random() - 0.5) * w * 0.22, sy + (Math.random() - 0.5) * h * 0.16);
    ctx.stroke();
  }
}

function drawLimb(
  ctx: CanvasRenderingContext2D,
  x0: number, y0: number,
  cx: number, cy: number,
  x1: number, y1: number,
  thickness: number,
  color: string,
) {
  ctx.fillStyle = color;
  for (let i = 0; i <= 10; i++) {
    const t = i / 10;
    const mt = 1 - t;
    const px = mt * mt * x0 + 2 * mt * t * cx + t * t * x1;
    const py = mt * mt * y0 + 2 * mt * t * cy + t * t * y1;
    const r = thickness * (1.5 - t * 0.45);
    fillCircle(ctx, px, py, r);
  }
}

function drawDireRatRedux(ctx: CanvasRenderingContext2D, w: number, h: number) {
  // Lower, more predatory anatomy: shoulder hump, tucked belly, smaller ears.
  ctx.fillStyle = bodyGrad(ctx, w * 0.54, h * 0.45, w * 0.30, 122, 100, 78, 34, 24, 18);
  ctx.beginPath();
  ctx.moveTo(w * 0.28, h * 0.38);
  ctx.bezierCurveTo(w * 0.36, h * 0.26, w * 0.56, h * 0.23, w * 0.72, h * 0.34);
  ctx.bezierCurveTo(w * 0.80, h * 0.40, w * 0.80, h * 0.55, w * 0.74, h * 0.64);
  ctx.bezierCurveTo(w * 0.66, h * 0.72, w * 0.48, h * 0.76, w * 0.32, h * 0.68);
  ctx.bezierCurveTo(w * 0.22, h * 0.62, w * 0.20, h * 0.47, w * 0.28, h * 0.38);
  ctx.fill();

  ctx.fillStyle = bodyGrad(ctx, w * 0.63, h * 0.46, w * 0.16, 104, 84, 66, 30, 22, 16);
  fillEllipse(ctx, w * 0.66, h * 0.48, w * 0.15, h * 0.18);

  ctx.fillStyle = bodyGrad(ctx, w * 0.20, h * 0.46, w * 0.16, 116, 96, 76, 32, 22, 18);
  ctx.beginPath();
  ctx.moveTo(w * 0.30, h * 0.42);
  ctx.bezierCurveTo(w * 0.20, h * 0.34, w * 0.10, h * 0.35, w * 0.04, h * 0.42);
  ctx.bezierCurveTo(w * 0.00, h * 0.47, w * 0.02, h * 0.55, w * 0.09, h * 0.59);
  ctx.bezierCurveTo(w * 0.17, h * 0.62, w * 0.26, h * 0.58, w * 0.30, h * 0.52);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = bodyGrad(ctx, w * 0.44, h * 0.34, w * 0.13, 138, 112, 86, 54, 40, 28);
  fillEllipse(ctx, w * 0.40, h * 0.34, w * 0.14, h * 0.10);

  ctx.fillStyle = bodyGrad(ctx, w * 0.42, h * 0.60, w * 0.16, 152, 132, 108, 58, 42, 28);
  fillEllipse(ctx, w * 0.42, h * 0.62, w * 0.16, h * 0.07);

  ambientOcclusion(ctx, w * 0.34, h * 0.60, w * 0.10, h * 0.04, 0.24);
  ambientOcclusion(ctx, w * 0.29, h * 0.46, w * 0.05, h * 0.07, 0.22);
  ambientOcclusion(ctx, w * 0.60, h * 0.50, w * 0.06, h * 0.08, 0.16);

  // Fur should describe form, not just fill space.
  furTexture(ctx, w * 0.26, h * 0.26, w * 0.48, h * 0.28, 115, 'rgb(28,22,18)', 'rgb(152,128,104)', -0.25);
  furTexture(ctx, w * 0.28, h * 0.46, w * 0.38, h * 0.14, 40, 'rgb(52,40,30)', 'rgb(180,156,126)', 0.25);
  furTexture(ctx, w * 0.08, h * 0.38, w * 0.20, h * 0.16, 24, 'rgb(36,28,22)', 'rgb(138,112,88)', 0.0);

  // Ears: smaller and more believable than the toy-like version.
  ctx.fillStyle = 'rgb(90,72,62)';
  fillEllipse(ctx, w * 0.19, h * 0.27, w * 0.035, h * 0.08);
  fillEllipse(ctx, w * 0.25, h * 0.24, w * 0.033, h * 0.085);
  ctx.fillStyle = 'rgb(160,98,110)';
  fillEllipse(ctx, w * 0.19, h * 0.27, w * 0.018, h * 0.045);
  fillEllipse(ctx, w * 0.25, h * 0.245, w * 0.016, h * 0.045);

  // Snout and nose
  ctx.fillStyle = 'rgb(84,66,54)';
  ctx.beginPath();
  ctx.moveTo(w * 0.07, h * 0.45);
  ctx.lineTo(w * -0.02, h * 0.47);
  ctx.lineTo(w * 0.06, h * 0.52);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgb(176,100,106)';
  fillCircle(ctx, w * -0.005, h * 0.485, w * 0.010);

  // Eye: smaller and deeper set.
  highlight(ctx, w * 0.145, h * 0.42, w * 0.020, 'rgb(160,46,44)', 0.10);
  ctx.fillStyle = 'rgb(138,40,34)';
  fillCircle(ctx, w * 0.145, h * 0.42, w * 0.010);
  ctx.fillStyle = '#000';
  fillCircle(ctx, w * 0.148, h * 0.421, w * 0.004);

  // Incisors and whiskers
  ctx.fillStyle = 'rgb(220,204,170)';
  ctx.beginPath();
  ctx.moveTo(w * 0.03, h * 0.50);
  ctx.lineTo(w * 0.02, h * 0.55);
  ctx.lineTo(w * 0.05, h * 0.51);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(w * 0.06, h * 0.50);
  ctx.lineTo(w * 0.06, h * 0.55);
  ctx.lineTo(w * 0.08, h * 0.51);
  ctx.fill();

  ctx.strokeStyle = 'rgba(144,118,92,0.65)';
  ctx.lineWidth = w * 0.003;
  ctx.beginPath();
  ctx.moveTo(w * 0.05, h * 0.45); ctx.lineTo(w * -0.03, h * 0.42);
  ctx.moveTo(w * 0.05, h * 0.48); ctx.lineTo(w * -0.04, h * 0.48);
  ctx.moveTo(w * 0.05, h * 0.51); ctx.lineTo(w * -0.03, h * 0.55);
  ctx.stroke();

  // Tail: fleshy and thin, but not a bright candy cane.
  ctx.strokeStyle = 'rgb(148,112,104)';
  ctx.lineWidth = w * 0.022;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(w * 0.76, h * 0.48);
  ctx.bezierCurveTo(w * 0.88, h * 0.40, w * 0.96, h * 0.26, w * 1.00, h * 0.12);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(94,66,62,0.40)';
  ctx.lineWidth = w * 0.007;
  ctx.beginPath();
  ctx.moveTo(w * 0.79, h * 0.45);
  ctx.bezierCurveTo(w * 0.88, h * 0.36, w * 0.94, h * 0.24, w * 0.98, h * 0.16);
  ctx.stroke();

  // Crouched leg placement: front paws forward, rear legs carrying haunch weight.
  drawLimb(ctx, w * 0.28, h * 0.60, w * 0.24, h * 0.72, w * 0.22, h * 0.84, w * 0.014, 'rgb(116,92,70)');
  drawLimb(ctx, w * 0.38, h * 0.61, w * 0.35, h * 0.72, w * 0.34, h * 0.84, w * 0.014, 'rgb(114,90,68)');
  drawLimb(ctx, w * 0.58, h * 0.58, w * 0.56, h * 0.70, w * 0.56, h * 0.86, w * 0.018, 'rgb(96,74,58)');
  drawLimb(ctx, w * 0.68, h * 0.56, w * 0.70, h * 0.69, w * 0.70, h * 0.84, w * 0.017, 'rgb(90,70,54)');

  ctx.fillStyle = 'rgb(210,192,166)';
  for (const [fx, fy] of [[0.22, 0.84], [0.34, 0.84], [0.56, 0.86], [0.70, 0.84]] as [number, number][]) {
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(w * fx, h * fy);
      ctx.lineTo(w * (fx - 0.010 + i * 0.010), h * (fy + 0.035));
      ctx.lineTo(w * (fx - 0.003 + i * 0.010), h * (fy + 0.020));
      ctx.fill();
    }
  }

  highlight(ctx, w * 0.44, h * 0.33, w * 0.05, 'rgb(178,154,126)', 0.08);
  highlight(ctx, w * 0.61, h * 0.43, w * 0.04, 'rgb(148,126,102)', 0.08);
}

function drawFungalShamanRedux(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.strokeStyle = 'rgb(98,74,44)';
  ctx.lineWidth = w * 0.04;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(w * 0.72, h * 0.10);
  ctx.bezierCurveTo(w * 0.69, h * 0.34, w * 0.66, h * 0.60, w * 0.63, h * 0.92);
  ctx.stroke();
  ctx.fillStyle = bodyGrad(ctx, w * 0.42, h * 0.22, w * 0.24, 188, 84, 160, 90, 44, 90);
  ctx.beginPath();
  ctx.moveTo(w * 0.18, h * 0.30);
  ctx.bezierCurveTo(w * 0.12, h * 0.14, w * 0.22, h * 0.04, w * 0.40, h * 0.03);
  ctx.bezierCurveTo(w * 0.58, h * 0.04, w * 0.66, h * 0.16, w * 0.60, h * 0.30);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = bodyGrad(ctx, w * 0.40, h * 0.57, w * 0.16, 164, 142, 102, 82, 62, 42);
  ctx.beginPath();
  ctx.moveTo(w * 0.34, h * 0.34);
  ctx.bezierCurveTo(w * 0.28, h * 0.44, w * 0.26, h * 0.62, w * 0.32, h * 0.80);
  ctx.bezierCurveTo(w * 0.40, h * 0.84, w * 0.50, h * 0.82, w * 0.54, h * 0.76);
  ctx.bezierCurveTo(w * 0.54, h * 0.58, w * 0.52, h * 0.44, w * 0.48, h * 0.34);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgb(170,208,86)';
  fillCircle(ctx, w * 0.31, h * 0.16, w * 0.02);
  fillCircle(ctx, w * 0.42, h * 0.11, w * 0.025);
  fillCircle(ctx, w * 0.53, h * 0.17, w * 0.016);
  ctx.fillStyle = 'rgb(112,255,78)';
  fillCircle(ctx, w * 0.36, h * 0.33, w * 0.012);
  fillCircle(ctx, w * 0.43, h * 0.33, w * 0.012);
  drawLimb(ctx, w * 0.33, h * 0.47, w * 0.26, h * 0.58, w * 0.22, h * 0.70, w * 0.012, 'rgb(104,84,58)');
  drawLimb(ctx, w * 0.48, h * 0.48, w * 0.56, h * 0.50, w * 0.64, h * 0.50, w * 0.012, 'rgb(104,84,58)');
  drawLimb(ctx, w * 0.36, h * 0.78, w * 0.34, h * 0.88, w * 0.31, h * 0.96, w * 0.015, 'rgb(92,72,50)');
  drawLimb(ctx, w * 0.46, h * 0.78, w * 0.46, h * 0.89, w * 0.46, h * 0.97, w * 0.015, 'rgb(92,72,50)');
  highlight(ctx, w * 0.70, h * 0.08, w * 0.05, 'rgb(142,255,94)', 0.25);
}

function drawCavernBruteRedux(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.fillStyle = bodyGrad(ctx, w * 0.44, h * 0.40, w * 0.28, 178, 152, 120, 82, 64, 44);
  ctx.beginPath();
  ctx.moveTo(w * 0.22, h * 0.18);
  ctx.bezierCurveTo(w * 0.12, h * 0.26, w * 0.12, h * 0.52, w * 0.20, h * 0.66);
  ctx.bezierCurveTo(w * 0.34, h * 0.76, w * 0.56, h * 0.76, w * 0.68, h * 0.64);
  ctx.bezierCurveTo(w * 0.72, h * 0.48, w * 0.70, h * 0.26, w * 0.56, h * 0.16);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = bodyGrad(ctx, w * 0.28, h * 0.12, w * 0.10, 126, 104, 78, 60, 44, 30);
  fillEllipse(ctx, w * 0.30, h * 0.12, w * 0.10, h * 0.08);
  ctx.fillStyle = 'rgb(252,206,96)';
  fillCircle(ctx, w * 0.27, h * 0.10, w * 0.012);
  fillCircle(ctx, w * 0.34, h * 0.10, w * 0.012);
  drawLimb(ctx, w * 0.22, h * 0.30, w * 0.08, h * 0.46, w * 0.12, h * 0.82, w * 0.030, 'rgb(120,98,72)');
  drawLimb(ctx, w * 0.64, h * 0.28, w * 0.74, h * 0.44, w * 0.68, h * 0.82, w * 0.026, 'rgb(104,82,60)');
  fillEllipse(ctx, w * 0.13, h * 0.83, w * 0.06, h * 0.05);
  fillEllipse(ctx, w * 0.69, h * 0.83, w * 0.05, h * 0.04);
  fillEllipse(ctx, w * 0.34, h * 0.84, w * 0.07, h * 0.11);
  fillEllipse(ctx, w * 0.52, h * 0.84, w * 0.07, h * 0.11);
  stoneTexture(ctx, w * 0.18, h * 0.22, w * 0.48, h * 0.42, 18, 'rgb(64,50,34)', 'rgba(224,204,172,0.24)');
  highlight(ctx, w * 0.38, h * 0.28, w * 0.06, 'rgb(210,184,152)', 0.12);
}

function drawCrystalElementalRedux(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const grad = ctx.createLinearGradient(w * 0.24, h * 0.10, w * 0.64, h * 0.80);
  grad.addColorStop(0, 'rgb(220,248,255)');
  grad.addColorStop(0.35, 'rgb(130,210,240)');
  grad.addColorStop(0.7, 'rgb(60,140,180)');
  grad.addColorStop(1, 'rgb(18,60,88)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(w * 0.42, h * 0.05);
  ctx.lineTo(w * 0.60, h * 0.20);
  ctx.lineTo(w * 0.64, h * 0.46);
  ctx.lineTo(w * 0.54, h * 0.74);
  ctx.lineTo(w * 0.42, h * 0.86);
  ctx.lineTo(w * 0.28, h * 0.72);
  ctx.lineTo(w * 0.22, h * 0.42);
  ctx.lineTo(w * 0.29, h * 0.18);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(178,236,255,0.65)';
  ctx.lineWidth = w * 0.006;
  ctx.beginPath();
  ctx.moveTo(w * 0.42, h * 0.05); ctx.lineTo(w * 0.44, h * 0.44); ctx.lineTo(w * 0.42, h * 0.86);
  ctx.moveTo(w * 0.29, h * 0.18); ctx.lineTo(w * 0.44, h * 0.44); ctx.lineTo(w * 0.64, h * 0.46);
  ctx.moveTo(w * 0.22, h * 0.42); ctx.lineTo(w * 0.44, h * 0.44); ctx.lineTo(w * 0.60, h * 0.20);
  ctx.stroke();
  highlight(ctx, w * 0.44, h * 0.40, w * 0.09, 'rgb(232,252,255)', 0.30);
  fillCircle(ctx, w * 0.44, h * 0.34, w * 0.02);
}

function drawIronhideTrollRedux(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.fillStyle = bodyGrad(ctx, w * 0.42, h * 0.38, w * 0.28, 128, 184, 96, 50, 82, 34);
  ctx.beginPath();
  ctx.moveTo(w * 0.28, h * 0.14);
  ctx.bezierCurveTo(w * 0.14, h * 0.20, w * 0.12, h * 0.44, w * 0.18, h * 0.62);
  ctx.bezierCurveTo(w * 0.28, h * 0.72, w * 0.54, h * 0.72, w * 0.66, h * 0.58);
  ctx.bezierCurveTo(w * 0.68, h * 0.34, w * 0.60, h * 0.18, w * 0.48, h * 0.12);
  ctx.closePath();
  ctx.fill();
  fillEllipse(ctx, w * 0.44, h * 0.16, w * 0.18, h * 0.10);
  fillEllipse(ctx, w * 0.24, h * 0.10, w * 0.08, h * 0.07);
  ctx.fillStyle = 'rgb(252,210,98)';
  fillCircle(ctx, w * 0.20, h * 0.09, w * 0.010);
  fillCircle(ctx, w * 0.26, h * 0.09, w * 0.010);
  drawLimb(ctx, w * 0.18, h * 0.28, w * 0.08, h * 0.48, w * 0.11, h * 0.80, w * 0.028, 'rgb(92,142,66)');
  drawLimb(ctx, w * 0.60, h * 0.28, w * 0.72, h * 0.44, w * 0.69, h * 0.76, w * 0.023, 'rgb(78,124,58)');
  fillEllipse(ctx, w * 0.32, h * 0.82, w * 0.07, h * 0.12);
  fillEllipse(ctx, w * 0.52, h * 0.82, w * 0.07, h * 0.12);
  furTexture(ctx, w * 0.18, h * 0.18, w * 0.44, h * 0.36, 50, 'rgb(40,62,26)', 'rgb(132,186,96)', 0.4);
  stoneTexture(ctx, w * 0.26, h * 0.10, w * 0.32, h * 0.16, 10, 'rgb(42,72,30)', 'rgba(170,214,134,0.18)');
}

function drawPhaseSpiderRedux(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const far = 'rgb(92,74,148)';
  const near = 'rgb(148,128,214)';
  const farLegs = [[0.44,0.40,0.58,0.22,0.72,0.08],[0.50,0.42,0.64,0.30,0.78,0.18],[0.52,0.48,0.64,0.58,0.76,0.74],[0.48,0.52,0.58,0.68,0.68,0.86]] as [number,number,number,number,number,number][];
  for (const [x0,y0,cx,cy,x1,y1] of farLegs) drawLimb(ctx, w*x0,h*y0,w*cx,h*cy,w*x1,h*y1,w*0.012,far);
  ctx.fillStyle = bodyGrad(ctx, w * 0.58, h * 0.46, w * 0.20, 138, 110, 212, 50, 34, 82);
  fillEllipse(ctx, w * 0.58, h * 0.46, w * 0.20, h * 0.18);
  ctx.fillStyle = bodyGrad(ctx, w * 0.32, h * 0.42, w * 0.12, 152, 128, 224, 62, 42, 96);
  fillEllipse(ctx, w * 0.32, h * 0.42, w * 0.12, h * 0.09);
  scaleTexture(ctx, w * 0.45, h * 0.32, w * 0.28, h * 0.26, w * 0.020, 'rgba(42,24,76,0.5)', 'rgba(210,184,255,0.22)', 0.8);
  ctx.fillStyle = 'rgb(210,48,42)';
  ctx.beginPath();
  ctx.moveTo(w * 0.60, h * 0.34); ctx.lineTo(w * 0.64, h * 0.44); ctx.lineTo(w * 0.60, h * 0.56); ctx.lineTo(w * 0.56, h * 0.44); ctx.closePath();
  ctx.fill();
  for (const [x,y,r] of [[0.14,0.36,0.008],[0.17,0.34,0.010],[0.20,0.36,0.008],[0.15,0.39,0.007],[0.18,0.39,0.007],[0.21,0.39,0.006]] as [number,number,number][]) {
    ctx.fillStyle = 'rgb(170,255,168)';
    fillCircle(ctx, w * x, h * y, w * r);
  }
  const nearLegs = [[0.28,0.48,0.16,0.28,0.06,0.12],[0.32,0.50,0.18,0.40,0.08,0.30],[0.40,0.56,0.28,0.70,0.18,0.84],[0.46,0.58,0.42,0.74,0.38,0.92]] as [number,number,number,number,number,number][];
  for (const [x0,y0,cx,cy,x1,y1] of nearLegs) drawLimb(ctx, w*x0,h*y0,w*cx,h*cy,w*x1,h*y1,w*0.015,near);
}

function drawBonecasterRedux(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.fillStyle = bodyGrad(ctx, w * 0.38, h * 0.58, w * 0.20, 88, 62, 52, 26, 18, 14);
  ctx.beginPath();
  ctx.moveTo(w * 0.30, h * 0.28);
  ctx.bezierCurveTo(w * 0.22, h * 0.40, w * 0.18, h * 0.68, w * 0.16, h * 0.96);
  ctx.lineTo(w * 0.28, h * 0.94); ctx.lineTo(w * 0.36, h * 0.98); ctx.lineTo(w * 0.46, h * 0.92); ctx.lineTo(w * 0.56, h * 0.98); ctx.lineTo(w * 0.62, h * 0.90);
  ctx.bezierCurveTo(w * 0.61, h * 0.68, w * 0.58, h * 0.44, w * 0.52, h * 0.32);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = bodyGrad(ctx, w * 0.36, h * 0.18, w * 0.12, 74, 50, 40, 24, 18, 14);
  fillEllipse(ctx, w * 0.36, h * 0.18, w * 0.12, h * 0.12);
  ctx.fillStyle = 'rgb(224,212,182)';
  fillCircle(ctx, w * 0.32, h * 0.16, w * 0.018);
  fillCircle(ctx, w * 0.40, h * 0.16, w * 0.018);
  ctx.fillStyle = 'rgb(18,18,18)';
  fillCircle(ctx, w * 0.32, h * 0.16, w * 0.010);
  fillCircle(ctx, w * 0.40, h * 0.16, w * 0.010);
  highlight(ctx, w * 0.32, h * 0.16, w * 0.03, 'rgb(120,255,82)', 0.22);
  highlight(ctx, w * 0.40, h * 0.16, w * 0.03, 'rgb(120,255,82)', 0.22);
  ctx.strokeStyle = 'rgb(190,180,152)';
  ctx.lineWidth = w * 0.034;
  ctx.beginPath();
  ctx.moveTo(w * 0.72, h * 0.06); ctx.bezierCurveTo(w * 0.70, h * 0.34, w * 0.68, h * 0.62, w * 0.66, h * 0.92);
  ctx.stroke();
  drawLimb(ctx, w * 0.46, h * 0.40, w * 0.56, h * 0.42, w * 0.66, h * 0.40, w * 0.010, 'rgb(196,186,156)');
}

function drawRockGolemRedux(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.fillStyle = bodyGrad(ctx, w * 0.42, h * 0.38, w * 0.28, 194, 188, 168, 74, 68, 58);
  ctx.beginPath();
  ctx.moveTo(w * 0.22, h * 0.12); ctx.lineTo(w * 0.62, h * 0.12); ctx.lineTo(w * 0.70, h * 0.24); ctx.lineTo(w * 0.68, h * 0.60); ctx.lineTo(w * 0.58, h * 0.66); ctx.lineTo(w * 0.26, h * 0.66); ctx.lineTo(w * 0.16, h * 0.56); ctx.lineTo(w * 0.16, h * 0.22); ctx.closePath();
  ctx.fill();
  ctx.fillStyle = bodyGrad(ctx, w * 0.40, h * 0.06, w * 0.12, 202, 196, 178, 82, 76, 66);
  ctx.beginPath(); ctx.moveTo(w * 0.30, h * 0.12); ctx.lineTo(w * 0.28, h * 0.02); ctx.lineTo(w * 0.52, h * 0.02); ctx.lineTo(w * 0.56, h * 0.12); ctx.closePath(); ctx.fill();
  ctx.fillStyle = 'rgb(255,218,104)';
  ctx.fillRect(w * 0.34, h * 0.05, w * 0.05, h * 0.02); ctx.fillRect(w * 0.45, h * 0.05, w * 0.05, h * 0.02);
  ctx.fillStyle = 'rgb(132,126,110)';
  ctx.fillRect(w * 0.04, h * 0.22, w * 0.12, h * 0.50); ctx.fillRect(w * 0.68, h * 0.22, w * 0.10, h * 0.50);
  ctx.fillRect(w * 0.28, h * 0.66, w * 0.12, h * 0.24); ctx.fillRect(w * 0.46, h * 0.66, w * 0.12, h * 0.24);
  stoneTexture(ctx, w * 0.18, h * 0.14, w * 0.46, h * 0.48, 22, 'rgb(68,60,50)', 'rgba(236,226,206,0.18)');
  highlight(ctx, w * 0.40, h * 0.24, w * 0.06, 'rgb(226,220,204)', 0.14);
}

function drawPaleStalkerRedux(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.fillStyle = bodyGrad(ctx, w * 0.40, h * 0.40, w * 0.18, 206, 214, 232, 94, 102, 126);
  ctx.beginPath();
  ctx.moveTo(w * 0.30, h * 0.22); ctx.bezierCurveTo(w * 0.22, h * 0.28, w * 0.22, h * 0.48, w * 0.28, h * 0.58); ctx.bezierCurveTo(w * 0.38, h * 0.62, w * 0.48, h * 0.60, w * 0.54, h * 0.50); ctx.bezierCurveTo(w * 0.56, h * 0.36, w * 0.52, h * 0.26, w * 0.30, h * 0.22); ctx.fill();
  ctx.fillStyle = bodyGrad(ctx, w * 0.18, h * 0.20, w * 0.11, 222, 228, 242, 96, 104, 128);
  ctx.beginPath(); ctx.moveTo(w * 0.26, h * 0.18); ctx.bezierCurveTo(w * 0.18, h * 0.12, w * 0.08, h * 0.14, w * 0.04, h * 0.20); ctx.bezierCurveTo(w * 0.04, h * 0.26, w * 0.12, h * 0.28, w * 0.24, h * 0.26); ctx.closePath(); ctx.fill();
  ctx.fillStyle = 'rgb(188,236,255)'; fillCircle(ctx, w * 0.13, h * 0.18, w * 0.010); fillCircle(ctx, w * 0.20, h * 0.18, w * 0.010);
  drawLimb(ctx, w * 0.28, h * 0.40, w * 0.18, h * 0.56, w * 0.12, h * 0.76, w * 0.010, 'rgb(190,198,218)');
  drawLimb(ctx, w * 0.48, h * 0.40, w * 0.58, h * 0.56, w * 0.64, h * 0.74, w * 0.010, 'rgb(176,184,204)');
  drawLimb(ctx, w * 0.32, h * 0.58, w * 0.28, h * 0.68, w * 0.30, h * 0.92, w * 0.015, 'rgb(178,186,206)');
  drawLimb(ctx, w * 0.44, h * 0.58, w * 0.48, h * 0.70, w * 0.48, h * 0.92, w * 0.013, 'rgb(164,172,194)');
  ctx.strokeStyle = 'rgba(214,224,246,0.38)';
  ctx.lineWidth = w * 0.004;
  for (let i = 0; i < 5; i++) { const y = 0.32 + i * 0.05; ctx.beginPath(); ctx.moveTo(w * 0.30, h * y); ctx.quadraticCurveTo(w * 0.38, h * (y + 0.012), w * 0.48, h * y); ctx.stroke(); }
}

function drawDuskDrakeRedux(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.fillStyle = bodyGrad(ctx, w * 0.78, h * 0.56, w * 0.14, 98, 64, 118, 40, 24, 54);
  ctx.beginPath(); ctx.moveTo(w * 0.68, h * 0.50); ctx.bezierCurveTo(w * 0.84, h * 0.46, w * 0.96, h * 0.54, w * 1.00, h * 0.60); ctx.bezierCurveTo(w * 0.94, h * 0.66, w * 0.84, h * 0.62, w * 0.68, h * 0.58); ctx.closePath(); ctx.fill();
  ctx.fillStyle = bodyGrad(ctx, w * 0.48, h * 0.48, w * 0.22, 176, 110, 206, 58, 36, 82);
  ctx.beginPath(); ctx.moveTo(w * 0.32, h * 0.38); ctx.bezierCurveTo(w * 0.42, h * 0.30, w * 0.60, h * 0.32, w * 0.70, h * 0.40); ctx.bezierCurveTo(w * 0.74, h * 0.46, w * 0.74, h * 0.58, w * 0.66, h * 0.62); ctx.bezierCurveTo(w * 0.54, h * 0.68, w * 0.40, h * 0.66, w * 0.32, h * 0.58); ctx.closePath(); ctx.fill();
  ctx.fillStyle = bodyGrad(ctx, w * 0.30, h * 0.20, w * 0.22, 158, 92, 190, 48, 30, 68);
  ctx.beginPath(); ctx.moveTo(w * 0.40, h * 0.40); ctx.bezierCurveTo(w * 0.34, h * 0.24, w * 0.26, h * 0.12, w * 0.14, h * 0.02); ctx.bezierCurveTo(w * 0.18, h * 0.12, w * 0.22, h * 0.22, w * 0.22, h * 0.30); ctx.bezierCurveTo(w * 0.30, h * 0.24, w * 0.34, h * 0.28, w * 0.34, h * 0.36); ctx.closePath(); ctx.fill();
  ctx.fillStyle = 'rgb(100,62,126)';
  ctx.beginPath(); ctx.moveTo(w * 0.56, h * 0.38); ctx.bezierCurveTo(w * 0.58, h * 0.22, w * 0.64, h * 0.10, w * 0.72, h * 0.02); ctx.bezierCurveTo(w * 0.68, h * 0.14, w * 0.64, h * 0.22, w * 0.60, h * 0.30); ctx.closePath(); ctx.fill();
  ctx.fillStyle = bodyGrad(ctx, w * 0.16, h * 0.20, w * 0.10, 196, 132, 224, 62, 38, 86);
  ctx.beginPath(); ctx.moveTo(w * 0.18, h * 0.18); ctx.bezierCurveTo(w * 0.10, h * 0.14, w * 0.02, h * 0.16, w * 0.02, h * 0.22); ctx.bezierCurveTo(w * 0.08, h * 0.26, w * 0.16, h * 0.26, w * 0.22, h * 0.22); ctx.closePath(); ctx.fill();
  ctx.fillStyle = 'rgb(214,176,92)'; ctx.beginPath(); ctx.moveTo(w * 0.12, h * 0.16); ctx.lineTo(w * 0.18, h * 0.08); ctx.lineTo(w * 0.20, h * 0.14); ctx.closePath(); ctx.fill();
  fillCircle(ctx, w * 0.09, h * 0.19, w * 0.010);
  drawLimb(ctx, w * 0.40, h * 0.60, w * 0.36, h * 0.74, w * 0.34, h * 0.88, w * 0.016, 'rgb(106,64,122)');
  drawLimb(ctx, w * 0.58, h * 0.58, w * 0.60, h * 0.74, w * 0.58, h * 0.86, w * 0.015, 'rgb(92,56,108)');
  scaleTexture(ctx, w * 0.30, h * 0.34, w * 0.42, h * 0.26, w * 0.020, 'rgba(48,24,66,0.5)', 'rgba(212,152,240,0.18)', 0.72);
}

function drawBasiliskRedux(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.fillStyle = bodyGrad(ctx, w * 0.84, h * 0.42, w * 0.22, 118, 132, 90, 44, 50, 34);
  ctx.beginPath(); ctx.moveTo(w * 0.76, h * 0.48); ctx.bezierCurveTo(w * 0.88, h * 0.42, w * 0.96, h * 0.28, w * 1.02, h * 0.12); ctx.bezierCurveTo(w * 0.96, h * 0.22, w * 0.86, h * 0.34, w * 0.72, h * 0.44); ctx.closePath(); ctx.fill();
  ctx.fillStyle = bodyGrad(ctx, w * 0.52, h * 0.48, w * 0.34, 146, 158, 110, 50, 58, 38);
  ctx.beginPath(); ctx.moveTo(w * 0.24, h * 0.38); ctx.bezierCurveTo(w * 0.34, h * 0.24, w * 0.58, h * 0.22, w * 0.74, h * 0.34); ctx.bezierCurveTo(w * 0.80, h * 0.40, w * 0.80, h * 0.56, w * 0.72, h * 0.64); ctx.bezierCurveTo(w * 0.60, h * 0.76, w * 0.38, h * 0.77, w * 0.24, h * 0.65); ctx.bezierCurveTo(w * 0.18, h * 0.58, w * 0.18, h * 0.46, w * 0.24, h * 0.38); ctx.closePath(); ctx.fill();
  fillEllipse(ctx, w * 0.38, h * 0.42, w * 0.14, h * 0.13);
  fillEllipse(ctx, w * 0.66, h * 0.52, w * 0.14, h * 0.15);
  ctx.fillStyle = bodyGrad(ctx, w * 0.15, h * 0.42, w * 0.16, 156, 168, 120, 54, 60, 42);
  ctx.beginPath(); ctx.moveTo(w * 0.30, h * 0.42); ctx.bezierCurveTo(w * 0.24, h * 0.32, w * 0.14, h * 0.28, w * 0.08, h * 0.34); ctx.bezierCurveTo(w * 0.02, h * 0.40, w * 0.00, h * 0.49, w * 0.06, h * 0.56); ctx.bezierCurveTo(w * 0.14, h * 0.61, w * 0.24, h * 0.60, w * 0.28, h * 0.52); ctx.closePath(); ctx.fill();
  ctx.fillStyle = 'rgb(90,102,62)';
  for (const [x, hgt] of [[0.36,0.08],[0.42,0.11],[0.49,0.12],[0.56,0.11],[0.62,0.09]] as [number, number][]) {
    ctx.beginPath(); ctx.moveTo(w * (x - 0.02), h * 0.34); ctx.lineTo(w * x, h * (0.34 - hgt)); ctx.lineTo(w * (x + 0.02), h * 0.34); ctx.closePath(); ctx.fill();
  }
  ctx.fillStyle = 'rgb(168,255,112)'; fillEllipse(ctx, w * 0.13, h * 0.40, w * 0.016, h * 0.010); fillEllipse(ctx, w * 0.18, h * 0.38, w * 0.014, h * 0.010);
  ctx.strokeStyle = 'rgb(20,26,14)'; ctx.lineWidth = w * 0.004; ctx.beginPath(); ctx.moveTo(w * 0.13, h * 0.392); ctx.lineTo(w * 0.13, h * 0.408); ctx.moveTo(w * 0.18, h * 0.372); ctx.lineTo(w * 0.18, h * 0.388); ctx.stroke();
  ctx.fillStyle = 'rgb(212,198,152)'; for (const tx of [0.02,0.05,0.08]) { ctx.beginPath(); ctx.moveTo(w*tx,h*0.53); ctx.lineTo(w*(tx+0.01),h*0.58); ctx.lineTo(w*(tx+0.018),h*0.53); ctx.fill(); }
  scaleTexture(ctx, w * 0.24, h * 0.30, w * 0.50, h * 0.30, w * 0.022, 'rgba(56,66,40,0.48)', 'rgba(206,218,160,0.20)', 0.8);
  drawLimb(ctx, w * 0.36, h * 0.61, w * 0.34, h * 0.74, w * 0.30, h * 0.90, w * 0.018, 'rgb(108,116,78)');
  drawLimb(ctx, w * 0.48, h * 0.62, w * 0.49, h * 0.75, w * 0.47, h * 0.90, w * 0.017, 'rgb(100,108,72)');
  drawLimb(ctx, w * 0.64, h * 0.60, w * 0.66, h * 0.72, w * 0.64, h * 0.88, w * 0.019, 'rgb(92,100,66)');
  drawLimb(ctx, w * 0.73, h * 0.56, w * 0.76, h * 0.68, w * 0.75, h * 0.84, w * 0.018, 'rgb(84,92,60)');
  highlight(ctx, w * 0.40, h * 0.34, w * 0.06, 'rgb(214,224,166)', 0.16);
}

export const MONSTER_TEMPLATES_REDUX: MonsterTemplate[] = [
  { id: 'redux-dire-rat', name: 'Dire Rat', gridWidth: 14, gridHeight: 8, monsterClass: 1, level: 1, atmosphere: { r: 140, g: 110, b: 70, intensity: 0.10 }, draw: drawDireRatRedux },
  { id: 'redux-fungal-shaman', name: 'Fungal Shaman', gridWidth: 10, gridHeight: 12, monsterClass: 2, level: 2, atmosphere: { r: 78, g: 148, b: 52, intensity: 0.12 }, draw: drawFungalShamanRedux },
  { id: 'redux-cavern-brute', name: 'Cavern Brute', gridWidth: 10, gridHeight: 12, monsterClass: 0, level: 3, atmosphere: { r: 156, g: 116, b: 58, intensity: 0.10 }, draw: drawCavernBruteRedux },
  { id: 'redux-crystal-elemental', name: 'Crystal Elemental', gridWidth: 10, gridHeight: 12, monsterClass: 2, level: 4, atmosphere: { r: 72, g: 164, b: 226, intensity: 0.15 }, draw: drawCrystalElementalRedux },
  { id: 'redux-ironhide-troll', name: 'Ironhide Troll', gridWidth: 10, gridHeight: 12, monsterClass: 0, level: 5, atmosphere: { r: 96, g: 156, b: 70, intensity: 0.12 }, draw: drawIronhideTrollRedux },
  { id: 'redux-phase-spider', name: 'Phase Spider', gridWidth: 12, gridHeight: 11, monsterClass: 1, level: 6, atmosphere: { r: 106, g: 70, b: 164, intensity: 0.12 }, draw: drawPhaseSpiderRedux },
  { id: 'redux-bonecaster', name: 'Bonecaster', gridWidth: 10, gridHeight: 14, monsterClass: 2, level: 7, atmosphere: { r: 66, g: 182, b: 56, intensity: 0.12 }, draw: drawBonecasterRedux },
  { id: 'redux-rock-golem', name: 'Rock Golem', gridWidth: 10, gridHeight: 12, monsterClass: 0, level: 8, atmosphere: { r: 172, g: 138, b: 72, intensity: 0.10 }, draw: drawRockGolemRedux },
  { id: 'redux-pale-stalker', name: 'Pale Stalker', gridWidth: 10, gridHeight: 13, monsterClass: 1, level: 9, atmosphere: { r: 144, g: 168, b: 208, intensity: 0.14 }, draw: drawPaleStalkerRedux },
  { id: 'redux-dusk-drake', name: 'Dusk Drake', gridWidth: 14, gridHeight: 12, monsterClass: 2, level: 10, atmosphere: { r: 136, g: 82, b: 178, intensity: 0.12 }, draw: drawDuskDrakeRedux },
  { id: 'redux-basilisk', name: 'Basilisk', gridWidth: 26, gridHeight: 9, monsterClass: 0, level: 12, isBoss: true, atmosphere: { r: 52, g: 86, b: 36, intensity: 0.10 }, renderOverrides: { gamma: 0.72, ambient: 0.45, brightnessBoost: 1.15, charDensityFloor: 0.14 }, draw: drawBasiliskRedux },
];
