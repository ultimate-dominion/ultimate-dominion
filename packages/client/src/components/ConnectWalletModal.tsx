import {
  Alert,
  AlertIcon,
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
import { IoClose } from 'react-icons/io5';
import { useAccount, useWalletClient } from 'wagmi';

import { useMUD } from '../contexts/MUDContext';
import { shortenAddress } from '../utils/helpers';
import { ConnectWalletButton } from './ConnectWalletButton';
import { CopyText } from './CopyText';
import { DelegationButton } from './DelegationButton';
import { PolygonalCard } from './PolygonalCard';

export const ConnectWalletModal = ({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}): JSX.Element => {
  const { data: externalWalletClient } = useWalletClient();
  const { isConnected, address, chainId } = useAccount();
  const { burnerAddress, delegatorAddress } = useMUD();

  useEffect(() => {
    if (delegatorAddress && isConnected) {
      onClose();
    }
  }, [delegatorAddress, isConnected, onClose]);

  const bodyContent = useMemo(() => {
    if (address && externalWalletClient && isConnected) {
      return (
        <VStack spacing={10}>
          <VStack fontWeight={500} spacing={4}>
            {chainId == 17069 && (
              <Alert status="info">
                <AlertIcon />
                <Text size="xs">
                  If you don&apos;t have Garnet Holesky native tokens, you will
                  be automatically sent some from a faucet to make this
                  transaction
                </Text>
              </Alert>
            )}
            <Text size="sm" textAlign="center">
              Connected account:
            </Text>
            <CopyText text={address}>
              <Text fontWeight={700} textAlign="center">
                {shortenAddress(address)}
              </Text>
            </CopyText>
            <Text size="sm" textAlign="center">
              In order to play, you must delegate in-game power to a session
              account.
            </Text>
            <Text size="sm" textAlign="center">
              A session account is a private key stored in your browser&apos;s
              local storage. It allows you to play games without having to
              confirm transactions, but is less secure.
            </Text>
            <Text size="sm" textAlign="center">
              Your session account:
            </Text>
            <CopyText text={burnerAddress}>
              <Text fontWeight={700} textAlign="center">
                {shortenAddress(burnerAddress)}
              </Text>
            </CopyText>
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
      <VStack spacing={10}>
        <Text textAlign="center">Connect your wallet to play.</Text>

        <ConnectWalletButton />
      </VStack>
    );
  }, [
    address,
    burnerAddress,
    chainId,
    externalWalletClient,
    isConnected,
    onClose,
  ]);

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <ModalOverlay />
      <ModalContent>
        <PolygonalCard isModal />
        <ModalHeader>
          {isConnected ? 'Delegate Account' : 'Connect Wallet'}
        </ModalHeader>
        <ModalCloseButton>
          <IoClose size={30} />
        </ModalCloseButton>
        <ModalBody>{bodyContent}</ModalBody>
      </ModalContent>
    </Modal>
  );
};
