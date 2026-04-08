#!/usr/bin/env node
// ==========================================================================
// creature-edit.mjs — Post-generation GLB surgery via gltf-transform
//
// Usage:
//   node creature-edit.mjs info <file.glb>
//   node creature-edit.mjs repose <file.glb> --bone <name> --rx <deg> --ry <deg> --rz <deg>
//   node creature-edit.mjs scale <file.glb> --factor <f>
//   node creature-edit.mjs rename-bones <file.glb> --map <biped|quadruped|custom.json>
//   node creature-edit.mjs add-sockets <file.glb>
//   node creature-edit.mjs strip-animations <file.glb>
//   node creature-edit.mjs optimize <file.glb>
//   node creature-edit.mjs rig <mesh.glb>           # UniRig via Replicate API
//
// All write operations output to <name>-edited.glb unless --output is given.
// ==========================================================================

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── Helpers ──────────────────────────────────────────────────────────────

function degToRad(deg) { return deg * Math.PI / 180; }

/** Euler XYZ (radians) → quaternion [x, y, z, w] */
function eulerToQuat(rx, ry, rz) {
  const cx = Math.cos(rx / 2), sx = Math.sin(rx / 2);
  const cy = Math.cos(ry / 2), sy = Math.sin(ry / 2);
  const cz = Math.cos(rz / 2), sz = Math.sin(rz / 2);
  return [
    sx * cy * cz - cx * sy * sz,
    cx * sy * cz + sx * cy * sz,
    cx * cy * sz - sx * sy * cz,
    cx * cy * cz + sx * sy * sz,
  ];
}

/** Multiply two quaternions: a * b */
function quatMultiply(a, b) {
  return [
    a[3]*b[0] + a[0]*b[3] + a[1]*b[2] - a[2]*b[1],
    a[3]*b[1] - a[0]*b[2] + a[1]*b[3] + a[2]*b[0],
    a[3]*b[2] + a[0]*b[1] - a[1]*b[0] + a[2]*b[3],
    a[3]*b[3] - a[0]*b[0] - a[1]*b[1] - a[2]*b[2],
  ];
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--')) {
      const key = argv[i].slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith('--')) {
        args[key] = next;
        i++;
      } else {
        args[key] = true;
      }
    }
  }
  return args;
}

function outputPath(inputFile, args) {
  if (args.output) return args.output;
  const ext = path.extname(inputFile);
  return inputFile.replace(ext, `-edited${ext}`);
}

async function readDoc(filePath) {
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
  return { io, doc: await io.read(filePath) };
}

async function writeDoc(io, doc, outPath) {
  await io.write(outPath, doc);
  const stat = fs.statSync(outPath);
  console.log(`  Written: ${outPath} (${(stat.size / 1024).toFixed(1)} KB)`);
}

// ── Standard bone socket definitions ─────────────────────────────────────

const STANDARD_SOCKETS = {
  biped: [
    { name: 'hand_R.socket', parent: 'hand_R',   fallback: ['RightHand', 'mixamorig:RightHand', 'Hand_R'] },
    { name: 'hand_L.socket', parent: 'hand_L',   fallback: ['LeftHand', 'mixamorig:LeftHand', 'Hand_L'] },
    { name: 'chest.socket',  parent: 'chest',     fallback: ['Spine2', 'Spine02', 'mixamorig:Spine2', 'Chest', 'spine_1', 'Spine'] },
    { name: 'head.socket',   parent: 'head',      fallback: ['Head', 'mixamorig:Head'] },
    { name: 'back.socket',   parent: 'chest',     fallback: ['Spine2', 'Spine02', 'mixamorig:Spine2', 'Chest', 'spine_1', 'Spine'] },
  ],
  quadruped: [
    { name: 'head.socket',   parent: 'head',      fallback: ['Head', 'mixamorig:Head'] },
    { name: 'chest.socket',  parent: 'chest',     fallback: ['Spine2', 'Spine02', 'mixamorig:Spine2', 'Chest', 'spine_1', 'Spine'] },
    { name: 'back.socket',   parent: 'chest',     fallback: ['Spine2', 'Spine02', 'mixamorig:Spine2', 'Chest', 'spine_1', 'Spine'] },
  ],
};

