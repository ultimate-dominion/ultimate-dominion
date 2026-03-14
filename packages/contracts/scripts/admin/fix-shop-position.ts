#!/usr/bin/env npx tsx
/**
 * Fix shop position — directly write Position + EntitiesAtPosition + Spawned
 * for the known shop entity using MUD setRecord / pushToDynamicField.
 */
import { config } from 'dotenv';
config();

import {
  createPublicClient,
  createWalletClient,
  http,
  parseAbi,
  encodePacked,
  toHex,
  padHex,
  type Hex,
  type Address,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { base, foundry } from 'viem/chains';

const SHOP_ENTITY = '0x0000000b00000000000000000000000000000000000000000000000100090009' as Hex;
const TARGET_X = 9;
const TARGET_Y = 9;

// MUD ResourceIds: bytes2(type) + bytes14(namespace) + bytes16(name)
const positionTableId = encodePacked(
  ['bytes2', 'bytes14', 'bytes16'],
  [toHex('tb', { size: 2 }) as Hex, toHex('UD', { size: 14 }) as Hex, toHex('Position', { size: 16 }) as Hex],
);

const spawnedTableId = encodePacked(
  ['bytes2', 'bytes14', 'bytes16'],
  [toHex('tb', { size: 2 }) as Hex, toHex('UD', { size: 14 }) as Hex, toHex('Spawned', { size: 16 }) as Hex],
);

const entitiesTableId = encodePacked(
  ['bytes2', 'bytes14', 'bytes16'],
  [toHex('tb', { size: 2 }) as Hex, toHex('UD', { size: 14 }) as Hex, toHex('EntitiesAtPositi', { size: 16 }) as Hex],
);

const worldAbi = parseAbi([
  'function setRecord(bytes32 tableId, bytes32[] calldata keyTuple, bytes calldata staticData, bytes32 encodedLengths, bytes calldata dynamicData)',
  'function pushToDynamicField(bytes32 tableId, bytes32[] calldata keyTuple, uint8 dynamicFieldIndex, bytes calldata dataToPush)',
  'function UD__getEntitiesAtPosition(uint16 x, uint16 y) view returns (bytes32[])',
  'function UD__getEntityPosition(bytes32 entityId) view returns (uint16, uint16)',
  'function UD__isShop(bytes32 entityId) view returns (bool)',
]);

async function main() {
  const worldAddress = process.env.WORLD_ADDRESS as Address;
  const rpcUrl = process.env.RPC_URL || 'http://127.0.0.1:8545';
  const privateKey = process.env.PRIVATE_KEY as Hex;
  const chainId = parseInt(process.env.CHAIN_ID || '31337');

  const chain = chainId === 8453 ? base : foundry;
  const publicClient = createPublicClient({ chain, transport: http(rpcUrl) });
  const account = privateKeyToAccount(privateKey);
  const walletClient = createWalletClient({ chain, transport: http(rpcUrl), account });

  console.log('World:', worldAddress);
  console.log('Account:', account.address);

  // Verify shop entity
  const isShop = await publicClient.readContract({
    address: worldAddress, abi: worldAbi, functionName: 'UD__isShop', args: [SHOP_ENTITY],
  });
  console.log('isShop:', isShop);
  if (!isShop) { console.error('Entity is not a shop!'); process.exit(1); }

  const [curX, curY] = await publicClient.readContract({
    address: worldAddress, abi: worldAbi, functionName: 'UD__getEntityPosition', args: [SHOP_ENTITY],
  });
  console.log('Current position:', curX, curY);

  // 1. Set Position(SHOP_ENTITY) = (9, 9)
  const posStaticData = encodePacked(['uint16', 'uint16'], [TARGET_X, TARGET_Y]);
  console.log('\n1. Setting Position to (9,9)...');
  const h1 = await walletClient.writeContract({
    address: worldAddress, abi: worldAbi, functionName: 'setRecord',
    args: [
      positionTableId as Hex,
      [SHOP_ENTITY],
      posStaticData,
      '0x0000000000000000000000000000000000000000000000000000000000000000' as Hex,
      '0x' as Hex,
    ],
  });
  await publicClient.waitForTransactionReceipt({ hash: h1 });
  console.log('   Done. TX:', h1);

  // 2. Set Spawned(SHOP_ENTITY) = true
  const spawnedStaticData = encodePacked(['bool'], [true]);
  console.log('2. Setting Spawned to true...');
  const h2 = await walletClient.writeContract({
    address: worldAddress, abi: worldAbi, functionName: 'setRecord',
    args: [
      spawnedTableId as Hex,
      [SHOP_ENTITY],
      spawnedStaticData,
      '0x0000000000000000000000000000000000000000000000000000000000000000' as Hex,
      '0x' as Hex,
    ],
  });
  await publicClient.waitForTransactionReceipt({ hash: h2 });
  console.log('   Done. TX:', h2);

  // 3. Push SHOP_ENTITY to EntitiesAtPosition(9, 9)
  const xKey = padHex(toHex(TARGET_X, { size: 2 }), { size: 32 });
  const yKey = padHex(toHex(TARGET_Y, { size: 2 }), { size: 32 });
  console.log('3. Adding to EntitiesAtPosition(9,9)...');
  const h3 = await walletClient.writeContract({
    address: worldAddress, abi: worldAbi, functionName: 'pushToDynamicField',
    args: [
      entitiesTableId as Hex,
      [xKey, yKey],
      0,
      SHOP_ENTITY,
    ],
  });
  await publicClient.waitForTransactionReceipt({ hash: h3 });
  console.log('   Done. TX:', h3);

  // Verify
  const [newX, newY] = await publicClient.readContract({
    address: worldAddress, abi: worldAbi, functionName: 'UD__getEntityPosition', args: [SHOP_ENTITY],
  });
  console.log('\nNew position:', newX, newY);

  const entities = await publicClient.readContract({
    address: worldAddress, abi: worldAbi, functionName: 'UD__getEntitiesAtPosition', args: [9, 9],
  });
  console.log('Entities at (9,9):', entities);
  console.log('\nDone! Shop should now appear at (9,9) on next page refresh.');
}

main().catch(console.error);
