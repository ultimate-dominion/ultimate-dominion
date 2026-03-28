#!/usr/bin/env npx tsx
/**
 * Deploy Z2 NPCs — Tal (shop), Vel Morrow (respec), Edric Thorne (guild)
 *
 * This is a targeted deploy for the 3 new Windy Peaks NPCs.
 * Does NOT re-create items/monsters (already on-chain from prior deploy).
 *
 * Usage: CHAIN_ID=8453 npx tsx scripts/admin/deploy-z2-npcs.ts
 */

import { config } from 'dotenv';
const envFile = process.env.CHAIN_ID === '8453' ? '.env.testnet' : '.env';
config({ path: envFile, override: false });

import { createPublicClient, createWalletClient, http, parseAbi, encodeAbiParameters, type Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { base } from 'viem/chains';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const ZONE_ORIGIN_Y = 100; // Z2 origin

const worldAbi = parseAbi([
  'function UD__createMob(uint8 mobType, bytes stats, string mobMetadataUri) returns (uint256)',
  'function UD__spawnMob(uint256 mobId, uint16 x, uint16 y) returns (bytes32)',
]);

enum MobType {
  Monster = 0,
  NPC = 1,
  Shop = 2,
}

function encodeNPCStats(name: string, storyPathIds: Hex[], alignment: number): Hex {
  return encodeAbiParameters(
    [{ type: 'tuple', components: [
      { name: 'name', type: 'string' },
      { name: 'storyPathIds', type: 'bytes32[]' },
      { name: 'alignment', type: 'uint8' },
    ]}],
    [{ name, storyPathIds, alignment }]
  );
}

function encodeShopStats(
  gold: bigint, maxGold: bigint, priceMarkup: bigint, priceMarkdown: bigint,
  restockTimestamp: bigint, sellableItems: bigint[], buyableItems: bigint[],
  restock: bigint[], stock: bigint[]
): Hex {
  return encodeAbiParameters(
    [{ type: 'tuple', components: [
      { name: 'gold', type: 'uint256' },
      { name: 'maxGold', type: 'uint256' },
      { name: 'priceMarkup', type: 'uint256' },
      { name: 'priceMarkdown', type: 'uint256' },
      { name: 'restockTimestamp', type: 'uint256' },
      { name: 'sellableItems', type: 'uint256[]' },
      { name: 'buyableItems', type: 'uint256[]' },
      { name: 'restock', type: 'uint256[]' },
      { name: 'stock', type: 'uint256[]' },
    ]}],
    [{ gold, maxGold, priceMarkup, priceMarkdown, restockTimestamp, sellableItems, buyableItems, restock, stock }]
  );
}

async function main() {
  const privateKey = process.env.PRIVATE_KEY as `0x${string}`;
  const worldAddress = process.env.WORLD_ADDRESS as `0x${string}`;
  const rpcUrl = process.env.RPC_URL!;

  if (!privateKey || !worldAddress || !rpcUrl) {
    throw new Error('Missing PRIVATE_KEY, WORLD_ADDRESS, or RPC_URL');
  }

  const account = privateKeyToAccount(privateKey);
  const chain = base;

  const publicClient = createPublicClient({ chain, transport: http(rpcUrl) });
  const walletClient = createWalletClient({ account, chain, transport: http(rpcUrl) });

  console.log(`Deployer: ${account.address}`);
  console.log(`World: ${worldAddress}`);
  console.log(`RPC: ${rpcUrl}\n`);

  async function sendTx(args: Parameters<typeof walletClient.writeContract>[0]) {
    const hash = await walletClient.writeContract(args);
    console.log(`  tx: ${hash}`);
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    if (receipt.status !== 'success') throw new Error(`TX failed: ${hash}`);
    await sleep(2000); // RPC sync delay
    return receipt;
  }

  // ── 1. Tal Carden — Shop at (7, 0) ──
  // Empty inventory for now — items will be added via admin once item-sync resolves IDs
  console.log('>>> Creating Tal Carden (Shop) at (7, 100) <<<');
  const shopStats = encodeShopStats(
    10000000000000000000000n,  // gold: 10,000
    10000000000000000000000n,  // maxGold: 10,000
    2500n,                     // priceMarkup: 25%
    5000n,                     // priceMarkdown: 50%
    0n,                        // restockTimestamp
    [],                        // sellableItems (empty — items TBD)
    [],                        // buyableItems (empty — items TBD)
    [],                        // restock
    [],                        // stock
  );

  await sendTx({
    address: worldAddress,
    abi: worldAbi,
    functionName: 'UD__createMob',
    args: [MobType.Shop, shopStats, 'shop:tal_carden'],
  });
  console.log('  -> Created shop mob template');

  // mobId: Z2 has 11 monsters (IDs come from prior deploy). The shop is the next mob.
  // We read the mob counter to get the actual ID.
  // For safety, let's just use the next available ID after existing mobs.
  // Z2 had 10 monsters + 1 boss = 11 mobs. Z1 had 11 mobs + 1 shop = 12.
  // Total existing: 23. New shop = mobId 24.
  // BUT — this is fragile. Let's read the counter.

  const mobCounterAbi = parseAbi(['function UD__getCurrentMobCounter() view returns (uint256)']);
  let currentMobCounter: bigint;
  try {
    currentMobCounter = await publicClient.readContract({
      address: worldAddress,
      abi: mobCounterAbi,
      functionName: 'UD__getCurrentMobCounter',
    });
  } catch {
    // Fallback: the mob counter might not be exposed. Use known count.
    // Z1: 11 monsters + 1 shop = 12 mobs. Z2: 11 monsters = 11 mobs. Total = 23.
    // New shop is 24. But safer to just estimate high.
    console.warn('  Could not read mob counter, using estimate');
    currentMobCounter = 24n;
  }

  const talMobId = currentMobCounter;
  console.log(`  Tal mobId: ${talMobId}`);

  await sendTx({
    address: worldAddress,
    abi: worldAbi,
    functionName: 'UD__spawnMob',
    args: [talMobId, 7, ZONE_ORIGIN_Y + 0],
  });
  console.log('  -> Spawned at (7, 100)\n');

  // ── 2. Vel Morrow — NPC (respec) at (2, 3) ──
  console.log('>>> Creating Vel Morrow (NPC/Respec) at (2, 103) <<<');
  const velStats = encodeNPCStats('Vel Morrow', [], 0); // Alignment.Loyalist = 0

  await sendTx({
    address: worldAddress,
    abi: worldAbi,
    functionName: 'UD__createMob',
    args: [MobType.NPC, velStats, 'npc:vel_morrow'],
  });
  console.log('  -> Created NPC mob template');

  const velMobId = talMobId + 1n;
  console.log(`  Vel mobId: ${velMobId}`);

  await sendTx({
    address: worldAddress,
    abi: worldAbi,
    functionName: 'UD__spawnMob',
    args: [velMobId, 2, ZONE_ORIGIN_Y + 3],
  });
  console.log('  -> Spawned at (2, 103)\n');

  // ── 3. Edric Thorne — NPC (guild) at (3, 0) ──
  console.log('>>> Creating Edric Thorne (NPC/Guild) at (3, 100) <<<');
  const edricStats = encodeNPCStats('Edric Thorne', [], 1); // Alignment.Neutral = 1

  await sendTx({
    address: worldAddress,
    abi: worldAbi,
    functionName: 'UD__createMob',
    args: [MobType.NPC, edricStats, 'npc:edric_thorne'],
  });
  console.log('  -> Created NPC mob template');

  const edricMobId = velMobId + 1n;
  console.log(`  Edric mobId: ${edricMobId}`);

  await sendTx({
    address: worldAddress,
    abi: worldAbi,
    functionName: 'UD__spawnMob',
    args: [edricMobId, 3, ZONE_ORIGIN_Y + 0],
  });
  console.log('  -> Spawned at (3, 100)\n');

  console.log('='.repeat(60));
  console.log('  Z2 NPCs deployed successfully!');
  console.log('  Tal Carden (shop) at (7, 100) — mobId ' + talMobId);
  console.log('  Vel Morrow (respec) at (2, 103) — mobId ' + velMobId);
  console.log('  Edric Thorne (guild) at (3, 100) — mobId ' + edricMobId);
  console.log('='.repeat(60));
}

main().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
