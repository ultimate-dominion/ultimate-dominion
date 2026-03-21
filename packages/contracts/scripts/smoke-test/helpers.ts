import type { Hex, WalletClient } from "viem";
import {
  sendTx,
  readWorld,
  deployerWallet,
  publicClient,
  worldAddress,
  worldAbi,
  erc20Abi,
  sleep,
  nameToBytes32,
  uniqueName,
  Race,
  PowerSource,
  ArmorType,
  type StatsData,
} from "./setup";
import type { StarterItems } from "./discovery";

const ZERO_BYTES32 =
  "0x0000000000000000000000000000000000000000000000000000000000000000" as Hex;

// ---------------------------------------------------------------------------
// Character creation
// ---------------------------------------------------------------------------

export interface CharacterConfig {
  name?: string;
  race?: Race;
  powerSource?: PowerSource;
  armorType?: ArmorType;
  starterWeaponId: number;
  starterArmorId: number;
}

export interface CharacterResult {
  characterId: Hex;
  name: string;
  stats: StatsData;
}

/**
 * Full character creation flow:
 * mint → chooseRace → choosePowerSource → chooseStartingArmor → rollBaseStats → enterGame → spawn
 */
export async function createCharacter(
  wallet: WalletClient,
  config: CharacterConfig,
): Promise<CharacterResult> {
  const name = config.name ?? uniqueName();
  const nameBytesHex = nameToBytes32(name);
  const address = wallet.account!.address;

  // 1. Mint
  const mintHash = await sendTx(wallet, "UD__mintCharacter", [
    address,
    nameBytesHex,
    "",
  ]);
  // Derive characterId: read it from chain
  const characterId = (await readWorld("UD__getCharacterIdFromOwnerAddress", [
    address,
  ])) as Hex;

  // 2. Choose race
  await sendTx(wallet, "UD__chooseRace", [
    characterId,
    config.race ?? Race.Human,
  ]);

  // 3. Choose power source
  await sendTx(wallet, "UD__choosePowerSource", [
    characterId,
    config.powerSource ?? PowerSource.Physical,
  ]);

  // 4. Choose starting armor
  await sendTx(wallet, "UD__chooseStartingArmor", [
    characterId,
    config.armorType ?? ArmorType.Plate,
  ]);

  // 5. Roll base stats (needs a random seed, no ETH value needed on Base)
  const randomSeed = nameToBytes32(`seed_${Date.now()}`);
  await sendTx(
    wallet,
    "UD__rollBaseStats",
    [randomSeed, characterId],
    0n,
  );

  // 6. Enter game with starter items
  await sendTx(wallet, "UD__enterGame", [
    characterId,
    BigInt(config.starterWeaponId),
    BigInt(config.starterArmorId),
  ]);

  // 7. Spawn
  await sendTx(wallet, "UD__spawn", [characterId]);

  const stats = (await readWorld("UD__getStats", [characterId])) as StatsData;

  return { characterId, name, stats };
}

/**
 * Idempotent character setup: reuses existing character or creates a new one.
 * Safe for repeated test runs against the same world.
 */
export async function getOrCreateCharacter(
  wallet: WalletClient,
  config: CharacterConfig,
): Promise<CharacterResult> {
  const address = wallet.account!.address;
  const existing = (await readWorld("UD__getCharacterIdFromOwnerAddress", [
    address,
  ])) as Hex;

  if (existing !== ZERO_BYTES32) {
    const stats = (await readWorld("UD__getStats", [existing])) as StatsData;
    console.log(`[helpers] Reusing existing character ${existing} for ${address}`);
    return { characterId: existing, name: "resumed", stats };
  }

  return createCharacter(wallet, config);
}

// ---------------------------------------------------------------------------
// Navigation
// ---------------------------------------------------------------------------

export interface NavigationResult {
  combatsHad: number;
  wins: number;
  deaths: number;
  xpGained: bigint;
  goldGained: bigint;
}

/**
 * Walk Manhattan path from current position to target via autoAdventure.
 * Each step may trigger combat. Returns aggregate stats.
 */
