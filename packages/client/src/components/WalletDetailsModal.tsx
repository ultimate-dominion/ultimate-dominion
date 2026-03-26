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
import { GiTwoCoins } from 'react-icons/gi';
import { formatEther, parseEther } from 'viem';
import { useBalance, useWalletClient } from 'wagmi';
import { useTranslation } from 'react-i18next';

import { useAuth } from '../contexts/AuthContext';
import { useCharacter } from '../contexts/CharacterContext';
import { useMap } from '../contexts/MapContext';
import { useMUD } from '../contexts/MUDContext';
import { useToast } from '../hooks/useToast';
import { useTransaction } from '../hooks/useTransaction';
import { etherToFixedNumber } from '../utils/helpers';

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
  const { t } = useTranslation('ui');
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
      renderSuccess(t('wallet.sessionReset'));
    } catch (e) {
      renderError(
        (e as Error)?.message ?? 'Error revoking delegation.',
        e,
      );
    }
  }, [handleRevokeDelegation, renderError, renderSuccess]);

  const onLogout = useCallback(async () => {
    // Best-effort despawn — don't block logout if it fails
    if (character?.locked && isSpawned) {
      try {
        await logoutTx.execute(async () => {
          const { error, success } = await removeEntityFromBoard(character.id);
          if (error && !success) throw new Error(error);
        });
      } catch (e) {
        console.warn('[Logout] removeEntityFromBoard failed, proceeding with disconnect:', e);
      }
    }

    try {
      // Best-effort revoke delegation before disconnecting
      if (authMethod === 'external') {
        await handleLogoutRevoke();
      }
      await disconnect();
      renderSuccess(
        authMethod === 'embedded'
          ? t('wallet.signedOutEmbedded')
          : t('wallet.disconnectedExternal'),
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
        setDepositErrorMessage(t('wallet.amountGreaterZero'));
        return;
      }

      if (parseEther(depositAmount) > externalWalletBalance.value) {
        setDepositErrorMessage(t('wallet.insufficientExternal'));
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
      renderSuccess(t('wallet.depositSuccess'));
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
        setWithdrawErrorMessage(t('wallet.amountGreaterZero'));
        return;
      }

      if (parseEther(withdrawAmount) > parseEther(burnerBalance)) {
        setWithdrawErrorMessage(t('wallet.insufficientSession'));
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
      renderSuccess(t('wallet.withdrawSuccess'));
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
          <ModalHeader>{t('wallet.account')}</ModalHeader>
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
                    {t('wallet.signedInAs')}
                  </Text>
                  <Text fontSize="sm" fontWeight={500}>
                    {signedInEmail}
                  </Text>
                </Box>
              )}
              {character && (
                <Box>
                  <HStack spacing={2} mb={1}>
                    <GiTwoCoins color="#D4A54A" size={16} />
                    <Text
                      color="#8A7E6A"
                      fontSize="xs"
                      letterSpacing="wide"
                      textTransform="uppercase"
                    >
                      {t('stats.gold')}
                    </Text>
                  </HStack>
                  <Text color="#D4A54A" fontFamily="mono" fontSize="2xl" fontWeight={700}>
                    {Number(etherToFixedNumber(
                      character.externalGoldBalance,
                    )).toLocaleString()}
                  </Text>
                </Box>
              )}
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
              {t('wallet.signOut')}
            </Button>
            {character?.inBattle && (
              <Text color="#C87A2A" fontSize="xs" fontWeight={700}>
                {t('wallet.cannotSignOutBattle')}
              </Text>
            )}
            <Button onClick={onClose} size="sm" variant="ghost">
              {t('common.close')}
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
            {needsFunding ? t('wallet.fundSession') : t('wallet.account')}
          </ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            {ownerAddress && externalWalletClient ? (
              <VStack align="stretch" spacing={6}>
                {/* Prompt when session has no funds */}
                {needsFunding && (
                  <Text fontSize="sm">
                    {t('wallet.fundingPrompt')}
                  </Text>
                )}

                {/* Gold balance */}
                {character && !needsFunding && (
                  <Box>
                    <HStack spacing={2} mb={1}>
                      <GiTwoCoins color="#D4A54A" size={16} />
                      <Text
                        color="#8A7E6A"
                        fontSize="xs"
                        letterSpacing="wide"
                        textTransform="uppercase"
                      >
                        {t('stats.gold')}
                      </Text>
                    </HStack>
                    <Text color="#D4A54A" fontFamily="mono" fontSize="2xl" fontWeight={700}>
                      {Number(etherToFixedNumber(
                        character.externalGoldBalance,
                      )).toLocaleString()}
                    </Text>
                  </Box>
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
                      {t('wallet.sessionBalance')}
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
                      {t('wallet.addFunds')}
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
                        placeholder={t('wallet.ethPlaceholder')}
                        type="number"
                        value={depositAmount}
                      />
                      <Button
                        isLoading={isDepositing}
                        onClick={onDeposit}
                        size="sm"
                      >
                        {t('wallet.deposit')}
                      </Button>
                    </HStack>
                    <Text color="#8A7E6A" fontSize="xs" mt={1}>
                      {t('wallet.walletBalance')}{' '}
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
                    {showAdvanced ? t('wallet.hideAdvanced') : t('wallet.advancedOptions')}
                  </Button>
                  <Collapse in={showAdvanced}>
                    <VStack align="stretch" mt={4} spacing={4}>
                      <FormControl isInvalid={!!withdrawErrorMessage}>
                        <Text color="#8A7E6A" fontSize="xs" mb={1}>
                          {t('wallet.withdrawToWallet')}
                        </Text>
                        {character && character.level < 3n && (
                          <FormHelperText
                            color="#C87A2A"
                            fontSize="xs"
                            mb={2}
                          >
                            {t('wallet.withdrawalsUnlock')}
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
                            placeholder={t('wallet.ethPlaceholder')}
                            type="number"
                            value={withdrawAmount}
                          />
                          <Button
                            isDisabled={!!character && character.level < 3n}
                            isLoading={isWithdrawing}
                            onClick={onWithdraw}
                            size="sm"
                          >
                            {t('wallet.withdraw')}
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
                        loadingText={t('wallet.resetting')}
                        onClick={() => setIsRevokeDialogOpen(true)}
                        size="sm"
                        variant="outline"
                        _hover={{ bg: 'rgba(184,58,42,0.12)' }}
                      >
                        {t('wallet.resetSession')}
                      </Button>
                    </VStack>
                  </Collapse>
                </Box>
              </VStack>
            ) : (
              <VStack spacing={10}>
                <Text textAlign="center">{t('wallet.connecting')}</Text>
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
              {t('wallet.disconnect')}
            </Button>
            {character?.inBattle && (
              <Text color="#C87A2A" fontSize="xs" fontWeight={700}>
                {t('wallet.cannotDisconnectBattle')}
              </Text>
            )}
            <Button onClick={onClose} size="sm" variant="ghost">
              {t('common.close')}
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
              {t('wallet.resetConfirmTitle')}
            </AlertDialogHeader>
            <AlertDialogBody>
              {t('wallet.resetConfirmBody')}
            </AlertDialogBody>
            <AlertDialogFooter>
              <Button
                onClick={() => setIsRevokeDialogOpen(false)}
                ref={cancelRevokeRef}
              >
                {t('common.cancel')}
              </Button>
              <Button
                borderColor="#B83A2A"
                color="#B83A2A"
                ml={3}
                onClick={onConfirmRevoke}
                variant="outline"
                _hover={{ bg: 'rgba(184,58,42,0.12)' }}
              >
                {t('wallet.reset')}
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>
    </>
  );
};
