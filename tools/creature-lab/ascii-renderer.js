// ==========================================================================
// Simplified port of MonsterAsciiRenderer v8 for the creature lab
// Stripped of animation, kept: template processing, lighting, edge detection,
// rim coloring, bg fill, depth extrusion, glow, half-block interior
// ==========================================================================

const FONT = 'Cormorant Garamond, Georgia, serif';
const CHAR_PALETTE = " .`',:-~^;*+!=?#@";

// Alternative palettes — pass as opts.charPalette to experiment
export const PALETTES = {
  default:   " .`',:-~^;*+!=?#@",
  blocks:    " ░▒▓█",
  organic:   " .·∙•◦○◉●",
  dense:     " .,:;i!|lIYXZAUDB$#@",
  runes:     " .ᚹᚺᚾᛁᛃᛇᛈᛊᛏᛒᛖᛗᚱᚲᚷᚠᛟ",
  composite: " ·∙ᛁᚾᛃ•ᚱᛒ○ᛖ◉▒ᛟ▓█",
};

// Zone-based composite: guarantees different character families per luminance zone.
// Pass as opts.charZones — overrides opts.charPalette for char selection.
// Each zone: { maxLum, chars } — chars auto-calibrated by pixel coverage within the zone.
// colorTint: [r, g, b, strength 0-1] — blends zone color toward a target hue.
// Keep strength ≤ 0.15 so it works as atmosphere for any creature, not a hard color override.
export const COMPOSITE_PALETTES = {
  arcane: [
    { maxLum: 0.15, chars: " ·∙ᛁ",  colorTint: [8, 5, 2, 0.12]     },  // dark:      deepen shadows, hint of warmth
    { maxLum: 0.40, chars: "ᚾᛃᚱ•",  colorTint: [120, 72, 18, 0.10]  },  // shadow:    anchor dark amber (scales)
    { maxLum: 0.65, chars: "ᛒ○ᛖ◉",  colorTint: [195, 148, 48, 0.08] },  // body:      warm mid push
    { maxLum: 1.00, chars: "▒ᛟ▓█",  colorTint: [252, 224, 112, 0.13] }, // highlight: push bright areas toward gold
  ],
};
// Shape-vector palette — ~80 chars spanning all visual families.
// Used with useShapeVector:true for shape-aware char selection.
// Chars chosen to have diverse 6-zone ink distributions:
//   verticals (l|I!), diagonals (/\vV^), wide (wmnu), curved (csoO),
//   crosses (+*x#@), blocks (░▒▓█), organic (•◉○), runes (ᚾᛁᚱ)
export const SHAPE_PALETTE = [
  // sparse / near-empty
  ' ', '·', '.', "'", '`', ',', ':', ';',
  // horizontals
  '-', '_', '~',
  // verticals
  '|', 'l', 'I', '!', 'i', '1', 'ᛁ',
  // diagonals NE-SW
  '/', 'v', 'V',
  // diagonals NW-SE
  '\\', '^', 'A',
  // top-heavy
  'T', 'r', '7', 'f',
  // bottom-heavy / wide bottom
  'w', 'W', 'u', 'U', 'n', 'm',
  // left-curves
  ')', '}', ']', 'J', 'j',
  // right-curves
  '(', '{', '[', 'b', 'd',
  // open-right curves
  'c', 'C', '<', 'ᚾ',
  // open-left curves
  's', 'S', '>', 'ᚱ',
  // symmetric medium
  'o', 'O', '0', 'e', 'p', 'q',
  // crosses / stars
  '+', '*', 'x', 'X', '†', '‡', '÷',
  // medium-dense mixed
  'k', 'K', 'y', 'Y', 'z', 'Z', 'h', 'H',
  'g', '&', '$', '%',
  // runes (medium density, interesting shapes)
  'ᛃ', 'ᛒ', 'ᛖ', 'ᛟ', 'ᚷ', 'ᚠ',
  // organic Unicode
  '•', '◦', '○', '◉', '●',
  // half-blocks (strong directional)
  '▀', '▄', '▌', '▐',
  '▖', '▗', '▘', '▝',
  // dense fills
  '░', '▒', '▓', '█',
  // dense ASCII
  '#', '@', 'B', 'M', '8',
];

