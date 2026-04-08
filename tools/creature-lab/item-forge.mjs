#!/usr/bin/env node
// ==========================================================================
// item-forge.mjs — Automated 3D item model pipeline
//
// Generates game-ready GLB item models via Meshy.ai text-to-3D:
//   1. Reads items.json for weapon/armor names + descriptions
//   2. Builds dark-fantasy prompts per item category + rarity
//   3. Generates 3D mesh via Meshy preview → refine
//   4. Downloads + optimizes via creature-edit.mjs
//   5. Writes manifest.json for client runtime loading
//
// Usage:
//   node item-forge.mjs list                           # Show all forgeable items
//   node item-forge.mjs forge "Broken Sword"           # Forge one item by name
//   node item-forge.mjs forge-all --type weapons       # Batch forge all weapons
//   node item-forge.mjs forge-all --type armor         # Batch forge all armor
//   node item-forge.mjs forge-all                      # Batch forge everything
//   node item-forge.mjs manifest                       # Rebuild manifest from existing GLBs
//   node item-forge.mjs --dry-run forge "Iron Axe"     # Print prompt only
//
// API Keys (set in environment or .env):
//   MESHY_API_KEY — Meshy Pro key (msy_xxx)
//
// Cost: ~$0.05/item (preview + refine). 43 player items ≈ $2.15.
// ==========================================================================

import fs from 'fs';
import path from 'path';
import https from 'https';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const GLB_DIR = path.join(__dirname, 'glb', 'items');
const FORGE_LOG = path.join(__dirname, 'item-forge-log.json');
const ITEMS_JSON = path.join(__dirname, '..', '..', 'packages', 'contracts', 'zones', 'dark_cave', 'items.json');
const MANIFEST_OUT = path.join(__dirname, 'item-manifest.json');

