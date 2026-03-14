#!/usr/bin/env npx tsx
/**
 * Fix Magic Weapon Effects — Swap physical effect → magic effect on INT weapons.
 *
 * BUG: All INT weapons (Cracked Wand, Apprentice Staff, Channeling Rod, Mage Staff)
 * were deployed with the physicalDamage effect ID instead of magicDamage. This means
 * they go through _calculatePhysicalEffect on-chain, scaling off STR instead of INT.
 * INT builds are completely broken — their weapons use their dump stat for damage.
 *
 * FIX: Replace effect ID 0xbeeab8b0... (physicalDamage) with 0xeee09063... (magicDamage)
 * in the WeaponStats.effects array for each affected weapon.
 *
 * Also fixes Sporecap Wand and Bone Staff which have [physical, magic] — removes
 * the physical effect so they're pure magic (matching sim behavior).
 *
 * Usage:
 *   npx tsx scripts/admin/fix-magic-weapon-effects.ts                    # dry run
 *   npx tsx scripts/admin/fix-magic-weapon-effects.ts --apply            # live
 *   npx tsx scripts/admin/fix-magic-weapon-effects.ts --apply --rpc <url>
 */

import { config } from 'dotenv';
config({ path: '.env.mainnet', override: false });

import {
  createPublicClient,
  createWalletClient,
  http,
  parseAbi,
  toHex,
  concat,
  Hex,
  Address,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { foundry, base } from 'viem/chains';
import { encodeWeaponStats, WeaponTemplate } from '../lib/encode-stats';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// ============ Constants ============

const PHYSICAL_EFFECT_ID = '0xbeeab8b096ac11af000000000000000000000000000000000000000000000000' as Hex;
const MAGIC_EFFECT_ID    = '0xeee09063621624b3000000000000000000000000000000000000000000000000' as Hex;

// ============ Weapons to fix ============
// Stats from items.json (confirmed correct by session 15 on-chain audit).
// Only change: effects array swapped to magic.

interface WeaponFix {
  name: string;
  metadataUri: string;
  dropChance: bigint;
  price: bigint;
  rarity: bigint;
  template: WeaponTemplate;
}

const WEAPONS_TO_FIX: WeaponFix[] = [
  {
    name: 'Cracked Wand',
    metadataUri: 'weapon:cracked_wand',
    dropChance: 8000n,
    price: 5000000000000000000n,
    rarity: 0n,
    template: {
      name: 'Cracked Wand',
      metadataUri: 'weapon:cracked_wand',
      dropChance: 8000,
      initialSupply: 0,
      price: 0,
      stats: {
        agiModifier: 0,
        effects: [MAGIC_EFFECT_ID],
        hpModifier: 0,
        intModifier: 1,
        maxDamage: 1,
        minDamage: 1,
        minLevel: 0,
        strModifier: 0,
      },
      statRestrictions: { minAgility: 0, minIntelligence: 0, minStrength: 0 },
    },
  },
  {
    name: 'Apprentice Staff',
    metadataUri: 'weapon:apprentice_staff',
    dropChance: 5000n,
    price: 15000000000000000000n,
    rarity: 1n,
    template: {
      name: 'Apprentice Staff',
      metadataUri: 'weapon:apprentice_staff',
      dropChance: 5000,
      initialSupply: 0,
      price: 0,
      stats: {
        agiModifier: 0,
        effects: [MAGIC_EFFECT_ID],
        hpModifier: 2,
        intModifier: 1,
        maxDamage: 2,
        minDamage: 1,
        minLevel: 0,
        strModifier: 0,
      },
      statRestrictions: { minAgility: 0, minIntelligence: 6, minStrength: 0 },
    },
  },
  {
    name: 'Channeling Rod',
    metadataUri: 'weapon:channeling_rod',
    dropChance: 5000n,
    price: 40000000000000000000n,
    rarity: 1n,
    template: {
      name: 'Channeling Rod',
      metadataUri: 'weapon:channeling_rod',
      dropChance: 5000,
      initialSupply: 0,
      price: 0,
      stats: {
        agiModifier: 0,
        effects: [MAGIC_EFFECT_ID],
        hpModifier: 3,
        intModifier: 2,
        maxDamage: 3,
        minDamage: 2,
        minLevel: 0,
        strModifier: 0,
      },
      statRestrictions: { minAgility: 0, minIntelligence: 9, minStrength: 3 },
    },
  },
  {
    name: 'Mage Staff',
    metadataUri: 'weapon:mage_staff',
    dropChance: 100n,
    price: 100000000000000000000n,
    rarity: 2n,
    template: {
      name: 'Mage Staff',
      metadataUri: 'weapon:mage_staff',
      dropChance: 100,
      initialSupply: 0,
      price: 0,
      stats: {
        agiModifier: 0,
        effects: [MAGIC_EFFECT_ID],
        hpModifier: 5,
        intModifier: 3,
        maxDamage: 5,
        minDamage: 3,
        minLevel: 0,
        strModifier: 0,
      },
      statRestrictions: { minAgility: 0, minIntelligence: 9, minStrength: 4 },
    },
  },
  {
    name: 'Sporecap Wand',
    metadataUri: 'weapon:sporecap_wand',
    dropChance: 100n,
    price: 60000000000000000000n,
    rarity: 2n,
    template: {
      name: 'Sporecap Wand',
      metadataUri: 'weapon:sporecap_wand',
      dropChance: 100,
      initialSupply: 0,
      price: 0,
      stats: {
        agiModifier: 0,
        effects: [MAGIC_EFFECT_ID],  // was [physical, magic] — remove physical
        hpModifier: 3,
        intModifier: 2,
        maxDamage: 2,
        minDamage: 1,
        minLevel: 0,
        strModifier: 0,
      },
      statRestrictions: { minAgility: 0, minIntelligence: 5, minStrength: 0 },
    },
  },
  {
    name: 'Bone Staff',
    metadataUri: 'weapon:bone_staff',
    dropChance: 3n,
    price: 180000000000000000000n,
    rarity: 3n,
    template: {
      name: 'Bone Staff',
      metadataUri: 'weapon:bone_staff',
      dropChance: 3,
      initialSupply: 0,
      price: 0,
      stats: {
        agiModifier: 0,
        effects: [MAGIC_EFFECT_ID],  // was [physical, magic] — remove physical
        hpModifier: 5,
        intModifier: 3,
        maxDamage: 5,
        minDamage: 3,
        minLevel: 0,
        strModifier: 0,
      },
      statRestrictions: { minAgility: 0, minIntelligence: 11, minStrength: 4 },
    },
  },
];

// ============ MUD Helpers ============

function tableResourceId(namespace: string, name: string): Hex {
  const typeBytes = toHex('tb', { size: 2 });
  const nsBytes = toHex(namespace, { size: 14 });
  const nameBytes = toHex(name, { size: 16 });
  return concat([typeBytes, nsBytes, nameBytes]);
}

const URI_STORAGE_TABLE_ID = tableResourceId('Items', 'URIStorage');
const WEAPON_STATS_TABLE_ID = '0x74625544000000000000000000000000576561706f6e53746174730000000000' as Hex;

function keyTuple(id: number | bigint): Hex[] {
  return [toHex(BigInt(id), { size: 32 })];
}

function decodeUriRecord(dynamicData: Hex): string {
  if (!dynamicData || dynamicData === '0x') return '';
  return Buffer.from(dynamicData.slice(2), 'hex').toString('utf-8');
}

/** Decode effects from WeaponStats dynamic data (tightly packed bytes32[]) */
function decodeEffects(dynamicData: Hex): Hex[] {
  if (!dynamicData || dynamicData === '0x') return [];
  const hex = dynamicData.slice(2);
  const effects: Hex[] = [];
  for (let i = 0; i < hex.length; i += 64) {
    effects.push(('0x' + hex.slice(i, i + 64)) as Hex);
  }
  return effects;
}

// ============ ABI ============

const worldAbi = parseAbi([
  'function getRecord(bytes32 tableId, bytes32[] keyTuple) view returns (bytes staticData, bytes32 encodedLengths, bytes dynamicData)',
  'function UD__adminUpdateItemStats(uint256 itemId, uint256 dropChance, uint256 price, uint256 rarity, bytes stats)',
]);

// ============ Main ============

async function main() {
  const args = process.argv.slice(2);
  let worldAddress: Address | undefined = process.env.WORLD_ADDRESS as Address | undefined;
  let rpcUrl = process.env.RPC_URL || 'http://127.0.0.1:8545';
  let doApply = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--world' && args[i + 1]) {
      worldAddress = args[i + 1] as Address;
      i++;
    } else if (args[i] === '--rpc' && args[i + 1]) {
      rpcUrl = args[i + 1];
      i++;
    } else if (args[i] === '--apply') {
      doApply = true;
    }
  }

  if (!worldAddress) {
    console.error('Error: WORLD_ADDRESS env var or --world flag required');
    process.exit(1);
  }

  const chainId = parseInt(process.env.CHAIN_ID || '31337');
  const chain = chainId === 8453 ? base : foundry;
  const publicClient = createPublicClient({ chain, transport: http(rpcUrl) });

  console.log('=== Fix Magic Weapon Effects ===');
  console.log(`World: ${worldAddress}`);
  console.log(`Chain: ${chainId}`);
  console.log(`Mode:  ${doApply ? 'APPLY' : 'DRY RUN'}\n`);

  // Step 1: Scan URIs to find on-chain item IDs
  console.log('Scanning on-chain item URIs...');
  const uriToId = new Map<string, bigint>();
  const MAX_EMPTY_GAP = 20;
  let consecutiveEmpty = 0;

  for (let id = 1n; consecutiveEmpty < MAX_EMPTY_GAP; id++) {
    try {
      const [, , dynamicData] = await publicClient.readContract({
        address: worldAddress,
        abi: worldAbi,
        functionName: 'getRecord',
        args: [URI_STORAGE_TABLE_ID, keyTuple(id)],
      });
      const uri = decodeUriRecord(dynamicData as Hex);
      if (uri) {
        uriToId.set(uri, id);
        consecutiveEmpty = 0;
      } else {
        consecutiveEmpty++;
      }
    } catch {
      consecutiveEmpty++;
    }
  }

  console.log(`Found ${uriToId.size} items on-chain\n`);

  // Step 2: Verify current state and show planned changes
  let allFound = true;

  for (const weapon of WEAPONS_TO_FIX) {
    const itemId = uriToId.get(weapon.metadataUri);
    console.log(`${weapon.name} (${weapon.metadataUri})`);

    if (!itemId) {
      console.log(`  ERROR: Item not found on-chain!\n`);
      allFound = false;
      continue;
    }

    console.log(`  Item ID: #${itemId}`);

    // Read current effects from WeaponStats table
    try {
      const [, , dynamicData] = await publicClient.readContract({
        address: worldAddress,
        abi: worldAbi,
        functionName: 'getRecord',
        args: [WEAPON_STATS_TABLE_ID, keyTuple(itemId)],
      });

      const currentEffects = decodeEffects(dynamicData as Hex);
      const hasPhysical = currentEffects.some(e => e.toLowerCase() === PHYSICAL_EFFECT_ID.toLowerCase());
      const hasMagic = currentEffects.some(e => e.toLowerCase() === MAGIC_EFFECT_ID.toLowerCase());

      console.log(`  Current effects: [${currentEffects.map(e => e.slice(0, 18) + '...').join(', ')}]`);
      console.log(`  Has physical: ${hasPhysical}, Has magic: ${hasMagic}`);

      if (!hasPhysical && hasMagic) {
        console.log(`  Already correct — no change needed`);
      } else {
        console.log(`  → Will set effects to: [${MAGIC_EFFECT_ID.slice(0, 18)}...] (magicDamage)`);
      }
    } catch (e: any) {
      console.log(`  Could not read current effects: ${e.message?.slice(0, 100)}`);
    }

    console.log('');
  }

  if (!allFound) {
    console.error('Some items not found on-chain. Aborting.');
    process.exit(1);
  }

  if (!doApply) {
    console.log('Dry run complete. Use --apply to push changes on-chain.');
    return;
  }

  // Step 3: Apply changes
  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) {
    console.error('Error: PRIVATE_KEY required for --apply');
    process.exit(1);
  }

  const account = privateKeyToAccount(privateKey as Hex);
  const walletClient = createWalletClient({ account, chain, transport: http(rpcUrl) });
  let currentNonce = await publicClient.getTransactionCount({ address: account.address });

  for (const weapon of WEAPONS_TO_FIX) {
    const itemId = uriToId.get(weapon.metadataUri)!;

    // Re-check if already fixed
    const [, , dynamicData] = await publicClient.readContract({
      address: worldAddress,
      abi: worldAbi,
      functionName: 'getRecord',
      args: [WEAPON_STATS_TABLE_ID, keyTuple(itemId)],
    });
    const currentEffects = decodeEffects(dynamicData as Hex);
    const hasPhysical = currentEffects.some(e => e.toLowerCase() === PHYSICAL_EFFECT_ID.toLowerCase());
    const hasMagic = currentEffects.some(e => e.toLowerCase() === MAGIC_EFFECT_ID.toLowerCase());

    if (!hasPhysical && hasMagic) {
      console.log(`${weapon.name} — already correct, skipping`);
      continue;
    }

    console.log(`Updating ${weapon.name} (item #${itemId})...`);

    const encodedStats = encodeWeaponStats(weapon.template);

    const hash = await walletClient.writeContract({
      address: worldAddress,
      abi: worldAbi,
      functionName: 'UD__adminUpdateItemStats',
      args: [itemId, weapon.dropChance, weapon.price, weapon.rarity, encodedStats],
      nonce: currentNonce++,
    });

    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    console.log(`  tx: ${hash}`);
    console.log(`  block: ${receipt.blockNumber}, status: ${receipt.status}`);

    if (receipt.status !== 'success') {
      console.error(`  TX REVERTED!`);
      process.exit(1);
    }

    // Wait for RPC to catch up before verifying
    await sleep(5000);

    // Verify
    const [, , verifyDynamic] = await publicClient.readContract({
      address: worldAddress,
      abi: worldAbi,
      functionName: 'getRecord',
      args: [WEAPON_STATS_TABLE_ID, keyTuple(itemId)],
    });
    const newEffects = decodeEffects(verifyDynamic as Hex);
    const nowHasMagic = newEffects.some(e => e.toLowerCase() === MAGIC_EFFECT_ID.toLowerCase());
    const nowHasPhysical = newEffects.some(e => e.toLowerCase() === PHYSICAL_EFFECT_ID.toLowerCase());
    console.log(`  Verified: magic=${nowHasMagic}, physical=${nowHasPhysical}`);

    if (nowHasPhysical || !nowHasMagic) {
      console.warn(`  WARNING: Verification read stale data — tx succeeded, continuing`);
    } else {
      console.log(`  OK`);
    }

    console.log('');
  }

  console.log('=== All magic weapon effects fixed ===');
}

main().catch((e) => {
  console.error('Error:', e);
  process.exit(1);
});
