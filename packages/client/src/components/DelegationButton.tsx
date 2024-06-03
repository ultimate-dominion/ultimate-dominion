import { Button } from '@chakra-ui/react';
import { useCallback, useEffect, useState } from 'react';
import type { Account, Chain, Hex, Transport, WalletClient } from 'viem';
import { useAccount, useSwitchChain } from 'wagmi';

import { useMUD } from '../contexts/MUDContext';
import { useDelegation } from '../hooks/useDelegation';
import { useToast } from '../hooks/useToast';
import { type Burner, createBurner } from '../lib/mud/createBurner';
import { getChainNameFromId, isSupportedChain } from '../lib/web3';

export type SetBurnerProps = { setBurner: (burner: Burner) => () => void };

export const DelegationButton = ({
  externalWalletClient,
  onClose,
  setBurner,
}: SetBurnerProps & {
  externalWalletClient: WalletClient<Transport, Chain, Account>;
  onClose?: () => void;
}): JSX.Element => {
  const { chains, switchChain } = useSwitchChain();
  const { chainId } = useAccount();
  const { status, setupDelegation } = useDelegation(externalWalletClient);
  const { renderError, renderSuccess } = useToast();

  const [isDelegating, setIsDelegating] = useState(false);

  const onSetupDelegation = useCallback(async () => {
    try {
      if (!setupDelegation) {
        throw new Error('Delegation setup function not available');
      }

      setIsDelegating(true);
      await setupDelegation();

      renderSuccess('Delegation successful');

      if (onClose) {
        onClose();
      }
    } catch (error) {
      renderError(error, 'Failed to delegate');
    } finally {
      setIsDelegating(false);
    }
  }, [onClose, renderError, renderSuccess, setupDelegation]);

  if (!isSupportedChain(chainId)) {
    return (
      <Button onClick={() => switchChain({ chainId: chains[0].id })}>
        Switch to {getChainNameFromId(chains[0].id)}
      </Button>
    );
  }

  if (status === 'delegated') {
    return (
      <SetBurner
        externalWalletAccountAddress={externalWalletClient.account.address}
        setBurner={setBurner}
      />
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

const SetBurner = ({
  externalWalletAccountAddress,
  setBurner,
}: SetBurnerProps & { externalWalletAccountAddress: Hex }) => {
  const { network } = useMUD();

  useEffect(
    () => setBurner(createBurner(network, externalWalletAccountAddress)),
    [externalWalletAccountAddress, network, setBurner],
  );

  return null;
};