const EDGE_CHARS = ['-', '/', '|', '\\', '-', '/', '|', '\\'];
const EDGE_GRADIENT_THRESHOLD = 0.08;
const TEMPLATE_RES = 512;
const CONTOUR_BLACK_THRESHOLD = 8;
const CONTOUR_BOOST = 2.2;
const TEMPLATE_BRIGHTNESS_BOOST = 1.8;
const DEPTH_LAYERS = 3;
const DEPTH_OFFSET = 1.5;
const GAMMA = 0.50;
const GLOW_LUM_THRESHOLD = 0.72;
const GLOW_BLUR_BASE = 6;
const GLOW_BLUR_MAX = 14;
const BG_FILL_BRIGHTNESS = 0.30;
const BG_FILL_ALPHA = 0.35;

const charBrightnessCache = new Map();
const charShapeCache = new Map();

function buildCharBrightness(palette) {
  if (charBrightnessCache.has(palette)) return charBrightnessCache.get(palette);
  const canvas = document.createElement('canvas');
  const size = 16;
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const result = Array.from(palette).map((char) => {
    ctx.clearRect(0, 0, size, size);
    ctx.fillStyle = '#fff';
    ctx.font = `400 ${size}px ${FONT}`;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';
    ctx.fillText(char, size / 2, size / 2);
    const imageData = ctx.getImageData(0, 0, size, size);
    let sum = 0;
    for (let i = 3; i < imageData.data.length; i += 4) sum += imageData.data[i];
    return sum / (size * size * 255);
  });
  charBrightnessCache.set(palette, result);
  return result;
}

// 6-zone shape vector: [TL, TC, TR, BL, BC, BR] ink density per zone.
// Zones split horizontally into thirds, vertically into halves.
// Each value is average alpha coverage 0-1. Cached per palette string.
// Must be called after fonts are loaded (document.fonts.ready).
function buildCharShapeVector(paletteArr) {
  const key = Array.isArray(paletteArr) ? paletteArr.join('') : paletteArr;
  if (charShapeCache.has(key)) return charShapeCache.get(key);
  const size = 16;
  const c = document.createElement('canvas');
  c.width = size; c.height = size;
  const ctx = c.getContext('2d');
  const chars = Array.isArray(paletteArr) ? paletteArr : Array.from(paletteArr);
  const x1 = Math.floor(size / 3), x2 = Math.floor(size * 2 / 3);
  const yMid = size / 2;

  const result = chars.map(char => {
    ctx.clearRect(0, 0, size, size);
    ctx.fillStyle = '#fff';
    ctx.font = `400 ${size}px ${FONT}`;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';
    ctx.fillText(char, size / 2, size / 2);
    const d = ctx.getImageData(0, 0, size, size).data;

    let tl = 0, tc = 0, tr = 0, bl = 0, bc = 0, br = 0;
    let tlN = 0, tcN = 0, trN = 0, blN = 0, bcN = 0, brN = 0;
    let totalAlpha = 0;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const a = d[(y * size + x) * 4 + 3] / 255;
        totalAlpha += a;
        if (y < yMid) {
          if (x < x1)       { tl += a; tlN++; }
          else if (x < x2)  { tc += a; tcN++; }
          else               { tr += a; trN++; }
        } else {
          if (x < x1)       { bl += a; blN++; }
          else if (x < x2)  { bc += a; bcN++; }
          else               { br += a; brN++; }
        }
      }
    }
    const brightness = totalAlpha / (size * size);
    const shape = new Float32Array([
      tlN ? tl / tlN : 0,
      tcN ? tc / tcN : 0,
      trN ? tr / trN : 0,
      blN ? bl / blN : 0,
      bcN ? bc / bcN : 0,
      brN ? br / brN : 0,
    ]);
    return { char, brightness, shape };
  });

  charShapeCache.set(key, result);
  return result;
}

