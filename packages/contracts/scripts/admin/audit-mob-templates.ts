#!/usr/bin/env npx tsx
/**
 * Audit Mob Templates — Read on-chain Mobs table and verify combat weapon IDs.
 * Uses cast-style raw hex parsing to bypass viem ABI issues with MUD tables.
 */

import { config } from 'dotenv';
config();

import {
  createPublicClient,
  http,
  Hex,
  Address,
  parseAbi,
  numberToHex,
  pad,
  decodeFunctionResult,
  encodeFunctionData,
} from 'viem';
import { base, foundry } from 'viem/chains';

// MUD store getRecord with fieldLayout (v2 signature)
const storeAbi = parseAbi([
  'function getRecord(bytes32 tableId, bytes32[] keyTuple, bytes32 fieldLayout) view returns (bytes staticData, bytes32 encodedLengths, bytes dynamicData)',
]);

const erc1155Abi = parseAbi([
  'function uri(uint256 id) view returns (string)',
]);

// Mobs table constants from codegen
const MOBS_TABLE_ID = '0x746255440000000000000000000000004d6f6273000000000000000000000000' as Hex;
const MOBS_FIELD_LAYOUT = '0x0001010201000000000000000000000000000000000000000000000000000000' as Hex;

const MOB_NAMES: Record<number, string> = {
  1: 'Dire Rat', 2: 'Fungal Shaman', 3: 'Cavern Brute',
  4: 'Crystal Elemental', 5: 'Ironhide Troll', 6: 'Phase Spider',
  7: 'Bonecaster', 8: 'Rock Golem', 9: 'Pale Stalker',
  10: 'Dusk Drake', 12: 'Basilisk',
};

function hexWord(hex: string, wordIndex: number): bigint {
  const start = wordIndex * 64;
  const slice = hex.slice(start, start + 64);
  if (!slice || slice.length === 0) return 0n;
  return BigInt('0x' + slice.padEnd(64, '0'));
}

function signedWord(hex: string, wordIndex: number): bigint {
  const val = hexWord(hex, wordIndex);
  const MAX = BigInt('0x8000000000000000000000000000000000000000000000000000000000000000');
  const MOD = BigInt('0x10000000000000000000000000000000000000000000000000000000000000000');
  return val >= MAX ? val - MOD : val;
}

async function main() {
  const worldAddress = process.env.WORLD_ADDRESS as Address;
  const rpcUrl = process.env.RPC_URL || 'http://127.0.0.1:8545';
  const chainId = parseInt(process.env.CHAIN_ID || '31337');

  if (!worldAddress) { console.error('WORLD_ADDRESS not set'); process.exit(1); }

  const chain = chainId === 8453 ? base : foundry;
  const publicClient = createPublicClient({ chain, transport: http(rpcUrl) });

  console.log('=== Mob Template Audit ===');
  console.log(`World: ${worldAddress}\n`);

  for (const mobId of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12]) {
    const name = MOB_NAMES[mobId] || `Mob ${mobId}`;
    const keyTuple = [pad(numberToHex(mobId), { size: 32 })] as Hex[];

    try {
      const result = await publicClient.readContract({
        address: worldAddress,
        abi: storeAbi,
        functionName: 'getRecord',
        args: [MOBS_TABLE_ID, keyTuple, MOBS_FIELD_LAYOUT],
      });

      const [staticData, encodedLengths, dynamicData] = result;

      // staticData = 1 byte mobType
      const mobType = parseInt((staticData as string).slice(2, 4), 16);

      // Parse encodedLengths for field sizes
      // MUD EncodedLengths: 32 bytes, last 7 = total, preceding 5-byte chunks for each field (right to left)
      const lenHex = (encodedLengths as string).slice(2).padStart(64, '0');
      // 2 dynamic fields: mobStats (bytes), mobMetadata (string)
      // Layout: [padding] [field1_len: 5 bytes] [field0_len: 5 bytes] [total: 7 bytes]
      // Actually MUD packs: rightmost 7 bytes = total, then 5 bytes per field going left
      const totalLen = parseInt(lenHex.slice(50, 64), 16);
      const field0Len = parseInt(lenHex.slice(40, 50), 16); // mobStats
      const field1Len = parseInt(lenHex.slice(30, 40), 16); // mobMetadata

      const dynHex = (dynamicData as string).slice(2);
      const statsHex = dynHex.slice(0, field0Len * 2);
      const metaHex = dynHex.slice(field0Len * 2, (field0Len + field1Len) * 2);

      // Decode metadata string
      let metadata = '';
      try {
        metadata = Buffer.from(metaHex, 'hex').toString('utf8');
      } catch {}

      // MonsterStats ABI encoding:
      // word 0: agility (int256)
      // word 1: armor (int256)
      // word 2: class (uint8 padded to 32 bytes)
      // word 3: experience (uint256)
      // word 4: hasBossAI (bool padded to 32 bytes)
      // word 5: hitPoints (int256)
      // word 6: intelligence (int256)
      // word 7: inventory offset (uint256) — points to dynamic data
      // word 8: level (uint256)
      // word 9: strength (int256)
      // at inventory offset: word N = array length, then N elements

      const agility = signedWord(statsHex, 0);
      const armor_ = signedWord(statsHex, 1);
      const classId = Number(hexWord(statsHex, 2));
      const experience = hexWord(statsHex, 3);
      const hasBossAI = hexWord(statsHex, 4) !== 0n;
      const hitPoints = signedWord(statsHex, 5);
      const intelligence = signedWord(statsHex, 6);
      const invOffsetBytes = Number(hexWord(statsHex, 7));
      const level = hexWord(statsHex, 8);
      const strength = signedWord(statsHex, 9);

      // Decode inventory array
      const invStartWord = invOffsetBytes / 32;
      const invLength = Number(hexWord(statsHex, invStartWord));
      const inventory: bigint[] = [];
      for (let i = 0; i < invLength; i++) {
        inventory.push(hexWord(statsHex, invStartWord + 1 + i));
      }

      const weaponCount = hasBossAI ? 2 : 1;
      const classNames = ['Warrior', 'Ranger', 'Mage'];

      console.log(`--- ${name} (mob ${mobId}) ---`);
      console.log(`  L${level} ${classNames[classId] || classId} | STR ${strength} AGI ${agility} INT ${intelligence} | HP ${hitPoints} | Armor ${armor_} | Boss: ${hasBossAI}`);
      console.log(`  Inventory: ${inventory.length} items | Combat weapons: ${weaponCount}`);

      // Resolve ALL item URIs for full audit
      for (let w = 0; w < inventory.length; w++) {
        try {
          const uri = await publicClient.readContract({
            address: worldAddress,
            abi: erc1155Abi,
            functionName: 'uri',
            args: [inventory[w]],
          });
          const marker = w < weaponCount ? ' *** COMBAT WEAPON ***' : '';
          console.log(`  [${w}] item ${inventory[w]} → "${uri}"${marker}`);
        } catch {
          console.log(`  [${w}] item ${inventory[w]} → (URI read failed)`);
        }
      }
      console.log(`  Metadata: ${metadata}\n`);

    } catch (e: any) {
      console.log(`--- ${name} (mob ${mobId}) --- ERROR: ${e.message?.slice(0, 150)}\n`);
    }
  }

  console.log('=== Done ===');
}

main().catch((e) => {
  console.error('Error:', e);
  process.exit(1);
});
