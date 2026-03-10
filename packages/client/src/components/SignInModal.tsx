import {
  Box,
  Button,
  Divider,
  HStack,
  Link,
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
import { FcGoogle } from 'react-icons/fc';
import { IoClose } from 'react-icons/io5';

import { useAuth } from '../contexts/AuthContext';

import { ConnectWalletButton } from './ConnectWalletButton';
import { PolygonalCard } from './PolygonalCard';

export const SignInModal = ({
  isOpen,
  onClose,
  onChooseWallet,
}: {
  isOpen: boolean;
  onClose: () => void;
  onChooseWallet?: () => void;
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
      // Don't close here — ConnectWalletModal's effect detects auth
      // and handles navigation + close. Closing here races with that
      // effect and can leave the user on the Welcome page with no
      // loading feedback while MUD sync finishes.
    } catch (e) {
      setError((e as Error)?.message ?? 'Google sign-in failed');
    }
  }, [connectWithGoogle]);

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
              bg="white"
              border="1px solid rgba(0, 0, 0, 0.15)"
              borderRadius="4px"
              color="#3c4043"
              fontSize="15px"
              fontWeight={500}
              h="48px"
              isLoading={isConnecting}
              leftIcon={<FcGoogle size={22} />}
              onClick={handleGoogle}
              variant="unstyled"
              w="100%"
              display="flex"
              alignItems="center"
              justifyContent="center"
              _hover={{
                bg: '#f8f9fa',
                boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
              }}
              _active={{
                bg: '#f1f3f4',
              }}
            >
              Continue with Google
            </Button>

            {error && (
              <Text color="red" size="xs">
                {error}
              </Text>
            )}

            {hasInjectedWallet && (
              <Box onClick={onChooseWallet} w="100%">
                <VStack spacing={6}>
                  <HStack spacing={4} w="100%">
                    <Divider />
                    <Text color="#8A7E6A" fontSize="xs" whiteSpace="nowrap">
                      OR
                    </Text>
                    <Divider />
                  </HStack>
                  <ConnectWalletButton />
                </VStack>
              </Box>
            )}
            <Text color="#8A7E6A" fontSize="10px" textAlign="center">
              By signing in you agree to the{' '}
              <Link href="https://ultimatedominion.com/terms" isExternal color="#C4B89E" textDecoration="underline">
                Terms of Service
              </Link>{' '}
              and{' '}
              <Link href="https://ultimatedominion.com/privacy" isExternal color="#C4B89E" textDecoration="underline">
                Privacy Policy
              </Link>
            </Text>
          </VStack>
        </ModalBody>
      </ModalContent>
    </Modal>
  );
};
