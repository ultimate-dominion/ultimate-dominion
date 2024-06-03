import { Button } from '@chakra-ui/react';
import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
  const navigate = useNavigate();
  const { chains, switchChain } = useSwitchChain();
  const { chainId } = useAccount();
  const { burnerAddress, network } = useMUD();
  const { renderError, renderSuccess } = useToast();

  const [isDelegating, setIsDelegating] = useState(false);

  const onSetupDelegation = useCallback(async () => {
    try {
      if (!setupDelegation) {
        throw new Error('Delegation setup function not available');
      }

      if (!network) {
        throw new Error('Network not available');
      }

      setIsDelegating(true);
      await setupDelegation(network, externalWalletClient, burnerAddress);

      renderSuccess('Delegation successful');

      if (onClose) {
        onClose();
      }

      navigate('/character-creation');
    } catch (error) {
      renderError(error, 'Failed to delegate');
    } finally {
      setIsDelegating(false);
    }
  }, [
    burnerAddress,
    externalWalletClient,
    navigate,
    network,
    onClose,
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
      loadingText="Delegating..."
      onClick={onSetupDelegation}
    >
      Delegate
    </Button>
  );
};
