#!/usr/bin/env npx tsx
/**
 * Deploy spell weapon items for all 18 class spells (9 L10 + 9 L15).
 *
 * Each spell is a Weapon item with zero damage stats but an effects array
 * containing the spell's effectId. The item's minLevel gates access.
 *
 * Usage:
 *   source .env.testnet && npx tsx scripts/admin/deploy-spell-items.ts
 *   source .env.testnet && npx tsx scripts/admin/deploy-spell-items.ts --dry-run
 */

import {
  createPublicClient,
  createWalletClient,
  http,
  Hex,
  Address,
  keccak256,
  encodeAbiParameters,
  parseAbiParameters,
  parseAbi,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { base, foundry } from 'viem/chains';

// ---------------------------------------------------------------------------
// Effect ID computation — matches deploy-spell-config.ts
// ---------------------------------------------------------------------------

function effectId(name: string): Hex {
  const hash = keccak256(encodeAbiParameters(parseAbiParameters('string'), [name]));
  // First 8 bytes of hash, right-padded to 32 bytes
  return (hash.slice(0, 18).padEnd(66, '0')) as Hex;
}

// ---------------------------------------------------------------------------
// Spell item definitions — class -> L10 + L15 effect names
// ---------------------------------------------------------------------------

interface SpellDef {
  className: string;
  l10EffectName: string;
  l15EffectName: string;
}

const SPELLS: SpellDef[] = [
  { className: 'Warrior',  l10EffectName: 'battle_cry',          l15EffectName: 'warcry' },
  { className: 'Paladin',  l10EffectName: 'divine_shield',       l15EffectName: 'judgment' },
  { className: 'Ranger',   l10EffectName: 'hunters_mark',        l15EffectName: 'volley' },
  { className: 'Rogue',    l10EffectName: 'shadowstep',          l15EffectName: 'backstab' },
  { className: 'Druid',    l10EffectName: 'entangle',            l15EffectName: 'regrowth' },
  { className: 'Warlock',  l10EffectName: 'soul_drain_curse',    l15EffectName: 'blight' },
  { className: 'Wizard',   l10EffectName: 'arcane_blast_damage', l15EffectName: 'meteor' },
  { className: 'Sorcerer', l10EffectName: 'arcane_surge_damage', l15EffectName: 'mana_burn' },
  { className: 'Cleric',   l10EffectName: 'blessing',            l15EffectName: 'smite' },
];

// ---------------------------------------------------------------------------
// ABI for adminCreateItem
// ---------------------------------------------------------------------------

const worldAbi = parseAbi([
  'function UD__adminCreateItem(uint8 itemType, uint256 supply, uint256 dropChance, uint256 price, uint256 rarity, bytes stats, string itemMetadataURI) external returns (uint256)',
]);

// ---------------------------------------------------------------------------
// Stats encoding
// ---------------------------------------------------------------------------

/**
 * Encode WeaponStatsData + StatRestrictionsData as ABI-encoded bytes.
 *
 * WeaponStatsData:
 *   (int256 agiModifier, int256 intModifier, int256 hpModifier,
 *    int256 maxDamage, int256 minDamage, uint256 minLevel,
 *    int256 strModifier, bytes32[] effects)
 *
 * StatRestrictionsData:
 *   (int256 minAgility, int256 minIntelligence, int256 minStrength)
 */
function encodeWeaponStats(minLevel: number, effectIdHex: Hex): Hex {
  return encodeAbiParameters(
    parseAbiParameters(
      '(int256,int256,int256,int256,int256,uint256,int256,bytes32[]), (int256,int256,int256)',
    ),
    [
      [0n, 0n, 0n, 0n, 0n, BigInt(minLevel), 0n, [effectIdHex]],
      [0n, 0n, 0n],
    ],
  );
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const dryRun = process.argv.includes('--dry-run');

  const worldAddress = process.env.WORLD_ADDRESS as Address;
  const rpcUrl = process.env.RPC_URL || 'http://127.0.0.1:8545';
  const privateKey = process.env.PRIVATE_KEY as Hex;
  const chainId = parseInt(process.env.CHAIN_ID || '8453');

  if (!worldAddress) { console.error('WORLD_ADDRESS not set'); process.exit(1); }
  if (!privateKey && !dryRun) { console.error('PRIVATE_KEY not set'); process.exit(1); }

  const chain = chainId === 8453 ? base : foundry;
  const publicClient = createPublicClient({ chain, transport: http(rpcUrl) });

  console.log('=== Deploy Spell Weapon Items ===');
  console.log(`World: ${worldAddress}`);
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}`);
  console.log(`Items: ${SPELLS.length * 2} (${SPELLS.length} L10 + ${SPELLS.length} L15)\n`);

  // ItemType.Weapon = 0 — we deploy spells as weapons until the contract's
  // ItemCreationSystem.createItem() gains a Spell branch. Today Spell items
  // would write nothing to SpellStats and CombatSystem._executeMagicAction
  // would revert with InvalidMagicItemType. The client categorizes these
  // via the "spell:<effectName>" tokenURI prefix (see ItemsContext.tsx).
  const ITEM_TYPE_WEAPON = 0;
  const SUPPLY = 0n;
  const DROP_CHANCE = 0n;
  const PRICE = 0n;
  const RARITY = 1n;

  if (dryRun) {
    for (const spell of SPELLS) {
      const l10Eid = effectId(spell.l10EffectName);
      const l15Eid = effectId(spell.l15EffectName);
      const l10Stats = encodeWeaponStats(10, l10Eid);
      const l15Stats = encodeWeaponStats(15, l15Eid);
      console.log(`${spell.className}:`);
      console.log(`  L10 "${spell.l10EffectName}" effectId=${l10Eid.slice(0, 18)}... stats=${l10Stats.slice(0, 34)}...`);
      console.log(`  L15 "${spell.l15EffectName}" effectId=${l15Eid.slice(0, 18)}... stats=${l15Stats.slice(0, 34)}...`);
    }
    console.log('\nDry run — no changes made.');
    return;
  }

  const account = privateKeyToAccount(privateKey);
  const walletClient = createWalletClient({ account, chain, transport: http(rpcUrl) });
  let nonce = await publicClient.getTransactionCount({ address: account.address });

  console.log(`Deployer: ${account.address}`);
  console.log(`Starting nonce: ${nonce}\n`);

  const summary: Record<string, { l10ItemId: string; l15ItemId: string }> = {};

  for (const spell of SPELLS) {
    console.log(`--- ${spell.className} ---`);

    // L10 spell item
    const l10Eid = effectId(spell.l10EffectName);
    const l10Stats = encodeWeaponStats(10, l10Eid);
    const l10MetadataUri = `spell:${spell.l10EffectName}`;

    const { result: l10ItemId } = await publicClient.simulateContract({
      address: worldAddress,
      abi: worldAbi,
      functionName: 'UD__adminCreateItem',
      args: [ITEM_TYPE_WEAPON, SUPPLY, DROP_CHANCE, PRICE, RARITY, l10Stats, l10MetadataUri],
      account: account,
    });

    const l10Hash = await walletClient.writeContract({
      address: worldAddress,
      abi: worldAbi,
      functionName: 'UD__adminCreateItem',
      args: [ITEM_TYPE_WEAPON, SUPPLY, DROP_CHANCE, PRICE, RARITY, l10Stats, l10MetadataUri],
      nonce: nonce++,
    });
    console.log(`  L10 "${spell.l10EffectName}" -> itemId=${l10ItemId} tx=${l10Hash}`);

    // L15 spell item
    const l15Eid = effectId(spell.l15EffectName);
    const l15Stats = encodeWeaponStats(15, l15Eid);
    const l15MetadataUri = `spell:${spell.l15EffectName}`;

    const { result: l15ItemId } = await publicClient.simulateContract({
      address: worldAddress,
      abi: worldAbi,
      functionName: 'UD__adminCreateItem',
      args: [ITEM_TYPE_WEAPON, SUPPLY, DROP_CHANCE, PRICE, RARITY, l15Stats, l15MetadataUri],
      account: account,
    });

    const l15Hash = await walletClient.writeContract({
      address: worldAddress,
      abi: worldAbi,
      functionName: 'UD__adminCreateItem',
      args: [ITEM_TYPE_WEAPON, SUPPLY, DROP_CHANCE, PRICE, RARITY, l15Stats, l15MetadataUri],
      nonce: nonce++,
    });
    console.log(`  L15 "${spell.l15EffectName}" -> itemId=${l15ItemId} tx=${l15Hash}`);

    summary[spell.className] = {
      l10ItemId: l10ItemId.toString(),
      l15ItemId: l15ItemId.toString(),
    };
  }

  console.log('\n=== Summary ===');
  console.log(JSON.stringify(summary, null, 2));
  console.log(`\nDone! ${SPELLS.length * 2} spell items created.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
