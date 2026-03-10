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
import { useCallback, useEffect, useState } from 'react';
import { IoClose } from 'react-icons/io5';
import { useNavigate } from 'react-router-dom';
import { useDisconnect, useWalletClient } from 'wagmi';

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
  const { disconnect } = useDisconnect();
  const [showSignIn, setShowSignIn] = useState(false);

  const handleClose = useCallback(() => {
    setShowSignIn(false);
    onClose();
  }, [onClose]);

  const handleSwitchToGoogle = useCallback(() => {
    disconnect();
    setShowSignIn(true);
  }, [disconnect]);

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

  // Show SignInModal if not authenticated, or if user chose to switch from MetaMask
  if (!isAuthenticated || showSignIn) {
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
          <Text
            color="#8A7E6A"
            cursor="pointer"
            fontSize="xs"
            onClick={handleSwitchToGoogle}
            textAlign="center"
            _hover={{ color: '#C4B89E' }}
          >
            Use Google sign-in instead
          </Text>
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
