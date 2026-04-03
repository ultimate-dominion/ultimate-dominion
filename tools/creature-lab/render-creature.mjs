#!/usr/bin/env node
// ==========================================================================
// Render a creature to PNG for visual comparison in the skill loop.
// Usage: node render-creature.mjs <slug> [--ref]
//
// Outputs: renders/<slug>-painted.png (the draw function output)
//          renders/<slug>-skeleton.png (skeleton wireframe only)
//
// With --ref: also copies the ref image to renders/<slug>-ref.<ext> so
// both can be read side-by-side with the Read tool.
// ==========================================================================

import { createCanvas, loadImage } from 'canvas';
import { writeFileSync, mkdirSync, existsSync, copyFileSync } from 'fs';
import { resolve, dirname, extname } from 'path';
import { fileURLToPath } from 'url';
import { readdirSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));

const REGISTRY = {
  'dire-rat':          { gridW: 7,  gridH: 4,  ref: 'rat-ref.png' },
  'kobold':            { gridW: 7,  gridH: 5,  ref: 'kobold-ref.webp' },
  'goblin':            { gridW: 7,  gridH: 7,  ref: 'goblin-ref.webp' },
  'giant-spider':      { gridW: 7,  gridH: 5,  ref: 'giant-spider-ref.jpg' },
  'skeleton-creature': { gridW: 7,  gridH: 5,  ref: 'skeleton-ref.webp' },
  'goblin-shaman':     { gridW: 7,  gridH: 7,  ref: 'goblin-shaman-ref.webp' },
  'gelatinous-ooze':   { gridW: 7,  gridH: 7,  ref: 'gelatinous-ooze-ref.webp' },
  'bugbear':           { gridW: 7,  gridH: 7,  ref: 'bugbear-ref.webp' },
  'carrion-crawler':   { gridW: 10, gridH: 13, ref: 'carrion-crawler-ref.webp' },
  'hook-horror':       { gridW: 14, gridH: 12, ref: 'hook-horror-ref.png' },
};

const slug = process.argv[2];
const showRef = process.argv.includes('--ref');

if (!slug) {
  console.error('Usage: node render-creature.mjs <slug> [--ref]');
  console.error('Slugs:', Object.keys(REGISTRY).join(', '));
  process.exit(1);
}

const info = REGISTRY[slug];
if (!info) {
  // Try to infer dimensions from the module itself
  console.warn(`Unknown slug "${slug}" — attempting import anyway with 7x7 grid`);
}

const rendersDir = resolve(__dirname, 'renders');
mkdirSync(rendersDir, { recursive: true });

console.log(`Rendering ${slug}...`);

// Dynamic import of the creature module
const modPath = resolve(__dirname, `${slug}.js`);
let mod;
try {
  mod = (await import(modPath)).default;
} catch (e) {
  console.error(`Failed to import ${slug}.js: ${e.message}`);
  process.exit(1);
}

if (!mod || typeof mod.draw !== 'function') {
  console.error(`${slug}.js has no default export with a draw function`);
  process.exit(1);
}

const { draw, skeleton, gridW = info?.gridW ?? 7, gridH = info?.gridH ?? 7 } = mod;

const W = 512;
const H = Math.round(W * gridH / gridW);

// -- Painted render --
const canvas = createCanvas(W, H);
const ctx = canvas.getContext('2d');
ctx.fillStyle = '#000';
ctx.fillRect(0, 0, W, H);
draw(ctx, skeleton, W, H);

const paintedPath = resolve(rendersDir, `${slug}-painted.png`);
writeFileSync(paintedPath, canvas.toBuffer('image/png'));
console.log(`  painted  → ${paintedPath}`);

// -- Skeleton render (simplified wireframe) --
const skelCanvas = createCanvas(W, H);
const skelCtx = skelCanvas.getContext('2d');
skelCtx.fillStyle = '#000';
skelCtx.fillRect(0, 0, W, H);

if (skeleton?.spine) {
  // Draw spine nodes as circles
  skelCtx.fillStyle = 'rgb(80,60,120)';
  for (const node of skeleton.spine) {
    const cx = W * node.x, cy = H * node.y, r = W * node.radius;
    skelCtx.beginPath();
    skelCtx.arc(cx, cy, r, 0, Math.PI * 2);
    skelCtx.fill();
  }
  // Connect spine
  skelCtx.strokeStyle = 'rgb(120,80,180)';
  skelCtx.lineWidth = 2;
  for (let i = 0; i < skeleton.spine.length - 1; i++) {
    const a = skeleton.spine[i], b = skeleton.spine[i + 1];
    skelCtx.beginPath();
    skelCtx.moveTo(W * a.x, H * a.y);
    skelCtx.lineTo(W * b.x, H * b.y);
    skelCtx.stroke();
  }
  // Draw limbs
  if (skeleton.limbs) {
    const limbColors = ['rgb(180,60,60)', 'rgb(60,180,60)', 'rgb(60,120,180)', 'rgb(180,140,60)', 'rgb(140,60,180)', 'rgb(60,180,160)'];
    skeleton.limbs.forEach((limb, li) => {
      skelCtx.strokeStyle = limbColors[li % limbColors.length];
      skelCtx.lineWidth = 2;
      for (let i = 0; i < limb.segments.length - 1; i++) {
        const a = limb.segments[i], b = limb.segments[i + 1];
        skelCtx.beginPath();
        skelCtx.moveTo(W * a.x, H * a.y);
        skelCtx.lineTo(W * b.x, H * b.y);
        skelCtx.stroke();
      }
      for (const seg of limb.segments) {
        skelCtx.fillStyle = limbColors[li % limbColors.length];
        skelCtx.beginPath();
        skelCtx.arc(W * seg.x, H * seg.y, Math.max(2, W * (seg.radius ?? 0.01)), 0, Math.PI * 2);
        skelCtx.fill();
      }
    });
  }
  // Label spine nodes
  skelCtx.fillStyle = '#888';
  skelCtx.font = '10px monospace';
  for (const node of skeleton.spine) {
    skelCtx.fillText(node.id ?? '', W * node.x + 4, H * node.y + 3);
  }
}

const skelPath = resolve(rendersDir, `${slug}-skeleton.png`);
writeFileSync(skelPath, skelCanvas.toBuffer('image/png'));
console.log(`  skeleton → ${skelPath}`);

// -- Copy reference image if requested --
if (showRef && info?.ref) {
  const refSrc = resolve(__dirname, 'refs', info.ref);
  if (existsSync(refSrc)) {
    const ext = extname(info.ref);
    const refDest = resolve(rendersDir, `${slug}-ref${ext}`);
    copyFileSync(refSrc, refDest);
    console.log(`  ref      → ${refDest}`);
  } else {
    console.warn(`  ref not found: ${refSrc}`);
  }
}

console.log('Done.');