// -- Noise --
function hash2d(x, y) {
  let n = x * 374761393 + y * 668265263;
  n = ((n ^ (n >> 13)) * 1274126177) | 0;
  return ((n ^ (n >> 16)) & 0x7fffffff) / 0x7fffffff * 2 - 1;
}
function smoothstep(t) { return t * t * (3 - 2 * t); }
function valueNoise(x, y) {
  const ix = Math.floor(x), iy = Math.floor(y);
  const fx = smoothstep(x - ix), fy = smoothstep(y - iy);
  const v00 = hash2d(ix, iy), v10 = hash2d(ix + 1, iy);
  const v01 = hash2d(ix, iy + 1), v11 = hash2d(ix + 1, iy + 1);
  return (v00 + (v10 - v00) * fx) + ((v01 + (v11 - v01) * fx) - (v00 + (v10 - v00) * fx)) * fy;
}
function surfaceNoise(x, y) {
  return valueNoise(x * 0.15, y * 0.15) * 0.6 + valueNoise(x * 0.6, y * 0.6) * 0.4;
}

// -- Template post-processing --
function applyBrightnessBoost(pixels, w, h, boost) {
  const mul = boost ?? TEMPLATE_BRIGHTNESS_BOOST;
  for (let i = 0; i < w * h; i++) {
    const idx = i * 4;
    const lum = 0.299 * pixels[idx] + 0.587 * pixels[idx + 1] + 0.114 * pixels[idx + 2];
    if (lum < CONTOUR_BLACK_THRESHOLD) continue;
    pixels[idx] = Math.min(255, Math.floor(pixels[idx] * mul));
    pixels[idx + 1] = Math.min(255, Math.floor(pixels[idx + 1] * mul));
    pixels[idx + 2] = Math.min(255, Math.floor(pixels[idx + 2] * mul));
  }
}

function applyNoiseTexture(pixels, w, h) {
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4;
      const lum = 0.299 * pixels[idx] + 0.587 * pixels[idx + 1] + 0.114 * pixels[idx + 2];
      if (lum < CONTOUR_BLACK_THRESHOLD) continue;
      const noise = surfaceNoise(x, y);
      const amplitude = 0.15 + (lum / 255) * 0.10;
      const mod = 1 + noise * amplitude;
      pixels[idx] = Math.min(255, Math.max(0, Math.floor(pixels[idx] * mod)));
      pixels[idx + 1] = Math.min(255, Math.max(0, Math.floor(pixels[idx + 1] * mod)));
      pixels[idx + 2] = Math.min(255, Math.max(0, Math.floor(pixels[idx + 2] * mod)));
    }
  }
}

function applyContourBrightening(pixels, w, h) {
  const nonBlack = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const idx = i * 4;
    const lum = 0.299 * pixels[idx] + 0.587 * pixels[idx + 1] + 0.114 * pixels[idx + 2];
    nonBlack[i] = lum >= CONTOUR_BLACK_THRESHOLD ? 1 : 0;
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (!nonBlack[i]) continue;
      let edgeDist = 0;
      for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
        const nx1 = x + dx, ny1 = y + dy;
        if (nx1 < 0 || nx1 >= w || ny1 < 0 || ny1 >= h || !nonBlack[ny1 * w + nx1]) { edgeDist = 2; break; }
        const nx2 = x + dx * 2, ny2 = y + dy * 2;
        if (nx2 < 0 || nx2 >= w || ny2 < 0 || ny2 >= h || !nonBlack[ny2 * w + nx2]) { if (edgeDist < 1) edgeDist = 1; }
      }
      if (edgeDist > 0) {
        const boost = edgeDist === 2 ? CONTOUR_BOOST : 1 + (CONTOUR_BOOST - 1) * 0.5;
        const idx = i * 4;
        pixels[idx] = Math.min(255, Math.floor(pixels[idx] * boost));
        pixels[idx + 1] = Math.min(255, Math.floor(pixels[idx + 1] * boost));
        pixels[idx + 2] = Math.min(255, Math.floor(pixels[idx + 2] * boost));
      }
    }
  }
}

// -- Sampling --
function sampleColor(data, imgW, imgH, col, row, cols, rows) {
  const x0 = Math.floor((col / cols) * imgW);
  const y0 = Math.floor((row / rows) * imgH);
  const x1 = Math.max(x0 + 1, Math.ceil(((col + 1) / cols) * imgW));
  const y1 = Math.max(y0 + 1, Math.ceil(((row + 1) / rows) * imgH));
  let rSum = 0, gSum = 0, bSum = 0, count = 0;
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
    const idx = (y * imgW + x) * 4;
    rSum += data[idx]; gSum += data[idx + 1]; bSum += data[idx + 2]; count++;
  }
  if (count === 0) return { r: 0, g: 0, b: 0, lum: 0 };
  const r = rSum / count, g = gSum / count, b = bSum / count;
  return { r: r / 255, g: g / 255, b: b / 255, lum: (0.299 * r + 0.587 * g + 0.114 * b) / 255 };
}