// ── Standard bone rename maps ────────────────────────────────────────────

const BONE_MAPS = {
  biped: {
    'mixamorig:Hips':           'hips',
    'mixamorig:Spine':          'spine',
    'mixamorig:Spine1':         'spine_1',
    'mixamorig:Spine01':        'spine_1',
    'mixamorig:Spine2':         'chest',
    'mixamorig:Spine02':        'chest',
    'mixamorig:Neck':           'neck',
    'mixamorig:Head':           'head',
    'mixamorig:LeftShoulder':   'shoulder_L',
    'mixamorig:LeftArm':        'arm_upper_L',
    'mixamorig:LeftForeArm':    'arm_lower_L',
    'mixamorig:LeftHand':       'hand_L',
    'mixamorig:RightShoulder':  'shoulder_R',
    'mixamorig:RightArm':       'arm_upper_R',
    'mixamorig:RightForeArm':   'arm_lower_R',
    'mixamorig:RightHand':      'hand_R',
    'mixamorig:LeftUpLeg':      'leg_upper_L',
    'mixamorig:LeftLeg':        'leg_lower_L',
    'mixamorig:LeftFoot':       'foot_L',
    'mixamorig:RightUpLeg':     'leg_upper_R',
    'mixamorig:RightLeg':       'leg_lower_R',
    'mixamorig:RightFoot':      'foot_R',
    // Direct name aliases (non-Mixamo rigs)
    'Hips':           'hips',
    'Spine':          'spine',
    'Spine1':         'spine_1',
    'Spine01':        'spine_1',
    'Spine2':         'chest',
    'Spine02':        'chest',
    'Neck':           'neck',
    'Head':           'head',
    'LeftHand':       'hand_L',
    'RightHand':      'hand_R',
    'LeftFoot':       'foot_L',
    'RightFoot':      'foot_R',
  },
  quadruped: {
    'Hips':           'hips',
    'Spine':          'spine',
    'Spine1':         'spine_1',
    'Spine2':         'chest',
    'Neck':           'neck',
    'Head':           'head',
    'FrontLeg_L':     'leg_front_L',
    'FrontFoot_L':    'foot_front_L',
    'FrontLeg_R':     'leg_front_R',
    'FrontFoot_R':    'foot_front_R',
    'BackLeg_L':      'leg_back_L',
    'BackFoot_L':     'foot_back_L',
    'BackLeg_R':      'leg_back_R',
    'BackFoot_R':     'foot_back_R',
    'Tail':           'tail_01',
    'Tail1':          'tail_02',
    'Tail2':          'tail_03',
  },
};

// ── Commands ─────────────────────────────────────────────────────────────

