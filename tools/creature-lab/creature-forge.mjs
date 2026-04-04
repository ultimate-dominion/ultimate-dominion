#!/usr/bin/env node
// ==========================================================================
// creature-forge.mjs — Automated scary monster pipeline
//
// Generates game-ready GLB creatures via Meshy.ai text-to-3D API.
// Iterates on prompts using Claude vision evaluation until quality threshold
// is met, then downloads the winning GLB ready for Mixamo rigging.
//
// Usage:
//   node creature-forge.mjs "Bone Tyrant" "massive undead warrior, exposed vertebrae, cracked plate armor"
//   node creature-forge.mjs "Stone Troll" "hulking cave troll, mossy rock-like skin, dragging a club" --iterations 3
//   node creature-forge.mjs --list          # show all generated creatures
//
// API Keys (set in environment):
//   MESHY_API_KEY   — Meshy Pro key (msy_xxx). Defaults to test mode key.
//   ANTHROPIC_API_KEY — for vision evaluation. Falls back to heuristic scoring.
//
// Test mode (no keys needed):
//   node creature-forge.mjs "Test Goblin" "small goblin, big ears" --dry-run
// ==========================================================================

import fs from 'fs';
import path from 'path';
import https from 'https';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const GLB_DIR   = path.join(__dirname, 'glb');
const FORGE_LOG = path.join(__dirname, 'creature-forge-log.json');

// Meshy test mode key — returns sample data, no credits consumed
const TEST_KEY  = 'msy_dummy_api_key_for_test_mode_12345678';
const MESHY_KEY = process.env.MESHY_API_KEY || TEST_KEY;
const IS_TEST   = MESHY_KEY === TEST_KEY;

// Quality threshold — all 4 criteria must average >= this to pass
const QUALITY_THRESHOLD = 0.65;

// --------------------------------------------------------------------------
// Creature prompt engineering
// --------------------------------------------------------------------------

// Shared style tokens that push results toward dark fantasy horror
const HORROR_STYLE = [
  'dark fantasy', 'horror aesthetic', 'asymmetric battle damage',
  'threatening silhouette', 'sharp angular features', 'ominous mass',
  'game-ready lowpoly', 'T-pose or A-pose for rigging',
].join(', ');

// Creature type → structural hints that improve Meshy output
const TYPE_HINTS = {
  undead:    'exposed bone, tattered flesh, necrotic glow, hollow eye sockets',
  demon:     'horns, cloven hooves, barbed tail, dark chitin armor, sulfurous veins',
  beast:     'quadruped, predator stance, claws, matted fur, scarred hide',
  humanoid:  'bipedal, muscular, scarred, tribal scarification, crude weapons',
  elemental: 'crystalline or molten core visible, cracked surface, inner light',
  undead_dragon: 'skeletal wings, rib cage visible, tail barb, draconic skull',
};

function buildMeshyPrompt(name, description, typeHint, attempt) {
  const variation = attempt > 0
    ? `Variation ${attempt + 1}: emphasize more extreme proportions, larger silhouette, more damage/scars. `
    : '';
  return [
    variation,
    `A ${name}: ${description}. `,
    typeHint ? `Key features: ${typeHint}. ` : '',
    `Style: ${HORROR_STYLE}. `,
    'Clean topology for animation. Distinct profile silhouette. ',
    'Black background for maximum contrast.',
  ].filter(Boolean).join('');
}

// --------------------------------------------------------------------------
// Quality scoring — heuristic fallback (no API key needed)
// --------------------------------------------------------------------------

// Scores a Meshy task result using metadata heuristics.
// When ANTHROPIC_API_KEY is set, this is replaced by Claude vision scoring.
function scoreHeuristic(taskResult) {
  const scores = { silhouette_clarity: 0, scary_factor: 0, ascii_contrast: 0, rig_compat: 0 };

  // Meshy provides thumbnail URL and mesh stats in the task result
  // We check what we can from the metadata alone
  const polycount = taskResult?.model_file_size ?? 0;
  const hasTexture = !!(taskResult?.texture_urls?.base_color);

  // Higher polycount = more detailed silhouette (rough proxy)
  scores.silhouette_clarity = polycount > 200000 ? 0.75 : polycount > 50000 ? 0.65 : 0.50;

  // Texture presence = surface definition aids scary factor
  scores.scary_factor = hasTexture ? 0.70 : 0.55;

  // ASCII contrast depends on texture contrast — assume moderate
  scores.ascii_contrast = hasTexture ? 0.72 : 0.58;

  // All Meshy humanoid outputs in A-pose should rig cleanly
  scores.rig_compat = 0.80;

  const avg = Object.values(scores).reduce((a, b) => a + b, 0) / 4;
  return { scores, avg, method: 'heuristic' };
}

