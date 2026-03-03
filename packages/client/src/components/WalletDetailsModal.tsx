import {
  AlertDialog,
  AlertDialogBody,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogOverlay,
  Box,
  Button,
  Collapse,
  Divider,
  FormControl,
  FormHelperText,
  HStack,
  Input,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Text,
  VStack,
} from '@chakra-ui/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { formatEther, parseEther } from 'viem';
import { useBalance, useWalletClient } from 'wagmi';

import { useAuth } from '../contexts/AuthContext';
import { useCharacter } from '../contexts/CharacterContext';
import { useMap } from '../contexts/MapContext';
import { useMUD } from '../contexts/MUDContext';
import { useToast } from '../hooks/useToast';
import { useTransaction } from '../hooks/useTransaction';

import { PolygonalCard } from './PolygonalCard';
import { SignInModal } from './SignInModal';

/** Format ETH to a readable number (up to 6 decimals, strip trailing zeros) */
function formatBalance(wei: bigint | string): string {
  const raw = typeof wei === 'string' ? wei : formatEther(wei);
  const num = parseFloat(raw);
  if (num === 0) return '0';
  if (num < 0.000001) return '<0.000001';
  return num.toFixed(6).replace(/\.?0+$/, '');
}

export const WalletDetailsModal = ({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}): JSX.Element => {
  const { renderSuccess, renderError } = useToast();
  const { data: externalWalletClient } = useWalletClient();
  const { authMethod, isAuthenticated, ownerAddress, signedInEmail, disconnect } = useAuth();
  const {
    burnerAddress,
    burnerBalance,
    handleLogoutRevoke,
    handleRevokeDelegation,
    isRevokingDelegation,
    network: { walletClient },
    systemCalls: { removeEntityFromBoard },
  } = useMUD();
  const { data: externalWalletBalance, refetch } = useBalance({
    address: externalWalletClient?.account.address,
  });
  const { character } = useCharacter();
  const { isSpawned } = useMap();

  const logoutTx = useTransaction({ actionName: 'sign out', showSuccessToast: false });

  const [depositAmount, setDepositAmount] = useState<string>('0');
  const [isDepositing, setIsDepositing] = useState(false);
  const [depositErrorMessage, setDepositErrorMessage] = useState<string | null>(
    null,
  );

  const [withdrawAmount, setWithdrawAmount] = useState<string>('0');
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [withdrawErrorMessage, setWithdrawErrorMessage] = useState<
    string | null
  >(null);

  const [isRevokeDialogOpen, setIsRevokeDialogOpen] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const cancelRevokeRef = useRef<HTMLButtonElement>(null);

  // Reset errorMessage state when any of the form fields change
  useEffect(() => {
    setDepositErrorMessage(null);
    setWithdrawErrorMessage(null);
  }, [depositAmount, withdrawAmount]);

  useEffect(() => {
    if (isOpen) {
      setDepositAmount('0');
      setWithdrawAmount('0');
      setShowAdvanced(false);

      refetch();
    }
  }, [isOpen, refetch]);

  const onConfirmRevoke = useCallback(async () => {
    setIsRevokeDialogOpen(false);
    try {
      await handleRevokeDelegation();
      renderSuccess('Game account has been reset.');
    } catch (e) {
      renderError(
        (e as Error)?.message ?? 'Error revoking delegation.',
        e,
      );
    }
  }, [handleRevokeDelegation, renderError, renderSuccess]);

  const onLogout = useCallback(async () => {
    if (character?.locked && isSpawned) {
      const result = await logoutTx.execute(async () => {
        const { error, success } = await removeEntityFromBoard(character.id);
        if (error && !success) throw new Error(error);
      });
      if (result === undefined) return;
    }

    try {
      // Best-effort revoke delegation before disconnecting
      if (authMethod === 'external') {
        await handleLogoutRevoke();
      }
      await disconnect();
      renderSuccess(
        authMethod === 'embedded'
          ? 'Signed out successfully!'
          : 'Wallet disconnected successfully!',
      );
    } catch (e) {
      renderError((e as Error)?.message ?? 'Error disconnecting.', e);
    }
  }, [
    authMethod,
    character,
    disconnect,
    handleLogoutRevoke,
    isSpawned,
    logoutTx,
    removeEntityFromBoard,
    renderError,
    renderSuccess,
  ]);

  const onDeposit = useCallback(async () => {
    try {
      setIsDepositing(true);

      if (!(externalWalletBalance && externalWalletClient)) {
        throw new Error('No external wallet client found.');
      }

      if (!depositAmount || parseEther(depositAmount) <= 0) {
        setDepositErrorMessage('Amount must be greater than 0.');
        return;
      }

      if (parseEther(depositAmount) > externalWalletBalance.value) {
        setDepositErrorMessage('Insufficient funds in external wallet.');
        return;
      }

      await externalWalletClient.sendTransaction({
        to: burnerAddress,
        value: parseEther(depositAmount),
        gas: 21000n, // Standard gas limit for ETH transfers
        maxFeePerGas: 2000000000n, // 2 gwei max fee
        maxPriorityFeePerGas: 1000000000n, // 1 gwei priority fee
      });

      setDepositAmount('0');
      await refetch();
      renderSuccess('Funds deposited successfully!');
    } catch (e) {
      renderError((e as Error)?.message ?? 'Error depositing funds.', e);
    } finally {
      setIsDepositing(false);
    }
  }, [
    burnerAddress,
    depositAmount,
    externalWalletBalance,
    externalWalletClient,
    refetch,
    renderError,
    renderSuccess,
  ]);

  const onWithdraw = useCallback(async () => {
    try {
      setIsWithdrawing(true);

      if (!withdrawAmount || parseEther(withdrawAmount) <= 0) {
        setWithdrawErrorMessage('Amount must be greater than 0.');
        return;
      }

      if (parseEther(withdrawAmount) > parseEther(burnerBalance)) {
        setWithdrawErrorMessage('Insufficient funds in game account.');
        return;
      }

      await walletClient.sendTransaction({
        to: ownerAddress!,
        value: parseEther(withdrawAmount),
        gas: 21000n, // Standard gas limit for ETH transfers
        maxFeePerGas: 2000000000n, // 2 gwei max fee
        maxPriorityFeePerGas: 1000000000n, // 1 gwei priority fee
      });

      setWithdrawAmount('0');
      renderSuccess('Funds withdrawn successfully!');
    } catch (e) {
      renderError((e as Error)?.message ?? 'Error withdrawing funds.', e);
    } finally {
      setIsWithdrawing(false);
    }
  }, [
    burnerBalance,
    ownerAddress,
    renderError,
    renderSuccess,
    walletClient,
    withdrawAmount,
  ]);

  // Not authenticated — show sign in modal
  if (!isAuthenticated) {
    return <SignInModal isOpen={isOpen} onClose={onClose} />;
  }

  // Embedded wallet — simplified view (no deposit/withdraw, no session wallet)
  if (authMethod === 'embedded') {
    return (
      <Modal isOpen={isOpen} onClose={onClose}>
        <ModalOverlay />
        <ModalContent>
          <PolygonalCard isModal />
          <ModalHeader>Account</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <VStack spacing={4} alignItems="start">
              {signedInEmail && (
                <Box>
                  <Text
                    color="#8A7E6A"
                    fontSize="xs"
                    letterSpacing="wide"
                    textTransform="uppercase"
                  >
                    Signed in as
                  </Text>
                  <Text fontSize="sm" fontWeight={500}>
                    {signedInEmail}
                  </Text>
                </Box>
              )}
              <Box>
                <Text
                  color="#8A7E6A"
                  fontSize="xs"
                  letterSpacing="wide"
                  textTransform="uppercase"
                >
                  Balance
                </Text>
                <Text fontSize="2xl" fontWeight={700}>
                  {formatBalance(burnerBalance)} ETH
                </Text>
              </Box>
            </VStack>
          </ModalBody>
          <ModalFooter justifyContent="space-between">
            <Button
              isDisabled={character?.inBattle}
              isLoading={logoutTx.isLoading}
              onClick={onLogout}
              size="sm"
              variant="ghost"
            >
              Sign Out
            </Button>
            {character?.inBattle && (
              <Text color="#C87A2A" fontSize="xs" fontWeight={700}>
                Cannot sign out during battle.
              </Text>
            )}
            <Button onClick={onClose} size="sm" variant="ghost">
              Close
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    );
  }

  // External wallet — simplified view with deposit focus
  const needsFunding = burnerBalance === '0';

  return (
    <>
      <Modal isOpen={isOpen} onClose={onClose}>
        <ModalOverlay />
        <ModalContent>
          <PolygonalCard isModal />
          <ModalHeader>
            {needsFunding ? 'Fund Your Session' : 'Account'}
          </ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            {ownerAddress && externalWalletClient ? (
              <VStack align="stretch" spacing={6}>
                {/* Prompt when session has no funds */}
                {needsFunding && (
                  <Text fontSize="sm">
                    A small ETH deposit is needed to cover gameplay transaction
                    fees. This stays in your session and can be withdrawn later.
                  </Text>
                )}

                {/* Session balance when funded */}
                {!needsFunding && (
                  <Box>
                    <Text
                      color="#8A7E6A"
                      fontSize="xs"
                      letterSpacing="wide"
                      textTransform="uppercase"
                    >
                      Session Balance
                    </Text>
                    <Text fontSize="2xl" fontWeight={700}>
                      {formatBalance(burnerBalance)} ETH
                    </Text>
                  </Box>
                )}

                {/* Deposit */}
                <Box>
                  {!needsFunding && (
                    <Text color="#8A7E6A" fontSize="xs" mb={2}>
                      Add funds
                    </Text>
                  )}
                  <FormControl isInvalid={!!depositErrorMessage}>
                    {!!depositErrorMessage && (
                      <FormHelperText color="red" fontSize="xs" mb={2}>
                        {depositErrorMessage}
                      </FormHelperText>
                    )}
                    <HStack>
                      <Input
                        isDisabled={isDepositing}
                        onChange={e => setDepositAmount(e.target.value)}
                        placeholder="ETH amount"
                        type="number"
                        value={depositAmount}
                      />
                      <Button
                        isLoading={isDepositing}
                        onClick={onDeposit}
                        size="sm"
                      >
                        Deposit
                      </Button>
                    </HStack>
                    <Text color="#8A7E6A" fontSize="xs" mt={1}>
                      Wallet balance:{' '}
                      {externalWalletBalance
                        ? formatBalance(externalWalletBalance.value)
                        : '0'}{' '}
                      ETH
                    </Text>
                  </FormControl>
                </Box>

                {/* Advanced options (withdraw, reset) */}
                <Box>
                  <Button
                    color="#8A7E6A"
                    onClick={() => setShowAdvanced(!showAdvanced)}
                    size="xs"
                    variant="link"
                  >
                    {showAdvanced ? 'Hide advanced' : 'Advanced options'}
                  </Button>
                  <Collapse in={showAdvanced}>
                    <VStack align="stretch" mt={4} spacing={4}>
                      <FormControl isInvalid={!!withdrawErrorMessage}>
                        <Text color="#8A7E6A" fontSize="xs" mb={1}>
                          Withdraw to wallet
                        </Text>
                        {character && character.level < 3n && (
                          <FormHelperText
                            color="#C87A2A"
                            fontSize="xs"
                            mb={2}
                          >
                            Withdrawals unlock at level 3.
                          </FormHelperText>
                        )}
                        {!!withdrawErrorMessage && (
                          <FormHelperText color="red" fontSize="xs" mb={2}>
                            {withdrawErrorMessage}
                          </FormHelperText>
                        )}
                        <HStack>
                          <Input
                            isDisabled={
                              isWithdrawing ||
                              (!!character && character.level < 3n)
                            }
                            onChange={e => setWithdrawAmount(e.target.value)}
                            placeholder="ETH amount"
                            type="number"
                            value={withdrawAmount}
                          />
                          <Button
                            isDisabled={!!character && character.level < 3n}
                            isLoading={isWithdrawing}
                            onClick={onWithdraw}
                            size="sm"
                          >
                            Withdraw
                          </Button>
                        </HStack>
                      </FormControl>
                      <Divider />
                      <Button
                        borderColor="#B83A2A"
                        color="#B83A2A"
                        isDisabled={
                          character?.inBattle || isRevokingDelegation
                        }
                        isLoading={isRevokingDelegation}
                        loadingText="Resetting..."
                        onClick={() => setIsRevokeDialogOpen(true)}
                        size="sm"
                        variant="outline"
                        _hover={{ bg: 'rgba(184,58,42,0.12)' }}
                      >
                        Reset Session
                      </Button>
                    </VStack>
                  </Collapse>
                </Box>
              </VStack>
            ) : (
              <VStack spacing={10}>
                <Text textAlign="center">Connecting...</Text>
              </VStack>
            )}
          </ModalBody>
          <ModalFooter justifyContent="space-between">
            <Button
              isDisabled={character?.inBattle}
              isLoading={logoutTx.isLoading}
              onClick={onLogout}
              size="sm"
              variant="ghost"
            >
              Disconnect
            </Button>
            {character?.inBattle && (
              <Text color="#C87A2A" fontSize="xs" fontWeight={700}>
                Cannot disconnect during battle.
              </Text>
            )}
            <Button onClick={onClose} size="sm" variant="ghost">
              Close
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <AlertDialog
        isOpen={isRevokeDialogOpen}
        leastDestructiveRef={cancelRevokeRef}
        onClose={() => setIsRevokeDialogOpen(false)}
      >
        <AlertDialogOverlay>
          <AlertDialogContent>
            <AlertDialogHeader fontSize="lg" fontWeight="bold">
              Reset Session?
            </AlertDialogHeader>
            <AlertDialogBody>
              This will reset your game session. Any remaining ETH stays in the
              session and can be recovered.
            </AlertDialogBody>
            <AlertDialogFooter>
              <Button
                onClick={() => setIsRevokeDialogOpen(false)}
                ref={cancelRevokeRef}
              >
                Cancel
              </Button>
              <Button
                borderColor="#B83A2A"
                color="#B83A2A"
                ml={3}
                onClick={onConfirmRevoke}
                variant="outline"
                _hover={{ bg: 'rgba(184,58,42,0.12)' }}
              >
                Reset
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>
    </>
  );
};
