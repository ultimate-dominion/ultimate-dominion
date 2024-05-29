import {
  Button,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalHeader,
  ModalOverlay,
  Text,
  VStack,
} from '@chakra-ui/react';
import { useEffect, useMemo } from 'react';
import type { Account, Chain, Hex, Transport, WalletClient } from 'viem';
import { useAccount, useSwitchChain, useWalletClient } from 'wagmi';

import { useMUD } from '../contexts/MUDContext';
import { useDelegation } from '../hooks/useDelegation';
import { type Burner, createBurner } from '../lib/mud/createBurner';
import { ConnectWalletButton } from './ConnectWalletButton';

export const ConnectWalletModal = ({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}): JSX.Element => {
  const { data: externalWalletClient } = useWalletClient();
  const { isConnected, address } = useAccount();
  const { delegatorAddress, setBurnerWithCleanup } = useMUD();

  const bodyContent = useMemo(() => {
    if (externalWalletClient && delegatorAddress) {
      return (
        <VStack p={4} spacing={10}>
          <Button onClick={onClose}>Continue</Button>
          <DelegationButton
            externalWalletClient={externalWalletClient}
            setBurner={setBurnerWithCleanup}
          />
        </VStack>
      );
    }

    if (address && externalWalletClient && isConnected) {
      return (
        <VStack p={4} spacing={10}>
          <VStack spacing={4}>
            <Text size="sm" textAlign="center">
              Connected account:
            </Text>
            <Text textAlign="center">
              {address.slice(0, 6)}...{address.slice(-4)}
            </Text>
            <Text size="sm" textAlign="center">
              In order to play, you must delegate in-game power to a session
              account.
            </Text>
            <Text size="sm" textAlign="center">
              A session account is a private key stored in your browser&apos;s
              local storage. It allows you to play games without having to
              confirm transactions, but is less secure.
            </Text>
            <Text fontWeight={700} size="sm" textAlign="center">
              Do not deposit any funds into this account that you are not
              willing to lose.
            </Text>
          </VStack>
          <DelegationButton
            externalWalletClient={externalWalletClient}
            setBurner={setBurnerWithCleanup}
          />
        </VStack>
      );
    }

    return (
      <VStack p={4} spacing={10}>
        <Text textAlign="center">Connect your wallet to play.</Text>
        <ConnectWalletButton />
      </VStack>
    );
  }, [
    address,
    externalWalletClient,
    delegatorAddress,
    isConnected,
    onClose,
    setBurnerWithCleanup,
  ]);

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>
          {isConnected ? 'Delegate Account' : 'Connect Wallet'}
        </ModalHeader>
        <ModalCloseButton />
        <ModalBody>{bodyContent}</ModalBody>
      </ModalContent>
    </Modal>
  );
};

export type SetBurnerProps = { setBurner: (burner: Burner) => () => void };

const DelegationButton = ({
  externalWalletClient,
  setBurner,
}: SetBurnerProps & {
  externalWalletClient: WalletClient<Transport, Chain, Account>;
}) => {
  const { chains, switchChain } = useSwitchChain();
  const { chainId } = useAccount();
  const { status, setupDelegation } = useDelegation(externalWalletClient);

  const wrongNetwork = useMemo(() => {
    if (!chainId) return true;
    const chainIds = chains.map(chain => chain.id);
    return !chainIds.includes(chainId);
  }, [chainId, chains]);

  if (wrongNetwork) {
    return (
      <Button onClick={() => switchChain({ chainId: chains[0].id })}>
        Wrong Network
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

  return <Button onClick={setupDelegation}>Delegate</Button>;
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