// Load .env for API keys
try {
  const envPath = path.join(__dirname, '.env');
  const envText = fs.readFileSync(envPath, 'utf8');
  for (const line of envText.split('\n')) {
    const m = line.match(/^(\w+)=(.+)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
  }
} catch {}

// Meshy key checked lazily — only needed for forge commands, not list/manifest
function getMeshyKey() {
  const key = process.env.MESHY_API_KEY;
  if (!key) {
    console.error('ERROR: Set MESHY_API_KEY in environment or tools/creature-lab/.env');
    process.exit(1);
  }
  return key;
}

// --------------------------------------------------------------------------
// Item classification
// --------------------------------------------------------------------------

// Monster-only weapons (dropChance: 0, no player use) — skip these
const MONSTER_WEAPONS = new Set([
  'Venomous Bite', 'Crushing Slam', 'Razor Claws', 'Dark Magic',
  'Elemental Burst', 'Stone Fist', 'Shadow Strike', 'Basilisk Fangs',
  'Petrifying Gaze',
]);

// Classify weapon subtype from name/description for prompt engineering
function classifyWeaponType(name, description) {
  const n = name.toLowerCase();
  const d = (description || '').toLowerCase();
  if (/bow/.test(n)) return 'bow';
  if (/staff/.test(n)) return 'staff';
  if (/wand|rod/.test(n)) return 'wand';
  if (/axe|cleaver/.test(n)) return 'axe';
  if (/hammer|maul|cudgel|mace/.test(n)) return 'mace';
  if (/dagger|fang|shard|phasefang/.test(n)) return 'dagger';
  if (/sword|blade/.test(n)) return 'sword';
  if (/spear|lance/.test(n)) return 'spear';
  // Fallback: check description
  if (/bow|arrow|string/.test(d)) return 'bow';
  if (/staff|arcane|magic/.test(d)) return 'staff';
  if (/wand|rod|channel/.test(d)) return 'wand';
  return 'sword'; // default
}

// Classify armor subtype
function classifyArmorType(item) {
  const at = (item.armorType || '').toLowerCase();
  if (at === 'cloth') return 'cloth';
  if (at === 'leather') return 'leather';
  if (at === 'plate') return 'plate';
  return 'leather';
}

// Weapon subtype → equipment socket
const WEAPON_SOCKET = {
  sword: 'hand_R.socket',
  axe: 'hand_R.socket',
  mace: 'hand_R.socket',
  dagger: 'hand_R.socket',
  spear: 'hand_R.socket',
  bow: 'hand_L.socket',
  staff: 'hand_R.socket',
  wand: 'hand_R.socket',
};

// --------------------------------------------------------------------------
// Prompt engineering (follows ART_SYSTEM.md rarity visual hierarchy)
// --------------------------------------------------------------------------

const DARK_FANTASY_STYLE = [
  'dark fantasy', 'medieval', 'rough weathered', 'battle-worn',
  'game item', 'isolated on pure black background',
  'single object centered', 'no character no hands',
  'lowpoly game-ready', 'clear silhouette',
].join(', ');

// Rarity → visual treatment (per ART_SYSTEM.md)
const RARITY_HINTS = {
  0: 'simple worn damaged, monochrome tones, minimal detail, disposable look',
  1: 'functional but plain, slight wear marks, simple construction',
  2: 'well-crafted, single muted color accent, visible craftsmanship, slight metallic sheen',
  3: 'ornate detailed, visible runes and engravings, color accent at 60% saturation, rare quality',
  4: 'epic quality, dual-color accents, exaggerated proportions, ornate flourishes, energy wisps, glowing elements',
};

// Weapon subtype → structural hints
const WEAPON_PROMPTS = {
  sword: 'medieval sword, straight blade, crossguard and pommel visible, {name}, {desc}',
  axe: 'battle axe, heavy curved blade on wooden haft, {name}, {desc}',
  mace: 'flanged mace or warhammer, heavy metal head on wooden handle, {name}, {desc}',
  dagger: 'curved dagger or short blade, ornate handle, {name}, {desc}',
  spear: 'long spear with pointed head, wooden shaft, {name}, {desc}',
  bow: 'recurve bow, wooden limbs with bowstring, {name}, {desc}',
  staff: 'magical staff, tall wooden staff with crystal or orb tip, arcane energy, {name}, {desc}',
  wand: 'magical wand or channeling rod, short rod with glowing tip, arcane energy, {name}, {desc}',
};

// Armor subtype → structural hints
const ARMOR_PROMPTS = {
  cloth: 'cloth robe or vestments, flowing fabric, hooded or collared, {name}, {desc}',
  leather: 'leather armor vest or jerkin, stitched panels, buckles and straps, {name}, {desc}',
  plate: 'metal plate armor breastplate, riveted steel plates, heavy and protective, {name}, {desc}',
};

// Color accents per weapon type (per ART_SYSTEM.md)
const WEAPON_COLOR = {
  sword: 'warm steel-grey metallic tones',
  axe: 'warm steel-grey metallic tones',
  mace: 'warm steel-grey metallic tones',
  dagger: 'warm steel-grey metallic tones',
  spear: 'warm steel-grey metallic tones',
  bow: 'amber-gold wood tones',
  staff: 'blue-violet arcane glow',
  wand: 'blue-violet arcane glow',
};

const ARMOR_COLOR = {
  cloth: 'faint blue-grey mystical tones',
  leather: 'warm brown-amber tones',
  plate: 'bright steel-white with subtle gold trim',
};

function buildItemPrompt(name, description, category, subtype, rarity) {
  const templateMap = category === 'weapons' ? WEAPON_PROMPTS : ARMOR_PROMPTS;
  const colorMap = category === 'weapons' ? WEAPON_COLOR : ARMOR_COLOR;

  let prompt = (templateMap[subtype] || templateMap.sword)
    .replace('{name}', name)
    .replace('{desc}', description || '');

  const rarityHint = RARITY_HINTS[Math.min(rarity, 4)] || RARITY_HINTS[2];
  const color = colorMap[subtype] || 'muted grey tones';

  prompt = `${prompt}, ${rarityHint}, ${color}, ${DARK_FANTASY_STYLE}`;
  return prompt;
}

// --------------------------------------------------------------------------
// HTTP helpers (mirrored from creature-forge.mjs)
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

function meshyHeaders() {
  return { 'Authorization': `Bearer ${getMeshyKey()}`, 'Content-Type': 'application/json' };
}

async function meshyPost(endpoint, body) {
  return httpsRequest(`${MESHY_BASE}${endpoint}`, { method: 'POST', headers: meshyHeaders() }, body);
}

async function meshyGet(endpoint) {
  return httpsRequest(`${MESHY_BASE}${endpoint}`, { headers: meshyHeaders() });
}

async function createPreviewTask(prompt) {
  const res = await meshyPost('/text-to-3d', {
    mode: 'preview',
    prompt,
    ai_model: 'meshy-6',
    model_type: 'lowpoly',
    target_polycount: 4000,       // items are simpler than creatures
    topology: 'quad',
    symmetry_mode: 'auto',
    target_formats: ['glb'],
  });
  if (!res.result) throw new Error(`Meshy error: ${JSON.stringify(res)}`);
  return res.result;
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
  const maxWait = 600; // 10 min — refine step can be slow
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
// Item data loader
// --------------------------------------------------------------------------

function loadItems() {
  const data = JSON.parse(fs.readFileSync(ITEMS_JSON, 'utf8'));
  const items = [];

  // Weapons (skip monster-only)
  for (const w of data.weapons || []) {
    if (MONSTER_WEAPONS.has(w.name)) continue;
    if (w.dropChance === 0 && w.price === 0) continue; // monster weapon fallback
    const subtype = classifyWeaponType(w.name, w.description);
    items.push({
      name: w.name,
      description: w.description || '',
      rarity: w.rarity ?? 0,
      category: 'weapons',
      subtype,
      socket: WEAPON_SOCKET[subtype] || 'hand_R.socket',
      metadataUri: w.metadataUri,
    });
  }

  // Armor
  for (const a of data.armor || []) {
    const subtype = classifyArmorType(a);
    items.push({
      name: a.name,
      description: a.description || '',
      rarity: a.rarity ?? 0,
      category: 'armor',
      subtype,
      socket: 'chest.socket',
      metadataUri: a.metadataUri,
    });
  }

  return items;
}

function slugify(name) {
  return name.toLowerCase().replace(/['']/g, '').replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
}

// --------------------------------------------------------------------------
// Forge pipeline
// --------------------------------------------------------------------------

async function forgeItem(item, opts = {}) {
  const { dryRun = false } = opts;
  const slug = slugify(item.name);

  console.log(`\n=== Item Forge: ${item.name} (${slug}) ===`);
  console.log(`  Category: ${item.category}, Subtype: ${item.subtype}, Rarity: ${item.rarity}`);
  console.log(`  Socket: ${item.socket}`);

  const prompt = buildItemPrompt(item.name, item.description, item.category, item.subtype, item.rarity);
  console.log(`  Prompt: ${prompt.slice(0, 120)}...`);

  if (dryRun) {
    console.log(`  [DRY RUN] Full prompt:\n  ${prompt}\n`);
    return null;
  }

  // Check if GLB already exists
  const outPath = path.join(GLB_DIR, `${slug}.glb`);
  if (fs.existsSync(outPath) && !opts.force) {
    console.log(`  GLB exists: ${outPath} (use --force to regenerate)`);
    return outPath;
  }

  // Generate
  console.log('  Submitting to Meshy...');
  const previewId = await createPreviewTask(prompt);
  console.log(`  Preview task: ${previewId}`);
  const preview = await pollTask(previewId, 'preview');

  console.log('  Refining with PBR textures...');
  const refineId = await createRefineTask(previewId);
  const refined = await pollTask(refineId, 'texture pass');

  // Download
  const glbUrl = refined.model_urls?.glb;
  if (!glbUrl) {
    console.log('  ERROR: No GLB URL in result');
    return null;
  }

  fs.mkdirSync(GLB_DIR, { recursive: true });
  console.log(`  Downloading → glb/items/${slug}.glb`);
  await downloadFile(glbUrl, outPath);
  const kb = (fs.statSync(outPath).size / 1024).toFixed(0);
  console.log(`  Saved: ${outPath} (${kb} KB)`);

  // Optimize via creature-edit.mjs
  try {
    const { execSync } = await import('child_process');
    const optimizedPath = outPath.replace('.glb', '-optimized.glb');
    console.log('  Optimizing...');
    execSync(
      `node "${path.join(__dirname, 'creature-edit.mjs')}" optimize "${outPath}" --output "${optimizedPath}"`,
      { stdio: 'pipe' },
    );
    if (fs.existsSync(optimizedPath)) {
      const optKb = (fs.statSync(optimizedPath).size / 1024).toFixed(0);
      fs.renameSync(optimizedPath, outPath);
      console.log(`  Optimized: ${optKb} KB (was ${kb} KB)`);
    }
  } catch (e) {
    console.log(`  Optimize skipped: ${e.message?.slice(0, 80)}`);
  }

  // Log
  appendForgeLog({
    slug,
    name: item.name,
    category: item.category,
    subtype: item.subtype,
    rarity: item.rarity,
    socket: item.socket,
    meshTaskId: refined.id ?? previewId,
    prompt,
    timestamp: new Date().toISOString(),
  });

  console.log(`  Done: ${item.name}`);
  return outPath;
}

async function forgeAll(opts = {}) {
  const items = loadItems();
  const filtered = opts.type
    ? items.filter(i => i.category === opts.type)
    : items;

  console.log(`\n=== Batch Forge: ${filtered.length} items ===`);
  if (opts.type) console.log(`  Filter: ${opts.type}`);

  const results = { success: 0, skipped: 0, failed: 0 };
  const failures = [];
  for (const item of filtered) {
    try {
      const result = await forgeItem(item, opts);
      if (result) results.success++;
      else if (opts.dryRun) results.skipped++;
    } catch (e) {
      console.log(`  FAILED: ${item.name} — ${e.message}`);
      results.failed++;
      failures.push(item);
    }

    // Rate limit: small pause between Meshy requests
    if (!opts.dryRun) await sleep(2000);
  }

  // Auto-retry failures once
  if (failures.length > 0 && !opts.dryRun) {
    console.log(`\n=== Retrying ${failures.length} failed items ===`);
    for (const item of failures) {
      try {
        const result = await forgeItem(item, { ...opts, force: true });
        if (result) { results.success++; results.failed--; }
      } catch (e) {
        console.log(`  RETRY FAILED: ${item.name} — ${e.message}`);
      }
      await sleep(2000);
    }
  }

  console.log(`\n=== Batch Complete ===`);
  console.log(`  Success: ${results.success}, Skipped: ${results.skipped}, Failed: ${results.failed}`);
  return results;
}

// --------------------------------------------------------------------------
// Manifest builder
// --------------------------------------------------------------------------

function buildManifest() {
  const items = loadItems();
  const manifest = {};

  for (const item of items) {
    const slug = slugify(item.name);
    const glbPath = path.join(GLB_DIR, `${slug}.glb`);
    const exists = fs.existsSync(glbPath);

    manifest[slug] = {
      name: item.name,
      file: exists ? `${slug}.glb` : null,
      category: item.category,
      subtype: item.subtype,
      rarity: item.rarity,
      socket: item.socket,
      metadataUri: item.metadataUri,
      // Socket-relative offset/rotation/scale (defaults, tune per-item later)
      offset: [0, 0, 0],
      rotation: [0, 0, 0],
      scale: 1.0,
      generated: exists,
    };
  }

  fs.writeFileSync(MANIFEST_OUT, JSON.stringify(manifest, null, 2));
  const total = Object.keys(manifest).length;
  const generated = Object.values(manifest).filter(m => m.generated).length;
  console.log(`\nManifest written: ${MANIFEST_OUT}`);
  console.log(`  ${generated}/${total} items have GLBs`);
  return manifest;
}

// --------------------------------------------------------------------------
// Deploy — copy generated GLBs + manifest to client public dir
// --------------------------------------------------------------------------

const PUBLIC_ITEMS_DIR = path.join(__dirname, '..', '..', 'packages', 'client', 'public', 'models', 'items');

function deployItems() {
  const manifest = buildManifest();
  fs.mkdirSync(PUBLIC_ITEMS_DIR, { recursive: true });

  let copied = 0;
  for (const [slug, entry] of Object.entries(manifest)) {
    if (!entry.generated) continue;
    const src = path.join(GLB_DIR, entry.file);
    const dst = path.join(PUBLIC_ITEMS_DIR, entry.file);
    fs.copyFileSync(src, dst);
    copied++;
  }

  // Write client-facing manifest (strip generated flag, use relative paths)
  const clientManifest = {};
  for (const [slug, entry] of Object.entries(manifest)) {
    if (!entry.generated) continue;
    clientManifest[slug] = {
      name: entry.name,
      file: entry.file,
      category: entry.category,
      subtype: entry.subtype,
      rarity: entry.rarity,
      socket: entry.socket,
      offset: entry.offset,
      rotation: entry.rotation,
      scale: entry.scale,
    };
  }
  fs.writeFileSync(path.join(PUBLIC_ITEMS_DIR, 'manifest.json'), JSON.stringify(clientManifest, null, 2));

  console.log(`\nDeployed ${copied} GLBs to ${PUBLIC_ITEMS_DIR}`);
  console.log(`  Client manifest: ${PUBLIC_ITEMS_DIR}/manifest.json`);
}

// --------------------------------------------------------------------------
// Forge log
// --------------------------------------------------------------------------

function appendForgeLog(entry) {
  let log = [];
  try { log = JSON.parse(fs.readFileSync(FORGE_LOG, 'utf8')); } catch {}
  // Replace existing entry for same slug
  log = log.filter(e => e.slug !== entry.slug);
  log.push(entry);
  fs.writeFileSync(FORGE_LOG, JSON.stringify(log, null, 2));
}

// --------------------------------------------------------------------------
// CLI
// --------------------------------------------------------------------------

function printUsage() {
  console.log(`
item-forge.mjs — Generate 3D item models for Ultimate Dominion

Commands:
  list                           Show all forgeable items from items.json
  forge "<Item Name>"            Generate one item by name
  forge-all [--type weapons|armor]  Batch generate all items
  manifest                       Rebuild manifest.json from existing GLBs
  deploy                         Copy GLBs + manifest to packages/client/public/models/items/

Options:
  --dry-run     Print prompts without generating
  --force       Regenerate even if GLB exists
  --type        Filter by category (weapons or armor)
`);
}

function listItems() {
  const items = loadItems();
  console.log(`\n${items.length} forgeable items:\n`);

  const byCategory = {};
  for (const item of items) {
    (byCategory[item.category] ??= []).push(item);
  }

  for (const [cat, catItems] of Object.entries(byCategory)) {
    console.log(`  ${cat.toUpperCase()} (${catItems.length}):`);
    for (const item of catItems) {
      const slug = slugify(item.name);
      const glbExists = fs.existsSync(path.join(GLB_DIR, `${slug}.glb`));
      const status = glbExists ? '\x1b[32m+\x1b[0m' : '\x1b[31m-\x1b[0m';
      console.log(`    ${status} ${item.name.padEnd(22)} R${item.rarity}  ${item.subtype.padEnd(8)} → ${item.socket}`);
    }
  }
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 0) { printUsage(); process.exit(0); }

  const dryRun = args.includes('--dry-run');
  const force = args.includes('--force');
  const typeIdx = args.indexOf('--type');
  const type = typeIdx >= 0 ? args[typeIdx + 1] : null;

  const cmd = args.find(a => !a.startsWith('--') && (typeIdx < 0 || args.indexOf(a) !== typeIdx + 1));

  switch (cmd) {
    case 'list':
      listItems();
      break;

    case 'forge': {
      const nameArg = args.find((a, i) => i > args.indexOf('forge') && !a.startsWith('--'));
      if (!nameArg) { console.error('Usage: item-forge.mjs forge "<Item Name>"'); process.exit(1); }
      const items = loadItems();
      const item = items.find(i => i.name.toLowerCase() === nameArg.toLowerCase());
      if (!item) {
        console.error(`Item not found: "${nameArg}". Run 'list' to see available items.`);
        process.exit(1);
      }
      await forgeItem(item, { dryRun, force });
      buildManifest();
      break;
    }

    case 'forge-all':
      await forgeAll({ dryRun, force, type });
      buildManifest();
      break;

    case 'manifest':
      buildManifest();
      break;

    case 'deploy':
      deployItems();
      break;

    default:
      console.error(`Unknown command: ${cmd}`);
      printUsage();
      process.exit(1);
  }
}

main().catch(err => {
  console.error(`\nFATAL: ${err.message}`);
  process.exit(1);
});
