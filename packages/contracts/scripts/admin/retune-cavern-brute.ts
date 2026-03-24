#!/usr/bin/env npx tsx
/**
 * Retune Cavern Brute (mob ID 3) — reduce tankiness for L2-3 non-STR builds.
 *
 * Changes: HP 14→18, STR 7→9, ARM 0→1
 *
 * Usage:
 *   npx tsx scripts/admin/retune-cavern-brute.ts                    # dry run
 *   npx tsx scripts/admin/retune-cavern-brute.ts --apply            # live
 */

import { config } from 'dotenv';
config({ path: '.env.mainnet', override: false });

import {
  createPublicClient,
  createWalletClient,
  http,
  encodeAbiParameters,
  decodeAbiParameters,
  parseAbi,
  pad,
  numberToHex,
  type Hex,
  type Address,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { base, foundry } from 'viem/chains';

const MOB_ID = 3; // Cavern Brute
const MOB_NAME = 'Cavern Brute';

// Target stats
const TARGET = { hitPoints: 18n, strength: 9n, armor: 1n };

const MOBS_TABLE_ID = '0x746255440000000000000000000000004d6f6273000000000000000000000000' as Hex;
const MOBS_FIELD_LAYOUT = '0x0001010201000000000000000000000000000000000000000000000000000000' as Hex;

const MONSTER_STATS_ABI = [
  {
    type: 'tuple' as const,
    components: [
      { name: 'agility', type: 'int256' as const },
      { name: 'armor', type: 'int256' as const },
      { name: 'class', type: 'uint8' as const },
      { name: 'experience', type: 'uint256' as const },
      { name: 'hasBossAI', type: 'bool' as const },
      { name: 'hitPoints', type: 'int256' as const },
      { name: 'intelligence', type: 'int256' as const },
      { name: 'inventory', type: 'uint256[]' as const },
      { name: 'level', type: 'uint256' as const },
      { name: 'strength', type: 'int256' as const },
    ],
  },
] as const;

const storeAbi = parseAbi([
  'function getRecord(bytes32 tableId, bytes32[] keyTuple, bytes32 fieldLayout) view returns (bytes staticData, bytes32 encodedLengths, bytes dynamicData)',
  'function setDynamicField(bytes32 tableId, bytes32[] keyTuple, uint8 dynamicFieldIndex, bytes data)',
]);

async function main() {
  const args = process.argv.slice(2);
  const doApply = args.includes('--apply');

  const worldAddress = process.env.WORLD_ADDRESS as Address;
  const rpcUrl = process.env.RPC_URL!;
  const chainId = parseInt(process.env.CHAIN_ID || '31337');
  const chain = chainId === 8453 ? base : foundry;

  if (!worldAddress) {
    console.error('WORLD_ADDRESS not set');
    process.exit(1);
  }

  const publicClient = createPublicClient({ chain, transport: http(rpcUrl) });
  const keyTuple = [pad(numberToHex(MOB_ID), { size: 32 })] as Hex[];

  console.log(`=== Retune ${MOB_NAME} (mob ${MOB_ID}) ===`);
  console.log(`World: ${worldAddress}`);
  console.log(`Chain: ${chainId}`);
  console.log(`Mode:  ${doApply ? 'APPLY' : 'DRY RUN'}\n`);

  // Read current on-chain data
  const [staticData, encodedLengths, dynamicData] = await publicClient.readContract({
    address: worldAddress,
    abi: storeAbi,
    functionName: 'getRecord',
    args: [MOBS_TABLE_ID, keyTuple, MOBS_FIELD_LAYOUT],
  });

  // Parse encoded lengths to extract mobStats bytes
  const lenHex = (encodedLengths as string).slice(2).padStart(64, '0');
  const field0Len = parseInt(lenHex.slice(40, 50), 16); // mobStats length

  const dynHex = (dynamicData as string).slice(2);
  const statsHex = ('0x' + dynHex.slice(0, field0Len * 2)) as Hex;
  const remainingDynamic = dynHex.slice(field0Len * 2); // mobMetadata — preserve as-is

  // Decode current stats
  const [currentStats] = decodeAbiParameters(MONSTER_STATS_ABI, statsHex);

  console.log('Current stats:');
  console.log(`  HP: ${currentStats.hitPoints}, STR: ${currentStats.strength}, ARM: ${currentStats.armor}`);
  console.log(`  AGI: ${currentStats.agility}, INT: ${currentStats.intelligence}, LVL: ${currentStats.level}`);
  console.log(`\nTarget:`);
  console.log(`  HP: ${currentStats.hitPoints} → ${TARGET.hitPoints}`);
  console.log(`  STR: ${currentStats.strength} → ${TARGET.strength}`);
  console.log(`  ARM: ${currentStats.armor} → ${TARGET.armor}`);

  // Check if already at target
  if (
    currentStats.hitPoints === TARGET.hitPoints &&
    currentStats.strength === TARGET.strength &&
    currentStats.armor === TARGET.armor
  ) {
    console.log('\nAlready at target values. Nothing to do.');
    return;
  }

  if (!doApply) {
    console.log('\nDry run complete. Use --apply to push changes on-chain.');
    return;
  }

  // Encode new stats
  const newStatsBytes = encodeAbiParameters(MONSTER_STATS_ABI, [
    {
      agility: currentStats.agility,
      armor: TARGET.armor,
      class: currentStats.class,
      experience: currentStats.experience,
      hasBossAI: currentStats.hasBossAI,
      hitPoints: TARGET.hitPoints,
      intelligence: currentStats.intelligence,
      inventory: [...currentStats.inventory],
      level: currentStats.level,
      strength: TARGET.strength,
    },
  ]);

  // Write updated mobStats (dynamic field index 0)
  const privateKey = process.env.PRIVATE_KEY as Hex;
  if (!privateKey) {
    console.error('PRIVATE_KEY not set');
    process.exit(1);
  }

  const account = privateKeyToAccount(privateKey);
  const walletClient = createWalletClient({ account, chain, transport: http(rpcUrl) });

  console.log(`\nSending tx from ${account.address}...`);

  const hash = await walletClient.writeContract({
    address: worldAddress,
    abi: storeAbi,
    functionName: 'setDynamicField',
    args: [MOBS_TABLE_ID, keyTuple, 0, newStatsBytes],
  });

  console.log(`tx: ${hash}`);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  console.log(`block: ${receipt.blockNumber}, status: ${receipt.status}`);

  if (receipt.status !== 'success') {
    console.error('TX REVERTED!');
    process.exit(1);
  }

  // Verify
  console.log('\nVerifying...');
  await new Promise(r => setTimeout(r, 3000));

  const [, , verifyDynamic] = await publicClient.readContract({
    address: worldAddress,
    abi: storeAbi,
    functionName: 'getRecord',
    args: [MOBS_TABLE_ID, keyTuple, MOBS_FIELD_LAYOUT],
  });

  const verifyLenHex = (encodedLengths as string).slice(2).padStart(64, '0');
  const verifyField0Len = parseInt(verifyLenHex.slice(40, 50), 16);
  const verifyStatsHex = ('0x' + (verifyDynamic as string).slice(2, 2 + verifyField0Len * 2)) as Hex;
  const [newStats] = decodeAbiParameters(MONSTER_STATS_ABI, verifyStatsHex);

  console.log(`Verified: HP=${newStats.hitPoints}, STR=${newStats.strength}, ARM=${newStats.armor}`);

  const ok =
    newStats.hitPoints === TARGET.hitPoints &&
    newStats.strength === TARGET.strength &&
    newStats.armor === TARGET.armor;

  if (ok) {
    console.log('OK — Cavern Brute retuned successfully.');
  } else {
    console.warn('WARNING: Verification mismatch — RPC may be lagging. Check manually.');
  }
}

main().catch((e) => {
  console.error('Error:', e);
  process.exit(1);
});
