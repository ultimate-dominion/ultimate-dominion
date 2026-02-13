import {
  Button,
  Divider,
  HStack,
  Input,
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
    connectWithApple,
    connectWithEmail,
    hasInjectedWallet,
    isConnecting,
    pendingEmailVerification,
    verifyOtp,
  } = useAuth();

  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [showEmailInput, setShowEmailInput] = useState(false);

  const handleGoogle = useCallback(async () => {
    setError(null);
    try {
      await connectWithGoogle();
      onClose();
    } catch (e) {
      setError((e as Error)?.message ?? 'Google sign-in failed');
    }
  }, [connectWithGoogle, onClose]);

  const handleApple = useCallback(async () => {
    setError(null);
    try {
      await connectWithApple();
      onClose();
    } catch (e) {
      setError((e as Error)?.message ?? 'Apple sign-in failed');
    }
  }, [connectWithApple, onClose]);

  const handleEmailSubmit = useCallback(async () => {
    setError(null);
    if (!email.trim()) {
      setError('Please enter your email address');
      return;
    }
    try {
      await connectWithEmail(email.trim());
    } catch (e) {
      setError((e as Error)?.message ?? 'Failed to send verification code');
    }
  }, [connectWithEmail, email]);

  const handleOtpSubmit = useCallback(async () => {
    setError(null);
    if (!otp.trim()) {
      setError('Please enter the verification code');
      return;
    }
    try {
      await verifyOtp(otp.trim());
      onClose();
    } catch (e) {
      setError((e as Error)?.message ?? 'Verification failed');
    }
  }, [onClose, otp, verifyOtp]);

  const handleClose = useCallback(() => {
    setEmail('');
    setOtp('');
    setError(null);
    setShowEmailInput(false);
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
          {pendingEmailVerification ? (
            <VStack spacing={6}>
              <Text textAlign="center" size="sm">
                Enter the verification code sent to {email}
              </Text>
              <Input
                onChange={e => setOtp(e.target.value)}
                placeholder="Verification code"
                value={otp}
              />
              {error && (
                <Text color="red.400" size="xs">
                  {error}
                </Text>
              )}
              <Button
                isLoading={isConnecting}
                onClick={handleOtpSubmit}
                w="100%"
              >
                Verify
              </Button>
            </VStack>
          ) : (
            <VStack spacing={6}>
              <Button
                isLoading={isConnecting}
                onClick={handleGoogle}
                variant="outline"
                w="100%"
              >
                Sign in with Google
              </Button>
              <Button
                isLoading={isConnecting}
                onClick={handleApple}
                variant="outline"
                w="100%"
              >
                Sign in with Apple
              </Button>

              {showEmailInput ? (
                <VStack spacing={3} w="100%">
                  <Input
                    onChange={e => setEmail(e.target.value)}
                    placeholder="Email address"
                    type="email"
                    value={email}
                  />
                  <Button
                    isLoading={isConnecting}
                    onClick={handleEmailSubmit}
                    w="100%"
                  >
                    Continue
                  </Button>
                </VStack>
              ) : (
                <Button
                  isLoading={isConnecting}
                  onClick={() => setShowEmailInput(true)}
                  variant="outline"
                  w="100%"
                >
                  Sign in with Email
                </Button>
              )}

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
          )}
        </ModalBody>
      </ModalContent>
    </Modal>
  );
};
