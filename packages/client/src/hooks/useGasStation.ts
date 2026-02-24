import { useCallback, useEffect, useRef } from 'react';
import { parseEther } from 'viem';

import { useCharacter } from '../contexts/CharacterContext';
import { useMUD } from '../contexts/MUDContext';

import { useToast } from './useToast';

const GAS_THRESHOLD = parseEther('0.0001'); // 0.0001 ETH
const DEFAULT_GOLD_PER_SWAP = parseEther('50'); // 50 Gold per auto-swap
const MIN_SWAP_INTERVAL_MS = 60_000; // 60 seconds client-side rate limit

/**
 * Auto-swaps Gold for ETH when the player's balance drops below a threshold.
 * Only active for level 3+ characters with Gold available.
 *
 * - Watches burnerBalance (already polled every 5s by MUDContext)
 * - When below GAS_THRESHOLD, calls UD__buyGas() with a fixed Gold amount
 * - Rate-limited to once per MIN_SWAP_INTERVAL_MS
 * - Shows a toast notification on successful swap
 */
export const useGasStation = (): void => {
  const { authMethod, burnerBalance, systemCalls } = useMUD();
  const { character } = useCharacter();
  const { renderSuccess, renderWarning } = useToast();
  const lastSwapRef = useRef(0);
  const swappingRef = useRef(false);

  const attemptSwap = useCallback(async () => {
    if (swappingRef.current) return;
    if (!character) return;

    // Only for level 3+
    if (character.level < 3n) return;

    // Check if enough Gold to swap
    if (character.externalGoldBalance < DEFAULT_GOLD_PER_SWAP) {
      // Not enough gold for a full swap — skip silently
      return;
    }

    // Client-side rate limit
    const now = Date.now();
    if (now - lastSwapRef.current < MIN_SWAP_INTERVAL_MS) return;

    swappingRef.current = true;
    lastSwapRef.current = now;

    try {
      const { success, error } = await systemCalls.buyGas(
        character.id,
        DEFAULT_GOLD_PER_SWAP,
      );

      if (success) {
        renderSuccess('Auto-swapped Gold for gas (ETH).');
      } else if (error) {
        // Don't spam errors — just log
        console.warn('[GasStation] Auto-swap failed:', error);
      }
    } catch (e) {
      console.warn('[GasStation] Auto-swap error:', e);
    } finally {
      swappingRef.current = false;
    }
  }, [character, renderSuccess, systemCalls]);

  useEffect(() => {
    // Skip for embedded users at low levels (paymaster covers them)
    if (authMethod === 'embedded' && character && character.level < 3n) return;

    // Check if ETH balance is below threshold
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