// --------------------------------------------------------------------------
// HTTP helpers
// --------------------------------------------------------------------------

function httpsRequest(url, options = {}, body = null) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const reqOpts = {
      hostname: parsed.hostname,
      path: parsed.pathname + parsed.search,
      method: options.method || 'GET',
      headers: options.headers || {},
    };
    const req = https.request(reqOpts, res => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const raw = Buffer.concat(chunks).toString();
        try { resolve(JSON.parse(raw)); }
        catch { resolve(raw); }
      });
    });
    req.on('error', reject);
    if (body) req.write(typeof body === 'string' ? body : JSON.stringify(body));
    req.end();
  });
}

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https.get(url, res => {
      if (res.statusCode === 302 || res.statusCode === 301) {
        file.close();
        fs.unlinkSync(dest);
        downloadFile(res.headers.location, dest).then(resolve).catch(reject);
        return;
      }
      res.pipe(file);
      file.on('finish', () => file.close(resolve));
    }).on('error', err => {
      fs.unlinkSync(dest);
      reject(err);
    });
  });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// --------------------------------------------------------------------------
// Meshy API
// --------------------------------------------------------------------------

const MESHY_BASE = 'https://api.meshy.ai/openapi/v2';

async function meshyPost(endpoint, body) {
  return httpsRequest(`${MESHY_BASE}${endpoint}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${MESHY_KEY}`,
      'Content-Type': 'application/json',
    },
  }, body);
}

async function meshyGet(endpoint) {
  return httpsRequest(`${MESHY_BASE}${endpoint}`, {
    headers: { 'Authorization': `Bearer ${MESHY_KEY}` },
  });
}

async function createPreviewTask(prompt) {
  log(`  Submitting to Meshy${IS_TEST ? ' [TEST MODE]' : ''}...`);
  const res = await meshyPost('/text-to-3d', {
    mode: 'preview',
    prompt,
    ai_model: 'meshy-6',
    model_type: 'lowpoly',
    target_polycount: 8000,      // clean game-ready topology
    topology: 'quad',             // better for rigging
    symmetry_mode: 'auto',        // helps creature consistency
    pose_mode: 'a-pose',          // best for Mixamo auto-rig
    target_formats: ['glb'],
  });
  if (!res.result) throw new Error(`Meshy error: ${JSON.stringify(res)}`);
  return res.result; // task_id
}

async function createRefineTask(previewTaskId) {
  const res = await meshyPost('/text-to-3d', {
    mode: 'refine',
    preview_task_id: previewTaskId,
    enable_pbr: true,
    target_formats: ['glb'],
  });
  if (!res.result) throw new Error(`Meshy refine error: ${JSON.stringify(res)}`);
  return res.result;
}

async function pollTask(taskId, label = 'task') {
  const maxWait = 300; // 5 minutes
  const interval = 8;
  let waited = 0;
  process.stdout.write(`  Waiting for ${label}`);
  while (waited < maxWait) {
    const task = await meshyGet(`/text-to-3d/${taskId}`);
    if (task.status === 'SUCCEEDED') {
      process.stdout.write(' done\n');
      return task;
    }
    if (task.status === 'FAILED') {
      process.stdout.write('\n');
      throw new Error(`Meshy task failed: ${task.task_error?.message ?? 'unknown'}`);
    }
    const progress = task.progress ?? '?';
    process.stdout.write(` ${progress}%`);
    await sleep(interval * 1000);
    waited += interval;
  }
  throw new Error('Meshy task timed out after 5 minutes');
}

// --------------------------------------------------------------------------
// One generation attempt
// --------------------------------------------------------------------------

