#!/usr/bin/env node
// ==========================================================================
// render-creature.mjs — render any creature to PNG for visual comparison
//
// Usage:
//   node render-creature.mjs <slug>              — render + overwrite current
//   node render-creature.mjs <slug> --ref        — also copy ref to renders/
//   node render-creature.mjs <slug> --save       — render + save versioned copy
//   node render-creature.mjs <slug> --save --note "description"
//   node render-creature.mjs --all               — render all known creatures
//
// Outputs (always):
//   renders/<slug>-painted.png
//   renders/<slug>-skeleton.png
//
// With --ref:
//   renders/<slug>-ref.<ext>
//
// With --save:
//   renders/history/<slug>/v<NNN>.png
//   renders/history/manifest.json  (updated)
// ==========================================================================

import { createCanvas, loadImage } from 'canvas';
import { writeFileSync, mkdirSync, existsSync, copyFileSync, readFileSync } from 'fs';
import { resolve, dirname, extname } from 'path';
import { fileURLToPath } from 'url';

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
  'hook-horror':       { gridW: 14, gridH: 12, ref: 'hook-horror-ref.webp' },
  'basilisk':          { gridW: 12, gridH: 8,  ref: 'basilisk-ref.png' },
};

// Parse args
const args = process.argv.slice(2);
const showRef  = args.includes('--ref');
const doSave   = args.includes('--save');
const doAll    = args.includes('--all');
const noteIdx  = args.indexOf('--note');
const note     = noteIdx >= 0 ? args[noteIdx + 1] : '';
const slugArg  = args.find(a => !a.startsWith('--') && a !== (noteIdx >= 0 ? args[noteIdx + 1] : null));

if (!slugArg && !doAll) {
  console.error('Usage: node render-creature.mjs <slug> [--ref] [--save] [--note "desc"]');
  console.error('       node render-creature.mjs --all');
  console.error('Slugs:', Object.keys(REGISTRY).join(', '));
  process.exit(1);
}

const slugs = doAll ? Object.keys(REGISTRY) : [slugArg];
const rendersDir = resolve(__dirname, 'renders');
mkdirSync(rendersDir, { recursive: true });

// -------------------------------------------------------------------------
// Manifest helpers
// -------------------------------------------------------------------------
const manifestPath = resolve(rendersDir, 'history', 'manifest.json');

function readManifest() {
  try { return JSON.parse(readFileSync(manifestPath, 'utf8')); } catch { return {}; }
}

function writeManifest(manifest) {
  mkdirSync(resolve(rendersDir, 'history'), { recursive: true });
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
}

function nextVersion(manifest, slug) {
  const versions = manifest[slug] || [];
  return versions.length === 0 ? 1 : Math.max(...versions.map(v => v.v)) + 1;
}

// -------------------------------------------------------------------------
// Render one creature
// -------------------------------------------------------------------------
async function renderCreature(slug) {
  const info = REGISTRY[slug];
  console.log(`\nRendering ${slug}…`);

  const modPath = resolve(__dirname, `${slug}.js`);
  let mod;
  try {
    mod = (await import(modPath)).default;
  } catch (e) {
    console.error(`  ✗ Failed to import ${slug}.js: ${e.message}`);
    return;
  }

  if (!mod || typeof mod.draw !== 'function') {
    console.error(`  ✗ ${slug}.js has no default export with draw()`);
    return;
  }

  const { draw, skeleton, gridW = info?.gridW ?? 7, gridH = info?.gridH ?? 7 } = mod;
  const W = 512;
  const H = Math.round(W * gridH / gridW);

  // -- Painted --
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, H);
  draw(ctx, skeleton, W, H);

  const paintedPath = resolve(rendersDir, `${slug}-painted.png`);
  writeFileSync(paintedPath, canvas.toBuffer('image/png'));
  console.log(`  painted  → ${paintedPath}`);

  // -- Skeleton wireframe --
  const skelCanvas = createCanvas(W, H);
  const skelCtx = skelCanvas.getContext('2d');
  skelCtx.fillStyle = '#000';
  skelCtx.fillRect(0, 0, W, H);

  if (skeleton?.spine) {
    skelCtx.fillStyle = 'rgb(80,60,120)';
    for (const node of skeleton.spine) {
      skelCtx.beginPath();
      skelCtx.arc(W * node.x, H * node.y, W * node.radius, 0, Math.PI * 2);
      skelCtx.fill();
    }
    skelCtx.strokeStyle = 'rgb(120,80,180)';
    skelCtx.lineWidth = 2;
    for (let i = 0; i < skeleton.spine.length - 1; i++) {
      const a = skeleton.spine[i], b = skeleton.spine[i + 1];
      skelCtx.beginPath();
      skelCtx.moveTo(W * a.x, H * a.y);
      skelCtx.lineTo(W * b.x, H * b.y);
      skelCtx.stroke();
    }
    const limbColors = ['rgb(180,60,60)', 'rgb(60,180,60)', 'rgb(60,120,180)', 'rgb(180,140,60)', 'rgb(140,60,180)', 'rgb(60,180,160)'];
    (skeleton.limbs || []).forEach((limb, li) => {
      const color = limbColors[li % limbColors.length];
      skelCtx.strokeStyle = color;
      skelCtx.lineWidth = 2;
      for (let i = 0; i < limb.segments.length - 1; i++) {
        const a = limb.segments[i], b = limb.segments[i + 1];
        skelCtx.beginPath();
        skelCtx.moveTo(W * a.x, H * a.y);
        skelCtx.lineTo(W * b.x, H * b.y);
        skelCtx.stroke();
      }
      skelCtx.fillStyle = color;
      for (const seg of limb.segments) {
        skelCtx.beginPath();
        skelCtx.arc(W * seg.x, H * seg.y, Math.max(2, W * (seg.radius ?? 0.01)), 0, Math.PI * 2);
        skelCtx.fill();
      }
    });
    skelCtx.fillStyle = '#666';
    skelCtx.font = '11px monospace';
    for (const node of skeleton.spine) {
      skelCtx.fillText(node.id ?? '', W * node.x + 4, H * node.y + 3);
    }
  }

  const skelPath = resolve(rendersDir, `${slug}-skeleton.png`);
  writeFileSync(skelPath, skelCanvas.toBuffer('image/png'));
  console.log(`  skeleton → ${skelPath}`);

  // -- Reference copy --
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

  // -- Versioned save --
  if (doSave) {
    const manifest = readManifest();
    const v = nextVersion(manifest, slug);
    const versionDir = resolve(rendersDir, 'history', slug);
    mkdirSync(versionDir, { recursive: true });
    const vFile = resolve(versionDir, `v${String(v).padStart(3, '0')}.png`);
    writeFileSync(vFile, canvas.toBuffer('image/png'));

    if (!manifest[slug]) manifest[slug] = [];
    manifest[slug].push({
      v,
      file: `renders/history/${slug}/v${String(v).padStart(3, '0')}.png`,
      ts: new Date().toISOString(),
      note: note || '',
    });
    writeManifest(manifest);
    console.log(`  saved    → v${v} (history)`);
    if (note) console.log(`  note: "${note}"`);
  }
}

// Run
for (const slug of slugs) {
  await renderCreature(slug);
}
console.log('\nDone.');