async function cmdInfo(filePath) {
  const { doc } = await readDoc(filePath);
  const root = doc.getRoot();

  // Skeleton tree
  const nodes = root.listNodes();
  const skins = root.listSkins();
  const meshes = root.listMeshes();
  const anims  = root.listAnimations();

  console.log(`\n  File: ${path.basename(filePath)}`);
  console.log(`  Nodes: ${nodes.length}`);
  console.log(`  Meshes: ${meshes.length}`);
  console.log(`  Skins: ${skins.length}`);

  // Vertex count
  let totalVerts = 0;
  for (const mesh of meshes) {
    for (const prim of mesh.listPrimitives()) {
      const pos = prim.getAttribute('POSITION');
      if (pos) totalVerts += pos.getCount();
    }
  }
  console.log(`  Vertices: ${totalVerts.toLocaleString()}`);

  // Materials
  const materials = root.listMaterials();
  console.log(`  Materials: ${materials.length}`);
  for (const mat of materials) {
    console.log(`    - ${mat.getName() || '(unnamed)'}`);
  }

  // Animation clips
  console.log(`\n  Animation Clips: ${anims.length}`);
  for (const anim of anims) {
    const channels = anim.listChannels();
    const samplers = anim.listSamplers();
    let maxTime = 0;
    for (const s of samplers) {
      const input = s.getInput();
      if (input) {
        const arr = input.getArray();
        if (arr && arr.length > 0) maxTime = Math.max(maxTime, arr[arr.length - 1]);
      }
    }
    console.log(`    ${anim.getName() || '(unnamed)'}: ${channels.length} channels, ${maxTime.toFixed(2)}s`);
  }

  // Skeleton hierarchy
  if (skins.length > 0) {
    console.log(`\n  Skeleton:`);
    const skin = skins[0];
    const joints = skin.listJoints();
    const jointSet = new Set(joints);

    // Build parent map
    const parentMap = new Map();
    for (const node of nodes) {
      for (const child of node.listChildren()) {
        parentMap.set(child, node);
      }
    }

    // Find roots (joints with no joint parent)
    const roots = joints.filter(j => !jointSet.has(parentMap.get(j)));

    function printNode(node, indent) {
      const rot = node.getRotation();
      const trans = node.getTranslation();
      const rotStr = rot ? `rot=[${rot.map(v => v.toFixed(3)).join(',')}]` : '';
      console.log(`${'  '.repeat(indent + 2)}${node.getName() || '?'} ${rotStr}`);
      for (const child of node.listChildren()) {
        if (jointSet.has(child)) {
          printNode(child, indent + 1);
        }
      }
    }

    for (const r of roots) printNode(r, 0);
  } else {
    // No skin — print top-level node tree
    console.log(`\n  Node Tree (no skeleton):`);
    const scenes = root.listScenes();
    for (const scene of scenes) {
      for (const child of scene.listChildren()) {
        printTree(child, 2);
      }
    }
  }

  function printTree(node, indent) {
    console.log(`${'  '.repeat(indent)}${node.getName() || '(unnamed)'}`);
    for (const child of node.listChildren()) {
      printTree(child, indent + 1);
    }
  }
}

async function cmdRepose(filePath, args) {
  const { io, doc } = await readDoc(filePath);
  const boneName = args.bone;
  if (!boneName) { console.error('  Error: --bone required'); process.exit(1); }

  const rx = degToRad(parseFloat(args.rx || 0));
  const ry = degToRad(parseFloat(args.ry || 0));
  const rz = degToRad(parseFloat(args.rz || 0));

  // Find the bone node
  const node = doc.getRoot().listNodes().find(n => n.getName() === boneName);
  if (!node) {
    console.error(`  Error: bone "${boneName}" not found`);
    console.log('  Available bones:');
    doc.getRoot().listNodes().forEach(n => {
      if (n.getName()) console.log(`    ${n.getName()}`);
    });
    process.exit(1);
  }

  // Apply rotation delta as quaternion multiply
  const deltaQuat = eulerToQuat(rx, ry, rz);
  const currentQuat = node.getRotation() || [0, 0, 0, 1];
  const newQuat = quatMultiply(currentQuat, deltaQuat);
  node.setRotation(newQuat);

  console.log(`  Rotated "${boneName}" by rx=${args.rx||0} ry=${args.ry||0} rz=${args.rz||0} degrees`);

  const out = outputPath(filePath, args);
  await writeDoc(io, doc, out);
}

async function cmdScale(filePath, args) {
  const factor = parseFloat(args.factor);
  if (!factor || factor <= 0) { console.error('  Error: --factor required (positive number)'); process.exit(1); }

  const { io, doc } = await readDoc(filePath);
  const scenes = doc.getRoot().listScenes();
  for (const scene of scenes) {
    for (const child of scene.listChildren()) {
      const s = child.getScale() || [1, 1, 1];
      child.setScale([s[0] * factor, s[1] * factor, s[2] * factor]);
    }
  }

  console.log(`  Scaled by ${factor}x`);
  const out = outputPath(filePath, args);
  await writeDoc(io, doc, out);
}