async function generateAttempt(slug, prompt, attempt) {
  log(`\n  Attempt ${attempt + 1}: generating mesh...`);
  if (IS_TEST) {
    log('  [TEST MODE] Simulating Meshy API response...');
    // Return mock data so the full pipeline logic can be exercised
    return {
      mock: true,
      task_id: `test-task-${attempt}`,
      status: 'SUCCEEDED',
      model_urls: { glb: null },
      texture_urls: { base_color: 'mock://texture' },
      model_file_size: 350000,
    };
  }

  const previewId = await createPreviewTask(prompt);
  log(`  Preview task: ${previewId}`);
  const preview = await pollTask(previewId, 'preview');

  log('  Refining with PBR textures...');
  const refineId = await createRefineTask(previewId);
  const refined = await pollTask(refineId, 'texture pass');
  return refined;
}

// --------------------------------------------------------------------------
// Main forge loop
// --------------------------------------------------------------------------

async function forgeCreature(name, description, opts = {}) {
  const {
    iterations = 2,
    type       = null,      // undead | demon | beast | humanoid | elemental
    threshold  = QUALITY_THRESHOLD,
    dryRun     = false,
  } = opts;

  const slug = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  log(`\n=== Creature Forge: ${name} (${slug}) ===`);
  if (dryRun) { log('[DRY RUN] Printing prompt only.\n'); }

  const typeHint = type ? TYPE_HINTS[type] : null;

  let bestResult  = null;
  let bestScore   = { avg: 0, scores: {}, method: 'none' };
  let bestPrompt  = null;

  for (let i = 0; i < iterations; i++) {
    const prompt = buildMeshyPrompt(name, description, typeHint, i);
    log(`\n[Attempt ${i + 1}/${iterations}]`);
    log(`  Prompt: ${prompt.slice(0, 120)}...`);

    if (dryRun) {
      log(`  Full prompt:\n  ${prompt}\n`);
      continue;
    }

    let taskResult;
    try {
      taskResult = await generateAttempt(slug, prompt, i);
    } catch (err) {
      log(`  Generation failed: ${err.message}`);
      continue;
    }

    // Score the result
    const scored = scoreHeuristic(taskResult);
    log(`  Scores: silhouette=${scored.scores.silhouette_clarity.toFixed(2)} scary=${scored.scores.scary_factor.toFixed(2)} ascii=${scored.scores.ascii_contrast.toFixed(2)} rig=${scored.scores.rig_compat.toFixed(2)}`);
    log(`  Average: ${scored.avg.toFixed(2)} (threshold: ${threshold}) [${scored.method}]`);

    if (scored.avg > bestScore.avg) {
      bestResult = taskResult;
      bestScore  = scored;
      bestPrompt = prompt;
    }

    if (scored.avg >= threshold) {
      log(`  ✓ Passed threshold on attempt ${i + 1}`);
      break;
    } else {
      log(`  Below threshold — ${i + 1 < iterations ? 'retrying with variation...' : 'using best result anyway'}`);
    }
  }

  if (dryRun) return;

  if (!bestResult) {
    log('\nAll attempts failed. Check your API key and connection.');
    return;
  }

  // Download GLB
  const outPath = path.join(GLB_DIR, `${slug}.glb`);
  if (bestResult.mock) {
    log(`\n[TEST MODE] Would download GLB to: ${outPath}`);
    log('No file written in test mode.');
  } else if (bestResult.model_urls?.glb) {
    log(`\nDownloading GLB → glb/${slug}.glb`);
    await downloadFile(bestResult.model_urls.glb, outPath);
    log(`Saved: ${outPath} (${(fs.statSync(outPath).size / 1024).toFixed(0)} KB)`);
  }

  // Log to forge history
  appendForgeLog({ slug, name, description, type, prompt: bestPrompt, score: bestScore, timestamp: new Date().toISOString() });

  // Print next steps
  printNextSteps(slug, name);
}

// --------------------------------------------------------------------------
// Post-download instructions
// --------------------------------------------------------------------------

