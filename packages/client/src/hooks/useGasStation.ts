import { useCallback, useEffect, useRef } from 'react';
import { parseEther } from 'viem';

import { useCharacter } from '../contexts/CharacterContext';
import { useMUD } from '../contexts/MUDContext';

const GAS_THRESHOLD = parseEther('0.0003'); // 0.0003 ETH — swap before wallet drains
const MAX_GOLD_PER_SWAP = parseEther('100'); // Cap to avoid huge slippage
const MIN_GOLD_FOR_SWAP = parseEther('1'); // Minimum to avoid dust reverts
const MIN_SWAP_INTERVAL_MS = 30_000; // 30 seconds — Base gas is cheap, swap often

/**
 * Calculate how much gold to swap: all available up to MAX, null if below MIN.
 */
export function calculateSwapAmount(goldBalance: bigint): bigint | null {
  if (goldBalance < MIN_GOLD_FOR_SWAP) return null;
  return goldBalance > MAX_GOLD_PER_SWAP ? MAX_GOLD_PER_SWAP : goldBalance;
}

/**
 * Calculate minimum ETH output for slippage protection.
 * ~0.8e-6 ETH per Gold (80% of naive rate) — generous floor to avoid reverts.
 */
export function calculateMinEthOutput(goldAmount: bigint): bigint {
  // 800000 wei per 1e18 Gold = 0.8e-6 ETH per Gold
  return goldAmount * 800000n / 1000000000000000000n;
}

/**
 * Auto-swaps Gold for ETH when the player's balance drops below a threshold.
 * Only active for level 3+ characters with Gold available.
 *
 * - Watches burnerBalance (already polled every 15s by MUDContext)
 * - When below GAS_THRESHOLD, calls UD__buyGas() with available Gold
 * - Rate-limited to once per MIN_SWAP_INTERVAL_MS (only on success)
 */
export const useGasStation = (): void => {
  const { authMethod, burnerBalance, systemCalls } = useMUD();
  const { character } = useCharacter();
  const lastSwapRef = useRef(0);
  const swappingRef = useRef(false);

  const attemptSwap = useCallback(async () => {
    if (swappingRef.current) return;
    if (!character) return;

    // Only for level 3+
    if (character.level < 3n) return;

    // Calculate dynamic swap amount
    const swapAmount = calculateSwapAmount(character.externalGoldBalance);
    if (!swapAmount) return;

    // Client-side rate limit — only enforced after successful swaps
    const now = Date.now();
    if (now - lastSwapRef.current < MIN_SWAP_INTERVAL_MS) return;

    swappingRef.current = true;

    try {
      const minEthOutput = calculateMinEthOutput(swapAmount);
      const { success, error } = await systemCalls.buyGas(
        character.id,
        swapAmount,
        minEthOutput,
      );

      if (success) {
        lastSwapRef.current = Date.now();
      } else if (error) {
        // Don't rate-limit on failure — retry on next poll
        console.warn('[GasStation] Auto-swap failed:', error);
      }
    } catch (e) {
      // Don't rate-limit on failure — retry on next poll
      console.warn('[GasStation] Auto-swap error:', e);
    } finally {
      swappingRef.current = false;
    }
  }, [character, systemCalls]);

  useEffect(() => {
    // External (MetaMask) wallets use the relayer for gas top-ups — the on-chain
    // buyGas() sends ETH to _msgSender() which resolves to the delegator (MetaMask
    // address) via callFrom, not the burner that actually needs it. Skip to avoid
    // wasting the burner's already-low gas on a no-op.
    if (authMethod === 'external') return;

    // Embedded (Privy) wallets: auto-swap gold->ETH via on-chain buyGas().
    try {
      const balanceWei = parseEther(burnerBalance);
      if (balanceWei < GAS_THRESHOLD && balanceWei >= 0n) {
        attemptSwap();
      }
    } catch {
      // Invalid balance string — ignore
    }
  }, [authMethod, attemptSwap, burnerBalance, character]);
};