async function cmdRenameBones(filePath, args) {
  const mapName = args.map || 'biped';

  let boneMap;
  if (mapName.endsWith('.json')) {
    boneMap = JSON.parse(fs.readFileSync(mapName, 'utf-8'));
  } else {
    boneMap = BONE_MAPS[mapName];
    if (!boneMap) { console.error(`  Error: unknown map "${mapName}". Use: biped, quadruped, or a .json path`); process.exit(1); }
  }

  const { io, doc } = await readDoc(filePath);
  let renamed = 0;
  for (const node of doc.getRoot().listNodes()) {
    const name = node.getName();
    if (name && boneMap[name]) {
      node.setName(boneMap[name]);
      renamed++;
    }
  }

  console.log(`  Renamed ${renamed} bones using "${mapName}" map`);
  const out = outputPath(filePath, args);
  await writeDoc(io, doc, out);
}

async function cmdAddSockets(filePath, args) {
  const rigType = args.rig || 'biped';
  const socketDefs = STANDARD_SOCKETS[rigType];
  if (!socketDefs) { console.error(`  Error: no socket defs for rig type "${rigType}". Use: biped, quadruped`); process.exit(1); }

  const { io, doc } = await readDoc(filePath);
  const allNodes = doc.getRoot().listNodes();
  const nodeMap = new Map();
  for (const n of allNodes) nodeMap.set(n.getName(), n);

  let added = 0;
  for (const def of socketDefs) {
    // Already exists?
    if (nodeMap.has(def.name)) {
      console.log(`    Socket "${def.name}" already exists, skipping`);
      continue;
    }

    // Find parent bone (try standard name, then fallbacks)
    let parent = nodeMap.get(def.parent);
    if (!parent) {
      for (const fb of (def.fallback || [])) {
        parent = nodeMap.get(fb);
        if (parent) break;
      }
    }

    if (!parent) {
      console.log(`    Warning: no parent bone found for socket "${def.name}" (tried: ${def.parent}, ${(def.fallback||[]).join(', ')})`);
      continue;
    }

    const socket = doc.createNode(def.name)
      .setTranslation([0, 0, 0])
      .setRotation([0, 0, 0, 1])
      .setScale([1, 1, 1]);
    parent.addChild(socket);
    nodeMap.set(def.name, socket);
    added++;
    console.log(`    Added socket "${def.name}" → parent "${parent.getName()}"`);
  }

  console.log(`  Added ${added} sockets`);
  const out = outputPath(filePath, args);
  await writeDoc(io, doc, out);
}

async function cmdStripAnimations(filePath, args) {
  const { io, doc } = await readDoc(filePath);
  const anims = doc.getRoot().listAnimations();
  const count = anims.length;

  for (const anim of anims) {
    // Remove samplers and channels first
    for (const ch of anim.listChannels()) ch.dispose();
    for (const s of anim.listSamplers()) s.dispose();
    anim.dispose();
  }

  console.log(`  Stripped ${count} animation clips`);
  const out = outputPath(filePath, args);
  await writeDoc(io, doc, out);
}

async function cmdOptimize(filePath, args) {
  // Dynamic import for optional dependency
  let functions;
  try {
    functions = await import('@gltf-transform/functions');
  } catch {
    console.error('  Error: @gltf-transform/functions not installed.');
    console.error('  Run: npm install @gltf-transform/functions');
    process.exit(1);
  }

  const { io, doc } = await readDoc(filePath);

  // Apply standard optimizations
  await doc.transform(
    functions.dedup(),
    functions.prune(),
    functions.quantize(),
    functions.resample(),
  );

  console.log('  Applied: dedup, prune, quantize, resample');
  const out = outputPath(filePath, args);
  await writeDoc(io, doc, out);
}

