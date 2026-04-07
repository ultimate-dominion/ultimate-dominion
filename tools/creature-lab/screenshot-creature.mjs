#!/usr/bin/env node
// ==========================================================================
// screenshot-creature.mjs — Headless screenshot pipeline for creature lab
//
// Renders any creature (GLB or canvas) via headless Chrome + viewer.html,
// capturing each panel and animation frame strips as PNGs.
//
// This gives the AI agent "eyes" — it can render, read the PNGs, evaluate
// quality against reference images, and iterate autonomously.
//
// Usage:
//   node screenshot-creature.mjs <slug>                    — all panels + anim strip
//   node screenshot-creature.mjs <slug> --panels-only      — just the 4 panels
//   node screenshot-creature.mjs <slug> --anim-only        — just animation strips
//   node screenshot-creature.mjs <slug> --clip attack      — single clip strip
//   node screenshot-creature.mjs <slug> --composite        — single composite image
//   node screenshot-creature.mjs --all                     — every creature
//
// Outputs:
//   renders/<slug>-3d-raw.png        — 3D rendered model (or skeleton wireframe)
//   renders/<slug>-ascii.png         — ASCII art panel
//   renders/<slug>-painted.png       — Painted 2D art (canvas creatures only)
//   renders/<slug>-game-view.png     — Game view panel (what players see)
//   renders/<slug>-anim-<clip>.png   — Animation strip (6 frames per clip)
//   renders/<slug>-composite.png     — All panels + ref in one image
//   renders/<slug>-ref.<ext>         — Reference image (copied)
// ==========================================================================

import puppeteer from 'puppeteer';
import { createServer } from 'http';
import { readFileSync, writeFileSync, mkdirSync, existsSync, copyFileSync } from 'fs';
import { resolve, dirname, extname, join } from 'path';
import { fileURLToPath } from 'url';
import { createCanvas, loadImage } from 'canvas';

const __dirname = dirname(fileURLToPath(import.meta.url));
const RENDERS_DIR = resolve(__dirname, 'renders');
mkdirSync(RENDERS_DIR, { recursive: true });

// --------------------------------------------------------------------------
// Creature registry (mirrors viewer.html CREATURES array)
// --------------------------------------------------------------------------
const CREATURES = [
  { slug: 'dire-rat',        type: 'glb', ref: 'refs/rat-ref.png',              labGrid: { w: 10, h: 7 }  },
  { slug: 'kobold',          type: 'glb', ref: 'refs/kobold-ref.webp',          labGrid: { w: 7,  h: 7 }  },
  { slug: 'goblin',          type: 'glb', ref: 'refs/goblin-ref.webp',          labGrid: { w: 7,  h: 7 }  },
  { slug: 'giant-spider',    type: 'js',  ref: 'refs/giant-spider-ref.jpg',     labGrid: { w: 7,  h: 5 }  },
  { slug: 'skeleton-creature', type: 'glb', ref: 'refs/skeleton-ref.webp',      labGrid: { w: 7,  h: 7 }  },
  { slug: 'goblin-shaman',   type: 'glb', ref: 'refs/goblin-shaman-ref.webp',   labGrid: { w: 7,  h: 7 }  },
  { slug: 'gelatinous-ooze', type: 'js',  ref: 'refs/gelatinous-ooze-ref.webp', labGrid: { w: 7,  h: 7 }  },
  { slug: 'bugbear',         type: 'glb', ref: 'refs/bugbear-ref.webp',         labGrid: { w: 7,  h: 7 }  },
  { slug: 'carrion-crawler', type: 'js',  ref: 'refs/carrion-crawler-ref.webp', labGrid: { w: 10, h: 13 } },
  { slug: 'hook-horror',     type: 'js',  ref: 'refs/hook-horror-ref.webp',     labGrid: { w: 14, h: 12 } },
  { slug: 'basilisk',        type: 'js',  ref: 'refs/basilisk-ref.png',         labGrid: { w: 12, h: 8 }  },
];

const STANDARD_CLIPS = ['idle', 'attack', 'death', 'hit', 'walk'];
const ANIM_FRAMES_PER_CLIP = 6;
const ANIM_FRAME_DELAY_MS = 250; // time between frame captures (let mixer advance)

// --------------------------------------------------------------------------
// Static file server (viewer.html needs to be served, not file://)
// --------------------------------------------------------------------------
const MIME = {
  '.html': 'text/html', '.js': 'application/javascript', '.mjs': 'application/javascript',
  '.css': 'text/css', '.json': 'application/json', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp',
  '.glb': 'model/gltf-binary', '.woff2': 'font/woff2', '.svg': 'image/svg+xml',
};

