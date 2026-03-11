import { Button } from '@chakra-ui/react';
import { useCallback, useState } from 'react';
import { type Account, type Chain, parseEther, type Transport, type WalletClient } from 'viem';
import { useAccount, useSwitchChain } from 'wagmi';

import { useMUD } from '../contexts/MUDContext';
import { useToast } from '../hooks/useToast';
import { setupDelegation } from '../lib/mud/delegation';
import { getChainNameFromId, isSupportedChain } from '../lib/web3';

// 0.0005 ETH — enough for hundreds of Base transactions (~$1.50)
const SESSION_DEPOSIT = parseEther('0.0005');

export const DelegationButton = ({
  externalWalletClient,
  onClose,
}: {
  externalWalletClient: WalletClient<Transport, Chain, Account>;
  onClose?: () => void;
}): JSX.Element => {
  const { chains, switchChain } = useSwitchChain();
  const { chainId } = useAccount();
  const { burnerAddress, getBurner, getBurnerBalance, network } = useMUD();
  const { renderError, renderSuccess, renderWarning } = useToast();

  const [isDelegating, setIsDelegating] = useState(false);

  const onSetupDelegation = useCallback(async () => {
    try {
      if (!setupDelegation) {
        throw new Error('Delegation setup function not available.');
      }

      if (!network) {
        throw new Error('Network not available.');
      }

      setIsDelegating(true);

      // Step 1: Delegation TX (MetaMask popup #1)
      await setupDelegation(network, externalWalletClient, burnerAddress);

      // Step 2: Fund the session wallet (MetaMask popup #2)
      // If this fails (user rejects or has no ETH), delegation still succeeded.
      try {
        const depositTx = await externalWalletClient.sendTransaction({
          to: burnerAddress,
          value: SESSION_DEPOSIT,
          gas: 21000n,
        });
        await network.waitForTransaction(depositTx);
      } catch (depositErr) {
        console.warn('[DelegationButton] Auto-deposit failed:', depositErr);
        renderWarning('Session authorized but funding skipped. You can deposit ETH from the settings menu.');
      }

      renderSuccess('Game account ready!');

      // getBurner(true) must complete before the modal closes — it sets
      // delegatorAddress, which triggers ConnectWalletModal's navigation
      // effect. forceCreate=true skips the redundant on-chain delegation
      // check (the TX was just confirmed above).
      await getBurner(true);

      // Register burner→delegator with relayer for gas monitoring.
      // The relayer will track this burner and auto-fund when low,
      // charging gold from the delegator (MetaMask wallet).
      const relayerUrl = import.meta.env.VITE_RELAYER_URL;
      const fundApiKey = import.meta.env.VITE_FUND_API_KEY;
      if (relayerUrl && fundApiKey) {
        fetch(`${relayerUrl}/fund`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': fundApiKey,
          },
          body: JSON.stringify({
            address: burnerAddress,
            delegatorAddress: externalWalletClient.account.address,
          }),
        }).catch(err => console.warn('[DelegationButton] Relayer registration failed:', err));
      }

      // Force an immediate balance refresh so App.tsx doesn't flash
      // the WalletDetailsModal for a stale '0' balance.
      getBurnerBalance();
    } catch (e) {
      renderError((e as Error)?.message ?? 'Failed to delegate.', e);
    } finally {
      setIsDelegating(false);
    }
  }, [
    burnerAddress,
    externalWalletClient,
    getBurner,
    getBurnerBalance,
    network,
    renderError,
    renderSuccess,
    renderWarning,
  ]);

  if (!isSupportedChain(chainId)) {
    return (
      <Button onClick={() => switchChain({ chainId: chains[0].id })}>
        Switch to {getChainNameFromId(chains[0].id)}
      </Button>
    );
  }

  return (
    <Button
      isLoading={isDelegating}
      loadingText="Setting up..."
      onClick={onSetupDelegation}
    >
      Authorize & Play
    </Button>
  );
};
