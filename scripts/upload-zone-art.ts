/**
 * Upload zone art to Pinata/IPFS and generate a manifest.
 *
 * Usage:
 *   PINATA_JWT=... npx tsx scripts/upload-zone-art.ts <zone_name>
 *
 * Reads WebP files from public/images/items/, public/images/monsters/,
 * and public/images/monster-weapons/ for the given zone. Uploads each to
 * Pinata and writes a manifest JSON to public/images/manifests/<zone>.json.
 *
 * The manifest maps item names to IPFS CIDs for CDN resolution.
 */

import * as fs from 'fs';
import * as path from 'path';
import pinataSDK from '@pinata/sdk';

const PINATA_JWT = process.env.PINATA_JWT;
const PINATA_GATEWAY = process.env.PINATA_GATEWAY || 'https://gateway.pinata.cloud/ipfs';

if (!PINATA_JWT) {
  console.error('PINATA_JWT env var required');
  process.exit(1);
}

const zoneName = process.argv[2];
if (!zoneName) {
  console.error('Usage: npx tsx scripts/upload-zone-art.ts <zone_name>');
  console.error('Example: npx tsx scripts/upload-zone-art.ts windy_peaks');
  process.exit(1);
}

const CLIENT_DIR = path.join(__dirname, '..', 'packages', 'client');
const PUBLIC_DIR = path.join(CLIENT_DIR, 'public');
const MANIFEST_DIR = path.join(PUBLIC_DIR, 'images', 'manifests');
const ZONE_DATA_DIR = path.join(__dirname, '..', 'packages', 'contracts', 'zones', zoneName);

// Read zone items/monsters to know which art files to look for
function getZoneItemNames(): string[] {
  const names: string[] = [];

  const itemsPath = path.join(ZONE_DATA_DIR, 'items.json');
  if (fs.existsSync(itemsPath)) {
    const data = JSON.parse(fs.readFileSync(itemsPath, 'utf-8'));
    for (const category of ['weapons', 'armor', 'consumables', 'accessories', 'spells']) {
      if (data[category]) {
        for (const item of data[category]) {
          names.push(item.name);
        }
      }
    }
  }

  const monstersPath = path.join(ZONE_DATA_DIR, 'monsters.json');
  if (fs.existsSync(monstersPath)) {
    const data = JSON.parse(fs.readFileSync(monstersPath, 'utf-8'));
    for (const monster of data.monsters) {
      names.push(monster.name);
      // Monster weapons follow pattern: "<Name> Strike"
      const strikeName = `${monster.name} Strike`;
      names.push(strikeName);
    }
  }

  return names;
}

function nameToFileName(name: string): string {
  return name
    .toLowerCase()
    .replace(/['']/g, '')
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');
}

type Manifest = Record<string, { cid: string; url: string }>;

async function main() {
  const pinata = new pinataSDK({ pinataJWTKey: PINATA_JWT });
  await pinata.testAuthentication();
  console.log(`Pinata connected. Uploading art for zone: ${zoneName}`);

  const itemNames = getZoneItemNames();
  console.log(`Found ${itemNames.length} items/monsters in zone data`);

  // Directories where art might live
  const artDirs = [
    { dir: path.join(PUBLIC_DIR, 'images', 'items'), prefix: 'items' },
    { dir: path.join(PUBLIC_DIR, 'images', 'monsters'), prefix: 'monsters' },
    { dir: path.join(PUBLIC_DIR, 'images', 'monster-weapons'), prefix: 'monster-weapons' },
    { dir: path.join(PUBLIC_DIR, 'images', 'spells'), prefix: 'spells' },
  ];

  const manifest: Manifest = {};
  let uploaded = 0;
  let missing = 0;

  for (const name of itemNames) {
    const fileName = nameToFileName(name);
    let found = false;

    for (const { dir, prefix } of artDirs) {
      const webpPath = path.join(dir, `${fileName}.webp`);
      if (fs.existsSync(webpPath)) {
        try {
          const readStream = fs.createReadStream(webpPath);
          const result = await pinata.pinFileToIPFS(readStream, {
            pinataMetadata: {
              name: `${zoneName}/${prefix}/${fileName}.webp`,
              keyvalues: { zone: zoneName, item: name, category: prefix },
            },
          });

          manifest[name] = {
            cid: result.IpfsHash,
            url: `${PINATA_GATEWAY}/${result.IpfsHash}`,
          };
          uploaded++;
          console.log(`  [OK] ${name} → ${result.IpfsHash}`);
        } catch (err) {
          console.error(`  [ERR] ${name}: ${err}`);
        }
        found = true;
        break;
      }
    }

    if (!found) {
      missing++;
      console.log(`  [SKIP] ${name} — no art file found (${fileName}.webp)`);
    }
  }

  // Write manifest
  if (!fs.existsSync(MANIFEST_DIR)) {
    fs.mkdirSync(MANIFEST_DIR, { recursive: true });
  }

  const manifestPath = path.join(MANIFEST_DIR, `${zoneName}.json`);
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

  console.log(`\nDone. Uploaded: ${uploaded}, Missing: ${missing}`);
  console.log(`Manifest: ${manifestPath}`);
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
