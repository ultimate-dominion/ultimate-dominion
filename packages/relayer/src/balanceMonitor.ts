import { type Address, formatEther } from 'viem';
import { config } from './config.js';
import { gasChargingEnabled } from './config.js';
import { publicClient, sendRelayerTx } from './tx.js';
import { recordFunding } from './gasCharge.js';
import { getCharacterId, getPlayerLevel, getGoldBalance, getGoldPerGasCharge } from './chainReader.js';
import { loadLifelineCooldowns, saveLifelineCooldowns } from './persistence.js';

// ==================== State ====================

/** Tracked players: burnerAddress → delegatorAddress.
 *  For embedded wallets these are the same address.
 *  For MetaMask, burner gets the ETH, delegator gets charged gold. */
const trackedPlayers = new Map<Address, Address>();

let monitorTimer: ReturnType<typeof setInterval> | null = null;
let topUpCount = 0;
let lifelineCount = 0;
let topUpResetTimer: ReturnType<typeof setInterval> | null = null;

const MAX_TOP_UPS_PER_HOUR = 50;

// Lifeline cooldowns — persisted across restarts
let lifelineCooldowns: Map<string, number>;

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

export function getLifelineCount(): number {
  return lifelineCount;
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
 * 4. Level 3+, gold >= fee → top-up + charge gold (revenue)
 * 5. Level 3+, gold < fee, has some ETH (> lifelineMinBalance) → skip (can still play)
 * 6. Level 3+, gold < fee, near-zero ETH → LIFELINE (small amount, cooldown, no charge)
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

      // Level 3+ — check gold on the delegator address
      const goldBalance = await getGoldBalance(delegatorAddress);
      if (goldBalance === null) {
        // RPC failure — fail open, normal top-up with charge (conservative)
        await doTopUp(burnerAddress, config.fundingAmount, 'charged (gold read failed)');
        recordFunding(delegatorAddress, config.fundingAmount);
        continue;
      }

      const feeThreshold = goldPerCharge ?? 1_000_000_000_000_000_000n; // fallback 1e18

      if (goldBalance >= feeThreshold) {
        // Has enough gold to cover the fee — normal top-up + charge
        await doTopUp(burnerAddress, config.fundingAmount, 'charged');
        recordFunding(delegatorAddress, config.fundingAmount);
        continue;
      }

      // Level 3+, gold < fee — check if truly stuck
      if (ethBalance > config.lifelineMinBalance) {
        // Has some ETH, just below top-up threshold. Can still transact.
        // Don't top up — they need to earn gold from battles first.
        continue;
      }

      // Truly stuck: level 3+, gold < fee, near-zero ETH → LIFELINE
      const cooldownKey = burnerAddress.toLowerCase();
      const lastLifeline = lifelineCooldowns.get(cooldownKey);
      const now = Date.now();
      if (lastLifeline && (now - lastLifeline) < config.lifelineCooldownMs) {
        console.log(`[balanceMonitor] Skipping ${burnerAddress} — lifeline on cooldown (${Math.round((config.lifelineCooldownMs - (now - lastLifeline)) / 60_000)}min left)`);
        continue;
      }

      // Grant lifeline — smaller amount, no gold charge
      await doTopUp(burnerAddress, config.lifelineAmount, 'LIFELINE');
      lifelineCooldowns.set(cooldownKey, now);
      saveLifelineCooldowns(lifelineCooldowns);
      lifelineCount++;
      // NO recordFunding — lifeline is free, they have nothing to charge

    } catch (err) {
      console.error(`[balanceMonitor] Failed to check/top-up ${burnerAddress}:`, err);
    }
  }
}

// ==================== Lifecycle ====================

export function startBalanceMonitor(): void {
  // Load persisted lifeline cooldowns
  lifelineCooldowns = loadLifelineCooldowns();

  // Prune expired cooldowns on startup
  const now = Date.now();
  const expiry = config.lifelineCooldownMs * 2;
  for (const [addr, ts] of lifelineCooldowns) {
    if (now - ts > expiry) lifelineCooldowns.delete(addr);
  }
  if (lifelineCooldowns.size > 0) {
    saveLifelineCooldowns(lifelineCooldowns);
    console.log(`[balanceMonitor] Loaded ${lifelineCooldowns.size} active lifeline cooldowns`);
  }

  console.log(`[balanceMonitor] Starting — check every 60s, min balance ${formatEther(config.minPlayerBalance)} ETH`);
  console.log(`[balanceMonitor] Lifeline: ${formatEther(config.lifelineAmount)} ETH, cooldown ${config.lifelineCooldownMs / 3600_000}h`);

  monitorTimer = setInterval(() => {
    checkBalances().catch(err => console.error('[balanceMonitor] Error:', err));
  }, 60_000);

  // Reset top-up counter every hour
  topUpResetTimer = setInterval(() => {
    topUpCount = 0;
  }, 3_600_000);

  // Prune expired lifeline cooldowns every hour
  setInterval(() => {
    const cutoff = Date.now() - config.lifelineCooldownMs * 2;
    let pruned = 0;
    for (const [addr, ts] of lifelineCooldowns) {
      if (ts < cutoff) { lifelineCooldowns.delete(addr); pruned++; }
    }
    if (pruned > 0) {
      saveLifelineCooldowns(lifelineCooldowns);
      console.log(`[balanceMonitor] Pruned ${pruned} expired lifeline cooldowns`);
    }
  }, 3_600_000);
}

export function stopBalanceMonitor(): void {
  if (monitorTimer) { clearInterval(monitorTimer); monitorTimer = null; }
  if (topUpResetTimer) { clearInterval(topUpResetTimer); topUpResetTimer = null; }
}