export async function navigateTo(
  wallet: WalletClient,
  charId: Hex,
  targetX: number,
  targetY: number,
): Promise<NavigationResult> {
  const result: NavigationResult = {
    combatsHad: 0,
    wins: 0,
    deaths: 0,
    xpGained: 0n,
    goldGained: 0n,
  };

  let [currentX, currentY] = (await readWorld("UD__getEntityPosition", [
    charId,
  ])) as [number, number];

  while (currentX !== targetX || currentY !== targetY) {
    let nextX = currentX;
    let nextY = currentY;

    if (currentX < targetX) nextX = currentX + 1;
    else if (currentX > targetX) nextX = currentX - 1;
    else if (currentY < targetY) nextY = currentY + 1;
    else if (currentY > targetY) nextY = currentY - 1;

    // autoAdventure handles move + potential combat
    await sleep(5500); // respect 5s cooldown
    try {
      const hash = await sendTx(wallet, "UD__autoAdventure", [
        charId,
        nextX,
        nextY,
      ]);

      // Read the result via simulation (we already sent the tx, so read logs)
      // Since autoAdventure returns values, we need to simulate to get them
      // For now, read stats delta to infer combat
      const statsAfter = (await readWorld("UD__getStats", [
        charId,
      ])) as StatsData;

      // Update position
      [currentX, currentY] = (await readWorld("UD__getEntityPosition", [
        charId,
      ])) as [number, number];

      // Check if character died
      if (statsAfter.currentHp <= 0n) {
        result.deaths++;
        // Dead characters need to respawn
        break;
      }
    } catch (err: any) {
      const msg = err?.message ?? "";
      if (msg.includes("InEncounter")) {
        await sendTx(deployerWallet, "UD__adminClearEncounterState", [charId]);
        continue;
      }
      if (msg.includes("AutoAdventureCooldownActive") || msg.includes("MoveTooFast")) {
        await sleep(2000);
        continue;
      }
      throw err;
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Combat farming
// ---------------------------------------------------------------------------

export interface FarmResult {
  totalCombats: number;
  wins: number;
  deaths: number;
  totalXp: bigint;
  totalGold: bigint;
}

/**
 * Farm autoAdventure on adjacent tiles until target level is reached.
 * Zigzags between (x, y) and (x, y+1) to generate movement.
 * Uses rest at (0,0) when HP is critical.
 */
export async function farmToLevel(
  wallet: WalletClient,
  charId: Hex,
  targetLevel: number,
): Promise<FarmResult> {
  const result: FarmResult = {
    totalCombats: 0,
    wins: 0,
    deaths: 0,
    totalXp: 0n,
    totalGold: 0n,
  };

  let currentLevel = Number(await readWorld("UD__getLevel", [charId]));

  while (currentLevel < targetLevel) {
    const stats = (await readWorld("UD__getStats", [charId])) as StatsData;

    // If HP is low, try to rest (must be at 0,0)
    if (stats.currentHp > 0n && stats.currentHp < stats.maxHp / 3n) {
      const [px, py] = (await readWorld("UD__getEntityPosition", [
        charId,
      ])) as [number, number];
      if (px === 0 && py === 0) {
        await sendTx(wallet, "UD__rest", [charId]);
      }
    }

    // If dead, respawn
    if (stats.currentHp <= 0n) {
      result.deaths++;
      await sendTx(wallet, "UD__spawn", [charId]);
    }

    // Get current position and pick adjacent tile
    const [cx, cy] = (await readWorld("UD__getEntityPosition", [charId])) as [
      number,
      number,
    ];

    // Zigzag: if at even step go to (cx, cy+1), odd step go back
    const targetY = cy === 0 ? 1 : 0;
    const targetX = cx; // stay in same column

    await sleep(5500); // 5s cooldown
    try {
      await sendTx(wallet, "UD__autoAdventure", [
        charId,
        targetX,
        targetY,
      ]);
      result.totalCombats++;
    } catch (err: any) {
      const msg = err?.message ?? "";
      if (msg.includes("InEncounter")) {
        await sendTx(deployerWallet, "UD__adminClearEncounterState", [charId]);
        continue;
      }
      if (msg.includes("AutoAdventureCooldownActive") || msg.includes("MoveTooFast")) {
        await sleep(2000);
        continue;
      }
      // Other errors — skip this iteration
      continue;
    }

    currentLevel = Number(await readWorld("UD__getLevel", [charId]));
  }

  return result;
}

// ---------------------------------------------------------------------------
// Admin shortcuts
// ---------------------------------------------------------------------------

/**
 * Use admin to set a character's stats directly — fast-track leveling.
 */
export async function adminBoostToLevel(
  charId: Hex,
  level: number,
): Promise<void> {
  const stats = (await readWorld("UD__getStats", [charId])) as StatsData;

  // Calculate experience needed: level N requires roughly N*100 XP
  // We set it generously to avoid edge cases
  const xpNeeded = BigInt(level) * 1000n;

  const boostedStats: StatsData = {
    ...stats,
    strength: stats.strength + BigInt(level) * 2n,
    agility: stats.agility + BigInt(level) * 2n,
    intelligence: stats.intelligence + BigInt(level) * 2n,
    maxHp: stats.maxHp + BigInt(level) * 5n,
    currentHp: stats.maxHp + BigInt(level) * 5n,
    experience: xpNeeded,
    level: BigInt(level),
  };

  await sendTx(deployerWallet, "UD__adminSetStats", [charId, boostedStats]);
}

/**
 * Admin-heal a character to full HP.
 */
export async function adminHeal(charId: Hex): Promise<void> {
  const stats = (await readWorld("UD__getStats", [charId])) as StatsData;
  if (stats.currentHp < stats.maxHp) {
    const healed: StatsData = {
      ...stats,
      currentHp: stats.maxHp,
    };
    await sendTx(deployerWallet, "UD__adminSetStats", [charId, healed]);
  }
}

/**
 * Admin-drop gold to a character.
 */
export async function adminDropGold(
  charId: Hex,
  amount: bigint,
): Promise<void> {
  await sendTx(deployerWallet, "UD__adminDropGold", [charId, amount]);
}

/**
 * Admin-drop an item to a character.
 */
export async function adminDropItem(
  charId: Hex,
  itemId: number,
  amount: number = 1,
): Promise<void> {
  await sendTx(deployerWallet, "UD__adminDropItem", [
    charId,
    BigInt(itemId),
    BigInt(amount),
  ]);
}

// ---------------------------------------------------------------------------
// Gold balance reading
// ---------------------------------------------------------------------------

/**
 * Read a player's gold balance via the ERC20 puppet token.
 */
export async function getGoldBalance(
  playerAddress: string,
  goldTokenAddress: string,
): Promise<bigint> {
  return (await publicClient.readContract({
    address: goldTokenAddress as `0x${string}`,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [playerAddress as `0x${string}`],
  })) as bigint;
}