function sampleLuminance(data, imgW, imgH, col, row, cols, rows) {
  const x0 = Math.floor((col / cols) * imgW);
  const y0 = Math.floor((row / rows) * imgH);
  const x1 = Math.max(x0 + 1, Math.ceil(((col + 1) / cols) * imgW));
  const y1 = Math.max(y0 + 1, Math.ceil(((row + 1) / rows) * imgH));
  let sum = 0, count = 0;
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
    const idx = (y * imgW + x) * 4;
    sum += 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2]; count++;
  }
  return count > 0 ? sum / (count * 255) : 0;
}

function computeNormals(data, imgW, imgH, cols, rows) {
  const normals = new Float32Array(cols * rows * 2);
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const bL = col > 0 ? sampleLuminance(data, imgW, imgH, col - 1, row, cols, rows) : 0;
      const bR = col < cols - 1 ? sampleLuminance(data, imgW, imgH, col + 1, row, cols, rows) : 0;
      const bU = row > 0 ? sampleLuminance(data, imgW, imgH, col, row - 1, cols, rows) : 0;
      const bD = row < rows - 1 ? sampleLuminance(data, imgW, imgH, col, row + 1, cols, rows) : 0;
      const idx = (row * cols + col) * 2;
      normals[idx] = bL - bR;
      normals[idx + 1] = bU - bD;
    }
  }
  return normals;
}

// Pre-compute 6D shape vectors for every cell in the ASCII grid.
// Returns Float32Array of length cols*rows*6 — layout: [tl,tc,tr,bl,bc,br, tl,tc,...].
// Called once per frame when useShapeVector:true, before the cell loop.
function computeShapeVectors(data, imgW, imgH, cols, rows) {
  const out = new Float32Array(cols * rows * 6);
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const x0 = Math.floor((col / cols) * imgW);
      const y0 = Math.floor((row / rows) * imgH);
      const x1 = Math.max(x0 + 1, Math.ceil(((col + 1) / cols) * imgW));
      const y1 = Math.max(y0 + 1, Math.ceil(((row + 1) / rows) * imgH));
      const midX = (x0 + x1) / 2;
      const midY = (y0 + y1) / 2;
      const xThird = x0 + (x1 - x0) / 3;
      const xTwoThird = x0 + (x1 - x0) * 2 / 3;

      let tl=0,tc=0,tr=0,bl=0,bc=0,br=0;
      let tlN=0,tcN=0,trN=0,blN=0,bcN=0,brN=0;
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          const idx = (y * imgW + x) * 4;
          const lum = (0.299 * data[idx] + 0.587 * data[idx+1] + 0.114 * data[idx+2]) / 255;
          if (y < midY) {
            if (x < xThird)      { tl += lum; tlN++; }
            else if (x < xTwoThird) { tc += lum; tcN++; }
            else                  { tr += lum; trN++; }
          } else {
            if (x < xThird)      { bl += lum; blN++; }
            else if (x < xTwoThird) { bc += lum; bcN++; }
            else                  { br += lum; brN++; }
          }
        }
      }
      const base = (row * cols + col) * 6;
      out[base]   = tlN ? tl / tlN : 0;
      out[base+1] = tcN ? tc / tcN : 0;
      out[base+2] = trN ? tr / trN : 0;
      out[base+3] = blN ? bl / blN : 0;
      out[base+4] = bcN ? bc / bcN : 0;
      out[base+5] = brN ? br / brN : 0;
    }
  }
  return out;
}

function getWeight(level, isBoss, brightness) {
  if (isBoss || level >= 10) return brightness < 0.3 ? 600 : 700;
  if (level >= 7) return brightness < 0.25 ? 400 : brightness < 0.55 ? 600 : 700;
  if (level >= 4) return brightness < 0.3 ? 400 : 600;
  return brightness < 0.4 ? 400 : brightness < 0.7 ? 400 : 600;
}