function startServer(port = 0) {
  return new Promise((res) => {
    const server = createServer((req, resp) => {
      const url = new URL(req.url, `http://localhost`);
      const filePath = resolve(__dirname, '.' + decodeURIComponent(url.pathname));
      try {
        const data = readFileSync(filePath);
        const ext = extname(filePath).toLowerCase();
        resp.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
        resp.end(data);
      } catch {
        resp.writeHead(404);
        resp.end('Not found');
      }
    });
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      res({ server, port: addr.port });
    });
  });
}

// --------------------------------------------------------------------------
// Screenshot helpers
// --------------------------------------------------------------------------

async function waitForCreatureLoad(page, slug, isGLB) {
  // Wait for the creature name to appear in the header
  await page.waitForFunction(
    (name) => {
      const el = document.getElementById('creature-name');
      return el && el.textContent.trim().length > 1;
    },
    { timeout: 15000 },
  );

  // For GLB creatures, wait for the status message to clear (loading... → '')
  if (isGLB) {
    await page.waitForFunction(
      () => {
        const msg = document.getElementById('status-msg');
        return msg && !msg.textContent.includes('loading');
      },
      { timeout: 30000 },
    );
    // Extra settle time for Three.js first render
    await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
  }

  // Let the render settle
  await new Promise(r => setTimeout(r, 500));
}

async function screenshotPanel(page, canvasId, outputPath) {
  const el = await page.$(`#${canvasId}`);
  if (!el) {
    console.warn(`  Canvas #${canvasId} not found — skipping`);
    return false;
  }
  await el.screenshot({ path: outputPath, type: 'png' });
  return true;
}

async function captureAnimationStrip(page, clip, framesCount, outputPath) {
  // Switch to the clip
  const hasClip = await page.evaluate((clipName) => {
    const sel = document.getElementById('clip-select');
    const opts = Array.from(sel.options).map(o => o.value);
    if (!opts.includes(clipName)) return false;
    sel.value = clipName;
    sel.dispatchEvent(new Event('change'));
    return true;
  }, clip);

  if (!hasClip) return false;

  // Enable animation if not already
  await page.evaluate(() => {
    const cb = document.getElementById('animate');
    if (!cb.checked) { cb.checked = true; cb.dispatchEvent(new Event('change')); }
  });

  // Wait for the animation to start
  await new Promise(r => setTimeout(r, 300));

  // Capture frames
  const frames = [];
  for (let i = 0; i < framesCount; i++) {
    await new Promise(r => setTimeout(r, ANIM_FRAME_DELAY_MS));
    const buf = await page.$eval('#next-ascii', (canvas) => {
      return canvas.toDataURL('image/png');
    });
    frames.push(buf);
  }

  // Composite frames into a horizontal strip using node-canvas
  if (frames.length === 0) return false;

  // Get dimensions from the first frame
  const firstImg = await loadImage(Buffer.from(frames[0].split(',')[1], 'base64'));
  const fw = firstImg.width;
  const fh = firstImg.height;
  const stripCanvas = createCanvas(fw * frames.length, fh);
  const ctx = stripCanvas.getContext('2d');
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, stripCanvas.width, stripCanvas.height);

  for (let i = 0; i < frames.length; i++) {
    const img = await loadImage(Buffer.from(frames[i].split(',')[1], 'base64'));
    ctx.drawImage(img, i * fw, 0);
    // Draw frame number
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = '11px monospace';
    ctx.fillText(`f${i + 1}`, i * fw + 4, 14);
  }

  // Vertical dividers between frames
  ctx.strokeStyle = 'rgba(255,255,255,0.15)';
  ctx.lineWidth = 1;
  for (let i = 1; i < frames.length; i++) {
    ctx.beginPath();
    ctx.moveTo(i * fw, 0);
    ctx.lineTo(i * fw, fh);
    ctx.stroke();
  }

  writeFileSync(outputPath, stripCanvas.toBuffer('image/png'));
  return true;
}

