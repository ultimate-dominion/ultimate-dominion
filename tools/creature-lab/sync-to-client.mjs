#!/usr/bin/env node
// Sync creature GLBs from the lab (canonical source) to the client public dir.
//
// The lab stores every creature as `<name>-animated.glb` (rigged + merged
// clips). The client consumes them under two naming conventions:
//   - Player races (elf, dwarf, human): `<name>-animated.glb`
//   - Monsters: `<name>.glb` (the rigged mesh is the only file shipped)
//
// This script walks `packages/client/public/models/creatures/`, finds the
// matching lab file for each entry, and in dry-run mode (default) reports
// which are out of sync. Pass `--apply` to copy the differing files.
//
// Usage:
//   node tools/creature-lab/sync-to-client.mjs            # dry-run
//   node tools/creature-lab/sync-to-client.mjs --apply    # copy differing files
//   node tools/creature-lab/sync-to-client.mjs --check    # exit 1 if out of sync

import { readdir, stat, copyFile } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LAB_GLB = path.resolve(__dirname, 'glb');
const CLIENT_GLB = path.resolve(
  __dirname,
  '../../packages/client/public/models/creatures',
);

async function sha256(file) {
  return new Promise((resolve, reject) => {
    const h = createHash('sha256');
    createReadStream(file)
      .on('data', (d) => h.update(d))
      .on('end', () => resolve(h.digest('hex')))
      .on('error', reject);
  });
}

async function exists(file) {
  try {
    await stat(file);
    return true;
  } catch {
    return false;
  }
}

// For a client filename, compute the base creature name.
// `elf-animated.glb` -> `elf`
// `giant-spider.glb` -> `giant-spider`
function baseName(clientFile) {
  const m = clientFile.match(/^(.+?)(?:-animated)?\.glb$/);
  return m ? m[1] : null;
}

async function buildPlan() {
  const clientFiles = (await readdir(CLIENT_GLB))
    .filter((f) => f.endsWith('.glb'))
    .sort();

  const plan = [];
  for (const clientFile of clientFiles) {
    const base = baseName(clientFile);
    if (!base) continue;
    const labFile = `${base}-animated.glb`;
    const labPath = path.join(LAB_GLB, labFile);
    if (!(await exists(labPath))) {
      plan.push({ clientFile, labFile, status: 'no-lab-source' });
      continue;
    }
    const clientPath = path.join(CLIENT_GLB, clientFile);
    const [labHash, clientHash] = await Promise.all([
      sha256(labPath),
      sha256(clientPath),
    ]);
    plan.push({
      clientFile,
      labFile,
      labPath,
      clientPath,
      labHash,
      clientHash,
      status: labHash === clientHash ? 'in-sync' : 'diff',
    });
  }
  return plan;
}

function fmt(rows) {
  const nameW = Math.max(...rows.map((r) => r.clientFile.length), 12);
  const labW = Math.max(...rows.map((r) => r.labFile.length), 12);
  return rows
    .map((r) => {
      const n = r.clientFile.padEnd(nameW);
      const l = r.labFile.padEnd(labW);
      return `  [${r.status.padEnd(13)}] ${n}  ←  ${l}`;
    })
    .join('\n');
}

async function main() {
  const apply = process.argv.includes('--apply');
  const check = process.argv.includes('--check');

  const plan = await buildPlan();
  const diffs = plan.filter((r) => r.status === 'diff');
  const missing = plan.filter((r) => r.status === 'no-lab-source');
  const inSync = plan.filter((r) => r.status === 'in-sync');

  console.log(
    `Creature sync (lab → client): ${inSync.length} in sync, ${diffs.length} diff, ${missing.length} no lab source`,
  );
  console.log();
  console.log(fmt(plan));

  if (diffs.length === 0) {
    console.log('\nAll creatures in sync.');
    return;
  }

  if (!apply) {
    if (check) {
      console.error('\nOut of sync. Run with --apply to copy.');
      process.exit(1);
    }
    console.log('\nDry-run. Re-run with --apply to copy lab → client.');
    return;
  }

  console.log('\nCopying lab → client...');
  for (const d of diffs) {
    await copyFile(d.labPath, d.clientPath);
    console.log(`  ✓ ${d.clientFile}`);
  }
  console.log(
    '\nDone. Review with `git status`, commit as feat(creatures), then push.',
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
