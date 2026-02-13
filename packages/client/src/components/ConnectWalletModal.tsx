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
import { useEffect } from 'react';
import { IoClose } from 'react-icons/io5';
import { useWalletClient } from 'wagmi';

import { useAuth } from '../contexts/AuthContext';
import { useMUD } from '../contexts/MUDContext';
import { shortenAddress } from '../utils/helpers';

import { CopyText } from './CopyText';
import { DelegationButton } from './DelegationButton';
import { PolygonalCard } from './PolygonalCard';
import { SignInModal } from './SignInModal';

export const ConnectWalletModal = ({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}): JSX.Element => {
  const { data: externalWalletClient } = useWalletClient();
  const { authMethod, isAuthenticated, ownerAddress } = useAuth();
  const { burnerAddress, delegatorAddress } = useMUD();

  // Auto-close when fully set up
  useEffect(() => {
    if (authMethod === 'embedded' && isAuthenticated) {
      onClose();
    }
    if (authMethod === 'external' && delegatorAddress && isAuthenticated) {
      onClose();
    }
  }, [authMethod, delegatorAddress, isAuthenticated, onClose]);

  // Not authenticated at all — show SignInModal
  if (!isAuthenticated) {
    return <SignInModal isOpen={isOpen} onClose={onClose} />;
  }

  // Embedded path — authenticated, auto-closing above
  if (authMethod === 'embedded') {
    return (
      <Modal isOpen={isOpen} onClose={onClose}>
        <ModalOverlay />
        <ModalContent>
          <PolygonalCard isModal />
          <ModalHeader>Signing In...</ModalHeader>
          <ModalCloseButton>
            <IoClose size={30} />
          </ModalCloseButton>
          <ModalBody>
            <Text textAlign="center">Setting up your account...</Text>
          </ModalBody>
        </ModalContent>
      </Modal>
    );
  }

  // External path — connected but needs delegation
  const bodyContent = (() => {
    if (ownerAddress && externalWalletClient) {
      return (
        <VStack spacing={10}>
          <VStack fontWeight={500} spacing={4}>
            <Text size="sm" textAlign="center">
              Connected account:
            </Text>
            <CopyText text={ownerAddress}>
              <Text fontWeight={700} textAlign="center">
                {shortenAddress(ownerAddress)}
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
        <Text textAlign="center">Connecting wallet...</Text>
      </VStack>
    );
  })();

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <ModalOverlay />
      <ModalContent>
        <PolygonalCard isModal />
        <ModalHeader>
          {delegatorAddress ? 'Delegated' : 'Delegate Account'}
        </ModalHeader>
        <ModalCloseButton>
          <IoClose size={30} />
        </ModalCloseButton>
        <ModalBody>{bodyContent}</ModalBody>
      </ModalContent>
    </Modal>
  );
};