async function cmdRig(filePath, args) {
  const apiToken = process.env.REPLICATE_API_TOKEN;
  if (!apiToken) {
    console.error('  Error: REPLICATE_API_TOKEN not set');
    console.error('  Get one at: https://replicate.com/account/api-tokens');
    process.exit(1);
  }

  // Read the GLB file as base64
  const glbBuffer = fs.readFileSync(filePath);
  const base64 = glbBuffer.toString('base64');
  const dataUri = `data:model/gltf-binary;base64,${base64}`;

  console.log(`  Uploading ${path.basename(filePath)} (${(glbBuffer.length / 1024).toFixed(0)} KB) to UniRig on Replicate...`);

  // Create prediction
  const createRes = await fetch('https://api.replicate.com/v1/predictions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      version: 'aaronjmars/unirig-ai',
      input: { input_mesh: dataUri },
    }),
  });

  if (!createRes.ok) {
    const err = await createRes.text();
    console.error(`  Replicate API error: ${createRes.status} ${err}`);
    process.exit(1);
  }

  const prediction = await createRes.json();
  console.log(`  Prediction: ${prediction.id}`);

  // Poll for completion
  let result = prediction;
  while (result.status !== 'succeeded' && result.status !== 'failed') {
    await new Promise(r => setTimeout(r, 3000));
    const pollRes = await fetch(`https://api.replicate.com/v1/predictions/${prediction.id}`, {
      headers: { 'Authorization': `Bearer ${apiToken}` },
    });
    result = await pollRes.json();
    process.stdout.write(`  Status: ${result.status}...\r`);
  }
  console.log(`  Status: ${result.status}     `);

  if (result.status === 'failed') {
    console.error(`  Rigging failed: ${result.error}`);
    process.exit(1);
  }

  // Download the rigged GLB
  const outputUrl = result.output;
  if (!outputUrl) {
    console.error('  Error: no output URL in prediction result');
    console.error('  Result:', JSON.stringify(result, null, 2));
    process.exit(1);
  }

  console.log(`  Downloading rigged model...`);
  const dlRes = await fetch(outputUrl);
  const buffer = Buffer.from(await dlRes.arrayBuffer());
  const out = outputPath(filePath, args);
  fs.writeFileSync(out, buffer);
  console.log(`  Written: ${out} (${(buffer.length / 1024).toFixed(1)} KB)`);
}

// ── Main ─────────────────────────────────────────────────────────────────

const [,, command, inputFile, ...rest] = process.argv;
const args = parseArgs(rest);

if (!command) {
  console.log(`
creature-edit.mjs — Post-generation GLB surgery

Commands:
  info <file.glb>                    Print skeleton, clips, vertices, materials
  repose <file.glb> --bone <name> --rx/ry/rz <degrees>
                                     Rotate a bone by euler angles
  scale <file.glb> --factor <f>      Uniform rescale
  rename-bones <file.glb> --map <biped|quadruped|file.json>
                                     Rename skeleton bones to standard convention
  add-sockets <file.glb> --rig <biped|quadruped>
                                     Add equipment socket nodes to skeleton
  strip-animations <file.glb>        Remove all animation clips
  optimize <file.glb>                Draco compress, dedup, quantize, resample
  rig <mesh.glb>                     Auto-rig via UniRig on Replicate

Options:
  --output <path>    Output file (default: <name>-edited.glb)
`);
  process.exit(0);
}

if (!inputFile) {
  console.error('Error: input file required');
  process.exit(1);
}

const resolved = path.resolve(inputFile);
if (!fs.existsSync(resolved)) {
  console.error(`Error: file not found: ${resolved}`);
  process.exit(1);
}

console.log(`\ncreature-edit: ${command} ${path.basename(resolved)}`);

const commands = {
  info:              () => cmdInfo(resolved),
  repose:            () => cmdRepose(resolved, args),
  scale:             () => cmdScale(resolved, args),
  'rename-bones':    () => cmdRenameBones(resolved, args),
  'add-sockets':     () => cmdAddSockets(resolved, args),
  'strip-animations':() => cmdStripAnimations(resolved, args),
  optimize:          () => cmdOptimize(resolved, args),
  rig:               () => cmdRig(resolved, args),
};

const fn = commands[command];
if (!fn) {
  console.error(`Unknown command: ${command}`);
  process.exit(1);
}

fn().catch(err => {
  console.error(`\nError: ${err.message}`);
  process.exit(1);
});
