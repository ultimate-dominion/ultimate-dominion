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
import { useCallback, useEffect } from 'react';
import { IoClose } from 'react-icons/io5';
import { useNavigate } from 'react-router-dom';
import { useWalletClient } from 'wagmi';

import { useAuth } from '../contexts/AuthContext';
import { useCharacter } from '../contexts/CharacterContext';
import { useMUD } from '../contexts/MUDContext';
import { CHARACTER_CREATION_PATH, GAME_BOARD_PATH } from '../Routes';
import { DelegationButton } from './DelegationButton';
import { PolygonalCard } from './PolygonalCard';
import { SignInModal } from './SignInModal';

export const ConnectWalletModal = ({
  isOpen,
  onClose,
  suppressNavigate = false,
}: {
  isOpen: boolean;
  onClose: () => void;
  suppressNavigate?: boolean;
}): JSX.Element => {
  const navigate = useNavigate();
  const { data: externalWalletClient } = useWalletClient();
  const { authMethod, isAuthenticated, ownerAddress } = useAuth();
  const { delegatorAddress } = useMUD();
  const { character } = useCharacter();

  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  // When user signs in via this modal, close and navigate
  useEffect(() => {
    if (!isOpen) return;

    const ready =
      (authMethod === 'embedded' && isAuthenticated) ||
      (authMethod === 'external' && delegatorAddress && isAuthenticated);

    if (!ready) return;

    handleClose();
    if (!suppressNavigate) {
      navigate(character?.locked ? GAME_BOARD_PATH : CHARACTER_CREATION_PATH);
    }
  }, [authMethod, character?.locked, delegatorAddress, isAuthenticated, isOpen, handleClose, navigate, suppressNavigate]);

  // Show SignInModal only if not authenticated yet
  if (!isAuthenticated) {
    return <SignInModal isOpen={isOpen} onClose={handleClose} />;
  }

  // Embedded path — authenticated, auto-closing above
  if (authMethod === 'embedded') {
    return (
      <Modal isOpen={isOpen} onClose={handleClose}>
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
        <VStack spacing={6}>
          <Text fontSize="sm" textAlign="center">
            A small ETH deposit is needed to cover gameplay fees.
            Your funds stay in your session and can be withdrawn anytime.
          </Text>
          <DelegationButton
            externalWalletClient={externalWalletClient}
            onClose={handleClose}
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
    <Modal isOpen={isOpen} onClose={handleClose}>
      <ModalOverlay />
      <ModalContent>
        <PolygonalCard isModal />
        <ModalHeader>
          {delegatorAddress ? 'Ready' : 'Secure Your Session'}
        </ModalHeader>
        <ModalCloseButton>
          <IoClose size={30} />
        </ModalCloseButton>
        <ModalBody>{bodyContent}</ModalBody>
      </ModalContent>
    </Modal>
  );
};
