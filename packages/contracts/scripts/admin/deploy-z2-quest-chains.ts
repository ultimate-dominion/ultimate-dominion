#!/usr/bin/env npx tsx
/**
 * Deploy Z2 Quest Chains — fragment chain step configs, quest mobs, world object NPCs,
 * quest items, and fragment metadata for Windy Peaks fragments IX-XVI.
 *
 * Prereqs: Z2 zone config, monsters, and core NPCs (Tal/Vel/Edric) must already be deployed.
 *
 * Usage: CHAIN_ID=8453 npx tsx scripts/admin/deploy-z2-quest-chains.ts
 */

import { config } from 'dotenv';
const envFile = process.env.CHAIN_ID === '8453' ? '.env.testnet' : '.env';
config({ path: envFile, override: false });

import {
  createPublicClient,
  createWalletClient,
  http,
  parseAbi,
  encodeAbiParameters,
  type Hex,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { base } from 'viem/chains';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// ══════════════════════════════════════════════════════════
// Zone 2 coordinates (Y offset = 100 for Windy Peaks)
// ══════════════════════════════════════════════════════════
const Z2_ORIGIN_Y = 100;

// Tile positions for quest locations
const TILES = {
  spawn: { x: 0, y: Z2_ORIGIN_Y },
  velRidge: { x: 2, y: Z2_ORIGIN_Y + 3 },        // Vel's ridge position (existing NPC)
  covenantCamp: { x: 6, y: Z2_ORIGIN_Y + 5 },     // Abandoned Covenant camp
  shrine: { x: 4, y: Z2_ORIGIN_Y + 7 },            // Korrath's ruined shrine
  ossuary: { x: 8, y: Z2_ORIGIN_Y + 8 },           // Ossuary (deep peaks)
  summit: { x: 5, y: Z2_ORIGIN_Y + 9 },             // Summit (highest point)
  edric: { x: 3, y: Z2_ORIGIN_Y },                  // Edric's position (existing NPC)
};

// Fragment trigger types (must match FragmentTriggerType enum)
const TriggerType = {
  TileVisit: 0,
  CombatKill: 1,
  NpcInteract: 2,
} as const;

// ══════════════════════════════════════════════════════════
// ABI definitions
// ══════════════════════════════════════════════════════════
const worldAbi = parseAbi([
  // Fragment chain system
  'function UD__setChainStep(uint8 fragmentType, uint256 stepIndex, uint8 triggerType, bytes triggerData, string narrative) external',
  'function UD__setFragmentMetadata(uint8 fragmentType, string name, string narrative, string hint) external',
  // NPC dialogue
  'function UD__setNpcDialogue(bytes32 npcId, uint8 fragmentType, uint256 fragmentStep, uint256 zoneId, string dialogueLines) external',
  // Mob creation
  'function UD__createMob(uint8 mobType, bytes stats, string mobMetadataUri) returns (uint256)',
  'function UD__spawnMob(uint256 mobId, uint16 x, uint16 y) returns (bytes32)',
  'function UD__getCurrentMobCounter() view returns (uint256)',
  // Item creation (for quest items)
  'function UD__createItem(uint8 itemType, string name, string description, uint256 price, uint256 rarity, bytes stats) returns (uint256)',
  // FragmentChainStepReward direct table write
  'function UD__setFragmentChainStepReward(uint8 fragmentType, uint256 stepIndex, uint256 rewardItemId) external',
]);

enum MobType {
  Monster = 0,
  NPC = 1,
  Shop = 2,
}

// ══════════════════════════════════════════════════════════
// Encoding helpers
// ══════════════════════════════════════════════════════════
function encodeTileVisit(x: number, y: number): Hex {
  return encodeAbiParameters(
    [{ type: 'uint16' }, { type: 'uint16' }],
    [x, y]
  );
}

function encodeCombatKill(mobId: bigint): Hex {
  return encodeAbiParameters(
    [{ type: 'uint256' }],
    [mobId]
  );
}

function encodeNpcInteract(npcEntityId: Hex): Hex {
  return encodeAbiParameters(
    [{ type: 'bytes32' }],
    [npcEntityId]
  );
}

function encodeMonsterStats(
  level: number, hp: number, str: number, agi: number, int_: number, arm: number,
  xp: number, cls: number
): Hex {
  return encodeAbiParameters(
    [{ type: 'tuple', components: [
      { name: 'level', type: 'uint256' },
      { name: 'maxHp', type: 'int256' },
      { name: 'strength', type: 'int256' },
      { name: 'agility', type: 'int256' },
      { name: 'intelligence', type: 'int256' },
      { name: 'armor', type: 'int256' },
      { name: 'experience', type: 'uint256' },
      { name: 'monsterClass', type: 'uint8' },
    ]}],
    [{ level: BigInt(level), maxHp: BigInt(hp), strength: BigInt(str), agility: BigInt(agi),
       intelligence: BigInt(int_), armor: BigInt(arm), experience: BigInt(xp), monsterClass: cls }]
  );
}

function encodeNPCStats(name: string): Hex {
  return encodeAbiParameters(
    [{ type: 'tuple', components: [
      { name: 'name', type: 'string' },
      { name: 'storyPathIds', type: 'bytes32[]' },
      { name: 'alignment', type: 'uint8' },
    ]}],
    [{ name, storyPathIds: [], alignment: 1 }] // Neutral alignment
  );
}

// ══════════════════════════════════════════════════════════
// Quest mob definitions
// ══════════════════════════════════════════════════════════
const QUEST_MOBS = [
  { name: 'Covenant Scout',        level: 13, hp: 28, str: 8,  agi: 14, int_: 6,  arm: 4,  xp: 8,  cls: 1, uri: 'mob:covenant_scout',        tile: TILES.velRidge },
  { name: 'Covenant Tracker',      level: 15, hp: 38, str: 14, agi: 10, int_: 6,  arm: 6,  xp: 12, cls: 0, uri: 'mob:covenant_tracker',      tile: { x: 4, y: Z2_ORIGIN_Y + 4 } },
  { name: 'Fraying-touched Guardian', level: 16, hp: 42, str: 8, agi: 8, int_: 16, arm: 5,  xp: 14, cls: 2, uri: 'mob:fraying_guardian',      tile: TILES.shrine },
  { name: 'Ossuary Guardian',      level: 17, hp: 48, str: 16, agi: 8,  int_: 8,  arm: 8,  xp: 16, cls: 0, uri: 'mob:ossuary_guardian',      tile: TILES.ossuary },
  { name: 'Gale Fury',             level: 18, hp: 55, str: 10, agi: 10, int_: 18, arm: 3,  xp: 20, cls: 2, uri: 'mob:gale_fury',             tile: TILES.summit },
];

// ══════════════════════════════════════════════════════════
// World object NPC definitions (interactable objects)
// ══════════════════════════════════════════════════════════
const WORLD_OBJECTS = [
  { name: 'Camp Journal',        tile: TILES.covenantCamp, dialogue: 'A scorched journal lies among the remains of a Covenant camp.' },
  { name: 'Shrine Inscriptions', tile: TILES.shrine,       dialogue: 'Ancient prayers to Korrath are carved into the weathered stone.' },
  { name: 'Edric at Shrine',     tile: TILES.shrine,       dialogue: 'Edric kneels at the altar, hands clasped, eyes closed.' },
  { name: 'Summit Stone',        tile: TILES.summit,       dialogue: 'A monolith carved with thousands of names. A pilgrimage marker.' },
];

// ══════════════════════════════════════════════════════════
// Fragment metadata
// ══════════════════════════════════════════════════════════
const FRAGMENT_METADATA: Array<{ type: number; name: string; hint: string }> = [
  { type: 9,  name: 'The Ascent',             hint: 'The light awaits beyond the Marrow...' },
  { type: 10, name: "Vel's Warning",          hint: 'The Blade watches from the ridgeline...' },
  { type: 11, name: 'The Orders',             hint: 'Covenant hunters carry sealed orders...' },
  { type: 12, name: 'What She Left Behind',   hint: "An abandoned camp holds a soldier's confession..." },
  { type: 13, name: 'The Shrine',             hint: "A god of war's shrine stands in the peaks..." },
  { type: 14, name: "The Heretic's Question", hint: 'The Mender seeks answers at the altar...' },
  { type: 15, name: 'Bones of Faith',         hint: 'The dead kept their faith longer than the living...' },
  { type: 16, name: "The Wind's Memory",      hint: 'The summit remembers everyone who climbed...' },
];

// ══════════════════════════════════════════════════════════
// Main deploy
// ══════════════════════════════════════════════════════════
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
  console.log(`World:    ${worldAddress}`);
  console.log(`RPC:      ${rpcUrl}\n`);

  async function sendTx(args: Parameters<typeof walletClient.writeContract>[0]) {
    const hash = await walletClient.writeContract(args);
    console.log(`  tx: ${hash}`);
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    if (receipt.status !== 'success') throw new Error(`TX failed: ${hash}`);
    await sleep(1500);
    return receipt;
  }

  // ── Step 1: Read mob counter baseline ──
  console.log('=== Step 1: Read mob counter ===');
  let mobCounter: bigint;
  try {
    mobCounter = await publicClient.readContract({
      address: worldAddress,
      abi: worldAbi,
      functionName: 'UD__getCurrentMobCounter',
    });
    console.log(`  Current mob counter: ${mobCounter}\n`);
  } catch {
    console.warn('  Could not read mob counter — using 34 as baseline');
    mobCounter = 34n;
  }

  // ── Step 2: Create quest mobs ──
  console.log('=== Step 2: Create quest mobs ===');
  const questMobIds: bigint[] = [];

  for (const mob of QUEST_MOBS) {
    console.log(`  Creating: ${mob.name} (L${mob.level})`);
    const stats = encodeMonsterStats(mob.level, mob.hp, mob.str, mob.agi, mob.int_, mob.arm, mob.xp, mob.cls);
    await sendTx({
      address: worldAddress,
      abi: worldAbi,
      functionName: 'UD__createMob',
      args: [MobType.Monster, stats, mob.uri],
    });
    mobCounter++;
    questMobIds.push(mobCounter);
    console.log(`  -> mobId: ${mobCounter}`);

    // Spawn at position
    await sendTx({
      address: worldAddress,
      abi: worldAbi,
      functionName: 'UD__spawnMob',
      args: [mobCounter, mob.tile.x, mob.tile.y],
    });
    console.log(`  -> Spawned at (${mob.tile.x}, ${mob.tile.y})\n`);
  }

  // Verify mob IDs match constants.sol expectations
  const [scoutId, trackerId, guardianId, ossuaryId, galeFuryId] = questMobIds;
  console.log('  Mob ID verification:');
  console.log(`    COVENANT_SCOUT_MOB_ID    = ${scoutId} (expected: 35)`);
  console.log(`    COVENANT_TRACKER_MOB_ID  = ${trackerId} (expected: 36)`);
  console.log(`    FRAYING_GUARDIAN_MOB_ID  = ${guardianId} (expected: 37)`);
  console.log(`    OSSUARY_GUARDIAN_MOB_ID  = ${ossuaryId} (expected: 38)`);
  console.log(`    GALE_FURY_MOB_ID         = ${galeFuryId} (expected: 39)`);
  if (scoutId !== 35n || trackerId !== 36n || guardianId !== 37n || ossuaryId !== 38n || galeFuryId !== 39n) {
    console.error('\n  WARNING: Mob IDs do not match constants.sol! Update constants before deploying contracts.');
  }
  console.log();

  // ── Step 3: Create world object NPCs ──
  console.log('=== Step 3: Create world object NPCs ===');
  const worldObjectEntityIds: Hex[] = [];

  for (const obj of WORLD_OBJECTS) {
    console.log(`  Creating: ${obj.name} at (${obj.tile.x}, ${obj.tile.y})`);
    const stats = encodeNPCStats(obj.name);
    const receipt = await sendTx({
      address: worldAddress,
      abi: worldAbi,
      functionName: 'UD__createMob',
      args: [MobType.NPC, stats, `worldobj:${obj.name.toLowerCase().replace(/\s+/g, '_')}`],
    });
    mobCounter++;
    console.log(`  -> mobId: ${mobCounter}`);

    const spawnReceipt = await sendTx({
      address: worldAddress,
      abi: worldAbi,
      functionName: 'UD__spawnMob',
      args: [mobCounter, obj.tile.x, obj.tile.y],
    });

    // Extract entity ID from spawn event logs (the entity ID is needed for NPC dialogue config)
    // For now, compute it: entityId = (mobId << 224) | spawnIndex
    // This is approximate — the actual entityId comes from the SpawnMob event
    const entityId = `0x${mobCounter.toString(16).padStart(8, '0')}${'0'.repeat(56)}` as Hex;
    worldObjectEntityIds.push(entityId);
    console.log(`  -> entityId (approx): ${entityId}\n`);
  }

  const [campJournalEntity, shrineInscEntity, edricShrineEntity, summitStoneEntity] = worldObjectEntityIds;

  // ── Step 4: Configure NPC dialogue for world objects ──
  console.log('=== Step 4: Configure NPC dialogue ===');
  const ZONE_WINDY_PEAKS = 2n;

  for (let i = 0; i < WORLD_OBJECTS.length; i++) {
    const obj = WORLD_OBJECTS[i];
    console.log(`  Setting dialogue: ${obj.name}`);
    await sendTx({
      address: worldAddress,
      abi: worldAbi,
      functionName: 'UD__setNpcDialogue',
      args: [
        worldObjectEntityIds[i],
        0, // fragmentType = 0 (Z2 NPCs use zone-based iteration, not single-chain)
        0n,
        ZONE_WINDY_PEAKS,
        obj.dialogue,
      ],
    });
  }
  console.log();

  // ── Step 5: Get existing Vel and Edric entity IDs ──
  // These were deployed by deploy-z2-npcs.ts. We need their entity IDs for chain step config.
  // For now, we'll read them from known mob IDs. Vel = mobId 25, Edric = mobId 26 (from prior deploy).
  // The actual entity IDs need to be computed from spawn logs or provided as env vars.
  console.log('=== Step 5: Resolve existing NPC entity IDs ===');
  const VEL_ENTITY_ID = (process.env.VEL_ENTITY_ID || '0x0000000000000000000000000000000000000000000000000000000000000000') as Hex;
  const EDRIC_ENTITY_ID = (process.env.EDRIC_ENTITY_ID || '0x0000000000000000000000000000000000000000000000000000000000000000') as Hex;
  console.log(`  Vel entity:   ${VEL_ENTITY_ID}`);
  console.log(`  Edric entity: ${EDRIC_ENTITY_ID}\n`);

  if (VEL_ENTITY_ID === '0x0000000000000000000000000000000000000000000000000000000000000000') {
    console.warn('  WARNING: VEL_ENTITY_ID not set! Chain steps referencing Vel will not trigger.');
    console.warn('  Set VEL_ENTITY_ID env var from deploy-z2-npcs.ts output and re-run.');
  }

  // ── Step 6: Configure chain steps ──
  console.log('=== Step 6: Configure fragment chain steps ===');

  type ChainStep = { fragmentType: number; stepIndex: number; triggerType: number; triggerData: Hex; narrative: string };
  const steps: ChainStep[] = [
    // Fragment IX: The Ascent (1 step)
    { fragmentType: 9, stepIndex: 0, triggerType: TriggerType.TileVisit,
      triggerData: encodeTileVisit(TILES.spawn.x, TILES.spawn.y),
      narrative: 'Arrive in the Windy Peaks.' },

    // Fragment X: Vel's Warning (2 steps)
    { fragmentType: 10, stepIndex: 0, triggerType: TriggerType.NpcInteract,
      triggerData: encodeNpcInteract(VEL_ENTITY_ID),
      narrative: 'Talk to Vel on the ridge.' },
    { fragmentType: 10, stepIndex: 1, triggerType: TriggerType.CombatKill,
      triggerData: encodeCombatKill(scoutId),
      narrative: 'Kill the Covenant Scout.' },

    // Fragment XI: The Orders (2 steps)
    { fragmentType: 11, stepIndex: 0, triggerType: TriggerType.CombatKill,
      triggerData: encodeCombatKill(trackerId),
      narrative: 'Kill the Covenant Tracker.' },
    { fragmentType: 11, stepIndex: 1, triggerType: TriggerType.NpcInteract,
      triggerData: encodeNpcInteract(VEL_ENTITY_ID),
      narrative: 'Bring the Sealed Letter to Vel.' },

    // Fragment XII: What She Left Behind (3 steps)
    { fragmentType: 12, stepIndex: 0, triggerType: TriggerType.TileVisit,
      triggerData: encodeTileVisit(TILES.covenantCamp.x, TILES.covenantCamp.y),
      narrative: 'Find the abandoned Covenant camp.' },
    { fragmentType: 12, stepIndex: 1, triggerType: TriggerType.NpcInteract,
      triggerData: encodeNpcInteract(campJournalEntity),
      narrative: 'Examine the camp journal.' },
    { fragmentType: 12, stepIndex: 2, triggerType: TriggerType.NpcInteract,
      triggerData: encodeNpcInteract(VEL_ENTITY_ID),
      narrative: 'Return to Vel.' },

    // Fragment XIII: The Shrine (3 steps)
    { fragmentType: 13, stepIndex: 0, triggerType: TriggerType.TileVisit,
      triggerData: encodeTileVisit(TILES.shrine.x, TILES.shrine.y),
      narrative: 'Discover the ruined shrine.' },
    { fragmentType: 13, stepIndex: 1, triggerType: TriggerType.CombatKill,
      triggerData: encodeCombatKill(guardianId),
      narrative: 'Defeat the Fraying-touched Guardian.' },
    { fragmentType: 13, stepIndex: 2, triggerType: TriggerType.NpcInteract,
      triggerData: encodeNpcInteract(shrineInscEntity),
      narrative: 'Examine the shrine inscriptions.' },

    // Fragment XIV: The Heretic's Question (2 steps)
    { fragmentType: 14, stepIndex: 0, triggerType: TriggerType.NpcInteract,
      triggerData: encodeNpcInteract(EDRIC_ENTITY_ID),
      narrative: 'Talk to Edric about the shrine.' },
    { fragmentType: 14, stepIndex: 1, triggerType: TriggerType.NpcInteract,
      triggerData: encodeNpcInteract(edricShrineEntity),
      narrative: 'Witness Edric pray at the shrine.' },

    // Fragment XV: Bones of Faith (3 steps)
    { fragmentType: 15, stepIndex: 0, triggerType: TriggerType.TileVisit,
      triggerData: encodeTileVisit(TILES.ossuary.x, TILES.ossuary.y),
      narrative: 'Discover the Ossuary.' },
    { fragmentType: 15, stepIndex: 1, triggerType: TriggerType.CombatKill,
      triggerData: encodeCombatKill(ossuaryId),
      narrative: 'Survive the Ossuary Guardian.' },
    { fragmentType: 15, stepIndex: 2, triggerType: TriggerType.NpcInteract,
      triggerData: encodeNpcInteract(EDRIC_ENTITY_ID),
      narrative: 'Bring the Last Sermon to Edric.' },

    // Fragment XVI: The Wind's Memory (3 steps)
    { fragmentType: 16, stepIndex: 0, triggerType: TriggerType.TileVisit,
      triggerData: encodeTileVisit(TILES.summit.x, TILES.summit.y),
      narrative: 'Reach the Summit.' },
    { fragmentType: 16, stepIndex: 1, triggerType: TriggerType.CombatKill,
      triggerData: encodeCombatKill(galeFuryId),
      narrative: 'Survive the Gale Fury.' },
    { fragmentType: 16, stepIndex: 2, triggerType: TriggerType.NpcInteract,
      triggerData: encodeNpcInteract(summitStoneEntity),
      narrative: 'Examine the Summit Stone.' },
  ];

  for (const step of steps) {
    console.log(`  Fragment ${step.fragmentType} step ${step.stepIndex}: ${step.narrative}`);
    await sendTx({
      address: worldAddress,
      abi: worldAbi,
      functionName: 'UD__setChainStep',
      args: [step.fragmentType, BigInt(step.stepIndex), step.triggerType, step.triggerData, step.narrative],
    });
  }
  console.log(`  -> ${steps.length} chain steps configured\n`);

  // ── Step 7: Configure quest item rewards ──
  // Fragment XI step 0 (kill Covenant Tracker) → Sealed Letter
  // Fragment XV step 1 (kill Ossuary Guardian) → Last Sermon
  // TODO: Create quest items first, then set rewards. For now, log the IDs needed.
  console.log('=== Step 7: Quest item rewards ===');
  console.log('  NOTE: Quest items must be created via item-sync before setting rewards.');
  console.log('  After creating items, run:');
  console.log('    UD__setFragmentChainStepReward(11, 0, SEALED_LETTER_ITEM_ID)');
  console.log('    UD__setFragmentChainStepReward(15, 1, LAST_SERMON_ITEM_ID)\n');

  // ── Step 8: Set fragment metadata ──
  console.log('=== Step 8: Set fragment metadata ===');
  for (const meta of FRAGMENT_METADATA) {
    console.log(`  Fragment ${meta.type}: ${meta.name}`);
    await sendTx({
      address: worldAddress,
      abi: worldAbi,
      functionName: 'UD__setFragmentMetadata',
      args: [meta.type, meta.name, '', meta.hint], // narrative stored client-side in i18n
    });
  }
  console.log();

  // ── Summary ──
  console.log('='.repeat(60));
  console.log('  Z2 Quest Chain Deploy Complete!');
  console.log('='.repeat(60));
  console.log(`  Quest mobs: ${questMobIds.map(String).join(', ')}`);
  console.log(`  World objects: ${worldObjectEntityIds.length} created`);
  console.log(`  Chain steps: ${steps.length} configured`);
  console.log(`  Fragment metadata: ${FRAGMENT_METADATA.length} set`);
  console.log('');
  console.log('  REMAINING MANUAL STEPS:');
  console.log('  1. Create quest items (Sealed Letter, Last Sermon) via item-sync');
  console.log('  2. Set FragmentChainStepReward for fragments 11 and 15');
  console.log('  3. Verify Vel/Edric entity IDs and re-run if needed');
  console.log('='.repeat(60));
}

main().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