async function buildComposite(slug, creature) {
  // Build a single composite image: 2x2 panels + reference on the right
  const files = [
    { path: resolve(RENDERS_DIR, `${slug}-3d-raw.png`), label: '3D Raw / Skeleton' },
    { path: resolve(RENDERS_DIR, `${slug}-ascii.png`), label: 'ASCII' },
    { path: resolve(RENDERS_DIR, `${slug}-painted.png`), label: 'Painted' },
    { path: resolve(RENDERS_DIR, `${slug}-game-view.png`), label: 'Game View' },
  ];
  const refPath = resolve(__dirname, creature.ref);

  const existing = files.filter(f => existsSync(f.path));
  if (existing.length === 0) return;

  const panelImgs = [];
  for (const f of existing) {
    panelImgs.push({ img: await loadImage(f.path), label: f.label });
  }

  let refImg = null;
  if (existsSync(refPath)) {
    try { refImg = await loadImage(refPath); } catch { /* skip */ }
  }

  // Layout: 2x2 grid at 512px each + optional 256px ref strip on right
  const PW = 512;
  const PH = 512;
  const refW = refImg ? 256 : 0;
  const compositeW = PW * 2 + refW;
  const compositeH = PH * 2;
  const comp = createCanvas(compositeW, compositeH);
  const ctx = comp.getContext('2d');
  ctx.fillStyle = '#0a0a0a';
  ctx.fillRect(0, 0, compositeW, compositeH);

  // Draw panels
  const positions = [[0, 0], [PW, 0], [0, PH], [PW, PH]];
  for (let i = 0; i < Math.min(panelImgs.length, 4); i++) {
    const { img, label } = panelImgs[i];
    const [x, y] = positions[i];
    ctx.drawImage(img, x, y, PW, PH);
    // Label
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(x, y, PW, 20);
    ctx.fillStyle = '#888';
    ctx.font = '11px monospace';
    ctx.fillText(label, x + 6, y + 14);
  }

  // Grid lines
  ctx.strokeStyle = 'rgba(255,255,255,0.2)';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(PW, 0); ctx.lineTo(PW, compositeH); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0, PH); ctx.lineTo(PW * 2, PH); ctx.stroke();

  // Reference strip
  if (refImg) {
    const rx = PW * 2;
    ctx.fillStyle = '#111';
    ctx.fillRect(rx, 0, refW, compositeH);
    // Scale ref to fit width, center vertically
    const scale = refW / refImg.width;
    const rh = refImg.height * scale;
    const ry = Math.max(0, (compositeH - rh) / 2);
    ctx.drawImage(refImg, rx, ry, refW, rh);
    // Label
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(rx, 0, refW, 20);
    ctx.fillStyle = '#888';
    ctx.font = '11px monospace';
    ctx.fillText('Reference', rx + 6, 14);
    // Border
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.beginPath(); ctx.moveTo(rx, 0); ctx.lineTo(rx, compositeH); ctx.stroke();
  }

  // Slug + timestamp
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(0, compositeH - 22, compositeW, 22);
  ctx.fillStyle = '#555';
  ctx.font = '11px monospace';
  ctx.fillText(`${slug}  |  ${new Date().toISOString().slice(0, 19)}`, 6, compositeH - 7);

  const outPath = resolve(RENDERS_DIR, `${slug}-composite.png`);
  writeFileSync(outPath, comp.toBuffer('image/png'));
  console.log(`  composite → ${outPath}`);
}

// --------------------------------------------------------------------------
// Main
// --------------------------------------------------------------------------
async function screenshotCreature(slug, opts = {}) {
  const creature = CREATURES.find(c => c.slug === slug);
  if (!creature) {
    // Allow unknown slugs — they might be new creatures not yet in the registry
    console.warn(`  Warning: ${slug} not in registry — using defaults`);
  }
  const isGLB = creature?.type === 'glb';
  const { panelsOnly = false, animOnly = false, clipFilter = null, composite = false } = opts;

  console.log(`\nScreenshotting ${slug}${isGLB ? ' (GLB)' : ' (canvas)'}…`);

  // Start local server
  const { server, port } = await startServer();
  const baseUrl = `http://127.0.0.1:${port}`;

  let browser;
  try {
    browser = await puppeteer.launch({
      headless: true,
      executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--enable-webgl',
        '--use-gl=angle',
        '--use-angle=metal',  // macOS Metal backend for WebGL
      ],
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1400, height: 900 });

    // Navigate to viewer with creature pre-selected
    await page.goto(`${baseUrl}/viewer.html?creature=${slug}`, {
      waitUntil: 'networkidle2',
      timeout: 30000,
    });

    await waitForCreatureLoad(page, slug, isGLB);

    // For GLB creatures, ensure 3D mode is enabled
    if (isGLB) {
      await page.evaluate(() => {
        const cb = document.getElementById('use-3d');
        if (!cb.checked) { cb.checked = true; cb.dispatchEvent(new Event('change')); }
      });
      await new Promise(r => setTimeout(r, 800));
    }

    // ---- Panel screenshots ----
    if (!animOnly) {
      const panels = [
        { id: 'skel-raw',   suffix: '3d-raw' },
        { id: 'next-ascii', suffix: 'ascii' },
        { id: 'next-raw',   suffix: 'painted' },
        { id: 'game-ascii', suffix: 'game-view' },
      ];

      for (const { id, suffix } of panels) {
        const outPath = resolve(RENDERS_DIR, `${slug}-${suffix}.png`);
        const ok = await screenshotPanel(page, id, outPath);
        if (ok) console.log(`  ${suffix.padEnd(12)} → ${outPath}`);
      }

      // Copy reference image
      if (creature?.ref) {
        const refSrc = resolve(__dirname, creature.ref);
        if (existsSync(refSrc)) {
          const ext = extname(creature.ref);
          const refDest = resolve(RENDERS_DIR, `${slug}-ref${ext}`);
          copyFileSync(refSrc, refDest);
          console.log(`  ref          → ${refDest}`);
        }
      }
    }

    // ---- Animation strips ----
    if (!panelsOnly && isGLB) {
      const clips = clipFilter ? [clipFilter] : STANDARD_CLIPS;
      for (const clip of clips) {
        const outPath = resolve(RENDERS_DIR, `${slug}-anim-${clip}.png`);
        console.log(`  capturing ${clip} strip (${ANIM_FRAMES_PER_CLIP} frames)…`);
        const ok = await captureAnimationStrip(page, clip, ANIM_FRAMES_PER_CLIP, outPath);
        if (ok) console.log(`  anim-${clip.padEnd(7)} → ${outPath}`);
        else console.log(`  anim-${clip.padEnd(7)} — clip not found, skipping`);
      }
    }

    // ---- Composite ----
    if (composite || (!panelsOnly && !animOnly)) {
      await buildComposite(slug, creature || { ref: '' });
    }

  } finally {
    if (browser) await browser.close();
    server.close();
  }
}

