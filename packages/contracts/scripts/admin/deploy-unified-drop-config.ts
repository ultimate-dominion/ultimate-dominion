#!/usr/bin/env npx tsx
/**
 * Deploy unified V4 drop configuration to beta:
 *   1. Update BossSpawnConfig (Basilisk → 50bp)
 *   2. Set MobDropBonuses for Z2 mobs (journey curve)
 *
 * Usage: source .env.testnet && npx tsx scripts/admin/deploy-unified-drop-config.ts
 */

import {
  createPublicClient,
  createWalletClient,
  http,
  toHex,
  padHex,
  parseAbi,
  encodeAbiParameters,
  parseAbiParameters,
  concatHex,
  type Hex,
  type Address,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { base, foundry } from 'viem/chains';

const PROD_WORLD = '0x99d01939F58B965E6E84a1D167E710Abdf5764b0';

// Table IDs
const BOSS_SPAWN_TABLE = '0x74625544000000000000000000000000426f7373537061776e436f6e66696700' as Hex;
const BOSS_SPAWN_LAYOUT = '0x0040020020200000000000000000000000000000000000000000000000000000' as Hex;
const MOB_DROP_BONUS_TABLE = '0x746255440000000000000000000000004d6f6244726f70426f6e757300000000' as Hex;

// Config
const BASILISK_MOB_ID = 11;
const BASILISK_CHANCE_BP = 50; // 0.5% per tile entry

// Z2 mob IDs (verified on beta: mobs 25-34)
const Z2_START_MOB_ID = 25;
// 25=Ridge Stalker(L11), 26=Frost Wraith(L12), 27=Granite Sentinel(L13)
// 28=Gale Phantom(L14), 29=Blighthorn(L15), 30=Storm Shrike(L16)
// 31=Hollow Scout(L17), 32=Ironpeak Charger(L18), 33=Peakfire Wraith(L19)
// 34=Korrath's Warden(L20)

const worldAbi = parseAbi([
  'function setStaticField(bytes32 tableId, bytes32[] calldata keyTuple, uint8 fieldIndex, bytes calldata data, bytes32 fieldLayout)',
  'function setDynamicField(bytes32 tableId, bytes32[] calldata keyTuple, uint8 dynamicFieldIndex, bytes calldata data)',
  'function getStaticField(bytes32 tableId, bytes32[] calldata keyTuple, uint8 fieldIndex, bytes32 fieldLayout) view returns (bytes32)',
]);

function encodeUint256Array(values: number[]): Hex {
  if (values.length === 0) return '0x';
  const parts = values.map(v => padHex(toHex(BigInt(v)), { size: 32 }));
  return concatHex(parts);
}

function uint256ToBytes(v: number): Hex {
  return padHex(toHex(BigInt(v)), { size: 32 });
}

// Z2 bonus definitions — parallel to inventory arrays in monsters.json
function getZ2Bonuses(mobIndex: number): number[] {
  // L11-L13 (mob indices 0-2): no bonuses, 19 items each
  if (mobIndex <= 2) return new Array(19).fill(0);

  // L14-L16 (mob indices 3-5): R2 journey bump +300, 28 items each
  // Slots: [2]=Peak Cleaver(R2), [4]=Gale Bow(R2), [6]=Rime Staff(R2),
  //         [8]=Ridgeforged Plate(R2), [10]=Galebound Leather(R2), [12]=Mistcloak(R2)
  if (mobIndex <= 5) {
    const b = new Array(28).fill(0);
    b[2] = 300; b[4] = 300; b[6] = 300;
    b[8] = 300; b[10] = 300; b[12] = 300;
    return b;
  }

  // L17-L19 (mob indices 6-8): R3 taper +100, 35 items each
  // Slots: [2]=Windforged Axe(R3), [4]=Stormfeather Bow(R3), [6]=Stormglass Rod(R3),
  //         [7-11]=R3 hybrids, [13]=Windsworn Plate(R3), [15]=Stormhide Vest(R3),
  //         [17]=Wraith Vestments(R3)
  if (mobIndex <= 8) {
    const b = new Array(35).fill(0);
    b[2] = 100; b[4] = 100; b[6] = 100;
    b[7] = 100; b[8] = 100; b[9] = 100; b[10] = 100; b[11] = 100;
    b[13] = 100; b[15] = 100; b[17] = 100;
    return b;
  }

  // L20 Warden (mob index 9): boss piñata, 34 items
  const b = new Array(34).fill(0);
  // R3 gear → effective 15000 (15%)
  b[1] = 14800;  // Windforged Axe
  b[3] = 14800;  // Stormfeather Bow
  b[5] = 14800;  // Stormglass Rod
  b[7] = 14800;  // Warden's Ember
  b[8] = 14800;  // Windweaver
  b[9] = 14800;  // Ridgefang
  b[10] = 14800; // Viperstrike
  b[11] = 14800; // Ashveil Staff
  b[12] = 14800; // Windsworn Plate
  b[14] = 14800; // Stormhide Vest
  b[16] = 14800; // Wraith Vestments
  // R4 gear → effective 5000 (5%)
  b[2] = 4970;   // Warden's Maul
  b[4] = 4970;   // Peakwind Longbow
  b[6] = 4970;   // Wraith Beacon
  b[13] = 4970;  // Warden's Bulwark
  b[15] = 4970;  // Phantom Shroud
  b[17] = 4970;  // Ember Mantle
  // Consumables
  b[18] = 42000; b[19] = 44000; b[20] = 42000;
  b[21] = 24000; b[22] = 26000; b[23] = 22000;
  b[24] = 20000; b[25] = 20000; b[26] = 20000;
  b[27] = 20000; b[28] = 20000;
  return b;
}

async function main() {
  const worldAddress = process.env.WORLD_ADDRESS as Address;
  const rpcUrl = process.env.RPC_URL || 'http://127.0.0.1:8545';
  const privateKey = process.env.PRIVATE_KEY as Hex;
  const chainId = parseInt(process.env.CHAIN_ID || '31337');

  if (worldAddress.toLowerCase() === PROD_WORLD.toLowerCase()) {
    console.error('REFUSING TO RUN ON PRODUCTION WORLD');
    process.exit(1);
  }

  const chain = chainId === 8453 ? base : foundry;
  const publicClient = createPublicClient({ chain, transport: http(rpcUrl) });
  const account = privateKeyToAccount(privateKey);
  const walletClient = createWalletClient({ chain, transport: http(rpcUrl), account });

  console.log('=== Deploy Unified Drop Config ===');
  console.log('World:', worldAddress);
  console.log('Account:', account.address);
  console.log('');

  // --- 1. Update BossSpawnConfig ---
  console.log('--- BossSpawnConfig ---');

  // Read current values (singleton — empty key tuple)
  const emptyKey: Hex[] = [];
  const oldMobId = await publicClient.readContract({
    address: worldAddress, abi: worldAbi, functionName: 'getStaticField',
    args: [BOSS_SPAWN_TABLE, emptyKey, 0, BOSS_SPAWN_LAYOUT],
  });
  const oldChance = await publicClient.readContract({
    address: worldAddress, abi: worldAbi, functionName: 'getStaticField',
    args: [BOSS_SPAWN_TABLE, emptyKey, 1, BOSS_SPAWN_LAYOUT],
  });
  console.log(`  Current: mob=${BigInt(oldMobId)}, chance=${BigInt(oldChance)}bp`);

  // Set bossMobId
  let tx = await walletClient.writeContract({
    address: worldAddress, abi: worldAbi, functionName: 'setStaticField',
    args: [BOSS_SPAWN_TABLE, emptyKey, 0, uint256ToBytes(BASILISK_MOB_ID), BOSS_SPAWN_LAYOUT],
  });
  await publicClient.waitForTransactionReceipt({ hash: tx });
  console.log(`  Set bossMobId=${BASILISK_MOB_ID} -> tx: ${tx}`);

  // Set spawnChanceBp
  tx = await walletClient.writeContract({
    address: worldAddress, abi: worldAbi, functionName: 'setStaticField',
    args: [BOSS_SPAWN_TABLE, emptyKey, 1, uint256ToBytes(BASILISK_CHANCE_BP), BOSS_SPAWN_LAYOUT],
  });
  await publicClient.waitForTransactionReceipt({ hash: tx });
  console.log(`  Set spawnChanceBp=${BASILISK_CHANCE_BP} -> tx: ${tx}`);

  // --- 2. Z2 MobDropBonuses ---
  console.log('');
  console.log('--- Z2 MobDropBonuses ---');

  const mobNames = [
    'Ridge Stalker (L11)', 'Frost Wraith (L12)', 'Granite Sentinel (L13)',
    'Gale Phantom (L14)', 'Blighthorn (L15)', 'Storm Shrike (L16)',
    'Hollow Scout (L17)', 'Ironpeak Charger (L18)', 'Peakfire Wraith (L19)',
    "Korrath's Warden (L20)",
  ];

  for (let i = 0; i < 10; i++) {
    const mobId = Z2_START_MOB_ID + i;
    const bonuses = getZ2Bonuses(i);
    const encoded = encodeUint256Array(bonuses);
    const keyTuple = [padHex(toHex(BigInt(mobId)), { size: 32 })] as Hex[];

    tx = await walletClient.writeContract({
      address: worldAddress, abi: worldAbi, functionName: 'setDynamicField',
      args: [MOB_DROP_BONUS_TABLE, keyTuple, 0, encoded],
    });
    await publicClient.waitForTransactionReceipt({ hash: tx });

    const nonZero = bonuses.filter(b => b > 0).length;
    console.log(`  Mob ${mobId} (${mobNames[i]}): ${nonZero} bonuses set -> tx: ${tx}`);
  }

  console.log('');
  console.log('=== Deploy Complete ===');
}

main().catch(console.error);
