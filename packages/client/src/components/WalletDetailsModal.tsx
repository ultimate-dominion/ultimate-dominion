import {
  AlertDialog,
  AlertDialogBody,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogOverlay,
  Button,
  Divider,
  FormControl,
  FormHelperText,
  FormLabel,
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
import { shortenAddress } from '../utils/helpers';

import { CopyText } from './CopyText';
import { PolygonalCard } from './PolygonalCard';
import { SignInModal } from './SignInModal';

export const WalletDetailsModal = ({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}): JSX.Element => {
  const { renderSuccess, renderError } = useToast();
  const { data: externalWalletClient } = useWalletClient();
  const { authMethod, isAuthenticated, ownerAddress, disconnect } = useAuth();
  const {
    burnerAddress,
    burnerBalance,
    handleLogoutRevoke,
    handleRevokeDelegation,
    isRevokingDelegation,
    network: { walletClient, publicClient },
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
          <ModalHeader>Account Details</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <VStack spacing={6} alignItems="start">
              <Text>Account:</Text>
              <CopyText text={ownerAddress!}>
                <Text>{shortenAddress(ownerAddress!)}</Text>
              </CopyText>
              <Text size="sm">Balance: {burnerBalance}</Text>
              <Button
                isDisabled={character?.inBattle}
                isLoading={logoutTx.isLoading}
                onClick={onLogout}
                size="sm"
              >
                Sign Out
              </Button>
              {character?.inBattle && (
                <Text color="orange" fontWeight={700} size="sm">
                  You cannot sign out while in battle.
                </Text>
              )}
            </VStack>
          </ModalBody>
          <ModalFooter>
            <Button onClick={onClose} size="sm" variant="ghost">
              Close
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    );
  }

  // External wallet — full view with session wallet, deposit, withdraw
  return (
    <>
    <Modal isOpen={isOpen} onClose={onClose}>
      <ModalOverlay />
      <ModalContent>
        <PolygonalCard isModal />
        <ModalHeader>Account Settings</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          {ownerAddress && externalWalletClient ? (
            <VStack spacing={10}>
              <VStack alignItems="start" spacing={4}>
                {burnerBalance === '0' && (
                  <>
                    <Text color="red" fontWeight={700} size="sm">
                      Your game account balance is 0. In order to play, you
                      must add funds to your game account.
                    </Text>
                    <Divider />
                  </>
                )}
                <Text>Main Account:</Text>
                <CopyText text={ownerAddress}>
                  <Text>{shortenAddress(ownerAddress)}</Text>
                </CopyText>
                <Text size="sm">
                  Balance:{' '}
                  {externalWalletBalance
                    ? formatEther(externalWalletBalance.value)
                    : '0'}
                </Text>
                <Button
                  isDisabled={character?.inBattle}
                  isLoading={logoutTx.isLoading}
                  onClick={onLogout}
                  size="sm"
                >
                  Logout
                </Button>
                {character?.inBattle && (
                  <Text color="orange" fontWeight={700} size="sm">
                    You cannot logout while in battle.
                  </Text>
                )}
                <Divider />
                <Text>Game Account:</Text>
                <CopyText text={burnerAddress}>
                  <Text>{shortenAddress(burnerAddress)}</Text>
                </CopyText>
                <Text size="sm">Balance: {burnerBalance}</Text>
                <Text fontWeight={700} size="sm">
                  We recommend keeping a small amount here for gameplay.
                </Text>
                <HStack>
                  <FormControl isInvalid={!!depositErrorMessage}>
                    <FormLabel fontSize="xs">
                      Add funds to game account
                    </FormLabel>
                    {!!depositErrorMessage && (
                      <FormHelperText color="red" fontSize="xs" mb={2}>
                        {depositErrorMessage}
                      </FormHelperText>
                    )}
                    <Input
                      isDisabled={isDepositing}
                      onChange={e => setDepositAmount(e.target.value)}
                      placeholder="Amount"
                      type="number"
                      value={depositAmount}
                    />
                  </FormControl>
                  <Button
                    alignSelf="end"
                    isLoading={isDepositing}
                    onClick={onDeposit}
                    size="sm"
                  >
                    Deposit
                  </Button>
                </HStack>
                <HStack>
                  <FormControl isInvalid={!!withdrawErrorMessage}>
                    <FormLabel fontSize="xs">
                      Withdraw to main account
                    </FormLabel>
                    {character && character.level < 3n && (
                      <FormHelperText color="orange" fontSize="xs" mb={2}>
                        Withdrawals are locked until level 3. Your game account
                        ETH covers gas fees during early gameplay.
                      </FormHelperText>
                    )}
                    {!!withdrawErrorMessage && (
                      <FormHelperText color="red" fontSize="xs" mb={2}>
                        {withdrawErrorMessage}
                      </FormHelperText>
                    )}
                    <Input
                      isDisabled={
                        isWithdrawing ||
                        (!!character && character.level < 3n)
                      }
                      onChange={e => setWithdrawAmount(e.target.value)}
                      placeholder="Amount"
                      type="number"
                      value={withdrawAmount}
                    />
                  </FormControl>
                  <Button
                    alignSelf="end"
                    isDisabled={!!character && character.level < 3n}
                    isLoading={isWithdrawing}
                    onClick={onWithdraw}
                    size="sm"
                  >
                    Withdraw
                  </Button>
                </HStack>
                <Divider />
                <Button
                  colorScheme="red"
                  isDisabled={character?.inBattle || isRevokingDelegation}
                  isLoading={isRevokingDelegation}
                  loadingText="Revoking..."
                  onClick={() => setIsRevokeDialogOpen(true)}
                  size="sm"
                  variant="outline"
                >
                  Reset Game Account
                </Button>
                {character?.inBattle && (
                  <Text color="orange" fontWeight={700} size="sm">
                    You cannot revoke while in battle.
                  </Text>
                )}
              </VStack>
            </VStack>
          ) : (
            <VStack spacing={10}>
              <Text textAlign="center">Connecting wallet...</Text>
            </VStack>
          )}
        </ModalBody>
        <ModalFooter>
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
            Reset Game Account?
          </AlertDialogHeader>
          <AlertDialogBody>
            This will remove the game account&apos;s permission to play on
            your behalf. Any remaining funds stay in the game account.
          </AlertDialogBody>
          <AlertDialogFooter>
            <Button
              onClick={() => setIsRevokeDialogOpen(false)}
              ref={cancelRevokeRef}
            >
              Cancel
            </Button>
            <Button colorScheme="red" ml={3} onClick={onConfirmRevoke}>
              Revoke
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialogOverlay>
    </AlertDialog>
    </>
  );
};