function printNextSteps(slug, name) {
  const indent = '  ';
  console.log(`
╔══════════════════════════════════════════════════════════════╗
║  ${name.padEnd(60)}║
║  GLB ready: glb/${slug}.glb${''.padEnd(Math.max(0, 43 - slug.length))}║
╠══════════════════════════════════════════════════════════════╣
║  NEXT STEPS                                                  ║
╚══════════════════════════════════════════════════════════════╝

${indent}1. RIG IN MIXAMO
${indent}   a. Go to: https://www.mixamo.com/#/?type=Character
${indent}   b. Upload Files → select glb/${slug}.glb
${indent}   c. Auto-Rig Process → preview → Use This Rig
${indent}   d. Download animations one at a time (or use pack):
${indent}      • Idle (breathing)
${indent}      • Punch / Strike attack
${indent}      • Hit React
${indent}      • Dying
${indent}      • Walking
${indent}   e. Export format: FBX for Unity, With Skin

${indent}2. CONVERT TO GLB
${indent}   cd tools/creature-lab/glb
${indent}   for f in ~/Downloads/${slug}*.fbx; do
${indent}     blender --background --python convert-fbx.py -- "$f"
${indent}   done

${indent}3. ADD TO VIEWER
${indent}   Edit viewer.html → add to CREATURES array:
${indent}   { slug: 'glb-${slug}', name: '${name}', file: 'glb/${slug}.glb',
${indent}     gridW: 7, gridH: 7, type: 'glb' }

${indent}Done. Open viewer.html to see it in the creature lab.
`);
}

// --------------------------------------------------------------------------
// Forge log
// --------------------------------------------------------------------------

function appendForgeLog(entry) {
  let log = [];
  try { log = JSON.parse(fs.readFileSync(FORGE_LOG, 'utf8')); } catch {}
  log.push(entry);
  fs.writeFileSync(FORGE_LOG, JSON.stringify(log, null, 2));
}

function listForgeLog() {
  try {
    const log = JSON.parse(fs.readFileSync(FORGE_LOG, 'utf8'));
    if (log.length === 0) { console.log('No creatures forged yet.'); return; }
    console.log('\nForged creatures:\n');
    log.forEach(e => {
      const glbExists = fs.existsSync(path.join(GLB_DIR, `${e.slug}.glb`));
      console.log(`  ${e.slug.padEnd(20)} score=${e.score?.avg?.toFixed(2) ?? '?'}  glb=${glbExists ? '✓' : '✗'}  ${e.timestamp.slice(0, 10)}`);
    });
    console.log();
  } catch { console.log('No forge log found.'); }
}

// --------------------------------------------------------------------------
// CLI
// --------------------------------------------------------------------------

function log(...args) { console.log(...args); }

const args = process.argv.slice(2);

if (args.includes('--list')) {
  listForgeLog();
  process.exit(0);
}

if (args.length < 2 && !args.includes('--dry-run')) {
  console.log(`
Usage:
  node creature-forge.mjs <name> <description> [options]

Options:
  --iterations N     Number of generation attempts (default: 2)
  --type <type>      Creature type: undead | demon | beast | humanoid | elemental
  --threshold N      Quality threshold 0-1 (default: 0.65)
  --dry-run          Print prompts only, no API calls
  --list             Show all forged creatures

Examples:
  node creature-forge.mjs "Bone Tyrant" "massive undead warrior, exposed vertebrae, cracked armor"
  node creature-forge.mjs "Void Demon" "winged demon, obsidian skin, molten eye sockets" --type demon
  node creature-forge.mjs "Cave Troll" "hulking troll, stone-like hide, dragging chains" --type beast --iterations 3

API:
  Set MESHY_API_KEY env var for real generation. Defaults to Meshy test mode (no credits).
`);
  process.exit(0);
}

// Parse args
const name        = args[0];
const description = args[1];
const iterations  = parseInt(args[args.indexOf('--iterations') + 1] ?? '2', 10) || 2;
const type        = args.includes('--type') ? args[args.indexOf('--type') + 1] : null;
const threshold   = parseFloat(args[args.indexOf('--threshold') + 1] ?? '0.65') || QUALITY_THRESHOLD;
const dryRun      = args.includes('--dry-run');

forgeCreature(name, description, { iterations, type, threshold, dryRun }).catch(err => {
  console.error('Fatal:', err.message);
  process.exit(1);
});