// --------------------------------------------------------------------------
// Review page screenshot — single image with all clips at 3px game quality
// --------------------------------------------------------------------------
async function screenshotReview(slug) {
  const creature = CREATURES.find(c => c.slug === slug);
  const isGLB = creature?.type === 'glb';
  if (!isGLB) {
    console.log(`  ${slug} is not a GLB creature — review page requires GLB. Skipping.`);
    return;
  }

  console.log(`\nReview screenshot: ${slug}…`);
  const { server, port } = await startServer();
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: true,
      executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--enable-webgl', '--use-gl=angle', '--use-angle=metal'],
    });
    const page = await browser.newPage();
    await page.setViewport({ width: 1400, height: 900 });
    await page.goto(`http://127.0.0.1:${port}/review.html?creature=${slug}`, {
      waitUntil: 'networkidle2', timeout: 30000,
    });
    // Wait for all clips to finish rendering
    await page.waitForFunction(
      () => document.getElementById('loading')?.classList.contains('hidden'),
      { timeout: 60000 },
    );
    await new Promise(r => setTimeout(r, 500));

    const outPath = resolve(RENDERS_DIR, `${slug}-review.png`);
    await page.screenshot({ path: outPath, type: 'png' });
    console.log(`  review     → ${outPath}`);
  } finally {
    if (browser) await browser.close();
    server.close();
  }
}

// --------------------------------------------------------------------------
// CLI
// --------------------------------------------------------------------------
const args = process.argv.slice(2);

if (args.includes('--help') || args.length === 0) {
  console.log(`
Usage:
  node screenshot-creature.mjs <slug>                 — all panels + anim strips + composite
  node screenshot-creature.mjs <slug> --panels-only   — just the 4 viewer panels
  node screenshot-creature.mjs <slug> --anim-only     — just animation frame strips
  node screenshot-creature.mjs <slug> --clip <name>   — single animation clip strip
  node screenshot-creature.mjs <slug> --composite     — panels + composite only
  node screenshot-creature.mjs <slug> --review        — review page (all clips at 3px)
  node screenshot-creature.mjs --all                  — screenshot every creature

Outputs go to renders/<slug>-*.png

Slugs: ${CREATURES.map(c => c.slug).join(', ')}
`);
  process.exit(0);
}

const doAll = args.includes('--all');
const panelsOnly = args.includes('--panels-only');
const animOnly = args.includes('--anim-only');
const compositeOnly = args.includes('--composite');
const reviewOnly = args.includes('--review');
const clipIdx = args.indexOf('--clip');
const clipFilter = clipIdx >= 0 ? args[clipIdx + 1] : null;
const slugArg = args.find(a => !a.startsWith('--') && a !== clipFilter);

const slugs = doAll ? CREATURES.map(c => c.slug) : [slugArg];

for (const slug of slugs) {
  if (!slug) continue;
  if (reviewOnly) {
    await screenshotReview(slug);
  } else {
    await screenshotCreature(slug, { panelsOnly, animOnly, clipFilter, composite: compositeOnly });
  }
}

console.log('\nDone.');
