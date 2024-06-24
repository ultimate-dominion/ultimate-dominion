import {
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalHeader,
  ModalOverlay,
  Text,
  VStack,
} from '@chakra-ui/react';
import { useMemo } from 'react';
import { useAccount, useWalletClient } from 'wagmi';

import { ConnectWalletButton } from './ConnectWalletButton';
import { DelegationButton } from './DelegationButton';

export const ConnectWalletModal = ({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}): JSX.Element => {
  const { data: externalWalletClient } = useWalletClient();
  const { isConnected, address } = useAccount();

  const bodyContent = useMemo(() => {
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
            onClose={onClose}
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
  }, [address, externalWalletClient, isConnected, onClose]);

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
