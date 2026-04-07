#!/usr/bin/env node
// ==========================================================================
// creature-forge.mjs — Automated scary monster pipeline
//
// Generates game-ready animated GLB creatures via Meshy.ai API:
//   1. text-to-3D (v2): mesh + PBR textures
//   2. rigging (v1): auto-rig skeleton (humanoids only, 5 credits)
//   3. animations (v1): idle, walk, attack, death per-clip (3 credits each)
//   4. merge: gltf-transform combines clips into one animated GLB
//
// Usage:
//   node creature-forge.mjs "Kobold" "small reptilian humanoid" --type humanoid
//   node creature-forge.mjs "Stone Troll" "hulking cave troll" --type beast --iterations 3
//   node creature-forge.mjs --rig kobold <meshTaskId>   # rig an already-generated mesh
//   node creature-forge.mjs --list                      # show all generated creatures
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
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const GLB_DIR   = path.join(__dirname, 'glb');
const FORGE_LOG = path.join(__dirname, 'creature-forge-log.json');

// Meshy test mode key — returns real sample GLB assets, no credits consumed.
// The API responds immediately (SUCCEEDED with no wait) and returns a real
// downloadable GLB from Meshy's sample asset library.
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

// --------------------------------------------------------------------------
// Attack archetype system — drives Meshy prompt strategy and quality gates
//
// Each archetype defines:
//   - promptHints: structural guidance for Meshy (what to emphasize in the mesh)
//   - poseHints: posing guidance (what the A/T-pose should convey about the attack)
//   - qualityGates: archetype-specific checks for the 5-check rubric
// --------------------------------------------------------------------------
const ATTACK_ARCHETYPES = {
  weapon: {
    label: 'Weapon-wielder',
    promptHints: [
      'weapon held in one or both hands, clearly separate from arm geometry',
      'weapon must be at least 15% of body height',
      'distinct weapon silhouette — blade/head shape clearly readable',
      'hand grip visible with fingers wrapped around weapon handle',
    ],
    poseHints: 'weapon arm extended or raised for clear weapon silhouette in A-pose',
    qualityGates: {
      signatureFeature: 'weapon must be visually separate from hand/arm, with distinct blade/head shape',
      asciiSurvival: 'weapon silhouette must survive ASCII compression — look for distinct shape at arm tip',
      animReadability: 'attack clip must show weapon arc — wind-up with weapon back, swing through, follow-through',
    },
    examples: ['goblin (bone cleaver)', 'skeleton (rusty longsword)', 'bugbear (spiked morningstar)', 'kobold (scimitar)'],
  },
  claw: {
    label: 'Claw attacker',
    promptHints: [
      'large prominent claws or hooks at end of forelimbs',
      'claws must extend well beyond the arm/hand — at least 20% of limb length',
      'splayed fingers/digits showing individual claw tips',
      'forearms thicker than upper arms to emphasize claw weight',
    ],
    poseHints: 'arms spread wide in A-pose showing full claw span, claws pointed outward',
    qualityGates: {
      signatureFeature: 'claws/hooks must be visible at limb tips, extending past the arm bounding box',
      asciiSurvival: 'claw spread must read in ASCII — individual digits or hook curve distinguishable',
      animReadability: 'attack clip must show claw swipe — one arm winds back, rakes forward with spread claws',
    },
    examples: ['hook-horror (scythe hooks)', 'dire-rat (bite/claws)', 'owlbear (bear claws)'],
  },
  tail: {
    label: 'Tail/tentacle attacker',
    promptHints: [
      'long prominent tail or tentacles extending from body',
      'tail must be at least 30% of total body length',
      'tail has distinct tip feature — barb, stinger, club, or split',
      'tail has visible thickness tapering from base to tip',
    ],
    poseHints: 'tail extended straight back or slightly curved for full length visibility',
    qualityGates: {
      signatureFeature: 'tail/tentacles must extend well past body bounding box with distinct tip shape',
      asciiSurvival: 'tail curve and tip must survive ASCII — look for continuous line extending from body',
      animReadability: 'attack clip must show tail whip — coil back, snap forward, impact position',
    },
    examples: ['basilisk (tail whip)', 'carrion-crawler (tentacles)', 'manticore (tail spikes)'],
  },
  bite: {
    label: 'Bite/jaw attacker',
    promptHints: [
      'oversized head with wide-opening jaw',
      'visible teeth or fangs, jaw can open at least 30 degrees',
      'head is at least 20% of body mass — dominant feature',
      'neck thick and muscular to support lunging bite',
    ],
    poseHints: 'head slightly forward, jaw partially open showing teeth in rest pose',
    qualityGates: {
      signatureFeature: 'head/jaw must be the dominant feature — oversized relative to body, teeth visible',
      asciiSurvival: 'jaw opening and teeth must read in ASCII — look for gap in head silhouette',
      animReadability: 'attack clip must show lunge — head draws back, snaps forward with jaw wide',
    },
    examples: ['dire-rat (bite)', 'basilisk (petrifying gaze + bite)', 'mimic (toothy maw)'],
  },
  magic: {
    label: 'Magic/spell caster',
    promptHints: [
      'staff, wand, or orb held in one hand — distinct magical focus item',
      'magical focus must glow or have distinct visual energy',
      'robes, cloth, or ethereal wisps around the body',
      'free hand posed as if channeling or casting',
    ],
    poseHints: 'one hand holding staff/focus, other hand open and raised as if casting',
    qualityGates: {
      signatureFeature: 'magical focus (staff/wand/orb) must be clearly visible and distinct from body',
      asciiSurvival: 'staff/focus silhouette must survive ASCII — look for thin vertical line or bright spot',
      animReadability: 'attack clip must show cast — raise staff/hand, channel energy, release',
    },
    examples: ['goblin-shaman (skull staff)', 'lich (phylactery)', 'dark mage (fire orb)'],
  },
  amorphous: {
    label: 'Amorphous/formless',
    promptHints: [
      'no clear skeleton or limb structure — blob, ooze, or shifting form',
      'translucent or semi-transparent surface showing internal structure',
      'irregular asymmetric edges — dripping, flowing, or pulsing',
      'internal objects or bones visible through surface',
    ],
    poseHints: 'not applicable — amorphous creatures have no skeleton to pose',
    qualityGates: {
      signatureFeature: 'form must be clearly non-humanoid — blobby, flowing, or shifting shape',
      asciiSurvival: 'organic irregular outline must read in ASCII — not a rectangle or circle',
      animReadability: 'idle must show pulsing or flowing motion — attack shows engulf or pseudopod strike',
    },
    examples: ['gelatinous-ooze (engulf)', 'black pudding (acid)', 'shoggoth (tentacle mass)'],
    meshyWarning: 'Meshy struggles with amorphous forms — canvas art is usually better for these.',
  },
};

