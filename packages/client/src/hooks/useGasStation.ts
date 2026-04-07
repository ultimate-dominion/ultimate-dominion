import { useCallback, useEffect, useRef } from 'react';
import { parseEther } from 'viem';

import { useMUD } from '../contexts/MUDContext';

export const RELAYER_FUND_THRESHOLD = parseEther('0.00005');
const MIN_RELAYER_FUND_INTERVAL_MS = 15_000;

export function shouldRequestRelayerFunding(balanceWei: bigint): boolean {
  return balanceWei >= 0n && balanceWei < RELAYER_FUND_THRESHOLD;
}

/**
 * Embedded wallets should get gas from the relayer / hidden reserve, not by
 * auto-selling visible Gold. External burners already use a separate relayer path.
 */
export const useGasStation = (): void => {
  const { authMethod, burnerAddress, burnerBalance } = useMUD();
  const relayerUrl = import.meta.env.VITE_RELAYER_URL;
  const fundApiKey = import.meta.env.VITE_FUND_API_KEY;

  const lastFundAttemptRef = useRef(0);
  const fundingRef = useRef(false);

  const requestRelayerFund = useCallback(async () => {
    if (fundingRef.current) return;
    if (authMethod !== 'embedded') return;
    if (!relayerUrl || !fundApiKey) return;

    const now = Date.now();
    if (now - lastFundAttemptRef.current < MIN_RELAYER_FUND_INTERVAL_MS) return;

    fundingRef.current = true;
    lastFundAttemptRef.current = now;

    try {
      const res = await fetch(`${relayerUrl}/fund`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': fundApiKey,
        },
        body: JSON.stringify({ address: burnerAddress }),
      });

      if (!res.ok) {
        let detail = `status ${res.status}`;
        try {
          const data = await res.json();
          detail = data?.error ?? data?.status ?? detail;
        } catch {
          // Ignore non-JSON error payloads.
        }
        console.warn('[GasStation] Relayer fund failed:', detail);
      }
    } catch (err) {
      console.warn('[GasStation] Relayer fund error:', err);
    } finally {
      fundingRef.current = false;
    }
  }, [authMethod, burnerAddress, fundApiKey, relayerUrl]);

  useEffect(() => {
    if (authMethod !== 'embedded') return;
    if (!relayerUrl || !fundApiKey) return;

    try {
      const balanceWei = parseEther(burnerBalance);
      if (shouldRequestRelayerFunding(balanceWei)) {
        void requestRelayerFund();
      }
    } catch {
      // Invalid balance string — ignore
    }
  }, [authMethod, burnerBalance, fundApiKey, relayerUrl, requestRelayerFund]);
};