// ==========================================================================
// Public: render a template draw function through the full ASCII pipeline
// ==========================================================================
export function renderAscii(ctx, drawFn, x, y, width, height, opts = {}) {
  const {
    elapsed = 0,
    cellSize = 4,
    level = 1,
    isBoss = false,
    gridWidth = 5,
    gridHeight = 4,
    brightnessBoost,
    gamma = GAMMA,
    ambient = 0.70,
    charDensityFloor = 0.30,
    enable3D = true,
    enableHalfBlock = true,
    charPalette = CHAR_PALETTE,
    charZones = null,
    useShapeVector = false,
  } = opts;

  // Shape vector mode: use SHAPE_PALETTE by default when useShapeVector is on
  const effectivePalette = useShapeVector ? (charPalette === CHAR_PALETTE ? SHAPE_PALETTE.join('') : charPalette) : charPalette;
  const charBrightness = (charZones || useShapeVector) ? null : buildCharBrightness(effectivePalette);
  // Shape vectors are calibrated lazily on first use; precomputed grid built after template stage
  const charVectors = useShapeVector ? buildCharShapeVector(SHAPE_PALETTE) : null;

  if (width < 20 || height < 20) return;

  // -- Template stage --
  const tw = TEMPLATE_RES;
  const th = Math.round(TEMPLATE_RES * gridHeight / gridWidth);
  const tc = document.createElement('canvas');
  tc.width = tw; tc.height = th;
  const tctx = tc.getContext('2d');
  tctx.fillStyle = '#000';
  tctx.fillRect(0, 0, tw, th);
  drawFn(tctx, tw, th);

  const tplData = tctx.getImageData(0, 0, tw, th);
  applyBrightnessBoost(tplData.data, tw, th, brightnessBoost);
  applyNoiseTexture(tplData.data, tw, th);
  applyContourBrightening(tplData.data, tw, th);

  // -- Grid sizing --
  const cellW = Math.max(3, cellSize);
  const cellH = cellW * 1.25;
  const maxCols = Math.floor(width / cellW);
  const maxRows = Math.floor(height / cellH);
  const templateAspect = gridWidth / gridHeight;
  let cols, rows;
  if (maxCols / maxRows > templateAspect) { rows = maxRows; cols = Math.round(rows * templateAspect); }
  else { cols = maxCols; rows = Math.round(cols / templateAspect); }
  cols = Math.max(10, cols); rows = Math.max(6, rows);

  const actualCellW = Math.min(width / cols, height / (rows * 1.25));
  const actualCellH = actualCellW * 1.25;
  const renderW = cols * actualCellW;
  const renderH = rows * actualCellH;

  // -- 3D params --
  const bobY = enable3D ? Math.sin(elapsed * 0.0018) * 3 : 0;
  const swayX = enable3D ? Math.sin(elapsed * 0.0013) * 1.5 : 0;
  const breathScale = enable3D ? 1 + Math.sin(elapsed * 0.0025) * 0.012 : 1;
  const perspectiveAmount = enable3D ? 0.12 : 0;

  const lightAngle = elapsed * 0.0008;
  const lxRaw = Math.cos(lightAngle) * 0.6;
  const lyRaw = -0.3 + Math.sin(lightAngle * 0.7) * 0.2;
  const lzRaw = 0.7;
  const lightLen = Math.sqrt(lxRaw * lxRaw + lyRaw * lyRaw + lzRaw * lzRaw);
  const lx = lxRaw / lightLen, ly = lyRaw / lightLen, lz = lzRaw / lightLen;

  const centerX = x + (width - renderW) / 2 + swayX;
  const centerY = y + (height - renderH) / 2 + bobY;

  const normals = computeNormals(tplData.data, tw, th, cols, rows);
  // Pre-compute per-cell shape vectors once (only in shape vector mode)
  const shapeVectors = useShapeVector ? computeShapeVectors(tplData.data, tw, th, cols, rows) : null;
  const fontSize = actualCellW * 1.2;
  const brightness = charBrightness;
  const palette = effectivePalette;

  // -- Ground shadow (3D mode only) --
  if (enable3D) {
    ctx.save();
    const shadowH = renderH * 0.1;
    const shadowY = centerY + renderH * breathScale + shadowH * 0.5;
    const shadowW = renderW * 0.65;
    ctx.globalAlpha = 0.12;
    ctx.fillStyle = 'rgb(20, 15, 10)';
    ctx.beginPath();
    ctx.ellipse(centerX + renderW / 2, shadowY, shadowW / 2, shadowH / 2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // -- Build cells --
  const cells = [];
  const gridIndex = new Int32Array(cols * rows).fill(-1);
  const lumGrid = new Float32Array(cols * rows);

  for (let row = 0; row < rows; row++) {
    const rowT = row / (rows - 1 || 1);
    const perspScale = 1 - perspectiveAmount * (1 - rowT);
    const breathOffsetY = (1 - breathScale) * (rows - row) * actualCellH * 0.5;
    const rowW = renderW * perspScale;
    const rowOffsetX = centerX + (renderW - rowW) / 2;
    const rowCellW = rowW / cols;
    const rowCellH = actualCellH * breathScale;
    const drawY = centerY + row * rowCellH + breathOffsetY;

    for (let col = 0; col < cols; col++) {
      const color = sampleColor(tplData.data, tw, th, col, row, cols, rows);
      if (color.lum < 0.02) continue;

      // Lighting
      let lightMul = 1.0;
      const nIdx = (row * cols + col) * 2;
      const nx = normals[nIdx], ny = normals[nIdx + 1], nz = 0.5;
      const nLen = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
      const dot = (nx / nLen) * lx + (ny / nLen) * ly + (nz / nLen) * lz;
      lightMul = ambient + Math.max(0, dot) * (1 - ambient);
      if (color.lum > 0.10) {
        const hx = lx, hy = ly, hz = lz + 1;
        const hLen = Math.sqrt(hx * hx + hy * hy + hz * hz) || 1;
        const spec = Math.max(0, (nx / nLen) * (hx / hLen) + (ny / nLen) * (hy / hLen) + (nz / nLen) * (hz / hLen));
        lightMul += Math.pow(spec, 5) * 0.6;
      }
      lightMul = Math.min(2.0, Math.max(0, lightMul));

      const litLum = Math.min(1, color.lum * lightMul);
      const charLum = Math.max(charDensityFloor, litLum);
      let char;
      let selectedZone = null;

      if (useShapeVector && shapeVectors) {
        // 6D shape vector nearest-neighbor: filter by brightness (±0.28), then closest shape
        const base = (row * cols + col) * 6;
        const s0=shapeVectors[base],s1=shapeVectors[base+1],s2=shapeVectors[base+2];
        const s3=shapeVectors[base+3],s4=shapeVectors[base+4],s5=shapeVectors[base+5];
        let bestChar = ' ';
        let bestDist = Infinity;
        const LUM_TOL = 0.28;
        for (let ci = 0; ci < charVectors.length; ci++) {
          const cv = charVectors[ci];
          if (Math.abs(cv.brightness - charLum) > LUM_TOL) continue;
          const cs = cv.shape;
          const dist = (s0-cs[0])**2 + (s1-cs[1])**2 + (s2-cs[2])**2
                     + (s3-cs[3])**2 + (s4-cs[4])**2 + (s5-cs[5])**2;
          if (dist < bestDist) { bestDist = dist; bestChar = cv.char; }
        }
        // fallback: if nothing matched within tolerance, use nearest brightness
        if (bestChar === ' ' && charVectors.length > 0) {
          let bestDiff = 1;
          for (let ci = 0; ci < charVectors.length; ci++) {
            const diff = Math.abs(charVectors[ci].brightness - charLum);
            if (diff < bestDiff) { bestDiff = diff; bestChar = charVectors[ci].char; }
          }
        }
        char = bestChar;
      } else if (charZones) {
        selectedZone = charZones.find(z => charLum <= z.maxLum) ?? charZones[charZones.length - 1];
        const zb = buildCharBrightness(selectedZone.chars);
        let bestIdx = 0, bestDiff = 1;
        for (let i = 0; i < zb.length; i++) {
          const diff = Math.abs(zb[i] - charLum);
          if (diff < bestDiff) { bestDiff = diff; bestIdx = i; }
        }
        char = selectedZone.chars[bestIdx];
      } else {
        let bestIdx = 0, bestDiff = 1;
        for (let i = 0; i < brightness.length; i++) {
          const diff = Math.abs(brightness[i] - charLum);
          if (diff < bestDiff) { bestDiff = diff; bestIdx = i; }
        }
        char = palette[bestIdx];
      }
      if (char === ' ') continue;

      const waveX = Math.sin(elapsed * 0.003 + col * 0.4 + row * 0.3) * 0.4 + Math.sin(elapsed * 0.0017 + col * 0.23 + row * 0.17) * 0.2;
      const waveY = Math.cos(elapsed * 0.0025 + col * 0.3 + row * 0.5) * 0.3 + Math.cos(elapsed * 0.0013 + col * 0.19 + row * 0.31) * 0.15;

      const weight = getWeight(level, isBoss, litLum);
      const drawFontSize = fontSize * perspScale;
      const cellX = rowOffsetX + col * rowCellW + rowCellW / 2 + waveX;
      const cellY = drawY + rowCellH / 2 + waveY;

      let litR = color.r * lightMul, litG = color.g * lightMul, litB = color.b * lightMul;
      if (selectedZone?.colorTint) {
        const [tr, tg, tb, ts] = selectedZone.colorTint;
        litR = litR * (1 - ts) + (tr / 255) * ts;
        litG = litG * (1 - ts) + (tg / 255) * ts;
        litB = litB * (1 - ts) + (tb / 255) * ts;
      }
      const r = Math.min(255, Math.floor(Math.pow(Math.min(1, litR), gamma) * 255));
      const g = Math.min(255, Math.floor(Math.pow(Math.min(1, litG), gamma) * 255));
      const b = Math.min(255, Math.floor(Math.pow(Math.min(1, litB), gamma) * 255));
      const a = 0.75 + litLum * 0.25;

      const cellIdx = cells.length;
      cells.push({ char, x: cellX, y: cellY, r, g, b, a, weight, fontSize: drawFontSize, cellW: rowCellW, cellH: rowCellH, isInterior: false });
      gridIndex[row * cols + col] = cellIdx;
      lumGrid[row * cols + col] = color.lum;
    }
  }

  // -- Edge detection + rim lighting --
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const idx = gridIndex[row * cols + col];
      if (idx < 0) continue;
      let emptyNeighbors = 0;
      for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        const nr = row + dr, nc = col + dc;
        if (nr < 0 || nr >= rows || nc < 0 || nc >= cols || gridIndex[nr * cols + nc] < 0) emptyNeighbors++;
      }
      const cell = cells[idx];
      if (emptyNeighbors === 0) { cell.isInterior = enableHalfBlock; continue; }
      const rimStrength = Math.min(1, emptyNeighbors / 3);
      const rowNorm = (row / (rows - 1 || 1)) * 2 - 1;
      const colNorm = (col / (cols - 1 || 1)) * 2 - 1;
      const facingLight = -(rowNorm * ly + colNorm * lx);
      const warmCool = Math.max(-1, Math.min(1, facingLight));
      const boost = 1 + rimStrength * 1.2;
      if (warmCool > 0) {
        const wa = warmCool * rimStrength * 0.4;
        cell.r = Math.min(255, Math.floor(cell.r * boost + wa * 80));
        cell.g = Math.min(255, Math.floor(cell.g * boost + wa * 40));
        cell.b = Math.min(255, Math.floor(cell.b * (boost * 0.7)));
      } else {
        const ca = -warmCool * rimStrength * 0.3;
        cell.r = Math.min(255, Math.floor(cell.r * (boost * 0.8)));
        cell.g = Math.min(255, Math.floor(cell.g * (boost * 0.85)));
        cell.b = Math.min(255, Math.floor(cell.b * boost + ca * 60));
      }
      cell.a = Math.min(1, cell.a + rimStrength * 0.35);

      const gIdx = row * cols + col;
      const lumL = col > 0 ? lumGrid[gIdx - 1] : 0;
      const lumR = col < cols - 1 ? lumGrid[gIdx + 1] : 0;
      const lumU = row > 0 ? lumGrid[gIdx - cols] : 0;
      const lumD = row < rows - 1 ? lumGrid[gIdx + cols] : 0;
      const gx = lumR - lumL, gy = lumD - lumU;
      const gradMag = Math.sqrt(gx * gx + gy * gy);
      if (gradMag > EDGE_GRADIENT_THRESHOLD) {
        const angle = Math.atan2(gy, gx) + Math.PI / 2;
        const quantized = ((Math.round(angle / (Math.PI / 4)) % 8) + 8) % 8;
        cell.char = EDGE_CHARS[quantized];
      }
    }
  }

  // -- Background fill --
  for (const c of cells) {
    const bgR = Math.floor(c.r * BG_FILL_BRIGHTNESS);
    const bgG = Math.floor(c.g * BG_FILL_BRIGHTNESS);
    const bgB = Math.floor(c.b * BG_FILL_BRIGHTNESS);
    ctx.fillStyle = `rgba(${bgR},${bgG},${bgB},${c.a * BG_FILL_ALPHA})`;
    ctx.fillRect(c.x - c.cellW * 0.5, c.y - c.cellH * 0.5, c.cellW, c.cellH);
  }

  // -- Depth extrusion (3D mode only) --
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';
  if (enable3D) {
    for (let layer = DEPTH_LAYERS; layer >= 1; layer--) {
      const ox = layer * DEPTH_OFFSET, oy = layer * DEPTH_OFFSET;
      const darken = 0.15 + (DEPTH_LAYERS - layer) * 0.05;
      const layerAlpha = 0.25 - layer * 0.05;
      for (const c of cells) {
        const dr = Math.floor(c.r * darken), dg = Math.floor(c.g * darken), db = Math.floor(c.b * darken);
        const da = c.a * layerAlpha;
        if (c.isInterior) {
          ctx.fillStyle = `rgba(${dr},${dg},${db},${da})`;
          ctx.fillRect(c.x - c.cellW * 0.5 + ox, c.y - c.cellH * 0.5 + oy, c.cellW, c.cellH);
        } else {
          ctx.font = `${c.weight} ${c.fontSize}px ${FONT}`;
          ctx.fillStyle = `rgba(${dr},${dg},${db},${da})`;
          ctx.fillText(c.char, c.x + ox, c.y + oy);
        }
      }
    }
  }

  // -- Main render --
  for (const c of cells) {
    if (c.isInterior) {
      ctx.fillStyle = `rgba(${c.r},${c.g},${c.b},${c.a})`;
      ctx.fillRect(c.x - c.cellW * 0.5, c.y - c.cellH * 0.5, c.cellW, c.cellH);
    } else {
      ctx.font = `${c.weight} ${c.fontSize}px ${FONT}`;
      ctx.fillStyle = `rgba(${c.r},${c.g},${c.b},${c.a})`;
      ctx.fillText(c.char, c.x, c.y);
    }
  }

  // -- Glow pass --
  ctx.save();
  for (const c of cells) {
    const cellLum = (0.299 * c.r + 0.587 * c.g + 0.114 * c.b) / 255;
    if (cellLum < GLOW_LUM_THRESHOLD) continue;
    const glowT = (cellLum - GLOW_LUM_THRESHOLD) / (1 - GLOW_LUM_THRESHOLD);
    const blur = GLOW_BLUR_BASE + glowT * (GLOW_BLUR_MAX - GLOW_BLUR_BASE);
    ctx.shadowColor = `rgba(${c.r},${c.g},${c.b},${0.5 + glowT * 0.3})`;
    ctx.shadowBlur = blur;
    if (c.isInterior) {
      const gr = Math.min(255, c.r + 30), gg = Math.min(255, c.g + 30), gb = Math.min(255, c.b + 30);
      ctx.fillStyle = `rgba(${gr},${gg},${gb},${c.a * 0.6})`;
      ctx.fillRect(c.x - c.cellW * 0.3, c.y - c.cellH * 0.3, c.cellW * 0.6, c.cellH * 0.6);
    } else {
      ctx.font = `${c.weight} ${c.fontSize}px ${FONT}`;
      ctx.fillStyle = `rgba(${c.r},${c.g},${c.b},${c.a * 0.7})`;
      ctx.fillText(c.char, c.x, c.y);
    }
  }
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.restore();
}
