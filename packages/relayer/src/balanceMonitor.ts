import { type Address, formatEther } from 'viem';
import { config } from './config.js';
import { gasChargingEnabled } from './config.js';
import { publicClient, sendRelayerTx } from './tx.js';
import { callFundAndCharge } from './gasCharge.js';
import { getCharacterId, getPlayerLevel, getGoldPerGasCharge } from './chainReader.js';

// ==================== State ====================

/** Tracked players: burnerAddress → delegatorAddress.
 *  For embedded wallets these are the same address.
 *  For MetaMask, burner gets the ETH, delegator gets charged gold. */
const trackedPlayers = new Map<Address, Address>();

let monitorTimer: ReturnType<typeof setInterval> | null = null;
let topUpCount = 0;
let topUpResetTimer: ReturnType<typeof setInterval> | null = null;

const MAX_TOP_UPS_PER_HOUR = 50;

// ==================== Public API ====================

/** Track a player for balance monitoring.
 *  @param burnerAddress Address that needs ETH (gets funded)
 *  @param delegatorAddress Address that owns the character / holds gold (gets charged) */
export function trackPlayer(burnerAddress: Address, delegatorAddress: Address): void {
  trackedPlayers.set(burnerAddress, delegatorAddress);
}

/** Backward compat — track an address where burner === delegator (embedded wallets) */
export function trackFundedAddress(address: Address): void {
  trackedPlayers.set(address, address);
}

export function getFundedCount(): number {
  return trackedPlayers.size;
}

// ==================== Core Logic ====================

async function doTopUp(address: Address, amount: bigint, reason: string): Promise<void> {
  const txHash = await sendRelayerTx({ to: address, value: amount });
  topUpCount++;
  console.log(`[balanceMonitor] Top-up ${address} (${formatEther(amount)} ETH) [${reason}] tx: ${txHash}`);
}

/**
 * Check all tracked players and apply the funding decision tree:
 *
 * 1. ETH >= minPlayerBalance → skip (has gas)
 * 2. No character → free top-up (new player)
 * 3. Level < 3 → free top-up (onboarding)
 * 4. Level 3+ → top-up + charge gold (batchCharge handles partial/zero gold)
 */
async function checkBalances(): Promise<void> {
  if (trackedPlayers.size === 0) return;

  // Pre-fetch the on-chain fee amount (cached 5 min)
  const goldPerCharge = gasChargingEnabled ? await getGoldPerGasCharge() : null;

  for (const [burnerAddress, delegatorAddress] of trackedPlayers) {
    if (topUpCount >= MAX_TOP_UPS_PER_HOUR) {
      console.warn('[balanceMonitor] Hit hourly top-up limit, skipping remaining');
      break;
    }

    try {
      const ethBalance = await publicClient.getBalance({ address: burnerAddress });
      if (ethBalance >= config.minPlayerBalance) continue; // Has enough ETH

      // --- Level gating ---

      // If gas charging not configured, free top-up for everyone (backward compat)
      if (!gasChargingEnabled) {
        await doTopUp(burnerAddress, config.fundingAmount, 'free (gas charging disabled)');
        continue;
      }

      // Look up character from the delegator address (the wallet that owns the character)
      const characterId = await getCharacterId(delegatorAddress);
      if (!characterId) {
        // No character yet — new player, free top-up
        await doTopUp(burnerAddress, config.fundingAmount, 'free (no character)');
        continue;
      }

      // Read level
      const level = await getPlayerLevel(characterId);
      if (level === null) {
        // RPC failure — fail open, free top-up
        await doTopUp(burnerAddress, config.fundingAmount, 'free (level read failed)');
        continue;
      }

      if (level < 3n) {
        // Below level 3 — free gas
        await doTopUp(burnerAddress, config.fundingAmount, 'free (level < 3)');
        continue;
      }

      // Level 3+ — always top up, charge Gold if they can afford it.
      // Never leave a player stranded — they'll earn Gold from the next battle.
      await doTopUp(burnerAddress, config.fundingAmount, goldPerCharge ? 'charged' : 'free (no charge config)');

      // Charge Gold atomically on-chain
      if (goldPerCharge) {
        callFundAndCharge(delegatorAddress).catch(err =>
          console.error(`[balanceMonitor] fundAndCharge failed for ${delegatorAddress}:`, err)
        );
      }

    } catch (err) {
      console.error(`[balanceMonitor] Failed to check/top-up ${burnerAddress}:`, err);
    }
  }
}

// ==================== Lifecycle ====================

export function startBalanceMonitor(): void {
  console.log(`[balanceMonitor] Starting — check every 60s, min balance ${formatEther(config.minPlayerBalance)} ETH`);

  monitorTimer = setInterval(() => {
    checkBalances().catch(err => console.error('[balanceMonitor] Error:', err));
  }, 60_000);

  // Reset top-up counter every hour
  topUpResetTimer = setInterval(() => {
    topUpCount = 0;
  }, 3_600_000);
}

export function stopBalanceMonitor(): void {
  if (monitorTimer) { clearInterval(monitorTimer); monitorTimer = null; }
  if (topUpResetTimer) { clearInterval(topUpResetTimer); topUpResetTimer = null; }
}
