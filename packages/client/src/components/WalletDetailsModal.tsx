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
import { useAccount, useBalance, useWalletClient } from 'wagmi';

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
  const { isConnected, address } = useAccount();
  const { burnerAddress, burnerBalance } = useMUD();
  const { data: externalWalletBalance } = useBalance({
    address: externalWalletClient?.account.address,
  });

  const [amount, setAmount] = useState<string>('0');
  const [isDepositing, setIsDepositing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Reset errorMessage state when any of the form fields change
  useEffect(() => {
    setErrorMessage(null);
  }, [amount]);

  const onDeposit = useCallback(async () => {
    try {
      setIsDepositing(true);

      if (!(externalWalletBalance && externalWalletClient)) {
        throw new Error('No external wallet client found');
      }

      if (!amount || parseEther(amount) <= 0) {
        setErrorMessage('Amount must be greater than 0');
        return;
      }

      if (parseEther(amount) > externalWalletBalance.value) {
        setErrorMessage('Insufficient funds in external wallet');
        return;
      }

      await externalWalletClient.sendTransaction({
        to: burnerAddress,
        value: parseEther(amount),
      });

      setAmount('0');
      renderSuccess('Funds deposited successfully!');
    } catch (error) {
      renderError(error, 'Error depositing funds');
    } finally {
      setIsDepositing(false);
    }
  }, [
    amount,
    burnerAddress,
    externalWalletBalance,
    externalWalletClient,
    renderError,
    renderSuccess,
  ]);

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
            <VStack p={4} spacing={10}>
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
                <Divider />
                <Text>Session Account:</Text>
                <CopyText text={burnerAddress}>
                  <Text>{shortenAddress(burnerAddress)}</Text>
                </CopyText>
                <Text size="sm">Balance: {burnerBalance}</Text>
                <Text fontWeight={700} size="sm">
                  Do not deposit any funds into this account that you are not
                  willing to lose. We recommend no more than 0.005 ETH at a
                  time.
                </Text>
                <HStack>
                  <FormControl isInvalid={!!errorMessage}>
                    <FormLabel fontSize="xs">
                      Deposit to session wallet
                    </FormLabel>
                    {!!errorMessage && (
                      <FormHelperText color="red" fontSize="xs" mb={2}>
                        {errorMessage}
                      </FormHelperText>
                    )}
                    <Input
                      isDisabled={isDepositing}
                      onChange={e => setAmount(e.target.value)}
                      placeholder="Amount"
                      type="number"
                      value={amount}
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
              </VStack>
            </VStack>
          ) : (
            <VStack p={4} spacing={10}>
              <Text textAlign="center">Connect your wallet to play.</Text>
              <ConnectWalletButton />
            </VStack>
          )}
        </ModalBody>
        <ModalFooter>
          <Button onClick={onClose} size="sm">
            Close
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};