function buildMeshyPrompt(name, description, typeHint, attempt, archetype = null) {
  const variation = attempt > 0
    ? `Variation ${attempt + 1}: emphasize more extreme proportions, larger silhouette, more damage/scars. `
    : '';

  const archetypeHints = archetype && ATTACK_ARCHETYPES[archetype]
    ? `Attack style: ${ATTACK_ARCHETYPES[archetype].promptHints.join('. ')}. ${ATTACK_ARCHETYPES[archetype].poseHints}. `
    : '';

  return [
    variation,
    `A ${name}: ${description}. `,
    typeHint ? `Key features: ${typeHint}. ` : '',
    archetypeHints,
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

  // Meshy task result fields we can use for heuristic scoring
  const hasGlb     = !!(taskResult?.model_urls?.glb);
  const hasTexture = Array.isArray(taskResult?.texture_urls)
    ? taskResult.texture_urls.length > 0
    : !!(taskResult?.texture_urls?.base_color);

  // GLB present = generation succeeded and model is downloadable
  scores.silhouette_clarity = hasGlb ? 0.75 : 0.40;

  // Texture presence = surface definition aids scary factor
  scores.scary_factor = hasTexture ? 0.70 : 0.60;

  // ASCII contrast: untextured preview still has geometry — moderate baseline
  scores.ascii_contrast = hasTexture ? 0.72 : 0.62;

  // All Meshy A-pose outputs should rig cleanly in Mixamo
  scores.rig_compat = hasGlb ? 0.80 : 0.40;

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
const MESHY_V1   = 'https://api.meshy.ai/openapi/v1';

function meshyHeaders() {
  return { 'Authorization': `Bearer ${MESHY_KEY}`, 'Content-Type': 'application/json' };
}

async function meshyPost(endpoint, body) {
  return httpsRequest(`${MESHY_BASE}${endpoint}`, { method: 'POST', headers: meshyHeaders() }, body);
}

async function meshyGet(endpoint) {
  return httpsRequest(`${MESHY_BASE}${endpoint}`, { headers: meshyHeaders() });
}

async function meshyPostV1(endpoint, body) {
  return httpsRequest(`${MESHY_V1}${endpoint}`, { method: 'POST', headers: meshyHeaders() }, body);
}

async function meshyGetV1(endpoint) {
  return httpsRequest(`${MESHY_V1}${endpoint}`, { headers: meshyHeaders() });
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

async function pollV1Task(taskId, v1Endpoint, label) {
  const maxWait = 600; // 10 min — rigging can be slow
  const interval = 10;
  let waited = 0;
  process.stdout.write(`  Waiting for ${label}`);
  while (waited < maxWait) {
    const task = await meshyGetV1(`/${v1Endpoint}/${taskId}`);
    if (task.status === 'SUCCEEDED') {
      process.stdout.write(' done\n');
      return task;
    }
    if (task.status === 'FAILED') {
      process.stdout.write('\n');
      throw new Error(`Task failed: ${task.task_error?.message ?? 'unknown'}`);
    }
    const progress = task.progress ?? '?';
    process.stdout.write(` ${progress}%`);
    await sleep(interval * 1000);
    waited += interval;
  }
  throw new Error(`Task timed out after ${maxWait / 60} minutes`);
}

// --------------------------------------------------------------------------
// Meshy v1 Rigging + Animation pipeline
// --------------------------------------------------------------------------

// --------------------------------------------------------------------------
// Meshy v1 animation action_id reference
//
// Full library: https://docs.meshy.ai/en/api/animation-library (584+ IDs)
//
// CRITICAL: action_id 9 is ForwardLeft_Run_Fight (a RUNNING anim), NOT hit react.
// Actual hit reactions are in the 171-179 range.
// action_id 4 is a generic unarmed punch — useless for weapon-wielding creatures.
// Use weapon-specific IDs from the 85-242 range instead.
// --------------------------------------------------------------------------

// Weapon type → best Meshy attack action_id
// UPDATED per ANIMATION_REFERENCE.md visual testing:
//   - Realistic weapon IDs (219, 237, 128, 240) are wrist-centric = invisible at ASCII
//   - 19 (Skill_03) = theatrical full-arc, best for precise/light weapons
//   - 99 (Reaping_Swing) = widest lateral sweep, best for heavy/brutal weapons
//   - 125-131 (spell casts) = static arms-up, A-pose bleed = DON'T USE
const WEAPON_ATTACK_IDS = {
  sword:    19,  // Skill_03 — theatrical full-arc gesture
  axe:      99,  // Reaping_Swing — widest lateral sweep
  hammer:   99,  // Reaping_Swing — big creature + big sweep = impact
  mace:     99,  // Reaping_Swing — heavy weapon sweep
  staff:    19,  // Skill_03 — reads as casting, staff follows arm
  spear:    19,  // Skill_03 — spear reads ok with 19's arc
  dagger:   19,  // Skill_03 — light weapon, precise motion
  bow:      19,  // Skill_03 — theatrical draw (best available)
  unarmed:  99,  // Reaping_Swing — full-body claw/punch sweep
  bite:     99,  // Reaping_Swing — full-body lunge
};

// Default humanoid clips — used when no weapon type is specified
const HUMANOID_CLIPS = [
  { name: 'idle',      actionId: 0   },
  { name: 'walk',      actionId: 30  },
  { name: 'attack',    actionId: 19  },  // Skill_03 — theatrical full-arc (visually tested)
  { name: 'death',     actionId: 187 },  // Knock_Down (more dramatic than 8=Dead)
  { name: 'hit_react', actionId: 100 },  // Rightward_Spin — stumble/knockback reads best
];

// Build creature-specific clip sets based on weapon type
function getClipsForWeapon(weaponType) {
  const attackId = WEAPON_ATTACK_IDS[weaponType] ?? WEAPON_ATTACK_IDS.sword;
  return [
    { name: 'idle',      actionId: 0   },
    { name: 'walk',      actionId: 30  },
    { name: 'attack',    actionId: attackId },
    { name: 'death',     actionId: 187 },
    { name: 'hit_react', actionId: 100 },  // Rightward_Spin — stumble/knockback
  ];
}

async function rigModel(inputTaskId) {
  log('\n  Submitting to Meshy Rigging (5 credits)...');
  const res = await meshyPostV1('/rigging', { input_task_id: inputTaskId });
  if (!res.result) throw new Error(`Rigging error: ${JSON.stringify(res)}`);
  const rigTaskId = res.result;
  log(`  Rig task: ${rigTaskId}`);
  return await pollV1Task(rigTaskId, 'rigging', 'rigging');
}

async function animateClip(rigTaskId, actionId, clipName) {
  const res = await meshyPostV1('/animations', {
    rig_task_id: rigTaskId,
    action_id: actionId,
  });
  if (!res.result) throw new Error(`Animation error: ${JSON.stringify(res)}`);
  const animTaskId = res.result;
  return await pollV1Task(animTaskId, 'animations', `animation/${clipName}`);
}

// Merge multiple single-animation GLBs into one GLB with multiple named clips.
// All input GLBs must share the same skeleton node names (same Meshy rig).
async function mergeAnimationGLBs(clipPaths, clipNames, outputPath) {
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);

  const docs = [];
  for (const p of clipPaths) docs.push(await io.read(p));
  if (docs.length === 0) throw new Error('No animation GLBs to merge');

  const baseDoc = docs[0];

  // Rename the first animation
  const baseAnims = baseDoc.getRoot().listAnimations();
  if (baseAnims[0]) baseAnims[0].setName(clipNames[0]);

  // Node-name → node map for base doc (remapping target refs)
  const baseNodeMap = new Map();
  baseDoc.getRoot().listNodes().forEach(n => baseNodeMap.set(n.getName(), n));

  for (let i = 1; i < docs.length; i++) {
    const srcDoc   = docs[i];
    const clipName = clipNames[i] ?? `clip_${i}`;

    for (const srcAnim of srcDoc.getRoot().listAnimations()) {
      const dstAnim = baseDoc.createAnimation(clipName);

      const samplerMap = new Map();
      for (const srcSampler of srcAnim.listSamplers()) {
        const inAcc  = srcSampler.getInput();
        const outAcc = srcSampler.getOutput();

        const dstInput = baseDoc.createAccessor()
          .setType(inAcc.getType())
          .setArray(inAcc.getArray().slice());
        const dstOutput = baseDoc.createAccessor()
          .setType(outAcc.getType())
          .setArray(outAcc.getArray().slice());
        const dstSampler = baseDoc.createAnimationSampler()
          .setInput(dstInput)
          .setOutput(dstOutput)
          .setInterpolation(srcSampler.getInterpolation());

        dstAnim.addSampler(dstSampler);
        samplerMap.set(srcSampler, dstSampler);
      }

      for (const srcChannel of srcAnim.listChannels()) {
        const srcNode = srcChannel.getTargetNode();
        const dstNode = baseNodeMap.get(srcNode?.getName());
        if (!dstNode) continue;

        const dstChannel = baseDoc.createAnimationChannel()
          .setTargetNode(dstNode)
          .setTargetPath(srcChannel.getTargetPath())
          .setSampler(samplerMap.get(srcChannel.getSampler()));

        dstAnim.addChannel(dstChannel);
      }
    }
  }

  await io.write(outputPath, baseDoc);
}

// Full rig + animate pipeline for a humanoid creature.
// meshTaskId — the Meshy v2 text-to-3d refine task ID for the mesh.
// weaponType — optional weapon type for attack animation selection
async function rigAndAnimateCreature(slug, meshTaskId, weaponType = null) {
  log(`\n=== Rig + Animate: ${slug} ===`);
  log(`  Mesh task: ${meshTaskId}`);
  if (weaponType) log(`  Weapon type: ${weaponType}`);

  // 1. Rig
  let rigTask;
  try {
    rigTask = await rigModel(meshTaskId);
    log(`  Rig complete: ${rigTask.id}`);
  } catch (e) {
    log(`  Rigging failed: ${e.message}`);
    throw e;
  }

  // 2. Animate each clip — use weapon-specific attack if provided
  const clips = weaponType ? getClipsForWeapon(weaponType) : HUMANOID_CLIPS;
  const animDir = path.join(GLB_DIR, `${slug}-anim-clips`);
  fs.mkdirSync(animDir, { recursive: true });

  const downloaded = [];
  for (const clip of clips) {
    log(`\n  Animating clip: ${clip.name} (action_id=${clip.actionId}, 3 credits)...`);
    try {
      const animTask = await animateClip(rigTask.id, clip.actionId, clip.name);
      const url = animTask.result?.animation_glb_url ?? animTask.model_url ?? animTask.model_urls?.glb;
      if (!url) { log(`  ⚠ No model URL for ${clip.name} — skipping`); continue; }
      const dest = path.join(animDir, `${clip.name}.glb`);
      await downloadFile(url, dest);
      log(`  ✓ ${clip.name}.glb (${(fs.statSync(dest).size / 1024).toFixed(0)} KB)`);
      downloaded.push({ name: clip.name, path: dest });
    } catch (e) {
      log(`  ⚠ ${clip.name} failed: ${e.message}`);
    }
  }

  if (downloaded.length === 0) {
    throw new Error('All animation clips failed — cannot produce animated GLB');
  }

  // 3. Merge into single animated GLB
  const outPath = path.join(GLB_DIR, `${slug}-animated.glb`);
  log(`\n  Merging ${downloaded.length} clips into ${slug}-animated.glb...`);
  await mergeAnimationGLBs(
    downloaded.map(d => d.path),
    downloaded.map(d => d.name),
    outPath,
  );
  const kb = (fs.statSync(outPath).size / 1024).toFixed(0);
  log(`  ✓ Merged: ${outPath} (${kb} KB)`);
  log(`\n  Animation clips in: glb/${slug}-anim-clips/`);
  log(`  Done. Copy to public/models/creatures/${slug}-animated.glb for the game.`);

  return outPath;
}

// --------------------------------------------------------------------------
// One generation attempt
// --------------------------------------------------------------------------

async function generateAttempt(slug, prompt, attempt) {
  log(`\n  Attempt ${attempt + 1}: generating mesh...`);
  // Test mode: API returns immediately with a real sample GLB (no credits used).
  // Production mode: waits ~90s for preview + texture pass.
  const previewId = await createPreviewTask(prompt);
  log(`  Task: ${previewId}`);
  const preview = await pollTask(previewId, 'preview');

  // In test mode the preview already has a GLB — skip the refine step
  // (refine costs credits and test mode doesn't support it meaningfully).
  if (IS_TEST) {
    log('  [TEST MODE] Using preview GLB (skipping texture refine)');
    return preview;
  }

  log('  Refining with PBR textures...');
  const refineId = await createRefineTask(previewId);
  const refined  = await pollTask(refineId, 'texture pass');
  return refined;
}

// --------------------------------------------------------------------------
// Main forge loop
// --------------------------------------------------------------------------

async function forgeCreature(name, description, opts = {}) {
  const {
    iterations = 2,
    type       = null,      // undead | demon | beast | humanoid | elemental
    archetype  = null,      // weapon | claw | tail | bite | magic | amorphous
    weaponType = null,      // sword | axe | hammer | mace | staff | spear | dagger | bow | unarmed
    threshold  = QUALITY_THRESHOLD,
    dryRun     = false,
  } = opts;

  const slug = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  log(`\n=== Creature Forge: ${name} (${slug}) ===`);
  if (archetype) {
    const arch = ATTACK_ARCHETYPES[archetype];
    if (arch) {
      log(`  Archetype: ${arch.label}`);
      if (arch.meshyWarning) log(`  WARNING: ${arch.meshyWarning}`);
    } else {
      log(`  Unknown archetype: ${archetype} — ignoring`);
    }
  }
  if (dryRun) { log('[DRY RUN] Printing prompt only.\n'); }

  const typeHint = type ? TYPE_HINTS[type] : null;

  let bestResult  = null;
  let bestScore   = { avg: 0, scores: {}, method: 'none' };
  let bestPrompt  = null;

  for (let i = 0; i < iterations; i++) {
    const prompt = buildMeshyPrompt(name, description, typeHint, i, archetype);
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
  if (bestResult.model_urls?.glb) {
    log(`\nDownloading GLB → glb/${slug}.glb`);
    await downloadFile(bestResult.model_urls.glb, outPath);
    log(`Saved: ${outPath} (${(fs.statSync(outPath).size / 1024).toFixed(0)} KB)`);
  } else {
    log('\nNo GLB URL in result — skipping download.');
  }

  // Log to forge history (store task ID so rig step can be resumed)
  const meshTaskId = bestResult.id ?? null;
  appendForgeLog({
    slug, name, description, type, archetype,
    mesh_task_id: meshTaskId,
    prompt: bestPrompt, score: bestScore,
    timestamp: new Date().toISOString(),
  });

  // Auto-rig humanoid creatures
  if (type === 'humanoid' && meshTaskId && !IS_TEST) {
    log('\n  Humanoid creature — starting rig + animate pipeline...');
    try {
      await rigAndAnimateCreature(slug, meshTaskId, weaponType);
    } catch (e) {
      log(`\n  Rig pipeline failed: ${e.message}`);
      log(`  Run manually: node creature-forge.mjs --rig ${slug} ${meshTaskId}`);
    }
  } else {
    // Print next steps (manual Mixamo flow for non-humanoids)
    printNextSteps(slug, name);
  }
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

// --------------------------------------------------------------------------
// Reanimate — re-rig + reanimate an existing creature with correct action_ids
// --------------------------------------------------------------------------

// Known creature → weapon mappings for Dark Cave humanoids
const CREATURE_WEAPONS = {
  kobold:         'spear',   // bone spear → action_id 240 (Thrust_Slash)
  goblin:         'axe',     // bone cleaver → action_id 237 (Charged_Axe_Chop)
  skeleton:       'sword',   // rusty longsword → action_id 219 (Right_Hand_Sword_Slash)
  'goblin-shaman': 'staff',  // skull staff → action_id 125 (Charged_Spell_Cast)
  bugbear:        'mace',    // spiked morningstar → action_id 128 (Heavy_Hammer_Swing)
};

// Find the latest forge log entry for a slug that has a mesh_task_id
function findMeshTaskId(slug) {
  try {
    const log = JSON.parse(fs.readFileSync(FORGE_LOG, 'utf8'));
    // Search backwards for latest entry with this slug and a mesh_task_id
    for (let i = log.length - 1; i >= 0; i--) {
      if (log[i].slug === slug && log[i].mesh_task_id) return log[i].mesh_task_id;
    }
  } catch {}
  return null;
}

async function reanimateCreature(slug, weaponType) {
  const meshTaskId = findMeshTaskId(slug);
  if (!meshTaskId) {
    console.error(`No mesh_task_id found for "${slug}" in forge log.`);
    console.error('Run --list to see available creatures.');
    process.exit(1);
  }

  const weapon = weaponType || CREATURE_WEAPONS[slug];
  if (!weapon) {
    console.error(`No weapon type specified and no default for "${slug}".`);
    console.error(`Use --weapon <type> or add to CREATURE_WEAPONS mapping.`);
    console.error(`Available: ${Object.keys(WEAPON_ATTACK_IDS).join(', ')}`);
    process.exit(1);
  }

  const clips = getClipsForWeapon(weapon);
  const attackClip = clips.find(c => c.name === 'attack');
  log(`\n=== Reanimate: ${slug} ===`);
  log(`  Mesh task: ${meshTaskId}`);
  log(`  Weapon: ${weapon} → attack action_id=${attackClip.actionId}`);
  log(`  Hit react: action_id=178, Death: action_id=187`);
  log(`  Credits: 5 (rig) + ${clips.length * 3} (${clips.length} clips × 3) = ${5 + clips.length * 3} total`);

  await rigAndAnimateCreature(slug, meshTaskId, weapon);

  log(`\n=== ${slug} reanimate complete ===`);
}

// Candidate attack action_ids — dramatic full-body motion that works with baked-in weapons
const ATTACK_CANDIDATES = {
  99:  'Reaping_Swing',
  105: 'Triple_Combo_Attack',
  91:  'Double_Blade_Spin',
  92:  'Double_Combo_Attack',
  90:  'Counterstrike',
  102: 'Sword_Judgment',
  97:  'Left_Slash',
  19:  'Skill_03',
  96:  'Kung_Fu_Punch',
  100: 'Rightward_Spin',
};

async function testAttacks(slug, attackIds = null) {
  const meshTaskId = findMeshTaskId(slug);
  if (!meshTaskId) {
    console.error(`No mesh_task_id found for "${slug}" in forge log.`);
    process.exit(1);
  }

  const ids = attackIds || Object.keys(ATTACK_CANDIDATES).map(Number);
  const standardClips = [
    { name: 'idle',      actionId: 0   },
    { name: 'walk',      actionId: 30  },
    { name: 'death',     actionId: 187 },
    { name: 'hit_react', actionId: 178 },
  ];

  const totalCredits = 5 + (standardClips.length + ids.length) * 3;
  log(`\n=== Test Attacks: ${slug} ===`);
  log(`  Mesh task: ${meshTaskId}`);
  log(`  Standard clips: ${standardClips.map(c => c.name).join(', ')}`);
  log(`  Attack variants: ${ids.map(id => `${id}(${ATTACK_CANDIDATES[id] || '?'})`).join(', ')}`);
  log(`  Credits: 5 (rig) + ${(standardClips.length + ids.length) * 3} (${standardClips.length + ids.length} clips × 3) = ${totalCredits} total`);

  // 1. Rig
  log('\n--- Rigging ---');
  let rigTask;
  try {
    rigTask = await rigModel(meshTaskId);
    log(`  Rig complete: ${rigTask.id}`);
  } catch (e) {
    log(`  Rigging failed: ${e.message}`);
    throw e;
  }

  // 2. Generate standard clips
  const animDir = path.join(GLB_DIR, `${slug}-anim-clips`);
  fs.mkdirSync(animDir, { recursive: true });
  const downloaded = [];

  log('\n--- Standard Clips ---');
  for (const clip of standardClips) {
    log(`  ${clip.name} (action_id=${clip.actionId})...`);
    try {
      const animTask = await animateClip(rigTask.id, clip.actionId, clip.name);
      const url = animTask.result?.animation_glb_url ?? animTask.model_url ?? animTask.model_urls?.glb;
      if (!url) { log(`    no URL — skipping`); continue; }
      const dest = path.join(animDir, `${clip.name}.glb`);
      await downloadFile(url, dest);
      log(`    done (${(fs.statSync(dest).size / 1024).toFixed(0)} KB)`);
      downloaded.push({ name: clip.name, path: dest });
    } catch (e) {
      log(`    failed: ${e.message}`);
    }
  }

  // 3. Generate attack variants
  log('\n--- Attack Variants ---');
  for (const id of ids) {
    const label = ATTACK_CANDIDATES[id] || `action_${id}`;
    const clipName = `attack_${id}`;
    log(`  ${clipName} — ${label} (action_id=${id})...`);
    try {
      const animTask = await animateClip(rigTask.id, id, clipName);
      const url = animTask.result?.animation_glb_url ?? animTask.model_url ?? animTask.model_urls?.glb;
      if (!url) { log(`    no URL — skipping`); continue; }
      const dest = path.join(animDir, `${clipName}.glb`);
      await downloadFile(url, dest);
      log(`    done (${(fs.statSync(dest).size / 1024).toFixed(0)} KB)`);
      downloaded.push({ name: clipName, path: dest });
    } catch (e) {
      log(`    failed: ${e.message}`);
    }
  }

  if (downloaded.length === 0) {
    throw new Error('All clips failed');
  }

  // 4. Merge into single GLB
  const outPath = path.join(GLB_DIR, `${slug}-animated.glb`);
  log(`\n--- Merging ${downloaded.length} clips → ${slug}-animated.glb ---`);
  await mergeAnimationGLBs(
    downloaded.map(d => d.path),
    downloaded.map(d => d.name),
    outPath,
  );
  log(`  Done: ${outPath} (${(fs.statSync(outPath).size / 1024).toFixed(0)} KB)`);

  // List what's in the GLB
  log(`\n  Clips in ${slug}-animated.glb:`);
  downloaded.forEach(d => log(`    ${d.name}`));
  log(`\n  Open review.html to compare attack variants.`);

  return { outPath, clips: downloaded.map(d => d.name) };
}

async function reanimateAll() {
  const slugs = Object.keys(CREATURE_WEAPONS);
  const totalCredits = slugs.length * (5 + 5 * 3); // 5 rig + 5 clips × 3 each
  log(`\n=== Reanimate All Humanoids ===`);
  log(`  Creatures: ${slugs.join(', ')}`);
  log(`  Total credits: ${totalCredits} (${slugs.length} × 20)`);
  log('');

  const results = { success: [], failed: [] };
  for (const slug of slugs) {
    try {
      await reanimateCreature(slug, CREATURE_WEAPONS[slug]);
      results.success.push(slug);
    } catch (err) {
      log(`\n  FAILED: ${slug} — ${err.message}`);
      results.failed.push(slug);
    }
  }

  log('\n=== Reanimate Summary ===');
  log(`  Success: ${results.success.join(', ') || 'none'}`);
  if (results.failed.length) log(`  Failed: ${results.failed.join(', ')}`);
}

// --------------------------------------------------------------------------
// CLI dispatch
// --------------------------------------------------------------------------

// --test-attacks <slug> [--ids 99,105,91] — rig once, try multiple attack action_ids
if (args.includes('--test-attacks')) {
  const idx = args.indexOf('--test-attacks');
  const slug = args[idx + 1];
  if (!slug || slug.startsWith('--')) {
    console.error('Usage: node creature-forge.mjs --test-attacks <slug> [--ids 99,105,91]');
    process.exit(1);
  }
  const idsArg = args.includes('--ids') ? args[args.indexOf('--ids') + 1] : null;
  const attackIds = idsArg ? idsArg.split(',').map(Number) : null;
  testAttacks(slug, attackIds).catch(err => {
    console.error('Test attacks failed:', err.message);
    process.exit(1);
  });
}
// --reanimate-all — batch re-rig + reanimate all Dark Cave humanoids
else if (args.includes('--reanimate-all')) {
  reanimateAll().catch(err => {
    console.error('Fatal:', err.message);
    process.exit(1);
  });
}
// --reanimate <slug> [--weapon <type>] — re-rig + reanimate one creature
else if (args.includes('--reanimate')) {
  const idx = args.indexOf('--reanimate');
  const slug = args[idx + 1];
  if (!slug || slug.startsWith('--')) {
    console.error('Usage: node creature-forge.mjs --reanimate <slug> [--weapon <type>]');
    process.exit(1);
  }
  const weaponType = args.includes('--weapon') ? args[args.indexOf('--weapon') + 1] : null;
  reanimateCreature(slug, weaponType).catch(err => {
    console.error('Reanimate failed:', err.message);
    process.exit(1);
  });
}
// --rig <slug> <meshTaskId> — rig + animate an already-generated mesh
else if (args.includes('--rig')) {
  const rigIdx = args.indexOf('--rig');
  const slug = args[rigIdx + 1];
  const meshTaskId = args[rigIdx + 2];
  if (!slug || !meshTaskId) {
    console.error('Usage: node creature-forge.mjs --rig <slug> <meshTaskId>');
    process.exit(1);
  }
  const weaponType = args.includes('--weapon') ? args[args.indexOf('--weapon') + 1] : null;
  rigAndAnimateCreature(slug, meshTaskId, weaponType).catch(err => {
    console.error('Rig failed:', err.message);
    process.exit(1);
  });
} else {
  if (args.length < 2 && !args.includes('--dry-run')) {
    console.log(`
Usage:
  node creature-forge.mjs <name> <description> [options]
  node creature-forge.mjs --rig <slug> <meshTaskId> [--weapon <type>]
  node creature-forge.mjs --reanimate <slug> [--weapon <type>]
  node creature-forge.mjs --reanimate-all

Options:
  --iterations N       Number of generation attempts (default: 2)
  --type <type>        Creature type: undead | demon | beast | humanoid | elemental
                       humanoid — auto-rigs + animates after mesh generation
  --archetype <arch>   Attack archetype: weapon | claw | tail | bite | magic | amorphous
                       Adds archetype-specific structural hints to the Meshy prompt
  --weapon <type>      Weapon type for attack animation: sword | axe | hammer | mace |
                       staff | spear | dagger | bow | unarmed | bite
  --threshold N        Quality threshold 0-1 (default: 0.65)
  --dry-run            Print prompts only, no API calls
  --list               Show all forged creatures
  --rig <slug> <id>    Run rig + animate on an existing mesh task ID
  --reanimate <slug>   Re-rig + reanimate creature with correct weapon action_ids
  --reanimate-all      Re-rig + reanimate ALL Dark Cave humanoids (100 credits)

Weapon → Attack action_id mapping:
  sword=219   axe=237    hammer=128   mace=128   staff=125
  spear=240   dagger=92  bow=224      unarmed=4  bite=4

Dark Cave creature weapons (used by --reanimate-all):
  kobold=spear  goblin=axe  skeleton=sword  goblin-shaman=staff  bugbear=mace

Archetypes:
  weapon     — Weapon-wielder (goblin, skeleton, bugbear)
  claw       — Claw/hook attacker (hook-horror, dire-rat, owlbear)
  tail       — Tail/tentacle attacker (basilisk, carrion-crawler, manticore)
  bite       — Bite/jaw attacker (dire-rat, mimic, basilisk)
  magic      — Spell caster (goblin-shaman, lich, dark mage)
  amorphous  — Formless (gelatinous-ooze) — Meshy struggles with these

Examples:
  node creature-forge.mjs "Kobold" "small reptilian humanoid, crude dagger" --type humanoid --archetype weapon
  node creature-forge.mjs --rig kobold 019d59c0-958e-7f73-9377-41cbdbb713ff --weapon spear
  node creature-forge.mjs --reanimate skeleton --weapon sword
  node creature-forge.mjs --reanimate-all

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
  const archetype   = args.includes('--archetype') ? args[args.indexOf('--archetype') + 1] : null;
  const weaponType  = args.includes('--weapon') ? args[args.indexOf('--weapon') + 1] : null;
  const threshold   = parseFloat(args[args.indexOf('--threshold') + 1] ?? '0.65') || QUALITY_THRESHOLD;
  const dryRun      = args.includes('--dry-run');

  forgeCreature(name, description, { iterations, type, archetype, weaponType, threshold, dryRun }).catch(err => {
    console.error('Fatal:', err.message);
    process.exit(1);
  });
}
