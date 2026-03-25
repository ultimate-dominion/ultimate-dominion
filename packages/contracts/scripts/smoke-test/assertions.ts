import { expect } from "vitest";
import type { Hex } from "viem";
import {
  readWorld,
  publicClient,
  erc20Abi,
  type StatsData,
} from "./setup";

// ---------------------------------------------------------------------------
// On-chain state assertions
// ---------------------------------------------------------------------------

/**
 * Assert character exists and is valid.
 */
export async function assertCharacterValid(charId: Hex): Promise<void> {
  const isValid = await readWorld("UD__isValidCharacterId", [charId]);
  expect(isValid).toBe(true);
}

/**
 * Assert character is at a specific position.
 */
export async function assertPosition(
  charId: Hex,
  expectedX: number,
  expectedY: number,
): Promise<void> {
  const [x, y] = (await readWorld("UD__getEntityPosition", [charId])) as [
    number,
    number,
  ];
  expect(x).toBe(expectedX);
  expect(y).toBe(expectedY);
}

/**
 * Assert character level.
 */
export async function assertLevel(
  charId: Hex,
  expectedLevel: number,
): Promise<void> {
  const level = (await readWorld("UD__getLevel", [charId])) as bigint;
  expect(Number(level)).toBe(expectedLevel);
}

/**
 * Assert character level is at least minLevel.
 */
export async function assertLevelAtLeast(
  charId: Hex,
  minLevel: number,
): Promise<void> {
  const level = (await readWorld("UD__getLevel", [charId])) as bigint;
  expect(Number(level)).toBeGreaterThanOrEqual(minLevel);
}

/**
 * Assert stats are non-zero (character has been rolled).
 */
export async function assertStatsNonZero(charId: Hex): Promise<void> {
  const stats = (await readWorld("UD__getStats", [charId])) as StatsData;
  expect(stats.strength).not.toBe(0n);
  expect(stats.agility).not.toBe(0n);
  expect(stats.intelligence).not.toBe(0n);
  expect(stats.maxHp).toBeGreaterThan(0n);
  expect(stats.currentHp).toBeGreaterThan(0n);
}

/**
 * Assert HP is within expected range.
 */
export async function assertHpInRange(
  charId: Hex,
  minHp: bigint,
  maxHp: bigint,
): Promise<void> {
  const stats = (await readWorld("UD__getStats", [charId])) as StatsData;
  expect(stats.currentHp).toBeGreaterThanOrEqual(minHp);
  expect(stats.currentHp).toBeLessThanOrEqual(maxHp);
}

/**
 * Assert gold balance (ERC20) is at least the given amount.
 */
export async function assertGoldAtLeast(
  playerAddress: string,
  goldTokenAddress: string,
  minGold: bigint,
): Promise<void> {
  const balance = (await publicClient.readContract({
    address: goldTokenAddress as `0x${string}`,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [playerAddress as `0x${string}`],
  })) as bigint;
  expect(balance).toBeGreaterThanOrEqual(minGold);
}

/**
 * Assert gold balance equals expected amount.
 */
export async function assertGoldEquals(
  playerAddress: string,
  goldTokenAddress: string,
  expected: bigint,
): Promise<void> {
  const balance = (await publicClient.readContract({
    address: goldTokenAddress as `0x${string}`,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [playerAddress as `0x${string}`],
  })) as bigint;
  expect(balance).toBe(expected);
}

/**
 * Assert a player owns at least `minAmount` of an item.
 */
export async function assertItemBalance(
  charId: Hex,
  itemId: number,
  minAmount: number = 1,
): Promise<void> {
  const balance = (await readWorld("UD__getItemBalance", [
    charId,
    BigInt(itemId),
  ])) as bigint;
  expect(Number(balance)).toBeGreaterThanOrEqual(minAmount);
}

/**
 * Assert an item is equipped.
 */
export async function assertEquipped(
  charId: Hex,
  itemId: number,
  expected: boolean = true,
): Promise<void> {
  const equipped = await readWorld("UD__isEquipped", [
    charId,
    BigInt(itemId),
  ]);
  expect(equipped).toBe(expected);
}

/**
 * Assert experience has increased from a baseline.
 */
export async function assertXpIncreased(
  charId: Hex,
  baseline: bigint,
): Promise<void> {
  const xp = (await readWorld("UD__getExperience", [charId])) as bigint;
  expect(xp).toBeGreaterThan(baseline);
}

/**
 * Assert advanced class is set.
 */
export async function assertAdvancedClass(
  charId: Hex,
  expectedClass: number,
): Promise<void> {
  const stats = (await readWorld("UD__getStats", [charId])) as StatsData;
  expect(stats.advancedClass).toBe(expectedClass);
  expect(stats.hasSelectedAdvancedClass).toBe(true);
}

/**
 * Read and return current stats for comparison.
 */
export async function getStats(charId: Hex): Promise<StatsData> {
  return (await readWorld("UD__getStats", [charId])) as StatsData;
}

/**
 * Read current gold balance.
 */
export async function getGold(
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
