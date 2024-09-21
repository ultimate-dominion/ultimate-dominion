import {
  Button,
  FormControl,
  FormHelperText,
  FormLabel,
  HStack,
  Input,
  InputGroup,
  InputRightElement,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Text,
  useDisclosure,
} from '@chakra-ui/react';
import { useCallback, useEffect, useState } from 'react';
import { formatEther, parseEther } from 'viem';

import { useAllowance } from '../contexts/AllowanceContext';
import { useCharacter } from '../contexts/CharacterContext';
import { useMovement } from '../contexts/MovementContext';
import { useMUD } from '../contexts/MUDContext';
import { useToast } from '../hooks/useToast';
import { etherToFixedNumber } from '../utils/helpers';
import { LootManagerAllowanceModal } from './LootManagerAllowanceModal';

type AdventureEscrowModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

export const AdventureEscrowModal: React.FC<AdventureEscrowModalProps> = ({
  isOpen,
  onClose,
}): JSX.Element => {
  const { renderError, renderSuccess } = useToast();
  const {
    delegatorAddress,
    systemCalls: { depositToEscrow, withdrawFromEscrow },
  } = useMUD();
  const { character, refreshCharacter } = useCharacter();
  const { goldLootManagerAllowance } = useAllowance();
  const { onSetIsMovementDisabled } = useMovement();

  const {
    isOpen: isAllowanceModalOpen,
    onOpen: onOpenAllowanceModal,
    onClose: onCloseAllowanceModal,
  } = useDisclosure();

  const [depositAmount, setDepositAmount] = useState<string>('');
  const [isDepositing, setIsDepositing] = useState(false);
  const [depositErrorMessage, setDepositErrorMessage] = useState<string | null>(
    null,
  );

  const [withdrawAmount, setWithdrawAmount] = useState<string>('');
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
      setDepositAmount('');
      setWithdrawAmount('');

      refreshCharacter();
      onSetIsMovementDisabled(true);
    }

    return () => onSetIsMovementDisabled(false);
  }, [isOpen, onSetIsMovementDisabled, refreshCharacter]);

  const onDeposit = useCallback(async () => {
    try {
      setIsDepositing(true);

      if (!character) {
        throw new Error('No character found.');
      }

      if (!delegatorAddress) {
        throw new Error('Missing delegation.');
      }

      if (!depositAmount || parseEther(depositAmount) <= 0) {
        setDepositErrorMessage('Amount must be greater than 0.');
        return;
      }

      if (parseEther(depositAmount) > character.externalGoldBalance) {
        setDepositErrorMessage('Insufficient $GOLD in external wallet.');
        return;
      }

      if (parseEther(depositAmount) > goldLootManagerAllowance) {
        onOpenAllowanceModal();
        return;
      }

      const { error, success } = await depositToEscrow(
        character.id,
        character.escrowGoldBalance,
        parseEther(depositAmount),
      );

      if (error && !success) {
        throw new Error(error);
      }

      await refreshCharacter();
      renderSuccess(`${depositAmount} $GOLD deposited successfully!`);
      onClose();
    } catch (e) {
      renderError((e as Error)?.message ?? 'Error depositing $GOLD.', e);
    } finally {
      setIsDepositing(false);
    }
  }, [
    character,
    delegatorAddress,
    depositAmount,
    depositToEscrow,
    goldLootManagerAllowance,
    onClose,
    onOpenAllowanceModal,
    refreshCharacter,
    renderError,
    renderSuccess,
  ]);

  const onWithdraw = useCallback(async () => {
    try {
      setIsWithdrawing(true);

      if (!character) {
        throw new Error('No character found.');
      }

      if (!delegatorAddress) {
        throw new Error('Missing delegation.');
      }

      if (!withdrawAmount || parseEther(withdrawAmount) <= 0) {
        setWithdrawErrorMessage('Amount must be greater than 0.');
        return;
      }

      if (parseEther(withdrawAmount) > character.escrowGoldBalance) {
        setWithdrawErrorMessage('Insufficient $GOLD in escrow.');
        return;
      }

      const { error, success } = await withdrawFromEscrow(
        character.id,
        character.escrowGoldBalance,
        parseEther(withdrawAmount),
      );

      if (error && !success) {
        throw new Error(error);
      }

      await refreshCharacter();
      renderSuccess(`${withdrawAmount} $GOLD withdrawn successfully!`);
      onClose();
    } catch (e) {
      renderError((e as Error)?.message ?? 'Error withdrawing $GOLD.', e);
    } finally {
      setIsWithdrawing(false);
    }
  }, [
    character,
    delegatorAddress,
    onClose,
    refreshCharacter,
    renderError,
    renderSuccess,
    withdrawAmount,
    withdrawFromEscrow,
  ]);

  if (!character) {
    return (
      <Modal isOpen={isOpen} onClose={onClose}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Adventure Escrow</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Text>An error occurred.</Text>
          </ModalBody>
          <ModalFooter>
            <Button onClick={onClose}>Close</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    );
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>Adventure Escrow</ModalHeader>
        <ModalCloseButton />
        <ModalBody alignItems="center" textAlign="center" p={4}>
          <Text size={{ base: 'xs', sm: 'md' }}>
            External wallet balance:{' '}
            <Text as="span" fontWeight="bold">
              {etherToFixedNumber(character.externalGoldBalance)} $GOLD
            </Text>
          </Text>
          <Text mt={2} size={{ base: 'xs', sm: 'md' }}>
            Adventure Escrow balance:{' '}
            <Text as="span" fontWeight="bold">
              {etherToFixedNumber(character.escrowGoldBalance)} $GOLD
            </Text>
          </Text>
          <Text textAlign="center" fontSize="60px">
            💰
          </Text>
          <Text mt={4} size={{ base: 'xs', sm: 'sm' }}>
            Your Adventure Escrow is where $GOLD goes when you win battles.
            Leaving $GOLD in your escrow will help you level up faster, but in
            the Outer Realms, you run the risk of losing it all against other
            players.
          </Text>
          <HStack mt={8}>
            <FormControl isInvalid={!!depositErrorMessage}>
              <FormLabel fontSize="xs">Deposit to session wallet</FormLabel>
              {!!depositErrorMessage && (
                <FormHelperText
                  color="red"
                  fontSize="xs"
                  mb={2}
                  textAlign="left"
                >
                  {depositErrorMessage}
                </FormHelperText>
              )}
              <InputGroup>
                <Input
                  isDisabled={isDepositing}
                  onChange={e => setDepositAmount(e.target.value)}
                  placeholder="Amount"
                  type="number"
                  value={depositAmount}
                />
                <InputRightElement>
                  <Button
                    h="100%"
                    mt={1}
                    onClick={() => {
                      setDepositAmount(
                        formatEther(character.externalGoldBalance),
                      );
                    }}
                    size="xs"
                    variant="ghost"
                  >
                    MAX
                  </Button>
                </InputRightElement>
              </InputGroup>
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
          <HStack mb={8} mt={4}>
            <FormControl isInvalid={!!withdrawErrorMessage}>
              <FormLabel fontSize="xs">Withdraw from session wallet</FormLabel>
              {!!withdrawErrorMessage && (
                <FormHelperText
                  color="red"
                  fontSize="xs"
                  mb={2}
                  textAlign="left"
                >
                  {withdrawErrorMessage}
                </FormHelperText>
              )}
              <InputGroup>
                <Input
                  isDisabled={isWithdrawing}
                  onChange={e => setWithdrawAmount(e.target.value)}
                  placeholder="Amount"
                  type="number"
                  value={withdrawAmount}
                />
                <InputRightElement>
                  <Button
                    h="100%"
                    mt={1}
                    onClick={() => {
                      setWithdrawAmount(
                        formatEther(character.escrowGoldBalance),
                      );
                    }}
                    size="xs"
                    variant="ghost"
                  >
                    MAX
                  </Button>
                </InputRightElement>
              </InputGroup>
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
        </ModalBody>
        <ModalFooter>
          <Button onClick={onClose} size="sm" variant="ghost">
            Close
          </Button>
        </ModalFooter>
      </ModalContent>
      <LootManagerAllowanceModal
        amount={depositAmount}
        heading="Allow Adventure Escrow"
        isOpen={isAllowanceModalOpen}
        message="In order to deposit $GOLD to your Adventure Escrow, you must allow it to access your $GOLD."
        onClose={onCloseAllowanceModal}
        successMessage="You can now deposit $GOLD to your Adventure Escrow."
      />
    </Modal>
  );
};
