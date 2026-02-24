import {
  Button,
  Divider,
  HStack,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalHeader,
  ModalOverlay,
  Text,
  VStack,
} from '@chakra-ui/react';
import { useCallback, useState } from 'react';
import { IoClose } from 'react-icons/io5';

import { useAuth } from '../contexts/AuthContext';

import { ConnectWalletButton } from './ConnectWalletButton';
import { PolygonalCard } from './PolygonalCard';

export const SignInModal = ({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}): JSX.Element => {
  const {
    connectWithGoogle,
    hasInjectedWallet,
    isConnecting,
  } = useAuth();

  const [error, setError] = useState<string | null>(null);

  const handleGoogle = useCallback(async () => {
    setError(null);
    try {
      await connectWithGoogle();
      onClose();
    } catch (e) {
      setError((e as Error)?.message ?? 'Google sign-in failed');
    }
  }, [connectWithGoogle, onClose]);

  const handleClose = useCallback(() => {
    setError(null);
    onClose();
  }, [onClose]);

  return (
    <Modal isOpen={isOpen} onClose={handleClose}>
      <ModalOverlay />
      <ModalContent>
        <PolygonalCard isModal />
        <ModalHeader>Sign In to Play</ModalHeader>
        <ModalCloseButton>
          <IoClose size={30} />
        </ModalCloseButton>
        <ModalBody pb={8}>
          <VStack spacing={6}>
            <Button
              isLoading={isConnecting}
              onClick={handleGoogle}
              variant="outline"
              w="100%"
            >
              Sign in with Google
            </Button>

            {error && (
              <Text color="red.400" size="xs">
                {error}
              </Text>
            )}

            {hasInjectedWallet && (
              <>
                <HStack spacing={4} w="100%">
                  <Divider />
                  <Text color="gray.400" fontSize="xs" whiteSpace="nowrap">
                    OR
                  </Text>
                  <Divider />
                </HStack>
                <ConnectWalletButton />
              </>
            )}
          </VStack>
        </ModalBody>
      </ModalContent>
    </Modal>
  );
};
