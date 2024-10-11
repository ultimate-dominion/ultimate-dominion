import {
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
import { useCallback, useEffect, useState } from 'react';
import { formatEther, parseEther } from 'viem';
import { useAccount, useBalance, useDisconnect, useWalletClient } from 'wagmi';

import { useCharacter } from '../contexts/CharacterContext';
import { useMap } from '../contexts/MapContext';
import { useMUD } from '../contexts/MUDContext';
import { useToast } from '../hooks/useToast';
import { shortenAddress } from '../utils/helpers';
import { ConnectWalletButton } from './ConnectWalletButton';
import { CopyText } from './CopyText';

export const WalletDetailsModal = ({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}): JSX.Element => {
  const { renderSuccess, renderError } = useToast();
  const { data: externalWalletClient } = useWalletClient();
  const { disconnect } = useDisconnect();
  const { isConnected, address } = useAccount();
  const {
    burnerAddress,
    burnerBalance,
    network: { walletClient },
    systemCalls: { removeEntityFromBoard },
  } = useMUD();
  const { data: externalWalletBalance, refetch } = useBalance({
    address: externalWalletClient?.account.address,
  });
  const { character } = useCharacter();
  const { isSpawned } = useMap();

  const [isLoggingOut, setIsLoggingOut] = useState(false);

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

  const onLogout = useCallback(async () => {
    try {
      setIsLoggingOut(true);
      if (character?.locked && isSpawned) {
        const { error, success } = await removeEntityFromBoard(character.id);

        if (error && !success) {
          throw new Error(error);
        }
      }
      disconnect();
      renderSuccess('Wallet disconnected successfully!');
    } catch (e) {
      renderError((e as Error)?.message ?? 'Error disconnecting wallet.', e);
    } finally {
      setIsLoggingOut(false);
    }
  }, [
    character,
    disconnect,
    isSpawned,
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
        setWithdrawErrorMessage('Insufficient funds in session wallet.');
        return;
      }

      await walletClient.sendTransaction({
        to: address,
        value: parseEther(withdrawAmount),
      });

      setWithdrawAmount('0');
      renderSuccess('Funds withdrawn successfully!');
    } catch (e) {
      renderError((e as Error)?.message ?? 'Error withdrawing funds.', e);
    } finally {
      setIsWithdrawing(false);
    }
  }, [
    address,
    burnerBalance,
    renderError,
    renderSuccess,
    walletClient,
    withdrawAmount,
  ]);

  const onDownloadSessionPrivateKey = useCallback(() => {
    try {
      const element = document.createElement('a');
      const sessionPrivateKey = localStorage.getItem('mud:burnerWallet');
      if (!sessionPrivateKey) {
        throw new Error('No session wallet found.');
      }
      const file = new Blob([sessionPrivateKey], { type: 'text/plain' });
      element.href = URL.createObjectURL(file);
      element.download = 'ultimate-dominion-session-wallet-pk.txt';
      document.body.appendChild(element);
      element.click();
      document.body.removeChild(element);
    } catch (e) {
      renderError((e as Error)?.message ?? 'Error downloading private key.', e);
    }
  }, [renderError]);

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>
          {isConnected ? 'Wallet Details' : 'Connect Wallet'}
        </ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          {address && externalWalletClient && isConnected ? (
            <VStack spacing={10}>
              <VStack alignItems="start" spacing={4}>
                {burnerBalance === '0' && (
                  <>
                    <Text color="red" fontWeight={700} size="sm">
                      Your session wallet balance is 0. In order to play, you
                      must deposit funds into your session account.
                    </Text>
                    <Divider />
                  </>
                )}
                <Text>Connected Account:</Text>
                <CopyText text={address}>
                  <Text>{shortenAddress(address)}</Text>
                </CopyText>
                <Text size="sm">
                  Balance:{' '}
                  {externalWalletBalance
                    ? formatEther(externalWalletBalance.value)
                    : '0'}
                </Text>
                <Button
                  isDisabled={character?.inBattle}
                  isLoading={isLoggingOut}
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
                <Text>Session Account:</Text>
                <VStack alignItems="start" spacing={0}>
                  <CopyText text={burnerAddress}>
                    <Text>{shortenAddress(burnerAddress)}</Text>
                  </CopyText>
                  <Button
                    onClick={onDownloadSessionPrivateKey}
                    size="xs"
                    variant="outline"
                  >
                    Export Private Key
                  </Button>
                </VStack>
                <Text size="sm">Balance: {burnerBalance}</Text>
                <Text fontWeight={700} size="sm">
                  Do not deposit any funds into this account that you are not
                  willing to lose. We recommend no more than 0.0005 ETH at a
                  time.
                </Text>
                <HStack>
                  <FormControl isInvalid={!!depositErrorMessage}>
                    <FormLabel fontSize="xs">
                      Deposit to session wallet
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
                      Withdraw from session wallet
                    </FormLabel>
                    {!!withdrawErrorMessage && (
                      <FormHelperText color="red" fontSize="xs" mb={2}>
                        {withdrawErrorMessage}
                      </FormHelperText>
                    )}
                    <Input
                      isDisabled={isWithdrawing}
                      onChange={e => setWithdrawAmount(e.target.value)}
                      placeholder="Amount"
                      type="number"
                      value={withdrawAmount}
                    />
                  </FormControl>
                  <Button
                    alignSelf="end"
                    isLoading={isWithdrawing}
                    onClick={onWithdraw}
                    size="sm"
                  >
                    Withdraw
                  </Button>
                </HStack>
              </VStack>
            </VStack>
          ) : (
            <VStack spacing={10}>
              <Text textAlign="center">Connect your wallet to play.</Text>
              <ConnectWalletButton />
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
  );
};
