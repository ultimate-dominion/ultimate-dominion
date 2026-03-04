import { Button } from '@chakra-ui/react';
import { useCallback, useState } from 'react';
import type { Account, Chain, Transport, WalletClient } from 'viem';
import { useAccount, useSwitchChain } from 'wagmi';

import { useMUD } from '../contexts/MUDContext';
import { useToast } from '../hooks/useToast';
import { setupDelegation } from '../lib/mud/delegation';
import { getChainNameFromId, isSupportedChain } from '../lib/web3';

export const DelegationButton = ({
  externalWalletClient,
  onClose,
}: {
  externalWalletClient: WalletClient<Transport, Chain, Account>;
  onClose?: () => void;
}): JSX.Element => {
  const { chains, switchChain } = useSwitchChain();
  const { chainId } = useAccount();
  const { burnerAddress, getBurner, network } = useMUD();
  const { renderError, renderSuccess } = useToast();

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
      await setupDelegation(network, externalWalletClient, burnerAddress);

      renderSuccess('Game account ready!');

      // getBurner() must complete before onClose() — it sets delegatorAddress,
      // which triggers ConnectWalletModal's navigation effect. If the modal
      // closes first (isOpen=false), the effect short-circuits and navigation
      // never happens.
      await getBurner();
    } catch (e) {
      renderError((e as Error)?.message ?? 'Failed to delegate.', e);
    } finally {
      setIsDelegating(false);
    }
  }, [
    burnerAddress,
    externalWalletClient,
    getBurner,
    network,
    renderError,
    renderSuccess,
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
