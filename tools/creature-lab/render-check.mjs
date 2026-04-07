// Quick render of the skeleton to PNG for visual checking
import { createCanvas } from 'canvas';
import { writeFileSync } from 'fs';
import {
  drawCreatureFromSkeleton, drawCleanCreature, drawDebugSkeleton, direRatSkeleton,
  drawBodyOutline, drawLimbChain, drawTail,
} from './skeleton.js';

const W = 512;
const H = Math.round(512 * 4 / 7);
const canvas = createCanvas(W, H);
const ctx = canvas.getContext('2d');

// Black background
ctx.fillStyle = '#000';
ctx.fillRect(0, 0, W, H);

// Draw the creature with flat colors
drawCreatureFromSkeleton(ctx, direRatSkeleton, W, H);

// Draw debug skeleton overlay
drawDebugSkeleton(ctx, direRatSkeleton, W, H);

// Save
writeFileSync('render-check.png', canvas.toBuffer('image/png'));

// Also render a clean silhouette (white on black) for shape comparison
const sCanvas = createCanvas(W, H);
const sCtx = sCanvas.getContext('2d');
sCtx.fillStyle = '#000';
sCtx.fillRect(0, 0, W, H);
drawCreatureFromSkeleton(sCtx, direRatSkeleton, W, H, {
  furDark: '#fff', furMid: '#fff', furShadow: '#ddd', skinDark: '#fff',
});
writeFileSync('render-silhouette.png', sCanvas.toBuffer('image/png'));

// Clean version — fungal shaman style
import { bodyGradHueShift, fillCircle, fillEllipse } from './helpers.js';
const cCanvas = createCanvas(W, H);
const cCtx = cCanvas.getContext('2d');
cCtx.fillStyle = '#000';
cCtx.fillRect(0, 0, W, H);
drawCleanCreature(cCtx, direRatSkeleton, W, H, {
  bodyGradHueShift, fillCircle, fillEllipse,
});
writeFileSync('render-clean.png', cCanvas.toBuffer('image/png'));

console.log('Saved render-check.png + render-silhouette.png + render-clean.png');

// Also print skeleton summary for analysis
console.log('\nSpine nodes:');
for (const n of direRatSkeleton.spine) {
  console.log(`  ${n.id}: (${n.x.toFixed(3)}, ${n.y.toFixed(3)}) r=${n.radius.toFixed(3)}`);
}
console.log('\nLimb segments:');
for (const limb of direRatSkeleton.limbs) {
  console.log(`  ${limb.side} ${limb.attach}:`);
  for (const s of limb.segments) {
    console.log(`    (${s.x.toFixed(3)}, ${s.y.toFixed(3)}) r=${s.radius.toFixed(3)}`);
  }
}
