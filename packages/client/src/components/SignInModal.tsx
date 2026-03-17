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
import { useCallback, useMemo, useState } from 'react';
import { FcGoogle } from 'react-icons/fc';
import { IoClose } from 'react-icons/io5';
import { IoCopyOutline } from 'react-icons/io5';

import { useAuth } from '../contexts/AuthContext';

/** Detect in-app browsers (Telegram, Instagram, Facebook, etc.) that block Google OAuth. */
function isEmbeddedWebView(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  return /FBAN|FBAV|Instagram|Twitter|Telegram|TelegramBot|Line\/|KAKAOTALK|MicroMessenger|wv\b/i.test(ua);
}

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
  const [copied, setCopied] = useState(false);
  const inAppBrowser = useMemo(() => isEmbeddedWebView(), []);

  const handleCopyUrl = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback — select text for manual copy
      const el = document.createElement('textarea');
      el.value = window.location.href;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, []);

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
            {inAppBrowser && (
              <Box
                bg="rgba(200, 122, 42, 0.12)"
                border="1px solid rgba(200, 122, 42, 0.3)"
                borderRadius="md"
                px={4}
                py={3}
                w="100%"
              >
                <Text color="#C87A2A" fontWeight={600} fontSize="sm" mb={1}>
                  Open in your browser
                </Text>
                <Text color="rgba(196, 184, 158, 0.7)" fontSize="xs" mb={3}>
                  Google sign-in doesn&apos;t work in app browsers.
                  Copy the link below and open it in Chrome or Safari.
                </Text>
                <Button
                  leftIcon={<IoCopyOutline />}
                  onClick={handleCopyUrl}
                  size="sm"
                  variant="outline"
                  color="#C87A2A"
                  borderColor="rgba(200, 122, 42, 0.4)"
                  w="100%"
                  _hover={{ bg: 'rgba(200, 122, 42, 0.15)' }}
                >
                  {copied ? 'Copied!' : 'Copy link'}
                </Button>
              </Box>
            )}
            <Button
              bg="white"
              border="1px solid rgba(0, 0, 0, 0.15)"
              borderRadius="4px"
              color="#3c4043"
              fontSize="17px"
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
            <Text color="#8A7E6A" fontSize="12px" textAlign="center">
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
